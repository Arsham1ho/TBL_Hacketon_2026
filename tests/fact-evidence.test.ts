import { describe, expect, it } from "vitest";
import { validateFacts } from "../engine/fact-validator";
import { blankFacts } from "./helpers";

describe("evidence for completed actions", () => {
  it("does not let one quote support two different completed actions", () => {
    const result = validateFacts({ ...blankFacts, userAlreadyDid: ["shared_code", "paid"], evidence: [{ fact: "userAlreadyDid:shared_code", quote: "I read the code" }] }, { userText: "I read the code to the caller.", maskedIncident: null });
    expect(result?.userAlreadyDid).toEqual(["shared_code"]);
  });

  it.each(["I did not give them the code", "They asked me to give them the code"])("does not treat '%s' as a completed action", text => {
    const result = validateFacts({ ...blankFacts, userAlreadyDid: ["shared_code"], evidence: [{ fact: "userAlreadyDid:shared_code", quote: "give them the code" }] }, { userText: text, maskedIncident: null });
    expect(result?.userAlreadyDid).toEqual([]);
  });

  it("does not accept an action claimed only in the suspicious message", () => {
    const result = validateFacts({ ...blankFacts, userAlreadyDid: ["paid"], evidence: [{ fact: "userAlreadyDid:paid", quote: "I paid" }] }, { userText: "Is this message real?", maskedIncident: "I paid the invoice" });
    expect(result?.userAlreadyDid).toEqual([]);
  });
});
