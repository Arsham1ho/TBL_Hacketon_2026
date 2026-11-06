import text from "../content/action-vocabulary.json";
import { topicValue, withAnswer, type Case } from "./case";
import { matchSituation, type Outcome } from "./situations";
import type { Topic } from "./types";

export const MAX_FLIPS = 2;

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
  return matchSituation(item).then(item);
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
