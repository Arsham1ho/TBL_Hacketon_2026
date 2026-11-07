import { NextResponse } from "next/server";
import { z } from "zod";
import { createJourneySession, getSession, endSession } from "../../../adapters/session-store";
import { randomUUID } from "node:crypto";
import { extractFacts, interpretInterviewAnswer, llmAvailable, nextQuestion, phraseQuestion, rankQuestions } from "../../../adapters/llm";
import { questionText } from "../../../engine/composer";
import { isTriage, pickFlip } from "../../../engine/question-picker";
import { UNCLEAR } from "../../../engine/situations";
import type { Topic as TopicId } from "../../../engine/types";
import { guardInput } from "../../../engine/input-guard";
import type { ApiResponse } from "../../../engine/screens";
import { buildReport } from "../../../engine/report";
import { handleEvent, handoffDetails, handoffSummary, journeyDestination, present, type Journey } from "../../../engine/handle-event";
import { detectLanguage } from "../../../engine/language";
import { Audience, GatedSignal, Language, Topic } from "../../../engine/types";
import { DEMO_SCENARIOS, demoSignalsFor } from "../../../adapters/signals";
import { handoffPreview } from "../../../adapters/handoff";
import { assess } from "../../../engine/assess";

const Start = z.strictObject({ kind: z.literal("start"), audience: Audience, language: z.union([Language, z.literal("auto")]), fallbackLanguage: Language.optional(), message: z.string().trim().min(1).max(10000), incident: z.string().max(10000).optional(), demoSignals: z.array(GatedSignal).max(7).optional(), demoScenario: z.enum(DEMO_SCENARIOS).optional() });
const Answer = z.strictObject({ kind: z.literal("answer"), sessionId: z.string().uuid(), topic: Topic, answer: z.enum(["yes", "no", "unsure"]) });
const AnswerText = z.strictObject({ kind: z.literal("answer_text"), sessionId: z.string().uuid(), topic: Topic, text: z.string().trim().min(1).max(2000) });
const AddDetails = z.strictObject({ kind: z.literal("add_details"), sessionId: z.string().uuid(), text: z.string().trim().min(1).max(2000) });
const AiAnswer = z.strictObject({ kind: z.literal("ai_answer"), sessionId: z.string().uuid(), id: z.string().max(40), answer: z.enum(["yes", "no", "unsure"]).optional(), text: z.string().trim().min(1).max(2000).optional() });
const End = z.strictObject({ kind: z.literal("end"), sessionId: z.string().uuid() });
const Continue = z.strictObject({ kind: z.literal("continue"), sessionId: z.string().uuid() });
const Consent = z.strictObject({ kind: z.literal("consent"), sessionId: z.string().uuid(), signal: GatedSignal, granted: z.boolean() });
const Rescue = z.strictObject({ kind: z.literal("rescue"), sessionId: z.string().uuid(), stepId: z.string(), outcome: z.enum(["done", "not_possible"]) });
const Route = z.enum(["bank", "police", "operator_support_agent", "security_specialist", "business_security_support", "human_advisor"]);
const Talk = z.strictObject({ kind: z.literal("talk_to_person"), sessionId: z.string().uuid(), route: Route.optional() });
const Handoff = z.strictObject({ kind: z.literal("handoff"), sessionId: z.string().uuid(), approved: z.boolean() });

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const start = Start.safeParse(body);
  if (start.success) {
    const { audience, message, incident } = start.data;
    const language = start.data.language === "auto" ? detectLanguage(message, start.data.fallbackLanguage ?? "fi") : start.data.language;
    try {
      const llm = llmAvailable();
      const demo = demoSignalsFor(start.data.demoScenario ?? "none");
      const { journey, response } = await handleEvent("pending", null, { kind: "start", sentToLlm: llm, extractor: llm ? extractFacts : undefined, demoScenario: start.data.demoScenario ?? "none", input: { audience, language, openingMessage: message, incidentContent: incident ?? null, incidentChannel: null, signals: { ...demo.visible, hasLink: demo.visible.hasLink || /https?:\/\/|www\./iu.test(incident ?? "") }, consent: { requires: [...new Set([...demo.gated, ...(start.data.demoSignals ?? [])])], preGranted: [] } } });
      const sessionId = createJourneySession(journey as Journey);
      return NextResponse.json({ ...(await respond(sessionId, journey, response)), sessionId });
    } catch {
      return NextResponse.json({ error: "analysis_failed" }, { status: 503 });
    }
  }
  const event = z.union([Answer, AnswerText, AddDetails, AiAnswer, Continue, Consent, Rescue, Handoff, Talk]).safeParse(body);
  if (event.success) {
    const session = getSession(event.data.sessionId);
    if (!session?.journey) return NextResponse.json({ error: "session_expired" }, { status: 404 });
    try {
      const { sessionId, ...payload } = event.data;
      const llm = llmAvailable();
      const next = payload.kind === "answer_text" || payload.kind === "add_details" || payload.kind === "ai_answer" || payload.kind === "continue" ? { ...payload, extractor: llm ? extractFacts : undefined, sentToLlm: llm } : payload;
      const { journey, response } = await handleEvent(sessionId, session.journey, next);
      if (journey && payload.kind === "ai_answer" && !session.journey.pendingAsk?.topic && llm && (payload.answer === "yes" || payload.answer === "no")) {
        const last = journey.interview?.at(-1);
        if (last) {
          const interpreted = await interpretInterviewAnswer(last.question, last.answer, journey.item.language);
          if (interpreted && interpreted.answer === payload.answer) journey.item = { ...journey.item, answers: { ...journey.item.answers, [interpreted.topic]: interpreted.answer } };
        }
      }
      session.journey = journey;
      return NextResponse.json(await respond(sessionId, journey, journey ? present(sessionId, journey) : response));
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

async function respond(sessionId: string, journey: Journey | null, response: ApiResponse): Promise<ApiResponse> {
  const asked = await interview(sessionId, journey, response);
  // An AI question needs no ranking or rewording, which keeps each turn to two LLM calls.
  if (asked.screen.type === "ask") return asked;
  return personalise(journey, await rankTriage(sessionId, journey, asked));
}

// While the report is unclear, the LLM writes the next question from the story and the
// answers so far. Once the rules recognise the situation, their own decisive questions take over.
async function interview(sessionId: string, journey: Journey | null, response: ApiResponse): Promise<ApiResponse> {
  // No fixed number of questions: the AI keeps asking until it has a clear picture and
  // returns no question. A repeated question or a failed LLM call also ends the interview.
  if (!journey?.input || !llmAvailable() || journey.interviewDone) return response;
  // Complex incidents may need several facts before the advice is specific.
  // Rule-driven decisive questions still have room in this shared budget.
  const questionsAnswered = (journey.flipHistory?.length ?? 0) + (journey.interview?.length ?? 0) + Number(Boolean(journey.linkContextAsked));
  if (questionsAnswered >= 5) return response;
  // Never delay a stop, rescue, or human handoff. A non-urgent incident can
  // gather missing context before its final explanation is displayed.
  const unclear = response.screen.type === "flip" && isTriage(pickFlip(journey.item));
  const followUp = response.screen.type === "result" && response.state.status !== "safe"
    && response.state.urgency !== "immediate" && (response.state.status === "needs_verification" || response.state.status === "threat_in_progress");
  if (!unclear && !followUp) return response;
  const lacksIncidentStory = !journey.item.facts.incidentType || journey.item.facts.incidentType === "other"
    || (journey.item.facts.asksFor.length === 0 && journey.item.facts.userAlreadyDid.length === 0
      && journey.item.facts.evidence.length <= 2);
  if (unclear && lacksIncidentStory && !journey.interview?.length && !journey.flipHistory?.length) {
    const question = {
      en: "What happened that made you concerned, without including codes or passwords?",
      fi: "Mitä tapahtui ja mikä huolestutti sinua ilman koodeja tai salasanoja?",
      sv: "Vad hände som gjorde dig orolig, utan att skriva koder eller lösenord?",
    }[journey.item.language];
    journey.pendingAsk = { id: randomUUID().slice(0, 8), question, open: true };
    return present(sessionId, journey);
  }
  const masked = guardInput(journey.input.openingMessage, journey.input.incidentContent);
  const story = [masked.userText, masked.maskedIncident].filter(Boolean).join("\n");
  const assessment = assess(journey.item, journey.asked);
  // Mask every piece of context, including old answers and extracted evidence.
  const mask = (value: string) => guardInput(value).userText;
  const history = [...(journey.flipHistory ?? []), ...(journey.interview ?? [])].map(({ question, answer }) => ({ question: mask(question), answer: mask(answer) }));
  const facts = { ...journey.item.facts, evidence: journey.item.facts.evidence.map(({ fact, quote }) => ({ fact, quote: mask(quote) })) };
  const summaryGaps = [
    !journey.item.facts.incidentType && "what happened",
    journey.item.facts.asksFor.length === 0 && journey.item.facts.asksNothing !== true && "what was requested",
    journey.item.facts.userAlreadyDid.length === 0 && "what the person did",
    journey.item.facts.happeningNow === null && response.state.status === "threat_in_progress" && "whether the threat is still happening",
  ].filter((gap): gap is string => Boolean(gap));
  if (followUp && summaryGaps.length === 0 && assessment.unknownTopics.length === 0) return response;
  const question = await nextQuestion({ story, asked: history, language: journey.item.language, audience: journey.item.audience, facts, answers: journey.item.answers, unsure: journey.item.unsure, unknowns: assessment.unknownTopics, summaryGaps });
  if (question === "done") journey.interviewDone = true;
  if (!question || question === "done") return response;
  journey.pendingAsk = { id: randomUUID().slice(0, 8), question: question.question, topic: question.topic, open: question.open };
  return present(sessionId, journey);
}

// A vague report gets its triage questions ranked by the LLM once, so the first question
// fits the story. Only the order changes: which answers matter is still the rules' call.
async function rankTriage(sessionId: string, journey: Journey | null, response: ApiResponse): Promise<ApiResponse> {
  if (!journey?.input || response.screen.type !== "flip" || journey.item.triagePriority || !llmAvailable()) return response;
  if (!isTriage(pickFlip(journey.item))) return response;
  const masked = guardInput(journey.input.openingMessage, journey.input.incidentContent);
  const story = [masked.userText, masked.maskedIncident].filter(Boolean).join("\n");
  const options = (UNCLEAR.flips ?? []).map((id) => ({ id, question: questionText(id, journey.item.language).question }));
  const order = await rankQuestions(story, options);
  if (!order) return response;
  journey.item = { ...journey.item, triagePriority: order as TopicId[] };
  return present(sessionId, journey);
}

// The rules choose which fact to ask about. The LLM only rewords that question to fit
// the user's story, and the approved wording is used whenever it fails or is doubtful.
async function personalise(journey: Journey | null, response: ApiResponse): Promise<ApiResponse> {
  const { screen } = response;
  if (!journey?.input || screen.type !== "flip" || !llmAvailable()) return response;
  journey.phrased ??= {};
  if (!(screen.topic in journey.phrased)) {
    const masked = guardInput(journey.input.openingMessage, journey.input.incidentContent);
    const story = [masked.userText, masked.maskedIncident].filter(Boolean).join("\n");
    const mask = (value: string) => guardInput(value).userText;
    const history = [...(journey.flipHistory ?? []), ...(journey.interview ?? [])].map(({ question, answer }) => ({ question: mask(question), answer: mask(answer) }));
    journey.phrased[screen.topic] = (await phraseQuestion({ story, question: screen.question, language: journey.item.language, topic: screen.topic, why: screen.why, branches: screen.branches, history })) ?? screen.question;
  }
  return { ...response, screen: { ...screen, question: journey.phrased[screen.topic]! } };
}

// Agent View is available only after explicit approval and remains simulated.
export async function GET(request: Request) {
  const sessionId = new URL(request.url).searchParams.get("sessionId");
  if (!sessionId || !z.string().uuid().safeParse(sessionId).success) return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  const journey = getSession(sessionId)?.journey;
  if (!journey) return NextResponse.json({ error: "session_expired" }, { status: 404 });
  // The user's own decision report. It holds only what this session already has, with
  // secrets masked, so it needs no handoff approval.
  if (new URL(request.url).searchParams.get("view") === "report") return NextResponse.json(buildReport(journey));
  if (!journey.handoffApproved) return NextResponse.json({ error: "approval_required" }, { status: 403 });
  const result = assess(journey.item, journey.asked);
  const destination = journeyDestination(journey);
  if (!destination) return NextResponse.json({ error: "no_handoff" }, { status: 404 });
  return NextResponse.json({ simulated: true, ...handoffPreview(destination, result.confirmedFacts, journey.item.language), route: journey.personRoute ?? destination, summary: handoffSummary(journey, result.confirmedFacts.map(fact => fact.text)), details: handoffDetails(journey, result.confirmedFacts.map(fact => fact.text)) });
}
