import { lookup, resolve4, resolve6, resolveMx, resolveNs } from "node:dns/promises";
import { isIP } from "node:net";
import http from "node:http";
import https from "node:https";
import type { LookupFunction } from "node:net";
import type { TLSSocket } from "node:tls";
import type { Language, Risk } from "../engine/types";

// Opens links from a message the user received and scores how risky they are. Pages are
// fetched as plain text on the server: no scripts run, no forms are sent, no cookies are kept,
// and private or internal addresses are never contacted. The score only sets the visible
// link signal; the rules still make every decision.

export type Severity = "high" | "medium" | "low" | "good";
export type Verdict = "malicious" | "suspicious" | "unknown" | "clean";
export type Category = "reputation" | "address" | "domain" | "dns" | "certificate" | "page" | "message";
// detail: the finding's key value, such as "3 months" or ".top", for compact display.
export type Finding = { code: string; severity: Severity; category: Category; weight: number; text: string; detail?: string };

export type Technical = {
  domain: string;
  ips: string[];
  network: string | null;
  country: string | null;
  nameservers: string[];
  hasMail: boolean | null;
  registrar: string | null;
  registered: string | null;
  expires: string | null;
  certIssuer: string | null;
  certValidFrom: string | null;
  certValidTo: string | null;
  certValid: boolean | null;
  server: string | null;
  securityHeaders: string[];
  forms: number;
  externalScripts: number;
  feeds: string[];
};

export type LinkReport = {
  url: string;
  host: string;
  finalUrl: string | null;
  chain: string[];
  status: number | null;
  title: string | null;
  domainAgeDays: number | null;
  score: number;
  risk: Risk;
  verdict: Verdict;
  findings: Finding[];
  tech: Technical;
};

export type ContentAnalysis = {
  verdict: Verdict;
  risk: Risk;
  score: number;
  links: LinkReport[];
  message: Finding[];
  messageScore: number;
};

const MAX_LINKS = 3;
const TIMEOUT_MS = 6000;
const MAX_BYTES = 768 * 1024;
const MAX_REDIRECTS = 6;
const ALLOWED_PORTS = new Set(["", "80", "443", "8080", "8443"]);
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 SafeStepLinkCheck/2.0";
// An unknown site starts slightly above zero: nothing proves it is who it says it is.
const BASE_SCORE = 10;

const URL_PATTERN = /\b(?:https?:\/\/|www\.)[^\s<>"'()]+|\b(?:[a-z0-9-]+\.)+(?:fi|se|com|net|org|info|top|xyz|click|link|shop|online|live|icu|buzz|site|app|io|co|me|ly|gl|cc|ru|cn|cool|pro|biz)\/[^\s<>"'()]*/giu;

// Official domains for brands people in Finland are often impersonated as.
const BRANDS: Record<string, string[]> = {
  posti: ["posti.fi", "posti.com"],
  nordea: ["nordea.fi", "nordea.com"],
  osuuspankki: ["op.fi"],
  danske: ["danskebank.fi", "danskebank.com"],
  danskebank: ["danskebank.fi", "danskebank.com"],
  "s-pankki": ["s-pankki.fi"],
  spankki: ["s-pankki.fi"],
  aktia: ["aktia.fi"],
  handelsbanken: ["handelsbanken.fi", "handelsbanken.se"],
  saastopankki: ["saastopankki.fi"],
  omasp: ["omasp.fi"],
  vero: ["vero.fi"],
  verohallinto: ["vero.fi"],
  kela: ["kela.fi"],
  traficom: ["traficom.fi"],
  poliisi: ["poliisi.fi"],
  suomi: ["suomi.fi"],
  dna: ["dna.fi"],
  elisa: ["elisa.fi"],
  telia: ["telia.fi", "telia.se", "telia.com"],
  dhl: ["dhl.com", "dhl.fi"],
  ups: ["ups.com"],
  fedex: ["fedex.com"],
  postnord: ["postnord.fi", "postnord.se", "postnord.com"],
  paypal: ["paypal.com"],
  mobilepay: ["mobilepay.fi", "mobilepay.dk"],
  klarna: ["klarna.com"],
  microsoft: ["microsoft.com", "live.com", "office.com", "microsoftonline.com", "microsoft365.com"],
  outlook: ["outlook.com", "live.com", "office.com"],
  office365: ["office.com", "microsoft.com"],
  apple: ["apple.com", "icloud.com"],
  icloud: ["icloud.com", "apple.com"],
  netflix: ["netflix.com"],
  amazon: ["amazon.com", "amazon.de", "amazon.se"],
  google: ["google.com", "google.fi"],
  gmail: ["google.com", "gmail.com"],
  facebook: ["facebook.com", "fb.com"],
  instagram: ["instagram.com"],
  whatsapp: ["whatsapp.com"],
  linkedin: ["linkedin.com"],
  spotify: ["spotify.com"],
  steam: ["steampowered.com", "steamcommunity.com"],
  coinbase: ["coinbase.com"],
  binance: ["binance.com"],
};
const OFFICIAL = new Set(Object.values(BRANDS).flat());
// "op" is too short to match safely inside other words, so it only counts as a whole label.
const SHORT_BRANDS: Record<string, string> = { op: "op.fi" };

// Widely used sites. Being on this list lowers the score, but it's not "official" for any brand.
const WELL_KNOWN = new Set([
  "google.com", "youtube.com", "wikipedia.org", "github.com", "gitlab.com", "stackoverflow.com", "reddit.com", "x.com", "twitter.com", "yahoo.com", "bing.com", "duckduckgo.com",
  "yle.fi", "hs.fi", "is.fi", "iltalehti.fi", "mtvuutiset.fi", "kauppalehti.fi", "tori.fi", "verkkokauppa.com", "gigantti.fi", "power.fi", "s-kanava.fi", "k-ruoka.fi", "kesko.fi", "alko.fi", "vr.fi", "hsl.fi", "finnair.com", "terveystalo.com", "mehilainen.fi", "omakanta.fi", "kanta.fi", "helsinki.fi", "tampere.fi", "oulu.fi", "turku.fi", "aalto.fi", "tuni.fi",
  "bbc.co.uk", "bbc.com", "cnn.com", "nytimes.com", "theguardian.com", "reuters.com", "medium.com", "zoom.us", "slack.com", "dropbox.com", "notion.so", "atlassian.com", "adobe.com", "salesforce.com", "shopify.com", "stripe.com", "booking.com", "airbnb.com", "tripadvisor.com", "ebay.com", "etsy.com", "aliexpress.com", "ikea.com", "zalando.fi", "hm.com", "tiktok.com", "pinterest.com", "twitch.tv", "discord.com", "telegram.org", "signal.org", "mozilla.org", "cloudflare.com", "openai.com", "anthropic.com", "claude.ai",
]);

const SHORTENERS = new Set(["bit.ly", "tinyurl.com", "t.co", "goo.gl", "ow.ly", "is.gd", "buff.ly", "cutt.ly", "rb.gy", "shorturl.at", "t.ly", "s.id", "rebrand.ly", "tiny.cc", "lnkd.in", "qrco.de", "v.gd", "shorte.st"]);
// Free hosting and site builders, often used for throwaway phishing pages.
const FREE_HOSTS = ["blogspot.com", "weebly.com", "wixsite.com", "000webhostapp.com", "github.io", "vercel.app", "netlify.app", "pages.dev", "workers.dev", "firebaseapp.com", "web.app", "glitch.me", "repl.co", "herokuapp.com", "godaddysites.com", "square.site", "webflow.io", "framer.website", "sites.google.com", "ngrok.io", "ngrok-free.app", "trycloudflare.com", "duckdns.org", "azurewebsites.net", "r2.dev", "ipfs.io", "surge.sh", "onrender.com"];
const RISKY_TLDS = new Set(["top", "xyz", "click", "link", "info", "icu", "buzz", "shop", "online", "live", "site", "cyou", "rest", "sbs", "zip", "mov", "monster", "lol", "vip", "cfd", "bond", "quest", "win", "loan", "work", "support", "ru", "cn", "cool", "tk", "ml", "ga", "cf", "gq", "pw", "cam", "country", "stream", "download", "review", "fit", "today", "best"]);
const LURE_WORDS = /(?:log-?in|sign-?in|verify|verif|secure|update|account|confirm|unlock|suspend|payment|pay|refund|invoice|billing|wallet|tracking|delivery|customs|tunnistau|kirjaudu|vahvista|maksu|palautus|tulli|logga|betala|bekr[aä]fta|aterbetal)/iu;
const TWO_PART_SUFFIXES = new Set(["co.uk", "com.au", "co.jp", "com.br", "co.nz", "org.uk", "gov.uk", "ac.uk"]);

type Copy = Record<Language, string>;
const TEXT: Record<string, Copy> = {
  // Reputation
  feed_openphish: { en: "This exact link is on the OpenPhish list of active phishing sites.", fi: "Tämä linkki on OpenPhishin aktiivisten tietojenkalastelusivujen listalla.", sv: "Exakt den här länken finns på OpenPhish lista över aktiva nätfiskesidor." },
  feed_openphish_host: { en: "Other links on this website are on the OpenPhish phishing list.", fi: "Tämän sivuston muita linkkejä on OpenPhishin tietojenkalastelulistalla.", sv: "Andra länkar på den här webbplatsen finns på OpenPhish nätfiskelista." },
  feed_safebrowsing: { en: "Google Safe Browsing flags this link as {kind}.", fi: "Google Safe Browsing merkitsee linkin vaaralliseksi ({kind}).", sv: "Google Safe Browsing flaggar länken som farlig ({kind})." },
  official: { en: "The domain is {brand}'s official website.", fi: "Verkkotunnus on {brand}:n virallinen sivusto.", sv: "Domänen är {brand}s officiella webbplats." },
  well_known: { en: "A widely used, established website.", fi: "Laajasti käytetty, vakiintunut sivusto.", sv: "En välkänd och etablerad webbplats." },
  // Address
  ip_host: { en: "The link points to a bare IP address instead of a named website.", fi: "Linkki osoittaa pelkkään IP-osoitteeseen eikä nimettyyn sivustoon.", sv: "Länken pekar på en IP-adress i stället för en namngiven webbplats." },
  punycode: { en: "The address uses look-alike characters (punycode), a trick to imitate real sites.", fi: "Osoitteessa on samannäköisiä merkkejä (punycode), joilla jäljitellään aitoja sivuja.", sv: "Adressen använder förväxlingsbara tecken (punycode) för att efterlikna äkta sidor." },
  at_sign: { en: "The address hides its real destination behind an @ sign.", fi: "Osoite piilottaa todellisen kohteensa @-merkin taakse.", sv: "Adressen döljer sitt verkliga mål bakom ett @-tecken." },
  brand_mismatch: { en: "The address uses the name {brand}, but it is not {brand}'s official website.", fi: "Osoitteessa käytetään nimeä {brand}, mutta se ei ole {brand}:n virallinen sivusto.", sv: "Adressen använder namnet {brand}, men det är inte {brand}s officiella webbplats." },
  typosquat: { en: "The domain is a near-copy of {official}, a typical typo-squatting trick.", fi: "Verkkotunnus on lähes kopio osoitteesta {official}, tyypillinen kirjoitusvirhehuijaus.", sv: "Domänen är nästan en kopia av {official}, ett typiskt felstavningstrick." },
  shortener: { en: "A link shortener hides where the link really goes.", fi: "Lyhennyspalvelu piilottaa, minne linkki oikeasti vie.", sv: "En länkförkortare döljer vart länken egentligen går." },
  free_host: { en: "The page is on a free hosting service ({host}), where anyone can publish a site in minutes.", fi: "Sivu on ilmaisessa palvelussa ({host}), jossa kuka tahansa voi julkaista sivun minuuteissa.", sv: "Sidan ligger på en gratistjänst ({host}) där vem som helst kan publicera en sida på minuter." },
  risky_tld: { en: "The domain ending .{tld} is common on scam sites.", fi: "Verkkotunnuksen pääte .{tld} on yleinen huijaussivuilla.", sv: "Domänändelsen .{tld} är vanlig på bluffsidor." },
  many_subdomains: { en: "The address has an unusually long chain of subdomains.", fi: "Osoitteessa on epätavallisen pitkä aliverkkotunnusten ketju.", sv: "Adressen har en ovanligt lång kedja av underdomäner." },
  random_name: { en: "The domain name looks randomly generated.", fi: "Verkkotunnus näyttää satunnaisesti luodulta.", sv: "Domännamnet ser slumpmässigt genererat ut." },
  hyphens: { en: "The domain strings several words together with hyphens, a common phishing pattern.", fi: "Verkkotunnus yhdistää useita sanoja väliviivoilla, mikä on yleistä tietojenkalastelussa.", sv: "Domänen sätter ihop flera ord med bindestreck, ett vanligt nätfiskemönster." },
  no_https: { en: "The page is not encrypted (no HTTPS).", fi: "Sivu ei ole salattu (ei HTTPS:ää).", sv: "Sidan är inte krypterad (ingen HTTPS)." },
  lure_words: { en: "The address contains words like login, verify or payment that scam links use.", fi: "Osoitteessa on sanoja kuten kirjaudu, vahvista tai maksu, joita huijauslinkit käyttävät.", sv: "Adressen innehåller ord som logga in, bekräfta eller betala som bluffländar använder." },
  unusual_port: { en: "The link uses an unusual network port, so it was not opened.", fi: "Linkki käyttää epätavallista verkkoporttia, joten sitä ei avattu.", sv: "Länken använder en ovanlig nätverksport och öppnades därför inte." },
  blocked_private: { en: "The link points to a private network address and was not opened.", fi: "Linkki osoittaa yksityiseen verkko-osoitteeseen, eikä sitä avattu.", sv: "Länken pekar på en privat nätverksadress och öppnades inte." },
  redirect_offsite: { en: "The link redirects to a different website: {host}.", fi: "Linkki ohjaa toiselle sivustolle: {host}.", sv: "Länken omdirigerar till en annan webbplats: {host}." },
  long_chain: { en: "The link passes through {count} redirects before landing.", fi: "Linkki kulkee {count} uudelleenohjauksen kautta.", sv: "Länken går via {count} omdirigeringar innan den landar." },
  // Domain registration
  domain_new: { en: "The domain was registered only {age} ago.", fi: "Verkkotunnus rekisteröitiin vasta {age} sitten.", sv: "Domänen registrerades för bara {age} sedan." },
  domain_young: { en: "The domain is less than six months old ({age}).", fi: "Verkkotunnus on alle puoli vuotta vanha ({age}).", sv: "Domänen är mindre än sex månader gammal ({age})." },
  domain_recent: { en: "The domain is less than a year old ({age}).", fi: "Verkkotunnus on alle vuoden vanha ({age}).", sv: "Domänen är mindre än ett år gammal ({age})." },
  domain_old: { en: "The domain has been registered for {age}.", fi: "Verkkotunnus on ollut rekisteröity {age}.", sv: "Domänen har varit registrerad i {age}." },
  short_registration: { en: "The domain is only registered until {date}. Scam domains are often bought for the shortest period.", fi: "Verkkotunnus on rekisteröity vain {date} asti. Huijausverkkotunnukset ostetaan usein lyhimmäksi ajaksi.", sv: "Domänen är bara registrerad till {date}. Bluffdomäner köps ofta för kortast möjliga tid." },
  brand_protection: { en: "Registered through {registrar}, a registrar large companies use to protect their brands.", fi: "Rekisteröity palvelun {registrar} kautta, jota suuryritykset käyttävät brändiensä suojaamiseen.", sv: "Registrerad via {registrar}, en registrar som stora företag använder för att skydda sina varumärken." },
  age_unknown: { en: "The domain's registration date could not be confirmed.", fi: "Verkkotunnuksen rekisteröintipäivää ei voitu vahvistaa.", sv: "Domänens registreringsdatum kunde inte bekräftas." },
  // DNS and hosting
  no_dns: { en: "The domain doesn't resolve to any server.", fi: "Verkkotunnus ei osoita mihinkään palvelimeen.", sv: "Domänen pekar inte på någon server." },
  no_mail: { en: "The domain has no email service, unusual for a real company.", fi: "Verkkotunnuksella ei ole sähköpostipalvelua, mikä on epätavallista oikealle yritykselle.", sv: "Domänen har ingen e-posttjänst, vilket är ovanligt för ett riktigt företag." },
  // Certificate and headers
  cert_invalid: { en: "The site's security certificate is not valid ({reason}).", fi: "Sivuston tietoturvavarmenne ei ole kelvollinen ({reason}).", sv: "Webbplatsens säkerhetscertifikat är inte giltigt ({reason})." },
  cert_new: { en: "The security certificate was issued only {age} ago.", fi: "Tietoturvavarmenne myönnettiin vasta {age} sitten.", sv: "Säkerhetscertifikatet utfärdades för bara {age} sedan." },
  security_headers: { en: "The site uses modern security protections ({list}).", fi: "Sivusto käyttää nykyaikaisia suojauksia ({list}).", sv: "Webbplatsen använder moderna skydd ({list})." },
  // Page content
  password_form: { en: "The page asks for a password or login details.", fi: "Sivu pyytää salasanaa tai kirjautumistietoja.", sv: "Sidan ber om lösenord eller inloggningsuppgifter." },
  login_known_site: { en: "The page asks for a password. Only type it if you went to this site yourself, not from a message.", fi: "Sivu pyytää salasanaa. Kirjoita se vain, jos menit sivulle itse etkä viestin kautta.", sv: "Sidan ber om lösenord. Skriv det bara om du själv gick till sidan, inte via ett meddelande." },
  card_form: { en: "The page asks for card details.", fi: "Sivu pyytää korttitietoja.", sv: "Sidan ber om kortuppgifter." },
  bank_id_form: { en: "The page imitates a bank or strong-identification login.", fi: "Sivu jäljittelee pankki- tai vahvan tunnistautumisen kirjautumista.", sv: "Sidan efterliknar en bank- eller BankID-inloggning." },
  page_brand: { en: "The page presents itself as {brand}, but the website isn't {brand}'s.", fi: "Sivu esittäytyy nimellä {brand}, mutta sivusto ei ole {brand}:n.", sv: "Sidan utger sig för att vara {brand}, men webbplatsen tillhör inte {brand}." },
  form_offsite: { en: "Information typed on the page is sent to another site: {host}.", fi: "Sivulle syötetyt tiedot lähetetään toiselle sivustolle: {host}.", sv: "Uppgifter som skrivs på sidan skickas till en annan webbplats: {host}." },
  js_redirect: { en: "The page uses a script to send visitors somewhere else.", fi: "Sivu ohjaa kävijät skriptillä muualle.", sv: "Sidan skickar besökare vidare med ett skript." },
  obfuscated: { en: "The page contains hidden or scrambled code, often used to avoid detection.", fi: "Sivulla on piilotettua tai sekoitettua koodia, jolla usein vältellään tunnistusta.", sv: "Sidan innehåller dold eller förvrängd kod, ofta för att undvika upptäckt." },
  hidden_iframe: { en: "The page loads hidden content from another site.", fi: "Sivu lataa piilotettua sisältöä toiselta sivustolta.", sv: "Sidan laddar dolt innehåll från en annan webbplats." },
  noindex_form: { en: "The page asks for information but hides itself from search engines.", fi: "Sivu kysyy tietoja mutta piilottaa itsensä hakukoneilta.", sv: "Sidan ber om uppgifter men döljer sig för sökmotorer." },
  borrowed_assets: { en: "The page loads its logo or styles from {host}, as copied phishing pages do.", fi: "Sivu lataa logonsa tai tyylinsä osoitteesta {host}, kuten kopioidut kalastelusivut.", sv: "Sidan hämtar sin logotyp eller stil från {host}, som kopierade nätfiskesidor gör." },
  link_text_mismatch: { en: "A link on the page shows {shown}, but it actually goes to {host}.", fi: "Sivun linkki näyttää osoitteen {shown}, mutta vie osoitteeseen {host}.", sv: "En länk på sidan visar {shown}, men leder egentligen till {host}." },
  unreachable: { en: "The page could not be opened. It may already have been taken down.", fi: "Sivua ei voitu avata. Se on ehkä jo poistettu.", sv: "Sidan kunde inte öppnas. Den kan redan ha tagits ned." },
  // Message content
  urgency: { en: "The message pressures you to act quickly or sets a deadline.", fi: "Viesti painostaa toimimaan nopeasti tai asettaa määräajan.", sv: "Meddelandet pressar dig att agera snabbt eller sätter en tidsgräns." },
  money: { en: "The message asks for a payment or money transfer.", fi: "Viesti pyytää maksua tai rahansiirtoa.", sv: "Meddelandet ber om en betalning eller överföring." },
  credentials: { en: "The message asks you to log in, verify your identity or share a code.", fi: "Viesti pyytää kirjautumaan, vahvistamaan henkilöllisyyden tai antamaan koodin.", sv: "Meddelandet ber dig logga in, bekräfta din identitet eller dela en kod." },
  threat: { en: "The message threatens a consequence such as a blocked account or returned parcel.", fi: "Viesti uhkaa seurauksella, kuten tilin sulkemisella tai paketin palautuksella.", sv: "Meddelandet hotar med en följd, som spärrat konto eller returnerat paket." },
  small_fee: { en: "A small unexpected fee is a typical bait to collect card details.", fi: "Pieni odottamaton maksu on tyypillinen syötti korttitietojen keräämiseen.", sv: "En liten oväntad avgift är ett typiskt lockbete för att samla in kortuppgifter." },
  prize: { en: "The message promises a refund, prize or money you weren't expecting.", fi: "Viesti lupaa palautuksen, palkinnon tai rahaa, jota et odottanut.", sv: "Meddelandet lovar en återbetalning, vinst eller pengar du inte väntade dig." },
  generic_greeting: { en: "The message uses a generic greeting instead of your name.", fi: "Viestissä on yleinen tervehdys nimesi sijaan.", sv: "Meddelandet använder en allmän hälsning i stället för ditt namn." },
  sender_mismatch: { en: "The sender's name says {brand}, but the email address is from {host}.", fi: "Lähettäjän nimi on {brand}, mutta sähköpostiosoite on osoitteesta {host}.", sv: "Avsändarnamnet är {brand}, men e-postadressen kommer från {host}." },
  reply_to_mismatch: { en: "Replies would go to a different address ({host}) than the sender.", fi: "Vastaukset menisivät eri osoitteeseen ({host}) kuin lähettäjä.", sv: "Svar skulle gå till en annan adress ({host}) än avsändaren." },
  remote_app: { en: "The message asks you to install an app or allow remote access.", fi: "Viesti pyytää asentamaan sovelluksen tai sallimaan etäyhteyden.", sv: "Meddelandet ber dig installera en app eller tillåta fjärråtkomst." },
  crypto: { en: "The message involves cryptocurrency or gift cards, which can't be reversed.", fi: "Viesti liittyy kryptovaluuttaan tai lahjakortteihin, joita ei voi perua.", sv: "Meddelandet gäller kryptovaluta eller presentkort, som inte kan återkallas." },
  secrecy: { en: "The message asks you to keep it secret or not tell anyone.", fi: "Viesti pyytää pitämään asian salassa.", sv: "Meddelandet ber dig hålla det hemligt." },
};

const UNITS: Record<Language, { day: [string, string]; month: [string, string]; year: [string, string] }> = {
  en: { day: ["day", "days"], month: ["month", "months"], year: ["year", "years"] },
  fi: { day: ["päivä", "päivää"], month: ["kuukausi", "kuukautta"], year: ["vuosi", "vuotta"] },
  sv: { day: ["dag", "dagar"], month: ["månad", "månader"], year: ["år", "år"] },
};

export function humanAge(days: number, language: Language): string {
  const unit = UNITS[language];
  const pick = (count: number, [one, many]: [string, string]) => `${count} ${count === 1 ? one : many}`;
  if (days < 60) return pick(Math.max(days, 0), unit.day);
  if (days < 730) return pick(Math.floor(days / 30.4), unit.month);
  return pick(Math.floor(days / 365.25), unit.year);
}

const say = (code: string, language: Language, values: Record<string, string | number> = {}) =>
  Object.entries(values).reduce((text, [key, value]) => text.replaceAll(`{${key}}`, String(value)), TEXT[code][language]);
const make = (code: string, severity: Severity, category: Category, weight: number, language: Language, values?: Record<string, string | number>): Finding => ({ code, severity, category, weight, text: say(code, language, values), ...(values && Object.keys(values).length ? { detail: String(values.age ?? values.host ?? values.brand ?? values.official ?? (values.tld ? `.${values.tld}` : undefined) ?? values.count ?? values.date ?? values.registrar ?? values.list ?? values.kind ?? values.days ?? "") || undefined } : {}) });

export function findUrls(text: string): string[] {
  const found = new Set<string>();
  for (const match of text.matchAll(URL_PATTERN)) {
    const raw = match[0].replace(/[.,;:!?)\]]+$/u, "");
    const url = /^https?:\/\//iu.test(raw) ? raw : `http://${raw}`;
    try {
      found.add(new URL(url).toString());
    } catch {}
    if (found.size >= MAX_LINKS) break;
  }
  return [...found];
}

export function registrable(host: string) {
  const labels = host.toLowerCase().replace(/\.$/u, "").split(".");
  const lastTwo = labels.slice(-2).join(".");
  return TWO_PART_SUFFIXES.has(lastTwo) ? labels.slice(-3).join(".") : lastTwo;
}

const isOfficial = (host: string) => OFFICIAL.has(registrable(host));
const isWellKnown = (host: string) => WELL_KNOWN.has(registrable(host));
const freeHost = (host: string) => FREE_HOSTS.find((suffix) => host === suffix || host.endsWith(`.${suffix}`)) ?? null;

function brandIn(text: string): string | null {
  const lower = text.toLowerCase();
  for (const brand of Object.keys(BRANDS)) if (new RegExp(`(?:^|[^a-z])${brand}(?:[^a-z]|$)`, "u").test(lower)) return brand;
  return null;
}

function brandInHost(host: string): { brand: string; official: string[] } | null {
  const lower = host.toLowerCase();
  const labels = lower.split(/[.-]/u);
  for (const [brand, domains] of Object.entries(BRANDS)) if (brand.length >= 4 ? lower.includes(brand) : labels.includes(brand)) return { brand, official: domains };
  for (const [brand, domain] of Object.entries(SHORT_BRANDS)) if (labels.includes(brand)) return { brand: brand.toUpperCase(), official: [domain] };
  return null;
}

const displayBrand = (brand: string) => (brand.length <= 3 ? brand.toUpperCase() : brand[0].toUpperCase() + brand.slice(1));

function distance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i++) {
    let previous = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const current = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1));
      previous = current;
    }
  }
  return row[b.length];
}

// Look-alike spellings of an official domain: paypa1.com, nordae.fi, rn for m, and so on.
function typosquatOf(host: string): string | null {
  const domain = registrable(host);
  if (OFFICIAL.has(domain) || WELL_KNOWN.has(domain)) return null;
  const name = domain.split(".")[0];
  const normal = name.replace(/0/gu, "o").replace(/[1|]/gu, "l").replace(/rn/gu, "m").replace(/vv/gu, "w").replace(/5/gu, "s").replace(/3/gu, "e").replace(/-/gu, "");
  for (const official of [...OFFICIAL, ...WELL_KNOWN]) {
    const target = official.split(".")[0];
    if (target.length < 5 || name === target) continue;
    if (normal === target || distance(name, target) <= (target.length >= 8 ? 2 : 1)) return official;
  }
  return null;
}

// Shannon entropy plus a vowel and digit check, to spot names like "xk2jq9vbt".
function looksRandom(host: string): boolean {
  const name = registrable(host).split(".")[0];
  if (name.length < 8) return false;
  const counts = new Map<string, number>();
  for (const char of name) counts.set(char, (counts.get(char) ?? 0) + 1);
  const entropy = -[...counts.values()].reduce((sum, count) => sum + (count / name.length) * Math.log2(count / name.length), 0);
  const digits = (name.match(/\d/gu) ?? []).length;
  const vowels = (name.match(/[aeiouyäö]/gu) ?? []).length;
  return (entropy > 3.3 && vowels / name.length < 0.2) || (digits >= 4 && digits / name.length > 0.3);
}

// Private, loopback, link-local, carrier-grade NAT, multicast and reserved ranges.
function isPrivateAddress(address: string): boolean {
  if (isIP(address) === 4) {
    const [a, b] = address.split(".").map(Number);
    return a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 198 && (b === 18 || b === 19));
  }
  const lower = address.toLowerCase();
  if (lower.startsWith("::ffff:")) return isPrivateAddress(lower.slice(7));
  return lower === "::" || lower === "::1" || /^(?:fc|fd|fe[89ab]|ff)/u.test(lower);
}

// Resolves the host and refuses private addresses. Used as the socket's lookup, so the
// checked address is the one actually connected to.
const safeLookup: LookupFunction = (hostname, options, callback) => {
  lookup(hostname, { all: true })
    .then((addresses) => {
      const usable = addresses.filter((entry) => !isPrivateAddress(entry.address));
      if (usable.length === 0 || usable.length !== addresses.length) return callback(Object.assign(new Error("private_address"), { code: "EPRIVATE" }), "", 4);
      if ((options as { all?: boolean }).all) return (callback as unknown as (error: null, list: typeof usable) => void)(null, usable);
      callback(null, usable[0].address, usable[0].family);
    })
    .catch((error) => callback(error, "", 4));
};

type Certificate = { issuer: string | null; validFrom: string | null; validTo: string | null; valid: boolean; reason: string | null };
type Fetched = { status: number; location: string | null; body: string; headers: http.IncomingHttpHeaders; cert: Certificate | null };

function fetchOnce(url: URL): Promise<Fetched> {
  return new Promise((resolve, reject) => {
    const client = url.protocol === "https:" ? https : http;
    const request = client.request(
      url,
      {
        method: "GET",
        lookup: safeLookup,
        timeout: TIMEOUT_MS,
        headers: { "user-agent": UA, accept: "text/html,application/xhtml+xml,*/*;q=0.5", "accept-language": "fi,en;q=0.8" },
        // An invalid certificate is itself a finding, so the page is still read.
        rejectUnauthorized: false,
        agent: false,
      },
      (response) => {
        let cert: Certificate | null = null;
        const socket = response.socket as TLSSocket;
        if (url.protocol === "https:" && typeof socket.getPeerCertificate === "function") {
          const peer = socket.getPeerCertificate();
          const issuer = peer?.issuer ? [peer.issuer.O, peer.issuer.CN].filter(Boolean).join(" · ") : null;
          cert = { issuer: issuer || null, validFrom: peer?.valid_from ?? null, validTo: peer?.valid_to ?? null, valid: socket.authorized, reason: socket.authorized ? null : String(socket.authorizationError ?? "unknown") };
        }
        const headers = response.headers;
        const location = headers.location ?? null;
        const type = String(headers["content-type"] ?? "");
        if (!/text\/html|application\/xhtml/iu.test(type) || (response.statusCode ?? 0) >= 300) {
          response.resume();
          return resolve({ status: response.statusCode ?? 0, location, body: "", headers, cert });
        }
        let size = 0;
        const chunks: Buffer[] = [];
        response.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > MAX_BYTES) return response.destroy();
          chunks.push(chunk);
        });
        response.on("close", () => resolve({ status: response.statusCode ?? 0, location, body: Buffer.concat(chunks).toString("utf8"), headers, cert }));
        response.on("error", reject);
      },
    );
    request.on("timeout", () => request.destroy(new Error("timeout")));
    request.on("error", reject);
    request.end();
  });
}

type Trace = { final: URL; chain: string[]; page: Fetched | null; cert: Certificate | null; error: string | null; jsRedirect: boolean };

async function follow(start: URL): Promise<Trace> {
  let current = start;
  const chain: string[] = [];
  let cert: Certificate | null = null;
  let jsRedirect = false;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (!/^https?:$/u.test(current.protocol) || !ALLOWED_PORTS.has(current.port)) return { final: current, chain, page: null, cert, error: "blocked", jsRedirect };
    const bare = current.hostname.replace(/^\[|\]$/gu, "");
    if (isIP(bare) && isPrivateAddress(bare)) return { final: current, chain, page: null, cert, error: "private_address", jsRedirect };
    let page: Fetched;
    try {
      page = await fetchOnce(current);
    } catch (error) {
      return { final: current, chain, page: null, cert, error: (error as Error).message, jsRedirect };
    }
    if (page.cert) cert = page.cert;
    if (page.status >= 300 && page.status < 400 && page.location) {
      current = new URL(page.location, current);
      chain.push(current.toString());
      continue;
    }
    // Meta refresh and simple script redirects are followed too.
    const meta = page.body.match(/<meta[^>]+http-equiv=["']?refresh["']?[^>]*content=["'][^"']*url=([^"'>\s]+)/iu)?.[1];
    const script = page.body.length < 6000 ? page.body.match(/(?:window\.|document\.)?location(?:\.href)?\s*=\s*["'](https?:\/\/[^"']+)["']|location\.replace\(\s*["'](https?:\/\/[^"']+)["']/iu) : null;
    const next = meta ?? script?.[1] ?? script?.[2];
    if (next && hop < MAX_REDIRECTS) {
      if (!meta) jsRedirect = true;
      current = new URL(next, current);
      chain.push(current.toString());
      continue;
    }
    return { final: current, chain, page, cert, error: null, jsRedirect };
  }
  return { final: current, chain, page: null, cert, error: "too_many_redirects", jsRedirect };
}

async function getJson(url: string, ms = 4000): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { accept: "application/rdap+json, application/json", "user-agent": UA } });
    return response.ok ? await response.json() : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

type VCard = [string, [string, object, string, unknown][]];
type Registration = { registered: string | null; expires: string | null; registrar: string | null };

async function registration(host: string): Promise<Registration> {
  const data = (await getJson(`https://rdap.org/domain/${encodeURIComponent(registrable(host))}`)) as { events?: { eventAction?: string; eventDate?: string }[]; entities?: { roles?: string[]; vcardArray?: VCard }[] } | null;
  const event = (action: string) => data?.events?.find((item) => item.eventAction === action)?.eventDate ?? null;
  const name = data?.entities?.find((entity) => entity.roles?.includes("registrar"))?.vcardArray?.[1]?.find((field) => field[0] === "fn")?.[3];
  return { registered: event("registration"), expires: event("expiration"), registrar: typeof name === "string" ? name : null };
}

async function network(ip: string): Promise<{ name: string | null; country: string | null }> {
  if (!ip) return { name: null, country: null };
  const data = (await getJson(`https://rdap.org/ip/${encodeURIComponent(ip)}`)) as { name?: string; country?: string; remarks?: { description?: string[] }[]; entities?: { roles?: string[]; vcardArray?: VCard }[] } | null;
  const field = (entity: { vcardArray?: VCard }, key: string) => entity.vcardArray?.[1]?.find((item) => item[0] === key)?.[3];
  // The organisation's name, not a maintainer handle like "XX-MNT".
  const org = data?.entities?.find((entity) => field(entity, "kind") === "org" && typeof field(entity, "fn") === "string");
  const named = data?.entities?.map((entity) => field(entity, "fn")).find((value): value is string => typeof value === "string" && !/-mnt$|^[A-Z0-9-]+$/u.test(value) && !/abuse/iu.test(value));
  const owner = (org && (field(org, "fn") as string)) ?? data?.remarks?.[0]?.description?.[0] ?? named ?? data?.name ?? null;
  return { name: owner, country: data?.country ?? null };
}

async function dnsFacts(host: string) {
  const domain = registrable(host);
  const settle = <T,>(promise: Promise<T>) => promise.catch(() => null);
  const [v4, v6, mx, ns] = await Promise.all([settle(resolve4(host)), settle(resolve6(host)), settle(resolveMx(domain)), settle(resolveNs(domain))]);
  return { ips: [...(v4 ?? []), ...(v6 ?? [])].slice(0, 4), hasMail: mx === null ? false : mx.some((record) => record.exchange && record.exchange !== "."), nameservers: (ns ?? []).slice(0, 4) };
}

// The OpenPhish community feed, refreshed at most once an hour.
let feed: { at: number; urls: Set<string>; hosts: Set<string> } | null = null;
async function openPhish(): Promise<{ urls: Set<string>; hosts: Set<string> } | null> {
  if (feed && Date.now() - feed.at < 3_600_000) return feed;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const response = await fetch("https://openphish.com/feed.txt", { signal: controller.signal, headers: { "user-agent": UA } });
    clearTimeout(timer);
    if (!response.ok) return feed;
    const lines = (await response.text()).split("\n").map((line) => line.trim()).filter(Boolean);
    const hosts = new Set<string>();
    for (const line of lines) {
      try {
        hosts.add(new URL(line).hostname.toLowerCase());
      } catch {}
    }
    feed = { at: Date.now(), urls: new Set(lines.map((line) => line.replace(/\/$/u, ""))), hosts };
    return feed;
  } catch {
    return feed;
  }
}

// Google Safe Browsing, only when a key is configured.
async function safeBrowsing(url: string): Promise<string | null> {
  const key = process.env.GOOGLE_SAFE_BROWSING_KEY;
  if (!key) return null;
  try {
    const response = await fetch(`https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${key}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ client: { clientId: "safestep", clientVersion: "2.0" }, threatInfo: { threatTypes: ["MALWARE", "SOCIAL_ENGINEERING", "UNWANTED_SOFTWARE", "POTENTIALLY_HARMFUL_APPLICATION"], platformTypes: ["ANY_PLATFORM"], threatEntryTypes: ["URL"], threatEntries: [{ url }] } }),
    });
    const data = (await response.json()) as { matches?: { threatType: string }[] };
    return data.matches?.[0]?.threatType.toLowerCase().replaceAll("_", " ") ?? null;
  } catch {
    return null;
  }
}

function decode(text: string) {
  return text.replace(/&amp;/gu, "&").replace(/&lt;/gu, "<").replace(/&gt;/gu, ">").replace(/&quot;/gu, '"').replace(/&#39;/gu, "'").replace(/\s+/gu, " ").trim();
}

function inspectPage(html: string, host: string, language: Language) {
  const findings: Finding[] = [];
  const title = html.match(/<title[^>]*>([^<]{0,200})/iu)?.[1];
  const visible = decode(html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/giu, " ").replace(/<[^>]+>/gu, " ")).slice(0, 20000);
  const forms = (html.match(/<form\b/giu) ?? []).length;
  const externalScripts = [...html.matchAll(/<script[^>]+src=["']?(https?:\/\/[^"'\s>]+)/giu)].filter((match) => {
    try {
      return registrable(new URL(match[1]).hostname) !== registrable(host);
    } catch {
      return false;
    }
  }).length;
  const official = isOfficial(host);
  const add = (code: string, severity: Severity, weight: number, values?: Record<string, string | number>) => findings.push(make(code, severity, "page", weight, language, values));
  if (/<input[^>]+type=["']?password/iu.test(html)) add("password_form", "high", 25);
  if (/<input[^>]+(?:name|id|autocomplete|placeholder)=["']?[^"'>]*(?:cc-?number|card-?number|cardnumber|cvv|cvc|korttinumero|kortnummer|expiry|exp-?date)/iu.test(html) || /\b(?:cvv|cvc|korttinumero|kortnummer|card number)\b/iu.test(visible)) add("card_form", "high", 30);
  if (/\b(?:pankkitunnu|tunnistaudu pankkitunnuksilla|mobiilivarmenne|bankid|verkkopankki|online banking login)/iu.test(visible) && !official) add("bank_id_form", "high", 35);
  const pageBrand = brandIn(`${title ?? ""} ${visible.slice(0, 3000)}`);
  if (pageBrand && !BRANDS[pageBrand].includes(registrable(host)) && (findings.length > 0 || brandIn(title ?? "") === pageBrand)) add("page_brand", "high", 40, { brand: displayBrand(pageBrand) });
  for (const action of html.matchAll(/<form[^>]+action=["']?(https?:\/\/[^"'\s>]+)/giu)) {
    try {
      const target = new URL(action[1]).hostname;
      if (registrable(target) !== registrable(host)) {
        add("form_offsite", "high", 30, { host: target });
        break;
      }
    } catch {}
  }
  const evalCount = (html.match(/\b(?:eval|unescape|atob|String\.fromCharCode)\s*\(/gu) ?? []).length;
  if (evalCount >= 3 || /["'][A-Za-z0-9+/=]{2000,}["']/u.test(html)) add("obfuscated", "medium", 15);
  if (/<iframe[^>]+(?:width=["']?[01]["'\s>]|height=["']?[01]["'\s>]|display:\s*none|visibility:\s*hidden)/iu.test(html)) add("hidden_iframe", "medium", 10);
  if (forms > 0 && /<meta[^>]+name=["']?robots["']?[^>]+noindex/iu.test(html) && !official) add("noindex_form", "medium", 8);
  // Logos and styles hot-linked from the real brand's own servers.
  for (const asset of html.matchAll(/<(?:img|link)[^>]+(?:src|href)=["']?(https?:\/\/[^"'\s>]+)/giu)) {
    try {
      const target = new URL(asset[1]).hostname;
      if (isOfficial(target) && registrable(target) !== registrable(host) && !isWellKnown(host)) {
        add("borrowed_assets", "high", 25, { host: registrable(target) });
        break;
      }
    } catch {}
  }
  // A link whose text shows one address but points to another.
  for (const anchor of html.matchAll(/<a[^>]+href=["']?(https?:\/\/[^"'\s>]+)[^>]*>\s*(?:https?:\/\/)?((?:[a-z0-9-]+\.)+[a-z]{2,})/giu)) {
    try {
      const target = registrable(new URL(anchor[1]).hostname);
      const shown = registrable(anchor[2]);
      if (target !== shown && isOfficial(shown)) {
        add("link_text_mismatch", "high", 30, { shown, host: target });
        break;
      }
    } catch {}
  }
  return { title: title ? decode(title) : null, findings, forms, externalScripts };
}

function addressChecks(url: URL, language: Language): Finding[] {
  const host = url.hostname.toLowerCase();
  const findings: Finding[] = [];
  const add = (code: string, severity: Severity, weight: number, values?: Record<string, string | number>) => findings.push(make(code, severity, "address", weight, language, values));
  const bare = host.replace(/^\[|\]$/gu, "");
  const trusted = isOfficial(host) || isWellKnown(host);
  if (isIP(bare)) add("ip_host", "high", 35);
  if (host.split(".").some((label) => label.startsWith("xn--"))) add("punycode", "high", 30);
  if (url.username || url.password) add("at_sign", "high", 30);
  const brand = brandInHost(host);
  if (brand && !brand.official.includes(registrable(host)) && !trusted) add("brand_mismatch", "high", 40, { brand: displayBrand(brand.brand) });
  const squat = !brand ? typosquatOf(host) : null;
  if (squat) add("typosquat", "high", 45, { official: squat });
  if (SHORTENERS.has(registrable(host)) || SHORTENERS.has(host)) add("shortener", "medium", 15);
  const free = freeHost(host);
  if (free) add("free_host", "medium", 15, { host: free });
  const tld = host.split(".").at(-1) ?? "";
  if (RISKY_TLDS.has(tld)) add("risky_tld", "medium", 15, { tld });
  if (host.split(".").length > 4) add("many_subdomains", "medium", 10);
  if (!isIP(bare) && looksRandom(host)) add("random_name", "medium", 12);
  if ((registrable(host).split(".")[0].match(/-/gu) ?? []).length >= 2) add("hyphens", "low", 8);
  if (!trusted && LURE_WORDS.test(`${host}${url.pathname}`)) add("lure_words", "low", 8);
  return findings;
}

export function riskOf(score: number, trusted: boolean): Risk {
  if (score >= 70) return "critical";
  if (score >= 45) return "high";
  if (score >= 25) return "medium";
  if (score >= 8 || !trusted) return "low";
  return "none";
}

const RANK: Record<Verdict, number> = { malicious: 3, suspicious: 2, unknown: 1, clean: 0 };
export const worse = (a: Verdict, b: Verdict) => (RANK[a] >= RANK[b] ? a : b);
// What the rules see: high and critical are malicious, medium is suspicious, and only a
// recognised official site with no warnings is clean.
const verdictFor = (risk: Risk, official: boolean): Verdict => (risk === "critical" || risk === "high" ? "malicious" : risk === "medium" ? "suspicious" : risk === "none" && official ? "clean" : "unknown");

const daysSince = (date: string | null) => (date ? Math.floor((Date.now() - new Date(date).getTime()) / 86_400_000) : null);

export async function scanLink(raw: string, language: Language): Promise<LinkReport> {
  const url = new URL(raw);
  const host = url.hostname.toLowerCase();
  const bare = host.replace(/^\[|\]$/gu, "");
  const findings = addressChecks(url, language);
  const add = (finding: Finding) => {
    if (!findings.some((existing) => existing.code === finding.code)) findings.push(finding);
  };
  const [trace, reg, dns, phish, google] = await Promise.all([
    follow(url),
    isIP(bare) ? Promise.resolve<Registration>({ registered: null, expires: null, registrar: null }) : registration(host),
    isIP(bare) ? Promise.resolve({ ips: [bare], hasMail: null as boolean | null, nameservers: [] as string[] }) : dnsFacts(host),
    openPhish(),
    safeBrowsing(raw),
  ]);
  const finalHost = trace.final.hostname.toLowerCase();
  const owner = await network(dns.ips.find((ip) => !isPrivateAddress(ip)) ?? "");
  const feeds: string[] = [];

  // Reputation
  const strip = (value: string) => value.replace(/\/$/u, "");
  if (phish) {
    feeds.push("OpenPhish");
    if ([raw, ...trace.chain].map(strip).some((value) => phish.urls.has(value))) add(make("feed_openphish", "high", "reputation", 80, language));
    else if (!isOfficial(host) && !isWellKnown(host) && !freeHost(host) && [host, finalHost].some((value) => phish.hosts.has(value))) add(make("feed_openphish_host", "high", "reputation", 50, language));
  }
  if (process.env.GOOGLE_SAFE_BROWSING_KEY) feeds.push("Google Safe Browsing");
  if (google) add(make("feed_safebrowsing", "high", "reputation", 80, language, { kind: google }));

  // Where the link leads
  if (trace.error === "private_address") add(make("blocked_private", "high", "address", 60, language));
  else if (trace.error === "blocked") add(make("unusual_port", "medium", "address", 20, language));
  else if (trace.error) add(make("unreachable", "low", "page", 5, language));
  const landsTrusted = isOfficial(finalHost) || isWellKnown(finalHost);
  if (registrable(finalHost) !== registrable(host)) {
    add(make("redirect_offsite", landsTrusted ? "low" : "medium", "address", landsTrusted ? 3 : 10, language, { host: finalHost }));
    addressChecks(trace.final, language).forEach(add);
  }
  if (trace.chain.length >= 3) add(make("long_chain", "medium", "address", 10, language, { count: trace.chain.length }));
  if (trace.jsRedirect) add(make("js_redirect", "medium", "page", 10, language));
  if (trace.final.protocol === "http:") add(make("no_https", "medium", "certificate", 15, language));

  // Registration
  const age = daysSince(reg.registered);
  if (!isIP(bare)) {
    if (age === null) add(make("age_unknown", "low", "domain", 5, language));
    else if (age < 30) add(make("domain_new", "high", "domain", 35, language, { age: humanAge(age, language) }));
    else if (age < 180) add(make("domain_young", "medium", "domain", 20, language, { age: humanAge(age, language) }));
    else if (age < 365) add(make("domain_recent", "low", "domain", 8, language, { age: humanAge(age, language) }));
    else if (age > 2 * 365) add(make("domain_old", "good", "domain", age > 5 * 365 ? -15 : -8, language, { age: humanAge(age, language) }));
    if (reg.registrar && /markmonitor|csc corporate|corporation service company|com laude|safenames|nom-iq|brandsight/iu.test(reg.registrar) && !freeHost(host)) add(make("brand_protection", "good", "domain", -25, language, { registrar: reg.registrar }));
    const left = reg.expires ? -(daysSince(reg.expires) ?? 0) : null;
    if (age !== null && age < 365 && left !== null && age + left < 400) add(make("short_registration", "low", "domain", 6, language, { date: reg.expires!.slice(0, 10) }));
  }

  // DNS and hosting
  if (!isIP(bare) && dns.ips.length === 0) add(make("no_dns", "medium", "dns", 10, language));
  if (!isIP(bare) && dns.hasMail === false && dns.ips.length > 0 && !isWellKnown(host) && !isOfficial(host) && !freeHost(host)) add(make("no_mail", "low", "dns", 5, language));

  // Certificate and headers
  const cert = trace.cert;
  if (cert && !cert.valid) add(make("cert_invalid", "high", "certificate", 30, language, { reason: cert.reason ?? "unknown" }));
  const certAge = daysSince(cert?.validFrom ?? null);
  if (cert?.valid && certAge !== null && certAge < 7 && !landsTrusted && (age === null || age < 365)) add(make("cert_new", "low", "certificate", 6, language, { age: humanAge(certAge, language) }));
  const headers = trace.page?.headers ?? {};
  const csp = String(headers["content-security-policy"] ?? "");
  const securityHeaders = [
    headers["strict-transport-security"] && "HSTS",
    csp && "CSP",
    (headers["x-frame-options"] || /frame-ancestors/iu.test(csp)) && "X-Frame-Options",
    headers["x-content-type-options"] && "X-Content-Type-Options",
  ].filter((value): value is string => Boolean(value));
  if (securityHeaders.length >= 2) add(make("security_headers", "good", "certificate", -5, language, { list: securityHeaders.join(", ") }));

  // Page content
  let title: string | null = null;
  let forms = 0;
  let externalScripts = 0;
  if (trace.page?.body) {
    const page = inspectPage(trace.page.body, finalHost, language);
    ({ title, forms, externalScripts } = page);
    page.findings.forEach(add);
  }

  // Trust
  const listed = findings.some((item) => item.category === "reputation" && item.weight > 0);
  const official = isOfficial(host) && isOfficial(finalHost) && !listed;
  const known = !official && !listed && (isOfficial(host) || isWellKnown(host)) && landsTrusted;
  if (official) {
    const brand = Object.entries(BRANDS).find(([, domains]) => domains.includes(registrable(finalHost)))?.[0];
    if (brand) findings.unshift(make("official", "good", "reputation", -60, language, { brand: displayBrand(brand) }));
  } else if (known) findings.unshift(make("well_known", "good", "reputation", -35, language));

  // Big sites often carry tracking frames and minified code, which mean nothing there.
  if (official || known) for (let index = findings.length - 1; index >= 0; index--) if (["hidden_iframe", "obfuscated", "noindex_form"].includes(findings[index].code)) findings.splice(index, 1);

  // A login form on an established site with no other warning is normal, so it's a caution.
  const otherWarnings = findings.some((item) => item.code !== "password_form" && item.weight >= 10);
  const passwordAt = findings.findIndex((item) => item.code === "password_form");
  if (passwordAt >= 0 && (official || known || (age !== null && age > 730)) && !otherWarnings) findings[passwordAt] = make("login_known_site", "low", "page", 5, language);

  const score = Math.max(0, Math.min(100, BASE_SCORE + findings.reduce((sum, item) => sum + item.weight, 0)));
  // Only a recognised official or well-known site can reach "no risk".
  const risk = riskOf(score, official || known);
  return {
    url: raw,
    host,
    finalUrl: trace.chain.length ? trace.final.toString() : null,
    chain: trace.chain,
    status: trace.page?.status ?? null,
    title,
    domainAgeDays: age,
    score,
    risk,
    verdict: verdictFor(risk, official),
    findings,
    tech: {
      domain: registrable(finalHost),
      ips: dns.ips,
      network: owner.name,
      country: owner.country,
      nameservers: dns.nameservers,
      hasMail: dns.hasMail,
      registrar: reg.registrar,
      registered: reg.registered?.slice(0, 10) ?? null,
      expires: reg.expires?.slice(0, 10) ?? null,
      certIssuer: cert?.issuer ?? null,
      certValidFrom: cert?.validFrom ? new Date(cert.validFrom).toISOString().slice(0, 10) : null,
      certValidTo: cert?.validTo ? new Date(cert.validTo).toISOString().slice(0, 10) : null,
      certValid: cert ? cert.valid : null,
      server: typeof headers.server === "string" ? headers.server.slice(0, 60) : null,
      securityHeaders,
      forms,
      externalScripts,
      feeds,
    },
  };
}

// Red flags in the text of the message itself.
export function inspectMessage(text: string, language: Language): Finding[] {
  const findings: Finding[] = [];
  const t = text.toLowerCase();
  const add = (code: string, severity: Severity, weight: number, values?: Record<string, string | number>) => findings.push(make(code, severity, "message", weight, language, values));
  if (/\b(?:urgent|immediately|within 24 ?h|within \d+ hours|today only|final notice|last chance|asap|expires? today|heti|välittömästi|kiireellinen|viimeinen|24 tunnin|omedelbart|brådskande|sista chansen|inom 24)/iu.test(t)) add("urgency", "medium", 10);
  if (/\b(?:pay|payment|transfer|fee|invoice|maksa|maksu|tilisiirto|lasku|betala|avgift|faktura|överför)/iu.test(t)) add("money", "medium", 10);
  if (/\b(?:log ?in|sign ?in|verify|confirm your|password|code|pin|kirjaudu|vahvista|tunnistaudu|salasana|koodi|tunnus|logga in|bekräfta|lösenord|kod)\b/iu.test(t)) add("credentials", "medium", 15);
  if (/\b(?:suspend|blocked|locked|closed|returned|cancel+ed|legal action|suljetaan|lukittu|palautetaan|estetty|spärr|stängs|returneras)/iu.test(t)) add("threat", "medium", 10);
  if (/(?:€|eur|\$)\s?[0-4][.,]\d{2}\b|\b[0-4][.,]\d{2}\s?(?:€|eur)/iu.test(t)) add("small_fee", "medium", 15);
  if (/\b(?:refund|prize|winner|won|reward|bonus|palautus|voitto|voittanut|palkinto|återbäring|vinst|vunnit)/iu.test(t)) add("prize", "medium", 10);
  if (/\b(?:dear (?:customer|client|user|member|sir)|hyvä asiakas|arvoisa asiakas|bästa kund|kära kund)\b/iu.test(t)) add("generic_greeting", "low", 5);
  if (/\b(?:anydesk|teamviewer|quicksupport|rustdesk|remote access|install (?:the|this) app|asenna sovellus|etäyhteys|fjärråtkomst|installera appen)\b/iu.test(t)) add("remote_app", "high", 30);
  if (/\b(?:bitcoin|btc|crypto|usdt|ethereum|gift ?cards?|lahjakortti|kryptovaluutta|presentkort|kryptovaluta)\b/iu.test(t)) add("crypto", "high", 25);
  if (/(?:don'?t tell|keep (?:this|it) (?:secret|between us)|älä kerro|pidä salassa|berätta inte|håll det hemligt)/iu.test(t)) add("secrecy", "high", 25);
  // Email headers, when the user pasted them.
  const from = text.match(/^\s*(?:from|lähettäjä|från)\s*:\s*"?([^"<\n]*)"?\s*<([^>\s]+@([^>\s]+))>/imu);
  if (from) {
    const named = brandIn(from[1]);
    const domain = from[3].toLowerCase();
    if (named && !BRANDS[named].includes(registrable(domain))) add("sender_mismatch", "high", 40, { brand: displayBrand(named), host: domain });
    const replyTo = text.match(/^\s*reply-to\s*:.*?@([^>\s]+)/imu)?.[1]?.toLowerCase();
    if (replyTo && registrable(replyTo) !== registrable(domain)) add("reply_to_mismatch", "medium", 20, { host: replyTo });
  }
  return findings;
}

// pasted: the message the user received. story: the user's own words, read for links only.
export async function analyzeContent(pasted: string, story: string, language: Language): Promise<ContentAnalysis | null> {
  const urls = findUrls(`${pasted}\n${story}`);
  const message = pasted.trim() ? inspectMessage(pasted, language) : [];
  if (urls.length === 0 && message.length === 0) return null;
  const links = (await Promise.all(urls.map((url) => scanLink(url, language).catch(() => null)))).filter((link): link is LinkReport => link !== null);
  return combine(links, message);
}

export function combine(links: LinkReport[], message: Finding[]): ContentAnalysis {
  const messageScore = Math.min(100, message.reduce((sum, item) => sum + item.weight, 0));
  const linkScore = links.reduce((max, link) => Math.max(max, link.score), 0);
  // Pressure tactics in the message add to the worst link, up to a limit.
  const score = Math.min(100, links.length ? linkScore + Math.round(messageScore * 0.4) : messageScore);
  const official = links.length > 0 && links.every((link) => link.verdict === "clean") && messageScore < 8;
  const trusted = links.length > 0 && links.every((link) => link.risk === "none") && messageScore < 8;
  const risk = riskOf(score, trusted);
  return { verdict: verdictFor(risk, official), risk, score, links, message, messageScore };
}
