import type { Decision, Destination, PrimaryAction, Risk, Status, Urgency } from "./types";

// What each supplied action is allowed to look like. Rules choose inside these
// bounds; checkDecision rejects anything outside them.
export type ActionContract = {
  statuses: Status[];
  risks: Risk[];
  urgencies: Urgency[];
  destinations: Destination[];
};

// These actions usually need confirmed harm. Needs verification is allowed only for
// worst-case-safe advice while a decisive fact is unknown, as after "Not sure".
const WORST_CASE_ACTIONS: PrimaryAction[] = [
  "change_password_and_enable_mfa",
  "isolate_device_and_scan",
  "contact_bank_and_block_cards",
];

const LOW_TO_HIGH: Risk[] = ["low", "medium", "high"];
const LOW_TO_CRITICAL: Risk[] = ["low", "medium", "high", "critical"];
const OPEN_STATUSES: Status[] = ["needs_verification", "threat_in_progress", "incident_occurred"];
const ALL_HUMANS: Destination[] = [
  "operator_support_agent",
  "security_specialist",
  "business_security_support",
  "human_advisor",
];

export const ACTION_CONTRACT: Record<PrimaryAction, ActionContract> = {
  no_action_needed: {
    statuses: ["safe"],
    risks: ["none", "low"],
    urgencies: ["none", "routine"],
    destinations: [],
  },
  do_not_interact_and_delete: {
    statuses: ["needs_verification", "threat_in_progress"],
    risks: LOW_TO_HIGH,
    urgencies: ["routine", "today"],
    destinations: [],
  },
  verify_via_official_channel: {
    statuses: ["needs_verification", "threat_in_progress"],
    risks: LOW_TO_HIGH,
    urgencies: ["routine", "today"],
    destinations: [],
  },
  contact_operator_support: {
    statuses: OPEN_STATUSES,
    risks: LOW_TO_CRITICAL,
    urgencies: ["routine", "today", "immediate"],
    destinations: ["operator_support_agent", "security_specialist", "business_security_support", "human_advisor"],
  },
  change_password_and_enable_mfa: {
    statuses: OPEN_STATUSES,
    risks: LOW_TO_CRITICAL,
    urgencies: ["routine", "today", "immediate"],
    destinations: ["security_specialist", "business_security_support"],
  },
  isolate_device_and_scan: {
    statuses: OPEN_STATUSES,
    risks: ["high", "critical"],
    urgencies: ["today", "immediate"],
    destinations: ["security_specialist", "business_security_support"],
  },
  // The bank acts on the card. A human destination here only adds support.
  contact_bank_and_block_cards: {
    statuses: OPEN_STATUSES,
    risks: ["high", "critical"],
    urgencies: ["today", "immediate"],
    destinations: ["security_specialist", "business_security_support", "human_advisor"],
  },
  report_to_authority: {
    statuses: ["incident_occurred"],
    risks: ["medium", "high", "critical"],
    urgencies: ["routine", "today"],
    destinations: [],
  },
  escalate_to_human: {
    statuses: OPEN_STATUSES,
    risks: ["medium", "high", "critical"],
    urgencies: ["today", "immediate"],
    destinations: ALL_HUMANS,
  },
  // Status describes the underlying situation, so a refusal can sit on any open status.
  decline_out_of_scope: {
    statuses: OPEN_STATUSES,
    risks: LOW_TO_CRITICAL,
    urgencies: ["routine", "today", "immediate"],
    destinations: [],
  },
};

const RISK_ORDER: Risk[] = ["none", "low", "medium", "high", "critical"];

// Returns every contract breach. An empty list means the decision may be shown.
export function checkDecision(decision: Decision): string[] {
  const contract = ACTION_CONTRACT[decision.primaryAction];
  const problems: string[] = [];

  if (!contract.statuses.includes(decision.status)) {
    problems.push(`status ${decision.status} is not allowed for ${decision.primaryAction}`);
  }
  if (!contract.risks.includes(decision.risk)) {
    problems.push(`risk ${decision.risk} is not allowed for ${decision.primaryAction}`);
  }
  if (!contract.urgencies.includes(decision.urgency)) {
    problems.push(`urgency ${decision.urgency} is not allowed for ${decision.primaryAction}`);
  }
  if (decision.destination && !contract.destinations.includes(decision.destination)) {
    problems.push(`destination ${decision.destination} is not allowed for ${decision.primaryAction}`);
  }
  if (decision.status === "safe") {
    if (decision.unknownDecisiveFacts.length > 0) problems.push("safe cannot have unknown decisive facts");
    if (decision.rescue) problems.push("safe cannot enter Rescue Mode");
    if (decision.externalContacts.length > 0) problems.push("safe cannot send the user to an outside contact");
    if (RISK_ORDER.indexOf(decision.risk) > RISK_ORDER.indexOf("low")) problems.push("safe cannot exceed low risk");
  }
  if (
    decision.status === "needs_verification" &&
    WORST_CASE_ACTIONS.includes(decision.primaryAction) &&
    decision.unknownDecisiveFacts.length === 0
  ) {
    problems.push(`${decision.primaryAction} under needs_verification must name the unknown fact`);
  }
  if (decision.primaryAction === "escalate_to_human" && !decision.destination) {
    problems.push("escalate_to_human needs a destination");
  }
  if (decision.primaryAction === "contact_bank_and_block_cards" && !decision.externalContacts.includes("bank")) {
    problems.push("contact_bank_and_block_cards must list the bank");
  }

  return problems;
}
