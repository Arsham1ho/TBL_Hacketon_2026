"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Headset, Lock, SendHorizontal, ShieldCheck } from "lucide-react";
import type { CaseMessage, CustomerCaseView } from "@/adapters/handoff-queue";
import type { AgentPreview } from "@/lib/client";
import type { Translate } from "@/lib/ui-text";
import { cn } from "@/lib/utils";

export type SupportCase = { caseId: string; token: string };

const fill = (text: string, values: Record<string, string | number>) => text.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ""));

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

// Polls the customer's own case: queue place, agent name and chat. Never the case content.
export function useSupportCase(support: SupportCase | null) {
  const [view, setView] = useState<CustomerCaseView | null>(null);

  useEffect(() => {
    setView(null);
    if (!support) return;
    let alive = true;
    async function load() {
      const response = await fetch(`/api/agent?caseId=${encodeURIComponent(support!.caseId)}&token=${encodeURIComponent(support!.token)}`, { cache: "no-store" }).catch(() => null);
      if (!alive || !response?.ok) return;
      setView((await response.json()) as CustomerCaseView);
    }
    void load();
    const poll = setInterval(load, 2000);
    return () => {
      alive = false;
      clearInterval(poll);
    };
  }, [support]);

  async function send(text: string) {
    if (!support) return;
    const response = await fetch("/api/agent", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ from: "customer", caseId: support.caseId, token: support.token, text }),
    }).catch(() => null);
    if (response?.ok) setView((await response.json()) as CustomerCaseView);
  }

  return { view, send };
}

function Avatar({ name, className }: { name: string | null; className?: string }) {
  return (
    <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground", className)} aria-hidden>
      {name ? initials(name) : <Headset className="size-[1.1em]" />}
    </span>
  );
}

// Shown right after approval: a short progress bar, so the customer knows a person is coming.
export function SupportConnecting({ agent, view, t }: { agent: AgentPreview; view: CustomerCaseView | null; t: Translate }) {
  const status = view?.caseStatus ?? "new";
  const name = view?.agentName ?? null;
  const joined = status !== "new";
  // 0: shared, 1: waiting, 2: agent joined.
  const reached = joined ? 2 : 1;
  const stages = [t("supportShared"), t("supportQueue"), name ? fill(t("supportHelping"), { name }) : t("supportAgentStep")];
  const facts = agent.details?.facts ?? agent.summary;
  const line = joined ? (name ? fill(t("supportJoined"), { name }) : t("supportTitle")) : view?.position ? fill(t("supportQueuePosition"), { n: view.position }) : t("supportQueue");

  return (
    <section aria-labelledby="support-connecting" className="grid gap-4 rounded-2xl border border-border-strong bg-card p-4 motion-safe:animate-[fade-up_.35s_ease-out]">
      <div className="flex items-center gap-3">
        <span className="relative shrink-0">
          <Avatar name={name} className="size-10" />
          <span className={cn("absolute -right-0.5 -bottom-0.5 size-3 rounded-full border-2 border-card", joined ? "bg-success" : "bg-warning motion-safe:animate-pulse")} aria-hidden />
        </span>
        <div className="grid min-w-0 flex-1 gap-0.5">
          <h1 id="support-connecting" tabIndex={-1} className="text-base leading-tight font-semibold focus:outline-none">
            {joined && name ? fill(t("supportHelping"), { name }) : t("supportConnecting")}
          </h1>
          <p className="truncate text-sm text-muted-foreground">{t(agent.route)}</p>
        </div>
        {agent.caseId && <span className="shrink-0 rounded-full bg-accent px-2.5 py-1 text-xs font-semibold tabular-nums text-muted-foreground">{agent.caseId}</span>}
      </div>

      <div className="grid gap-2">
        <ol className="grid grid-cols-3 gap-1.5" aria-label={t("supportTitle")}>
          {stages.map((label, index) => (
            <li key={index} className="grid gap-1.5" aria-current={index === reached ? "step" : undefined}>
              <span className="h-1.5 overflow-hidden rounded-full bg-accent">
                <span
                  className={cn(
                    "block h-full rounded-full transition-all duration-700",
                    index < reached || (index === reached && joined) ? "w-full bg-success" : index === reached ? "w-1/2 bg-foreground motion-safe:animate-pulse" : "w-0",
                  )}
                />
              </span>
              <span className={cn("flex items-center gap-1 text-xs leading-tight font-medium", index > reached ? "text-muted-foreground" : "text-foreground")}>
                {(index < reached || (index === reached && joined)) && <Check className="size-3.5 shrink-0 text-success" aria-hidden />}
                {label}
              </span>
            </li>
          ))}
        </ol>
        <p role="status" aria-live="polite" className="text-sm font-semibold">
          {line}
        </p>
      </div>

      <p className="text-[15px] leading-snug text-muted-foreground">{t("supportWhile")}</p>

      {facts.length > 0 && (
        <details className="group rounded-xl border border-border px-3 py-2 text-sm">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 font-medium">
            <span className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-success" aria-hidden />
              {t("supportWhatShared")}
            </span>
            <ChevronDown className="size-4 text-muted-foreground transition group-open:rotate-180" aria-hidden />
          </summary>
          <ul className="mt-2 grid list-disc gap-1 pl-5">
            {facts.map((fact) => (
              <li key={fact}>{fact}</li>
            ))}
            {agent.details?.reason && <li>{agent.details.reason}</li>}
          </ul>
          <p className="mt-2 text-xs text-muted-foreground">
            {t("neverShared")}: {agent.omitted.join(", ")}
          </p>
        </details>
      )}
    </section>
  );
}

function SystemLine({ message, t }: { message: Extract<CaseMessage, { from: "system" }>; t: Translate }) {
  const key = { joined: "supportJoined", resolved: "supportResolved", reopened: "supportReopened" }[message.event];
  return <p className="mx-auto rounded-full bg-accent px-3 py-1 text-center text-xs font-medium text-muted-foreground">{fill(t(key), { name: message.name })}</p>;
}

// The live chat with DNA Support. It stays on screen while the customer keeps going with their
// steps, starts folded while they wait, and opens by itself when the agent joins or writes.
export function SupportDock({ view, send, t }: { view: CustomerCaseView; send: (text: string) => Promise<void>; t: Translate }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [seen, setSeen] = useState(0);
  const list = useRef<HTMLDivElement>(null);
  const fromAgent = view.messages.filter((message) => message.from !== "customer").length;
  const unread = open ? 0 : Math.max(0, fromAgent - seen);
  const lastAgentCount = useRef(0);

  // A new message from the agent's side opens the chat, like a real support widget.
  useEffect(() => {
    if (fromAgent > lastAgentCount.current) setOpen(true);
    lastAgentCount.current = fromAgent;
  }, [fromAgent]);

  useEffect(() => {
    if (open) setSeen(fromAgent);
  }, [open, fromAgent]);

  useEffect(() => {
    if (open) list.current?.scrollTo({ top: list.current.scrollHeight, behavior: "smooth" });
  }, [open, view.messages.length]);

  const name = view.agentName;
  const closed = view.caseStatus === "resolved";
  const subtitle = closed ? fill(t("supportResolved"), { name: name ?? t("supportTitle") }) : name ? fill(t("supportHelping"), { name }) : view.position ? fill(t("supportQueuePosition"), { n: view.position }) : t("supportQueue");

  async function submit() {
    const value = text.trim();
    if (!value || sending) return;
    setSending(true);
    setText("");
    await send(value);
    setSending(false);
  }

  return (
    <section aria-label={t("supportTitle")} className="mb-2 overflow-hidden rounded-2xl border border-border-strong bg-card shadow-sm">
      <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} className="flex w-full items-center gap-3 px-3 py-2.5 text-left">
        <span className="relative">
          <Avatar name={name} />
          <span className={cn("absolute -right-0.5 -bottom-0.5 size-3 rounded-full border-2 border-card", closed ? "bg-muted-foreground" : name ? "bg-success" : "bg-warning motion-safe:animate-pulse")} aria-hidden />
        </span>
        <span className="grid min-w-0 flex-1">
          <span className="text-sm font-semibold">{t("supportTitle")}</span>
          <span className="truncate text-xs text-muted-foreground">{subtitle}</span>
        </span>
        {unread > 0 && (
          <span className="rounded-full bg-destructive px-2 py-0.5 text-xs font-semibold text-background">
            {unread} {t("supportNew")}
          </span>
        )}
        <span className="sr-only">{open ? t("supportMinimize") : t("supportOpen")}</span>
        <ChevronDown className={cn("size-5 text-muted-foreground transition", !open && "rotate-180")} aria-hidden />
      </button>

      {open && (
        <div className="border-t border-border">
          <div ref={list} role="log" aria-live="polite" className="grid max-h-[38vh] gap-2.5 overflow-y-auto px-3 py-3">
            {view.messages.length === 0 && <p className="py-4 text-center text-sm text-muted-foreground">{t("supportEmpty")}</p>}
            {view.messages.map((message) =>
              message.from === "system" ? (
                <SystemLine key={message.id} message={message} t={t} />
              ) : message.from === "agent" ? (
                <div key={message.id} className="flex items-end gap-2">
                  <Avatar name={name} className="size-7 text-[11px]" />
                  <div className="grid max-w-[80%] gap-0.5">
                    <span className="text-[11px] font-medium text-muted-foreground">{name}</span>
                    <p className="rounded-2xl rounded-bl-sm bg-accent px-3 py-2 text-[15px] leading-snug">{message.text}</p>
                  </div>
                </div>
              ) : (
                <div key={message.id} className="ml-auto grid max-w-[80%] justify-items-end gap-0.5">
                  <p className="rounded-2xl rounded-br-sm bg-primary px-3 py-2 text-[15px] leading-snug text-primary-foreground">{message.text}</p>
                  {message.masked && (
                    <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                      <Lock className="size-3" aria-hidden />
                      {t("supportMasked")}
                    </span>
                  )}
                </div>
              ),
            )}
          </div>

          {closed ? (
            <p className="border-t border-border px-3 py-2.5 text-center text-sm text-muted-foreground">{t("supportClosed")}</p>
          ) : (
            <div className="grid gap-1.5 border-t border-border p-2.5">
              <form
                className="flex items-center gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  void submit();
                }}
              >
                <input
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                  placeholder={t("supportPlaceholder")}
                  aria-label={t("supportPlaceholder")}
                  maxLength={2000}
                  className="min-w-0 flex-1 rounded-full border border-border-strong bg-background px-3.5 py-2 text-[15px] outline-none focus:border-foreground"
                />
                <button type="submit" disabled={!text.trim() || sending} aria-label={t("send")} className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-40">
                  <SendHorizontal className="size-4" aria-hidden />
                </button>
              </form>
              <p className="flex items-center gap-1.5 px-1 text-[11px] text-muted-foreground">
                <ShieldCheck className="size-3.5 shrink-0 text-success" aria-hidden />
                {t("supportNoSecrets")}
              </p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
