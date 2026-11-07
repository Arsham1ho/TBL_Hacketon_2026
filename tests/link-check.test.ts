import { describe, expect, it, vi } from "vitest";
import type { CaseInput } from "../engine/assess";
import { handleEvent } from "../engine/handle-event";
import { checkLink, checkSender, findUrl, parseLink, runLinkCheck } from "../engine/link-check";

const input = (openingMessage: string, language: CaseInput["language"] = "en"): CaseInput => ({
  audience: "consumer",
  language,
  openingMessage,
  incidentContent: null,
  incidentChannel: null,
  signals: { hasLink: false, linkVerdict: null, callWarning: null, callerSpoofed: false },
  consent: { requires: [], preGranted: [] },
});

describe("link rules", () => {
  it("calls only an exact official domain over https safe", () => {
    expect(checkLink("https://www.nordea.fi/henkilo", "en")?.verdict).toBe("safe");
    expect(checkLink("nordea.fi", "en")?.verdict).toBe("safe");
    expect(checkLink("http://nordea.fi", "en")?.verdict).toBe("risky");
    expect(checkLink("https://shop.example.net/order", "en")?.verdict).toBe("risky");
  });

  it("flags look-alikes, number addresses, hidden hosts and app downloads as avoid", () => {
    expect(checkLink("https://nordea-verify.top/login", "en")).toMatchObject({ verdict: "avoid", brand: "Nordea" });
    expect(checkLink("https://n0rdea.com", "en")?.verdict).toBe("avoid");
    expect(checkLink("http://185.22.1.4/pay", "en")?.verdict).toBe("avoid");
    expect(checkLink("https://op.fi@evil.example.com", "en")?.verdict).toBe("avoid");
    expect(checkLink("https://voicemail.example.net/app.apk", "en")?.verdict).toBe("avoid");
    expect(checkLink("https://xn--nrdea-0ra.fi", "en")?.verdict).toBe("avoid");
  });

  it("never shows or sends the query or fragment", () => {
    expect(parseLink("https://posti-track.example.com/t?token=SECRET123#x")?.display).toBe("https://posti-track.example.com/t");
  });

  it("finds a link inside a message and rejects text that isn't one", () => {
    expect(findUrl("They sent me https://dna-fi.top/renew. Is it real?")).toBe("https://dna-fi.top/renew");
    expect(findUrl("Got this: posti-paketti.info/maksu")).toBe("posti-paketti.info/maksu");
    expect(parseLink("I don't know")).toBeNull();
  });

  it("explains in the user's language", () => {
    const check = checkLink("https://dna-fi.top/renew", "fi")!;
    expect(check.title).toMatch(/Vältä/);
    expect(check.reasons.join(" ")).toMatch(/DNA/);
  });
});

describe("the AI reading", () => {
  it("can make a verdict stricter but never makes an unknown site safe", async () => {
    const reader = vi.fn(async () => ({ impersonates: "Posti", signs: ["login_or_payment_page"] }));
    expect((await runLinkCheck("https://parcel-help.example.com/pay", "en", reader))?.verdict).toBe("avoid");
    const kind = vi.fn(async () => ({ impersonates: null, signs: [] }));
    expect((await runLinkCheck("https://parcel-help.example.com/pay", "en", kind))?.verdict).toBe("risky");
  });

  it("gets only the cleaned address, and falls back to the rules on a bad reply or failure", async () => {
    const reader = vi.fn(async () => ({ verdict: "safe" }));
    const check = await runLinkCheck("https://parcel-help.example.com/pay?id=99", "en", reader);
    expect(reader).toHaveBeenCalledWith({ url: "https://parcel-help.example.com/pay", language: "en" });
    expect(check).toMatchObject({ verdict: "risky", usedAi: false });
    const failing = vi.fn(async () => { throw new Error("timeout"); });
    expect((await runLinkCheck("https://nordea.fi", "en", failing))?.verdict).toBe("safe");
  });
});

describe("sender check", () => {
  it("only matches an official sender address, and catches look-alikes and free mail claiming to be a company", () => {
    expect(checkSender("asiakaspalvelu@op.fi", "email", "en", true)?.verdict).toBe("safe");
    expect(checkSender("security@nordea-support.top", "email", "en", true)).toMatchObject({ verdict: "avoid", brand: "Nordea" });
    expect(checkSender("nordea.security@gmail.com", "email", "en", true)?.verdict).toBe("avoid");
    expect(checkSender("friend@gmail.com", "email", "en", false)?.verdict).toBe("risky");
    expect(checkSender('"Posti" <noreply@parcel-help.example.com>', "email", "en", true)).toMatchObject({ verdict: "avoid", brand: "Posti" });
  });

  it("flags foreign and hidden numbers that claim to be a Finnish service", () => {
    expect(checkSender("+44 7700 900123", "call", "en", true)?.verdict).toBe("avoid");
    expect(checkSender("+358 40 123 4567", "call", "en", true)?.verdict).toBe("risky");
    expect(checkSender("Hidden", "call", "en", true)?.verdict).toBe("avoid");
    expect(checkSender("Posti", "sms", "en", true)?.reasons.join(" ")).toMatch(/can be faked/);
  });
});

describe("what the user received, in the conversation", () => {
  it("asks for the link, sender and message of a text, checks them, and carries on", async () => {
    let flow = await handleEvent("t", null, { kind: "start", input: input("I got a text with a link saying my parcel is held."), sentToLlm: false, askForLink: true });
    expect(flow.response.screen).toMatchObject({ type: "evidence", channel: "sms" });
    const fields = flow.response.screen.type === "evidence" ? flow.response.screen.fields.map((field) => field.id) : [];
    expect(fields).toEqual(["sender", "content", "link"]);
    flow = await handleEvent("t", flow.journey, { kind: "evidence", link: "not a link" });
    expect(flow.response.screen).toMatchObject({ type: "evidence", retry: true });
    flow = await handleEvent("t", flow.journey, { kind: "evidence", sender: "+44 7700 900123", content: "Posti: your parcel is held. Pay the 2,99 EUR customs fee today: https://posti-paketti.info/maksu" });
    expect(flow.response.linkCheck?.verdict).toBe("avoid");
    expect(flow.response.senderCheck?.subject).toBe("sender");
    expect(flow.journey!.item.signals.linkVerdict).toBe("malicious");
    expect(flow.journey!.input?.incidentContent).toContain("customs fee");
    expect(flow.response.screen.type).not.toBe("evidence");
  });

  it("asks for the caller's number and what they said for a call", async () => {
    const flow = await handleEvent("t", null, { kind: "start", input: input("Someone called yesterday saying they were from my bank."), sentToLlm: false, askForLink: true });
    expect(flow.response.screen).toMatchObject({ type: "evidence", channel: "call" });
  });

  it("feeds a fake-looking caller into the call warning signal", async () => {
    let flow = await handleEvent("t", null, { kind: "start", input: input("Someone called yesterday saying they were from my bank."), sentToLlm: false, askForLink: true });
    flow = await handleEvent("t", flow.journey, { kind: "evidence", sender: "+44 7700 900123" });
    expect(flow.journey!.item.signals.callWarning).toBe("suspected_scam");
  });

  it("checks a link already in the first message without asking", async () => {
    const flow = await handleEvent("t", null, { kind: "start", input: input("Is this real? https://dna-fi.top/renew"), sentToLlm: false, askForLink: true });
    expect(flow.response.linkCheck?.verdict).toBe("avoid");
  });

  it("moves on when the user doesn't have it", async () => {
    let flow = await handleEvent("t", null, { kind: "start", input: input("I clicked a link in an email."), sentToLlm: false, askForLink: true });
    expect(flow.response.screen).toMatchObject({ type: "evidence", channel: "email" });
    flow = await handleEvent("t", flow.journey, { kind: "skip_evidence" });
    expect(flow.response.screen.type).not.toBe("evidence");
    expect(flow.response.linkCheck).toBeNull();
  });

  it("never lowers a stricter verdict from DNA's own link signal", async () => {
    const flagged = { ...input("Is this safe? https://nordea.fi"), signals: { hasLink: true, linkVerdict: "malicious" as const, callWarning: null, callerSpoofed: false } };
    const flow = await handleEvent("t", null, { kind: "start", input: flagged, sentToLlm: false, askForLink: true });
    expect(flow.journey!.item.signals.linkVerdict).toBe("malicious");
  });

  it("doesn't ask outside the app, where nobody can paste anything", async () => {
    const flow = await handleEvent("t", null, { kind: "start", input: input("I got a text with a link saying my parcel is held."), sentToLlm: false });
    expect(flow.response.screen.type).not.toBe("evidence");
  });
});
