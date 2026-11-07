import approved from "../content/approved-text.json";
import questions from "../content/questions.json";
import reasons from "../content/reasons.json";
import steps from "../content/steps.json";
import type { Flip } from "./question-picker";
import type { Outcome } from "./situations";
import type { Audience, Language, Topic } from "./types";
import { didAction, topicValue, type Case } from "./case";

export type ReasonKey = keyof typeof reasons;

// Business-specific reason overrides for situations where the audience changes the message.
const BUSINESS_REASON_OF: Partial<Record<ReasonKey, ReasonKey>> = {
  account_takeover: "account_takeover_business",
  ransomware: "ransomware_business",
  password_exposed: "password_exposed_business",
  payment_pressure: "payment_pressure_business",
};

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
  unauthorised_operator_order: "operator_order",
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
  police_impostor_call: "call_scam",
  call_ended: "call_ended",
  left_alone: "left_alone",
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
  triage_device: "device_exposed",
  triage_money: "money_or_card",
  triage_live: "live_request",
};

export const reasonKeyFor = (situation: string): ReasonKey | undefined => REASON_OF[situation];

export function reasonText(outcome: Outcome, language: Language, audience?: Audience, item?: Case): string {
  const confirmed = (action: Case["facts"]["userAlreadyDid"][number], topic: Topic) => item && (didAction(item, action) || topicValue(item, topic) === "yes");
  const key = outcome.situation === "card_exposed" && confirmed("entered_card", "card_details_entered") ? "card_entered_reason"
    : outcome.situation === "money_gone" && confirmed("paid", "money_transferred") ? "money_sent_reason"
    : ["code_given", "non_bank_code_given", "bank_code_given"].includes(outcome.situation) && confirmed("shared_code", "code_shared") ? "code_shared_reason"
    : outcome.situation === "remote_device_exposed" && confirmed("gave_remote_access", "remote_access_given") ? "remote_granted_reason"
    : REASON_OF[outcome.situation];
  const resolvedKey = audience === "small_business" ? (BUSINESS_REASON_OF[key] ?? key) : key;
  return reasons[resolvedKey][language];
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
export function compose(outcome: Outcome, language: Language, flip: Flip | null, unknownTopic: Topic | null, audience?: Audience, item?: Case): Composed {
  const texts = stepTexts(outcome, language);
  const asked = flip ? questionText(flip.topic, language) : null;
  const wording = unknownTopic ? questionText(unknownTopic, language) : null;
  const otherSteps = (outcome.otherBranchSteps ?? []).map((step) => steps[step as keyof typeof steps][language]);

  // Usually the worse branch leads. When the unknown leans safe, the safer branch leads instead.
  const mainIf = outcome.saferFirst ? wording?.ifSafe : wording?.ifRisky;
  const otherIf = outcome.saferFirst ? wording?.ifRisky : wording?.ifSafe;
  const lead = texts.slice(0, 3).join(" ");
  const parts = [wording ? `${mainIf} ${lead}` : lead];
  if (wording && otherSteps.length > 0) parts.push(`${otherIf} ${otherSteps.slice(0, 2).join(" ")}`);
  parts.push(reasonText(outcome, language, audience, item));
  if (asked) parts.push(asked.question);
  if (outcome.destination) parts.push(approved.handoff[language]);
  else if (outcome.status === "needs_verification") parts.push(approved.humanOffer[language]);

  const branches = wording
    ? [
        { condition: mainIf!, steps: texts },
        ...(otherSteps.length > 0 ? [{ condition: otherIf!, steps: otherSteps }] : []),
      ]
    : null;

  return { adviceText: parts.join(" "), steps: [...texts, ...otherSteps], question: asked?.question ?? null, branches };
}
