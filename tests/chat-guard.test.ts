import { describe, expect, it } from "vitest";
import { chatIsSafe } from "../adapters/llm";

describe("model chat reply guard", () => {
  it("allows a plain explanation", () => {
    expect(chatIsSafe("A message saying you won something and asking for a fee is a common prize scam, so don't pay it.", "threat_in_progress")).toBe(true);
  });
  it("blocks reassurance unless the rules said safe", () => {
    expect(chatIsSafe("This looks genuine, nothing to worry about.", "needs_verification")).toBe(false);
    expect(chatIsSafe("Tämä on turvallinen.", "threat_in_progress")).toBe(false);
    expect(chatIsSafe("This looks genuine, so you don't need to do anything.", "safe")).toBe(true);
  });
  it("blocks requests for secrets", () => {
    expect(chatIsSafe("Please tell me the code you received so I can check it.", "threat_in_progress")).toBe(false);
    expect(chatIsSafe("Kerro koodi, niin tarkistan sen.", "threat_in_progress")).toBe(false);
  });
  it("blocks links, phone numbers and overlong replies", () => {
    expect(chatIsSafe("Call +358 40 123 4567 now.", "threat_in_progress")).toBe(false);
    expect(chatIsSafe("See https://example.com for help.", "threat_in_progress")).toBe(false);
    expect(chatIsSafe("a".repeat(601), "threat_in_progress")).toBe(false);
  });
});
