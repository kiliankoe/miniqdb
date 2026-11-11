import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startPocketBase, type TestPocketBase } from "./pb-harness";

const ALIASES = "Vincent Lindner=Vincent, Peter=Peter B.";

let configured: TestPocketBase;
let unset: TestPocketBase;

beforeAll(async () => {
  [configured, unset] = await Promise.all([
    startPocketBase({ SPEAKER_ALIASES: ALIASES }),
    startPocketBase(),
  ]);
});

afterAll(async () => {
  await Promise.all([configured?.stop(), unset?.stop()]);
});

async function userClient(env: TestPocketBase) {
  const user = await env.pb.collection("users").create({
    email: "guesser@example.com",
    password: "password123",
    passwordConfirm: "password123",
  });
  return env.pb.collection("users").impersonate(user.id, 3600);
}

describe("GET /api/speaker-aliases", () => {
  it("returns the raw SPEAKER_ALIASES value to a logged-in user", async () => {
    const client = await userClient(configured);
    const res = await client.send("/api/speaker-aliases", { method: "GET" });
    expect(res).toEqual({ speakerAliases: ALIASES });
  });

  it("returns an empty string when SPEAKER_ALIASES is unset", async () => {
    const client = await userClient(unset);
    const res = await client.send("/api/speaker-aliases", { method: "GET" });
    expect(res).toEqual({ speakerAliases: "" });
  });

  it.each([
    ["without auth", {}],
    ["with an invalid token", { Authorization: "not-a-valid-token" }],
  ])("rejects a request %s", async (_, headers: Record<string, string>) => {
    const res = await fetch(`${configured.url}/api/speaker-aliases`, {
      headers,
    });
    expect(res.status).toBe(401);
    expect(await res.text()).not.toContain("Vincent");
  });
});
