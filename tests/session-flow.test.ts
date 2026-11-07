import { describe, expect, it } from "vitest";
import { fastDanger } from "../engine/fast-danger";
import { handleEvent } from "../engine/handle-event";
import { safeScreen } from "../engine/output-guard";
import type { CaseInput } from "../engine/assess";

const input = (message: string, language: CaseInput["language"] = "en"): CaseInput => ({
  audience: "consumer", language, openingMessage: message, incidentContent: null, incidentChannel: null,
  signals: { hasLink: false, linkVerdict: null, callWarning: null, callerSpoofed: false },
  consent: { requires: [], preGranted: [] },
});

describe("session flow", () => {
  it.each([
    ["The bank is on the phone right now asking for my code", "en"],
    ["Pankki on linjalla juuri nyt ja pyytää koodia", "fi"],
    ["Banken är fortfarande på linjen just nu och ber om koden", "sv"],
  ] as const)("pauses live code requests in %s", (message, language) => {
    expect(fastDanger(message)).toBe("code");
  });

  it("returns a stop screen and can continue", async () => {
    const started = await handleEvent("test", null, { kind: "start", input: input("The bank is on the phone right now asking for my code"), sentToLlm: false });
    expect(started.response.screen.type).toBe("stop");
    const continued = await handleEvent("test", started.journey, { kind: "continue" });
    expect(continued.response.screen.type).not.toBe("stop");
  });

  it("rejects an answer to a question not asked", async () => {
    const started = await handleEvent("test", null, { kind: "start", input: input("help"), sentToLlm: false });
    await expect(handleEvent("test", started.journey, { kind: "answer", topic: "card_details_entered", answer: "yes" })).rejects.toThrow("invalid_event_order");
  });

  it("blocks unsafe output", () => {
    expect(safeScreen({ type: "end", message: "This is guaranteed safe" })).toBe(false);
  });

  it("rejects a wrong-language stop screen", () => {
    expect(safeScreen({ type: "stop", message: "Stop. Don't read out or type any code.", actions: ["End the call now. No bank, authority or operator will ask you to read out a code."] }, "fi")).toBe(false);
  });

  it("does not access an optional signal after refusal", async () => {
    const started = await handleEvent("test", null, { kind: "start", input: { ...input("My number is being transferred to another operator. I did not request it."), consent: { requires: ["subscription.recent_events"], preGranted: [] } }, sentToLlm: false });
    let journey = started.journey!;
    let screen = started.response.screen;
    if (screen.type === "flip") {
      const answered = await handleEvent("test", journey, { kind: "answer", topic: screen.topic, answer: "no" });
      journey = answered.journey!;
      screen = answered.response.screen;
    }
    expect(screen.type).toBe("unlock");
    if (screen.type === "unlock") {
      const refused = await handleEvent("test", journey, { kind: "consent", signal: screen.signal, granted: false });
      expect(refused.response.dataReceipt.refused).toContain(screen.signal);
      expect(refused.response.dataReceipt.used).not.toContain(screen.signal);
    }
  });

  it("blocks an out-of-order rescue event", async () => {
    const started = await handleEvent("test", null, { kind: "start", input: input("help"), sentToLlm: false });
    await expect(handleEvent("test", started.journey, { kind: "rescue", stepId: "0", outcome: "done" })).rejects.toThrow("invalid_event_order");
  });

  it("advances recovery one step at a time and requires handoff review", async () => {
    let flow = await handleEvent("test", null, { kind: "start", input: input("Someone asked for my WhatsApp code and I gave the code to them."), sentToLlm: false });
    expect(flow.response.screen.type).toBe("rescue");
    while (flow.response.screen.type === "rescue") {
      flow = await handleEvent("test", flow.journey, { kind: "rescue", stepId: flow.response.screen.step.id, outcome: "done" });
    }
    expect(flow.response.screen.type).toBe("handoff");
    flow = await handleEvent("test", flow.journey, { kind: "handoff", approved: false });
    expect(flow.response.screen.type).toBe("result");
  });
});
