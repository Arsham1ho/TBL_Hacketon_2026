"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Ban, BadgeCheck, Building2, CircleCheck, Clock, EyeOff, Hand, Headset, Inbox, Info, Languages, Lock, MessageSquare, SendHorizontal, ShieldCheck, TriangleAlert, User } from "lucide-react";
import type { AgentCase, CaseMessage, CaseStatus } from "@/adapters/handoff-queue";
import type { Destination, Language, Risk, Urgency } from "@/engine/types";
import { cn } from "@/lib/utils";

// The DNA agent's side of a handoff. Staff-facing, so the console itself is in English; the
// customer's own words and the suggested opening line stay in the customer's language.

const ROUTE: Record<string, string> = {
  operator_support_agent: "Operator support",
  security_specialist: "Security specialist",
  business_security_support: "Business security support",
  human_advisor: "Human advisor",
  bank: "Customer's bank (customer contacts)",
  police: "Police (customer contacts)",
};

const RISK: Record<Risk, string> = { none: "No risk", low: "Low risk", medium: "Medium risk", high: "High risk", critical: "Critical risk" };
const URGENCY: Record<Urgency, string> = { immediate: "Act now", today: "Today", routine: "Routine", none: "No rush" };
const LANGUAGE: Record<Language, string> = { fi: "Finnish", en: "English", sv: "Swedish" };

const TONE: Record<Risk, { bar: string; box: string; dot: string }> = {
  critical: { bar: "bg-destructive", box: "border-destructive/30 bg-danger-soft", dot: "bg-destructive" },
  high: { bar: "bg-destructive", box: "border-destructive/30 bg-danger-soft", dot: "bg-destructive" },
  medium: { bar: "bg-warning", box: "border-warning/30 bg-warning-soft", dot: "bg-warning" },
  low: { bar: "bg-success", box: "border-success/30 bg-success-soft", dot: "bg-success" },
  none: { bar: "bg-success", box: "border-success/30 bg-success-soft", dot: "bg-success" },
};

const ORDER: Record<Risk, number> = { critical: 0, high: 1, medium: 2, low: 3, none: 4 };

// Reviewed playbook text per destination. It guides the agent; it never changes the decision.
const PLAYBOOK: Record<Destination, string[]> = {
  operator_support_agent: [
    "Check the subscription for a recent SIM swap, eSIM change or number transfer the customer didn't ask for.",
    "If a change was unauthorised, offer to block it. Blocking needs the customer's spoken approval.",
  ],
  security_specialist: [
    "Confirm which device or account is affected, using the facts below.",
    "Walk the customer through securing it step by step; don't take remote control of the device.",
  ],
  business_security_support: [
    "Confirm which company account, payment or staff login is affected.",
    "If money may move, ask the customer to involve their second approver before anything else.",
  ],
  human_advisor: [
    "Let the customer explain in their own words, then confirm the next safe step below.",
    "If the situation turns out to be urgent, transfer to the security specialist.",
  ],
};

// One-click replies in the customer's language. The agent can always type their own.
const QUICK: { label: string; text: Record<Language, (name: string) => string> }[] = [
  {
    label: "Greeting",
    text: {
      fi: (name) => `Hei, olen ${name} DNA:n asiakastuesta. Näen hyväksymäsi yhteenvedon, joten sinun ei tarvitse kertoa kaikkea uudelleen.`,
      en: (name) => `Hi, I'm ${name} from DNA Support. I can see the summary you approved, so you don't need to repeat everything.`,
      sv: (name) => `Hej, jag heter ${name} och jobbar på DNA:s kundtjänst. Jag ser sammanfattningen du godkände, så du behöver inte berätta allt igen.`,
    },
  },
  {
    label: "Checking",
    text: {
      fi: () => "Hetki, tarkistan tätä nyt. Älä jaa koodeja tai salasanoja kenellekään sillä välin.",
      en: () => "One moment, I'm checking this now. Please don't share any codes or passwords with anyone meanwhile.",
      sv: () => "Ett ögonblick, jag kollar det här nu. Dela inga koder eller lösenord med någon under tiden.",
    },
  },
  {
    label: "Ask approval",
    text: {
      fi: () => "Voin estää tämän muutoksen puolestasi. Haluatko, että teen sen? Vastaa kyllä tai ei.",
      en: () => "I can block this change for you. Do you want me to do that? Please answer yes or no.",
      sv: () => "Jag kan stoppa den här ändringen åt dig. Vill du att jag gör det? Svara ja eller nej.",
    },
  },
  {
    label: "Anything else?",
    text: {
      fi: () => "Onko vielä jotain, mistä olet epävarma?",
      en: () => "Is there anything else you're unsure about?",
      sv: () => "Är det något mer du är osäker på?",
    },
  },
];

const NAME_KEY = "safestep.agentName";

const NEEDS_APPROVAL = ["Blocking a SIM or number transfer", "Locking or resetting an account", "Cancelling a service or payment"];

function age(from: number, now: number) {
  const seconds = Math.max(0, Math.round((now - from) / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}

export function AgentConsole() {
  const [cases, setCases] = useState<AgentCase[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [agentName, setAgentName] = useState("Aino");
  // How many customer messages the agent has seen per case, for the unread dots.
  const [seen, setSeen] = useState<Record<string, number>>({});

  useEffect(() => {
    try {
      const saved = localStorage.getItem(NAME_KEY);
      if (saved) setAgentName(saved);
    } catch {}
  }, []);

  function rename(value: string) {
    setAgentName(value);
    try {
      localStorage.setItem(NAME_KEY, value);
    } catch {}
  }

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const response = await fetch("/api/agent", { cache: "no-store" });
        if (!response.ok) throw new Error(String(response.status));
        const data = (await response.json()) as { cases: AgentCase[] };
        if (!alive) return;
        setCases(data.cases);
        setOffline(false);
      } catch {
        if (alive) setOffline(true);
      }
    }
    void load();
    const poll = setInterval(load, 2000);
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      alive = false;
      clearInterval(poll);
      clearInterval(tick);
    };
  }, []);

  // Open cases first, most severe at the top, then oldest first so nobody waits too long.
  const sorted = useMemo(
    () => [...cases].sort((a, b) => Number(a.caseStatus === "resolved") - Number(b.caseStatus === "resolved") || ORDER[a.risk] - ORDER[b.risk] || a.createdAt - b.createdAt),
    [cases],
  );
  const active = sorted.find((item) => item.caseId === selected) ?? sorted[0] ?? null;
  const open = cases.filter((item) => item.caseStatus !== "resolved").length;

  const replace = (next: AgentCase) => setCases((previous) => previous.map((item) => (item.caseId === next.caseId ? next : item)));

  async function update(caseId: string, caseStatus: CaseStatus) {
    const response = await fetch("/api/agent", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ caseId, caseStatus, agentName: agentName.trim() || undefined }) }).catch(() => null);
    if (response?.ok) replace((await response.json()) as AgentCase);
  }

  async function message(caseId: string, text: string) {
    const response = await fetch("/api/agent", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ from: "agent", caseId, text }) }).catch(() => null);
    if (response?.ok) replace((await response.json()) as AgentCase);
  }

  const customerCount = (item: AgentCase) => item.messages.filter((entry) => entry.from === "customer").length;
  const activeId = active?.caseId;
  const activeCount = active ? customerCount(active) : 0;
  useEffect(() => {
    if (activeId) setSeen((previous) => (previous[activeId] === activeCount ? previous : { ...previous, [activeId]: activeCount }));
  }, [activeId, activeCount]);

  return (
    <div className="flex min-h-dvh flex-col bg-muted text-foreground">
      <header className="flex items-center gap-3 border-b border-border bg-card px-4 py-3 sm:px-6">
        <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground" aria-hidden>
          <Headset className="size-5" />
        </span>
        <div className="grid min-w-0 flex-1">
          <h1 className="truncate text-base font-semibold">SafeStep Agent Console</h1>
          <p className="truncate text-xs text-muted-foreground">DNA support · approved handoffs only</p>
        </div>
        <label className="hidden items-center gap-2 text-xs text-muted-foreground md:flex">
          Signed in as
          <input
            value={agentName}
            onChange={(event) => rename(event.target.value)}
            maxLength={40}
            aria-label="Agent name shown to the customer"
            className="w-28 rounded-full border border-border-strong bg-background px-2.5 py-1 text-xs font-semibold text-foreground outline-none focus:border-foreground"
          />
        </label>
        <span className="hidden rounded-full border border-border-strong px-2.5 py-0.5 text-xs font-medium text-muted-foreground lg:inline">Simulated, synthetic data</span>
        <span className="flex items-center gap-1.5 rounded-full bg-accent px-2.5 py-1 text-xs font-semibold tabular-nums">
          <span className={cn("size-2 rounded-full", offline ? "bg-destructive" : "bg-success motion-safe:animate-pulse")} aria-hidden />
          {offline ? "Offline" : `${open} open`}
        </span>
      </header>

      {sorted.length === 0 ? (
        <main className="grid flex-1 place-items-center p-6">
          <div className="grid max-w-sm justify-items-center gap-3 text-center">
            <span className="flex size-14 items-center justify-center rounded-full bg-card" aria-hidden>
              <Inbox className="size-7 text-muted-foreground" />
            </span>
            <h2 className="text-lg font-semibold">No cases yet</h2>
            <p className="text-sm text-muted-foreground">
              A case arrives here only after a customer reviews and approves the handoff in SafeStep. Open the app in another window to try it.
            </p>
          </div>
        </main>
      ) : (
        <main className="grid flex-1 gap-4 p-4 sm:p-6 lg:grid-cols-[320px_1fr]">
          <nav aria-label="Case queue" className="grid content-start gap-2">
            {sorted.map((item) => (
              <button
                key={item.caseId}
                type="button"
                onClick={() => setSelected(item.caseId)}
                aria-current={active?.caseId === item.caseId}
                className={cn(
                  "relative grid gap-1 overflow-hidden rounded-xl border bg-card py-3 pr-3 pl-4 text-left transition",
                  active?.caseId === item.caseId ? "border-foreground" : "border-border hover:border-border-strong",
                  item.caseStatus === "resolved" && "opacity-60",
                )}
              >
                <span className={cn("absolute inset-y-0 left-0 w-1", TONE[item.risk].bar)} aria-hidden />
                <span className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 font-mono text-sm font-semibold">
                    {item.caseId}
                    {customerCount(item) > (seen[item.caseId] ?? 0) && active?.caseId !== item.caseId && (
                      <span className="flex items-center gap-1 rounded-full bg-destructive px-1.5 py-px font-sans text-[10px] font-bold text-background">
                        <MessageSquare className="size-3" aria-hidden />
                        {customerCount(item) - (seen[item.caseId] ?? 0)}
                      </span>
                    )}
                  </span>
                  <StatusPill status={item.caseStatus} />
                </span>
                <span className="truncate text-sm font-medium">{item.likelyType ?? item.statusLabel ?? ROUTE[item.route]}</span>
                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{RISK[item.risk]}</span>·<span>{item.language.toUpperCase()}</span>·
                  <span className="flex items-center gap-1 tabular-nums">
                    <Clock className="size-3" aria-hidden />
                    {age(item.createdAt, now)}
                  </span>
                </span>
              </button>
            ))}
          </nav>
          {active && <CaseDetail key={active.caseId} item={active} now={now} agentName={agentName} update={update} message={message} />}
        </main>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: CaseStatus }) {
  const style = { new: "bg-primary text-primary-foreground", accepted: "bg-warning-soft text-warning", resolved: "bg-success-soft text-success" }[status];
  const label = { new: "New", accepted: "In progress", resolved: "Resolved" }[status];
  return <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", style)}>{label}</span>;
}

const Label = ({ children }: { children: React.ReactNode }) => <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{children}</span>;

function Section({ icon, title, children, className }: { icon: React.ReactNode; title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("grid content-start gap-2.5 rounded-2xl border border-border bg-card p-4", className)}>
      <h3 className="flex items-center gap-2">
        {icon}
        <Label>{title}</Label>
      </h3>
      {children}
    </section>
  );
}

function CaseDetail({ item, now, agentName, update, message }: { item: AgentCase; now: number; agentName: string; update: (caseId: string, status: CaseStatus) => void; message: (caseId: string, text: string) => Promise<void> }) {
  const tone = TONE[item.risk];
  const { details } = item;
  // The step the customer couldn't finish is where the agent should start.
  const startHere = details.unable[0] ?? null;

  return (
    <article aria-labelledby="case-title" className="grid content-start gap-4">
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-4">
        <div className="grid min-w-0 flex-1 gap-1">
          <span className="flex flex-wrap items-center gap-2">
            <h2 id="case-title" className="font-mono text-lg font-bold">{item.caseId}</h2>
            <StatusPill status={item.caseStatus} />
          </span>
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Headset className="size-3.5" aria-hidden />
              {ROUTE[item.route]}
            </span>
            <span className="flex items-center gap-1">
              {item.audience === "small_business" ? <Building2 className="size-3.5" aria-hidden /> : <User className="size-3.5" aria-hidden />}
              {item.audience === "small_business" ? "Small business" : "Consumer"}
            </span>
            <span className="flex items-center gap-1">
              <Languages className="size-3.5" aria-hidden />
              {LANGUAGE[item.language]}
            </span>
            <span className="flex items-center gap-1 tabular-nums">
              <Clock className="size-3.5" aria-hidden />
              Waiting {age(item.createdAt, now)}
            </span>
          </span>
        </div>
        <div className="flex gap-2">
          {item.caseStatus === "new" && (
            <button type="button" onClick={() => update(item.caseId, "accepted")} className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
              Accept and join chat
            </button>
          )}
          {item.caseStatus === "accepted" && (
            <button type="button" onClick={() => update(item.caseId, "resolved")} className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
              Close case
            </button>
          )}
          {item.caseStatus === "resolved" && (
            <button type="button" onClick={() => update(item.caseId, "accepted")} className="rounded-full border border-border-strong px-4 py-2 text-sm font-semibold">
              Reopen
            </button>
          )}
        </div>
      </div>

      <div className={cn("flex flex-wrap items-center gap-3 rounded-2xl border p-4", tone.box)}>
        <TriangleAlert className="size-6 shrink-0" aria-hidden />
        <div className="grid min-w-0 flex-1 gap-0.5">
          <Label>Priority</Label>
          <span className="text-lg leading-tight font-bold">
            {RISK[item.risk]} · {URGENCY[item.urgency]}
          </span>
        </div>
        <div className="grid gap-0.5 text-right text-sm">
          {item.statusLabel && <span className="font-semibold">{item.statusLabel}</span>}
          {item.likelyType && <span className="text-muted-foreground">Likely: {item.likelyType}</span>}
        </div>
      </div>

      <div className="flex items-start gap-3 rounded-2xl border border-success/30 bg-success-soft p-4 text-sm">
        <BadgeCheck className="mt-px size-5 shrink-0 text-success" aria-hidden />
        <p>
          <span className="font-semibold">Customer is already identified through DNA login.</span> Don&apos;t re-verify them with one-time codes. SafeStep never asks for codes, passwords,
          PINs or card numbers, and neither should you.
        </p>
      </div>

      <CaseChat item={item} agentName={agentName} accept={() => update(item.caseId, "accepted")} send={(text) => message(item.caseId, text)} />

      <div className="grid gap-4 xl:grid-cols-2">
        <Section icon={<Hand className="size-4" aria-hidden />} title="Start here">
          {startHere && (
            <p className="rounded-xl border-l-4 border-warning bg-warning-soft px-3 py-2.5 text-sm font-medium">
              The customer couldn&apos;t do this themselves: <span className="font-semibold">{startHere}</span>
            </p>
          )}
          <ol className="grid list-decimal gap-1.5 pl-5 text-sm">
            {PLAYBOOK[item.destination].map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ol>
        </Section>

        <Section icon={<Info className="size-4" aria-hidden />} title="What the customer confirmed">
          {details.facts.length > 0 ? (
            <ul className="grid gap-1.5">
              {details.facts.map((fact) => (
                <li key={fact} className="rounded-xl bg-accent px-3 py-2 text-sm font-medium">
                  {fact}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No confirmed facts. Ask the customer to describe what happened.</p>
          )}
          <div className="grid gap-1 border-t border-border pt-2.5">
            <Label>Why SafeStep escalated</Label>
            <p className="text-sm">{details.reason}</p>
          </div>
        </Section>

        <Section icon={<CircleCheck className="size-4" aria-hidden />} title="Recovery steps so far">
          {details.completed.length + details.unable.length === 0 ? (
            <p className="text-sm text-muted-foreground">The customer hasn&apos;t started any recovery steps yet.</p>
          ) : (
            <ul className="grid gap-1.5">
              {details.completed.map((step) => (
                <li key={step} className="flex items-start gap-2 rounded-xl bg-success-soft/60 px-3 py-2 text-sm">
                  <CircleCheck className="mt-px size-4 shrink-0 text-success" aria-hidden />
                  {step}
                </li>
              ))}
              {details.unable.map((step) => (
                <li key={step} className="flex items-start gap-2 rounded-xl bg-warning-soft px-3 py-2 text-sm">
                  <Ban className="mt-px size-4 shrink-0 text-warning" aria-hidden />
                  {step}
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section icon={<Lock className="size-4" aria-hidden />} title="Needs the customer's approval first">
          <ul className="grid gap-1.5 text-sm">
            {NEEDS_APPROVAL.map((line) => (
              <li key={line} className="flex items-center gap-2">
                <span className={cn("size-1.5 shrink-0 rounded-full", tone.dot)} aria-hidden />
                {line}
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">Nothing irreversible happens without the customer saying yes.</p>
        </Section>

        <Section icon={<EyeOff className="size-4" aria-hidden />} title="What you can't see">
          <ul className="grid gap-1.5 text-sm">
            <li className="flex items-start gap-2">
              <ShieldCheck className="mt-px size-4 shrink-0 text-success" aria-hidden />
              The customer&apos;s original messages, links and call notes stay in their session.
            </li>
            <li className="flex items-start gap-2">
              <ShieldCheck className="mt-px size-4 shrink-0 text-success" aria-hidden />
              Removed before sharing: {item.omitted.join(", ")}.
            </li>
            <li className="flex items-start gap-2">
              <ShieldCheck className="mt-px size-4 shrink-0 text-success" aria-hidden />
              {item.consentUsed.length > 0 ? `Checks the customer allowed: ${item.consentUsed.join(", ")}.` : "The customer allowed no extra account or device checks."}
            </li>
          </ul>
        </Section>
      </div>
    </article>
  );
}

function ChatLine({ message, customerLanguage }: { message: CaseMessage; customerLanguage: Language }) {
  if (message.from === "system") {
    const text = { joined: `${message.name} joined the chat`, resolved: `${message.name} closed the case`, reopened: `${message.name} reopened the case` }[message.event];
    return <p className="mx-auto rounded-full bg-accent px-3 py-1 text-xs font-medium text-muted-foreground">{text}</p>;
  }
  if (message.from === "agent") {
    return <p className="ml-auto max-w-[80%] rounded-2xl rounded-br-sm bg-primary px-3 py-2 text-sm leading-snug text-primary-foreground">{message.text}</p>;
  }
  return (
    <div className="grid max-w-[80%] gap-0.5">
      <span className="text-[11px] font-medium text-muted-foreground">Customer · {LANGUAGE[customerLanguage]}</span>
      <p className="rounded-2xl rounded-bl-sm bg-accent px-3 py-2 text-sm leading-snug">{message.text}</p>
      {message.masked && (
        <span className="flex items-center gap-1 text-[11px] text-success">
          <Lock className="size-3" aria-hidden />
          A code or password was masked before you could see it
        </span>
      )}
    </div>
  );
}

// The live chat with the customer. It opens only once the agent accepts the case, so the
// customer sees exactly when a real person joins.
function CaseChat({ item, agentName, accept, send }: { item: AgentCase; agentName: string; accept: () => void; send: (text: string) => Promise<void> }) {
  const [text, setText] = useState("");
  const list = useRef<HTMLDivElement>(null);

  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight, behavior: "smooth" });
  }, [item.messages.length]);

  async function submit(value: string) {
    const trimmed = value.trim();
    if (!trimmed) return;
    setText("");
    await send(trimmed);
  }

  if (item.caseStatus === "new") {
    return (
      <section className="flex flex-wrap items-center gap-3 rounded-2xl border-2 border-dashed border-border-strong bg-card p-4">
        <MessageSquare className="size-6 shrink-0 text-muted-foreground" aria-hidden />
        <p className="min-w-0 flex-1 text-sm">
          <span className="font-semibold">The customer is waiting in SafeStep.</span> When you accept, they see that {agentName.trim() || "an agent"} joined and the chat opens on their screen.
        </p>
        <button type="button" onClick={accept} className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
          Accept and join chat
        </button>
      </section>
    );
  }

  const closed = item.caseStatus === "resolved";
  const name = item.agentName ?? agentName;
  return (
    <section aria-label="Chat with the customer" className="grid overflow-hidden rounded-2xl border border-border bg-card">
      <h3 className="flex items-center gap-2 border-b border-border px-4 py-2.5">
        <MessageSquare className="size-4" aria-hidden />
        <Label>Chat with the customer</Label>
        <span className="ml-auto text-xs text-muted-foreground">Customer writes in {LANGUAGE[item.language]}</span>
      </h3>
      <div ref={list} role="log" aria-live="polite" className="grid max-h-80 min-h-32 content-start gap-2.5 overflow-y-auto px-4 py-3">
        {item.messages.map((entry) => (
          <ChatLine key={entry.id} message={entry} customerLanguage={item.language} />
        ))}
      </div>
      {!closed && (
        <div className="grid gap-2 border-t border-border p-3">
          <div className="flex flex-wrap gap-1.5">
            {QUICK.map((quick) => (
              <button
                key={quick.label}
                type="button"
                onClick={() => void submit(quick.text[item.language](name))}
                title={quick.text[item.language](name)}
                className="rounded-full border border-border-strong px-3 py-1 text-xs font-semibold hover:bg-accent"
              >
                {quick.label}
              </button>
            ))}
          </div>
          <form
            className="flex items-center gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              void submit(text);
            }}
          >
            <input
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder={`Reply as ${name}…`}
              aria-label="Reply to the customer"
              maxLength={2000}
              className="min-w-0 flex-1 rounded-full border border-border-strong bg-background px-3.5 py-2 text-sm outline-none focus:border-foreground"
            />
            <button type="submit" disabled={!text.trim()} aria-label="Send" className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-40">
              <SendHorizontal className="size-4" aria-hidden />
            </button>
          </form>
        </div>
      )}
    </section>
  );
}
