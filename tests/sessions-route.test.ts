import { describe, expect, it } from "vitest";
import { GET, POST } from "../app/api/sessions/route";
import { POST as postAction } from "../app/api/sessions/[id]/[action]/route";
import { DELETE as deleteSession } from "../app/api/sessions/[id]/route";
import { GET as getHandoffSummary } from "../app/api/sessions/[id]/handoff-summary/route";

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

  it("supports path-based events and deletion", async () => {
    const started = await (await POST(request({ kind: "start", audience: "consumer", language: "en", message: "help" }))).json();
    const id = started.sessionId;
    const invalid = await postAction(request({ answer: "yes", topic: "card_details_entered" }), { params: Promise.resolve({ id, action: "answers" }) });
    expect(invalid.status).toBe(409);
    const ended = await deleteSession(new Request(`http://localhost/api/sessions/${id}`), { params: Promise.resolve({ id }) });
    expect((await ended.json()).screen.type).toBe("end");
  });

  it("withholds simulated agent view until handoff approval", async () => {
    const started = await (await POST(request({ kind: "start", audience: "consumer", language: "en", message: "Someone asked for my WhatsApp code and I gave the code to them." }))).json();
    const url = `http://localhost/api/sessions?sessionId=${started.sessionId}`;
    const summary = () => getHandoffSummary(new Request("http://localhost/api/handoff-summary"), { params: Promise.resolve({ id: started.sessionId }) });
    expect((await GET(new Request(url))).status).toBe(403);
    expect((await summary()).status).toBe(403);
    let response = started;
    while (response.screen.type === "rescue") {
      response = await (await POST(request({ kind: "rescue", sessionId: started.sessionId, stepId: response.screen.step.id, outcome: "done" }))).json();
    }
    expect(response.screen.type).toBe("handoff");
    response = await (await POST(request({ kind: "handoff", sessionId: started.sessionId, approved: true }))).json();
    expect((await GET(new Request(url))).status).toBe(200);
    const handoff = await summary();
    expect(handoff.status).toBe(200);
    expect(handoff.headers.get("cache-control")).toBe("no-store");
    expect(await handoff.json()).toMatchObject({ simulated: true, summary: expect.any(Array), details: expect.any(Object) });
    await POST(request({ kind: "end", sessionId: started.sessionId }));
    expect((await summary()).status).toBe(404);
  });
});
