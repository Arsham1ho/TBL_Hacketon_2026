import { describe, expect, it } from "vitest";
import text from "../content/approved-text.json";
import { fallbackScreen, stopScreen } from "../engine/fallback";
import { interruptionFor, type InterruptionKind } from "../engine/interruption";
import { Language, Status, type Facts } from "../engine/types";
import { blankFacts } from "./helpers";

const facts = (overrides: Partial<Facts>): Facts => ({ ...blankFacts, ...overrides });

describe("interruption rule", () => {
  it("fires when a request is live", () => {
    expect(interruptionFor(facts({ happeningNow: true, asksFor: ["code"] }))).toBe("code");
  });

  it("stays quiet when the request is not live", () => {
    expect(interruptionFor(facts({ happeningNow: false, asksFor: ["code"] }))).toBeNull();
  });

  it("stays quiet when timing is unknown", () => {
    expect(interruptionFor(facts({ happeningNow: null, asksFor: ["money"] }))).toBeNull();
  });

  it("stays quiet when nothing risky is requested", () => {
    expect(interruptionFor(facts({ happeningNow: true }))).toBeNull();
  });

  it("puts the most dangerous request first", () => {
    expect(interruptionFor(facts({ happeningNow: true, asksFor: ["money", "remote_access"] }))).toBe("remote_access");
  });

  it("interrupts active ransomware and approval prompts", () => {
    expect(interruptionFor(facts({ happeningNow: true, incidentType: "ransomware" }))).toBe("ransomware");
    expect(interruptionFor(facts({ happeningNow: true, incidentType: "approval_prompts" }))).toBe("approval");
  });

  it("stays quiet on the user's own login prompt", () => {
    const result = interruptionFor(
      facts({ happeningNow: true, incidentType: "approval_prompts", selfInitiated: "yes" }),
    );
    expect(result).toBeNull();
  });

  it("stays quiet on IT support the user booked", () => {
    const result = interruptionFor(
      facts({ happeningNow: true, asksFor: ["remote_access"], independentlyVerified: true }),
    );
    expect(result).toBeNull();
  });

  it("does not treat an unknown start as the user's own", () => {
    const result = interruptionFor(facts({ happeningNow: true, asksFor: ["code"], selfInitiated: null }));
    expect(result).toBe("code");
  });

  it("interrupts when someone is connected right now", () => {
    expect(interruptionFor(facts({ happeningNow: true, incidentType: "remote_session" }))).toBe("remote_access");
    expect(interruptionFor(facts({ happeningNow: true, userAlreadyDid: ["gave_remote_access"] }))).toBe("remote_access");
  });

  it("puts personal safety ahead of everything", () => {
    const result = interruptionFor(
      facts({ personalSafetyRisk: true, happeningNow: true, asksFor: ["remote_access"] }),
    );
    expect(result).toBe("personal_safety");
  });
});

describe("approved text", () => {
  const kinds = Object.keys(text.stop) as InterruptionKind[];
  const reasons = Object.keys(text.fallback) as (keyof typeof text.fallback)[];

  it.each(Language.options)("has every stop message in %s", (language) => {
    for (const kind of kinds) {
      const screen = stopScreen(kind, language);
      expect(screen.message.length).toBeGreaterThan(0);
      expect(screen.actions).toHaveLength(1);
    }
  });

  it("tells a monitored user not to remove anything yet", () => {
    expect(stopScreen("personal_safety", "en").actions[0]).toContain("Don't remove");
  });

  it("has a label for every status in every language", () => {
    for (const status of Status.options) {
      for (const language of Language.options) {
        expect(text.statusLabels[status][language].length).toBeGreaterThan(0);
      }
    }
  });

  it("never calls an unclear situation safe", () => {
    for (const reason of reasons) {
      expect(fallbackScreen(reason, "en").message).toMatch(/can't (say|check)|don't understand/);
    }
  });

  it.each(Language.options)("keeps the stop line and a human route in every %s fallback", (language) => {
    const stopLine = fallbackScreen("analysis_failed", language).actions[0];
    const humanLine = fallbackScreen("analysis_failed", language).actions.at(-1);
    for (const reason of reasons) {
      const screen = fallbackScreen(reason, language);
      expect(screen.actions[0]).toBe(stopLine);
      expect(screen.actions.at(-1)).toBe(humanLine);
    }
  });
});
