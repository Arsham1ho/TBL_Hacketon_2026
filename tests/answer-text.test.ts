import { describe, expect, it } from "vitest";
import { handleEvent, type Journey } from "../engine/handle-event";
import type { CaseInput } from "../engine/assess";
import { readAnswerOffline } from "../engine/answer-reader";

const input = (message: string): CaseInput => ({
  audience: "consumer", language: "en", openingMessage: message, incidentContent: null, incidentChannel: null,
  signals: { hasLink: false, linkVerdict: null, callWarning: null, callerSpoofed: false },
  consent: { requires: [], preGranted: [] },
});

async function firstFlip(message: string) {
  const started = await handleEvent("test", null, { kind: "start", input: input(message), sentToLlm: false });
  expect(started.response.screen.type).toBe("flip");
  if (started.response.screen.type !== "flip") throw new Error("no flip");
  return { journey: started.journey as Journey, topic: started.response.screen.topic, before: started.response.state };
}

describe("typed answers", () => {
  it("reads details in a typed reply as facts, not as 'not sure'", async () => {
    const { journey, topic, before } = await firstFlip("I opened a link in a parcel text.");
    const after = await handleEvent("test", journey, { kind: "answer_text", topic, text: "I entered my card details on that page" });
    expect(after.journey!.item.facts.userAlreadyDid).toContain("entered_card");
    expect(after.journey!.item.unsure).not.toContain(topic);
    expect(after.response.state.status).toBe("incident_occurred");
    expect(after.response.state).not.toEqual(before);
  });

  it("still reads a plain yes or no", async () => {
    const { journey, topic } = await firstFlip("I opened a link in a parcel text.");
    const after = await handleEvent("test", journey, { kind: "answer_text", topic, text: "no" });
    expect(after.journey!.item.answers[topic]).toBe("no");
  });

  it("keeps earlier facts when the reply adds new ones", async () => {
    const { journey, topic } = await firstFlip("I opened a link in a parcel text.");
    const after = await handleEvent("test", journey, { kind: "answer_text", topic, text: "I paid 2 euros there" });
    expect(after.journey!.item.facts.userAlreadyDid).toEqual(expect.arrayContaining(journey.item.facts.userAlreadyDid));
  });

  it("rejects a typed answer to a question not asked", async () => {
    const started = await handleEvent("test", null, { kind: "start", input: input("help"), sentToLlm: false });
    await expect(handleEvent("test", started.journey, { kind: "answer_text", topic: "card_details_entered", text: "yes" })).rejects.toThrow("invalid_topic");
  });

  it("uses the extractor on the combined story", async () => {
    const { journey, topic } = await firstFlip("I opened a link in a parcel text.");
    let seen = "";
    const extractor = (x: { userText: string }) => { seen = x.userText; return null; };
    await handleEvent("test", journey, { kind: "answer_text", topic, text: "then I typed my card number", extractor, sentToLlm: true });
    expect(seen).toContain("parcel text");
    expect(seen).toContain("typed my card number");
  });

  it.each([
    ["sure", "yes"], ["correct", "yes"], ["I entered my card details", "yes"], ["I paid 200 euros", "yes"],
    ["not sure", "unsure"], ["no", "no"], ["that's not true", "no"],
  ] as const)("reads '%s' as %s", (text, expected) => {
    expect(readAnswerOffline(text, "en")).toBe(expected);
  });
  it.each([["Maksoin sen jo", "fi"], ["Stämmer", "sv"]] as const)("reads '%s' as yes", (text, language) => {
    expect(readAnswerOffline(text, language)).toBe("yes");
  });
});

describe("follow-up details", () => {
  it("adds details to the same session and keeps earlier answers", async () => {
    const { journey, topic } = await firstFlip("I opened a link in a parcel text.");
    const answered = await handleEvent("test", journey, { kind: "answer_text", topic, text: "no" });
    const added = await handleEvent("test", answered.journey, { kind: "add_details", text: "Actually I also paid 2 euros on that page" });
    expect(added.journey!.item.answers[topic]).toBe("no");
    expect(added.journey!.item.facts.userAlreadyDid).toContain("paid");
    expect(added.journey!.input!.openingMessage).toContain("parcel text");
    expect(added.response.state.status).toBe("incident_occurred");
  });

  it("shows the stop screen when a follow-up reveals live danger", async () => {
    const { journey, topic } = await firstFlip("I opened a link in a parcel text.");
    const answered = await handleEvent("test", journey, { kind: "answer_text", topic, text: "no" });
    const added = await handleEvent("test", answered.journey, { kind: "add_details", text: "The bank is on the phone right now asking for my code" });
    expect(added.response.screen.type).toBe("stop");
  });
});

import { detectMentions, isGreetingOnly, isOffTopic } from "../engine/mentions";
import { offlineExtract } from "../engine/offline-extractor";
import { safeScreen } from "../engine/output-guard";

describe("vague messages", () => {
  it.each(["hi", "Hello!", "moi", "hej hej", "  ?", "hi there"])("treats '%s' as a greeting", (text) => expect(isGreetingOnly(text)).toBe(true));
  it.each(["help", "hi I got an email", "someone called me"])("does not treat '%s' as a greeting", (text) => expect(isGreetingOnly(text)).toBe(false));

  it("asks a greeting to describe what happened, then assesses the details", async () => {
    const started = await handleEvent("test", null, { kind: "start", input: input("hi"), sentToLlm: false });
    expect(started.response.screen.type).toBe("describe");
    expect(safeScreen(started.response.screen, "en")).toBe(true);
    const added = await handleEvent("test", started.journey, { kind: "add_details", text: "I opened a link in a parcel text." });
    expect(added.response.screen).toMatchObject({ type: "flip", topic: "card_details_entered" });
  });

  it("keeps 'help' on the safety-first question", async () => {
    const started = await handleEvent("test", null, { kind: "start", input: input("help"), sentToLlm: false });
    expect(started.response.screen).toMatchObject({ type: "flip", topic: "time_of_event" });
  });

  it("asks about the account first when the account is mentioned, and says so", async () => {
    const started = await handleEvent("test", null, { kind: "start", input: input("some body wanrt to see my account"), sentToLlm: false });
    expect(started.response.screen).toMatchObject({ type: "flip", topic: "account_affected", context: ["You mentioned your account.", "I need a little more detail, so a few quick questions first."] });
    expect(safeScreen(started.response.screen, "en")).toBe(true);
  });

  it("acknowledges an email", async () => {
    const started = await handleEvent("test", null, { kind: "start", input: input("hi I recive email"), sentToLlm: false });
    expect(started.response.screen).toMatchObject({ type: "flip", context: ["You mentioned an email.", "I need a little more detail, so a few quick questions first."] });
  });

  it("rejects an unapproved context line", () => {
    expect(safeScreen({ type: "flip", topic: "time_of_event", question: "Is someone asking you for money, a code or access right now?", why: "If it's happening now, stopping it comes first.", statusLabel: "Needs checking", branches: [], context: ["This is definitely a scam."] }, "en")).toBe(false);
  });

  it.each([["Sain sähköpostin pankilta", ["account", "email"]], ["Någon ringde mig", ["call"]], ["my computer has a virus", ["device"]]] as const)("detects mentions in '%s'", (text, expected) => {
    expect(detectMentions(text)).toEqual(expected);
  });
});

describe("off-topic requests", () => {
  const facts = (text: string) => offlineExtract({ userText: text, incidentText: "", language: "en", incidentChannel: null, hasRiskyLink: false });
  it.each(["write me an essay about climate change", "give me a pasta recipe", "kirjoita minulle runo", "skriv en dikt om hösten"])("flags '%s'", (text) => expect(isOffTopic(text, facts(text))).toBe(true));
  it.each(["help", "What should I do with this?", "Onko tämä luotettava?", "Vad ska jag göra med det här?", "I'm worried something is wrong", "someone called me"])("keeps '%s' on topic", (text) => expect(isOffTopic(text, facts(text))).toBe(false));

  it("asks whether anything happened, and Yes leads to describing it", async () => {
    const started = await handleEvent("test", null, { kind: "start", input: input("write me an essay about climate change"), sentToLlm: false });
    expect(started.response.screen).toMatchObject({ type: "describe", reason: "off_topic" });
    expect(safeScreen(started.response.screen, "en")).toBe(true);
    const yes = await handleEvent("test", started.journey, { kind: "add_details", text: "Yes" });
    expect(yes.response.screen).toMatchObject({ type: "describe", reason: "greeting" });
    const told = await handleEvent("test", yes.journey, { kind: "add_details", text: "I opened a link in a parcel text." });
    expect(told.response.screen).toMatchObject({ type: "flip", topic: "card_details_entered" });
    expect(told.journey!.input!.openingMessage).not.toContain("essay");
  });

  it("ends politely on No", async () => {
    const started = await handleEvent("test", null, { kind: "start", input: input("give me a pasta recipe"), sentToLlm: false });
    const no = await handleEvent("test", started.journey, { kind: "add_details", text: "No" });
    expect(no.response.screen.type).toBe("end");
    expect(safeScreen(no.response.screen, "en")).toBe(true);
  });

  it("goes straight to assessment when the reply describes an incident", async () => {
    const started = await handleEvent("test", null, { kind: "start", input: input("give me a pasta recipe"), sentToLlm: false });
    const told = await handleEvent("test", started.journey, { kind: "add_details", text: "Actually I typed my card details on a parcel site" });
    expect(told.response.screen.type).not.toBe("describe");
    expect(told.response.state.status).toBe("incident_occurred");
  });

  it("never turns away pasted content", async () => {
    const started = await handleEvent("test", null, { kind: "start", input: { ...input("write me an essay"), incidentContent: "Your parcel is waiting, pay 1.95 EUR here" }, sentToLlm: false });
    expect(started.response.screen.type).not.toBe("describe");
  });
});

import { acceptablePhrasing } from "../adapters/llm";
describe("AI-worded questions", () => {
  it("accepts a fitted question that keeps its subject", () => {
    expect(acceptablePhrasing("Did you tell the caller your bank ID code?", "code_shared")).toBe(true);
  });
  it.each([
    ["Did you click any links in the email?", "remote_access_given"],
    ["What is your code?", "code_shared"],
    ["Is this a scam?", "time_of_event"],
    ["Did you pay 50 euros?", "money_transferred"],
    ["Did you share it", "code_shared"],
  ])("rejects '%s'", (question, topic) => expect(acceptablePhrasing(question, topic)).toBe(false));
});
