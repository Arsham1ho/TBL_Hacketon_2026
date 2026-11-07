import { describe, expect, it } from "vitest";
import { contextualQuestion } from "../engine/contextual-question";
import { assess, intake, type CaseInput } from "../engine/assess";
import { applyAnswer } from "../engine/case";
import { handleEvent } from "../engine/handle-event";
import { acceptablePhrasing, questionGrounded } from "../adapters/llm";

const input = (openingMessage: string): CaseInput => ({ audience: "consumer", language: "en", openingMessage, incidentContent: null, incidentChannel: null, signals: { hasLink: false, linkVerdict: null, callWarning: null, callerSpoofed: false }, consent: { requires: [], preGranted: [] } });

describe("specific questions", () => {
  it("asks about the order in the confirmation", async () => {
    const flow = await handleEvent("test", null, { kind: "start", input: input("I got an order confirmation for something I did not buy."), sentToLlm: false });
    expect(flow.response.screen).toMatchObject({ type: "flip", question: "Did you place the order described in the confirmation yourself?" });
  });

  it("asks if the code was actually shared with the caller", async () => {
    const { item } = await intake(input("A bank caller asked for my code."));
    expect(contextualQuestion("code_shared", item)).toBe("Did you read the code to the caller or send it to them?");
    expect(acceptablePhrasing("Did the caller request your code?", "code_shared")).toBe(false);
  });

  it("asks if the caller was allowed to control the device", async () => {
    const { item } = await intake(input("A caller asked for remote access to my computer."));
    expect(contextualQuestion("remote_access_given", item)).toBe("Did you let the caller connect to or control your device?");
    expect(acceptablePhrasing("Did the caller request remote access?", "remote_access_given")).toBe(false);
  });

  it("asks whether a supplier payment was sent and routes the answers differently", async () => {
    const { item } = await intake(input("Our supplier says their bank account number changed to a new account."));
    expect(assess(item).flip?.topic).toBe("payment_status");
    expect(contextualQuestion("payment_status", item)).toContain("payment already been sent");
    expect(assess(applyAnswer(item, "payment_status", "yes")).decision.primaryAction).toBe("contact_bank_and_block_cards");
    expect(assess(applyAnswer(item, "payment_status", "no")).decision.primaryAction).toBe("verify_via_official_channel");
  });

  it("rejects an invented institution in model wording", () => {
    expect(questionGrounded("Did you share your bank code with the caller?", "A caller asked for my code.")).toBe(false);
    expect(questionGrounded("Did you share the code with the caller?", "A caller asked for my code.")).toBe(true);
  });
});
