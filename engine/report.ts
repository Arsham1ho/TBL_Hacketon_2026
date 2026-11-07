import actionVocabulary from "../content/action-vocabulary.json";
import approved from "../content/approved-text.json";
import guidanceTitles from "../content/guidance-titles.json";
import questions from "../content/questions.json";
import { signalLabel } from "../adapters/signals";
import { assess } from "./assess";
import { reasonText } from "./composer";
import { BASE, CEILING, FLOOR, PER_CONFIRMED_FACT, PER_UNKNOWN_FACT, confidenceBand } from "./confidence";
import type { Journey } from "./handle-event";
import { journeyDestination, supportRoutes } from "./handle-event";
import { likelyCategory } from "./incident-category";
import { UNCLEAR_CEILING } from "./summary";
import type { ConfirmedFact, Decision, GatedSignal, Language, Topic } from "./types";
import type { ManipulationCue } from "./manipulation";

// The full decision report a user can download when a chat ends: what the AI read, what the
// rules decided, and how sure it was. Everything comes from the engine's own state, so the
// report explains the real decision rather than a summary written after the fact.
export type DecisionReport = {
  generatedAt: string;
  language: Language;
  audience: "consumer" | "small_business";
  decision: Decision & { statusLabel: string; situation: string; supportRoutes: string[] };
  likelyType: { title: string; description: string } | null;
  reason: string;
  steps: string[];
  unknowns: string[];
  sources: { id: string; title: string }[];
  confidence: {
    score: number;
    band: "low" | "medium" | "high";
    label: string;
    base: number;
    confirmed: number;
    perConfirmed: number;
    unknown: number;
    perUnknown: number;
    floor: number;
    ceiling: number;
    // Set when the case was unclear, which caps confidence.
    unclearCap: number | null;
  };
  // Facts the reader extracted, by field, and the user's words that support them.
  facts: { field: string; value: string }[];
  // The same counts the confidence score uses, split by where each one came from.
  evidenceCounts: { userWords: number; answers: number; visibleSignals: number; consentedSignals: number };
  // How strong the main action is, on the dataset's 0 to 4 intervention scale.
  intervention: { level: number; max: number };
  evidence: { fact: string; quote: string }[];
  manipulationCues: ManipulationCue[];
  confirmedFacts: ConfirmedFact[];
  questions: { question: string; answer: string; kind: "decisive" | "follow_up" }[];
  data: { used: { id: GatedSignal; label: string }[]; refused: { id: GatedSignal; label: string }[]; notAccessed: { id: GatedSignal; label: string }[]; sentToLlm: boolean };
  safety: {
    secretsMasked: boolean;
    liveDanger: string | null;
    stopShown: boolean;
    rescueSteps: { done: number; notPossible: number };
    handoff: { destination: string | null; requested: boolean; approved: boolean };
  };
};

const SKIP = new Set(["language", "evidence"]);

// Every field with a value, as plain text. Null and empty mean "not read", so they're left out.
function factRows(facts: Record<string, unknown>): { field: string; value: string }[] {
  return Object.entries(facts).flatMap(([field, value]) => {
    if (SKIP.has(field) || value === null || value === undefined) return [];
    if (Array.isArray(value)) return value.length ? [{ field, value: value.join(", ") }] : [];
    if (typeof value === "object") return [];
    return [{ field, value: String(value) }];
  });
}

const questionText = (topic: Topic, language: Language) => (questions as Partial<Record<Topic, Record<Language, { question: string }>>>)[topic]?.[language].question;

function sourceTitle(id: string, language: Language): string {
  const title = (guidanceTitles as Record<string, { en: string; fi: string }>)[id];
  if (!title) return id;
  return language === "fi" ? title.fi : title.en;
}

export function buildReport(journey: Journey): DecisionReport {
  const { item } = journey;
  const language = item.language;
  const result = assess(item, journey.asked);
  const { decision, outcome } = result;
  const supported = new Set(item.facts.evidence.map(({ fact }) => fact));
  const confirmed = Object.keys(item.answers).length + supported.size;
  const unclear = outcome.situation === "unclear";
  const all = item.availableSignals;
  const label = (id: GatedSignal) => ({ id, label: signalLabel(id, language) });
  const outcomes = Object.values(journey.rescueOutcomes);
  const type = likelyCategory(item, outcome, decision.status);

  return {
    generatedAt: new Date().toISOString(),
    language,
    audience: item.audience,
    decision: { ...decision, statusLabel: approved.statusLabels[decision.status][language], situation: outcome.situation, supportRoutes: supportRoutes(journey) },
    likelyType: type ? { title: type.title, description: type.description } : null,
    reason: reasonText(outcome, language, item.audience),
    steps: result.composed.steps,
    unknowns: result.unknownTopics.flatMap((topic) => questionText(topic, language) ?? []),
    sources: outcome.guidance.map((id) => ({ id, title: sourceTitle(id, language) })),
    confidence: {
      score: result.confidence,
      band: confidenceBand(result.confidence),
      label: approved.confidence[confidenceBand(result.confidence)][language],
      base: BASE,
      confirmed,
      perConfirmed: PER_CONFIRMED_FACT,
      unknown: result.unknownTopics.length,
      perUnknown: PER_UNKNOWN_FACT,
      floor: FLOOR,
      ceiling: CEILING,
      unclearCap: unclear ? UNCLEAR_CEILING : null,
    },
    facts: factRows(item.facts as unknown as Record<string, unknown>),
    evidenceCounts: {
      userWords: supported.size,
      answers: Object.keys(item.answers).length,
      visibleSignals: result.confirmedFacts.filter((fact) => fact.source === "visible_signal").length,
      consentedSignals: result.confirmedFacts.filter((fact) => fact.source === "consented_signal").length,
    },
    intervention: { level: (actionVocabulary.intervention as Record<string, number>)[decision.primaryAction] ?? 0, max: Math.max(...Object.values(actionVocabulary.intervention)) },
    // The LLM and keyword readers can both quote the same words, so each pair is listed once.
    evidence: [...new Map(item.facts.evidence.map((entry) => [`${entry.fact}\u0000${entry.quote}`, entry])).values()],
    manipulationCues: item.manipulationCues ?? [],
    confirmedFacts: result.confirmedFacts,
    questions: [
      ...(journey.flipHistory ?? []).map((entry) => ({ question: entry.question, answer: entry.answer, kind: "decisive" as const })),
      ...(journey.interview ?? []).map((entry) => ({ question: entry.question, answer: entry.answer, kind: "follow_up" as const })),
    ],
    data: {
      used: journey.used.map(label),
      refused: all.filter((signal) => journey.consent[signal] === "refused").map(label),
      notAccessed: all.filter((signal) => !journey.consent[signal]).map(label),
      sentToLlm: journey.sentToLlm,
    },
    safety: {
      secretsMasked: journey.secretFound,
      liveDanger: result.interruption ?? journey.fastStop ?? null,
      stopShown: journey.stopSeen,
      rescueSteps: { done: outcomes.filter((value) => value === "done").length, notPossible: outcomes.filter((value) => value === "not_possible").length },
      handoff: { destination: journeyDestination(journey), requested: Boolean(journey.personRequested), approved: journey.handoffApproved },
    },
  };
}
