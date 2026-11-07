import { describe, expect, it } from "vitest";
import { conflictingTopics, mergeFacts } from "../engine/fact-validator";
import { topicValue, applyAnswer, type Case } from "../engine/case";
import { caseConfidence } from "../engine/summary";
import { blankFacts } from "./helpers";
import { assess, intake } from "../engine/assess";

const base: Case = { audience: "consumer", language: "en", facts: blankFacts, answers: {}, unsure: [], signals: { hasLink: false, linkVerdict: null, callWarning: null, callerSpoofed: false }, pregrantedSignals: [], availableSignals: [] };

describe("extractor conflicts", () => {
  it("preserves conflicting initiation claims as unknown until answered", () => {
    const primary = { ...blankFacts, selfInitiated: "yes" as const };
    const backstop = { ...blankFacts, selfInitiated: "no" as const };
    const item = { ...base, facts: mergeFacts(primary, backstop), conflicts: conflictingTopics(primary, backstop) };
    expect(item.conflicts).toEqual(["self_initiated"]);
    expect(topicValue(item, "self_initiated")).toBeNull();
    expect(topicValue(applyAnswer(item, "self_initiated", "no"), "self_initiated")).toBe("no");
  });

  it("does not treat an unknown reading as a contradiction", () => {
    expect(conflictingTopics(blankFacts, { ...blankFacts, serviceLost: true })).toEqual([]);
  });

  it("reduces confidence while the conflict is unresolved", () => {
    const item = { ...base, conflicts: ["self_initiated" as const] };
    expect(caseConfidence(item, 0, false)).toBeLessThan(caseConfidence(base, 0, false));
  });

  it("keeps live danger when the readers disagree about timing", () => {
    expect(mergeFacts({ ...blankFacts, happeningNow: false }, { ...blankFacts, happeningNow: true }).happeningNow).toBe(true);
  });

  it("asks rather than declaring an opposing login reading safe", async () => {
    const { item } = await intake({ audience: "consumer", language: "en", openingMessage: "I did not request this login.", incidentContent: null, incidentChannel: null, signals: base.signals, consent: { requires: [], preGranted: [] } }, () => ({ ...blankFacts, incidentType: "unknown_login", selfInitiated: "yes", evidence: [{ fact: "incidentType", quote: "this login" }, { fact: "selfInitiated", quote: "I did not request this login" }] }));
    expect(item.conflicts).toContain("self_initiated");
    expect(assess(item).flip?.topic).toBe("self_initiated");
    expect(assess(item).decision.status).not.toBe("safe");
  });
});
