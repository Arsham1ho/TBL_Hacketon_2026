import text from "../content/action-vocabulary.json";
import { didAction, topicValue, withAnswer, type Case } from "./case";
import { matchSituation, safeIsBlocked, UNCLEAR, type Outcome } from "./situations";
import { orderByMentions } from "./mentions";
import type { Topic } from "./types";

export const MAX_FLIPS = 2;
// An unclear case starts from nothing, so it may need every triage question.
const MAX_TRIAGE_FLIPS = UNCLEAR.flips?.length ?? MAX_FLIPS;

const INTERVENTION = text.intervention as Record<string, number>;
const RISKS = ["none", "low", "medium", "high", "critical"];
const URGENCIES = ["none", "routine", "today", "immediate"];

export function differs(a: Outcome, b: Outcome): boolean {
  return a.primaryAction !== b.primaryAction || a.urgency !== b.urgency || a.destination !== b.destination;
}

function severity(item: Outcome): number {
  return INTERVENTION[item.primaryAction] * 100 + RISKS.indexOf(item.risk) * 10 + URGENCIES.indexOf(item.urgency);
}

// "The number on your card" only fits when a card is part of the story.
function cardInvolved(item: Case): boolean {
  const { facts } = item;
  return didAction(item, "entered_card") || topicValue(item, "card_details_entered") === "yes" || facts.asksFor.includes("card")
    || facts.dataExposed.includes("card") || facts.assetInvolved.includes("card");
}

// Advice must fit what happened: a phone call has no link, and a bank transfer has no card.
function fitSteps(item: Case, outcome: Outcome): Outcome {
  const steps = outcome.steps.filter((step) => {
    if (step === "dont_open_link") return item.signals.hasLink || !["phone_call", "missed_call"].includes(item.facts.incidentType ?? "");
    // "Hang up" only fits a call. A message that mentions no call doesn't get it.
    if (step === "hang_up_dont_call_back") {
      const call = ["phone_call", "missed_call"].includes(item.facts.incidentType ?? "") || item.mentions?.includes("call");
      const written = item.mentions?.some((mention) => mention === "email" || mention === "sms") || item.signals.hasLink;
      return call || !written;
    }
    if (step === "block_card") return !didAction(item, "paid") || didAction(item, "entered_card");
    return true;
  }).map((step) => (step === "contact_bank_now" && !cardInvolved(item) ? "contact_bank_official" : step));
  // Money that has left needs a crime report as well as the bank.
  if (didAction(item, "paid") && steps.some((step) => step.startsWith("contact_bank")) && !steps.includes("report_police")) steps.push("report_police");
  return { ...outcome, steps };
}

export function decide(item: Case): Outcome {
  const outcome = matchSituation(item).then(item);
  return fitSteps(item, outcome.status === "safe" && safeIsBlocked(item) ? UNCLEAR.then(item) : outcome);
}

export type Flip = { topic: Topic; ifYes: Outcome; ifNo: Outcome };

function flipFor(item: Case, topic: Topic): Flip | null {
  const ifYes = decide(withAnswer(item, topic, "yes"));
  const ifNo = decide(withAnswer(item, topic, "no"));
  return differs(ifYes, ifNo) ? { topic, ifYes, ifNo } : null;
}

// Picks the unanswered fact whose Yes and No lead to different responses. If every
// branch needs the same response, there is nothing to ask.
export function pickFlip(item: Case): Flip | null {
  const match = matchSituation(item);
  // A Safe outcome that the gate refuses is unclear, so it gets the same questions.
  const blocked = match.then(item).status === "safe" && safeIsBlocked(item);
  const situation = blocked ? UNCLEAR : match;
  // Only the triage questions follow what the message mentions. Known situations keep their order.
  const flips = situation === UNCLEAR ? orderByMentions(UNCLEAR.flips ?? [], item.mentions, item.triagePriority) : situation.flips ?? [];
  for (const topic of flips) {
    if (topicValue(item, topic) !== null || item.unsure.includes(topic)) continue;
    const flip = flipFor(item, topic);
    if (flip) return flip;
  }
  return null;
}

export const isTriage = (flip: Flip | null) => Boolean(flip && UNCLEAR.flips?.includes(flip.topic));
export const flipLimit = (flip: Flip | null) => (isTriage(flip) ? MAX_TRIAGE_FLIPS : MAX_FLIPS);

// A "Not sure" answer that still changes the response.
export function unresolvedFlip(item: Case): Flip | null {
  for (const topic of item.unsure) {
    if (item.answers[topic]) continue;
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
