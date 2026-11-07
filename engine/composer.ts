import approved from "../content/approved-text.json";
import questions from "../content/questions.json";
import reasons from "../content/reasons.json";
import steps from "../content/steps.json";
import type { Question } from "./question-picker";
import type { Outcome } from "./situations";
import type { Language, Topic } from "./types";

export type ReasonKey = keyof typeof reasons;

const REASON_OF: Record<string, ReasonKey> = {
  personal_safety: "personal_safety",
  trace_request: "trace_request",
  ransomware: "ransomware",
  mailbox_takeover: "account_takeover",
  former_staff_access: "account_takeover",
  own_sim_change: "own_change",
  sim_takeover: "sim_takeover",
  operator_code_given: "sim_takeover",
  operator_code_refused: "code_refused",
  order_confirmed: "harmless",
  own_order: "own_change",
  own_payment_change: "own_change",
  colleague_order: "order_check",
  unauthorised_order: "order_check",
  booked_remote_support: "harmless",
  remote_banking_exposed: "money_or_card",
  remote_device_exposed: "device_exposed",
  unwanted_app: "device_exposed",
  attachment_ran: "attachment",
  attachment_not_run: "attachment",
  money_gone: "money_or_card",
  card_exposed: "money_or_card",
  bank_login_exposed: "money_or_card",
  code_given: "money_or_card",
  non_bank_code_given: "password_exposed",
  account_password_exposed: "password_exposed",
  own_click: "harmless",
  link_opened_nothing_entered: "link_only",
  own_approval_prompt: "own_change",
  approval_prompt_attack: "approval_attack",
  own_login: "own_login",
  unknown_login: "account_takeover",
  signaled_unknown_login: "account_takeover",
  signaled_sim_change: "sim_takeover",
  signaled_device_compromise: "device_exposed",
  signaled_former_staff_access: "account_takeover",
  breach_email_only: "breach_email",
  fake_breach_notice: "fake_notice",
  breach_password: "breach_password",
  unrequested_reset: "reset",
  router_or_network: "router",
  payment_verified: "payment_verified",
  payment_sent: "money_or_card",
  payment_held: "payment_pressure",
  payment_detail_change: "payment_pressure",
  bank_code_given: "money_or_card",
  bank_call_refused: "call_scam",
  call_ended: "call_ended",
  risky_call: "call_scam",
  bank_contact_call: "call_check",
  warned_call: "call_check",
  missed_foreign_call: "missed_call",
  family_request: "family",
  credential_lure: "credential_lure",
  known_service_payment_lure: "payment_lure",
  payment_lure: "payment_lure",
  flagged_link: "flagged_link",
  looks_genuine: "harmless",
  unclear: "unclear",
};

export const reasonKeyFor = (situation: string): ReasonKey | undefined => REASON_OF[situation];

export function reasonText(outcome: Outcome, language: Language): string {
  return reasons[REASON_OF[outcome.situation]][language];
}

export function stepTexts(outcome: Outcome, language: Language): string[] {
  return outcome.steps.map((step) => steps[step as keyof typeof steps][language]);
}

export function questionText(topic: Topic, language: Language) {
  return questions[topic as keyof typeof questions][language];
}

export type Branch = { condition: string; steps: string[] };
export type Composed = {
  adviceText: string;
  steps: string[];
  question: string | null;
  // Set while a decisive fact is unknown. Screens must show these, not the plain steps.
  branches: Branch[] | null;
};

// Action first, then the reason. Under an unknown fact the steps are conditional,
// so the advice never states that the worse branch is true.
export function compose(outcome: Outcome, language: Language, flip: Question | null, unknownTopic: Topic | null): Composed {
  const texts = stepTexts(outcome, language);
  const asked = flip ? questionText(flip.topic, language) : null;
  const wording = unknownTopic ? questionText(unknownTopic, language) : null;
  const otherSteps = (outcome.otherBranchSteps ?? []).map((step) => steps[step as keyof typeof steps][language]);

  const lead = texts.slice(0, 3).join(" ");
  const parts = [wording ? `${wording.ifRisky} ${lead}` : lead];
  if (wording && otherSteps.length > 0) parts.push(`${wording.ifSafe} ${otherSteps.slice(0, 2).join(" ")}`);
  parts.push(reasonText(outcome, language));
  if (asked) parts.push(asked.question);
  if (outcome.destination) parts.push(approved.handoff[language]);
  else if (outcome.status === "needs_verification") parts.push(approved.humanOffer[language]);

  const branches = wording
    ? [
        { condition: wording.ifRisky, steps: texts },
        ...(otherSteps.length > 0 ? [{ condition: wording.ifSafe, steps: otherSteps }] : []),
      ]
    : null;

  return { adviceText: parts.join(" "), steps: [...texts, ...otherSteps], question: asked?.question ?? null, branches };
}
