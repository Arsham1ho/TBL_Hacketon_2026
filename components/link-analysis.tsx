"use client";

import type { ReactNode } from "react";
import { ArrowRight, CalendarClock, CircleAlert, CircleCheck, Gauge, Globe, Lock, LockOpen, MessageSquareWarning, ScanSearch, Server, ShieldAlert, ShieldCheck, ShieldQuestion, TriangleAlert } from "lucide-react";
import type { ContentAnalysis, Finding, LinkReport, Severity, Verdict } from "@/adapters/link-scan";
import type { Language, Risk } from "@/engine/types";
import { maskSecrets } from "@/engine/input-guard";
import type { Translate } from "@/lib/ui-text";
import { cn } from "@/lib/utils";
import { RiskGauge } from "./risk-gauge";
import { Details } from "./ui";

type Copy = {
  title: string;
  subtitle: (count: number) => string;
  risk: string;
  score: string;
  age: string;
  unknown: string;
  hosting: string;
  connection: string;
  encrypted: string;
  invalidCert: string;
  notEncrypted: string;
  lists: string;
  listed: string;
  notListed: string;
  notChecked: string;
  landsOn: string;
  warnings: string;
  trust: string;
  noWarnings: string;
  message: string;
  technical: string;
  rows: Record<string, string>;
  yes: string;
  no: string;
  note: string;
  sandboxed: string;
  verdict: Record<Verdict, string>;
};

const COPY: Record<Language, Copy> = {
  en: {
    title: "Link and message check",
    subtitle: (count) => (count === 0 ? "Message content" : count === 1 ? "1 link opened and inspected" : `${count} links opened and inspected`),
    risk: "Link risk",
    score: "Risk score",
    age: "Domain age",
    unknown: "Unknown",
    hosting: "Hosted by",
    connection: "Connection",
    encrypted: "Encrypted",
    invalidCert: "Invalid certificate",
    notEncrypted: "Not encrypted",
    lists: "Threat lists",
    listed: "Listed as phishing",
    notListed: "Not listed",
    notChecked: "Not checked",
    landsOn: "Lands on",
    warnings: "Warning signs",
    trust: "Trust signals",
    noWarnings: "No warning signs found. That alone doesn't prove the link is safe.",
    message: "In the message",
    technical: "Technical details",
    rows: { url: "Address", final: "Final address", chain: "Redirects", ips: "IP addresses", network: "Network owner", country: "Country", ns: "Name servers", mx: "Email service", registrar: "Registrar", registered: "Registered", expires: "Expires", issuer: "Certificate issuer", validity: "Certificate valid", server: "Web server", headers: "Security headers", status: "HTTP status", title: "Page title", forms: "Forms on page", scripts: "Outside scripts", feeds: "Lists checked" },
    yes: "Yes",
    no: "No",
    note: "Opened safely on SafeStep's server. No scripts ran and nothing was submitted.",
    sandboxed: "Safely opened",
    verdict: { malicious: "Dangerous link", suspicious: "Suspicious link", unknown: "Not verified", clean: "Official site" },
  },
  fi: {
    title: "Linkin ja viestin tarkistus",
    subtitle: (count) => (count === 0 ? "Viestin sisältö" : count === 1 ? "1 linkki avattu ja tarkistettu" : `${count} linkkiä avattu ja tarkistettu`),
    risk: "Linkin riski",
    score: "Riskipisteet",
    age: "Verkkotunnuksen ikä",
    unknown: "Ei tiedossa",
    hosting: "Palvelin",
    connection: "Yhteys",
    encrypted: "Salattu",
    invalidCert: "Virheellinen varmenne",
    notEncrypted: "Ei salattu",
    lists: "Uhkalistat",
    listed: "Listattu huijaukseksi",
    notListed: "Ei listalla",
    notChecked: "Ei tarkistettu",
    landsOn: "Päätyy",
    warnings: "Varoitusmerkit",
    trust: "Luotettavuutta tukevat",
    noWarnings: "Varoitusmerkkejä ei löytynyt. Se ei yksin todista, että linkki on turvallinen.",
    message: "Viestissä",
    technical: "Tekniset tiedot",
    rows: { url: "Osoite", final: "Lopullinen osoite", chain: "Uudelleenohjaukset", ips: "IP-osoitteet", network: "Verkon omistaja", country: "Maa", ns: "Nimipalvelimet", mx: "Sähköpostipalvelu", registrar: "Rekisteröijä", registered: "Rekisteröity", expires: "Vanhenee", issuer: "Varmenteen myöntäjä", validity: "Varmenne voimassa", server: "Verkkopalvelin", headers: "Suojausotsakkeet", status: "HTTP-tila", title: "Sivun otsikko", forms: "Lomakkeita sivulla", scripts: "Ulkoisia skriptejä", feeds: "Tarkistetut listat" },
    yes: "Kyllä",
    no: "Ei",
    note: "Avattu turvallisesti SafeStepin palvelimella. Skriptejä ei ajettu eikä mitään lähetetty.",
    sandboxed: "Avattu turvallisesti",
    verdict: { malicious: "Vaarallinen linkki", suspicious: "Epäilyttävä linkki", unknown: "Ei vahvistettu", clean: "Virallinen sivusto" },
  },
  sv: {
    title: "Kontroll av länk och meddelande",
    subtitle: (count) => (count === 0 ? "Meddelandets innehåll" : count === 1 ? "1 länk öppnad och granskad" : `${count} länkar öppnade och granskade`),
    risk: "Länkrisk",
    score: "Riskpoäng",
    age: "Domänens ålder",
    unknown: "Okänd",
    hosting: "Värd",
    connection: "Anslutning",
    encrypted: "Krypterad",
    invalidCert: "Ogiltigt certifikat",
    notEncrypted: "Inte krypterad",
    lists: "Hotlistor",
    listed: "Listad som nätfiske",
    notListed: "Inte listad",
    notChecked: "Inte kontrollerad",
    landsOn: "Landar på",
    warnings: "Varningstecken",
    trust: "Förtroendesignaler",
    noWarnings: "Inga varningstecken hittades. Det bevisar inte ensamt att länken är säker.",
    message: "I meddelandet",
    technical: "Tekniska detaljer",
    rows: { url: "Adress", final: "Slutlig adress", chain: "Omdirigeringar", ips: "IP-adresser", network: "Nätverksägare", country: "Land", ns: "Namnservrar", mx: "E-posttjänst", registrar: "Registrar", registered: "Registrerad", expires: "Upphör", issuer: "Certifikatutfärdare", validity: "Certifikat giltigt", server: "Webbserver", headers: "Säkerhetshuvuden", status: "HTTP-status", title: "Sidans titel", forms: "Formulär på sidan", scripts: "Externa skript", feeds: "Kontrollerade listor" },
    yes: "Ja",
    no: "Nej",
    note: "Öppnad säkert på SafeSteps server. Inga skript kördes och inget skickades.",
    sandboxed: "Säkert öppnad",
    verdict: { malicious: "Farlig länk", suspicious: "Misstänkt länk", unknown: "Inte verifierad", clean: "Officiell webbplats" },
  },
};

const RISK_TEXT: Record<Risk, string> = { none: "riskNone", low: "riskLow", medium: "riskMedium", high: "riskHigh", critical: "riskCritical" };

// Same colours and icons as the assessment's status labels.
const VERDICT_STYLE: Record<Verdict, { tone: string; Icon: typeof ShieldAlert }> = {
  malicious: { tone: "text-destructive", Icon: ShieldAlert },
  suspicious: { tone: "text-warning", Icon: TriangleAlert },
  unknown: { tone: "text-muted-foreground", Icon: ShieldQuestion },
  clean: { tone: "text-success", Icon: ShieldCheck },
};

const SEVERITY: Record<Severity, { Icon: typeof CircleAlert; tone: string }> = {
  high: { Icon: CircleAlert, tone: "text-destructive" },
  medium: { Icon: TriangleAlert, tone: "text-warning" },
  low: { Icon: CircleAlert, tone: "text-muted-foreground" },
  good: { Icon: CircleCheck, tone: "text-success" },
};
const ORDER: Record<Severity, number> = { high: 0, medium: 1, low: 2, good: 3 };
// Short chip labels. The full sentence stays available as the chip's tooltip.
const SHORT: Record<string, [string, string, string]> = {
  feed_openphish: ["On phishing list", "Huijauslistalla", "På nätfiskelista"],
  feed_openphish_host: ["Site on phishing list", "Sivusto huijauslistalla", "Webbplats på nätfiskelista"],
  feed_safebrowsing: ["Flagged by Google", "Googlen merkitsemä", "Flaggad av Google"],
  official: ["Official site", "Virallinen sivusto", "Officiell webbplats"],
  well_known: ["Well-known site", "Tunnettu sivusto", "Välkänd webbplats"],
  ip_host: ["Bare IP address", "Pelkkä IP-osoite", "Bara IP-adress"],
  punycode: ["Look-alike letters", "Samannäköiset merkit", "Förväxlingsbara tecken"],
  at_sign: ["Hidden destination", "Piilotettu kohde", "Dolt mål"],
  brand_mismatch: ["Fake brand name", "Väärä brändinimi", "Falskt varumärke"],
  typosquat: ["Look-alike domain", "Kopioitu verkkotunnus", "Kopierad domän"],
  shortener: ["Short link", "Lyhytlinkki", "Kortlänk"],
  free_host: ["Free hosting", "Ilmainen palvelin", "Gratis webbhotell"],
  risky_tld: ["Risky ending", "Riskipääte", "Riskabel ändelse"],
  many_subdomains: ["Many subdomains", "Monta aliverkkotunnusta", "Många underdomäner"],
  random_name: ["Random name", "Satunnainen nimi", "Slumpmässigt namn"],
  hyphens: ["Hyphenated name", "Väliviivanimi", "Bindestrecksnamn"],
  no_https: ["Not encrypted", "Ei salattu", "Inte krypterad"],
  lure_words: ["Bait words", "Houkutussanat", "Lockord"],
  unusual_port: ["Unusual port", "Epätavallinen portti", "Ovanlig port"],
  blocked_private: ["Private address", "Yksityinen osoite", "Privat adress"],
  redirect_offsite: ["Redirects away", "Ohjaa muualle", "Omdirigerar"],
  long_chain: ["Redirect chain", "Ohjausketju", "Omdirigeringskedja"],
  domain_new: ["Brand-new domain", "Uusi verkkotunnus", "Helt ny domän"],
  domain_young: ["Young domain", "Nuori verkkotunnus", "Ung domän"],
  domain_recent: ["Under a year old", "Alle vuoden vanha", "Under ett år"],
  domain_old: ["Long-established", "Vakiintunut", "Etablerad"],
  brand_protection: ["Brand-protected", "Brändisuojattu", "Varumärkesskyddad"],
  short_registration: ["Short registration", "Lyhyt rekisteröinti", "Kort registrering"],
  age_unknown: ["Age unknown", "Ikä tuntematon", "Okänd ålder"],
  no_dns: ["No server", "Ei palvelinta", "Ingen server"],
  no_mail: ["No email service", "Ei sähköpostia", "Ingen e-post"],
  cert_invalid: ["Invalid certificate", "Virheellinen varmenne", "Ogiltigt certifikat"],
  cert_new: ["New certificate", "Uusi varmenne", "Nytt certifikat"],
  security_headers: ["Security headers", "Suojausotsakkeet", "Säkerhetshuvuden"],
  password_form: ["Asks for password", "Kysyy salasanaa", "Ber om lösenord"],
  login_known_site: ["Login page", "Kirjautumissivu", "Inloggningssida"],
  card_form: ["Asks for card", "Kysyy korttia", "Ber om kort"],
  bank_id_form: ["Fake bank login", "Väärennetty pankkikirjautuminen", "Falsk bankinloggning"],
  page_brand: ["Impersonates brand", "Esiintyy brändinä", "Utger sig för varumärke"],
  form_offsite: ["Data sent elsewhere", "Tiedot muualle", "Data skickas annat håll"],
  js_redirect: ["Script redirect", "Skriptiohjaus", "Skriptomdirigering"],
  obfuscated: ["Hidden code", "Piilotettu koodi", "Dold kod"],
  hidden_iframe: ["Hidden frame", "Piilokehys", "Dold ram"],
  noindex_form: ["Hidden from search", "Piilossa hauilta", "Dold för sök"],
  borrowed_assets: ["Copied branding", "Kopioitu ilme", "Kopierad grafik"],
  link_text_mismatch: ["Disguised link", "Naamioitu linkki", "Maskerad länk"],
  unreachable: ["Page offline", "Sivu ei vastaa", "Sidan svarar inte"],
  urgency: ["Time pressure", "Kiirehtiminen", "Tidspress"],
  money: ["Asks for money", "Pyytää rahaa", "Ber om pengar"],
  credentials: ["Asks to log in", "Pyytää kirjautumaan", "Ber dig logga in"],
  threat: ["Threatens you", "Uhkailee", "Hotar dig"],
  small_fee: ["Small fee bait", "Pieni maksu syöttinä", "Liten avgift som bete"],
  prize: ["Promises money", "Lupaa rahaa", "Lovar pengar"],
  generic_greeting: ["Generic greeting", "Yleinen tervehdys", "Allmän hälsning"],
  sender_mismatch: ["Fake sender", "Väärä lähettäjä", "Falsk avsändare"],
  reply_to_mismatch: ["Different reply address", "Eri vastausosoite", "Annan svarsadress"],
  remote_app: ["Remote access", "Etäyhteys", "Fjärråtkomst"],
  crypto: ["Crypto / gift cards", "Krypto / lahjakortit", "Krypto / presentkort"],
  secrecy: ["Asks for secrecy", "Pyytää salaamaan", "Ber om hemlighet"],
};
const LANG_INDEX: Record<Language, number> = { en: 0, fi: 1, sv: 2 };
const shortLabel = (item: Finding, language: Language) => SHORT[item.code]?.[LANG_INDEX[language]] ?? item.text;

// Each severity gets its own highlighted chip, with an icon so it's never colour alone.
const CHIP: Record<Severity, string> = {
  high: "border-destructive/30 bg-danger-soft text-destructive",
  medium: "border-warning/30 bg-warning-soft text-warning",
  low: "border-border-strong bg-accent text-foreground",
  good: "border-success/30 bg-success-soft text-success",
};


const PartLabel = ({ children }: { children: ReactNode }) => <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{children}</span>;

const Tile = ({ icon, label, value, tone }: { icon: ReactNode; label: string; value: string; tone?: string }) => (
  <div className="grid min-w-0 gap-1 rounded-xl bg-accent px-3 py-2.5">
    <span className="flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
      {icon}
      {label}
    </span>
    <span className={cn("truncate text-sm leading-snug font-semibold", tone)}>{value}</span>
  </div>
);

function VerdictLabel({ verdict, label }: { verdict: Verdict; label: string }) {
  const { tone, Icon } = VERDICT_STYLE[verdict];
  return (
    <p className={cn("flex items-center gap-1.5 text-sm font-semibold", tone)}>
      <Icon className="size-4" aria-hidden />
      {label}
    </p>
  );
}

const PILL: Record<Verdict, string> = { malicious: "bg-danger-soft text-destructive border-destructive/30", suspicious: "bg-warning-soft text-warning border-warning/30", unknown: "bg-accent text-foreground border-border-strong", clean: "bg-success-soft text-success border-success/30" };

function VerdictPill({ verdict, label }: { verdict: Verdict; label: string }) {
  const { Icon } = VERDICT_STYLE[verdict];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-semibold", PILL[verdict])}>
      <Icon className="size-4" aria-hidden />
      {label}
    </span>
  );
}

function Findings({ items, language }: { items: Finding[]; language: Language }) {
  return (
    <ul className="flex flex-wrap gap-2">
      {[...items].sort((a, b) => ORDER[a.severity] - ORDER[b.severity] || b.weight - a.weight).map((item) => {
        const { Icon } = SEVERITY[item.severity];
        return (
          <li key={item.code} title={item.text} className={cn("inline-flex max-w-full items-center gap-1.5 rounded-full border py-1 pr-3 pl-2 text-sm font-semibold", CHIP[item.severity])}>
            <Icon className="size-4 shrink-0" aria-hidden />
            <span className="truncate">{shortLabel(item, language)}</span>
            {item.detail && <span className="truncate font-normal opacity-80">· {item.detail}</span>}
            <span className="sr-only">: {item.text}</span>
          </li>
        );
      })}
    </ul>
  );
}

// Shown without being clickable, so nobody opens a dangerous address by accident.
const defang = (url: string) => maskSecrets(url).text.replace(/^http/iu, "hxxp").replace(/\./gu, "[.]");
const hostOf = (url: string) => {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
};

function ageText(days: number | null, language: Language, fallback: string) {
  if (days === null) return fallback;
  const units = { en: ["day", "days", "month", "months", "year", "years"], fi: ["päivä", "päivää", "kuukausi", "kuukautta", "vuosi", "vuotta"], sv: ["dag", "dagar", "månad", "månader", "år", "år"] }[language];
  const pick = (count: number, index: number) => `${count} ${count === 1 ? units[index] : units[index + 1]}`;
  if (days < 60) return pick(days, 0);
  if (days < 730) return pick(Math.floor(days / 30.4), 2);
  return pick(Math.floor(days / 365.25), 4);
}

function countryName(code: string | null, language: Language) {
  if (!code) return null;
  try {
    return new Intl.DisplayNames([language], { type: "region" }).of(code.toUpperCase()) ?? code;
  } catch {
    return code;
  }
}

function TechRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-0.5 border-t border-border py-2 first:border-0 first:pt-0 sm:grid-cols-[150px_1fr] sm:gap-3">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-xs break-all text-foreground">{children}</dd>
    </div>
  );
}

function LinkSection({ link, c, language, single }: { link: LinkReport; c: Copy; language: Language; single: boolean }) {
  const warnings = link.findings.filter((item) => item.severity !== "good");
  const trust = link.findings.filter((item) => item.severity === "good");
  const listed = link.findings.some((item) => item.category === "reputation" && item.weight > 0);
  const { tech } = link;
  const finalHost = link.finalUrl ? hostOf(link.finalUrl) : null;
  const connection = tech.certValid === false ? { value: c.invalidCert, tone: "text-destructive", icon: LockOpen } : (link.finalUrl ?? link.url).startsWith("https:") && tech.certValid ? { value: c.encrypted, tone: "text-success", icon: Lock } : { value: c.notEncrypted, tone: "text-warning", icon: LockOpen };
  const country = countryName(tech.country, language);
  const hosting = [tech.network, country].filter(Boolean).join(" · ") || c.unknown;
  const rows: [string, ReactNode][] = [
    [c.rows.url, <span key="u" className="font-mono">{defang(link.url)}</span>],
    ...(link.finalUrl ? [[c.rows.final, <span key="f" className="font-mono">{defang(link.finalUrl)}</span>] as [string, ReactNode]] : []),
    ...(link.chain.length ? [[c.rows.chain, [link.host, ...link.chain.map(hostOf)].join(" → ")] as [string, ReactNode]] : []),
    [c.rows.status, link.status ? String(link.status) : "—"],
    ...(link.title ? [[c.rows.title, link.title] as [string, ReactNode]] : []),
    [c.rows.ips, tech.ips.join(", ") || "—"],
    [c.rows.network, tech.network ?? "—"],
    [c.rows.country, country ?? "—"],
    [c.rows.ns, tech.nameservers.join(", ") || "—"],
    [c.rows.mx, tech.hasMail === null ? "—" : tech.hasMail ? c.yes : c.no],
    [c.rows.registrar, tech.registrar ?? "—"],
    [c.rows.registered, tech.registered ?? "—"],
    [c.rows.expires, tech.expires ?? "—"],
    [c.rows.issuer, tech.certIssuer ?? "—"],
    [c.rows.validity, tech.certValidFrom ? `${tech.certValidFrom} → ${tech.certValidTo ?? "?"}` : "—"],
    [c.rows.server, tech.server ?? "—"],
    [c.rows.headers, tech.securityHeaders.join(", ") || "—"],
    [c.rows.forms, String(tech.forms)],
    [c.rows.scripts, String(tech.externalScripts)],
    [c.rows.feeds, tech.feeds.join(", ") || "—"],
  ];

  return (
    <div className={cn("grid gap-3", !single && "border-t border-border pt-4")}>
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
        <div className="grid min-w-0 gap-0.5">
          <p className="flex min-w-0 items-center gap-2 font-semibold">
            <Globe className="size-4 shrink-0" aria-hidden />
            <span className="truncate">{tech.domain || link.host}</span>
          </p>
          {finalHost && finalHost !== link.host && (
            <p className="flex min-w-0 items-center gap-1.5 pl-6 text-xs text-muted-foreground">
              <ArrowRight className="size-3.5 shrink-0" aria-hidden />
              <span className="truncate">
                {c.landsOn} {finalHost}
              </span>
            </p>
          )}
        </div>
        {!single && <VerdictLabel verdict={link.verdict} label={c.verdict[link.verdict]} />}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Tile icon={<CalendarClock className="size-4" aria-hidden />} label={c.age} value={ageText(link.domainAgeDays, language, c.unknown)} />
        <Tile icon={<connection.icon className="size-4" aria-hidden />} label={c.connection} value={connection.value} tone={connection.tone} />
        <Tile icon={<Server className="size-4" aria-hidden />} label={c.hosting} value={hosting} />
        <Tile icon={<ShieldAlert className="size-4" aria-hidden />} label={c.lists} value={tech.feeds.length === 0 ? c.notChecked : listed ? c.listed : c.notListed} tone={listed ? "text-destructive" : undefined} />
      </div>

      {warnings.length > 0 && (
        <div className="grid gap-2">
          <PartLabel>{c.warnings}</PartLabel>
          <Findings items={warnings} language={language} />
        </div>
      )}
      {trust.length > 0 && (
        <div className="grid gap-2">
          <PartLabel>{c.trust}</PartLabel>
          <Findings items={trust} language={language} />
        </div>
      )}

      <Details title={c.technical}>
        <dl className="grid rounded-xl border border-border p-3">
          {rows.map(([label, value]) => (
            <TechRow key={label} label={label}>
              {value}
            </TechRow>
          ))}
        </dl>
      </Details>
    </div>
  );
}

export function LinkAnalysisCard({ analysis, language, t }: { analysis: ContentAnalysis; language: Language; t: Translate }) {
  const c = COPY[language];
  const single = analysis.links.length <= 1;
  const all = [...analysis.links.flatMap((link) => link.findings), ...analysis.message];
  const counts = { warnings: all.filter((item) => item.severity !== "good").length, trust: all.filter((item) => item.severity === "good").length };
  return (
    <section aria-labelledby="link-check-title" className="grid gap-4 rounded-2xl border border-border-strong bg-card p-4 motion-safe:animate-[fade-up_.35s_ease-out]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent text-foreground" aria-hidden>
            <ScanSearch className="size-6" />
          </span>
          <h2 id="link-check-title" className="text-base font-semibold">
            {c.title}
          </h2>
        </div>
        <VerdictPill verdict={analysis.verdict} label={c.verdict[analysis.verdict]} />
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <div className="w-[170px] shrink-0">
          <RiskGauge risk={analysis.risk} label={t(RISK_TEXT[analysis.risk])} caption={c.risk} size="sm" />
        </div>
        <div className="grid min-w-[150px] flex-1 gap-1">
          <span className="flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            <Gauge className="size-4" aria-hidden />
            {c.score}
          </span>
          <span className="text-2xl font-bold tabular-nums">
            {analysis.score}
            <span className="text-sm font-medium text-muted-foreground">/100</span>
          </span>
          <div className="h-1.5 overflow-hidden rounded-full bg-accent" aria-hidden>
            <div className={cn("h-full rounded-full", analysis.score >= 45 ? "bg-destructive" : analysis.score >= 25 ? "bg-warning" : "bg-success")} style={{ width: `${Math.max(analysis.score, 3)}%` }} />
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-full bg-warning-soft px-2.5 py-0.5 text-xs font-semibold text-warning">
              <TriangleAlert className="size-3.5" aria-hidden />
              {counts.warnings} {c.warnings.toLowerCase()}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2.5 py-0.5 text-xs font-semibold text-success">
              <CircleCheck className="size-3.5" aria-hidden />
              {counts.trust} {c.trust.toLowerCase()}
            </span>
            {analysis.links.length > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-0.5 text-xs font-semibold" title={c.note}>
                <ShieldCheck className="size-3.5" aria-hidden />
                {c.sandboxed}
              </span>
            )}
          </div>
        </div>
      </div>

      {analysis.links.map((link) => (
        <LinkSection key={link.url} link={link} c={c} language={language} single={single} />
      ))}

      {analysis.message.length > 0 && (
        <div className={cn("grid gap-2", analysis.links.length > 0 && "border-t border-border pt-4")}>
          <PartLabel>
            <span className="flex items-center gap-1.5">
              <MessageSquareWarning className="size-4" aria-hidden />
              {c.message}
            </span>
          </PartLabel>
          <Findings items={analysis.message} language={language} />
        </div>
      )}

    </section>
  );
}
