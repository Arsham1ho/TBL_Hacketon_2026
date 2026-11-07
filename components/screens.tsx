"use client";

import { useState, type ReactNode } from "react";
import { Check, Phone, RotateCcw, X } from "lucide-react";
import type { ApiResponse, DataReceipt, Screen } from "@/engine/screens";
import type { Risk, Status, Urgency } from "@/engine/types";
import type { AgentPreview } from "@/lib/client";
import type { TextKey, Translate } from "@/lib/ui-text";
import { cn } from "@/lib/utils";
import { Btn, Expandable, SimTag, StatusLabel } from "./ui";

type ScreenOf<T extends Screen["type"]> = Extract<Screen, { type: T }>;

const H1 = ({ children, className }: { children: ReactNode; className?: string }) => (
  <h1 tabIndex={-1} className={cn("text-[1.75rem] leading-tight font-extrabold text-navy focus:outline-none", className)}>
    {children}
  </h1>
);

const TalkButton = ({ t, onTalk, variant = "ghost" }: { t: Translate; onTalk: () => void; variant?: "ghost" | "onDangerGhost" | "secondary" }) => (
  <Btn variant={variant} onClick={onTalk}>
    <Phone className="size-5" aria-hidden />
    {t("talk")}
  </Btn>
);

export function LoadingScreen({ text }: { text: string }) {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-6 text-center" role="status" aria-live="polite">
      <span className="size-10 animate-spin rounded-full border-[3px] border-border border-t-primary" aria-hidden />
      <p className="text-xl font-bold text-navy">{text}</p>
    </div>
  );
}

export function BusyDots({ label }: { label: string }) {
  return (
    <div role="status" aria-label={label} className="flex justify-center gap-1.5 py-3">
      {[0, 150, 300].map((delay) => (
        <span key={delay} className="size-2 animate-bounce rounded-full bg-muted-foreground/60" style={{ animationDelay: `${delay}ms` }} />
      ))}
    </div>
  );
}

export function StopScreen(p: { screen: ScreenOf<"stop">; t: Translate; business: boolean; onContinue: () => void; onTalk: () => void }) {
  return (
    <div role="alert" className="flex min-h-[80vh] flex-col justify-center gap-6 text-primary-foreground">
      <h1 tabIndex={-1} className="text-[2.25rem] leading-[1.1] font-extrabold focus:outline-none">
        {p.screen.message}
      </h1>
      {p.screen.actions.map((action) => (
        <p key={action} className="text-xl leading-relaxed">
          {action}
        </p>
      ))}
      <div className="mt-6 grid gap-3">
        <Btn variant="onDanger" onClick={p.onContinue}>
          {p.t(p.business ? "stoppedBusiness" : "stopped")}
        </Btn>
        <TalkButton t={p.t} onTalk={p.onTalk} variant="onDangerGhost" />
      </div>
    </div>
  );
}

// A sheet from the bottom of the screen, so a question never reads as chat.
export function FlipScreen(p: { screen: ScreenOf<"flip">; t: Translate; busy: boolean; onAnswer: (answer: "yes" | "no" | "unsure") => void }) {
  const { screen, t } = p;
  const [picked, setPicked] = useState<string | null>(null);
  const choose = (answer: "yes" | "no" | "unsure") => {
    setPicked(answer);
    p.onAnswer(answer);
  };
  return (
    <section className="question-sheet fixed inset-x-0 bottom-0 z-30 mx-auto flex max-h-[90dvh] w-full max-w-[560px] flex-col gap-5 overflow-y-auto rounded-t-3xl border border-b-0 border-border bg-card px-5 pt-6 pb-[max(2rem,env(safe-area-inset-bottom))]">
      <div>
        <H1 className="text-2xl">{screen.question}</H1>
        <p className="mt-2 text-sm text-muted-foreground">{screen.why}</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {(["yes", "no"] as const).map((answer) => (
          <Btn key={answer} variant="secondary" aria-pressed={picked === answer} disabled={p.busy} onClick={() => choose(answer)} className={cn(picked === answer && "bg-accent")}>
            {t(answer)}
          </Btn>
        ))}
        <Btn variant="secondary" aria-pressed={picked === "unsure"} disabled={p.busy} onClick={() => choose("unsure")} className={cn("col-span-2", picked === "unsure" && "bg-accent")}>
          {t("notSure")}
        </Btn>
      </div>
    </section>
  );
}

export function ResultScreen(p: { screen: ScreenOf<"result">; status: Status; t: Translate; onDone: () => void; onTalk: () => void }) {
  const { screen, t } = p;
  const safe = p.status === "safe";
  const [first, ...rest] = screen.steps;
  return (
    <div className="flex flex-col gap-5">
      <StatusLabel status={p.status} label={screen.statusLabel} />
      {screen.branches ? (
        <>
          <H1>{t("eachCase")}</H1>
          {screen.branches.map((branch) => (
            <div key={branch.condition}>
              <p className="text-sm text-muted-foreground">{branch.condition}</p>
              {branch.steps.map((step, index) => (
                <p key={step} className={cn("mt-1", index === 0 && "text-lg font-bold text-navy")}>
                  {step}
                </p>
              ))}
            </div>
          ))}
        </>
      ) : (
        <>
          <H1>{safe ? screen.reason : first}</H1>
          {!safe && rest.length > 0 && (
            <ul className="grid gap-2 text-lg">
              {rest.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ul>
          )}
        </>
      )}
      {!safe && <p className="text-muted-foreground">{screen.reason}</p>}
      <Expandable title={t("details")}>
        <div className="grid gap-3 text-sm">
          <p>{screen.confidence}</p>
          {screen.unknowns.length > 0 && (
            <div>
              <p className="font-semibold text-foreground">{t("stillUnknown")}</p>
              <ul className="mt-1 grid gap-1">
                {screen.unknowns.map((unknown) => (
                  <li key={unknown}>{unknown}</li>
                ))}
              </ul>
            </div>
          )}
          {screen.sources.length > 0 && (
            <div>
              <p className="font-semibold text-foreground">{t("syntheticGuidance")}</p>
              <ul className="mt-1 grid gap-1">
                {screen.sources.map((source) => (
                  <li key={source.id}>{source.title}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </Expandable>
      <div className="grid gap-3">
        <Btn onClick={p.onDone}>{t("done")}</Btn>
        {!safe && <TalkButton t={t} onTalk={p.onTalk} />}
      </div>
    </div>
  );
}

export function UnlockScreen(p: { screen: ScreenOf<"unlock">; t: Translate; busy: boolean; onChoose: (granted: boolean) => void }) {
  const { screen, t } = p;
  return (
    <div className="flex flex-col gap-5">
      <H1>{t("unlockTitle")}</H1>
      <div>
        <p className="text-xl font-bold text-navy">{screen.what}</p>
        <p className="mt-2 text-muted-foreground">{screen.why}</p>
      </div>
      <p className="text-sm text-muted-foreground">
        {screen.limit} {screen.ifRefused}
      </p>
      <div className="grid gap-3">
        <Btn disabled={p.busy} onClick={() => p.onChoose(true)}>
          {t("allow")}
        </Btn>
        <Btn variant="secondary" disabled={p.busy} onClick={() => p.onChoose(false)}>
          {t("deny")}
        </Btn>
      </div>
    </div>
  );
}

export function RescueScreen(p: {
  screen: ScreenOf<"rescue">;
  t: Translate;
  busy: boolean;
  onStep: (outcome: "done" | "not_possible") => void;
  onTalk: () => void;
}) {
  const { screen, t } = p;
  return (
    <div className="flex min-h-[75vh] flex-col justify-center gap-5">
      <p className="text-sm font-semibold text-muted-foreground">
        {t("step").replace("{n}", String(screen.position)).replace("{total}", String(screen.total))}
      </p>
      <div key={screen.step.id} className="animate-rise grid gap-3">
        <H1>{screen.step.title}</H1>
        {screen.step.detail !== screen.step.title && <p className="text-lg text-muted-foreground">{screen.step.detail}</p>}
      </div>
      <div className="mt-4 grid gap-3">
        <div className="grid grid-cols-2 gap-3">
          <Btn disabled={p.busy} onClick={() => p.onStep("done")}>
            {t("done")}
          </Btn>
          <Btn variant="secondary" disabled={p.busy} onClick={() => p.onStep("not_possible")}>
            {t("notPossible")}
          </Btn>
        </div>
        <TalkButton t={t} onTalk={p.onTalk} />
      </div>
    </div>
  );
}

export function HandoffScreen(p: { screen: ScreenOf<"handoff">; t: Translate; busy: boolean; onChoose: (approved: boolean) => void }) {
  const { screen, t } = p;
  return (
    <div className="flex flex-col gap-5">
      <H1>{t("handoffTitle")}</H1>
      <p className="text-muted-foreground">
        {t("simulatedHandoff")}: {t(screen.destination)}
      </p>
      <ul className="grid gap-3">
        {screen.summary.map((line) => (
          <li key={line} className="flex gap-3 font-medium">
            <Check className="mt-1 size-4 shrink-0 text-success" aria-hidden />
            {line}
          </li>
        ))}
      </ul>
      <p className="flex gap-3 text-sm text-muted-foreground">
        <X className="mt-0.5 size-4 shrink-0" aria-hidden />
        {t("leftOut")}: {screen.omitted.join(", ")}
      </p>
      <div className="grid gap-3">
        <Btn disabled={p.busy} onClick={() => p.onChoose(true)}>
          {t("approve")}
        </Btn>
        <Btn variant="secondary" disabled={p.busy} onClick={() => p.onChoose(false)}>
          {t("dontShare")}
        </Btn>
      </div>
    </div>
  );
}

const RISK_TEXT: Record<Risk, TextKey> = { none: "riskNone", low: "riskLow", medium: "riskMedium", high: "riskHigh", critical: "riskCritical" };
const URGENCY_TEXT: Record<Urgency, TextKey> = { none: "urgencyNone", routine: "urgencyRoutine", today: "urgencyToday", immediate: "urgencyImmediate" };

export function AgentViewScreen(p: { agent: AgentPreview; state: ApiResponse["state"]; t: Translate; onContinue: () => void }) {
  const { agent, state, t } = p;
  return (
    <div className="flex flex-col gap-5">
      <SimTag>{t("agentView")}</SimTag>
      <H1 className="text-2xl">{t(agent.destination)}</H1>
      <p className="font-semibold">
        {t("risk")}: {t(RISK_TEXT[state.risk])} · {t("urgency")}: {t(URGENCY_TEXT[state.urgency])}
      </p>
      <ul className="grid gap-2">
        {agent.summary.map((line) => (
          <li key={line} className="flex items-start gap-2.5">
            <Check className="mt-1 size-4 shrink-0 text-success" aria-hidden />
            {line}
          </li>
        ))}
      </ul>
      <Btn onClick={p.onContinue}>{t("continue")}</Btn>
    </div>
  );
}

export function ReceiptScreen(p: { receipt: DataReceipt; notice: string; t: Translate; onEnd: () => void }) {
  const { receipt, t } = p;
  const sections = [
    { title: t("receiptUsed"), items: receipt.used },
    { title: t("receiptRefused"), items: receipt.refused },
    { title: t("receiptNotAccessed"), items: receipt.notAccessed },
  ].filter((section) => section.items.length > 0);
  return (
    <div className="flex flex-col gap-5">
      <H1>{t("receiptTitle")}</H1>
      {sections.map((section) => (
        <div key={section.title}>
          <p className="font-bold">{section.title}</p>
          <ul className="mt-1 grid gap-1 text-muted-foreground">
            {section.items.map((item) => (
              <li key={item}>{t(item)}</li>
            ))}
          </ul>
        </div>
      ))}
      <div>
        <p className="font-bold">{t("receiptAi")}</p>
        <p className="mt-1 text-muted-foreground">{receipt.sentToLlm ? t("receiptAiYes") : t("receiptAiNo")}</p>
      </div>
      <p className="text-sm text-muted-foreground">{p.notice}</p>
      <Btn onClick={p.onEnd}>{t("endSession")}</Btn>
    </div>
  );
}

export function FallbackScreen(p: { screen: ScreenOf<"fallback">; t: Translate; onTalk: () => void; onRestart: () => void }) {
  const { screen, t } = p;
  return (
    <div className="flex min-h-[70vh] flex-col justify-center gap-5">
      <H1>{screen.message}</H1>
      {screen.actions[0] && <p className="text-lg">{screen.actions[0]}</p>}
      <div className="grid gap-3">
        <TalkButton t={t} onTalk={p.onTalk} variant="secondary" />
        <Btn variant="ghost" onClick={p.onRestart}>
          <RotateCcw className="size-5" aria-hidden />
          {t("startAgain")}
        </Btn>
      </div>
    </div>
  );
}

export function EndScreen(p: { screen: ScreenOf<"end">; t: Translate; onRestart: () => void }) {
  return (
    <div className="flex min-h-[70vh] flex-col justify-center gap-6 text-center">
      <H1>{p.screen.message}</H1>
      <Btn onClick={p.onRestart}>{p.t("startNew")}</Btn>
    </div>
  );
}
