import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startPocketBase, type TestPocketBase } from "./pb-harness";

let env: TestPocketBase;

// A local endpoint that records generic webhook payloads and answers quickly.
let fastServer: Server;
let fastUrl: string;
const receivedBodies: string[] = [];

// A local endpoint that accepts connections but never responds, simulating a
// hung webhook receiver.
let slowServer: Server;
let slowUrl: string;

function listen(server: Server): Promise<string> {
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      resolve(`http://127.0.0.1:${port}/hook`);
    });
  });
}

beforeAll(async () => {
  env = await startPocketBase();

  fastServer = createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      receivedBodies.push(body);
      res.writeHead(200).end("ok");
    });
  });
  fastUrl = await listen(fastServer);

  slowServer = createServer(() => {
    // Never respond; hold the request open.
  });
  slowUrl = await listen(slowServer);
});

afterAll(async () => {
  slowServer?.closeAllConnections();
  slowServer?.close();
  fastServer?.close();
  await env?.stop();
});

describe("webhook delivery hook", () => {
  it("delivers the generic JSON payload to active webhooks", async () => {
    const webhook = await env.pb
      .collection("webhooks")
      .create({ url: fastUrl, active: true });

    // $http.send is synchronous in the hook, so delivery completes before
    // the create request returns.
    const quote = await env.pb
      .collection("quotes")
      .create({ text: "notified quote", author: "alice@example.com" });

    expect(receivedBodies).toHaveLength(1);
    const payload = JSON.parse(receivedBodies[0]);
    expect(payload.event).toBe("quote.created");
    expect(payload.quote.id).toBe(quote.shortId);

    await env.pb.collection("webhooks").update(webhook.id, { active: false });
  });

  it("skips inactive webhooks", async () => {
    await env.pb
      .collection("quotes")
      .create({ text: "silent quote", author: "alice@example.com" });

    expect(receivedBodies).toHaveLength(1); // unchanged
  });

  it("caps delivery time to a hung endpoint so quote creation stays fast", async () => {
    await env.pb.collection("webhooks").create({ url: slowUrl, active: true });

    const start = Date.now();
    const quote = await env.pb
      .collection("quotes")
      .create({ text: "quote with hung webhook", author: "alice@example.com" });
    const elapsed = Date.now() - start;

    // The quote must still be created, and the hook's $http.send timeout must
    // kick in well before the JSVM default of 120s.
    expect(quote.id).toBeTruthy();
    expect(elapsed).toBeLessThan(10_000);
  });
});
