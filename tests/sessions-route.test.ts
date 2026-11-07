import { describe, expect, it } from "vitest";
import { POST } from "../app/api/sessions/route";

const request = (body: unknown) => new Request("http://localhost/api/sessions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

describe("sessions API", () => {
  it("starts and ends a session", async () => {
    const start = await POST(request({ kind: "start", audience: "consumer", language: "en", message: "help" }));
    expect(start.status).toBe(200);
    const result = await start.json();
    expect(result.sessionId).toMatch(/^[0-9a-f-]{36}$/);
    const end = await POST(request({ kind: "end", sessionId: result.sessionId }));
    expect((await end.json()).screen.type).toBe("end");
    const expired = await POST(request({ kind: "end", sessionId: result.sessionId }));
    expect(expired.status).toBe(404);
  });

  it("rejects invalid and out-of-order events", async () => {
    expect((await POST(request({ kind: "start", audience: "consumer", language: "en", message: "" }))).status).toBe(400);
    const started = await (await POST(request({ kind: "start", audience: "consumer", language: "en", message: "help" }))).json();
    expect((await POST(request({ kind: "rescue", sessionId: started.sessionId, stepId: "0", outcome: "done" }))).status).toBe(409);
  });
});
