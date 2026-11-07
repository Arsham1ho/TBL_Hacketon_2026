import { topicValue, type Case } from "./case";
import type { Destination, ExternalContact, GatedSignal, PrimaryAction, Risk, Status, Topic, Urgency } from "./types";

export type Outcome = {
  situation: string;
  status: Status;
  risk: Risk;
  urgency: Urgency;
  primaryAction: PrimaryAction;
  destination: Destination | null;
  externalContacts: ExternalContact[];
  rescue: boolean;
  steps: string[];
  guidance: string[];
  wantsSignals: GatedSignal[];
  // Set only for worst-case advice under an unknown fact.
  otherBranchSteps?: string[];
  worseAnswer?: "yes" | "no";
};

export type Situation = {
  id: string;
  when: (item: Case) => boolean;
  // Facts worth testing here. The picker asks one only if Yes and No really differ.
  flips?: Topic[];
  then: (item: Case) => Outcome;
};

type Extras = Partial<Pick<Outcome, "destination" | "externalContacts" | "rescue" | "wantsSignals">>;

function outcome(
  situation: string,
  primaryAction: PrimaryAction,
  status: Status,
  risk: Risk,
  urgency: Urgency,
  steps: string[],
  guidance: string[],
  extras: Extras = {},
): Outcome {
  return {
    situation,
    primaryAction,
    status,
    risk,
    urgency,
    steps,
    guidance,
    destination: extras.destination ?? null,
    externalContacts: extras.externalContacts ?? [],
    rescue: extras.rescue ?? false,
    wantsSignals: extras.wantsSignals ?? [],
  };
}

const did = (item: Case, action: Case["facts"]["userAlreadyDid"][number]) =>
  item.facts.userAlreadyDid.includes(action);
const asks = (item: Case, request: Case["facts"]["asksFor"][number]) => item.facts.asksFor.includes(request);
const is = (item: Case, type: Case["facts"]["incidentType"]) => item.facts.incidentType === type;
const poses = (item: Case, party: Case["facts"]["pretendsToBe"]) => item.facts.pretendsToBe === party;
const yes = (item: Case, topic: Topic) => topicValue(item, topic) === "yes";

// A small business goes to its own support line, whatever the problem is.
const person = (item: Case, consumer: Destination): Destination =>
  item.audience === "small_business" ? "business_security_support" : consumer;

const badLink = (item: Case) => item.signals.linkVerdict === "malicious" || item.signals.linkVerdict === "suspicious";
const warnedCall = (item: Case) => item.signals.callWarning === "suspected_scam" || item.signals.callerSpoofed;

// A demand from a colleague or supplier, as opposed to a fee from a service or a relative.
const colleagueDemand = (item: Case) =>
  item.facts.pretendsToBe === null ||
  poses(item, "ceo") ||
  poses(item, "supplier") ||
  (item.audience === "small_business" && (poses(item, "other") || poses(item, "none")));

// A true quote can still support a wrong conclusion, so reassuring facts must have
// nothing against them: no risky request, no pressure, and no denial from the user.
const uncontradicted = (item: Case) =>
  item.facts.asksFor.length === 0 && item.facts.pressureOrSecrecy !== true && item.facts.selfInitiated !== "no";

function explainBenign(id: string, guidance: string[], risk: Risk = "none"): Outcome {
  return outcome(id, "no_action_needed", "safe", risk, risk === "none" ? "none" : "routine", ["explain_benign"], guidance);
}

function bankIncident(id: string, item: Case, guidance: string[], police: boolean, steps: string[] = []): Outcome {
  return outcome(
    id,
    "contact_bank_and_block_cards",
    "incident_occurred",
    "critical",
    "immediate",
    ["contact_bank_now", "block_card", "check_statements", ...steps],
    guidance,
    { externalContacts: police ? ["bank", "police"] : ["bank"], rescue: true },
  );
}

// Checked in order, and the first match wins. Rules use general facts only:
// never case IDs, scenario names or dataset answers. The list ends in unclear,
// which can never return Safe.
export const SITUATIONS: Situation[] = [
  {
    id: "personal_safety",
    when: (c) => c.facts.personalSafetyRisk === true || is(c, "partner_monitoring"),
    flips: ["user_safety"],
    then: (c) =>
      outcome(
        "personal_safety",
        "escalate_to_human",
        "threat_in_progress",
        "high",
        topicValue(c, "user_safety") === "no" ? "immediate" : "today",
        ["plan_before_removing", "seek_support_org", "use_trusted_device"],
        ["guidance_monitoring_apps", "guidance_handing_off"],
        { destination: "human_advisor", externalContacts: ["police"], rescue: true, wantsSignals: ["device.recent_app_installs"] },
      ),
  },
  {
    id: "trace_request",
    when: (c) => c.facts.asksToTracePerson,
    then: () =>
      outcome(
        "trace_request",
        "decline_out_of_scope",
        "needs_verification",
        "medium",
        "today",
        ["decline_request", "report_police", "keep_evidence"],
        ["guidance_out_of_scope", "guidance_report_to_police"],
        { externalContacts: ["police", "bank"] },
      ),
  },
  {
    id: "ransomware",
    when: (c) => is(c, "ransomware"),
    then: (c) =>
      outcome(
        "ransomware",
        "isolate_device_and_scan",
        "incident_occurred",
        "critical",
        "immediate",
        ["disconnect_device", "dont_pay_or_transfer", "get_device_checked", "keep_evidence"],
        ["guidance_ransomware"],
        { destination: person(c, "security_specialist"), externalContacts: ["ncsc", "police"], rescue: true },
      ),
  },
  {
    id: "mailbox_takeover",
    when: (c) => is(c, "mailbox_takeover"),
    then: (c) =>
      outcome(
        "mailbox_takeover",
        "change_password_and_enable_mfa",
        "incident_occurred",
        "critical",
        "immediate",
        ["change_password", "check_forwarding_rules", "inform_staff", "review_sessions"],
        ["guidance_business_email_compromise", "guidance_invoice_fraud"],
        { destination: person(c, "security_specialist"), externalContacts: ["police", "ncsc"], rescue: true },
      ),
  },
  {
    id: "former_staff_access",
    when: (c) => is(c, "former_staff_access"),
    then: () =>
      outcome(
        "former_staff_access",
        "change_password_and_enable_mfa",
        "incident_occurred",
        "high",
        "today",
        ["change_password", "review_sessions", "revoke_access"],
        ["guidance_offboarding", "guidance_shared_accounts"],
        { rescue: true, wantsSignals: ["business.staff_accounts"] },
      ),
  },
  {
    id: "operator_code_call",
    when: (c) => (is(c, "phone_call") || is(c, "sim_or_number_change")) && poses(c, "operator") && asks(c, "code"),
    flips: ["code_shared"],
    then: (c) =>
      yes(c, "code_shared")
        ? outcome(
            "operator_code_given",
            "contact_operator_support",
            "incident_occurred",
            "critical",
            "immediate",
            ["contact_operator", "lock_subscription", "contact_bank_now"],
            ["guidance_sim_swap", "guidance_one_time_codes", "guidance_operator_impersonation"],
            {
              destination: person(c, "operator_support_agent"),
              externalContacts: ["bank"],
              rescue: true,
              wantsSignals: ["subscription.recent_events"],
            },
          )
        : outcome(
            "operator_code_refused",
            "contact_operator_support",
            "threat_in_progress",
            "medium",
            "today",
            ["dont_share_codes", "contact_operator", "hang_up_dont_call_back"],
            ["guidance_operator_impersonation", "guidance_one_time_codes"],
            { wantsSignals: ["subscription.recent_events"] },
          ),
  },
  {
    id: "sim_change",
    when: (c) => is(c, "sim_or_number_change"),
    flips: ["self_initiated"],
    then: (c) =>
      yes(c, "self_initiated")
        ? explainBenign("own_sim_change", ["guidance_esim_own_change", "guidance_proportionate_advice"])
        : outcome(
            "sim_takeover",
            "contact_operator_support",
            "incident_occurred",
            "critical",
            "immediate",
            ["contact_operator", "lock_subscription", "contact_bank_now"],
            ["guidance_sim_swap"],
            {
              destination: person(c, "operator_support_agent"),
              externalContacts: ["bank"],
              rescue: true,
              wantsSignals: ["subscription.recent_events"],
            },
          ),
  },
  {
    id: "order_confirmed",
    when: (c) => is(c, "unexpected_order_or_bill") && c.facts.independentlyVerified === true && uncontradicted(c),
    then: () => explainBenign("order_confirmed", ["guidance_order_confirmations", "guidance_proportionate_advice"]),
  },
  {
    id: "unexpected_order",
    when: (c) => is(c, "unexpected_order_or_bill"),
    flips: ["self_initiated"],
    then: (c) =>
      c.facts.selfInitiated === "yes"
        ? explainBenign("own_order", ["guidance_order_confirmations", "guidance_proportionate_advice"])
        : yes(c, "self_initiated")
        ? outcome(
            "colleague_order",
            "contact_operator_support",
            "needs_verification",
            "low",
            "routine",
            ["contact_operator"],
            ["guidance_order_confirmations"],
            { wantsSignals: ["subscription.recent_events", "operator_account.recent_logins"] },
          )
        : outcome(
            "unauthorised_order",
            "contact_operator_support",
            "incident_occurred",
            "critical",
            "immediate",
            ["contact_operator", "change_password", "lock_subscription", "review_sessions"],
            ["guidance_order_confirmations", "guidance_shared_accounts"],
            {
              destination: person(c, "operator_support_agent"),
              externalContacts: ["police"],
              rescue: true,
              wantsSignals: ["subscription.recent_events", "operator_account.recent_logins"],
            },
          ),
  },
  {
    id: "booked_remote_support",
    when: (c) =>
      is(c, "remote_session") && (c.facts.independentlyVerified === true || c.facts.selfInitiated === "yes") && c.facts.selfInitiated !== "no",
    then: () => explainBenign("booked_remote_support", ["guidance_remote_access", "guidance_proportionate_advice"]),
  },
  {
    id: "remote_access_given",
    when: (c) => did(c, "gave_remote_access"),
    flips: ["credentials_entered"],
    then: (c) =>
      yes(c, "credentials_entered")
        ? {
            ...bankIncident(
              "remote_banking_exposed",
              c,
              ["guidance_remote_access", "guidance_tech_support_fraud", "guidance_report_to_police"],
              true,
              ["disconnect_device", "remove_app_or_profile"],
            ),
            destination: person(c, "security_specialist"),
          }
        : outcome(
            "remote_device_exposed",
            "isolate_device_and_scan",
            "incident_occurred",
            "high",
            "today",
            ["disconnect_device", "remove_app_or_profile", "get_device_checked"],
            ["guidance_remote_access", "guidance_tech_support_fraud"],
            { destination: person(c, "security_specialist"), rescue: true, wantsSignals: ["device.security_findings"] },
          ),
  },
  {
    id: "unwanted_app",
    when: (c) => did(c, "installed_app") || is(c, "unwanted_app_or_profile"),
    then: (c) =>
      outcome(
        "unwanted_app",
        "isolate_device_and_scan",
        "incident_occurred",
        "critical",
        "immediate",
        ["disconnect_device", "avoid_banking_on_device", "remove_app_or_profile", "contact_bank_now", "get_device_checked"],
        ["guidance_malicious_app", "guidance_device_compromise"],
        {
          destination: person(c, "security_specialist"),
          externalContacts: ["bank"],
          rescue: true,
          wantsSignals: ["device.recent_app_installs"],
        },
      ),
  },
  {
    id: "attachment_opened",
    when: (c) => did(c, "opened_attachment") || is(c, "suspicious_attachment"),
    flips: ["app_installed"],
    then: (c) =>
      yes(c, "app_installed")
        ? outcome(
            "attachment_ran",
            "isolate_device_and_scan",
            "incident_occurred",
            "high",
            "immediate",
            ["disconnect_device", "get_device_checked", "inform_staff"],
            ["guidance_malicious_attachment"],
            { destination: person(c, "security_specialist"), rescue: true },
          )
        : outcome(
            "attachment_not_run",
            "do_not_interact_and_delete",
            "threat_in_progress",
            "medium",
            "today",
            ["dont_open_attachment", "delete_or_report_message", "inform_staff"],
            ["guidance_malicious_attachment"],
          ),
  },
  {
    id: "money_gone",
    when: (c) => did(c, "paid"),
    then: (c) => {
      const pressured = poses(c, "police") || poses(c, "authority");
      return {
        ...bankIncident(
          "money_gone",
          c,
          pressured ? ["guidance_police_impostor", "guidance_report_to_police"] : ["guidance_card_details_entered", "guidance_report_to_police"],
          true,
          ["report_police", "keep_evidence"],
        ),
        destination: pressured ? "human_advisor" : c.audience === "small_business" ? "business_security_support" : null,
      };
    },
  },
  {
    id: "card_exposed",
    when: (c) => did(c, "entered_card"),
    then: (c) => bankIncident("card_exposed", c, ["guidance_card_details_entered", "guidance_report_to_police"], false),
  },
  {
    id: "bank_login_exposed",
    when: (c) => did(c, "entered_login") && (poses(c, "bank") || c.facts.dataExposed.includes("bank_login")),
    then: (c) => bankIncident("bank_login_exposed", c, ["guidance_bank_verification", "guidance_credential_compromise"], false),
  },
  {
    id: "code_given",
    when: (c) => did(c, "shared_code") && poses(c, "bank"),
    then: (c) => bankIncident("code_given", c, ["guidance_one_time_codes", "guidance_bank_verification"], false),
  },
  {
    id: "non_bank_code_given",
    when: (c) => did(c, "shared_code"),
    then: (c) => outcome(
      "non_bank_code_given", "change_password_and_enable_mfa", "incident_occurred", "high", "immediate",
      ["change_password", "review_sessions", "dont_share_codes"],
      ["guidance_one_time_codes", "guidance_credential_compromise"],
      { destination: person(c, "security_specialist"), rescue: true },
    ),
  },
  {
    id: "account_password_exposed",
    when: (c) => did(c, "entered_login"),
    then: (c) =>
      outcome(
        "account_password_exposed",
        "change_password_and_enable_mfa",
        "incident_occurred",
        "high",
        "immediate",
        c.audience === "small_business"
          ? ["change_password", "check_password_reuse", "review_sessions", "check_forwarding_rules"]
          : ["change_password", "check_password_reuse", "review_sessions"],
        ["guidance_credential_compromise", "guidance_password_reuse"],
        { rescue: true },
      ),
  },
  {
    id: "own_click",
    when: (c) =>
      did(c, "opened_link") &&
      (c.facts.selfInitiated === "yes" || c.facts.asksNothing === true) &&
      c.signals.linkVerdict !== "malicious" &&
      uncontradicted(c),
    then: () => explainBenign("own_click", ["guidance_legitimate_notifications", "guidance_proportionate_advice"]),
  },
  {
    // Anything the own_click rule didn't clear: the user may not have shared the message.
    id: "link_opened",
    when: (c) => did(c, "opened_link"),
    flips: ["card_details_entered"],
    then: (c) =>
      yes(c, "card_details_entered")
        ? bankIncident("card_exposed", c, ["guidance_card_details_entered", "guidance_report_to_police"], false)
        : outcome(
            "link_opened_nothing_entered",
            "do_not_interact_and_delete",
            "threat_in_progress",
            "low",
            "routine",
            ["delete_or_report_message", "dont_open_link"],
            ["guidance_link_opened_no_input", "guidance_proportionate_advice"],
          ),
  },
  {
    id: "approval_prompts",
    when: (c) => is(c, "approval_prompts"),
    then: (c) =>
      c.facts.selfInitiated === "yes"
        ? explainBenign("own_approval_prompt", ["guidance_mfa_fatigue", "guidance_proportionate_advice"])
        : outcome(
            "approval_prompt_attack",
            "change_password_and_enable_mfa",
            "threat_in_progress",
            "critical",
            "immediate",
            ["dont_approve_prompts", "change_password", "review_sessions"],
            ["guidance_mfa_fatigue"],
            { rescue: true },
          ),
  },
  {
    id: "unknown_login",
    when: (c) => is(c, "unknown_login"),
    flips: ["self_initiated"],
    then: (c) =>
      yes(c, "self_initiated")
        ? outcome(
            "own_login",
            "change_password_and_enable_mfa",
            "threat_in_progress",
            "low",
            "routine",
            ["review_sessions"],
            ["guidance_unknown_login"],
            { wantsSignals: ["operator_account.recent_logins"] },
          )
        : outcome(
            "unknown_login",
            "change_password_and_enable_mfa",
            "incident_occurred",
            "high",
            "immediate",
            ["change_password", "review_sessions", "check_password_reuse"],
            ["guidance_unknown_login", "guidance_password_reuse"],
            { rescue: true, wantsSignals: ["operator_account.recent_logins"] },
          ),
  },
  {
    id: "breach_email_only",
    when: (c) =>
      is(c, "data_breach_notice") && c.facts.dataExposed.includes("email_only") && !c.facts.dataExposed.includes("password"),
    then: () => explainBenign("breach_email_only", ["guidance_breach_response", "guidance_proportionate_advice"], "low"),
  },
  {
    id: "fake_breach_notice",
    when: (c) => is(c, "data_breach_notice") && asks(c, "login") && c.signals.hasLink,
    then: () =>
      outcome(
        "fake_breach_notice",
        "verify_via_official_channel",
        "threat_in_progress",
        "medium",
        "routine",
        ["dont_open_link", "verify_official_channel"],
        ["guidance_fake_breach_notice", "guidance_smishing_basics", "guidance_prompt_injection"],
      ),
  },
  {
    id: "breach_password",
    when: (c) => is(c, "data_breach_notice"),
    then: () =>
      outcome(
        "breach_password",
        "change_password_and_enable_mfa",
        "incident_occurred",
        "high",
        "today",
        ["change_password", "check_password_reuse"],
        ["guidance_breach_response", "guidance_password_reuse"],
        { rescue: true },
      ),
  },
  {
    id: "unrequested_reset",
    when: (c) => is(c, "unrequested_reset"),
    then: () =>
      outcome(
        "unrequested_reset",
        "verify_via_official_channel",
        "needs_verification",
        "low",
        "routine",
        ["dont_open_link", "verify_official_channel"],
        ["guidance_unrequested_reset"],
      ),
  },
  {
    id: "router_or_network",
    when: (c) => is(c, "router_or_network"),
    then: () =>
      outcome(
        "router_or_network",
        "change_password_and_enable_mfa",
        "threat_in_progress",
        "high",
        "today",
        ["secure_router", "change_password", "review_sessions"],
        ["guidance_router_security"],
      ),
  },
  {
    id: "own_payment_change",
    when: (c) => is(c, "payment_detail_change") && c.facts.selfInitiated === "yes" && uncontradicted(c),
    then: () => explainBenign("own_payment_change", ["guidance_legitimate_notifications", "guidance_proportionate_advice"]),
  },
  {
    id: "payment_verified",
    when: (c) => is(c, "payment_detail_change") && c.facts.independentlyVerified === true && c.facts.selfInitiated !== "no",
    then: () => explainBenign("payment_verified", ["guidance_payment_verification", "guidance_invoice_fraud"], "low"),
  },
  {
    id: "payment_pressure",
    when: (c) =>
      (is(c, "payment_request") && colleagueDemand(c)) || (is(c, "payment_detail_change") && poses(c, "ceo")),
    flips: ["payment_status"],
    then: (c) =>
      yes(c, "payment_status")
        ? {
            ...bankIncident(
              "payment_sent",
              c,
              ["guidance_ceo_fraud", "guidance_invoice_fraud", "guidance_report_to_police"],
              true,
              ["verify_out_of_band", "report_police"],
            ),
            destination: person(c, "security_specialist"),
          }
        : outcome(
            "payment_held",
            "verify_via_official_channel",
            "threat_in_progress",
            "high",
            "today",
            ["dont_pay_or_transfer", "verify_out_of_band", "two_person_approval"],
            ["guidance_ceo_fraud", "guidance_payment_verification"],
          ),
  },
  {
    id: "payment_detail_change",
    when: (c) => is(c, "payment_detail_change"),
    then: () =>
      outcome(
        "payment_detail_change",
        "verify_via_official_channel",
        "threat_in_progress",
        "high",
        "today",
        ["dont_pay_or_transfer", "verify_out_of_band", "two_person_approval"],
        ["guidance_invoice_fraud", "guidance_payment_verification"],
      ),
  },
  {
    id: "call_ended",
    when: (c) =>
      is(c, "phone_call") &&
      c.facts.userAlreadyDid.includes("nothing") &&
      c.facts.asksNothing !== true &&
      c.facts.asksFor.length === 0 &&
      !poses(c, "bank"),
    then: () =>
      outcome(
        "call_ended",
        "do_not_interact_and_delete",
        "threat_in_progress",
        "low",
        "routine",
        ["hang_up_dont_call_back"],
        ["guidance_tech_support_fraud"],
      ),
  },
  {
    id: "bank_code_call",
    when: (c) => is(c, "phone_call") && poses(c, "bank") && (asks(c, "code") || asks(c, "login") || asks(c, "card")),
    flips: ["code_shared"],
    then: (c) =>
      yes(c, "code_shared")
        ? bankIncident(
            "bank_code_given",
            c,
            ["guidance_bank_impostor_call", "guidance_one_time_codes", "guidance_report_to_police"],
            true,
          )
        : outcome(
            "bank_call_refused",
            "verify_via_official_channel",
            "threat_in_progress",
            "high",
            "today",
            ["verify_official_channel", "hang_up_dont_call_back", "dont_share_codes"],
            ["guidance_bank_impostor_call", "guidance_spam_flag_meaning"],
          ),
  },
  {
    id: "risky_call",
    when: (c) =>
      is(c, "phone_call") && (c.facts.asksFor.length > 0 || c.facts.pressureOrSecrecy === true),
    then: () =>
      outcome(
        "risky_call",
        "verify_via_official_channel",
        "threat_in_progress",
        "high",
        "today",
        ["verify_official_channel", "hang_up_dont_call_back", "dont_share_codes", "dont_pay_or_transfer"],
        ["guidance_merchant_fraud", "guidance_remote_access"],
      ),
  },
  {
    id: "bank_contact_call",
    when: (c) => is(c, "phone_call") && poses(c, "bank"),
    then: () =>
      outcome(
        "bank_contact_call",
        "verify_via_official_channel",
        "needs_verification",
        "low",
        "today",
        ["verify_official_channel", "dont_share_codes"],
        ["guidance_bank_verification", "guidance_spam_flag_meaning"],
      ),
  },
  {
    id: "missed_foreign_call",
    when: (c) => is(c, "missed_call"),
    then: () =>
      outcome(
        "missed_foreign_call",
        "do_not_interact_and_delete",
        "threat_in_progress",
        "low",
        "routine",
        ["hang_up_dont_call_back"],
        ["guidance_wangiri"],
      ),
  },
  {
    id: "warned_call",
    when: (c) => is(c, "phone_call") && warnedCall(c),
    then: () =>
      outcome(
        "warned_call",
        "do_not_interact_and_delete",
        "threat_in_progress",
        "low",
        "routine",
        ["hang_up_dont_call_back"],
        ["guidance_spam_flag_meaning", "guidance_tech_support_fraud"],
      ),
  },
  {
    id: "family_request",
    when: (c) => poses(c, "family") && c.facts.asksFor.length > 0,
    then: () =>
      outcome(
        "family_request",
        "verify_via_official_channel",
        "threat_in_progress",
        "high",
        "today",
        ["dont_pay_or_transfer", "verify_out_of_band", "dont_reply"],
        ["guidance_family_new_number", "guidance_voice_clone"],
      ),
  },
  {
    id: "work_login_lure",
    when: (c) => asks(c, "login") && c.audience === "small_business" && !poses(c, "bank"),
    flips: ["credentials_entered"],
    then: (c) =>
      yes(c, "credentials_entered")
        ? outcome(
            "account_password_exposed",
            "change_password_and_enable_mfa",
            "incident_occurred",
            "high",
            "immediate",
            ["change_password", "check_password_reuse", "review_sessions", "check_forwarding_rules"],
            ["guidance_business_email_compromise", "guidance_credential_compromise"],
            { rescue: true },
          )
        : outcome(
            "credential_lure",
            "verify_via_official_channel",
            "threat_in_progress",
            "high",
            "today",
            ["dont_open_link", "verify_official_channel", "delete_or_report_message"],
            ["guidance_smishing_basics", "guidance_prompt_injection"],
          ),
  },
  {
    id: "credential_lure",
    when: (c) => asks(c, "login") || asks(c, "code") || (c.facts.asksFor.length > 0 && poses(c, "bank")),
    then: () =>
      outcome(
        "credential_lure",
        "verify_via_official_channel",
        "threat_in_progress",
        "high",
        "today",
        ["dont_open_link", "verify_official_channel", "delete_or_report_message"],
        ["guidance_bank_verification", "guidance_sender_id_spoofing", "guidance_prompt_injection"],
      ),
  },
  {
    id: "known_service_payment_lure",
    when: (c) =>
      (poses(c, "operator") || poses(c, "support")) && (asks(c, "money") || asks(c, "card")),
    then: (c) =>
      outcome(
        "known_service_payment_lure",
        "verify_via_official_channel",
        "threat_in_progress",
        poses(c, "operator") ? "high" : "medium",
        poses(c, "operator") ? "today" : "routine",
        ["dont_open_link", "dont_pay_or_transfer", "verify_official_channel"],
        ["guidance_operator_impersonation", "guidance_smishing_basics", "guidance_prompt_injection"],
      ),
  },
  {
    id: "payment_lure",
    when: (c) => asks(c, "money") || asks(c, "card") || asks(c, "app_install") || asks(c, "remote_access"),
    then: () =>
      outcome(
        "payment_lure",
        "do_not_interact_and_delete",
        "threat_in_progress",
        "medium",
        "routine",
        ["dont_open_link", "dont_pay_or_transfer", "delete_or_report_message"],
        ["guidance_parcel_scam", "guidance_smishing_basics", "guidance_prompt_injection"],
      ),
  },
  {
    id: "flagged_link",
    when: (c) => badLink(c),
    then: () =>
      outcome(
        "flagged_link",
        "do_not_interact_and_delete",
        "threat_in_progress",
        "medium",
        "routine",
        ["dont_open_link", "delete_or_report_message"],
        ["guidance_smishing_basics", "guidance_prompt_injection"],
      ),
  },
  {
    // Safe needs positive evidence. Finding nothing risky is not evidence of safety:
    // a clean link check or an unreadable message must fall through to unclear.
    id: "looks_genuine",
    when: (c) => uncontradicted(c) && (c.facts.asksNothing === true || c.facts.selfInitiated === "yes"),
    then: () => explainBenign("looks_genuine", ["guidance_legitimate_notifications", "guidance_proportionate_advice"]),
  },
  {
    id: "unclear",
    when: () => true,
    then: () =>
      outcome(
        "unclear",
        "verify_via_official_channel",
        "needs_verification",
        "medium",
        "today",
        ["verify_official_channel", "dont_open_link", "dont_share_codes"],
        ["guidance_asking_for_evidence", "guidance_handing_off"],
      ),
  },
];

export function matchSituation(item: Case): Situation {
  const match = SITUATIONS.find((situation) => situation.when(item));
  if (!match) throw new Error("unclear must match every case");
  return match;
}
