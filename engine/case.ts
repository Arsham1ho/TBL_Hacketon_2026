import type { Mention } from "./mentions";
import type { Audience, Facts, GatedSignal, Language, Topic } from "./types";
import type { ManipulationCue } from "./manipulation";

export type Answer = "yes" | "no";
export type Answers = Partial<Record<Topic, Answer>>;

// What the assistant may see without consent.
export type VisibleSignals = {
  hasLink: boolean;
  linkVerdict: "malicious" | "suspicious" | "unknown" | "clean" | null;
  callWarning: "suspected_scam" | "possible_spam" | "none" | null;
  callerSpoofed: boolean;
};

export type Case = {
  audience: Audience;
  language: Language;
  facts: Facts;
  manipulationCues?: ManipulationCue[];
  answers: Answers;
  unsure: Topic[];
  signals: VisibleSignals;
  pregrantedSignals: GatedSignal[];
  availableSignals: GatedSignal[];
  gatedFindings?: Partial<Record<GatedSignal, string>>;
  // Words the message mentions. They order triage questions and never decide anything.
  mentions?: Mention[];
  // Triage questions in the order the LLM found most relevant. Order only, never an answer.
  triagePriority?: Topic[];
  // Extractors supplied opposing values; answers resolve these topics.
  conflicts?: Topic[];
};

const FROM_ACTIONS: Partial<Record<Topic, Facts["userAlreadyDid"][number]>> = {
  code_shared: "shared_code",
  card_details_entered: "entered_card",
  credentials_entered: "entered_login",
  money_transferred: "paid",
  payment_status: "paid",
  app_installed: "installed_app",
  remote_access_given: "gave_remote_access",
};

// Answers win over extraction, so the user can always correct what was read.
export function topicValue(item: Case, topic: Topic): Answer | null {
  const answered = item.answers[topic];
  if (answered) return answered;
  if (item.conflicts?.includes(topic)) return null;

  const { facts } = item;
  const action = FROM_ACTIONS[topic];
  if (action) {
    if (facts.userAlreadyDid.includes(action)) return "yes";
    return facts.userAlreadyDid.includes("nothing") ? "no" : null;
  }
  if (topic === "self_initiated") return facts.selfInitiated;
  if (topic === "password_reused") return toAnswer(facts.passwordReused);
  if (topic === "signal_lost") return toAnswer(facts.serviceLost);
  return null;
}

function toAnswer(value: boolean | null): Answer | null {
  if (value === null) return null;
  return value ? "yes" : "no";
}

// A "no" from the user overrules a misread. A "yes" is handled by each situation's flip.
const CORRECTED_BY: Partial<Record<Facts["userAlreadyDid"][number], Topic[]>> = {
  paid: ["money_transferred", "payment_status"],
  entered_card: ["card_details_entered"],
  entered_login: ["credentials_entered"],
  shared_code: ["code_shared"],
  installed_app: ["app_installed"],
  gave_remote_access: ["remote_access_given"],
};

export function didAction(item: Case, action: Facts["userAlreadyDid"][number]): boolean {
  if (CORRECTED_BY[action]?.some((topic) => item.answers[topic] === "no")) return false;
  return item.facts.userAlreadyDid.includes(action);
}

export function applyAnswer(item: Case, topic: Topic, answer: Answer | "unsure"): Case {
  if (answer !== "unsure") return withAnswer({ ...item, unsure: item.unsure.filter((value) => value !== topic) }, topic, answer);
  return item.unsure.includes(topic) ? item : { ...item, unsure: [...item.unsure, topic] };
}

export function withAnswer(item: Case, topic: Topic, answer: Answer): Case {
  return { ...item, answers: { ...item.answers, [topic]: answer } };
}
