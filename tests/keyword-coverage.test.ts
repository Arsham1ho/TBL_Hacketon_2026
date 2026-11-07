import { describe, expect, it } from "vitest";
import { offlineExtract } from "../engine/offline-extractor";
import { isOffTopic } from "../engine/mentions";

// Realistic reports across incident types, impersonated senders and actions, in English,
// Finnish and Swedish. Each must be understood by the keyword reader alone, so the app
// still makes sense when no LLM is available.
type P = [string, string, "en" | "fi" | "sv", (f: any) => boolean];
const has = (k: string, v: string) => (f: any) => Array.isArray(f[k]) ? f[k].includes(v) : f[k] === v;
const P: P[] = [
  // incident types
  ["fake shop", "I ordered shoes from a webshop and they never arrived, the site is gone", "en", (f) => f.incidentType === "link_or_site" && f.userAlreadyDid.includes("paid")],
  ["qr", "I scanned a QR code on a parking meter and paid", "en", has("userAlreadyDid","paid")],
  ["sextortion", "someone says they have a video of me and wants bitcoin or they send it to my friends", "en", (f) => f.pressureOrSecrecy === true && f.asksFor.includes("money")],
  ["sextortion2", "I'm being blackmailed with nude photos", "en", (f) => f.pressureOrSecrecy === true],
  ["romance", "I met a man on Tinder and he asked me to send money for a flight ticket", "en", has("asksFor","money")],
  ["investment", "I invested in a crypto platform and now I can't withdraw my money", "en", has("asksFor","money")],
  ["job scam", "a recruiter on WhatsApp offered me a job liking youtube videos and now wants a deposit", "en", has("asksFor","money")],
  ["marketplace", "a buyer on Tori sent me a link to receive the payment via Posti", "en", (f) => f.pretendsToBe === "support"],
  ["fake invoice", "we got an invoice for a service we never ordered", "en", has("incidentType","unexpected_order_or_bill")],
  ["account hacked ig", "someone hacked my instagram and changed the email", "en", has("incidentType","unknown_login")],
  ["cant login", "I can't log in to my email anymore, password was changed", "en", has("incidentType","unknown_login")],
  ["2fa codes", "I keep getting verification codes I didn't ask for", "en", has("incidentType","unrequested_reset")],
  ["identity", "someone took a loan in my name", "en", has("dataExposed","identity")],
  ["identity2", "my passport photo and henkilötunnus were leaked", "en", has("dataExposed","identity")],
  ["phone stolen", "my phone was stolen", "en", () => true],
  ["popup", "a popup said my computer is infected and to call Microsoft", "en", has("pretendsToBe","support")],
  ["browser ext", "a weird browser extension appeared and my searches redirect", "en", has("incidentType","unwanted_app_or_profile")],
  ["webcam", "I think someone is watching me through my webcam", "en", (f) => f.incidentType !== null && f.incidentType !== "message_or_notice"],
  ["stalkerware", "my husband knows where I go all the time, I think he tracks my phone", "en", has("incidentType","partner_monitoring")],
  ["airtag", "I found an AirTag in my bag that isn't mine", "en", (f) => f.personalSafetyRisk === true || f.incidentType === "partner_monitoring"],
  ["wifi", "there are unknown devices on my wifi", "en", has("incidentType","router_or_network")],
  ["mobilepay", "I sent money with MobilePay to a seller who disappeared", "en", has("userAlreadyDid","paid")],
  ["gift cards", "the caller asked me to buy Google Play gift cards", "en", has("asksFor","money")],
  ["bankid", "I logged in with my bank ID on a link from a text", "en", has("userAlreadyDid","entered_login")],
  ["pin told", "I told the caller my PIN", "en", has("userAlreadyDid","shared_code")],
  ["card given", "I gave my credit card number on the phone", "en", has("userAlreadyDid","entered_card")],
  ["cvv", "I entered my CVV on a parcel site", "en", has("userAlreadyDid","entered_card")],
  ["downloaded apk", "I downloaded an APK file the sender sent me", "en", has("userAlreadyDid","installed_app")],
  ["anydesk", "I let him use AnyDesk on my laptop", "en", has("userAlreadyDid","gave_remote_access")],
  ["clicked ad", "I clicked an ad on Facebook and entered my details", "en", (f) => f.userAlreadyDid.length > 0],
  ["pose kela", "a text from Kela says I have a refund", "en", has("pretendsToBe","authority")],
  ["pose posti", "Posti says my package is waiting and I must pay customs", "en", has("asksFor","money")],
  ["pose netflix", "Netflix says my payment failed", "en", (f) => f.pretendsToBe !== null],
  ["pose dna", "someone from DNA called about my subscription", "en", has("pretendsToBe","operator")],
  ["pose relative", "Hi mum this is my new number, I lost my phone", "en", has("pretendsToBe","family")],
  ["pose amazon", "Amazon called about a suspicious order on my account", "en", (f) => f.pretendsToBe !== null],
  ["pose apple", "Apple ID locked email", "en", (f) => f.pretendsToBe !== null],
  ["pose police sv", "en polis ringde och sa att mitt konto är i fara", "sv", has("pretendsToBe","police")],
  // Finnish
  ["fi hack ig", "joku hakkeroi instagramini", "fi", has("incidentType","unknown_login")],
  ["fi kiristys", "minua kiristetään alastonkuvilla", "fi", (f) => f.pressureOrSecrecy === true],
  ["fi puhelin varastettu", "puhelimeni varastettiin", "fi", () => true],
  ["fi lahjakortti", "soittaja pyysi ostamaan lahjakortteja", "fi", has("asksFor","money")],
  ["fi verkkokauppa", "tilasin verkkokaupasta eikä paketti tullut koskaan", "fi", (f) => f.incidentType !== null],
  ["fi mobilepay", "maksoin mobilepaylla myyjälle joka katosi", "fi", has("userAlreadyDid","paid")],
  ["fi henkilöllisyys", "joku otti lainan nimissäni", "fi", has("dataExposed","identity")],
  ["fi korttinumero", "annoin korttinumeroni puhelimessa", "fi", has("userAlreadyDid","entered_card")],
  ["fi wifi", "wifissäni on tuntemattomia laitteita", "fi", has("incidentType","router_or_network")],
  // Swedish
  ["sv hack", "någon har hackat mitt instagram", "sv", has("incidentType","unknown_login")],
  ["sv swish", "jag swishade pengar till en säljare som försvann", "sv", has("userAlreadyDid","paid")],
  ["sv utpressning", "jag blir utpressad med nakenbilder", "sv", (f) => f.pressureOrSecrecy === true],
  ["sv mobil stulen", "min mobil blev stulen", "sv", () => true],
  ["sv presentkort", "han bad mig köpa presentkort", "sv", has("asksFor","money")],
  ["sv kortnummer", "jag gav mitt kortnummer i telefon", "sv", has("userAlreadyDid","entered_card")],
];

describe("keyword reader coverage", () => {
  it.each(P)("%s", (_name, text, language, ok) => {
    const facts = offlineExtract({ userText: text, incidentText: "", language, incidentChannel: null, hasRiskyLink: false, audience: "consumer" });
    expect(isOffTopic(text, facts)).toBe(false);
    expect(ok(facts)).toBe(true);
  });
});

describe("broader patterns do not over-read", () => {
  const read = (text: string) => offlineExtract({ userText: text, incidentText: "", language: "en", incidentChannel: null, hasRiskyLink: false, audience: "consumer" });
  it("a partner mentioned without tracking is not monitoring", () => {
    expect(read("my husband got a strange call from the bank").incidentType).not.toBe("partner_monitoring");
  });
  it("a passport mentioned without a leak is not exposed identity", () => {
    expect(read("I renewed my passport and got a strange text").dataExposed).not.toContain("identity");
  });
  it("a denied payment stays denied", () => {
    expect(read("I didn't send money and didn't buy gift cards").userAlreadyDid).not.toContain("paid");
  });
  it("a request for gift cards is not a purchase", () => {
    expect(read("the caller asked me to buy gift cards").userAlreadyDid).not.toContain("paid");
  });
});
