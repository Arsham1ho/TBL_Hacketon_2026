"use client";

import { useEffect, useRef, useState } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { DEMO_SCENARIOS, type DemoScenario } from "@/adapters/signals";
import { readAnswerOffline } from "@/engine/answer-reader";
import { maskSecrets } from "@/engine/input-guard";
import type { ApiRequest, ApiResponse } from "@/engine/screens";
import type { Audience, Language } from "@/engine/types";
import { client, type AgentPreview } from "@/lib/client";
import { translator, type TextKey } from "@/lib/ui-text";
import { cn } from "@/lib/utils";
import { demoScreen } from "@/mocks/journey";
import { DescriptionComposer } from "./composer";
import { agentTurn, screenTurn, type Reply } from "./turns";
import { Btn, SecretNote, StepMark } from "./ui";

const LANGUAGES: { code: Language; label: string }[] = [
  { code: "fi", label: "Suomi" },
  { code: "en", label: "English" },
  { code: "sv", label: "Svenska" },
];

const CONSUMER_CHOICES: { label: TextKey; text: TextKey }[] = [
  { label: "quickMessage", text: "quickMessageText" },
  { label: "quickCall", text: "quickCallText" },
  { label: "quickLink", text: "quickLinkText" },
  { label: "quickAccount", text: "quickAccountText" },
];

const BUSINESS_CHOICES: { label: TextKey; text: TextKey }[] = [
  ...CONSUMER_CHOICES.slice(0, 3),
  { label: "quickBusiness", text: "quickBusinessText" },
];

// What has been said so far.
type Item = { from: "user" | "safestep"; text: string };

const WIDTH = "mx-auto w-full max-w-[640px] px-4";

export function SafeStepApp() {
  const [choice, setChoice] = useState<Language | "auto">("auto");
  const [browserLanguage, setBrowserLanguage] = useState<Language>("fi");
  const [audience, setAudience] = useState<Audience>("consumer");
  const [message, setMessage] = useState("");
  const [followUp, setFollowUp] = useState("");
  const [incident, setIncident] = useState("");
  const [demo, setDemo] = useState<DemoScenario>("none");
  const [response, setResponse] = useState<ApiResponse | null>(null);
  const [agent, setAgent] = useState<AgentPreview | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [closed, setClosed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<ApiRequest | null>(null);
  const log = useRef<HTMLDivElement>(null);
  const latest = useRef<HTMLDivElement>(null);
  const options = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const code = navigator.language.slice(0, 2);
    if (code === "en" || code === "sv") setBrowserLanguage(code);
    if (process.env.NODE_ENV === "production") return;
    const name = new URLSearchParams(window.location.search).get("screen");
    const review = name ? demoScreen(name) : null;
    if (review) setResponse(review);
  }, []);

  const shown = response?.language ?? (choice === "auto" ? browserLanguage : choice);
  const t = translator(shown);
  const consumer = audience === "consumer";
  const question = t(consumer ? "whatHappened" : "whatHappenedBusiness");

  useEffect(() => {
    document.documentElement.lang = shown;
  }, [shown]);

  // Keeps the newest message in view, and moves keyboard and screen reader users to it.
  useEffect(() => {
    latest.current?.scrollIntoView({ block: "end" });
    if (!busy) log.current?.querySelector<HTMLElement>("h1")?.focus({ preventScroll: true });
  }, [items, response, agent, busy]);

  async function send(request: ApiRequest) {
    setBusy(true);
    setFailed(null);
    try {
      setResponse(await client.send(request));
      setAgent(null);
    } catch {
      setFailed(request);
    } finally {
      setBusy(false);
    }
  }

  const record = (...next: Item[]) => setItems((previous) => [...previous, ...next]);

  function reply(recap: string, label: string, request: ApiRequest) {
    record({ from: "safestep", text: recap }, { from: "user", text: label });
    void send(request);
  }

  async function handoff(recap: string, label: string, approved: boolean) {
    record({ from: "safestep", text: recap }, { from: "user", text: label });
    const request: ApiRequest = { kind: "handoff", approved };
    setBusy(true);
    setFailed(null);
    try {
      const next = await client.send(request);
      const preview = approved ? await client.agentView() : null;
      setResponse(next);
      setAgent(preview);
    } catch {
      setFailed(request);
    } finally {
      setBusy(false);
    }
  }

  async function restart() {
    await client.end().catch(() => null);
    setResponse(null);
    setAgent(null);
    setItems([]);
    setClosed(false);
    setFailed(null);
    setMessage("");
    setFollowUp("");
    setIncident("");
    setDemo("none");
  }

  function start() {
    // Masked here as well: the chat must never repeat a code or password the user typed.
    record({ from: "user", text: maskSecrets(message.trim()).text });
    void send({
      kind: "start",
      audience,
      language: choice,
      fallbackLanguage: browserLanguage,
      message: message.trim(),
      ...(incident.trim() ? { incident } : {}),
      ...(demo !== "none" ? { demoScenario: demo } : {}),
    });
  }

  const prototypeLine = <p className="px-4 pb-[max(0.25rem,env(safe-area-inset-bottom))] text-center text-[11px] text-muted-foreground">{t("prototype")}</p>;

  if (items.length === 0 && !response) {
    return (
      <div className="flex h-dvh flex-col">
        <button
          type="button"
          onClick={() => options.current?.showModal()}
          aria-label={t("options")}
          title={t("options")}
          className="fixed top-[max(0.5rem,env(safe-area-inset-top))] right-3 z-40 flex size-11 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent"
        >
          <SlidersHorizontal className="size-5" aria-hidden />
        </button>
        <main ref={log} className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-4 text-center">
          <StepMark className="size-10 text-foreground" />
          <h1 tabIndex={-1} className="text-2xl font-semibold focus:outline-none">
            {question}
          </h1>
        </main>
        <div className={WIDTH}>
          <DescriptionComposer question={question} sample={t(consumer ? "sample" : "sampleBusiness")} sendLabel={t("send")} text={message} disabled={busy} onChange={setMessage} onSend={start} />
        </div>
        {prototypeLine}
        <dialog
          ref={options}
          aria-label={t("options")}
          className="m-0 mx-auto mt-auto max-h-[85dvh] w-full max-w-[640px] rounded-t-xl bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-foreground backdrop:bg-black/30"
        >
          <div className="grid gap-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">{t("options")}</h2>
              <button type="button" onClick={() => options.current?.close()} aria-label={t("close")} title={t("close")} className="flex size-11 items-center justify-center rounded-lg hover:bg-accent">
                <X className="size-5" aria-hidden />
              </button>
            </div>
            <fieldset className="grid grid-cols-2 gap-2">
              <legend className="sr-only">{t("audience")}</legend>
              {(["consumer", "small_business"] as const).map((value) => (
                <label
                  key={value}
                  className={cn(
                    "flex min-h-11 cursor-pointer items-center justify-center rounded-lg border px-3 text-center text-sm font-medium has-focus-visible:outline-3 has-focus-visible:outline-ring",
                    audience === value ? "border-primary bg-primary text-primary-foreground" : "border-border-strong",
                  )}
                >
                  <input type="radio" name="audience" value={value} checked={audience === value} onChange={() => setAudience(value)} className="sr-only" />
                  {t(value === "consumer" ? "consumer" : "smallBusiness")}
                </label>
              ))}
            </fieldset>
            <div className="grid gap-1">
              <label htmlFor="language" className="text-sm font-medium">
                {t("language")}
              </label>
              <select id="language" value={choice} onChange={(event) => setChoice(event.target.value as Language | "auto")} className="min-h-11 w-full rounded-lg border border-border-strong bg-white px-3 text-base">
                <option value="auto">{t("auto")}</option>
                {LANGUAGES.map(({ code, label }) => (
                  <option key={code} value={code}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-2">
              <p className="text-sm font-medium">{t("examples")}</p>
              <div className="flex flex-wrap gap-2">
                {(consumer ? CONSUMER_CHOICES : BUSINESS_CHOICES).map((quick) => (
                  <Btn
                    key={quick.label}
                    className="min-h-11 text-sm"
                    onClick={() => {
                      setMessage(t(quick.text));
                      options.current?.close();
                    }}
                  >
                    {t(quick.label)}
                  </Btn>
                ))}
              </div>
            </div>
            <div className="grid gap-1">
              <label htmlFor="incident" className="text-sm font-medium">
                {t("pasteToggle")}
              </label>
              <textarea id="incident" rows={3} maxLength={10000} value={incident} onChange={(event) => setIncident(event.target.value)} className="w-full rounded-lg border border-border-strong px-3 py-2 text-base focus:border-primary focus:outline-none" />
            </div>
            <div className="grid gap-1">
              <label htmlFor="demo" className="text-sm font-medium">
                {t("demoLabel")}
              </label>
              <select id="demo" value={demo} onChange={(event) => setDemo(event.target.value as DemoScenario)} className="min-h-11 w-full rounded-lg border border-border-strong bg-white px-3 text-base">
                {DEMO_SCENARIOS.map((scenario) => (
                  <option key={scenario} value={scenario}>
                    {t(`demo${scenario}`)}
                  </option>
                ))}
              </select>
            </div>
            <p className="text-sm text-muted-foreground">{t("safetyNote")}</p>
          </div>
        </dialog>
      </div>
    );
  }

  const actions = {
    t,
    business: !consumer,
    reply,
    handoff: (recap: string, label: string, approved: boolean) => void handoff(recap, label, approved),
    restart: () => void restart(),
    closed,
    close: (recap: string, label: string) => {
      record({ from: "safestep", text: recap }, { from: "user", text: label });
      setClosed(true);
    },
  };
  const turn = busy || failed || !response ? null : agent ? agentTurn(agent, response.state, actions, () => setAgent(null)) : screenTurn(response, actions);
  const replies: Reply[] = failed
    ? [
        { label: t("tryAgain"), primary: true, run: () => void send(failed) },
        { label: t("startAgain"), run: () => void restart() },
      ]
    : (turn?.replies ?? []);

  return (
    <div className="flex h-dvh flex-col">
      <button
        type="button"
        onClick={() => void restart()}
        aria-label={t("exit")}
        title={t("exit")}
        className="fixed top-[max(0.5rem,env(safe-area-inset-top))] right-3 z-40 flex size-11 items-center justify-center rounded-lg bg-white/90 text-muted-foreground hover:bg-accent"
      >
        <X className="size-5" aria-hidden />
      </button>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <main ref={log} role="log" className={cn(WIDTH, "grid gap-4 pt-14 pb-4")}>
          {items.map((item, index) =>
            item.from === "user" ? (
              <p key={index} className="ml-auto max-w-[85%] rounded-2xl rounded-br-sm bg-accent px-3.5 py-2 leading-relaxed">
                {item.text}
              </p>
            ) : (
              <p key={index} className="max-w-[92%] text-muted-foreground">
                {item.text}
              </p>
            ),
          )}
          {response?.secretWarning && <SecretNote text={response.secretWarning} />}
          {turn && (
            <div className="grid gap-2.5 leading-relaxed">
              <StepMark className="size-5 text-foreground" />
              {turn.body}
            </div>
          )}
          {failed && (
            <h1 tabIndex={-1} className="font-medium focus:outline-none">
              {t("failed")}
            </h1>
          )}
          {busy && (
            <div role="status" aria-label={t("loading")} className="flex gap-1 py-2">
              {[0, 150, 300].map((delay) => (
                <span key={delay} className="size-1.5 animate-bounce rounded-full bg-muted-foreground" style={{ animationDelay: `${delay}ms` }} />
              ))}
            </div>
          )}
          <div ref={latest} />
        </main>
      </div>

      {response?.screen.type === "result" && (
        <div className={WIDTH}>
          <DescriptionComposer
            question=""
            sample={t("askFollowUp")}
            sendLabel={t("send")}
            text={followUp}
            disabled={busy}
            onChange={setFollowUp}
            onSend={() => {
              if (!followUp.trim()) return;
              const text = followUp.trim();
              setFollowUp("");
              record({ from: "user", text: maskSecrets(text).text });
              const nextMessage = `${message ? message + "\n" : ""}${text}`;
              setMessage(nextMessage);
              void send({
                kind: "start",
                audience,
                language: choice,
                fallbackLanguage: browserLanguage,
                message: nextMessage,
                ...(incident.trim() ? { incident } : {}),
                ...(demo !== "none" ? { demoScenario: demo } : {}),
              });
            }}
          />
        </div>
      )}

      {response?.screen.type === "flip" && (() => {
        const flipScreen = response.screen;
        return (
          <div className={WIDTH}>
            <DescriptionComposer
              question=""
              sample={t("typeAnswerOrDetails")}
              sendLabel={t("send")}
              text={followUp}
              disabled={busy}
              onChange={setFollowUp}
              onSend={() => {
                if (!followUp.trim()) return;
                const text = followUp.trim();
                setFollowUp("");
                const answer = readAnswerOffline(text, shown, flipScreen.topic);
                reply(flipScreen.question, text, {
                  kind: "answer",
                  topic: flipScreen.topic,
                  answer,
                });
              }}
            />
          </div>
        );
      })()}

      {replies.length > 0 && (
        <div className={cn(WIDTH, "flex flex-wrap gap-2 pt-1 pb-2")}>
          {replies.map((option) => (
            <Btn key={option.label} variant={option.primary ? "primary" : "plain"} disabled={busy} onClick={option.run} className="min-w-[45%] flex-1">
              {option.label}
            </Btn>
          ))}
        </div>
      )}
      {prototypeLine}
    </div>
  );
}
