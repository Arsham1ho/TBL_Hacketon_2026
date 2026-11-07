import { describe, expect, it } from "vitest";
import { assess, intake, type CaseInput } from "../engine/assess";
import { applyAnswer } from "../engine/case";
import { reasonText } from "../engine/composer";

const input = (openingMessage: string): CaseInput => ({ audience: "consumer", language: "en", openingMessage, incidentContent: null, incidentChannel: null, signals: { hasLink: false, linkVerdict: null, callWarning: null, callerSpoofed: false }, consent: { requires: [], preGranted: [] } });

describe("contextual guidance", () => {
  it("explains confirmed card exposure and provides a specific bank step", async () => {
    const { item } = await intake(input("I entered my card details on a parcel fee page."));
    const result = assess(item);
    expect(result.outcome.situation).toBe("card_exposed");
    expect(result.composed.steps[0]).toContain("Tell them you entered your card details");
    expect(reasonText(result.outcome, "en", "consumer", item)).toContain("You said you entered card details");
  });

  it("does not assert a payment when the person is unsure", async () => {
    const { item } = await intake(input("Someone asked me to send money."));
    const unsure = applyAnswer(item, "money_transferred", "unsure");
    expect(assess(unsure, 1).composed.adviceText).not.toContain("You said money was sent");
  });
});
