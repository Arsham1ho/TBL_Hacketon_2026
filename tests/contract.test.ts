import { describe, expect, it } from "vitest";
import { ACTION_CONTRACT, checkDecision } from "../engine/contract";
import { computeConfidence, confidenceBand } from "../engine/confidence";
import { Decision, Facts, PrimaryAction } from "../engine/types";
import { blankFacts } from "./helpers";

const decision = (overrides: Partial<Decision>): Decision => ({
  status: "needs_verification",
  risk: "medium",
  urgency: "today",
  primaryAction: "verify_via_official_channel",
  destination: null,
  externalContacts: [],
  unknownDecisiveFacts: [],
  rescue: false,
  ...overrides,
});

describe("action contract", () => {
  it.each(PrimaryAction.options)("maps %s to a status, risk and urgency", (action) => {
    const contract = ACTION_CONTRACT[action];
    expect(contract.statuses.length).toBeGreaterThan(0);
    expect(contract.risks.length).toBeGreaterThan(0);
    expect(contract.urgencies.length).toBeGreaterThan(0);
  });

  it("accepts a decision inside the contract", () => {
    expect(checkDecision(decision({}))).toEqual([]);
  });

  it("allows Safe only for no_action_needed", () => {
    for (const action of PrimaryAction.options) {
      const allowsSafe = ACTION_CONTRACT[action].statuses.includes("safe");
      expect(allowsSafe).toBe(action === "no_action_needed");
    }
  });

  it("refuses Safe while a decisive fact is unknown", () => {
    const problems = checkDecision(
      decision({
        status: "safe",
        risk: "none",
        urgency: "none",
        primaryAction: "no_action_needed",
        unknownDecisiveFacts: ["self_initiated"],
      }),
    );
    expect(problems).toContain("safe cannot have unknown decisive facts");
  });

  it("refuses a Safe case in Rescue Mode", () => {
    const problems = checkDecision(
      decision({ status: "safe", risk: "none", urgency: "none", primaryAction: "no_action_needed", rescue: true }),
    );
    expect(problems).toContain("safe cannot enter Rescue Mode");
  });

  it("refuses a human handoff the action does not allow", () => {
    expect(checkDecision(decision({ destination: "human_advisor" }))).not.toEqual([]);
  });

  it("requires the bank for card and payment incidents", () => {
    const base = { status: "incident_occurred", risk: "critical", urgency: "immediate" } as const;
    const action = "contact_bank_and_block_cards";
    expect(checkDecision(decision({ ...base, primaryAction: action }))).toContain(
      "contact_bank_and_block_cards must list the bank",
    );
    expect(checkDecision(decision({ ...base, primaryAction: action, externalContacts: ["bank"] }))).toEqual([]);
  });

  it("requires a person for escalate_to_human", () => {
    expect(checkDecision(decision({ primaryAction: "escalate_to_human" }))).toContain(
      "escalate_to_human needs a destination",
    );
  });

  it("refuses to send a Safe case to an outside contact", () => {
    const problems = checkDecision(
      decision({ status: "safe", risk: "none", urgency: "none", primaryAction: "no_action_needed", externalContacts: ["police"] }),
    );
    expect(problems).toContain("safe cannot send the user to an outside contact");
  });

  it("allows worst-case advice while a decisive fact is unknown", () => {
    const notSure = decision({
      risk: "high",
      urgency: "immediate",
      primaryAction: "contact_bank_and_block_cards",
      externalContacts: ["bank"],
      unknownDecisiveFacts: ["card_details_entered"],
    });
    expect(notSure.status).toBe("needs_verification");
    expect(checkDecision(notSure)).toEqual([]);
  });

  it.each(["change_password_and_enable_mfa", "isolate_device_and_scan", "contact_bank_and_block_cards"] as const)(
    "refuses %s under Needs verification with nothing unknown",
    (primaryAction) => {
      const problems = checkDecision(
        decision({ risk: "high", urgency: "today", primaryAction, externalContacts: ["bank"] }),
      );
      expect(problems).toContain(`${primaryAction} under needs_verification must name the unknown fact`);
    },
  );

  it("keeps risk and urgency independent", () => {
    const high = decision({ risk: "high", urgency: "routine" });
    expect(checkDecision(high)).toEqual([]);
  });
});

describe("facts boundary", () => {
  it("accepts unknown values", () => {
    expect(Facts.safeParse(blankFacts).success).toBe(true);
  });

  it.each(["risk", "primaryAction", "destination", "status"])("rejects an LLM-supplied %s", (field) => {
    expect(Facts.safeParse({ ...blankFacts, [field]: "critical" }).success).toBe(false);
  });
});

describe("confidence", () => {
  it("rises with confirmed facts", () => {
    const less = computeConfidence({ confirmedFacts: 1, unknownDecisiveFacts: 0, conflicts: 0 });
    const more = computeConfidence({ confirmedFacts: 3, unknownDecisiveFacts: 0, conflicts: 0 });
    expect(more).toBeGreaterThan(less);
  });

  it("falls with unknown decisive facts and conflicts", () => {
    const clear = computeConfidence({ confirmedFacts: 3, unknownDecisiveFacts: 0, conflicts: 0 });
    expect(computeConfidence({ confirmedFacts: 3, unknownDecisiveFacts: 1, conflicts: 0 })).toBeLessThan(clear);
    expect(computeConfidence({ confirmedFacts: 3, unknownDecisiveFacts: 0, conflicts: 1 })).toBeLessThan(clear);
  });

  it("stays low with no evidence", () => {
    expect(confidenceBand(computeConfidence({ confirmedFacts: 0, unknownDecisiveFacts: 0, conflicts: 0 }))).toBe("low");
    expect(confidenceBand(computeConfidence({ confirmedFacts: 0, unknownDecisiveFacts: 2, conflicts: 0 }))).toBe("low");
  });

  it("never claims certainty", () => {
    expect(computeConfidence({ confirmedFacts: 50, unknownDecisiveFacts: 0, conflicts: 0 })).toBeLessThan(1);
  });
});
