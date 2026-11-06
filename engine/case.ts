import type { Audience, Facts, GatedSignal, Language, Topic } from "./types";

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
  answers: Answers;
  unsure: Topic[];
  signals: VisibleSignals;
  pregrantedSignals: GatedSignal[];
  availableSignals: GatedSignal[];
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

export function withAnswer(item: Case, topic: Topic, answer: Answer): Case {
  return { ...item, answers: { ...item.answers, [topic]: answer } };
}
