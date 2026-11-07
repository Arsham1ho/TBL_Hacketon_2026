import { describe, expect, it } from "vitest";
import { assess, intake } from "../engine/assess";
import { likelyCategory } from "../engine/incident-category";

async function classify(message: string, audience: "consumer" | "small_business" = "consumer") {
  const { item } = await intake({
    audience, language: "en", openingMessage: message, incidentContent: null,
    incidentChannel: null,
    signals: { hasLink: false, linkVerdict: null, callWarning: null, callerSpoofed: false },
    consent: { requires: [], preGranted: [] },
  });
  const result = assess(item);
  return { situation: result.outcome.situation, title: likelyCategory(item, result.outcome, result.decision.status)?.title ?? null };
}

describe("scam type detection follows the established situation", () => {
  it.each([
    ["I received a suspicious attachment but did not open it.", "Suspicious attachment"],
    ["I clicked a suspicious link but entered no details.", "Suspicious link"],
    ["I got a password reset email that I did not request.", "Unrequested password reset"],
    ["I got an alert about an unfamiliar login from another city. It was not me.", "Unfamiliar sign-in"],
    ["I received a notice about a data breach but I do not know what was exposed.", "Unverified breach notice"],
    ["The notice says my password was exposed in a breach.", "Exposed sign-in details"],
    ["My router has an unknown device connected.", "Router or network concern"],
  ])("classifies %s as %s", async (message, title) => {
    expect((await classify(message)).title).toBe(title);
  });

  it("names former staff access without claiming payment fraud", async () => {
    expect((await classify("A former employee still has access to our admin account.", "small_business")).title).toBe("Former staff access");
  });

  it("names a supplier bank detail change before the invoice is paid", async () => {
    expect((await classify("A supplier emailed new bank details for an invoice. We have not paid yet.", "small_business")).title).toBe("Supplier payment change");
  });
});
