import { NextResponse } from "next/server";
import { z } from "zod";
import approved from "@/content/approved-text.json";
import { extractFacts, llmAvailable } from "@/adapters/llm";
import { createSession, endSession, getSession } from "@/adapters/session-store";
import { assess, intake, type Assessment } from "@/engine/assess";
import { questionText, reasonText } from "@/engine/composer";
import { confidenceBand } from "@/engine/confidence";
import { fallbackScreen, stopScreen } from "@/engine/fallback";
import type { Case } from "@/engine/case";
import { Audience, Language, Topic } from "@/engine/types";

// Temporary Stage 2 preview API. It drives the real engine; Stage 3 replaces it with
// the session routes in ARCHITECTURE.md.
const MAX_TEXT = 10_000;

const Start = z.strictObject({
  audience: Audience,
  language: Language,
  message: z.string().trim().min(1).max(MAX_TEXT),
  incident: z.string().max(MAX_TEXT).optional(),
});
const Reply = z.strictObject({
  sessionId: z.string().uuid(),
  topic: Topic,
  answer: z.enum(["yes", "no", "unsure"]),
});

function present(sessionId: string, item: Case, result: Assessment, extractedBy: string, secretFound: boolean) {
  const { language } = item;
  const { decision, outcome, composed, flip } = result;
  return {
    sessionId,
    extractedBy,
    notice: approved.prototypeNotice[language],
    secretWarning: secretFound ? approved.secretWarning[language] : null,
    stop: result.interruption ? stopScreen(result.interruption, language) : null,
    flip: flip ? { topic: flip.topic, ...questionText(flip.topic, language) } : null,
    result: {
      status: decision.status,
      statusLabel: approved.statusLabels[decision.status][language],
      risk: decision.risk,
      urgency: decision.urgency,
      action: decision.primaryAction,
      advice: composed.adviceText,
      steps: composed.steps,
      branches: composed.branches,
      reason: reasonText(outcome, language),
      confidence: approved.confidence[confidenceBand(result.confidence)][language],
      unknowns: result.unknownTopics,
      destination: decision.destination,
      externalContacts: decision.externalContacts,
      sources: outcome.guidance,
      confirmedFacts: result.confirmedFacts,
    },
  };
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  const reply = Reply.safeParse(body);
  if (reply.success) {
    const { sessionId, topic, answer } = reply.data;
    const session = getSession(sessionId);
    if (!session) return NextResponse.json({ error: "session_expired" }, { status: 404 });
    session.item =
      answer === "unsure"
        ? { ...session.item, unsure: [...session.item.unsure, topic] }
        : { ...session.item, answers: { ...session.item.answers, [topic]: answer } };
    session.asked += 1;
    const result = assess(session.item, session.asked);
    return NextResponse.json(present(sessionId, session.item, result, session.extractedBy, session.secretFound));
  }

  const start = Start.safeParse(body);
  if (!start.success) return NextResponse.json({ error: "invalid_input" }, { status: 400 });

  const { audience, language, message, incident } = start.data;
  const useLlm = llmAvailable();
  try {
    const { item, secretsFound, extractedBy } = await intake(
      {
        audience,
        language,
        openingMessage: message,
        incidentContent: incident?.trim() ? incident : null,
        incidentChannel: null,
        signals: { hasLink: /https?:\/\/|www\./iu.test(incident ?? ""), linkVerdict: null, callWarning: null, callerSpoofed: false },
        consent: { requires: [], preGranted: [] },
      },
      useLlm ? extractFacts : undefined,
    );
    const label = useLlm && extractedBy === "primary" ? "llm" : "offline";
    const secretFound = secretsFound.length > 0;
    const sessionId = createSession({ item, asked: 0, extractedBy: label, secretFound });
    return NextResponse.json(present(sessionId, item, assess(item), label, secretFound));
  } catch {
    return NextResponse.json({ fallback: fallbackScreen("service_unavailable", language) });
  }
}

export async function DELETE(request: Request) {
  const id = new URL(request.url).searchParams.get("sessionId");
  if (id) endSession(id);
  return new NextResponse(null, { status: 204 });
}
