import { z } from "zod";

// Source of truth for SafeStep's vocabulary. Values marked "supplied" must match
// the SimSet reference files exactly, because the evaluator scores them.

export const Language = z.enum(["fi", "en", "sv"]);
export type Language = z.infer<typeof Language>;

export const Audience = z.enum(["consumer", "small_business"]);
export type Audience = z.infer<typeof Audience>;

// What the user is told about their situation. "critical" is a risk level, not a status.
export const Status = z.enum(["safe", "needs_verification", "threat_in_progress", "incident_occurred"]);
export type Status = z.infer<typeof Status>;

// Supplied. Risk is how bad the outcome could be.
export const Risk = z.enum(["none", "low", "medium", "high", "critical"]);
export type Risk = z.infer<typeof Risk>;

// Supplied. Urgency is how soon the user must act.
export const Urgency = z.enum(["none", "routine", "today", "immediate"]);
export type Urgency = z.infer<typeof Urgency>;

// Supplied.
export const PrimaryAction = z.enum([
  "no_action_needed",
  "do_not_interact_and_delete",
  "verify_via_official_channel",
  "contact_operator_support",
  "change_password_and_enable_mfa",
  "isolate_device_and_scan",
  "contact_bank_and_block_cards",
  "report_to_authority",
  "escalate_to_human",
  "decline_out_of_scope",
]);
export type PrimaryAction = z.infer<typeof PrimaryAction>;

// Supplied. People SafeStep can hand a case to (simulated in the prototype).
export const Destination = z.enum([
  "operator_support_agent",
  "security_specialist",
  "business_security_support",
  "human_advisor",
]);
export type Destination = z.infer<typeof Destination>;

// Organisations the user contacts themselves. SafeStep never contacts these.
export const ExternalContact = z.enum(["bank", "police", "ncsc"]);
export type ExternalContact = z.infer<typeof ExternalContact>;

// Supplied.
export const Topic = z.enum([
  "credentials_entered",
  "card_details_entered",
  "code_shared",
  "money_transferred",
  "app_installed",
  "remote_access_given",
  "link_details",
  "call_details",
  "self_initiated",
  "device_behaviour",
  "signal_lost",
  "account_affected",
  "password_reused",
  "business_access",
  "payment_status",
  "user_safety",
  "time_of_event",
  "message_content",
]);
export type Topic = z.infer<typeof Topic>;

// Supplied. Signals marked requires_consent in the SimSet.
export const GatedSignal = z.enum([
  "subscription.recent_events",
  "subscription.network_status",
  "device.recent_app_installs",
  "device.security_findings",
  "operator_account.recent_logins",
  "credential_exposure",
  "business.staff_accounts",
]);
export type GatedSignal = z.infer<typeof GatedSignal>;

// Neutral on purpose: genuine bills and calls land here too, so the label must not assume a scam.
export const IncidentType = z.enum([
  "message_or_notice",
  "phone_call",
  "payment_request",
  "payment_detail_change",
  "link_or_site",
  "unwanted_app_or_profile",
  "remote_session",
  "suspicious_attachment",
  "data_breach_notice",
  "unrequested_reset",
  "approval_prompts",
  "unknown_login",
  "sim_or_number_change",
  "unexpected_order_or_bill",
  "mailbox_takeover",
  "former_staff_access",
  "ransomware",
  "router_or_network",
  "partner_monitoring",
  "other",
]);
export type IncidentType = z.infer<typeof IncidentType>;

export const Asset = z.enum([
  "money",
  "card",
  "login",
  "code",
  "device",
  "sim",
  "email",
  "business_account",
  "payment",
  "router",
]);
export type Asset = z.infer<typeof Asset>;

// What the LLM may report. Strict on purpose: a model that adds a risk, action or
// destination field fails validation instead of influencing the decision.
// null means unknown and must never be treated as "no". An empty list means
// nothing was stated; userAlreadyDid: ["nothing"] is the stated "I did nothing".
export const Facts = z.strictObject({
  language: Language,
  incidentType: IncidentType.nullable(),
  contactStartedBy: z.enum(["stranger", "user", "known_service"]).nullable(),
  pretendsToBe: z
    .enum(["bank", "operator", "police", "family", "ceo", "supplier", "support", "authority", "other", "none"])
    .nullable(),
  assetInvolved: z.array(Asset),
  asksFor: z.array(
    z.enum(["money", "code", "card", "login", "app_install", "remote_access", "bank_change", "approval"]),
  ),
  userAlreadyDid: z.array(
    z.enum([
      "nothing",
      "opened_link",
      "opened_attachment",
      "entered_card",
      "entered_login",
      "shared_code",
      "paid",
      "installed_app",
      "gave_remote_access",
      "approved_prompt",
    ]),
  ),
  dataExposed: z.array(z.enum(["email_only", "password", "card", "bank_login", "identity"])),
  selfInitiated: z.enum(["yes", "no"]).nullable(),
  independentlyVerified: z.boolean().nullable(),
  passwordReused: z.boolean().nullable(),
  serviceLost: z.boolean().nullable(),
  happeningNow: z.boolean().nullable(),
  pressureOrSecrecy: z.boolean().nullable(),
  personalSafetyRisk: z.boolean().nullable(),
  asksToTracePerson: z.boolean(),
  evidence: z.array(z.strictObject({ fact: z.string(), quote: z.string() })),
});
export type Facts = z.infer<typeof Facts>;

export const ConfirmedFact = z.object({
  text: z.string(),
  source: z.enum(["user_words", "answer", "visible_signal", "consented_signal"]),
});
export type ConfirmedFact = z.infer<typeof ConfirmedFact>;

export const ConsentRecord = z.object({
  signal: GatedSignal,
  decision: z.enum(["granted", "refused", "pre_granted"]),
});
export type ConsentRecord = z.infer<typeof ConsentRecord>;

// The decision comes from rules. No LLM output type can produce one directly.
export const Decision = z.object({
  status: Status,
  risk: Risk,
  urgency: Urgency,
  primaryAction: PrimaryAction,
  destination: Destination.nullable(),
  externalContacts: z.array(ExternalContact),
  unknownDecisiveFacts: z.array(Topic),
  rescue: z.boolean(),
});
export type Decision = z.infer<typeof Decision>;

export const IncidentState = Decision.extend({
  confidence: z.number().min(0).max(1),
  affectedAssets: z.array(Asset),
  confirmedFacts: z.array(ConfirmedFact),
  consent: z.array(ConsentRecord),
  summary: z.array(z.string()),
});
export type IncidentState = z.infer<typeof IncidentState>;

export const SecretKind = z.enum(["card_number", "code", "password"]);
export type SecretKind = z.infer<typeof SecretKind>;
