import { NextResponse } from "next/server";
import { z } from "zod";
import { addAgentMessage, addCustomerMessage, customerView, listCases, setCaseStatus } from "../../../adapters/handoff-queue";
import { guardInput } from "../../../engine/input-guard";

// Simulated DNA support desk. The agent side has no login because this is a prototype with
// synthetic data; in production it sits behind DNA's staff sign-in. The customer side needs
// the case token issued at approval, and only ever sees its own chat, never the case content.

const CaseId = z.string().regex(/^SS-\d+$/);

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const caseId = params.get("caseId");
  if (caseId) {
    const view = customerView(caseId, params.get("token") ?? "");
    return view ? NextResponse.json(view) : NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ simulated: true, cases: listCases() });
}

const Update = z.strictObject({ caseId: CaseId, caseStatus: z.enum(["new", "accepted", "resolved"]), agentName: z.string().trim().max(40).optional() });

export async function PATCH(request: Request) {
  const body = Update.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  const item = setCaseStatus(body.data.caseId, body.data.caseStatus, body.data.agentName);
  return item ? NextResponse.json(item) : NextResponse.json({ error: "not_found" }, { status: 404 });
}

const AgentMessage = z.strictObject({ from: z.literal("agent"), caseId: CaseId, text: z.string().trim().min(1).max(2000) });
const CustomerMessage = z.strictObject({ from: z.literal("customer"), caseId: CaseId, token: z.string().uuid(), text: z.string().trim().min(1).max(2000) });

export async function POST(request: Request) {
  const body = z.union([AgentMessage, CustomerMessage]).safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  if (body.data.from === "agent") {
    const item = addAgentMessage(body.data.caseId, body.data.text);
    return item ? NextResponse.json(item) : NextResponse.json({ error: "not_accepted" }, { status: 409 });
  }
  // Codes, passwords and card numbers are masked before the agent can see them.
  const guarded = guardInput(body.data.text);
  const view = addCustomerMessage(body.data.caseId, body.data.token, guarded.userText, guarded.userText !== body.data.text);
  return view ? NextResponse.json(view) : NextResponse.json({ error: "not_found" }, { status: 404 });
}
