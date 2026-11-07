import approved from "../content/approved-text.json";
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
import type { GatedSignal, Topic } from "./types";

export type Journey = { item: Case; asked: number; secretFound: boolean; sentToLlm: boolean; stopSeen: boolean; consent: Partial<Record<GatedSignal, "granted" | "refused">>; used: GatedSignal[]; rescueIndex: number; handoffDone: boolean; handoffApproved: boolean; demoScenario: DemoScenario };
export type Event =
  | { kind: "start"; input: CaseInput; extractor?: Extractor; sentToLlm: boolean; demoScenario?: DemoScenario }
  | { kind: "answer"; topic: Topic; answer: "yes" | "no" | "unsure" }
  | { kind: "continue" }
  | { kind: "consent"; signal: GatedSignal; granted: boolean }
  | { kind: "rescue"; stepId: string; outcome: "done" | "not_possible" }
  | { kind: "handoff"; approved: boolean }
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
    journey = { item: result.item, asked: 0, secretFound: result.secretsFound.length > 0, sentToLlm: !danger && event.sentToLlm && result.extractedBy === "primary", stopSeen: false, consent: {}, used: [], rescueIndex: 0, handoffDone: false, handoffApproved: false, demoScenario: event.demoScenario ?? "none" };
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
      journey.rescueIndex++;
    }
    if (event.kind === "handoff") {
      if (active.type !== "handoff") throw new Error("invalid_event_order");
      journey.handoffDone = true;
      journey.handoffApproved = event.approved;
    }
    if (event.kind === "continue") {
      if (active.type !== "stop") throw new Error("invalid_event_order");
      journey.stopSeen = true;
    }
  }
  return { journey, response: present(sessionId, journey) };
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
  const summary = result.confirmedFacts.map(f => f.text);
  let screen: Screen;
  if (override) screen = override;
  else if (result.interruption && !journey.stopSeen) screen = stopScreen(result.interruption, item.language);
  else if (flip && composed.question) screen = { type: "flip", topic: flip.topic, question: composed.question, why: questionText(flip.topic, item.language).why, statusLabel: approved.statusLabels[decision.status][item.language], branches: composed.branches ?? [] };
  else if (signal) screen = { type: "unlock", signal, what: signalLabel(signal, item.language), why: screenText[item.language].signalWhy, limit: screenText[item.language].signalLimit, ifRefused: screenText[item.language].signalRefusal };
  else if (recovery[journey.rescueIndex]) screen = { type: "rescue", step: recovery[journey.rescueIndex], position: journey.rescueIndex + 1, total: recovery.length };
  else if (decision.destination && !journey.handoffDone) screen = { type: "handoff", ...handoffPreview(decision.destination, result.confirmedFacts, item.language), summary };
  else screen = { type: "result", statusLabel: approved.statusLabels[decision.status][item.language], steps: composed.steps, branches: composed.branches, reason: reasonText(outcome, item.language), confidence: approved.confidence[confidenceBand(result.confidence)][item.language], unknowns: result.unknownTopics, sources: outcome.guidance.map(id => ({ id, title: id })) };
  const all = item.availableSignals;
  return { sessionId, language: item.language, screen: safeScreen(screen, item.language) ? screen : fallbackScreen("analysis_failed", item.language), state: { status: decision.status, risk: decision.risk, urgency: decision.urgency, destination: decision.destination, externalContacts: decision.externalContacts }, summary, secretWarning: journey.secretFound ? approved.secretWarning[item.language] : null, notice: approved.prototypeNotice[item.language], dataReceipt: { used: journey.used, refused: all.filter(s => journey.consent[s] === "refused"), notAccessed: all.filter(s => !journey.consent[s]), sentToLlm: journey.sentToLlm } };
}
