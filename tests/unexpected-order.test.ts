import { describe, expect, it } from "vitest";
import { assess, intake, type CaseInput } from "../engine/assess";
import { applyAnswer } from "../engine/case";
import { handleEvent } from "../engine/handle-event";

const input = (openingMessage: string): CaseInput => ({
  audience: "consumer", language: "en", openingMessage, incidentContent: null, incidentChannel: null,
  signals: { hasLink: false, linkVerdict: null, callWarning: null, callerSpoofed: false },
  consent: { requires: [], preGranted: [] },
});

describe("unexpected order advice", () => {
  it("checks the retailer rather than claiming a SIM takeover", async () => {
    const start = await handleEvent("test", null, { kind: "start", input: input("I got an order confirmation for something I did not buy"), sentToLlm: false });
    expect(start.response.screen).toMatchObject({ type: "flip", topic: "self_initiated" });
    const next = await handleEvent("test", start.journey, { kind: "answer", topic: "self_initiated", answer: "no" });
    const result = assess(next.journey!.item);
    expect(result.decision).toMatchObject({ primaryAction: "verify_via_official_channel", status: "needs_verification", risk: "medium" });
    expect(result.outcome.steps).toContain("check_unexpected_order");
    expect(result.outcome.steps).toContain("check_order_charges");
    expect(result.outcome.steps).not.toContain("lock_subscription");
    expect(JSON.stringify(result.composed)).not.toMatch(/lock your SIM|critical/i);
  });

  it("keeps the unknown order conditional when the user is unsure", async () => {
    const { item } = await intake(input("I got an order confirmation"));
    const result = assess(applyAnswer(item, "self_initiated", "unsure"), 1);
    expect(result.decision.status).not.toBe("safe");
    expect(result.outcome.steps).not.toContain("lock_subscription");
  });

  it("still prioritises exposed card details", async () => {
    const { item } = await intake(input("I received an order confirmation and entered my card details on its link."));
    expect(assess(item).decision.primaryAction).toBe("contact_bank_and_block_cards");
  });
});
