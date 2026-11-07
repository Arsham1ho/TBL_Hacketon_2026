import { describe, expect, it } from "vitest";
import { assess, intake, type CaseInput } from "../engine/assess";

const check = async (message: string, audience: CaseInput["audience"] = "consumer") => {
  const { item } = await intake({ audience, language: "en", openingMessage: message, incidentContent: null, incidentChannel: null, signals: { hasLink: false, linkVerdict: null, callWarning: null, callerSpoofed: false }, consent: { requires: [], preGranted: [] } });
  return assess(item);
};

describe("new scenario regressions", () => {
  it("does not send a WhatsApp verification-code takeover to a bank", async () => {
    const result = await check("Someone asked me for my WhatsApp code and I gave it to them.");
    expect(result.decision.primaryAction).not.toBe("contact_bank_and_block_cards");
    expect(result.decision.externalContacts).not.toContain("bank");
  });

  it("does not tell a business to change a password over an unfamiliar domain invoice", async () => {
    const result = await check("We got an invoice to renew our domain name from a company we don't know.", "small_business");
    expect(result.decision.primaryAction).not.toBe("change_password_and_enable_mfa");
  });

  it("routes an unrequested number transfer to the operator", async () => {
    const result = await check("My number is being transferred to another operator. I did not request it.");
    expect(result.decision.primaryAction).toBe("contact_operator_support");
  });

  it("does not mark a pressured gift card request safe", async () => {
    const result = await check("My boss asked me to buy gift cards for him immediately.", "small_business");
    expect(result.decision.status).not.toBe("safe");
  });

  it("does not mark a romance payment request safe", async () => {
    const result = await check("A person I met online wants me to send money to them urgently.");
    expect(result.decision.status).not.toBe("safe");
  });
});
