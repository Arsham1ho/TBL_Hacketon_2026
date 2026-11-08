"use client";

import type { ReactNode } from "react";
import { Check, ChevronDown, Clock, FileText, Headset, Landmark, MessageCircle, Phone, ShieldCheck, Siren, Zap } from "lucide-react";
import type { ApiResponse, HandoffDetails, SupportRoute } from "@/engine/screens";
import type { Language, Risk } from "@/engine/types";
import type { Translate } from "@/lib/ui-text";
import { cn } from "@/lib/utils";

// Talking to a person means DNA Customer Service, by chat or a call back, with a case
// summary the user approves first. A bank or the police appear as an extra contact when
// they're the ones who can act. Everything here is simulated.
export type Channel = "chat" | "call";

type Copy = {
  team: Record<"customer" | "security" | "business" | "operator", string>;
  available: (minutes: number) => string;
  chat: string;
  chatHint: string;
  call: string;
  callHint: string;
  ticket: string;
  agentReads: string;
  why: string;
  doneByYou: string;
  couldNot: string;
  alsoContact: string;
  alsoHint: Partial<Record<SupportRoute, string>>;
  never: string;
  priority: string;
  standard: string;
  send: Record<Channel, string>;
  dont: string;
  sent: string;
  agentHas: string;
  chatOpen: string;
  callBooked: (minutes: number) => string;
  greeting: (name: string, team: string, situation: string) => string;
  callNote: string;
  agentView: string;
  simulated: string;
  risk: Record<Risk, string>;
};

const COPY: Record<Language, Copy> = {
  en: {
    team: { customer: "DNA Customer Service", security: "DNA Security Specialist", business: "DNA Business Security Support", operator: "DNA Customer Service" },
    available: (m) => `Available now · about ${m} min`,
    chat: "Chat",
    chatHint: "Start now in the app",
    call: "Call me back",
    callHint: "To your DNA number",
    ticket: "Case",
    agentReads: "What the agent will read",
    why: "Why a person should look at this",
    doneByYou: "Already done by you",
    couldNot: "You couldn't do",
    alsoContact: "Also contact",
    alsoHint: { bank: "Only your bank can stop or recover a payment. The agent will help you reach its fraud line.", police: "The agent will help you file a police report." },
    never: "Never shared: codes, passwords and card numbers",
    priority: "Priority",
    standard: "Standard queue",
    send: { chat: "Send summary and start chat", call: "Send summary and request call" },
    dont: "Don't share",
    sent: "Summary sent",
    agentHas: "An agent has your case",
    chatOpen: "Chat is open",
    callBooked: (m) => `Call booked within ${m} min`,
    greeting: (name, team, topic) => `Hi, I'm ${name} from ${team}. I've read your summary about ${topic.toLowerCase()}, so you don't need to repeat anything. Let's go through the next step together.`,
    callNote: "Keep your phone nearby. The agent already has your summary, so you won't need to explain it again. DNA will never ask for codes or passwords on the call.",
    agentView: "What the agent sees",
    simulated: "Simulated for the prototype",
    risk: { none: "No risk", low: "Low risk", medium: "Medium risk", high: "High risk", critical: "Critical" },
  },
  fi: {
    team: { customer: "DNA:n asiakaspalvelu", security: "DNA:n tietoturva-asiantuntija", business: "DNA:n yritysten tietoturvatuki", operator: "DNA:n asiakaspalvelu" },
    available: (m) => `Tavoitettavissa nyt · noin ${m} min`,
    chat: "Chat",
    chatHint: "Aloita heti sovelluksessa",
    call: "Soittopyyntö",
    callHint: "DNA-numeroosi",
    ticket: "Tapaus",
    agentReads: "Mitä asiantuntija näkee",
    why: "Miksi ihmisen kannattaa katsoa tätä",
    doneByYou: "Olet jo tehnyt",
    couldNot: "Et pystynyt tekemään",
    alsoContact: "Ota yhteyttä myös",
    alsoHint: { bank: "Vain pankkisi voi pysäyttää tai palauttaa maksun. Asiantuntija auttaa tavoittamaan sen petosyksikön.", police: "Asiantuntija auttaa tekemään rikosilmoituksen." },
    never: "Ei koskaan jaeta: koodeja, salasanoja eikä korttinumeroita",
    priority: "Etusija",
    standard: "Tavallinen jono",
    send: { chat: "Lähetä yhteenveto ja aloita chat", call: "Lähetä yhteenveto ja pyydä soitto" },
    dont: "Älä jaa",
    sent: "Yhteenveto lähetetty",
    agentHas: "Asiantuntija on saanut tapauksesi",
    chatOpen: "Chat on auki",
    callBooked: (m) => `Soitto tulee ${m} minuutin sisällä`,
    greeting: (name, team, topic) => `Hei, olen ${name}, ${team}. Luin yhteenvetosi (${topic.toLowerCase()}), joten sinun ei tarvitse kertoa asiaa uudelleen. Käydään seuraava askel läpi yhdessä.`,
    callNote: "Pidä puhelin lähellä. Asiantuntijalla on jo yhteenvetosi, joten asiaa ei tarvitse selittää uudelleen. DNA ei koskaan kysy puhelimessa koodeja tai salasanoja.",
    agentView: "Mitä asiantuntija näkee",
    simulated: "Simuloitu prototyyppiä varten",
    risk: { none: "Ei riskiä", low: "Matala riski", medium: "Keskitason riski", high: "Korkea riski", critical: "Kriittinen" },
  },
  sv: {
    team: { customer: "DNA:s kundtjänst", security: "DNA:s säkerhetsspecialist", business: "DNA:s säkerhetsstöd för företag", operator: "DNA:s kundtjänst" },
    available: (m) => `Tillgänglig nu · cirka ${m} min`,
    chat: "Chatt",
    chatHint: "Starta nu i appen",
    call: "Ring upp mig",
    callHint: "Till ditt DNA-nummer",
    ticket: "Ärende",
    agentReads: "Det här läser handläggaren",
    why: "Varför en person bör titta på detta",
    doneByYou: "Det här har du redan gjort",
    couldNot: "Det här kunde du inte göra",
    alsoContact: "Kontakta också",
    alsoHint: { bank: "Bara din bank kan stoppa eller återföra en betalning. Handläggaren hjälper dig att nå dess bedrägeriavdelning.", police: "Handläggaren hjälper dig att göra en polisanmälan." },
    never: "Delas aldrig: koder, lösenord och kortnummer",
    priority: "Förtur",
    standard: "Vanlig kö",
    send: { chat: "Skicka sammanfattning och starta chatt", call: "Skicka sammanfattning och be om samtal" },
    dont: "Dela inte",
    sent: "Sammanfattning skickad",
    agentHas: "En handläggare har ditt ärende",
    chatOpen: "Chatten är öppen",
    callBooked: (m) => `Samtal inom ${m} min`,
    greeting: (name, team, topic) => `Hej, jag heter ${name} och jobbar på ${team}. Jag har läst din sammanfattning (${topic.toLowerCase()}), så du behöver inte upprepa något. Vi går igenom nästa steg tillsammans.`,
    callNote: "Ha telefonen nära. Handläggaren har redan din sammanfattning, så du behöver inte förklara igen. DNA frågar aldrig efter koder eller lösenord i telefon.",
    agentView: "Det här ser handläggaren",
    simulated: "Simulerat för prototypen",
    risk: { none: "Ingen risk", low: "Låg risk", medium: "Medelhög risk", high: "Hög risk", critical: "Kritisk" },
  },
};

const RISK_TONE: Record<Risk, string> = {
  none: "bg-success-soft text-success",
  low: "bg-success-soft text-success",
  medium: "bg-warning-soft text-warning",
  high: "bg-danger-soft text-destructive",
  critical: "bg-danger-soft text-destructive",
};

const teamFor = (route: SupportRoute): keyof Copy["team"] =>
  route === "security_specialist" ? "security" : route === "business_security_support" ? "business" : route === "operator_support_agent" ? "operator" : "customer";
const external = (route: SupportRoute) => route === "bank" || route === "police";
const waitMinutes = (priority: boolean) => (priority ? 1 : 6);

// A stable, readable case number from the summary, so the same case keeps the same number.
export function caseNumber(lines: string[]): string {
  let hash = 0;
  for (const char of lines.join("|")) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return `DNA-${String(hash % 100000).padStart(5, "0")}`;
}

const PartLabel = ({ children }: { children: ReactNode }) => <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{children}</span>;

function TeamHeader({ team, line, priority, language, caseLine = false }: { team: string; line: string; priority: boolean; language: Language; caseLine?: boolean }) {
  const c = COPY[language];
  return (
    <div className="flex items-center gap-3">
      <span className="relative flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground" aria-hidden>
        <Headset className="size-5" />
        <span className="absolute -right-0.5 -bottom-0.5 size-3.5 rounded-full border-2 border-card bg-success" />
      </span>
      <div className="grid min-w-0 flex-1 gap-0.5">
        <h1 id="handoff-title" tabIndex={-1} className="truncate text-base font-semibold focus:outline-none">{team}</h1>
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          {caseLine ? <FileText className="size-3.5 shrink-0" aria-hidden /> : <Clock className="size-3.5 shrink-0" aria-hidden />}
          {line}
        </p>
      </div>
      <span className={cn("inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold", priority ? "bg-success-soft text-success" : "bg-accent text-muted-foreground")}>
        {priority && <Zap className="size-3.5" aria-hidden />}
        {priority ? c.priority : c.standard}
      </span>
    </div>
  );
}

// Step 1: choose chat or call, and check exactly what the agent will receive.
export function DnaHandoffCard(p: {
  screen: Extract<ApiResponse["screen"], { type: "handoff" }>;
  state: ApiResponse["state"];
  language: Language;
  priority: boolean;
  channel: Channel;
  onChannel: (channel: Channel) => void;
}) {
  const c = COPY[p.language];
  const { screen, state } = p;
  const details: HandoffDetails | undefined = screen.details;
  const route = screen.route;
  const team = c.team[teamFor(external(route) ? "human_advisor" : route)];
  const facts = details?.facts ?? screen.summary;
  const options: { id: Channel; icon: typeof MessageCircle; label: string; hint: string }[] = [
    { id: "chat", icon: MessageCircle, label: c.chat, hint: c.chatHint },
    { id: "call", icon: Phone, label: c.call, hint: c.callHint },
  ];
  return (
    <section aria-labelledby="handoff-title" className="grid gap-4 rounded-2xl border border-border-strong bg-card p-4 motion-safe:animate-[fade-up_.35s_ease-out]">
      <TeamHeader team={team} line={c.available(waitMinutes(p.priority))} priority={p.priority} language={p.language} />

      <div role="radiogroup" aria-label={`${c.chat} / ${c.call}`} className="grid grid-cols-2 gap-2">
        {options.map((option) => {
          const Icon = option.icon;
          const selected = p.channel === option.id;
          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => p.onChannel(option.id)}
              className={cn("flex items-center gap-2.5 rounded-xl border p-3 text-left transition-all", selected ? "border-foreground bg-accent shadow-sm" : "border-border-strong hover:bg-accent")}
            >
              <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-full", selected ? "bg-foreground text-background" : "bg-accent")} aria-hidden>
                <Icon className="size-4" />
              </span>
              <span className="grid min-w-0">
                <span className="text-sm font-semibold">{option.label}</span>
                <span className="truncate text-xs text-muted-foreground">{option.hint}</span>
              </span>
            </button>
          );
        })}
      </div>

      {/* The case ticket: what is sent, in the order an agent reads it. */}
      <div className="grid gap-3 rounded-xl border border-border bg-accent/40 p-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-sm font-semibold">
            <FileText className="size-4" aria-hidden />
            {c.ticket} {caseNumber(screen.summary)}
          </span>
          <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold", RISK_TONE[state.risk])}>
            <Siren className="size-3.5" aria-hidden />
            {c.risk[state.risk]}
          </span>
        </div>
        {state.statusLabel && <p className="text-sm font-medium">{state.statusLabel}</p>}
        {facts.length > 0 && (
          <div className="grid gap-1.5">
            <PartLabel>{c.agentReads}</PartLabel>
            <ul className="grid gap-1">
              {facts.map((fact) => (
                <li key={fact} className="flex items-start gap-2 text-sm leading-snug">
                  <span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-foreground/50" aria-hidden />
                  {fact}
                </li>
              ))}
            </ul>
          </div>
        )}
        {details?.reason && (
          <div className="grid gap-1">
            <PartLabel>{c.why}</PartLabel>
            <p className="text-sm leading-snug">{details.reason}</p>
          </div>
        )}
        {details && details.completed.length > 0 && (
          <div className="grid gap-1.5">
            <PartLabel>{c.doneByYou}</PartLabel>
            <ul className="flex flex-wrap gap-1.5">
              {details.completed.map((step) => (
                <li key={step} className="inline-flex items-center gap-1.5 rounded-full bg-success-soft px-2.5 py-1 text-xs font-medium text-success">
                  <Check className="size-3.5" aria-hidden />
                  {step}
                </li>
              ))}
            </ul>
          </div>
        )}
        {details && details.unable.length > 0 && (
          <div className="grid gap-1.5">
            <PartLabel>{c.couldNot}</PartLabel>
            <ul className="flex flex-wrap gap-1.5">
              {details.unable.map((step) => (
                <li key={step} className="rounded-full bg-warning-soft px-2.5 py-1 text-xs font-medium text-warning">{step}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {external(route) && c.alsoHint[route] && (
        <div className="flex items-start gap-3 rounded-xl border border-border-strong p-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent" aria-hidden>
            <Landmark className="size-4" />
          </span>
          <p className="grid gap-0.5 text-sm">
            <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{c.alsoContact}</span>
            <span>{c.alsoHint[route]}</span>
          </p>
        </div>
      )}

      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <ShieldCheck className="size-4 shrink-0 text-success" aria-hidden />
        {c.never}
      </p>
    </section>
  );
}

export const sendLabel = (language: Language, channel: Channel) => COPY[language].send[channel];
export const dontShareLabel = (language: Language) => COPY[language].dont;

// Step 2: the summary has reached a person. Shows progress, the agent's first message or the
// call booking, and what the agent sees.
export function DnaConnectedCard(p: { route: SupportRoute; summary: string[]; state: ApiResponse["state"]; language: Language; channel: Channel; priority: boolean; agentView: ReactNode }) {
  const c = COPY[p.language];
  const team = c.team[teamFor(external(p.route) ? "human_advisor" : p.route)];
  const minutes = waitMinutes(p.priority) + (p.channel === "call" ? 4 : 0);
  const steps = [c.sent, c.agentHas, p.channel === "chat" ? c.chatOpen : c.callBooked(minutes)];
  const name = { en: "Aino", fi: "Aino", sv: "Aino" }[p.language];
  return (
    <section aria-labelledby="handoff-title" className="grid gap-4 rounded-2xl border border-success/30 bg-card p-4 motion-safe:animate-[fade-up_.35s_ease-out]">
      <TeamHeader team={team} line={`${c.ticket} ${caseNumber(p.summary)}`} priority={p.priority} language={p.language} caseLine />

      <ol className="grid gap-2">
        {steps.map((step) => (
          <li key={step} className="flex items-center gap-2.5 text-sm font-medium">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-success text-background" aria-hidden>
              <Check className="size-3.5" strokeWidth={3} />
            </span>
            {step}
          </li>
        ))}
      </ol>

      {p.channel === "chat" ? (
        <div className="flex items-start gap-2.5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground" aria-hidden>
            {name[0]}
          </span>
          <p className="rounded-2xl rounded-tl-sm bg-accent px-3.5 py-2.5 text-sm leading-relaxed">{c.greeting(name, team, p.state.likelyType ?? p.state.statusLabel ?? "")}</p>
        </div>
      ) : (
        <p className="flex items-start gap-2.5 rounded-xl bg-accent px-3.5 py-3 text-sm leading-relaxed">
          <Phone className="mt-0.5 size-4 shrink-0" aria-hidden />
          {c.callNote}
        </p>
      )}

      <details className="group text-sm">
        <summary className="flex min-h-10 cursor-pointer list-none items-center gap-1.5 font-medium text-muted-foreground">
          <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden />
          {c.agentView}
        </summary>
        <div className="mt-2">{p.agentView}</div>
      </details>
      <p className="text-xs text-muted-foreground">{c.simulated}</p>
    </section>
  );
}

export const dnaHandoffText = (language: Language) => COPY[language];
export const dnaTeamName = (language: Language, route: SupportRoute) => COPY[language].team[teamFor(external(route) ? "human_advisor" : route)];
export type { Translate };
