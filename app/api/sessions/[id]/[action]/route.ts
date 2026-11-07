import { NextResponse } from "next/server";
import { POST as postSession } from "../../route";

const actions = { answers: "answer", consent: "consent", rescue: "rescue", handoff: "handoff", continue: "continue", talk: "talk_to_person" } as const;

export async function POST(request: Request, context: { params: Promise<{ id: string; action: string }> }) {
  const { id, action } = await context.params;
  const kind = actions[action as keyof typeof actions];
  if (!kind) return NextResponse.json({ error: "unknown_route" }, { status: 404 });
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  return postSession(new Request(request.url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...body, kind, sessionId: id }),
  }));
}
