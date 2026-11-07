import { describe, expect, it } from "vitest";
import { intake, assess, type CaseInput } from "../engine/assess";
import { detectManipulationCues } from "../engine/manipulation";
import { present, type Journey } from "../engine/handle-event";
import { reasonText } from "../engine/composer";

const input = (message: string, incidentContent: string | null = null): CaseInput => ({
  audience: "consumer", language: "en", openingMessage: message, incidentContent,
  incidentChannel: null,
  signals: { hasLink: false, linkVerdict: null, callWarning: null, callerSpoofed: false },
  consent: { requires: [], preGranted: [] },
});

describe("manipulation cues", () => {
  it("quotes observable cues and explains a new-number money request", async () => {
    const { item } = await intake(input("Is this message real?", "Mom, I lost my phone. This is my new number. Send me 50 bucks now."));
    expect(item.facts.asksFor).toContain("money");
    expect(item.manipulationCues?.map(cue => cue.kind)).toEqual(expect.arrayContaining(["relationship", "channel_change", "urgency"]));
    expect(assess(item).decision.primaryAction).toBe("verify_via_official_channel");
    const journey: Journey = { item, asked: 0, secretFound: false, sentToLlm: false, stopSeen: true, consent: {}, used: [], rescueIndex: 0, rescueOutcomes: {}, handoffDone: true, handoffApproved: false, demoScenario: "none" };
    const screen = present("test", journey).screen;
    expect(screen.type).toBe("result");
    if (screen.type === "result") expect(screen.reason).toContain("not proof of fraud");
  });

  it("does not turn urgency alone into a manipulation explanation", async () => {
    const { item } = await intake(input("I booked support for today in the official app, and the appointment is urgent."));
    expect(item.manipulationCues?.map(cue => cue.kind)).toContain("urgency");
    expect(reasonText(assess(item).outcome, item.language, item.audience, item)).not.toContain("not proof of fraud");
  });

  it("keeps each cue anchored to exact source wording", () => {
    const source = "Please keep this secret and pay today.";
    expect(detectManipulationCues(source).every(cue => source.includes(cue.quote))).toBe(true);
  });

  it.each([
    ["authority", "The bank says I must respond."],
    ["fear", "Your account will be locked."],
    ["secrecy", "Don't tell anyone about this transfer."],
    ["scarcity", "Only 2 spots left."],
    ["reward", "You have won a free gift."],
    ["social_proof", "Everyone has already done it."],
    ["guilt", "If you really love me, send it."],
    ["verification_pretext", "Send me the security code to verify your account."],
    ["scarcity", "Viimeinen mahdollisuus."],
    ["reward", "Du har vunnit ett pris."],
    ["secrecy", "Älä kerro kenellekään."],
  ])("detects %s from '%s'", (kind, source) => {
    const cue = detectManipulationCues(source).find(cue => cue.kind === kind);
    expect(cue).toBeDefined();
    expect(source.includes(cue!.quote)).toBe(true);
  });

  it.each([
    "The bank appointment is today in my official app.",
    "My daughter sent a birthday message.",
    "Our supplier confirmed the meeting is urgent.",
  ])("does not turn ordinary context into a manipulation explanation: %s", async source => {
    const { item } = await intake(input(source));
    expect(reasonText(assess(item).outcome, item.language, item.audience, item)).not.toContain("not proof of fraud");
  });
});
