import { fold } from "./offline-extractor";
import { guardInput } from "./input-guard";
import type { LinkCheck } from "./link-check";
import type { Language } from "./types";

// Scam X-ray: the message the user received, with the tricks scammers use marked in place.
// It explains, it never decides. Genuine messages can contain these words too, so the card
// never says "safe" and never changes the action. The text is masked before it is shown.

export type XrayKind = "injection" | "code" | "credentials" | "payment" | "urgency" | "threat" | "prize" | "secrecy" | "new_number" | "remote" | "link";
export type XrayFlag = { start: number; end: number; kind: XrayKind; label: string; why: string; level: "high" | "medium" };
export type Xray = { text: string; flags: XrayFlag[]; kinds: XrayKind[] };

const b = String.raw`(?<![\p{L}\p{N}])`;
const e = String.raw`(?![\p{L}\p{N}])`;
// Patterns run on folded text (ä→a, ö→o, å→a), which keeps every index the same as the original.
const rx = (source: string) => new RegExp(fold(source), "giu");

const PATTERNS: { kind: Exclude<XrayKind, "link" | "injection">; re: RegExp }[] = [
  { kind: "code", re: rx(String.raw`${b}(verification code|confirmation code|security code|one[- ]time (code|password)|the code|your code|codes?|pin( code)?|otp|tunnusluku\p{L}*|vahvistuskoodi\p{L}*|turvakoodi\p{L}*|koodi\p{L}*|pin-koodi\p{L}*|engångskod\p{L}*|verifieringskod\p{L}*|säkerhetskod\p{L}*|koden|kod)${e}`) },
  { kind: "credentials", re: rx(String.raw`${b}(log ?in|sign ?in|password|verify your (account|identity|details)|confirm your (account|identity|details)|update your (details|information|payment)|bank ?id|online banking|kirjaudu\p{L}*|salasan\p{L}*|pankkitunnu\p{L}*|verkkopankki\p{L}*|vahvista (tietosi|henkilöllisyytesi|tilisi)|päivitä tietosi|logga in|lösenord\p{L}*|bekräfta (dina uppgifter|din identitet|ditt konto)|uppdatera dina uppgifter)${e}`) },
  { kind: "payment", re: rx(String.raw`(\d+[.,]?\d*\s?(€|eur(os?)?${e})|€\s?\d+|${b}(pay( now)?|payment|fee|customs|gift ?cards?|bitcoin|crypto|transfer the|maksa\p{L}*|maksu\p{L}*|tulli\p{L}*|lahjakort\p{L}*|siirrä|betala\p{L}*|avgift\p{L}*|tull\p{L}*|presentkort\p{L}*|överför)${e})`) },
  { kind: "urgency", re: rx(String.raw`${b}(urgent(ly)?|immediately|right away|right now|within \d+ (hours?|minutes?|days?)|today|tonight|last chance|final (notice|reminder|warning)|expires?|asap|kiireellinen|kiire\p{L}*|heti|välittömästi|nyt heti|\d+ (tunnin|minuutin|päivän) kuluessa|tänään|viimeinen (mahdollisuus|muistutus)|vanhene\p{L}*|brådskande|omedelbart|genast|inom \d+ (timmar|minuter|dagar)|i dag|idag|sista chansen|sista påminnelsen|löper ut)${e}`) },
  { kind: "threat", re: rx(String.raw`${b}(suspend(ed)?|block(ed)?|clos(ed|e)|lock(ed)?|deactivat(ed|e)|delet(ed|e)|fine|penalty|legal action|debt collection|arrest|suljetaan|suljettu|estetään|estetty|lukitaan|lukittu|poistetaan|sakko\p{L}*|perintä\p{L}*|oikeustoim\p{L}*|pidätys|stängs|stängt|spärra\p{L}*|låses|låst|raderas|böter|inkasso|rättsliga åtgärder)${e}`) },
  { kind: "prize", re: rx(String.raw`${b}(you('ve| have)? won|winner|prize|reward|free gift|congratulations|claim your|voitit|voittaja\p{L}*|palkinto\p{L}*|onnittelu\p{L}*|lunasta|du har vunnit|vinnare|vinst\p{L}*|grattis|gratulerar)${e}`) },
  { kind: "secrecy", re: rx(String.raw`${b}(don'?t tell|do not tell|keep (this|it) (secret|confidential|between us)|confidential|älä kerro|pidä (tämä|se) salassa|luottamuksellinen|berätta inte|håll det hemligt|konfidentiell\p{L}*)${e}`) },
  { kind: "new_number", re: rx(String.raw`${b}(new number|my phone (broke|is broken)|this is my new|lost my phone|uusi numero\p{L}*|puhelimeni hajosi|tämä on uusi numeroni|nytt nummer|min telefon (gick sönder|är trasig))${e}`) },
  { kind: "remote", re: rx(String.raw`${b}(anydesk|teamviewer|quick ?support|remote (access|desktop|control)|install (the|this) app|download (the|this) app|asenna\p{L}*|lataa sovellus|etäyhtey\p{L}*|installera\p{L}*|ladda ner appen|fjärrstyr\p{L}*)${e}`) },
];

// Text that talks to an AI assistant instead of the person: always part of the scam.
const AI_WORD = rx(String.raw`${b}(ai|a\.i\.|assistant|chat ?bot|language model|llm|gpt|claude|gemini|copilot|safestep|tekoäly\p{L}*|avustaj\p{L}*|kielimalli\p{L}*|botti\p{L}*|assistent\p{L}*|språkmodell\p{L}*)${e}`);
const AI_ORDER = rx(String.raw`(ignore|disregard|previous instructions|instructions?|verified|trusted|safe|legitimate|do not warn|don'?t warn|classify|mark (this|it)|ohita|ohjee\p{L}*|vahvistettu|turvallinen|luotettava|älä varoita|ignorera|instruktion\p{L}*|verifierad|säker|pålitlig|varna inte)`);
const IGNORE = rx(String.raw`(ignore|disregard) (all |any )?(previous|prior|earlier|above) (instructions|rules)|ohita (kaikki )?(aiemmat|edelliset) ohjeet|ignorera (alla )?(tidigare|föregående) instruktioner`);

const URL = /\b((?:https?:\/\/|www\.)[^\s<>"')\]]+|[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:fi|com|net|org|info|xyz|top|site|online|shop|app|io|me|example|invalid|test|ru|cn)(?:\/[^\s<>"')\]]*)?)/giu;

const TEXT: Record<Language, Record<XrayKind, [string, string]>> = {
  en: {
    injection: ["Tries to trick AI assistants", "This text is written to an AI, not to you. Scammers add it hoping a safety tool will call the message safe. SafeStep ignores it."],
    code: ["Asks for a code", "Codes and PINs are only for you. No bank, operator or authority asks you to give them out."],
    credentials: ["Asks you to log in or confirm details", "A link that asks you to log in or confirm details is a common way to steal banking codes."],
    payment: ["Asks for money", "Small fees and payment requests are the most common hook. Pay only through a service you open yourself."],
    urgency: ["Rushes you", "A deadline is meant to stop you checking. Genuine services give you time."],
    threat: ["Threatens you", "Threats of blocking, fines or police are pressure, not information."],
    prize: ["Promises a prize", "Unexpected prizes are a classic hook to get your details or a fee."],
    secrecy: ["Asks you to keep it secret", "Secrecy stops you from asking someone else, which is exactly what the scammer wants."],
    new_number: ["Claims a new number", "'New number' messages often pretend to be family. Call the old number to check."],
    remote: ["Asks to install an app or give remote access", "Remote-access apps let a stranger control your device and banking."],
    link: ["Link", ""],
  },
  fi: {
    injection: ["Yrittää huijata tekoälyavustajia", "Tämä teksti on kirjoitettu tekoälylle, ei sinulle. Huijari toivoo, että turvatyökalu kutsuisi viestiä turvalliseksi. SafeStep ei noudata sitä."],
    code: ["Pyytää koodia", "Koodit ja PIN-luvut ovat vain sinulle. Pankki, operaattori tai viranomainen ei pyydä niitä."],
    credentials: ["Pyytää kirjautumaan tai vahvistamaan tietoja", "Linkki, joka pyytää kirjautumaan tai vahvistamaan tietoja, on yleinen tapa varastaa pankkitunnuksia."],
    payment: ["Pyytää rahaa", "Pienet maksut ja maksupyynnöt ovat yleisin koukku. Maksa vain palvelussa, jonka avaat itse."],
    urgency: ["Kiirehtii sinua", "Määräajan tarkoitus on estää sinua tarkistamasta. Aidot palvelut antavat aikaa."],
    threat: ["Uhkailee", "Uhkaukset estosta, sakoista tai poliisista ovat painostusta, eivät tietoa."],
    prize: ["Lupaa palkinnon", "Odottamaton palkinto on klassinen keino saada tietosi tai maksu."],
    secrecy: ["Pyytää pitämään salassa", "Salailu estää sinua kysymästä muilta, ja sitä huijari haluaa."],
    new_number: ["Väittää uutta numeroa", "'Uusi numero' -viestit esittävät usein perheenjäsentä. Soita vanhaan numeroon ja tarkista."],
    remote: ["Pyytää asentamaan sovelluksen tai etäyhteyden", "Etäkäyttösovelluksella vieras voi ohjata laitettasi ja pankkiasi."],
    link: ["Linkki", ""],
  },
  sv: {
    injection: ["Försöker lura AI-assistenter", "Den här texten är skriven till en AI, inte till dig. Bedragaren hoppas att ett säkerhetsverktyg ska kalla meddelandet säkert. SafeStep följer den inte."],
    code: ["Ber om en kod", "Koder och PIN är bara för dig. Ingen bank, operatör eller myndighet ber dig lämna ut dem."],
    credentials: ["Ber dig logga in eller bekräfta uppgifter", "En länk som ber dig logga in eller bekräfta uppgifter är ett vanligt sätt att stjäla bankkoder."],
    payment: ["Ber om pengar", "Små avgifter och betalningskrav är den vanligaste kroken. Betala bara i en tjänst du själv öppnar."],
    urgency: ["Stressar dig", "En tidsgräns ska hindra dig från att kontrollera. Äkta tjänster ger dig tid."],
    threat: ["Hotar dig", "Hot om spärr, böter eller polis är påtryckning, inte information."],
    prize: ["Lovar ett pris", "Oväntade vinster är en klassisk krok för att få dina uppgifter eller en avgift."],
    secrecy: ["Ber dig hålla det hemligt", "Hemlighetsmakeri hindrar dig från att fråga någon annan, vilket bedragaren vill."],
    new_number: ["Påstår ett nytt nummer", "'Nytt nummer'-meddelanden låtsas ofta vara familj. Ring det gamla numret och kontrollera."],
    remote: ["Ber dig installera en app eller ge fjärråtkomst", "Fjärrstyrningsappar låter en främling styra din enhet och din bank."],
    link: ["Länk", ""],
  },
};

const LEVEL: Record<XrayKind, "high" | "medium"> = {
  injection: "high", code: "high", credentials: "high", remote: "high", link: "high", payment: "medium",
  urgency: "medium", threat: "medium", prize: "medium", secrecy: "medium", new_number: "medium",
};
// When two marks overlap, the more important one wins.
const PRIORITY: XrayKind[] = ["injection", "link", "code", "credentials", "remote", "payment", "new_number", "secrecy", "threat", "prize", "urgency"];

const LINK_TEXT: Record<Language, Record<"avoid" | "risky" | "ok" | "unknown", string>> = {
  en: { avoid: "Dangerous link", risky: "Suspicious link", ok: "Link: no warning signs found", unknown: "Link: don't open it to check" },
  fi: { avoid: "Vaarallinen linkki", risky: "Epäilyttävä linkki", ok: "Linkki: varoitusmerkkejä ei löytynyt", unknown: "Linkki: älä avaa sitä tarkistaaksesi" },
  sv: { avoid: "Farlig länk", risky: "Misstänkt länk", ok: "Länk: inga varningstecken hittades", unknown: "Länk: öppna den inte för att kontrollera" },
};

function sentences(text: string): { start: number; end: number }[] {
  const out: { start: number; end: number }[] = [];
  const re = /[^.!?\n]+[.!?]*/gu;
  for (const match of text.matchAll(re)) {
    const raw = match[0];
    const lead = raw.length - raw.trimStart().length;
    const trimmed = raw.trim();
    if (trimmed) out.push({ start: match.index! + lead, end: match.index! + lead + trimmed.length });
  }
  return out;
}

export function xrayMessage(raw: string, language: Language, links: (LinkCheck | null | undefined)[] = []): Xray | null {
  const text = guardInput(raw).userText.trim();
  if (text.length < 15) return null;
  const folded = fold(text);
  const copy = TEXT[language];
  const found: XrayFlag[] = [];
  const add = (start: number, end: number, kind: XrayKind, label?: string, why?: string) =>
    found.push({ start, end, kind, label: label ?? copy[kind][0], why: why ?? copy[kind][1], level: LEVEL[kind] });

  for (const sentence of sentences(folded)) {
    const part = folded.slice(sentence.start, sentence.end);
    AI_WORD.lastIndex = 0;
    AI_ORDER.lastIndex = 0;
    IGNORE.lastIndex = 0;
    if ((AI_WORD.test(part) && AI_ORDER.test(part)) || IGNORE.test(part)) add(sentence.start, sentence.end, "injection");
  }

  for (const match of text.matchAll(URL)) {
    const display = match[0].replace(/[.,;:!?]+$/u, "");
    const host = display.replace(/^https?:\/\//iu, "").replace(/^www\./iu, "").split(/[/?#]/u)[0]!.toLowerCase();
    const check = links.find((item) => item?.subject === "link" && item.host && (host.endsWith(item.host) || item.host.endsWith(host)));
    const verdict = check ? (check.verdict === "safe" ? "ok" : check.verdict) : "unknown";
    // A link only checked as fine is not marked: the card never marks something as safe.
    if (verdict === "ok") continue;
    const why = check?.reasons[0] ?? check?.advice ?? "";
    add(match.index!, match.index! + display.length, "link", LINK_TEXT[language][verdict], why || TEXT[language].credentials[1]);
  }

  for (const { kind, re } of PATTERNS) {
    re.lastIndex = 0;
    for (const match of folded.matchAll(re)) {
      // Don't mark the [CODE] placeholder that masking put in.
      if (/^\[[A-Z_]+\]$/u.test(text.slice(match.index!, match.index! + match[0].length))) continue;
      add(match.index!, match.index! + match[0].length, kind);
    }
  }

  // Keep the most important mark where marks overlap, then sort by position.
  const ranked = found.sort((a, z) => PRIORITY.indexOf(a.kind) - PRIORITY.indexOf(z.kind) || z.end - z.start - (a.end - a.start));
  const kept: XrayFlag[] = [];
  for (const flag of ranked) if (!kept.some((other) => flag.start < other.end && other.start < flag.end)) kept.push(flag);
  kept.sort((a, z) => a.start - z.start);
  // One mark is often just an ordinary word. Show the X-ray only when it says something.
  const kinds = PRIORITY.filter((kind) => kept.some((flag) => flag.kind === kind));
  if (kinds.length < 2 && !kinds.includes("injection")) return null;
  return { text, flags: kept, kinds };
}

// Which text to X-ray: what the user pasted, or a quoted message inside their own words.
export function xraySource(openingMessage: string, incidentContent: string | null): string | null {
  if (incidentContent?.trim()) return incidentContent;
  const quoted = openingMessage.match(/["“”«»„]([^"“”«»„]{25,})["“”«»„]/u)?.[1];
  if (quoted) return quoted;
  // "It said: ..." with the message after a colon or on the next lines.
  const after = openingMessage.match(/(?:said|says|saying|reads|luki|lukee|sanottiin|kuuluu|stod|står|lyder)\s*:\s*([\s\S]{25,})$/iu)?.[1];
  return after ?? null;
}
