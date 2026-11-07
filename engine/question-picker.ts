import text from "../content/action-vocabulary.json";
import { topicValue, withAnswer, type Case } from "./case";
import { matchSituation, safeIsBlocked, UNCLEAR, type Outcome } from "./situations";
import type { Topic } from "./types";

export const MAX_FLIPS = 2;
// A confirmed high-risk case benefits from a little more recovery context, but
// should never turn into a long interview.
export const MAX_HIGH_RISK_FLIPS = 3;

const INTERVENTION = text.intervention as Record<string, number>;
const RISKS = ["none", "low", "medium", "high", "critical"];
const URGENCIES = ["none", "routine", "today", "immediate"];

export function differs(a: Outcome, b: Outcome): boolean {
  return a.primaryAction !== b.primaryAction || a.urgency !== b.urgency || a.destination !== b.destination;
}

function severity(item: Outcome): number {
  return INTERVENTION[item.primaryAction] * 100 + RISKS.indexOf(item.risk) * 10 + URGENCIES.indexOf(item.urgency);
}

export function decide(item: Case): Outcome {
  const outcome = matchSituation(item).then(item);
  return outcome.status === "safe" && safeIsBlocked(item) ? UNCLEAR.then(item) : outcome;
}

export type Flip = { kind: "decisive"; topic: Topic; ifYes: Outcome; ifNo: Outcome };
export type ContextQuestion = { kind: "context"; topic: Topic };
export type Question = Flip | ContextQuestion;

function flipFor(item: Case, topic: Topic): Flip | null {
  const ifYes = decide(withAnswer(item, topic, "yes"));
  const ifNo = decide(withAnswer(item, topic, "no"));
  return differs(ifYes, ifNo) ? { kind: "decisive", topic, ifYes, ifNo } : null;
}

// Picks the unanswered fact whose Yes and No lead to different responses. If every
// branch needs the same response, there is nothing to ask.
export function pickFlip(item: Case): Flip | null {
  for (const topic of matchSituation(item).flips ?? []) {
    if (topicValue(item, topic) !== null || item.unsure.includes(topic)) continue;
    const flip = flipFor(item, topic);
    if (flip) return flip;
  }
  return null;
}

// A "Not sure" answer that still changes the response.
export function unresolvedFlip(item: Case): Flip | null {
  for (const topic of item.unsure) {
    if (item.answers[topic]) continue;
    const flip = flipFor(item, topic);
    if (flip) return flip;
  }
  return null;
}

// A first answer makes the advice and handoff summary specific to the user's
// situation even when the safe action is already clear. Prefer exposure facts
// that can refine recovery; otherwise establish whether pressure is still live.
export function pickContextQuestion(item: Case): ContextQuestion | null {
  const { facts } = item;
  const candidates: Topic[] = [
    ...(facts.asksFor.includes("code") || facts.incidentType === "phone_call" ? ["code_shared"] : []),
    ...(facts.userAlreadyDid.includes("opened_link") || facts.incidentType === "link_or_site" ? ["card_details_entered"] : []),
    ...(facts.userAlreadyDid.includes("gave_remote_access") || facts.incidentType === "remote_session" ? ["credentials_entered"] : []),
    ...(facts.asksFor.includes("money") || facts.incidentType === "payment_request" || facts.incidentType === "payment_detail_change" ? ["payment_status"] : []),
    ...(facts.incidentType === "suspicious_attachment" || facts.incidentType === "unwanted_app_or_profile" ? ["app_installed"] : []),
    ...(facts.incidentType === "unknown_login" || facts.incidentType === "sim_or_number_change" || facts.incidentType === "unexpected_order_or_bill" ? ["self_initiated"] : []),
    "time_of_event",
  ];
  // A user answer is stronger than an extracted fact. Ask once even when the
  // extractor supplied a value, so the person can confirm or correct it.
  const topic = candidates.find(candidate => !item.answers[candidate] && !item.unsure.includes(candidate));
  return topic ? { kind: "context", topic } : null;
}

// Once a person has confirmed some context and the rules already see an active
// threat or an incident, check one more exposure that could change recovery.
// These are still real flips: a question is only returned when Yes and No lead
// to a different action, urgency, or destination.
export function pickHighRiskFlip(item: Case): Flip | null {
  const status = decide(item).status;
  if (status !== "threat_in_progress" && status !== "incident_occurred") return null;

  const { facts } = item;
  const candidates = new Set<Topic>([
    ...(facts.asksFor.includes("code") || facts.incidentType === "phone_call" ? ["code_shared"] as Topic[] : []),
    ...(facts.asksFor.includes("money") || facts.incidentType === "payment_request" || facts.incidentType === "payment_detail_change" ? ["payment_status"] as Topic[] : []),
    ...(facts.asksFor.includes("card") || facts.incidentType === "link_or_site" ? ["card_details_entered"] as Topic[] : []),
    ...(facts.asksFor.includes("login") || facts.incidentType === "unknown_login" || facts.incidentType === "mailbox_takeover" ? ["credentials_entered"] as Topic[] : []),
    ...(facts.asksFor.includes("app_install") || facts.incidentType === "unwanted_app_or_profile" || facts.incidentType === "suspicious_attachment" ? ["app_installed"] as Topic[] : []),
  ]);

  for (const topic of candidates) {
    if (topicValue(item, topic) !== null || item.unsure.includes(topic)) continue;
    const flip = flipFor(item, topic);
    if (flip) return flip;
  }
  return null;
}

// Used for "Not sure" and when nobody can reply. The fact stays unknown, so the
// advice follows the worse branch without claiming that branch is true.
export function worstCase(flip: Flip): Outcome {
  const yesIsWorse = severity(flip.ifYes) >= severity(flip.ifNo);
  const worse = yesIsWorse ? flip.ifYes : flip.ifNo;
  const other = yesIsWorse ? flip.ifNo : flip.ifYes;
  return {
    ...worse,
    // Blocking a card is the bank's call until a card is known to be exposed.
    steps: worse.steps.filter((step) => step !== "block_card"),
    status: "needs_verification",
    rescue: false,
    wantsSignals: [...new Set([...worse.wantsSignals, ...other.wantsSignals])],
    guidance: [...new Set([...worse.guidance, ...other.guidance])],
    otherBranchSteps: other.steps.filter((step) => !worse.steps.includes(step)),
    worseAnswer: yesIsWorse ? "yes" : "no",
  };
}
