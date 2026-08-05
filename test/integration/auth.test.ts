import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startPocketBase, type TestPocketBase } from "./pb-harness";

let env: TestPocketBase;

beforeAll(async () => {
  env = await startPocketBase();
});

afterAll(async () => {
  await env?.stop();
});

describe("auth token duration", () => {
  it("issues 180-day auth tokens instead of the 14-day default", async () => {
    const users = await env.pb.collections.getOne("users");
    expect(users.authToken?.duration).toBe(15552000);
  });
});

describe("impersonation token submission", () => {
  const email = "scripter@example.com";

  it("lets an impersonated user create quotes as themselves", async () => {
    const user = await env.pb.collection("users").create({
      email,
      password: "password123",
      passwordConfirm: "password123",
    });

    // Same flow as scripts/mint-token.ts: superuser mints a token, the
    // token holder submits through the regular record API rules.
    const impersonated = await env.pb
      .collection("users")
      .impersonate(user.id, 3600);

    const quote = await impersonated
      .collection("quotes")
      .create({ text: "scripted quote", author: email });
    expect(quote.shortId).toBeGreaterThan(0);

    // Create hooks (auto-vote + score denorm) fired as usual.
    const fresh = await env.pb.collection("quotes").getOne(quote.id);
    expect(fresh.score).toBe(1);
  });

  it("rejects quotes attributed to someone else", async () => {
    const user = await env.pb
      .collection("users")
      .getFirstListItem(`email = "${email}"`);
    const impersonated = await env.pb
      .collection("users")
      .impersonate(user.id, 3600);

    await expect(
      impersonated
        .collection("quotes")
        .create({ text: "forged quote", author: "someone-else@example.com" }),
    ).rejects.toMatchObject({ status: 400 });
  });
});
