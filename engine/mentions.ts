import { fold } from "./offline-extractor";
import type { Facts, Topic } from "./types";

// Plain words a vague message mentions. They never change a decision: they only pick
// which triage question comes first and tell the user what was understood.
export const MENTIONS = ["account", "money", "device", "call", "sms", "email"] as const;
export type Mention = (typeof MENTIONS)[number];

const start = String.raw`(?<![\p{L}\p{N}])`;
const PATTERNS: Record<Mention, RegExp> = {
  account: new RegExp(fold(start + String.raw`(account|bank|log ?in|password|instagram|facebook|tiktok|snapchat|social media|tili|pank|tunnu|salasan|verkkopank|konto|banken|inlogg|lösenord)`), "iu"),
  money: new RegExp(fold(start + String.raw`(money|paid|pay|payment|transfer|euros?|wallet|drain|crypto|bitcoin|seed phrase|recovery phrase|charges?|transactions?|withdraw|gift ?cards?|lahjakort|presentkort|swish|mobilepay|revolut|paypal|klarna|invoice|lasku|faktura|loan|laina|lån|raha|maks|siirs|siirto|lompako|lompakk|krypto|veloitu|pengar|betal|överför|plånbok)|\d\s?€|€\s?\d`), "iu"),
  device: new RegExp(fold(start + String.raw`(hacked|virus|malware|remote|anydesk|teamviewer|my (phone|computer|laptop|device)|wi-?fi|wlan|webcam|camera|kamera|airtag|tracker|router|reititin|tietokone|kone(eni|ttani)|puhelime|etä|hakkero|dator|min telefon|fjärr|hackad)`), "iu"),
  call: new RegExp(fold(start + String.raw`(call(ed|ing|s)?|rang|phoned|soitt|puhelu|ringde|ringer|samtal)`), "iu"),
  sms: new RegExp(fold(start + String.raw`(sms|text message|texted|a text|whatsapp|tekstivie|tekstari|viesti|textmeddelande|meddelande)`), "iu"),
  email: new RegExp(fold(start + String.raw`(e-?mail|mail|sähköpost|meili|e-post|mejl)`), "iu"),
};

export function detectMentions(text: string): Mention[] {
  const folded = fold(text);
  return MENTIONS.filter((mention) => PATTERNS[mention].test(folded));
}

// Which triage question a mention makes most useful first.
const FIRST_QUESTION: Partial<Record<Mention, Topic>> = {
  account: "account_affected",
  money: "money_transferred",
  device: "remote_access_given",
  call: "time_of_event",
};

// Mentioned topics go first. A call keeps "is it happening now" first, and with no
// mention the original safety-first order stays.
export function orderByMentions(flips: Topic[], mentions: Mention[] = [], priority: Topic[] = []): Topic[] {
  // A call may be live, so "is it happening now" stays first whatever the ranking says.
  const live: Topic[] = mentions.includes("call") ? ["time_of_event"] : [];
  const first = [...live, ...priority, ...mentions.flatMap((mention) => FIRST_QUESTION[mention] ?? [])].filter((topic) => flips.includes(topic));
  return [...new Set([...first, ...flips])];
}

// Words that show the user is worried about something, even with no detail yet.
const CONCERN = new RegExp(fold(start + String.raw`(what (should|do|can) (i|we) do|what to do|look at this|check this|(is|with|about|of) this|trust|bother|worr|not sure|unsure|on behalf|mitä (minun |meidän )?(pitäisi|kannattaa|teen|teemme|tehdä)|tämä|tämän|tälle|tässä|katso|tarkista|luotettav|mietity|huolestutt|hätä|en ole varma|en tiedä|puolesta|vad ska (jag|vi)|det här|den här|titta|kolla|pålitlig|oroar|inte säker|vet inte|räkning|help|worried|scared|afraid|wrong|strange|weird|odd|suspicious|scam|fraud|hack|phish|leak|breach|stolen|steal|drain|missing|disappear|unauthori|blackmail|extort|threaten|nude|kirist|uhka|alaston|utpress|hota|naken|track|stalk|spy|vakoil|seuraa minua|seuraa sijainti|spårar|förföl|never arrived|ei tullut|kom aldrig|in my name|nimissäni|mitt namn|identity|henkilöllisyy|identitet|unknown devices|recogni|kadon|hävin|katos|tuntemat|försvunn|försvann|okänd|virus|spam|fake|threat|blackmail|lost|locked|someone|somebody|apu|auta|huolissa|pelotta|outo|oudo|epäily|huijau|huijari|hakker|murto|vuoto|vuoti|varast|kirist|feik|joku|hjälp|orolig|rädd|konstig|misstänk|bedr|hack|läck|stul|stöld|utpress|falsk|någon)`), "iu");
// What the keyword reader fills in for any sentence, which says nothing about relevance.
const DEFAULT_TYPES: (Facts["incidentType"])[] = [null, "message_or_notice", "other"];

// A request with nothing to do with security, such as "write me an essay". Anything
// worried, mentioned or extracted counts as on topic, so a real report is never turned away.
export function isOffTopic(text: string, facts: Facts): boolean {
  if (detectMentions(text).length > 0 || CONCERN.test(fold(text))) return false;
  const extracted = facts.evidence.some((item) => item.fact !== "incidentType") || !DEFAULT_TYPES.includes(facts.incidentType)
    || facts.userAlreadyDid.length > 0 || facts.asksFor.length > 0 || facts.dataExposed.length > 0 || facts.assetInvolved.length > 0
    || facts.pretendsToBe !== null || facts.happeningNow === true || facts.personalSafetyRisk === true || facts.asksToTracePerson;
  return !extracted;
}

// A message that is only a greeting or a test holds nothing to assess yet.
const GREETING = new RegExp(fold(String.raw`^[\s\p{P}]*((hi|hello|hey|hiya|yo|good (morning|afternoon|evening|day)|test(ing)?|moi|moikka|hei|heippa|terve|huomenta|päivää|iltaa|hej|hejsan|hallå|tjena|god (morgon|dag|kväll))[\s\p{P}]*)+(there|safestep)?[\s\p{P}]*$`), "iu");
export const isGreetingOnly = (text: string) => GREETING.test(fold(text.trim())) || text.trim().replace(/[\s\p{P}]/gu, "").length === 0;
