import { NextResponse } from "next/server";
import { z } from "zod";
import { createJourneySession, getSession, endSession } from "../../../adapters/session-store";
import { extractFacts, llmAvailable } from "../../../adapters/llm";
import { handleEvent, handoffSummary, journeyDestination, type Journey } from "../../../engine/handle-event";
import { detectLanguage } from "../../../engine/language";
import { Audience, GatedSignal, Language, Topic } from "../../../engine/types";
import { DEMO_SCENARIOS, demoSignalsFor } from "../../../adapters/signals";
import { handoffPreview } from "../../../adapters/handoff";
import { assess } from "../../../engine/assess";

const Start = z.strictObject({ kind: z.literal("start"), audience: Audience, language: z.union([Language, z.literal("auto")]), message: z.string().trim().min(1).max(10000), incident: z.string().max(10000).optional(), demoSignals: z.array(GatedSignal).max(7).optional(), demoScenario: z.enum(DEMO_SCENARIOS).optional() });
const Answer = z.strictObject({ kind: z.literal("answer"), sessionId: z.string().uuid(), topic: Topic, answer: z.enum(["yes", "no", "unsure"]) });
const End = z.strictObject({ kind: z.literal("end"), sessionId: z.string().uuid() });
const Continue = z.strictObject({ kind: z.literal("continue"), sessionId: z.string().uuid() });
const Consent = z.strictObject({ kind: z.literal("consent"), sessionId: z.string().uuid(), signal: GatedSignal, granted: z.boolean() });
const Rescue = z.strictObject({ kind: z.literal("rescue"), sessionId: z.string().uuid(), stepId: z.string(), outcome: z.enum(["done", "not_possible"]) });
const Talk = z.strictObject({ kind: z.literal("talk_to_person"), sessionId: z.string().uuid() });
const Handoff = z.strictObject({ kind: z.literal("handoff"), sessionId: z.string().uuid(), approved: z.boolean() });

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const start = Start.safeParse(body);
  if (start.success) {
    const { audience, message, incident } = start.data;
    const language = start.data.language === "auto" ? detectLanguage(message) : start.data.language;
    try {
      const llm = llmAvailable();
      const demo = demoSignalsFor(start.data.demoScenario ?? "none");
      const { journey, response } = await handleEvent("pending", null, { kind: "start", sentToLlm: llm, extractor: llm ? extractFacts : undefined, demoScenario: start.data.demoScenario ?? "none", input: { audience, language, openingMessage: message, incidentContent: incident ?? null, incidentChannel: null, signals: { ...demo.visible, hasLink: demo.visible.hasLink || /https?:\/\/|www\./iu.test(incident ?? "") }, consent: { requires: [...new Set([...demo.gated, ...(start.data.demoSignals ?? [])])], preGranted: [] } } });
      const sessionId = createJourneySession(journey as Journey);
      return NextResponse.json({ ...response, sessionId });
    } catch {
      return NextResponse.json({ error: "analysis_failed" }, { status: 503 });
    }
  }
  const event = z.union([Answer, Continue, Consent, Rescue, Handoff, Talk]).safeParse(body);
  if (event.success) {
    const session = getSession(event.data.sessionId);
    if (!session?.journey) return NextResponse.json({ error: "session_expired" }, { status: 404 });
    try {
      const { sessionId, ...payload } = event.data;
      const { journey, response } = await handleEvent(sessionId, session.journey, payload);
      session.journey = journey;
      return NextResponse.json(response);
    } catch {
      return NextResponse.json({ error: "invalid_event" }, { status: 409 });
    }
  }
  const end = End.safeParse(body);
  if (end.success) {
    const session = getSession(end.data.sessionId);
    if (!session?.journey) return NextResponse.json({ error: "session_expired" }, { status: 404 });
    const { response } = await handleEvent(end.data.sessionId, session.journey, { kind: "end" });
    endSession(end.data.sessionId);
    return NextResponse.json(response);
  }
  return NextResponse.json({ error: "invalid_input" }, { status: 400 });
}

// Agent View is available only after explicit approval and remains simulated.
export async function GET(request: Request) {
  const sessionId = new URL(request.url).searchParams.get("sessionId");
  if (!sessionId || !z.string().uuid().safeParse(sessionId).success) return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  const journey = getSession(sessionId)?.journey;
  if (!journey) return NextResponse.json({ error: "session_expired" }, { status: 404 });
  if (!journey.handoffApproved) return NextResponse.json({ error: "approval_required" }, { status: 403 });
  const result = assess(journey.item, journey.asked);
  const destination = journeyDestination(journey);
  if (!destination) return NextResponse.json({ error: "no_handoff" }, { status: 404 });
  return NextResponse.json({ simulated: true, ...handoffPreview(destination, result.confirmedFacts, journey.item.language), summary: handoffSummary(journey, result.confirmedFacts.map(fact => fact.text)) });
}
