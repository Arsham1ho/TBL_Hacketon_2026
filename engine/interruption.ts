import type { Facts } from "./types";

export type InterruptionKind =
  | "personal_safety"
  | "remote_access"
  | "app_install"
  | "code"
  | "approval"
  | "money"
  | "card"
  | "login"
  | "bank_change"
  | "ransomware"
  | "live_request";

// Personal safety comes first because the usual stop advice can make it worse.
// Most dangerous request first, because only one stop message is shown.
const REQUEST_PRIORITY: [Facts["asksFor"][number], InterruptionKind][] = [
  ["remote_access", "remote_access"],
  ["app_install", "app_install"],
  ["code", "code"],
  ["approval", "approval"],
  ["money", "money"],
  ["card", "card"],
  ["login", "login"],
  ["bank_change", "bank_change"],
];

// Fires only on a stated present-tense threat. An unknown happeningNow does not
// raise a Stop Screen, because a stale message would become a false alarm; the
// action still carries the same "don't" advice. Something the user started or
// already verified is not an attack, such as their own login or booked IT support.
export function interruptionFor(facts: Facts): InterruptionKind | null {
  if (facts.personalSafetyRisk === true || facts.incidentType === "partner_monitoring") return "personal_safety";
  if (facts.happeningNow !== true) return null;
  if (facts.selfInitiated === "yes" || facts.independentlyVerified === true) return null;
  if (facts.incidentType === "ransomware") return "ransomware";
  if (facts.incidentType === "approval_prompts") return "approval";
  if (facts.incidentType === "remote_session" || facts.userAlreadyDid.includes("gave_remote_access")) {
    return "remote_access";
  }

  for (const [request, kind] of REQUEST_PRIORITY) {
    if (facts.asksFor.includes(request)) return kind;
  }
  return null;
}
