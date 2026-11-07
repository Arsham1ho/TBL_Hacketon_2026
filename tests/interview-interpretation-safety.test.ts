import { describe, expect, it } from "vitest";
import { safeInterviewInterpretation } from "../adapters/llm";

describe("interview answer interpretation safety", () => {
  it("accepts a direct question about the user's action", () => {
    expect(safeInterviewInterpretation("Did you share the code with the caller?", "code_shared", "en")).toBe(true);
  });
  it.each([
    ["Did the caller ask you to share the code?", "code_shared", "en"],
    ["Did you pay or share the code?", "code_shared", "en"],
    ["Didn't you share the code?", "code_shared", "en"],
    ["Did you share your password?", "code_shared", "en"],
    ["Did you share the code?", "code_shared", "fi"],
    ["Is this happening now?", "time_of_event", "en"],
  ])("leaves ambiguous or unsupported interpretations unknown: %s", (question, topic, language) => {
    expect(safeInterviewInterpretation(question, topic, language)).toBe(false);
  });
});
