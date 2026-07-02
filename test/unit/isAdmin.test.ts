import { describe, expect, it } from "vitest";
import { fetchIsAdmin } from "@/lib/queries";

type StubUser = { id: string; email: string; isAdmin?: boolean };

function stubPb(options: {
  authRecord: StubUser | null;
  serverRecord?: StubUser;
  fail?: boolean;
}) {
  return {
    authStore: { record: options.authRecord },
    collection: () => ({
      getOne: async () => {
        if (options.fail || !options.serverRecord) {
          throw new Error("network error");
        }
        return options.serverRecord;
      },
    }),
    // Only authStore/collection are exercised; cast for the test.
  } as unknown as Parameters<typeof fetchIsAdmin>[0];
}

describe("fetchIsAdmin", () => {
  it("returns false when not authenticated", async () => {
    expect(await fetchIsAdmin(stubPb({ authRecord: null }))).toBe(false);
  });

  it("reflects a promotion that happened after login", async () => {
    const pb = stubPb({
      authRecord: { id: "u1", email: "me@example.com", isAdmin: false },
      serverRecord: { id: "u1", email: "me@example.com", isAdmin: true },
    });
    expect(await fetchIsAdmin(pb)).toBe(true);
  });

  it("reflects a demotion that happened after login", async () => {
    const pb = stubPb({
      authRecord: { id: "u1", email: "me@example.com", isAdmin: true },
      serverRecord: { id: "u1", email: "me@example.com", isAdmin: false },
    });
    expect(await fetchIsAdmin(pb)).toBe(false);
  });

  it("falls back to the login-time snapshot when the fetch fails", async () => {
    const pb = stubPb({
      authRecord: { id: "u1", email: "me@example.com", isAdmin: true },
      fail: true,
    });
    expect(await fetchIsAdmin(pb)).toBe(true);
  });
});
