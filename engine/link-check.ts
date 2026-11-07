import { z } from "zod";
import copy from "../content/link-check.json";
import { fold } from "./offline-extractor";
import type { Language } from "./types";

// Checks a link the user received, without ever opening it. Code decides the verdict from the
// address itself. An optional AI reading of the address can add warning signs, which can only
// make the verdict stricter: nothing but an exact official domain is ever called safe.

export type LinkVerdict = "safe" | "risky" | "avoid";
export type LinkSign =
  | "official_domain" | "lookalike" | "impersonation" | "ip_address" | "punycode" | "userinfo" | "shortener"
  | "download_file" | "suspicious_tld" | "login_or_payment" | "not_https" | "many_subdomains" | "random_characters" | "unknown_site";

export type LinkCheck = {
  // What was checked: a received link, or who sent the message or made the call.
  subject: "link" | "sender";
  // The address as shown and as sent to the AI: scheme, host and path, never the query or fragment.
  display: string;
  host: string;
  verdict: LinkVerdict;
  brand: string | null;
  signs: LinkSign[];
  title: string;
  advice: string;
  reasons: string[];
  checkedBy: string;
  usedAi: boolean;
};

// What the AI may say about an address. Strict: no verdict, no free text.
export const LinkReading = z.strictObject({
  impersonates: z.string().max(40).nullable(),
  signs: z.array(z.enum(["lookalike_domain", "random_characters", "login_or_payment_page", "download_file"])).max(4),
});
export type LinkReading = z.infer<typeof LinkReading>;
export type LinkReader = (input: { url: string; language: Language }) => Promise<unknown>;

// Official domains of the services Finnish users meet most, and the name to show.
const OFFICIAL: Record<string, string> = {
  "dna.fi": "DNA", "elisa.fi": "Elisa", "telia.fi": "Telia", "moi.fi": "Moi",
  "nordea.fi": "Nordea", "nordea.com": "Nordea", "op.fi": "OP", "danskebank.fi": "Danske Bank", "s-pankki.fi": "S-Pankki",
  "aktia.fi": "Aktia", "handelsbanken.fi": "Handelsbanken", "saastopankki.fi": "Säästöpankki", "poppankki.fi": "POP Pankki",
  "alandsbanken.fi": "Ålandsbanken", "omasp.fi": "Oma Säästöpankki", "mobilepay.fi": "MobilePay",
  "suomi.fi": "Suomi.fi", "vero.fi": "Vero", "kela.fi": "Kela", "poliisi.fi": "Poliisi", "posti.fi": "Posti",
  "traficom.fi": "Traficom", "kyberturvallisuuskeskus.fi": "Kyberturvallisuuskeskus", "dvv.fi": "DVV",
  "microsoft.com": "Microsoft", "apple.com": "Apple", "google.com": "Google",
};
// Names scams borrow. A host that carries one without being that service is a look-alike.
const BRANDS: [string, RegExp][] = [
  ["DNA", /(^|[.-])dna([.-]|$)/], ["Elisa", /elisa/], ["Telia", /telia/], ["Nordea", /nordea/], ["OP", /(^|[.-])op([.-]|$)|osuuspankki/],
  ["Danske Bank", /danske/], ["S-Pankki", /s-?pankki/], ["Aktia", /aktia/], ["Handelsbanken", /handelsbanken/], ["Säästöpankki", /saastopankki|saasto/],
  ["Ålandsbanken", /alandsbanken/], ["MobilePay", /mobilepay/], ["Suomi.fi", /suomi-?fi/], ["Vero", /(^|[.-])vero([.-]|$)|verohallinto/],
  ["Kela", /(^|[.-])kela([.-]|$)/], ["Poliisi", /poliisi/], ["Posti", /(^|[.-])posti([.-]|$)/], ["Traficom", /traficom/],
  ["Microsoft", /microsoft|office365|outlook/], ["Apple", /apple|icloud/], ["Netflix", /netflix/], ["PayPal", /paypal/],
];
const SHORTENERS = new Set(["bit.ly", "tinyurl.com", "t.co", "goo.gl", "is.gd", "cutt.ly", "rb.gy", "t.ly", "ow.ly", "shorturl.at", "tiny.cc", "s.id"]);
const SUSPICIOUS_TLDS = new Set(["top", "xyz", "click", "link", "info", "online", "site", "shop", "icu", "buzz", "live", "rest", "cam", "monster", "sbs", "cfd", "invalid"]);
const DOWNLOAD = /\.(apk|exe|msi|scr|dmg|pkg|ipa|mobileconfig|bat|cmd|js|vbs|jar)$/i;
const LOGIN_OR_PAYMENT = /login|log-in|signin|sign-in|verify|verif|secure|account|update|password|kirjaudu|tunnistau|vahvista|maksu|payment|pay\b|betala|logga|konto|pankki|bank/i;
// Digits used as letters in look-alike names: n0rdea, te1ia.
const unleet = (host: string) => host.replace(/0/g, "o").replace(/1/g, "l").replace(/3/g, "e").replace(/5/g, "s").replace(/4/g, "a");

const URL_IN_TEXT = /(https?:\/\/[^\s<>"']+|www\.[^\s<>"']+|\b[a-z0-9][a-z0-9-]*(?:\.[a-z0-9-]+)*\.(?:fi|com|net|org|top|xyz|info|io|co|app|site|online|shop|link|click|ru|cn|se|eu|me|ly|gl|at|icu|live|invalid|example)\b(?:\/[^\s<>"']*)?)/i;
const LINK_WORDS = new RegExp(fold(String.raw`(?<![\p{L}])(link|links|url|website|web address|web page|site|linkki\w*|linkin|nettisivu\w*|sivusto\w*|länk\w*|webbplats\w*|webbsida\w*)(?![\p{L}])`), "iu");

export const findUrl = (text: string | null | undefined): string | null => text?.match(URL_IN_TEXT)?.[0]?.replace(/[).,;!?]+$/, "") ?? null;
export const mentionsLink = (text: string) => LINK_WORDS.test(fold(text)) || Boolean(findUrl(text));

// The registrable part of a host: "secure.nordea.fi" -> "nordea.fi".
const registrable = (host: string) => host.split(".").slice(-2).join(".");

// Returns null when the text isn't a web address at all.
export function parseLink(raw: string): { url: URL; https: boolean; display: string } | null {
  const text = raw.trim().replace(/[).,;!?]+$/, "");
  if (!text || /\s/.test(text)) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : `https://${text}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return null;
  }
  if (!["http:", "https:"].includes(url.protocol) || !url.hostname.includes(".")) return null;
  // Only an explicit http:// is insecure. A pasted "nordea.fi" just has no scheme written out.
  const https = !/^http:\/\//i.test(text);
  // The query and fragment can hold personal tokens, so they are never shown or sent.
  const display = `${url.protocol}//${url.hostname}${url.pathname === "/" ? "" : url.pathname}`;
  return { url, https, display };
}

function say(template: string, brand: string | null) {
  return template.replace(/\{brand\}/g, brand ?? "");
}

export function checkLink(raw: string, language: Language, reading?: LinkReading | null): LinkCheck | null {
  const parsed = parseLink(raw);
  if (!parsed) return null;
  const { url, https, display } = parsed;
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  const domain = registrable(host);
  const officialBrand = OFFICIAL[domain] ?? null;
  const signs = new Set<LinkSign>();
  const ip = /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.startsWith("[");
  const punycode = host.split(".").some((label) => label.startsWith("xn--"));
  const userinfo = Boolean(url.username) || raw.includes("@");
  const tld = host.split(".").at(-1) ?? "";
  const borrowed = BRANDS.find(([, pattern]) => pattern.test(unleet(host)))?.[0] ?? null;

  if (ip) signs.add("ip_address");
  if (punycode) signs.add("punycode");
  if (userinfo) signs.add("userinfo");
  if (SHORTENERS.has(host)) signs.add("shortener");
  if (DOWNLOAD.test(url.pathname)) signs.add("download_file");
  if (!officialBrand && borrowed) signs.add("lookalike");
  if (SUSPICIOUS_TLDS.has(tld)) signs.add("suspicious_tld");
  if (!officialBrand && LOGIN_OR_PAYMENT.test(host + url.pathname)) signs.add("login_or_payment");
  if (!https) signs.add("not_https");
  if (!officialBrand && host.split(".").length > 3) signs.add("many_subdomains");

  // The AI's reading adds signs. It can't remove any, and it can't make an unknown site safe.
  const impersonates = reading?.impersonates?.trim() || null;
  if (reading) {
    if (impersonates && !officialBrand) signs.add("impersonation");
    if (reading.signs.includes("lookalike_domain") && !officialBrand) signs.add("lookalike");
    if (reading.signs.includes("random_characters") && !officialBrand) signs.add("random_characters");
    if (reading.signs.includes("login_or_payment_page") && !officialBrand) signs.add("login_or_payment");
    if (reading.signs.includes("download_file")) signs.add("download_file");
  }

  const strong: LinkSign[] = ["lookalike", "impersonation", "ip_address", "punycode", "userinfo", "download_file"];
  const official = Boolean(officialBrand) && https && !userinfo && !punycode && !signs.has("download_file");
  if (official) signs.add("official_domain");
  else if (!officialBrand) signs.add("unknown_site");
  const verdict: LinkVerdict = official ? "safe"
    : strong.some((sign) => signs.has(sign)) || (signs.has("suspicious_tld") && signs.has("login_or_payment")) ? "avoid"
    : "risky";

  const brand = officialBrand ?? (signs.has("lookalike") ? borrowed ?? impersonates : impersonates);
  // Most telling signs first; "not on our list" only when nothing more specific was found.
  const ORDER: LinkSign[] = ["official_domain", "lookalike", "impersonation", "download_file", "ip_address", "punycode", "userinfo", "shortener", "suspicious_tld", "login_or_payment", "random_characters", "many_subdomains", "not_https", "unknown_site"];
  const shown = ORDER.filter((sign) => signs.has(sign)).filter((sign) => sign !== "unknown_site" || signs.size === 1 || verdict === "risky").slice(0, 4);
  const verdictCopy = copy.verdict[verdict][language];
  return {
    subject: "link",
    display,
    host,
    verdict,
    brand,
    signs: [...signs],
    title: verdictCopy.title,
    advice: say(verdictCopy.advice, brand),
    reasons: shown.map((sign) => say(copy.signs[sign][language], brand)),
    checkedBy: copy.checkedBy[reading ? "rules_ai" : "rules"][language],
    usedAi: Boolean(reading),
  };
}

// Reads the address with the AI when one is available, then decides with the rules. Any AI
// failure, timeout or invalid reply falls back to the rules alone.
export async function runLinkCheck(raw: string, language: Language, reader?: LinkReader): Promise<LinkCheck | null> {
  const parsed = parseLink(raw);
  if (!parsed) return null;
  let reading: LinkReading | null = null;
  if (reader) {
    try {
      const result = LinkReading.safeParse(await reader({ url: parsed.display, language }));
      reading = result.success ? result.data : null;
    } catch {
      reading = null;
    }
  }
  return checkLink(raw, language, reading);
}

// How a verdict feeds the decision rules: the same signal a DNA link check would give.
export const verdictSignal = (verdict: LinkVerdict): "clean" | "malicious" | "suspicious" => (verdict === "safe" ? "clean" : verdict === "avoid" ? "malicious" : "suspicious");

// --- What the user received: the form, and the sender check ---

export type EvidenceChannel = "email" | "sms" | "call" | "web";
export type EvidenceFieldId = "link" | "sender" | "content";
export type EvidenceField = { id: EvidenceFieldId; label: string; placeholder: string; multiline: boolean };

// The fields that fit the situation, most telling first. Every one is optional.
export function evidenceForm(channel: EvidenceChannel, language: Language): { message: string; hint: string; retry: string; fields: EvidenceField[] } {
  const text = copy.evidence[language];
  const field = (id: EvidenceFieldId, key: keyof typeof text.fields): EvidenceField => ({ id, ...text.fields[key], multiline: id === "content" });
  const fields: Record<EvidenceChannel, EvidenceField[]> = {
    email: [field("sender", "sender_email"), field("content", "content_email"), field("link", "link")],
    sms: [field("sender", "sender_sms"), field("content", "content_sms"), field("link", "link")],
    call: [field("sender", "sender_call"), field("content", "content_call")],
    web: [field("link", "link"), field("content", "content_web")],
  };
  return { message: channel === "call" ? text.message_call : text.message, hint: text.hint, retry: text.retry, fields: fields[channel] };
}
export const evidenceCopy = (language: Language) => copy.evidence[language];

const FREE_MAIL = new Set(["gmail.com", "googlemail.com", "outlook.com", "hotmail.com", "live.com", "msn.com", "yahoo.com", "icloud.com", "me.com", "aol.com", "protonmail.com", "proton.me", "gmx.com", "gmx.net", "mail.com", "yandex.com", "luukku.com", "suomi24.fi"]);
const HIDDEN = /^(hidden|private|unknown|no caller id|withheld|piilotettu|tuntematon|salainen|dolt|okänt|privat)$/i;

// Checks who sent a message or made a call, from what the user typed. Like the link check,
// "safe" needs an exact official address, and a claim to be an organisation raises the bar.
// claims: whether the message or caller claims to be a bank, operator, authority or company.
export function checkSender(raw: string, channel: EvidenceChannel, language: Language, claims: boolean): LinkCheck | null {
  const text = raw.trim().slice(0, 200);
  if (!text) return null;
  const signs: string[] = [];
  let verdict: LinkVerdict = "risky";
  let brand: string | null = null;
  let display = text;
  let host = text;

  const email = text.match(/^(?:"?([^"<]*)"?\s*)?<?([^\s<>@]+@([^\s<>@]+\.[a-z]{2,}))>?$/i);
  const digits = text.replace(/[\s()-]/g, "");
  if (email) {
    const [, name = "", address, domainRaw] = email;
    const domain = domainRaw!.toLowerCase();
    display = address!.toLowerCase();
    host = domain;
    const official = OFFICIAL[registrable(domain)] ?? null;
    const borrowed = BRANDS.find(([, pattern]) => pattern.test(unleet(domain)))?.[0] ?? null;
    const named = BRANDS.find(([, pattern]) => pattern.test(unleet(fold(name).toLowerCase().replace(/\s+/g, "-"))))?.[0] ?? null;
    if (official) {
      brand = official;
      signs.push("official_sender");
      verdict = named && named !== official ? "avoid" : "safe";
      if (verdict === "avoid") signs.push("display_mismatch");
    } else if (borrowed) {
      brand = borrowed;
      signs.push("lookalike");
      verdict = "avoid";
    } else if (FREE_MAIL.has(registrable(domain)) || FREE_MAIL.has(domain)) {
      signs.push("free_mail");
      verdict = claims || named ? "avoid" : "risky";
      if (named) { brand = named; signs.push("display_mismatch"); }
    } else {
      if (named) { brand = named; signs.push("display_mismatch"); verdict = "avoid"; }
      signs.push("unknown_domain");
    }
  } else if (HIDDEN.test(text)) {
    signs.push("hidden_number");
    verdict = claims ? "avoid" : "risky";
  } else if (/^\+?\d{6,15}$/.test(digits)) {
    display = digits;
    host = digits;
    const finnish = digits.startsWith("+358") || digits.startsWith("00358") || /^0\d/.test(digits);
    if (!finnish) {
      signs.push(claims ? "foreign_number" : "foreign_number_plain");
      verdict = claims ? "avoid" : "risky";
    } else if (claims && /^(\+358|00358|0)4\d|^(\+358|00358|0)50/.test(digits)) {
      signs.push("mobile_claiming");
    }
    signs.push(channel === "call" ? "caller_id" : "name_sender");
  } else {
    // A name such as "Posti" or "OP" shown as the sender of a text.
    brand = BRANDS.find(([, pattern]) => pattern.test(unleet(fold(text).toLowerCase())))?.[0] ?? null;
    signs.push("name_sender");
  }

  const verdictCopy = copy.senderVerdict[verdict][language];
  const say = (template: string) => template.replace(/\{brand\}/g, brand ?? "");
  return {
    subject: "sender",
    display,
    host,
    verdict,
    brand,
    signs: [] as LinkSign[],
    title: verdictCopy.title,
    advice: say(verdictCopy.advice).replace(/\s+'s\b/, "").replace(/ {2,}/g, " "),
    reasons: signs.slice(0, 3).map((sign) => say(copy.senderSigns[sign as keyof typeof copy.senderSigns][language])),
    checkedBy: copy.checkedBy.sender[language],
    usedAi: false,
  };
}
