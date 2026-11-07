import { z } from "zod";
import copy from "../content/link-check.json";
import { fold } from "./offline-extractor";
import type { Language } from "./types";

// Checks a link the user received, without ever opening it. Code decides the verdict from the
// address itself and public facts about its domain (age, whether it exists). An optional AI
// reading of the address can add warning signs and name a likely owner, but it can only make the
// verdict stricter: only an exact official domain is "safe", and only an established domain with
// a clean analysis gets "no warning signs found".

// ok: no warning signs on an established domain, which is not the same as confirmed safe.
export type LinkVerdict = "safe" | "ok" | "risky" | "avoid";
export type LinkSign =
  | "official_domain" | "lookalike" | "impersonation" | "ip_address" | "punycode" | "userinfo" | "shortener"
  | "download_file" | "suspicious_tld" | "login_or_payment" | "not_https" | "many_subdomains" | "random_characters" | "unknown_site"
  | "new_domain" | "recent_domain" | "established_domain" | "not_resolving" | "not_registered" | "no_red_flags" | "ai_owner";

// One row of the analysis, like a line in a security report.
export type LinkCheckRow = { id: string; label: string; value: string; status: "pass" | "warn" | "fail" | "info" };

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
  // The full analysis, for links. Senders have reasons only.
  analysis?: { title: string; rows: LinkCheckRow[] };
  checkedBy: string;
  usedAi: boolean;
};

// What the AI may say about an address. Strict: no verdict, no free text beyond a name.
export const LinkReading = z.strictObject({
  impersonates: z.string().max(40).nullable(),
  owner: z.string().max(60).nullable().optional(),
  signs: z.array(z.enum(["lookalike_domain", "random_characters", "login_or_payment_page", "download_file"])).max(4),
});
export type LinkReading = z.infer<typeof LinkReading>;
export type LinkReader = (input: { url: string; language: Language }) => Promise<unknown>;

// Public facts about a domain. null means it couldn't be looked up, never "no".
export type DomainIntel = { registeredAt: string | null; registered: boolean | null; resolves: boolean | null };
export type DomainLookup = (domain: string) => Promise<DomainIntel>;

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

// The registrable part of a host: "secure.nordea.fi" -> "nordea.fi", "shop.example.co.uk" -> "example.co.uk".
const TWO_PART_SUFFIXES = new Set(["co.uk", "org.uk", "ac.uk", "gov.uk", "com.au", "net.au", "co.nz", "co.jp", "com.br", "com.tr", "co.za", "com.cn", "com.mx", "co.in"]);
export const registrable = (host: string) => {
  const labels = host.split(".");
  return labels.slice(TWO_PART_SUFFIXES.has(labels.slice(-2).join(".")) ? -3 : -2).join(".");
};

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

function fill(template: string, values: Record<string, string | null | undefined>) {
  return template.replace(/\{(\w+)\}/g, (_, key) => values[key] ?? "");
}

const LOCALE: Record<Language, string> = { en: "en-GB", fi: "fi-FI", sv: "sv-FI" };

// "3 years", "5 months", "12 days", in the user's language.
function ageText(days: number, language: Language): string {
  const units = copy.analysis[language].units;
  if (days >= 730) return `${Math.floor(days / 365)} ${units.years}`;
  if (days >= 365) return `1 ${units.year}`;
  if (days >= 60) return `${Math.floor(days / 30)} ${units.months}`;
  if (days >= 30) return `1 ${units.month}`;
  return `${Math.max(1, Math.round(days))} ${days < 1.5 ? units.day : units.days}`;
}

export function checkLink(raw: string, language: Language, reading?: LinkReading | null, intel?: DomainIntel | null, now = Date.now()): LinkCheck | null {
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
  const extension = url.pathname.match(DOWNLOAD)?.[1]?.toLowerCase() ?? null;

  if (ip) signs.add("ip_address");
  if (punycode) signs.add("punycode");
  if (userinfo) signs.add("userinfo");
  if (SHORTENERS.has(host)) signs.add("shortener");
  if (extension) signs.add("download_file");
  if (!officialBrand && borrowed) signs.add("lookalike");
  if (SUSPICIOUS_TLDS.has(tld)) signs.add("suspicious_tld");
  if (!officialBrand && LOGIN_OR_PAYMENT.test(host + url.pathname)) signs.add("login_or_payment");
  if (!https) signs.add("not_https");
  if (!officialBrand && host.split(".").length > 3) signs.add("many_subdomains");

  // The AI's reading adds signs. It can't remove any, and it can't make an unknown site safe.
  const impersonates = reading?.impersonates?.trim() || null;
  const aiOwner = !officialBrand && !impersonates ? reading?.owner?.trim() || null : null;
  if (reading) {
    if (impersonates && !officialBrand) signs.add("impersonation");
    if (reading.signs.includes("lookalike_domain") && !officialBrand) signs.add("lookalike");
    if (reading.signs.includes("random_characters") && !officialBrand) signs.add("random_characters");
    if (reading.signs.includes("login_or_payment_page") && !officialBrand) signs.add("login_or_payment");
    if (reading.signs.includes("download_file")) signs.add("download_file");
  }

  // Public domain records: age and whether the name exists.
  const registeredMs = intel?.registeredAt ? Date.parse(intel.registeredAt) : NaN;
  const ageDays = Number.isNaN(registeredMs) ? null : (now - registeredMs) / 86_400_000;
  if (!officialBrand && !ip) {
    if (intel?.registered === false) signs.add("not_registered");
    else if (intel?.resolves === false) signs.add("not_resolving");
    if (ageDays !== null && ageDays < 30) signs.add("new_domain");
    else if (ageDays !== null && ageDays < 180) signs.add("recent_domain");
    else if (ageDays !== null && ageDays >= 365) signs.add("established_domain");
  }

  const strong: LinkSign[] = ["lookalike", "impersonation", "ip_address", "punycode", "userinfo", "download_file", "new_domain", "not_registered"];
  const caution: LinkSign[] = ["shortener", "suspicious_tld", "random_characters", "many_subdomains", "not_https", "recent_domain", "not_resolving"];
  const official = Boolean(officialBrand) && https && !userinfo && !punycode && !signs.has("download_file");
  if (official) signs.add("official_domain");
  // "No warning signs" needs real evidence: the domain exists, is at least six months old, and
  // nothing in the analysis is a warning. A sign-in page is normal on an established site.
  const established = ageDays !== null && ageDays >= 180 && intel?.resolves !== false;
  const clean = established && !strong.some((sign) => signs.has(sign)) && !caution.some((sign) => signs.has(sign));
  const verdict: LinkVerdict = official ? "safe"
    : strong.some((sign) => signs.has(sign)) || (signs.has("suspicious_tld") && signs.has("login_or_payment")) ? "avoid"
    : clean ? "ok"
    : "risky";
  if (verdict === "ok") signs.add("no_red_flags");
  if (verdict === "risky" && !officialBrand && caution.every((sign) => !signs.has(sign))) signs.add("unknown_site");
  if (aiOwner) signs.add("ai_owner");

  const brand = officialBrand ?? (signs.has("lookalike") ? borrowed ?? impersonates : impersonates);
  const age = ageDays !== null ? ageText(ageDays, language) : null;
  const values = { brand, owner: aiOwner, age };
  // Most telling first. Good news only when the verdict is good.
  const ORDER: LinkSign[] = ["official_domain", "not_registered", "lookalike", "impersonation", "new_domain", "download_file", "ip_address", "punycode", "userinfo", "not_resolving", "shortener", "suspicious_tld", "login_or_payment", "recent_domain", "random_characters", "many_subdomains", "not_https", "established_domain", "no_red_flags", "ai_owner", "unknown_site"];
  const shown = ORDER.filter((sign) => signs.has(sign))
    .filter((sign) => verdict === "ok" || !["established_domain", "no_red_flags"].includes(sign))
    // A sign-in page is normal on an established or official site, so it isn't listed as a finding there.
    .filter((sign) => sign !== "login_or_payment" || (verdict !== "ok" && verdict !== "safe"))
    .slice(0, 4);

  // The full analysis, one row per check.
  const A = copy.analysis[language];
  const V = A.values;
  const row = (id: string, label: string, value: string, status: LinkCheckRow["status"]): LinkCheckRow => ({ id, label, value, status });
  const date = !Number.isNaN(registeredMs) ? new Intl.DateTimeFormat(LOCALE[language], { month: "short", year: "numeric" }).format(registeredMs) : null;
  const tricks = [ip && V.ip, userinfo && V.at_sign, punycode && V.lookalike_letters, signs.has("shortener") && V.shortened].filter(Boolean) as string[];
  const rows: LinkCheckRow[] = [
    officialBrand ? row("owner", A.owner, fill(V.official, values), "pass")
      : brand && (signs.has("lookalike") || signs.has("impersonation")) ? row("owner", A.owner, fill(V.pretends, values), "fail")
      : aiOwner ? row("owner", A.owner, fill(V.ai_owner, values), "info")
      : row("owner", A.owner, V.unknown, "warn"),
    officialBrand ? row("age", A.age, date ? fill(V.since, { date, age }) : V.yes, "pass")
      : intel?.registered === false ? row("age", A.age, V.not_registered, "fail")
      : ageDays === null ? row("age", A.age, V.lookup_failed, "info")
      : ageDays < 30 ? row("age", A.age, fill(V.days_old, values), "fail")
      : row("age", A.age, fill(V.since, { date, age }), ageDays >= 365 ? "pass" : "warn"),
    row("exists", A.exists, intel?.resolves === true || officialBrand ? V.yes : intel?.resolves === false ? V.no : V.lookup_failed, intel?.resolves === false && !officialBrand ? "fail" : intel?.resolves === true || officialBrand ? "pass" : "info"),
    row("lookalike", A.lookalike, signs.has("lookalike") || signs.has("impersonation") ? fill(V.imitates, values) : V.none_found, signs.has("lookalike") || signs.has("impersonation") ? "fail" : "pass"),
    row("https", A.https, https ? V.https : V.http, https ? "pass" : "warn"),
    row("ending", A.ending, fill(SUSPICIOUS_TLDS.has(tld) ? V.risky_ending : V.common_ending, { tld }), SUSPICIOUS_TLDS.has(tld) ? "warn" : "pass"),
    row("tricks", A.tricks, tricks.length ? tricks.join(", ") : V.none, ip || userinfo || punycode ? "fail" : tricks.length ? "warn" : "pass"),
    row("download", A.download, signs.has("download_file") ? fill(V.download_yes, { ext: extension ?? "app" }) : V.no, signs.has("download_file") ? "fail" : "pass"),
    row("page", A.page, signs.has("login_or_payment") ? V.signin : V.regular, signs.has("login_or_payment") && verdict !== "ok" && !official ? "warn" : "pass"),
  ];

  const verdictCopy = copy.verdict[verdict][language];
  const year = !Number.isNaN(registeredMs) ? String(new Date(registeredMs).getFullYear()) : "";
  const by = reading && intel ? "rules_ai_intel" : intel ? "rules_intel" : reading ? "rules_ai" : "rules";
  return {
    subject: "link",
    display,
    host,
    verdict,
    brand,
    signs: [...signs],
    title: verdictCopy.title,
    advice: fill(verdictCopy.advice, { brand, year }),
    reasons: shown.map((sign) => fill(copy.signs[sign][language], values)),
    analysis: { title: A.title, rows },
    checkedBy: copy.checkedBy[by][language],
    usedAi: Boolean(reading),
  };
}

// Reads the address with the AI and looks up the domain's public records at the same time, then
// decides with the rules. Any failure, timeout or invalid reply just leaves that part unknown.
export async function runLinkCheck(raw: string, language: Language, reader?: LinkReader, lookup?: DomainLookup): Promise<LinkCheck | null> {
  const parsed = parseLink(raw);
  if (!parsed) return null;
  const host = parsed.url.hostname.toLowerCase().replace(/^www\./, "");
  const ip = /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.startsWith("[");
  const [reading, intel] = await Promise.all([
    reader
      ? reader({ url: parsed.display, language }).then((value) => {
          const result = LinkReading.safeParse(value);
          return result.success ? result.data : null;
        }).catch(() => null)
      : Promise.resolve(null),
    lookup && !ip && !OFFICIAL[registrable(host)] ? lookup(registrable(host)).catch(() => null) : Promise.resolve(null),
  ]);
  return checkLink(raw, language, reading, intel);
}

// How a verdict feeds the decision rules: the same signal a DNA link check would give.
// "No warning signs" stays unknown to the rules: it is evidence, not confirmation.
export const verdictSignal = (verdict: LinkVerdict): "clean" | "unknown" | "malicious" | "suspicious" => (verdict === "safe" ? "clean" : verdict === "ok" ? "unknown" : verdict === "avoid" ? "malicious" : "suspicious");

// --- What the user received: the form, and the sender check ---

export type EvidenceChannel = "email" | "sms" | "call" | "web";
export type EvidenceFieldId = "link" | "sender" | "content";
export type EvidenceQuestion = { id: EvidenceFieldId; question: string; hint: string; placeholder: string };

// The questions that fit the situation, one at a time and most telling first. Each can be skipped.
export function evidenceQuestions(channel: EvidenceChannel, language: Language): EvidenceQuestion[] {
  const text = copy.evidence[language].questions;
  const ask = (id: EvidenceFieldId, key: keyof typeof text): EvidenceQuestion => ({ id, ...text[key] });
  const order: Record<EvidenceChannel, EvidenceQuestion[]> = {
    call: [ask("sender", "sender_call"), ask("content", "content_call")],
    email: [ask("sender", "sender_email"), ask("content", "content_email"), ask("link", "link")],
    sms: [ask("sender", "sender_sms"), ask("content", "content_sms"), ask("link", "link")],
    web: [ask("link", "link"), ask("content", "content_web")],
  };
  return order[channel];
}
export const evidenceRetry = (language: Language) => copy.evidence[language].retry;

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
