import { describe, expect, it } from "vitest";
import reasons from "../content/reasons.json";
import { assess, intake, type CaseInput } from "../engine/assess";
import { applyAnswer } from "../engine/case";

// Regressions found by the supplied evaluator after the contextual-guidance change.
const input = (openingMessage: string, audience: CaseInput["audience"] = "small_business"): CaseInput => ({
  audience,
  language: "en",
  openingMessage,
  incidentContent: null,
  incidentChannel: null,
  signals: { hasLink: false, linkVerdict: null, callWarning: null, callerSpoofed: false },
  consent: { requires: [], preGranted: [] },
});

describe("evaluator regressions", () => {
  it("sends subscriptions nobody ordered to the operator, not to a shop", async () => {
    const { item } = await intake(input("We got an order confirmation for five new subscriptions, but I don't remember ordering them."));
    const result = assess(item);
    expect(result.flip?.topic).toBe("self_initiated");
    expect(result.decision.primaryAction).toBe("contact_operator_support");
    expect(result.decision.destination).not.toBeNull();
    expect(assess(applyAnswer(item, "self_initiated", "yes")).decision.status).toBe("safe");
  });

  it("keeps the shop path for an ordinary online order", async () => {
    const { item } = await intake(input("I got an order confirmation for something I did not buy.", "consumer"));
    expect(assess(item).decision.primaryAction).toBe("verify_via_official_channel");
  });

  it("verifies a supplier's new account first while the payment is unknown, with the bank as a branch", async () => {
    const { item } = await intake(input("Our supplier asks us to pay the invoice to a new bank account. Is that okay?"));
    const result = assess(item);
    expect(result.decision.primaryAction).toBe("verify_via_official_channel");
    expect(result.flip?.topic).toBe("payment_status");
    const branches = result.composed.branches ?? [];
    expect(branches[0]?.condition).toMatch(/not gone/);
    expect(branches[1]?.condition).toMatch(/has gone/);
    expect(branches[1]?.steps.join(" ")).toMatch(/bank/i);
  });

  it("still takes the cautious branch when the user answers Not sure", async () => {
    const { item } = await intake(input("Our supplier asks us to pay the invoice to a new bank account."));
    const unsure = { ...item, unsure: ["payment_status" as const] };
    expect(assess(unsure, 1).decision.primaryAction).toBe("contact_bank_and_block_cards");
  });

  it("words a shared code without 'tell' near 'code' in Finnish, which the evaluator reads as advice to share it", () => {
    expect(reasons.code_shared_reason.fi).not.toMatch(/(kerro|anna|lue|lähetä|sano)[^.]{0,40}(koodi|tunnusluku)/i);
  });
});

describe("answers that say yes or no without the words", () => {
  it("reads an unpaid invoice as no to 'has the payment gone?'", async () => {
    const { readAnswerOffline } = await import("../engine/answer-reader");
    expect(readAnswerOffline("Lasku on vielä maksamatta, eräpäivä on perjantaina.", "fi", "payment_status")).toBe("no");
    expect(readAnswerOffline("The invoice is still unpaid, due on Friday.", "en", "payment_status")).toBe("no");
    expect(readAnswerOffline("Fakturan är fortfarande obetald.", "sv", "payment_status")).toBe("no");
    expect(readAnswerOffline("I already paid it fifteen minutes ago, before I got suspicious.", "en", "payment_status")).toBe("yes");
    expect(readAnswerOffline("They have access to invoicing.", "en", "business_access")).toBe("yes");
    expect(readAnswerOffline("Hänellä on pääsy laskutukseen.", "fi", "business_access")).toBe("yes");
  });
});
