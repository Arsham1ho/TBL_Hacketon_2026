import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { GET, POST } from "../app/api/sessions/route";
import { createClient } from "../lib/client";

// On a serverless host each request can reach a different instance with empty memory.
// These tests wipe the in-memory store between requests to simulate that.
const memory = () => (globalThis as typeof globalThis & { safestepSessions?: Map<string, unknown> }).safestepSessions!;
const newInstance = () => memory().clear();
const request = (body: unknown) => new Request("http://localhost/api/sessions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
const start = async () => (await POST(request({ kind: "start", audience: "consumer", language: "en", message: "help" }))).json();

describe("sessions survive a new server instance", () => {
  const previous = process.env.SESSION_SECRET;
  beforeAll(() => {
    process.env.SESSION_SECRET = "test-secret-at-least-16-chars";
  });
  afterAll(() => {
    if (previous === undefined) delete process.env.SESSION_SECRET;
    else process.env.SESSION_SECRET = previous;
  });

  it("continues from the encrypted token when memory is empty", async () => {
    const started = await start();
    expect(typeof started.sessionToken).toBe("string");
    newInstance();
    const ended = await POST(request({ kind: "end", sessionId: started.sessionId, sessionToken: started.sessionToken }));
    expect(ended.status).toBe(200);
    expect((await ended.json()).screen.type).toBe("end");
  });

  it("still fails without a token, as before", async () => {
    const started = await start();
    newInstance();
    expect((await POST(request({ kind: "end", sessionId: started.sessionId }))).status).toBe(404);
  });

  it("rejects a changed token and a token from another session", async () => {
    const first = await start();
    const second = await start();
    newInstance();
    const tampered = first.sessionToken.slice(0, -4) + (first.sessionToken.endsWith("AAAA") ? "BBBB" : "AAAA");
    expect((await POST(request({ kind: "end", sessionId: first.sessionId, sessionToken: tampered }))).status).toBe(404);
    expect((await POST(request({ kind: "end", sessionId: first.sessionId, sessionToken: second.sessionToken }))).status).toBe(404);
  });

  it("restores the session for the report view from the header", async () => {
    const started = await start();
    newInstance();
    const report = await GET(new Request(`http://localhost/api/sessions?sessionId=${started.sessionId}&view=report`, { headers: { "x-session-token": started.sessionToken } }));
    expect(report.status).toBe(200);
  });

  it("the client keeps the token out of responses and sends it back", async () => {
    const fetcher = async (input: RequestInfo | URL, init?: RequestInit) => {
      newInstance();
      const req = new Request(typeof input === "string" && input.startsWith("/") ? `http://localhost${input}` : input, init);
      return req.method === "GET" ? GET(req) : POST(req);
    };
    const client = createClient(fetcher as typeof fetch);
    const first = await client.send({ kind: "start", audience: "consumer", language: "en", message: "help" } as never);
    expect("sessionToken" in first).toBe(false);
    expect(await client.report()).not.toBeNull();
    expect((await client.end())?.screen.type).toBe("end");
  });
});
