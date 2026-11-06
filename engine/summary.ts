import lines from "../content/fact-lines.json";
import { topicValue, type Case } from "./case";
import { computeConfidence } from "./confidence";
import type { ConfirmedFact, Topic } from "./types";

// Facts only, in the user's language. Every line traces to the user's words, an
// answer or a visible signal.
export function confirmedFacts(item: Case): ConfirmedFact[] {
  const { language } = item;
  const facts: ConfirmedFact[] = [];
  for (const [key, line] of Object.entries(lines.topics)) {
    const topic = key as Topic;
    const value = topicValue(item, topic);
    if (!value) continue;
    facts.push({ text: line[value][language], source: item.answers[topic] ? "answer" : "user_words" });
  }
  if (item.signals.linkVerdict === "malicious" || item.signals.linkVerdict === "suspicious") {
    facts.push({ text: lines.signals.linkFlagged[language], source: "visible_signal" });
  }
  if (item.signals.callWarning === "suspected_scam") {
    facts.push({ text: lines.signals.callWarned[language], source: "visible_signal" });
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
