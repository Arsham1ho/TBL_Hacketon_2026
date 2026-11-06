import { topicValue, type Case } from "./case";
import { computeConfidence } from "./confidence";
import type { ConfirmedFact, Topic } from "./types";

// Facts only. Every line traces to the user's words, an answer or a visible signal.
const TOPIC_LINES: Partial<Record<Topic, { yes: string; no: string }>> = {
  self_initiated: { yes: "The user did this themselves.", no: "The user did not do this." },
  code_shared: { yes: "A code was shared.", no: "No code was shared." },
  card_details_entered: { yes: "Card details were entered.", no: "No card details were entered." },
  credentials_entered: { yes: "Login details were entered.", no: "No login details were entered." },
  payment_status: { yes: "The payment was sent.", no: "The payment was not sent." },
  money_transferred: { yes: "Money was moved.", no: "No money was moved." },
  app_installed: { yes: "Something was installed.", no: "Nothing was installed." },
  remote_access_given: { yes: "Remote access was given.", no: "No remote access was given." },
  user_safety: { yes: "The user says they are safe now.", no: "The user says they are not safe now." },
};

export function confirmedFacts(item: Case): ConfirmedFact[] {
  const facts: ConfirmedFact[] = [];
  for (const [key, lines] of Object.entries(TOPIC_LINES)) {
    const topic = key as Topic;
    const value = topicValue(item, topic);
    if (!value) continue;
    facts.push({ text: lines[value], source: item.answers[topic] ? "answer" : "user_words" });
  }
  if (item.signals.linkVerdict === "malicious" || item.signals.linkVerdict === "suspicious") {
    facts.push({ text: `The link check result was ${item.signals.linkVerdict}.`, source: "visible_signal" });
  }
  if (item.signals.callWarning === "suspected_scam") {
    facts.push({ text: "The network warned about this call.", source: "visible_signal" });
  }
  return facts;
}

const UNCLEAR_CEILING = 0.3;

// Counts distinct supported facts, so two extractors agreeing doesn't double the
// evidence. An unclear case can never read as confident, however much was extracted.
export function caseConfidence(item: Case, unknownDecisiveFacts: number, unclear: boolean): number {
  const supported = new Set(item.facts.evidence.map(({ fact }) => fact));
  const score = computeConfidence({
    confirmedFacts: confirmedFacts(item).length + supported.size,
    unknownDecisiveFacts,
    conflicts: 0,
  });
  return unclear ? Math.min(score, UNCLEAR_CEILING) : score;
}
