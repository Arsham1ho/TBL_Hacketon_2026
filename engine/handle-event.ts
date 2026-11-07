import approved from "../content/approved-text.json";
import guidanceTitles from "../content/guidance-titles.json";
import questions from "../content/questions.json";
import { assess, intake, type CaseInput, type Extractor } from "./assess";
import { questionText, reasonText } from "./composer";
import { confidenceBand } from "./confidence";
import { fallbackScreen, stopScreen } from "./fallback";
import { fastDanger } from "./fast-danger";
import { safeScreen } from "./output-guard";
import { readSimulatedSignal, signalLabel, type DemoScenario } from "../adapters/signals";
import { handoffPreview } from "../adapters/handoff";
import type { Case } from "./case";
import type { ApiResponse, Screen } from "./screens";
import type { Destination, GatedSignal, Language, Topic } from "./types";

export type Journey = { item: Case; asked: number; secretFound: boolean; sentToLlm: boolean; stopSeen: boolean; consent: Partial<Record<GatedSignal, "granted" | "refused">>; used: GatedSignal[]; rescueIndex: number; rescueOutcomes: Record<string, "done" | "not_possible">; handoffDone: boolean; handoffApproved: boolean; demoScenario: DemoScenario; personRequested?: boolean };
export type Event =
  | { kind: "start"; input: CaseInput; extractor?: Extractor; sentToLlm: boolean; demoScenario?: DemoScenario }
  | { kind: "answer"; topic: Topic; answer: "yes" | "no" | "unsure" }
  | { kind: "continue" }
  | { kind: "consent"; signal: GatedSignal; granted: boolean }
  | { kind: "rescue"; stepId: string; outcome: "done" | "not_possible" }
  | { kind: "handoff"; approved: boolean }
  | { kind: "talk_to_person" }
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
    journey = { item: result.item, asked: 0, secretFound: result.secretsFound.length > 0, sentToLlm: !danger && event.sentToLlm && result.extractedBy === "primary", stopSeen: false, consent: {}, used: [], rescueIndex: 0, rescueOutcomes: {}, handoffDone: false, handoffApproved: false, demoScenario: event.demoScenario ?? "none" };
    return { journey, response: present(sessionId, journey, danger ? stopScreen(danger, journey.item.language) : undefined) };
  } else {
    if (!current) throw new Error("session_expired");
    journey = { ...current };
    const active = present(sessionId, current).screen;
    if (event.kind === "answer") {
      if (active.type !== "flip") throw new Error("invalid_event_order");
      const expected = assess(current.item, current.asked).flip;
      if (!expected || expected.topic !== event.topic) throw new Error("invalid_topic");
      journey.asked++;
      journey.item = event.answer === "unsure"
        ? { ...current.item, unsure: [...current.item.unsure, event.topic] }
        : { ...current.item, answers: { ...current.item.answers, [event.topic]: event.answer } };
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
      journey.rescueOutcomes[event.stepId] = event.outcome;
      journey.rescueIndex++;
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
      journey.stopSeen = true;
      journey.handoffDone = false;
      journey.handoffApproved = false;
    }
    if (event.kind === "continue") {
      if (active.type !== "stop") throw new Error("invalid_event_order");
      journey.stopSeen = true;
    }
  }
  return { journey, response: present(sessionId, journey) };
}

// The rules choose the destination. A person the user asked for themselves falls back to
// first-line support, because the rules may have found no reason for a handoff.
export function journeyDestination(journey: Journey): Destination | null {
  const { destination } = assess(journey.item, journey.asked).decision;
  if (destination || !journey.personRequested) return destination;
  return journey.item.audience === "small_business" ? "business_security_support" : "operator_support_agent";
}

const unknownText = (topic: Topic, language: Language) => (questions as Partial<Record<Topic, Record<Language, { question: string }>>>)[topic]?.[language].question;

// The supplied corpus has no Swedish titles, so Swedish falls back to the English one.
function sourceTitle(id: string, language: Language): string {
  const title = (guidanceTitles as Record<string, { en: string; fi: string }>)[id];
  if (!title) return id;
  return language === "fi" ? title.fi : title.en;
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

function present(sessionId: string, journey: Journey, override?: Screen): ApiResponse {
  const { item } = journey;
  const result = assess(item, journey.asked);
  const { decision, outcome, composed, flip } = result;
  const signal = pendingSignal(journey);
  const recovery = rescueSteps(journey);
  const confirmedSummary = result.confirmedFacts.map(f => f.text);
  const destination = journeyDestination(journey);
  const handoffScreen = (target: Destination): Screen => ({ type: "handoff", destination: target, summary: handoffSummary(journey, confirmedSummary), omitted: handoffPreview(target, result.confirmedFacts, item.language).omitted });
  let screen: Screen;
  if (override) screen = override;
  else if (journey.personRequested && destination && !journey.handoffDone) screen = handoffScreen(destination);
  else if (result.interruption && !journey.stopSeen) screen = stopScreen(result.interruption, item.language);
  else if (flip && composed.question) screen = { type: "flip", topic: flip.topic, question: composed.question, why: questionText(flip.topic, item.language).why, statusLabel: approved.statusLabels[decision.status][item.language], branches: composed.branches ?? [] };
  else if (signal) screen = { type: "unlock", signal, what: signalLabel(signal, item.language), why: screenText[item.language].signalWhy, limit: screenText[item.language].signalLimit, ifRefused: screenText[item.language].signalRefusal };
  else if (recovery[journey.rescueIndex]) screen = { type: "rescue", step: recovery[journey.rescueIndex], position: journey.rescueIndex + 1, total: recovery.length };
  else if (destination && !journey.handoffDone) screen = handoffScreen(destination);
  else screen = { type: "result", statusLabel: approved.statusLabels[decision.status][item.language], steps: composed.steps, branches: composed.branches, reason: reasonText(outcome, item.language), confidence: approved.confidence[confidenceBand(result.confidence)][item.language], unknowns: result.unknownTopics.flatMap(topic => unknownText(topic, item.language) ?? []), sources: outcome.guidance.map(id => ({ id, title: sourceTitle(id, item.language) })) };
  const all = item.availableSignals;
  return { sessionId, language: item.language, screen: safeScreen(screen, item.language) ? screen : fallbackScreen("analysis_failed", item.language), state: { status: decision.status, risk: decision.risk, urgency: decision.urgency, destination, externalContacts: decision.externalContacts }, summary: confirmedSummary, secretWarning: journey.secretFound ? approved.secretWarning[item.language] : null, notice: approved.prototypeNotice[item.language], dataReceipt: { used: journey.used, refused: all.filter(s => journey.consent[s] === "refused"), notAccessed: all.filter(s => !journey.consent[s]), sentToLlm: journey.sentToLlm } };
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
    `${labels.why}: ${reasonText(result.outcome, language)}`,
    ...completed.map(text => `${labels.completed}: ${text}`),
    ...unable.map(text => `${labels.unable}: ${text}`),
  ];
}
