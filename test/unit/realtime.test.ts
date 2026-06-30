import { QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { QuoteRecord, QuotesPage, QuoteWithVote } from "@/lib/types";

// Capture the realtime callbacks the module registers, and expose a mutable
// auth record so tests can simulate "my vote" vs. "someone else's vote".
const mocks = vi.hoisted(() => ({
  handlers: {} as Record<string, (e: unknown) => void>,
  authStore: { record: { email: "me@example.com" } as { email: string } | null },
}));

vi.mock("@/lib/pocketbase", () => ({
  getPb: () => ({
    authStore: mocks.authStore,
    collection: (name: string) => ({
      subscribe: (_topic: string, cb: (e: unknown) => void) => {
        mocks.handlers[name] = cb;
        return Promise.resolve(() => {});
      },
      unsubscribe: () => Promise.resolve(),
    }),
  }),
}));

const { subscribeToRealtime } = await import("@/lib/realtime");

function quote(overrides: Partial<QuoteWithVote> = {}): QuoteWithVote {
  return {
    id: "q1",
    text: "hello",
    author: "a@example.com",
    shortId: 1,
    score: 0,
    created: "2026-01-01",
    updated: "2026-01-01",
    vote: 0,
    ...overrides,
  };
}

function page(quotes: QuoteWithVote[]): QuotesPage {
  return { quotes, totalCount: quotes.length, pageCount: 1 };
}

describe("subscribeToRealtime", () => {
  let qc: QueryClient;

  beforeEach(() => {
    mocks.authStore.record = { email: "me@example.com" };
    qc = new QueryClient();
    subscribeToRealtime(qc);
  });

  function fireQuote(action: string, record: Partial<QuoteRecord>) {
    mocks.handlers.quotes({ action, record });
  }

  it("invalidates every quote-list sort on a new quote", () => {
    qc.setQueryData(["quotes", "newest", 1, 20], page([]));
    qc.setQueryData(["quotes", "top", 1, 20], page([]));

    fireQuote("create", { id: "q2", shortId: 2 });

    expect(qc.getQueryState(["quotes", "newest", 1, 20])?.isInvalidated).toBe(true);
    expect(qc.getQueryState(["quotes", "top", 1, 20])?.isInvalidated).toBe(true);
  });

  it("does not invalidate single-quote caches on create", () => {
    qc.setQueryData(["quote", 1], quote());

    fireQuote("create", { id: "q2", shortId: 2 });

    expect(qc.getQueryState(["quote", 1])?.isInvalidated).toBe(false);
  });

  it("merges an updated score into lists while preserving the user's own vote", () => {
    qc.setQueryData(
      ["quotes", "newest", 1, 20],
      page([quote({ id: "q1", score: 0, vote: 1 })]),
    );

    fireQuote("update", { id: "q1", shortId: 1, score: 5, text: "hello" });

    const updated = qc.getQueryData<QuotesPage>(["quotes", "newest", 1, 20]);
    expect(updated?.quotes[0].score).toBe(5);
    expect(updated?.quotes[0].vote).toBe(1); // vote is client-side, not in the record
  });

  it("merges an updated score into the single-quote and search caches", () => {
    qc.setQueryData(["quote", 1], quote({ id: "q1", score: 0, vote: -1 }));
    qc.setQueryData(
      ["quotes", "search", "hel"],
      [quote({ id: "q1", score: 0, vote: -1 })],
    );

    fireQuote("update", { id: "q1", shortId: 1, score: 3, text: "hello" });

    expect(qc.getQueryData<QuoteWithVote>(["quote", 1])?.score).toBe(3);
    expect(qc.getQueryData<QuoteWithVote>(["quote", 1])?.vote).toBe(-1);
    expect(qc.getQueryData<QuoteWithVote[]>(["quotes", "search", "hel"])?.[0].score).toBe(3);
  });

  it("invalidates both list and detail caches on delete", () => {
    qc.setQueryData(["quotes", "newest", 1, 20], page([]));
    qc.setQueryData(["quote", 1], quote());

    fireQuote("delete", { id: "q1", shortId: 1 });

    expect(qc.getQueryState(["quotes", "newest", 1, 20])?.isInvalidated).toBe(true);
    expect(qc.getQueryState(["quote", 1])?.isInvalidated).toBe(true);
  });

  it("invalidates caches only for the current user's own vote changes", () => {
    qc.setQueryData(["quotes", "newest", 1, 20], page([]));
    mocks.handlers.votes({ action: "create", record: { author: "me@example.com" } });
    expect(qc.getQueryState(["quotes", "newest", 1, 20])?.isInvalidated).toBe(true);
  });

  it("ignores vote changes made by other users", () => {
    qc.setQueryData(["quotes", "newest", 1, 20], page([]));
    mocks.handlers.votes({ action: "create", record: { author: "other@example.com" } });
    expect(qc.getQueryState(["quotes", "newest", 1, 20])?.isInvalidated).toBe(false);
  });
});
