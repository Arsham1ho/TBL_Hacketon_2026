import { describe, expect, it } from "vitest";
import { assess, intake, type CaseInput } from "../engine/assess";
import { radarMatch, RADAR_PATTERNS } from "../engine/scam-radar";
import { present, type Journey } from "../engine/handle-event";

const read = async (message: string, audience: CaseInput["audience"] = "consumer", incidentContent: string | null = null) => (await intake({
  audience, language: "en", openingMessage: message, incidentContent, incidentChannel: null,
  signals: { hasLink: false, linkVerdict: null, callWarning: null, callerSpoofed: false },
  consent: { requires: [], preGranted: [] },
})).item;

describe("synthetic scam radar", () => {
  it("matches a family new-number request without changing the safety decision", async () => {
    const item = await read("Is this real?", "consumer", "Mom, I lost my phone. This is my new number. Send me 50 bucks now.");
    expect(radarMatch(item)?.id).toBe("family_new_number");
    const withRadar = assess(item).decision;
    const withoutMatch = assess({ ...item, manipulationCues: [] }).decision;
    expect(withRadar).toEqual(withoutMatch);
    const journey: Journey = { item, asked: 0, secretFound: false, sentToLlm: false, stopSeen: true, consent: {}, used: [], rescueIndex: 0, rescueOutcomes: {}, handoffDone: true, handoffApproved: false, demoScenario: "none" };
    expect(present("demo", journey).radar).toEqual({ id: "family_new_number", title: "Family member, new number", clue: "A relative claims a new number and asks for money." });
  });

  it("matches a claimed bank code request", async () => {
    const item = await read("A caller says they are from my bank and asks me for the SMS code.");
    expect(radarMatch(item)?.id).toBe("bank_code");
  });

  it("does not match a legitimate bank appointment or a family greeting", async () => {
    expect(radarMatch(await read("I booked a bank appointment today in the official app."))).toBeNull();
    expect(radarMatch(await read("My daughter sent me a birthday greeting."))).toBeNull();
  });

  it("only shows a business pattern to a business audience", () => {
    expect(RADAR_PATTERNS.filter(pattern => pattern.audience === "small_business")).toHaveLength(1);
    expect(RADAR_PATTERNS.every(pattern => pattern.title.en && pattern.title.fi && pattern.title.sv)).toBe(true);
  });
});
