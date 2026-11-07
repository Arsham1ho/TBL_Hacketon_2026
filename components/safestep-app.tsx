"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { DEMO_SCENARIOS, type DemoScenario } from "@/adapters/signals";
import type { ApiRequest, ApiResponse } from "@/engine/screens";
import type { Audience, Language } from "@/engine/types";
import { client, type AgentPreview } from "@/lib/client";
import { translator, type TextKey } from "@/lib/ui-text";
import { cn } from "@/lib/utils";
import { demoScreen } from "@/mocks/journey";
import { DescriptionComposer } from "./composer";
import {
  AgentViewScreen,
  AnswerTrail,
  BusyDots,
  EndScreen,
  FallbackScreen,
  FlipScreen,
  HandoffScreen,
  LoadingScreen,
  ReceiptScreen,
  RescueScreen,
  ResultScreen,
  StopScreen,
  UnlockScreen,
} from "./screens";
import { Btn, Expandable, Logo, SecretBanner } from "./ui";

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

const ANSWER_TEXT = { yes: "yes", no: "no", unsure: "notSure" } as const;

// Screens that aren't engine steps: they show data from the last response.
type LocalView = "agent" | "receipt" | null;

export function SafeStepApp() {
  const [choice, setChoice] = useState<Language | "auto">("auto");
  const [browserLanguage, setBrowserLanguage] = useState<Language>("fi");
  const [audience, setAudience] = useState<Audience>("consumer");
  const [message, setMessage] = useState("");
  const [incident, setIncident] = useState("");
  const [showPaste, setShowPaste] = useState(false);
  const [demo, setDemo] = useState<DemoScenario>("none");
  const [response, setResponse] = useState<ApiResponse | null>(null);
  const [view, setView] = useState<LocalView>(null);
  const [agent, setAgent] = useState<AgentPreview | null>(null);
  const [answers, setAnswers] = useState<{ question: string; answer: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<ApiRequest | null>(null);
  const main = useRef<HTMLElement>(null);

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
  const screen = response?.screen ?? null;
  const onStop = screen?.type === "stop" && !view && !busy;

  useEffect(() => {
    document.documentElement.lang = shown;
  }, [shown]);

  // Moves screen readers and keyboard users to each new step.
  useEffect(() => {
    if (busy) return;
    window.scrollTo({ top: 0 });
    main.current?.querySelector<HTMLElement>("h1")?.focus({ preventScroll: true });
  }, [screen, view, busy]);

  async function send(request: ApiRequest) {
    setBusy(true);
    setFailed(null);
    try {
      setResponse(await client.send(request));
      setView(null);
    } catch {
      setFailed(request);
    } finally {
      setBusy(false);
    }
  }

  async function chooseHandoff(approved: boolean) {
    const request: ApiRequest = { kind: "handoff", approved };
    setBusy(true);
    setFailed(null);
    try {
      const next = await client.send(request);
      const preview = approved ? await client.agentView() : null;
      setResponse(next);
      setAgent(preview);
      setView(preview ? "agent" : null);
    } catch {
      setFailed(request);
    } finally {
      setBusy(false);
    }
  }

  function clear() {
    setResponse(null);
    setView(null);
    setAgent(null);
    setAnswers([]);
    setFailed(null);
    setMessage("");
    setIncident("");
    setShowPaste(false);
    setDemo("none");
  }

  async function restart() {
    await client.end().catch(() => null);
    clear();
  }

  async function endSession() {
    const ended = await client.end().catch(() => null);
    if (!ended) return clear();
    setResponse(ended);
    setView(null);
  }

  const talk = () => void send({ kind: "talk_to_person" });
  const start = () =>
    void send({
      kind: "start",
      audience,
      language: choice,
      message: message.trim(),
      ...(incident.trim() ? { incident } : {}),
      ...(demo !== "none" ? { demoScenario: demo } : {}),
    });

  function startScreen() {
    const consumer = audience === "consumer";
    return (
      <div className="flex min-h-[55vh] flex-col justify-center gap-5 pb-36">
        <fieldset className="grid grid-cols-2 gap-1 rounded-full bg-card p-1">
          <legend className="sr-only">{t("audience")}</legend>
          {(["consumer", "small_business"] as const).map((value) => (
            <label
              key={value}
              className={cn(
                "flex min-h-11 cursor-pointer items-center justify-center rounded-full px-3 text-center text-sm font-semibold has-focus-visible:outline-3 has-focus-visible:outline-ring",
                audience === value ? "bg-primary text-primary-foreground" : "text-muted-foreground",
              )}
            >
              <input type="radio" name="audience" value={value} checked={audience === value} onChange={() => setAudience(value)} className="sr-only" />
              {t(value === "consumer" ? "consumer" : "smallBusiness")}
            </label>
          ))}
        </fieldset>
        <div className="text-center">
          <h1 tabIndex={-1} className="text-[1.75rem] leading-tight font-extrabold text-navy focus:outline-none lg:text-[2rem]">
            {t(consumer ? "whatHappened" : "whatHappenedBusiness")}
          </h1>
          <p className="mt-2 text-muted-foreground">{t("hint")}</p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          {(consumer ? CONSUMER_CHOICES : BUSINESS_CHOICES).map((quick) => (
            <button
              key={quick.label}
              type="button"
              onClick={() => setMessage(t(quick.text))}
              className="glass min-h-11 rounded-full px-4 py-2 text-sm font-semibold hover:bg-accent"
            >
              {t(quick.label)}
            </button>
          ))}
        </div>
        {showPaste ? (
          <div>
            <label htmlFor="incident" className="text-sm font-semibold">
              {t("pasteLabel")}
            </label>
            <textarea
              id="incident"
              rows={3}
              maxLength={10000}
              value={incident}
              onChange={(event) => setIncident(event.target.value)}
              className="mt-1 w-full rounded-2xl border border-border bg-card px-4 py-3 text-base focus:border-primary focus:outline-none"
            />
          </div>
        ) : (
          <Btn variant="ghost" className="min-h-11 text-base" onClick={() => setShowPaste(true)}>
            {t("pasteToggle")}
          </Btn>
        )}
        <Expandable title={t("demoLabel")}>
          <label className="sr-only" htmlFor="demo">
            {t("demoLabel")}
          </label>
          <select
            id="demo"
            value={demo}
            onChange={(event) => setDemo(event.target.value as DemoScenario)}
            className="min-h-11 w-full rounded-2xl border border-border bg-card px-3 text-base text-foreground"
          >
            {DEMO_SCENARIOS.map((scenario) => (
              <option key={scenario} value={scenario}>
                {t(`demo${scenario}`)}
              </option>
            ))}
          </select>
        </Expandable>
        <p className="text-center text-sm text-muted-foreground">{t("safetyNote")}</p>
        <DescriptionComposer
          question={t(consumer ? "whatHappened" : "whatHappenedBusiness")}
          sample={t(consumer ? "sample" : "sampleBusiness")}
          sendLabel={t("send")}
          text={message}
          disabled={busy}
          onChange={setMessage}
          onSend={start}
        />
      </div>
    );
  }

  function body() {
    if (busy && !response) return <LoadingScreen text={t("loading")} />;
    if (!response || !screen) return startScreen();

    const { state, summary } = response;
    if (view === "agent" && agent) return <AgentViewScreen agent={agent} state={state} t={t} onContinue={() => setView(null)} />;
    if (view === "receipt") return <ReceiptScreen receipt={response.dataReceipt} t={t} onEnd={() => void endSession()} />;

    switch (screen.type) {
      case "stop":
        return <StopScreen screen={screen} t={t} business={audience === "small_business"} onContinue={() => void send({ kind: "continue" })} onTalk={talk} />;
      case "flip":
        return (
          <FlipScreen
            key={screen.topic}
            screen={screen}
            status={state.status}
            summary={summary}
            t={t}
            busy={busy}
            onAnswer={(answer) => {
              setAnswers((previous) => [...previous, { question: screen.question, answer: t(ANSWER_TEXT[answer]) }]);
              void send({ kind: "answer", topic: screen.topic, answer });
            }}
          />
        );
      case "result":
        return <ResultScreen screen={screen} status={state.status} t={t} onDone={() => setView("receipt")} onTalk={talk} />;
      case "unlock":
        return <UnlockScreen screen={screen} t={t} busy={busy} onChoose={(granted) => void send({ kind: "consent", signal: screen.signal, granted })} />;
      case "rescue":
        return (
          <RescueScreen
            screen={screen}
            t={t}
            busy={busy}
            onStep={(outcome) => void send({ kind: "rescue", stepId: screen.step.id, outcome })}
            onTalk={talk}
          />
        );
      case "handoff":
        return <HandoffScreen screen={screen} t={t} busy={busy} onChoose={(approved) => void chooseHandoff(approved)} />;
      case "fallback":
        return <FallbackScreen screen={screen} t={t} onTalk={talk} onRestart={() => void restart()} />;
      case "end":
        return <EndScreen screen={screen} t={t} onRestart={() => void restart()} />;
    }
  }

  const showTrail = answers.length > 0 && !view && (screen?.type === "flip" || screen?.type === "result");

  return (
    <div className={cn("min-h-dvh transition-colors", onStop && "on-danger bg-danger-deep")}>
      <header className={cn("sticky top-0 z-20 pt-[env(safe-area-inset-top)]", onStop ? "bg-danger-deep text-primary-foreground" : "glass-strong")}>
        <div className="mx-auto flex w-full max-w-[560px] items-center justify-between gap-3 px-5 py-2">
          <Logo name="SafeStep" inverted={onStop} />
          <div className="flex items-center gap-1">
            <label className="sr-only" htmlFor="language">
              {t("language")}
            </label>
            <select
              id="language"
              value={response?.language ?? choice}
              onChange={(event) => setChoice(event.target.value as Language | "auto")}
              disabled={Boolean(response)}
              className={cn("min-h-11 rounded-full bg-transparent px-2 text-sm font-semibold disabled:opacity-70", onStop && "[&>option]:text-foreground")}
            >
              <option value="auto">{t("auto")}</option>
              {LANGUAGES.map(({ code, label }) => (
                <option key={code} value={code}>
                  {label}
                </option>
              ))}
            </select>
            {response && (
              <button
                type="button"
                onClick={() => void restart()}
                aria-label={t("exit")}
                title={t("exit")}
                className="flex size-11 items-center justify-center rounded-full hover:bg-black/10"
              >
                <X className="size-5" aria-hidden />
              </button>
            )}
          </div>
        </div>
        <p className={cn("px-5 pb-2 text-center text-xs", onStop ? "text-primary-foreground" : "text-muted-foreground")}>{t("prototype")}</p>
      </header>

      <div className={cn("mx-auto w-full px-5 pt-6 pb-16", view === "agent" ? "max-w-3xl" : "max-w-[560px]")}>
        {/* A transform here would pull the start screen's fixed composer out of place. */}
        <main ref={main} key={`${screen?.type ?? "start"}-${view ?? ""}`} className={cn(response && "animate-rise")}>
          {response?.secretWarning && (
            <div className="mb-5">
              <SecretBanner text={response.secretWarning} />
            </div>
          )}
          {failed ? (
            <div role="alert" className="flex flex-col gap-4">
              <h1 tabIndex={-1} className="text-2xl font-bold text-navy focus:outline-none">
                {t("failed")}
              </h1>
              <Btn onClick={() => void send(failed)}>{t("tryAgain")}</Btn>
              <Btn variant="secondary" onClick={() => void restart()}>
                {t("startAgain")}
              </Btn>
            </div>
          ) : (
            body()
          )}
          {!failed && busy && response && <BusyDots label={t("loading")} />}
          {!failed && showTrail && (
            <div className="mt-5">
              <AnswerTrail title={t("yourAnswers")} answers={answers} />
            </div>
          )}
        </main>
        {response && <p className="mt-8 text-center text-xs text-muted-foreground">{response.notice}</p>}
      </div>
    </div>
  );
}
