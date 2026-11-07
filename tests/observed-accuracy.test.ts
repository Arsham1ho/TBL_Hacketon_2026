import { describe, expect, it } from "vitest";
import { assess, intake } from "../engine/assess";
import { incidentStory } from "../engine/incident-category";
import { handleEvent } from "../engine/handle-event";

const input = (openingMessage: string, audience: "consumer" | "small_business" = "consumer") => ({
  audience, language: "en" as const, openingMessage, incidentContent: null,
  incidentChannel: null, signals: { hasLink: false, linkVerdict: null, callWarning: null, callerSpoofed: false },
  consent: { requires: [], preGranted: [] },
});

describe("observed accuracy regressions", () => {
  it("does not treat a confirmed own login as an attack", async () => {
    const { item } = await intake(input("That Helsinki login was me on my new tablet, and I used the official app."));
    const result = assess(item);
    expect(result.decision.primaryAction).toBe("no_action_needed");
    expect(result.decision.status).toBe("safe");
  });

  it("does not record a code as shared when the person explicitly denied sharing it", async () => {
    const { item } = await intake(input("A bank caller is asking for a code. I have not shared it."));
    expect(item.facts.userAlreadyDid).not.toContain("shared_code");
    expect(assess(item).confirmedFacts.map(fact => fact.text)).not.toContain("A code was shared.");
  });

  it("puts access removal first for an active former employee account", async () => {
    const { item } = await intake(input("A former employee still has an active administrator account.", "small_business"));
    const result = assess(item);
    expect(result.outcome.steps[0]).toBe("revoke_access");
    expect(result.outcome.steps).not.toContain("notify_data_protection");
    expect(result.decision.destination).toBe("business_security_support");
  });

  it("uses payment specific context for supplier account changes", async () => {
    const { item } = await intake(input("A supplier changed their bank account and asks us to pay an invoice there.", "small_business"));
    const result = assess(item);
    const story = incidentStory(item, result.outcome, result.decision.status);
    expect(story.investigation.why).toMatch(/business payment/);
    expect(story.investigation.why).not.toMatch(/small fees|deliveries/);
  });

  it("does not ask again whether a payment was sent after an explicit denial", async () => {
    const { item } = await intake(input("A person I met online asks for travel money. I have not sent any money."));
    expect(item.answers.money_transferred).toBe("no");
    expect(item.answers.payment_status).toBe("no");
    expect(assess(item).flip?.topic).not.toBe("money_transferred");
  });

  it("disconnects an actively controlled device before other advice", async () => {
    const { item } = await intake({ ...input("En främmande person styr fortfarande min dator via fjärrhjälp.") , language: "sv" });
    const result = assess(item);
    expect(result.outcome.situation).toBe("active_remote_control");
    expect(result.outcome.steps[0]).toBe("disconnect_device");
  });

  it("does not prescribe password recovery for an unopened breach lure", async () => {
    const { item } = await intake(input("I got a breach notice asking me to use a link to sign in with my password. I have not opened it."));
    const result = assess(item);
    expect(result.outcome.steps).not.toContain("change_password");
    expect(item.facts.dataExposed).not.toContain("password");
  });

  it("does not invent a link or message in a direct money request", async () => {
    const { item } = await intake(input("A person I met online wants me to send money for travel. I have not sent anything."));
    const result = assess(item);
    expect(result.outcome.steps).not.toContain("dont_open_link");
    expect(result.outcome.steps).not.toContain("delete_or_report_message");
    expect(result.outcome.steps).toContain("dont_pay_or_transfer");
  });

  it("reads details supplied to an open interview question without an LLM", async () => {
    const started = await handleEvent("local", null, { kind: "start", input: input("Something weird happened with my account."), sentToLlm: false });
    const journey = { ...started.journey!, pendingAsk: { id: "question-1", question: "What happened?", open: true } };
    const answered = await handleEvent("local", journey, { kind: "ai_answer", id: "question-1", text: "I received an alert about an unfamiliar login from another city. It was not me." });
    expect(answered.journey!.item.facts.incidentType).toBe("unknown_login");
    expect(answered.journey!.input!.openingMessage).toContain("unfamiliar login");
  });
});
