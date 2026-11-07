import approved from "../content/approved-text.json";
import guidanceTitles from "../content/guidance-titles.json";
import questions from "../content/questions.json";
import { readAnswerOffline } from "./answer-reader";
import { assess, intake, type CaseInput, type Extractor } from "./assess";
import { questionText, reasonText } from "./composer";
import { confidenceBand } from "./confidence";
import { fallbackScreen, stopScreen } from "./fallback";
import { fastDanger } from "./fast-danger";
import { detectMentions, isGreetingOnly, isOffTopic, type Mention } from "./mentions";
import { isTriage } from "./question-picker";
import { matchSituation } from "./situations";
import { incidentCategory, incidentStory, likelyCategory } from "./incident-category";
import { safeScreen } from "./output-guard";
import { readSimulatedSignal, signalLabel, type DemoScenario } from "../adapters/signals";
import { handoffPreview } from "../adapters/handoff";
import { applyAnswer, topicValue, type Case } from "./case";
import { conflictingTopics, mergeFacts, validateFacts } from "./fact-validator";
import { guardInput } from "./input-guard";
import type { InterruptionKind } from "./interruption";
import type { ApiResponse, HandoffDetails, Screen, SupportRoute } from "./screens";
import { linkContextCopy } from "./link-context";
import { radarMatch } from "./scam-radar";
import { contextualQuestion } from "./contextual-question";
import type { Destination, GatedSignal, Language, Topic } from "./types";

export type Journey = { item: Case; asked: number; secretFound: boolean; sentToLlm: boolean; stopSeen: boolean; consent: Partial<Record<GatedSignal, "granted" | "refused">>; used: GatedSignal[]; rescueIndex: number; rescueOutcomes: Record<string, "done" | "not_possible">; handoffDone: boolean; handoffApproved: boolean; demoScenario: DemoScenario; personRequested?: boolean; fastStop?: InterruptionKind | null; personRoute?: SupportRoute | null; input?: CaseInput; phrased?: Partial<Record<Topic, string>>; awaitingDetails?: "greeting" | "off_topic"; noIncident?: boolean; interview?: { question: string; answer: string }[]; flipHistory?: { topic: Topic; question: string; answer: string }[]; pendingAsk?: { id: string; question: string; topic?: Topic; open?: boolean }; interviewDone?: boolean; linkContextAsked?: boolean };
export type Event =
  | { kind: "start"; input: CaseInput; extractor?: Extractor; sentToLlm: boolean; demoScenario?: DemoScenario }
  | { kind: "answer"; topic: Topic; answer: "yes" | "no" | "unsure" }
  | { kind: "answer_text"; topic: Topic; text: string; extractor?: Extractor; sentToLlm?: boolean }
  | { kind: "add_details"; text: string; extractor?: Extractor; sentToLlm?: boolean }
  | { kind: "ai_answer"; id: string; answer?: "yes" | "no" | "unsure"; text?: string; extractor?: Extractor; sentToLlm?: boolean }
  | { kind: "continue"; extractor?: Extractor; sentToLlm?: boolean }
  | { kind: "consent"; signal: GatedSignal; granted: boolean }
  | { kind: "rescue"; stepId: string; outcome: "done" | "not_possible" }
  | { kind: "handoff"; approved: boolean }
  | { kind: "talk_to_person"; route?: SupportRoute }
  | { kind: "end" };

const screenText = {
  en: { signalWhy: "This simulated signal may clarify the incident.", signalLimit: "Used only for this session.", signalRefusal: "You can refuse and still receive advice.", signalUnknown: "The simulated check found nothing conclusive.", omitted: "Codes, passwords and card numbers", ended: "This session has ended and its data has been cleared." },
  fi: { signalWhy: "Tämä simuloitu tieto voi auttaa selvittämään tapahtuneen.", signalLimit: "Käytetään vain tässä istunnossa.", signalRefusal: "Voit kieltäytyä ja silti saada ohjeita.", signalUnknown: "Simuloitu tarkistus ei antanut varmaa tulosta.", omitted: "Koodit, salasanat ja korttinumerot", ended: "Istunto on päättynyt ja sen tiedot poistettu." },
  sv: { signalWhy: "Den simulerade uppgiften kan hjälpa till att klargöra händelsen.", signalLimit: "Används bara under den här sessionen.", signalRefusal: "Du kan avstå och ändå få råd.", signalUnknown: "Den simulerade kontrollen gav inget säkert svar.", omitted: "Koder, lösenord och kortnummer", ended: "Sessionen har avslutats och dess data har raderats." },
};

export async function handleEvent(sessionId: string, current: Journey | null, event: Event): Promise<{ journey: Journey | null; response: ApiResponse }> {
  if (event.kind === "end") {
    if (!current) throw new Error("session_expired");
    return { journey: null, response: present(sessionId, current, { type: "end", message: screenText[current.item.language].ended }) };
  }
  let journey: Journey;
  if (event.kind === "start") {
    const danger = fastDanger(event.input.openingMessage);
    const result = await intake(event.input, danger ? undefined : event.extractor);
    journey = { item: result.item, asked: 0, secretFound: result.secretsFound.length > 0, sentToLlm: !danger && event.sentToLlm && result.extractedBy === "primary", stopSeen: false, consent: {}, used: [], rescueIndex: 0, rescueOutcomes: {}, handoffDone: false, handoffApproved: false, demoScenario: event.demoScenario ?? "none", fastStop: danger, input: event.input };
    if (!danger) journey.awaitingDetails = needsDetails(event.input.openingMessage, journey.item, Boolean(event.input.incidentContent?.trim()));
    return { journey, response: present(sessionId, journey) };
  } else {
    if (!current) throw new Error("session_expired");
    journey = { ...current };
    const active = present(sessionId, current).screen;
    if (event.kind === "answer") {
      if (active.type !== "flip") throw new Error("invalid_event_order");
      const expected = assess(current.item, current.asked).flip;
      if (!expected || expected.topic !== event.topic) throw new Error("invalid_topic");
      journey.asked++;
      journey.flipHistory = [...(current.flipHistory ?? []), { topic: event.topic, question: current.phrased?.[event.topic] ?? active.question, answer: event.answer }];
      journey.item = event.answer === "unsure"
        ? { ...current.item, unsure: [...current.item.unsure, event.topic] }
        : { ...current.item, answers: { ...current.item.answers, [event.topic]: event.answer } };
    }
    if (event.kind === "answer_text") {
      if (active.type !== "flip") throw new Error("invalid_event_order");
      const expected = assess(current.item, current.asked).flip;
      if (!expected || expected.topic !== event.topic) throw new Error("invalid_topic");
      journey.asked++;
      journey.flipHistory = [...(current.flipHistory ?? []), { topic: event.topic, question: current.phrased?.[event.topic] ?? active.question, answer: event.text }];
      journey.item = await readTypedAnswer(journey, event.topic, event.text, event.extractor);
      noteTypedText(journey, event);
    }
    if (event.kind === "ai_answer") {
      const ask = current.pendingAsk;
      if (active.type !== "ask" || !ask || ask.id !== event.id) throw new Error("invalid_event_order");
      const text = event.text?.trim();
      const answer = text || { yes: "yes", no: "no", unsure: "not sure" }[event.answer ?? "unsure"];
      journey.pendingAsk = undefined;
      journey.interview = [...(current.interview ?? []), { question: ask.question, answer }];
      // AI discovery does not consume the allowance for decisive rule questions.
      // A typed answer is the user's own words, so it joins the story the rules read.
      if (text && journey.input) journey.input = { ...journey.input, openingMessage: `${journey.input.openingMessage}\n${text}` };
      journey.item = await readInterview(journey, event.extractor);
      if (ask.topic && (event.answer === "yes" || event.answer === "no")) {
        journey.item = applyAnswer(journey.item, ask.topic, event.answer);
      }
      if (text) noteTypedText(journey, { ...event, text });
      else if (event.extractor && event.sentToLlm) journey.sentToLlm = true;
    }
    if (event.kind === "add_details") {
      if (active.type === "end") throw new Error("invalid_event_order");
      if (active.type === "describe" && active.reason === "link_context") journey.linkContextAsked = true;
      const before = assess(current.item, current.asked).decision;
      if (current.awaitingDetails) {
        // A plain Yes or No answers "has something happened?" and isn't a description.
        const short = event.text.trim().split(/\s+/).length <= 3;
        const reply = short && !fastDanger(event.text) ? readAnswerOffline(event.text, current.item.language) : "unsure";
        if (current.awaitingDetails === "off_topic" && reply === "yes") {
          journey.awaitingDetails = "greeting";
          return { journey, response: present(sessionId, journey) };
        }
        if (current.awaitingDetails === "off_topic" && reply === "no") {
          journey.awaitingDetails = undefined;
          journey.noIncident = true;
          return { journey, response: present(sessionId, journey) };
        }
      }
      // A greeting or off-topic request isn't part of the story, so the description replaces it.
      journey.item = await reread(journey, event.text, event.extractor, Boolean(current.awaitingDetails));
      // New details may raise new questions, so the interview can start again.
      journey.interviewDone = false;
      // Cached wording can refer to an earlier incident or miss new context.
      journey.phrased = {};
      noteTypedText(journey, event);
      journey.awaitingDetails = journey.fastStop ? undefined : needsDetails(journey.input?.openingMessage ?? event.text, journey.item, Boolean(journey.input?.incidentContent?.trim()));
      const after = assess(journey.item, journey.asked).decision;
      // New details that change the advice start the guidance again. Answered questions
      // are never asked twice, but a question the new facts raise can now be asked.
      if (after.status !== before.status || after.primaryAction !== before.primaryAction || after.urgency !== before.urgency || after.destination !== before.destination) {
        journey.asked = 0;
        journey.rescueIndex = 0;
        journey.rescueOutcomes = {};
        if (!journey.personRequested) journey.handoffDone = false;
      }
    }
    if (event.kind === "consent") {
      if (active.type !== "unlock") throw new Error("invalid_event_order");
      if (pendingSignal(journey) !== event.signal) throw new Error("invalid_signal");
      journey.consent = { ...journey.consent, [event.signal]: event.granted ? "granted" : "refused" };
      if (event.granted) {
        const { finding } = readSimulatedSignal(event.signal, journey.demoScenario);
        journey.item = { ...journey.item, gatedFindings: { ...journey.item.gatedFindings, [event.signal]: finding } };
        journey.used = [...journey.used, event.signal];
      }
    }
    if (event.kind === "rescue") {
      if (active.type !== "rescue") throw new Error("invalid_event_order");
      if (event.stepId !== String(journey.rescueIndex) || !rescueSteps(journey)[journey.rescueIndex]) throw new Error("invalid_step");
      journey.rescueOutcomes = { ...journey.rescueOutcomes, [event.stepId]: event.outcome };
      journey.rescueIndex++;
      // Someone who can't finish a step shouldn't be left alone with it.
      if (event.outcome === "not_possible" && !journey.personRequested) {
        journey.personRequested = true;
        journey.personRoute = supportRoutes(journey)[0] ?? null;
        journey.handoffDone = false;
      }
    }
    if (event.kind === "handoff") {
      if (active.type !== "handoff") throw new Error("invalid_event_order");
      journey.handoffDone = true;
      journey.handoffApproved = event.approved;
    }
    if (event.kind === "talk_to_person") {
      // A person is available at any step, and the journey carries on after the handoff screen.
      if (active.type === "handoff" || active.type === "end") throw new Error("invalid_event_order");
      journey.personRequested = true;
      journey.personRoute = event.route ?? supportRoutes(journey)[0] ?? null;
      journey.stopSeen = true;
      journey.handoffDone = false;
      journey.handoffApproved = false;
    }
    if (event.kind === "continue") {
      if (active.type !== "stop") throw new Error("invalid_event_order");
      journey.stopSeen = true;
      // The immediate stop is shown without waiting for a model. Once acknowledged,
      // enrich the same report, retaining safety facts from the first offline read.
      if (journey.input && event.extractor && event.sentToLlm) {
        const result = await intake(journey.input, event.extractor);
        journey.item = { ...journey.item, facts: mergeFacts(result.item.facts, journey.item.facts), conflicts: [...new Set([...(result.item.conflicts ?? []), ...(journey.item.conflicts ?? []), ...conflictingTopics(result.item.facts, journey.item.facts)])] };
        journey.secretFound ||= result.secretsFound.length > 0;
        journey.sentToLlm = result.extractedBy === "primary";
      }
    }
  }
  return { journey, response: present(sessionId, journey) };
}

// A typed reply is read as new facts about the whole story, not only as yes or no, so
// details like "I typed my card number" reach the rules. Earlier answers are kept, and
// facts already read are merged so a second LLM read can't drop them.
// Nothing to assess yet: a greeting, or a request unrelated to security.
function needsDetails(text: string, item: Case, hasContent = false): Journey["awaitingDetails"] {
  // Pasted content is always something to assess.
  if (hasContent) return undefined;
  if (isGreetingOnly(text) && item.facts.evidence.length === 0) return "greeting";
  return isOffTopic(text, item.facts) ? "off_topic" : undefined;
}

async function reread(journey: Journey, text: string, extractor?: Extractor, replace = false): Promise<Case> {
  const current = journey.item;
  if (!journey.input) return current;
  const input = { ...journey.input, language: current.language, openingMessage: replace ? text : `${journey.input.openingMessage}\n${text}` };
  journey.input = input;
  const result = await intake(input, fastDanger(text) ? undefined : extractor);
  if (result.secretsFound.length > 0) journey.secretFound = true;
  const facts = replace ? result.item.facts : mergeFacts(result.item.facts, current.facts);
  const conflicts = replace ? result.item.conflicts ?? [] : [...new Set([...(current.conflicts ?? []), ...(result.item.conflicts ?? []), ...conflictingTopics(result.item.facts, current.facts)])];
  return { ...current, facts: { ...facts, language: current.language }, manipulationCues: result.item.manipulationCues, conflicts, signals: { ...current.signals, hasLink: current.signals.hasLink || result.item.signals.hasLink }, mentions: result.item.mentions };
}

// The interview is read by the LLM only. The keyword reader would take a question such as
// "Did they ask for your code?" as a fact even when the answer is No.
async function readInterview(journey: Journey, extractor?: Extractor): Promise<Case> {
  const current = journey.item;
  if (!journey.input) return current;
  const offline = async (): Promise<Case> => {
    const read = await intake(journey.input!);
    return { ...current, facts: { ...mergeFacts(read.item.facts, current.facts), language: current.language }, mentions: [...new Set([...(current.mentions ?? []), ...(read.item.mentions ?? [])])] };
  };
  if (!extractor) return offline();
  const transcript = (journey.interview ?? []).map((item) => `Question: ${item.question}\nThe person answered: ${item.answer}`).join("\n");
  const guarded = guardInput(`${journey.input.openingMessage}\n\nFollow-up questions and answers:\n${transcript}`, journey.input.incidentContent);
  let raw: unknown = null;
  try {
    raw = await extractor({ userText: guarded.userText, incidentText: guarded.incidentContent ?? "", language: current.language, incidentChannel: journey.input.incidentChannel, hasRiskyLink: current.signals.hasLink, audience: current.audience });
  } catch {
    return offline();
  }
  // A question provides context, never proof. Only the person's own report and
  // answers can support an extracted fact, even if a model quotes the question.
  const answerSource = guardInput([journey.input.openingMessage, ...(journey.interview ?? []).map(item => item.answer)].join("\n"), journey.input.incidentContent);
  const read = validateFacts(raw, answerSource);
  if (!read) return offline();
  return { ...current, facts: { ...mergeFacts(read, current.facts), language: current.language }, conflicts: [...new Set([...(current.conflicts ?? []), ...conflictingTopics(read, current.facts)])], mentions: [...new Set([...(current.mentions ?? []), ...detectMentions(guarded.userText)])] };
}

// Typed text can reveal live danger, and is sent to the LLM when one is used.
function noteTypedText(journey: Journey, event: { text: string; extractor?: Extractor; sentToLlm?: boolean }) {
  if (event.extractor && event.sentToLlm && !fastDanger(event.text)) journey.sentToLlm = true;
  const danger = fastDanger(event.text);
  if (danger && !journey.fastStop) {
    journey.fastStop = danger;
    journey.stopSeen = false;
  }
}

async function readTypedAnswer(journey: Journey, topic: Topic, text: string, extractor?: Extractor): Promise<Case> {
  const current = journey.item;
  const item = await reread(journey, text, extractor);
  // The new facts answered it already. Otherwise read the reply as yes, no or not sure.
  if (topicValue(item, topic) !== null && current.answers[topic] === undefined) return { ...item, unsure: item.unsure.filter(value => value !== topic) };
  return applyAnswer(item, topic, readAnswerOffline(text, current.language, topic));
}

// The rules choose the destination. A person the user asked for themselves falls back to
// first-line support, because the rules may have found no reason for a handoff.
export function journeyDestination(journey: Journey): Destination | null {
  const { destination } = assess(journey.item, journey.asked).decision;
  const chosen = journey.personRoute;
  if (chosen && chosen !== "bank" && chosen !== "police") return chosen;
  if (destination || !journey.personRequested) return destination;
  return journey.item.audience === "small_business" ? "business_security_support" : "operator_support_agent";
}

// The people who can act on this case, most useful first. A bank or police case goes
// there, not to DNA, because DNA staff can't block a card or take a crime report.
const item = (journey: Journey) => journey.item;
export function supportRoutes(journey: Journey): SupportRoute[] {
  const { externalContacts, destination } = assess(journey.item, journey.asked).decision;
  const routes: SupportRoute[] = [];
  if (destination) routes.push(destination);
  if (externalContacts.includes("bank") || journey.item.facts.pretendsToBe === "bank") routes.unshift("bank");
  if (externalContacts.includes("police") || item(journey).facts.userAlreadyDid.includes("paid")) routes.push("police");
  return routes;
}

const unknownText = (topic: Topic, language: Language) => (questions as Partial<Record<Topic, Record<Language, { question: string }>>>)[topic]?.[language].question;

// The supplied corpus has no Swedish titles, so Swedish falls back to the English one.
function sourceTitle(id: string, language: Language): string {
  const title = (guidanceTitles as Record<string, { en: string; fi: string }>)[id];
  if (!title) return id;
  return language === "fi" ? title.fi : title.en;
}

// Before a triage question, says what was understood, so a vague message doesn't get
// what looks like a canned reply. Every line is approved text.
function triageContext(item: Case, asked: number): string[] {
  const understood = approved.understood as Record<Mention | "intro", Record<Language, string>>;
  const mention = item.mentions?.[0];
  return [
    ...(mention ? [understood[mention][item.language]] : []),
    ...(asked === 0 ? [understood.intro[item.language]] : []),
  ];
}

// "Don't type your card details" is no use once they were typed and nobody is on the
// line: the rescue steps cover what to do next. A live call still gets its stop screen.
const DONE_BY: Partial<Record<InterruptionKind, Case["facts"]["userAlreadyDid"][number]>> = { card: "entered_card", money: "paid", login: "entered_login", bank_change: "paid" };
function liveStop(kind: InterruptionKind | null, item: Case): InterruptionKind | null {
  if (!kind) return null;
  const done = DONE_BY[kind];
  const live = item.facts.incidentType === "phone_call" || item.facts.incidentType === "remote_session";
  return done && item.facts.userAlreadyDid.includes(done) && !live ? null : kind;
}

function pendingSignal(journey: Journey): GatedSignal | null {
  const current = assess(journey.item, journey.asked);
  return current.outcome.wantsSignals.find(signal => {
    if (!journey.item.availableSignals.includes(signal) || journey.consent[signal]) return false;
    const { finding } = readSimulatedSignal(signal, journey.demoScenario);
    if (finding === "unknown") return false;
    const hypothetical = assess({ ...journey.item, gatedFindings: { ...journey.item.gatedFindings, [signal]: finding } }, journey.asked);
    return hypothetical.decision.primaryAction !== current.decision.primaryAction
      || hypothetical.decision.urgency !== current.decision.urgency
      || hypothetical.decision.destination !== current.decision.destination;
  }) ?? null;
}

function rescueSteps(journey: Journey) {
  const result = assess(journey.item, journey.asked);
  return result.decision.rescue ? result.composed.steps.map((detail, index) => ({ id: String(index), title: detail, detail, userAction: true })) : [];
}

export function present(sessionId: string, journey: Journey, override?: Screen): ApiResponse {
  const { item } = journey;
  const result = assess(item, journey.asked);
  const { decision, outcome, composed, flip } = result;
  const signal = pendingSignal(journey);
  const recovery = rescueSteps(journey);
  const confirmedSummary = result.confirmedFacts.map(f => f.text);
  const destination = journeyDestination(journey);
  const stopKind = liveStop(result.interruption ?? journey.fastStop ?? null, item);
  const handoffScreen = (target: Destination): Screen => ({ type: "handoff", destination: target, route: journey.personRoute ?? target, summary: handoffSummary(journey, confirmedSummary), details: handoffDetails(journey, confirmedSummary), omitted: handoffPreview(target, result.confirmedFacts, item.language).omitted });
  let screen: Screen;
  if (override) screen = override;
  else if (journey.personRequested && destination && !journey.handoffDone) screen = handoffScreen(destination);
  else if (stopKind && !journey.stopSeen) screen = stopScreen(stopKind, item.language);
  else if (journey.noIncident) screen = { type: "end", message: approved.offTopic[item.language].none };
  else if (journey.awaitingDetails === "greeting") screen = { type: "describe", reason: "greeting", ...approved.describe[item.language] };
  else if (journey.awaitingDetails === "off_topic") screen = { type: "describe", reason: "off_topic", message: approved.offTopic[item.language].message, hint: approved.offTopic[item.language].hint };
  else if (!journey.linkContextAsked && matchSituation(item).id === "link_opened" && item.facts.asksFor.length === 0 && item.facts.asksNothing !== true && !item.answers.card_details_entered && !item.answers.credentials_entered) screen = { type: "describe", reason: "link_context", ...linkContextCopy[item.language] };
  else if (journey.pendingAsk) screen = { type: "ask", ...journey.pendingAsk };
  else if (flip && composed.question) screen = { type: "flip", topic: flip.topic, question: contextualQuestion(flip.topic, item), why: questionText(flip.topic, item.language).why, statusLabel: approved.statusLabels[decision.status][item.language], branches: composed.branches ?? [], ...(isTriage(flip) ? { context: triageContext(item, journey.asked) } : {}) };
  else if (signal) screen = { type: "unlock", signal, what: signalLabel(signal, item.language), why: screenText[item.language].signalWhy, limit: screenText[item.language].signalLimit, ifRefused: screenText[item.language].signalRefusal };
  else if (recovery[journey.rescueIndex]) screen = { type: "rescue", step: recovery[journey.rescueIndex], position: journey.rescueIndex + 1, total: recovery.length };
  else if (destination && !journey.handoffDone) screen = handoffScreen(destination);
  else screen = { type: "result", statusLabel: approved.statusLabels[decision.status][item.language], steps: composed.steps, branches: composed.branches, reason: reasonText(outcome, item.language, item.audience, item), confidence: approved.confidence[confidenceBand(result.confidence)][item.language], unknowns: result.unknownTopics.flatMap(topic => unknownText(topic, item.language) ?? []), sources: outcome.guidance.map(id => ({ id, title: sourceTitle(id, item.language) })), classification: incidentCategory(item, outcome, decision.status, result.unknownTopics.length > 0), likelyType: likelyCategory(item, outcome, decision.status), story: incidentStory(item, outcome, decision.status), completed: Object.entries(journey.rescueOutcomes).filter(([, value]) => value === "done").flatMap(([id]) => recovery[Number(id)]?.detail ?? []), stopped: journey.stopSeen, sharedWith: journey.handoffApproved ? journey.personRoute ?? destination : null, supportRoutes: supportRoutes(journey) };
  const all = item.availableSignals;
  const radar = radarMatch(item);
  return { sessionId, language: item.language, screen: safeScreen(screen, item.language) ? screen : (console.warn("GUARD_BLOCKED", JSON.stringify(screen)), fallbackScreen("analysis_failed", item.language)), state: { status: decision.status, risk: decision.risk, urgency: decision.urgency, destination, externalContacts: decision.externalContacts, statusLabel: approved.statusLabels[decision.status][item.language], likelyType: likelyCategory(item, outcome, decision.status)?.title ?? null }, summary: confirmedSummary, secretWarning: journey.secretFound ? approved.secretWarning[item.language] : null, notice: approved.prototypeNotice[item.language], dataReceipt: { used: journey.used, refused: all.filter(s => journey.consent[s] === "refused"), notAccessed: all.filter(s => !journey.consent[s]), sentToLlm: journey.sentToLlm }, radar: radar ? { id: radar.id, title: radar.title[item.language], clue: radar.clue[item.language] } : null };
}

// The summary's parts: what the user said, why it matters, and the steps done and not done.
export function handoffDetails(journey: Journey, facts: string[]): HandoffDetails {
  const result = assess(journey.item, journey.asked);
  const stepTexts = result.composed.steps;
  const stepsWith = (outcome: "done" | "not_possible") => Object.entries(journey.rescueOutcomes).filter(([, value]) => value === outcome).map(([id]) => stepTexts[Number(id)]).filter((value): value is string => Boolean(value));
  return { facts, reason: reasonText(result.outcome, journey.item.language, journey.item.audience), completed: stepsWith("done"), unable: stepsWith("not_possible") };
}

export function handoffSummary(journey: Journey, facts: string[]): string[] {
  const result = assess(journey.item, journey.asked);
  const language = journey.item.language;
  const labels = {
    en: { status: "Situation", risk: "Risk", urgency: "Urgency", why: "Reason", completed: "Completed", unable: "Could not complete", riskValue: { none: "none", low: "low", medium: "medium", high: "high", critical: "critical" }, urgencyValue: { immediate: "immediate", today: "today", routine: "routine", none: "none" } },
    fi: { status: "Tilanne", risk: "Riski", urgency: "Kiireellisyys", why: "Syy", completed: "Tehty", unable: "Ei onnistunut", riskValue: { none: "ei riskiä", low: "matala", medium: "keskitaso", high: "korkea", critical: "erittäin korkea" }, urgencyValue: { immediate: "välitön", today: "tänään", routine: "tavanomainen", none: "ei kiirettä" } },
    sv: { status: "Situation", risk: "Risk", urgency: "Brådska", why: "Orsak", completed: "Klart", unable: "Kunde inte slutföra", riskValue: { none: "ingen", low: "låg", medium: "medel", high: "hög", critical: "mycket hög" }, urgencyValue: { immediate: "omedelbar", today: "i dag", routine: "normal", none: "ingen" } },
  }[language];
  const stepTexts = result.composed.steps;
  const completed = Object.entries(journey.rescueOutcomes).filter(([, outcome]) => outcome === "done").map(([id]) => stepTexts[Number(id)]).filter((value): value is string => Boolean(value));
  const unable = Object.entries(journey.rescueOutcomes).filter(([, outcome]) => outcome === "not_possible").map(([id]) => stepTexts[Number(id)]).filter((value): value is string => Boolean(value));
  return [
    ...facts,
    `${labels.status}: ${approved.statusLabels[result.decision.status][language]}; ${labels.risk}: ${labels.riskValue[result.decision.risk]}; ${labels.urgency}: ${labels.urgencyValue[result.decision.urgency]}.`,
    `${labels.why}: ${reasonText(result.outcome, language, journey.item.audience)}`,
    ...completed.map(text => `${labels.completed}: ${text}`),
    ...unable.map(text => `${labels.unable}: ${text}`),
  ];
}
