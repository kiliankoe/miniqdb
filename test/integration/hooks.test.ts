import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startPocketBase, type TestPocketBase } from "./pb-harness";

let env: TestPocketBase;

beforeAll(async () => {
  env = await startPocketBase();
});

afterAll(async () => {
  await env?.stop();
});

const authorA = "alice@example.com";
const authorB = "bob@example.com";

async function createQuote(text: string, author = authorA) {
  return env.pb.collection("quotes").create({ text, author });
}

async function getQuote(id: string) {
  return env.pb.collection("quotes").getOne(id);
}

describe("quote creation hooks", () => {
  it("assigns an incrementing shortId", async () => {
    const first = await createQuote("first quote");
    const second = await createQuote("second quote");
    expect(second.shortId).toBe(first.shortId + 1);
  });

  it("auto-votes +1 for the author, denormalizing score to 1", async () => {
    const quote = await createQuote("auto-voted quote");
    const fresh = await getQuote(quote.id);
    expect(fresh.score).toBe(1);

    const votes = await env.pb
      .collection("votes")
      .getFullList({ filter: `quote = "${quote.id}"` });
    expect(votes).toHaveLength(1);
    expect(votes[0].author).toBe(authorA);
    expect(votes[0].value).toBe(1);
  });
});

describe("vote scoring hooks", () => {
  it("recomputes score as votes are added, changed, and removed", async () => {
    const quote = await createQuote("scored quote");
    expect((await getQuote(quote.id)).score).toBe(1); // author auto-vote

    const bobVote = await env.pb
      .collection("votes")
      .create({ quote: quote.id, author: authorB, value: 1 });
    expect((await getQuote(quote.id)).score).toBe(2);

    await env.pb.collection("votes").update(bobVote.id, { value: -1 });
    expect((await getQuote(quote.id)).score).toBe(0);

    await env.pb.collection("votes").delete(bobVote.id);
    expect((await getQuote(quote.id)).score).toBe(1);
  });
});

describe("vote value validation hook", () => {
  it("rejects a vote value of 0 on create", async () => {
    const quote = await createQuote("validation quote");
    await expect(
      env.pb
        .collection("votes")
        .create({ quote: quote.id, author: authorB, value: 0 }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("rejects an out-of-range vote value on create", async () => {
    const quote = await createQuote("validation quote 2");
    await expect(
      env.pb
        .collection("votes")
        .create({ quote: quote.id, author: authorB, value: 5 }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("rejects an out-of-range value on update", async () => {
    const quote = await createQuote("validation quote 3");
    const vote = await env.pb
      .collection("votes")
      .create({ quote: quote.id, author: authorB, value: 1 });
    await expect(
      env.pb.collection("votes").update(vote.id, { value: 2 }),
    ).rejects.toMatchObject({ status: 400 });
  });
});

describe("cascade delete", () => {
  it("removes a quote's votes when the quote is deleted", async () => {
    const quote = await createQuote("doomed quote");
    await env.pb
      .collection("votes")
      .create({ quote: quote.id, author: authorB, value: 1 });

    const before = await env.pb
      .collection("votes")
      .getFullList({ filter: `quote = "${quote.id}"` });
    expect(before.length).toBe(2); // author auto-vote + bob

    await env.pb.collection("quotes").delete(quote.id);

    const after = await env.pb
      .collection("votes")
      .getFullList({ filter: `quote = "${quote.id}"` });
    expect(after).toHaveLength(0);

    await expect(getQuote(quote.id)).rejects.toMatchObject({ status: 404 });
  });
});

describe("email domain validation hook", () => {
  it("rejects users outside ALLOWED_DOMAINS", async () => {
    // A separate instance configured with a domain allowlist.
    const restricted = await startPocketBase({
      ALLOWED_DOMAINS: "example.com",
    });
    try {
      await restricted.pb.collection("users").create({
        email: "ok@example.com",
        password: "password123",
        passwordConfirm: "password123",
      });

      await expect(
        restricted.pb.collection("users").create({
          email: "nope@other.com",
          password: "password123",
          passwordConfirm: "password123",
        }),
      ).rejects.toMatchObject({ status: 400 });
    } finally {
      await restricted.stop();
    }
  });
});
