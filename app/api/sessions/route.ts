import { NextResponse } from "next/server";
import { z } from "zod";
import { createJourneySession, getSession, endSession, sessionToken } from "../../../adapters/session-store";
import { randomUUID } from "node:crypto";
import { extractFacts, interpretInterviewAnswer, isSecurityConcern, replyToUser, llmAvailable, nextQuestion, phraseQuestion, rankQuestions } from "../../../adapters/llm";
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
import { analyzeContent, combine, findUrls, worse } from "../../../adapters/link-scan";

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
  const raw = await request.json().catch(() => null);
  // The encrypted session copy travels beside the event; the event schemas stay strict.
  const isObject = raw !== null && typeof raw === "object" && !Array.isArray(raw);
  const { sessionToken: token, ...rest } = isObject ? (raw as Record<string, unknown>) : {};
  const body = isObject ? rest : raw;
  const start = Start.safeParse(body);
  if (start.success) {
    const { audience, message, incident } = start.data;
    const language = start.data.language === "auto" ? detectLanguage(message, start.data.fallbackLanguage ?? "fi") : start.data.language;
    try {
      const llm = llmAvailable();
      const scenario = start.data.demoScenario ?? inferDemoScenario(`${message}\n${incident ?? ""}`);
      const demo = demoSignalsFor(scenario);
      // Links in what the user received are opened and checked before the rules run.
      const analysis = await analyzeContent(incident ?? "", message, language).catch(() => null);
      const linkVerdict = analysis && analysis.links.length ? (demo.visible.linkVerdict ? worse(demo.visible.linkVerdict, analysis.verdict) : analysis.verdict) : demo.visible.linkVerdict;
      const hasLink = demo.visible.hasLink || Boolean(analysis?.links.length) || /https?:\/\/|www\./iu.test(incident ?? "");
      const { journey, response: first } = await handleEvent("pending", null, { kind: "start", sentToLlm: llm, extractor: llm ? extractFacts : undefined, demoScenario: scenario, input: { audience, language, openingMessage: message, incidentContent: incident ?? null, incidentChannel: null, signals: { ...demo.visible, hasLink, linkVerdict }, consent: { requires: [...new Set([...demo.gated, ...(start.data.demoSignals ?? [])])], preGranted: [] } } });
      if (journey && analysis) {
        journey.analysis = analysis;
        if (journey.input) journey.input = { ...journey.input, signals: { ...journey.input.signals, hasLink, linkVerdict } };
      }
      if (journey) await keepRealReport(journey, message);
      const response = journey ? present("pending", journey) : first;
      const sessionId = createJourneySession(journey as Journey);
      const answered = await respond(sessionId, journey, response, incident?.trim() ? `${message}\n${incident}` : message);
      return NextResponse.json({ ...answered, sessionId, sessionToken: sessionToken(sessionId) });
    } catch {
      return NextResponse.json({ error: "analysis_failed" }, { status: 503 });
    }
  }
  const event = z.union([Answer, AnswerText, AddDetails, AiAnswer, Continue, Consent, Rescue, Handoff, Talk]).safeParse(body);
  if (event.success) {
    const session = getSession(event.data.sessionId, token);
    if (!session?.journey) return NextResponse.json({ error: "session_expired" }, { status: 404 });
    try {
      const { sessionId, ...payload } = event.data;
      const llm = llmAvailable();
      const next = payload.kind === "answer_text" || payload.kind === "add_details" || payload.kind === "ai_answer" || payload.kind === "continue" ? { ...payload, extractor: llm ? extractFacts : undefined, sentToLlm: llm } : payload;
      const { journey, response } = await handleEvent(sessionId, session.journey, next);
      // A link shared later in the chat is checked the same way.
      const typed = "text" in payload ? payload.text ?? "" : "";
      if (journey && typed && findUrls(typed).some((url) => !journey.analysis?.links.some((link) => link.url === url))) {
        const found = await analyzeContent("", typed, journey.item.language).catch(() => null);
        if (found?.links.length) {
          const links = [...(journey.analysis?.links ?? []), ...found.links.filter((link) => !journey.analysis?.links.some((known) => known.url === link.url))];
          journey.analysis = combine(links, journey.analysis?.message ?? []);
          const verdict = journey.analysis.verdict;
          const signals = { ...journey.item.signals, hasLink: true, linkVerdict: journey.item.signals.linkVerdict ? worse(journey.item.signals.linkVerdict, verdict) : verdict };
          journey.item = { ...journey.item, signals };
          if (journey.input) journey.input = { ...journey.input, signals };
        }
      }
      if (journey && payload.kind === "ai_answer" && !session.journey.pendingAsk?.topic && llm && (payload.answer === "yes" || payload.answer === "no")) {
        const last = journey.interview?.at(-1);
        if (last) {
          const interpreted = await interpretInterviewAnswer(last.question, last.answer, journey.item.language);
          if (interpreted && interpreted.answer === payload.answer) journey.item = { ...journey.item, answers: { ...journey.item.answers, [interpreted.topic]: interpreted.answer } };
        }
      }
      if (journey && (payload.kind === "add_details" || payload.kind === "ai_answer") && typed) await keepRealReport(journey, journey.input?.openingMessage ?? typed);
      session.journey = journey;
      const said = "text" in payload && payload.text ? payload.text : payload.kind === "answer" ? ({ yes: "Yes", no: "No", unsure: "Not sure" } as const)[payload.answer] : payload.kind === "ai_answer" && payload.answer ? ({ yes: "Yes", no: "No", unsure: "Not sure" } as const)[payload.answer] : null;
      const answered = await respond(sessionId, journey, journey ? present(sessionId, journey) : response, said);
      return NextResponse.json({ ...answered, sessionToken: sessionToken(sessionId) });
    } catch {
      return NextResponse.json({ error: "invalid_event" }, { status: 409 });
    }
  }
  const end = End.safeParse(body);
  if (end.success) {
    const session = getSession(end.data.sessionId, token);
    if (!session?.journey) return NextResponse.json({ error: "session_expired" }, { status: 404 });
    const { response } = await handleEvent(end.data.sessionId, session.journey, { kind: "end" });
    endSession(end.data.sessionId);
    return NextResponse.json(response);
  }
  return NextResponse.json({ error: "invalid_input" }, { status: 400 });
}

async function respond(sessionId: string, journey: Journey | null, response: ApiResponse, said: string | null = null): Promise<ApiResponse> {
  const asked = await interview(sessionId, journey, response);
  // An AI question needs no ranking or rewording, which keeps each turn to two LLM calls.
  const final = asked.screen.type === "ask" ? asked : await personalise(journey, await rankTriage(sessionId, journey, asked));
  return { ...final, chat: await converse(journey, final, said) };
}

// The model's own reply to what the user just said, so the chat reads like a conversation.
// It only explains the rules' decision; the screens below it still carry the actions.
async function converse(journey: Journey | null, response: ApiResponse, said: string | null): Promise<string | null> {
  if (!journey || !said?.trim() || !llmAvailable()) return null;
  const { screen, state } = response;
  if (screen.type === "fallback" || screen.type === "end" || screen.type === "describe") return null;
  const masked = guardInput(said).userText;
  const decision = assess(journey.item, journey.asked);
  const nextQuestion = screen.type === "flip" ? screen.question : screen.type === "ask" ? screen.question : null;
  const chat = await replyToUser({
    language: journey.item.language,
    said: masked,
    history: journey.chatLog ?? [],
    status: state.status,
    statusLabel: state.statusLabel ?? state.status,
    likelyType: state.likelyType ?? null,
    steps: decision.composed.steps,
    reason: screen.type === "result" ? screen.reason : null,
    nextQuestion,
  });
  journey.chatLog = [...(journey.chatLog ?? []), `User: ${masked}`, ...(chat ? [`SafeStep: ${chat}`] : [])].slice(-12);
  return chat;
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
    // Gemini writes the first question from the user's own words. The fixed question is only a
    // fallback for when the model fails, so a vague report still gets a sensible next step.
    const opening = guardInput(journey.input.openingMessage, journey.input.incidentContent);
    const asked = await nextQuestion({ story: [opening.userText, opening.maskedIncident].filter(Boolean).join("\n"), asked: [], language: journey.item.language, audience: journey.item.audience, facts: journey.item.facts, answers: journey.item.answers, unsure: journey.item.unsure, unknowns: [], summaryGaps: ["what happened", "what was requested", "what the person did"] }).catch(() => null);
    if (asked && asked !== "done") {
      journey.pendingAsk = { id: randomUUID().slice(0, 8), question: asked.question, topic: asked.topic, open: asked.open };
      return present(sessionId, journey);
    }
    const question = (openingQuestion(`${journey.input.openingMessage}\n${journey.input.incidentContent ?? ""}`, journey.item.language) ?? {
      en: "What happened that made you concerned, without including codes or passwords?",
      fi: "Mitä tapahtui ja mikä huolestutti sinua ilman koodeja tai salasanoja?",
      sv: "Vad hände som gjorde dig orolig, utan att skriva koder eller lösenord?",
    })[journey.item.language];
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
  // A fact the user already settled in their own words ("Can I pay?" = not paid yet) is not a gap.
  const settled = Object.keys(journey.item.answers).length > 0;
  const summaryGaps = [
    !journey.item.facts.incidentType && "what happened",
    journey.item.facts.asksFor.length === 0 && journey.item.facts.asksNothing !== true && "what was requested",
    journey.item.facts.userAlreadyDid.length === 0 && !settled && "what the person did",
    journey.item.facts.happeningNow === null && !settled && response.state.status === "threat_in_progress" && "whether the threat is still happening",
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
  const journey = getSession(sessionId, request.headers.get("x-session-token"))?.journey;
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

// The keyword reader can miss a real report worded in an unusual way, such as "my wallet got
// drained". Before turning it away as off topic, Gemini checks whether it is a safety problem.
async function keepRealReport(journey: Journey, text: string) {
  if (journey.awaitingDetails !== "off_topic" || !llmAvailable()) return;
  if (await isSecurityConcern(text)) journey.awaitingDetails = undefined;
}

// The demo has no scenario picker, so the simulated DNA data that fits the report is chosen
// from its words. Every signal stays synthetic and is still only read after consent.
function inferDemoScenario(text: string): (typeof DEMO_SCENARIOS)[number] {
  const t = text.toLowerCase();
  if (/(operator|operaattori|operatör|dna|elisa|telia).{0,80}(code|koodi|kod)|(code|koodi|kod).{0,80}(operator|operaattori|operatör)/u.test(t)) return "sim_change";
  if (/e-?sim|\bsim\b|no signal|lost (signal|service|coverage)|number (transfer|port)|ei kenttää|kenttä|numeron siirto|täckning|nummerflytt/u.test(t)) return "sim_change";
  if (/(former|ex-?)\s?(employee|staff)|entinen työntekijä|tidigare anställd/u.test(t)) return "business_access";
  if (/(installed|asensin|installerade|downloaded|latasin).{0,40}(app|sovellu|program)|remote access|etäyhteys|fjärr/u.test(t)) return "device_issue";
  if (/(log ?in|sign-?in|kirjautu|inlogg).{0,40}(unknown|unfamiliar|abroad|spain|tuntemat|ulkomail|espanja|okänd|utlandet)|(unknown|unfamiliar|tuntemat|okänd).{0,30}(log ?in|kirjautu|inlogg)/u.test(t)) return "unknown_login";
  return "none";
}

// Without a model, the first question still fits what the user said. Each one asks for the
// detail that decides the advice, never for codes or passwords.
const OPENING: { pattern: RegExp; question: Record<Language, string> }[] = [
  { pattern: /\b(won|win|winner|prize|lottery|giveaway|reward|inheritance)\b|voit|palkin|arvonta|perintö|vann|vinst|lotteri|\barv\b/iu, question: { en: "Did they ask you to pay a fee, click a link or share your details to claim it?", fi: "Pyydettiinkö sinua maksamaan maksu, avaamaan linkki tai antamaan tietojasi palkinnon saamiseksi?", sv: "Bad de dig betala en avgift, öppna en länk eller lämna uppgifter för att få vinsten?" } },
  { pattern: /seed|recovery phrase|private key|wallet|crypto|bitcoin|siemenlause|lompako|krypto|seedfras|plånbok/iu, question: { en: "Has anyone asked for your seed phrase or private key, or has crypto already left your wallet?", fi: "Onko joku pyytänyt siemenlausettasi tai yksityistä avaintasi, vai onko kryptoa jo siirtynyt lompakostasi?", sv: "Har någon bett om din seedfras eller privata nyckel, eller har krypto redan lämnat din plånbok?" } },
  { pattern: /account|log ?in|password|hacked|tili|kirjautu|salasan|hakkeroi|konto|inlogg|lösenord|hackad/iu, question: { en: "What happened with your account: a login you don't recognise, a password change, or are you locked out?", fi: "Mitä tilillesi tapahtui: tuntematon kirjautuminen, salasanan vaihto vai pääsetkö sisään ollenkaan?", sv: "Vad hände med ditt konto: en inloggning du inte känner igen, ett byte av lösenord, eller är du utelåst?" } },
  { pattern: /call|called|phone|soitt|puhelu|ringde|samtal/iu, question: { en: "Who did the caller say they were, and what did they ask you to do?", fi: "Kuka soittaja sanoi olevansa, ja mitä hän pyysi sinua tekemään?", sv: "Vem sa uppringaren att de var, och vad bad de dig göra?" } },
  { pattern: /pay|paid|money|transfer|invoice|maks|raha|siirs|lasku|betal|pengar|faktura/iu, question: { en: "Has any money already been sent, or are you being asked to pay?", fi: "Onko rahaa jo lähetetty, vai pyydetäänkö sinua maksamaan?", sv: "Har pengar redan skickats, eller blir du ombedd att betala?" } },
  { pattern: /link|clicked|email|text|sms|message|linkki|klikkas|sähköpost|viesti|länk|klickade|mejl|meddelande/iu, question: { en: "What did the message ask you to do, and did you click or reply to it?", fi: "Mitä viestissä pyydettiin tekemään, ja klikkasitko tai vastasitko siihen?", sv: "Vad bad meddelandet dig göra, och klickade eller svarade du?" } },
];

function openingQuestion(text: string, language: Language): Record<Language, string> | null {
  return OPENING.find((entry) => entry.pattern.test(text))?.question ?? null;
}
