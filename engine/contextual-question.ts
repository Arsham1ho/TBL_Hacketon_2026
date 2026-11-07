import type { Case } from "./case";
import { questionText } from "./composer";
import type { Language, Topic } from "./types";

// Each alternative asks the same yes/no fact as its topic. Context is chosen only
// from structured facts; no sender names, links or details are invented.
const variants: Partial<Record<Topic, string[]>> = {
  self_initiated: ["Did you place the order described in the confirmation yourself?"],
  code_shared: ["Did you read the code to the caller or send it to them?", "Did you enter the code on the page or send it to someone?"],
  remote_access_given: ["Did you let the caller connect to or control your device?", "Did you let someone connect to or control your device?"],
  money_transferred: ["Did you send any money in response to that request?"],
  payment_status: ["Has any payment already been sent to the requested account?"],
  card_details_entered: ["Did you enter your card number, expiry date or security code on the page?"],
};

export function contextualQuestion(topic: Topic, item: Case): string {
  const fallback = questionText(topic, item.language).question;
  if (item.language !== "en") return fallback;
  const { facts } = item;
  if (topic === "self_initiated" && facts.incidentType === "unexpected_order_or_bill") return variants.self_initiated![0]!;
  if (topic === "code_shared" && facts.asksFor.includes("code")) {
    if (facts.incidentType === "phone_call" || item.mentions?.includes("call")) return variants.code_shared![0]!;
    if (item.signals.hasLink || facts.incidentType === "link_or_site") return variants.code_shared![1]!;
  }
  if (topic === "remote_access_given" && facts.asksFor.includes("remote_access")) return variants.remote_access_given![facts.incidentType === "phone_call" || item.mentions?.includes("call") ? 0 : 1]!;
  if (topic === "money_transferred" && facts.asksFor.includes("money")) return variants.money_transferred![0]!;
  if (topic === "payment_status" && facts.incidentType === "payment_detail_change") return variants.payment_status![0]!;
  if (topic === "card_details_entered" && (item.signals.hasLink || facts.incidentType === "link_or_site")) return variants.card_details_entered![0]!;
  return fallback;
}

export function approvedContextualQuestion(topic: Topic, language: Language, text: string): boolean {
  return text === questionText(topic, language).question || (language === "en" && (variants[topic] ?? []).includes(text));
}
