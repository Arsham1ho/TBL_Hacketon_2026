"use client";

import { useState, type ReactNode } from "react";
import {
  Check,
  CircleCheck,
  CircleHelp,
  Lightbulb,
  Minus,
  Phone,
  PhoneOff,
  RotateCcw,
  ShieldCheck,
  UserRound,
  X,
} from "lucide-react";
import type { ApiResponse, DataReceipt, Screen } from "@/engine/screens";
import type { Destination, Risk, Status, Urgency } from "@/engine/types";
import type { TextKey, Translate } from "@/lib/ui-text";
import { cn } from "@/lib/utils";
import { Btn, Card, Expandable, SimTag, StatusLabel } from "./ui";

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
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-8 text-center" role="status" aria-live="polite">
      <div className="relative size-28">
        <span className="animate-breathe absolute inset-0 rounded-full bg-primary/10" />
        <span className="animate-breathe absolute inset-3 rounded-full bg-primary/15 [animation-delay:300ms]" />
        <span className="glass absolute inset-6 flex items-center justify-center rounded-full">
          <ShieldCheck className="size-8 text-primary" aria-hidden />
        </span>
        <span className="absolute inset-0 animate-spin rounded-full border-[3px] border-transparent border-t-primary [animation-duration:1.4s]" />
      </div>
      <p className="text-2xl font-bold text-navy">{text}</p>
    </div>
  );
}

export function StopScreen(p: { screen: ScreenOf<"stop">; t: Translate; business: boolean; onContinue: () => void; onTalk: () => void }) {
  return (
    <div role="alert" className="flex min-h-[70vh] flex-col gap-8 py-4 text-primary-foreground">
      <div className="flex size-16 items-center justify-center rounded-2xl border-2 border-primary-foreground/60">
        <PhoneOff className="size-8" aria-hidden />
      </div>
      <h1 tabIndex={-1} className="text-[2.25rem] leading-[1.1] font-extrabold focus:outline-none">
        {p.screen.message}
      </h1>
      {p.screen.actions.map((action) => (
        <p key={action} className="text-xl leading-relaxed text-primary-foreground">
          {action}
        </p>
      ))}
      <div className="mt-auto grid gap-3">
        <Btn variant="onDanger" onClick={p.onContinue}>
          {p.t(p.business ? "stoppedBusiness" : "stopped")}
        </Btn>
        <TalkButton t={p.t} onTalk={p.onTalk} variant="onDangerGhost" />
      </div>
    </div>
  );
}

const Branches = ({ branches, large }: { branches: ScreenOf<"flip">["branches"]; large?: boolean }) => (
  <div className="grid gap-3">
    {branches.map((branch) => (
      <Card key={branch.condition} className={large ? undefined : "bg-muted p-4"}>
        <p className="text-sm font-medium text-muted-foreground">{branch.condition}</p>
        {branch.steps.map((step) => (
          <p key={step} className={cn("mt-2 text-foreground", large && "text-xl font-bold text-navy")}>
            {step}
          </p>
        ))}
      </Card>
    ))}
  </div>
);

export function FlipScreen(p: {
  screen: ScreenOf<"flip">;
  status: Status;
  summary: string[];
  t: Translate;
  busy: boolean;
  onAnswer: (answer: "yes" | "no" | "unsure") => void;
}) {
  const { screen, t } = p;
  const [picked, setPicked] = useState<string | null>(null);
  const options = [
    { id: "yes", label: t("yes"), Icon: Check },
    { id: "no", label: t("no"), Icon: X },
    { id: "unsure", label: t("notSure"), Icon: Minus },
  ] as const;
  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-3xl border border-border bg-card p-6">
        <StatusLabel status={p.status} label={screen.statusLabel} />
        <p className="mt-4 text-muted-foreground">{screen.why}</p>
        <H1 className="mt-3">{screen.question}</H1>
        <div className="mt-6 grid gap-3">
          {options.map(({ id, label, Icon }) => {
            const on = picked === id;
            return (
              <Btn
                key={id}
                variant="choice"
                aria-pressed={on}
                disabled={p.busy}
                onClick={() => {
                  setPicked(id);
                  p.onAnswer(id);
                }}
                className={cn("justify-start", on && "border-primary bg-accent")}
              >
                <span className={cn("flex size-9 items-center justify-center rounded-full", on ? "bg-primary text-primary-foreground" : "bg-muted")}>
                  <Icon className="size-5" aria-hidden />
                </span>
                {label}
              </Btn>
            );
          })}
        </div>
      </div>
      {screen.branches.length > 0 && (
        <Expandable title={t("whileYouDecide")}>
          <Branches branches={screen.branches} />
        </Expandable>
      )}
      {p.summary.length > 0 && (
        <div className="glass rounded-3xl p-4">
          <p className="mb-2 text-sm font-semibold text-muted-foreground">{t("whatWeKnow")}</p>
          <ul className="grid gap-1.5">
            {p.summary.map((fact) => (
              <li key={fact} className="flex gap-2 text-sm">
                <CircleCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                {fact}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
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
          <Branches branches={screen.branches} large />
        </>
      ) : safe ? (
        <Card className="border-success/30 bg-success-soft">
          <H1 className="text-2xl">{screen.reason}</H1>
        </Card>
      ) : (
        <ol className="grid gap-3">
          {first && (
            <li className="flex gap-4 rounded-3xl border border-border bg-card p-5">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-navy font-bold text-primary-foreground">1</span>
              <H1 className="text-2xl">{first}</H1>
            </li>
          )}
          {rest.map((step, index) => (
            <li key={step} className="glass flex gap-4 rounded-3xl p-5">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted font-bold">{index + 2}</span>
              <p className="text-lg font-semibold">{step}</p>
            </li>
          ))}
        </ol>
      )}
      {!safe && (
        <div className="border-l-2 border-primary py-1 pl-4">
          <p className="font-semibold">{t("why")}</p>
          <p className="mt-1">{screen.reason}</p>
        </div>
      )}
      <p className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        {safe ? <Lightbulb className="size-4 text-primary" aria-hidden /> : <CircleCheck className="size-4" aria-hidden />}
        {screen.confidence}
      </p>
      {screen.unknowns.length > 0 && (
        <div className="glass rounded-3xl p-4">
          <p className="font-semibold">{t("stillUnknown")}</p>
          <ul className="mt-2 grid gap-1">
            {screen.unknowns.map((unknown) => (
              <li key={unknown} className="flex items-start gap-2">
                <CircleHelp className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
                {unknown}
              </li>
            ))}
          </ul>
        </div>
      )}
      {screen.sources.length > 0 && (
        <Expandable title={t("source")} tag={t("syntheticGuidance")}>
          <ul className="grid gap-1">
            {screen.sources.map((source) => (
              <li key={source.id}>{source.title}</li>
            ))}
          </ul>
        </Expandable>
      )}
      <div className="grid gap-3">
        <Btn onClick={p.onDone}>{t("done")}</Btn>
        {!safe && <TalkButton t={t} onTalk={p.onTalk} />}
      </div>
    </div>
  );
}

export function UnlockScreen(p: { screen: ScreenOf<"unlock">; t: Translate; busy: boolean; onChoose: (granted: boolean) => void }) {
  const { screen, t } = p;
  const rows = [
    { label: t("what"), text: screen.what },
    { label: t("why"), text: screen.why },
    { label: t("limit"), text: screen.limit },
  ];
  return (
    <div className="flex flex-col gap-5">
      <SimTag>{t("simulatedSignal")}</SimTag>
      <H1>{t("unlockTitle")}</H1>
      <Card className="p-0">
        {rows.map((row, index) => (
          <div key={row.label} className={cn("grid gap-1 px-5 py-4", index > 0 && "border-t border-border")}>
            <span className="text-sm font-medium text-muted-foreground">{row.label}</span>
            <span className="text-lg font-medium">{row.text}</span>
          </div>
        ))}
      </Card>
      <p className="text-muted-foreground">{screen.ifRefused}</p>
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
    <div className="flex min-h-[70vh] flex-col gap-6">
      <p className="text-sm font-semibold text-muted-foreground">
        {t("step").replace("{n}", String(screen.position)).replace("{total}", String(screen.total))}
      </p>
      <div key={screen.step.id} className="animate-rise glass-dark flex flex-col gap-4 rounded-3xl p-6 text-primary-foreground">
        <span className="text-6xl font-extrabold opacity-30" aria-hidden>
          {screen.position}
        </span>
        {screen.step.userAction && (
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-primary-foreground px-3 py-1 text-sm font-bold text-navy">
            <UserRound className="size-4" aria-hidden />
            {t("onlyYou")}
          </span>
        )}
        <h1 tabIndex={-1} className="text-[1.75rem] leading-tight font-extrabold focus:outline-none">
          {screen.step.title}
        </h1>
        <p className="text-lg">{screen.step.detail}</p>
      </div>
      <div className="mt-auto grid gap-3">
        <div className="grid grid-cols-2 gap-3">
          <Btn disabled={p.busy} onClick={() => p.onStep("done")}>
            <Check className="size-5" aria-hidden />
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
      <SimTag>{t("simulatedHandoff")}</SimTag>
      <H1>{t("handoffTitle")}</H1>
      <div className="glass flex items-center gap-3 rounded-3xl p-4">
        <UserRound className="size-6 text-primary" aria-hidden />
        <div>
          <p className="text-sm text-muted-foreground">{t("sentTo")}</p>
          <p className="font-bold">{t(screen.destination as TextKey)}</p>
        </div>
      </div>
      <Card>
        <p className="font-semibold text-muted-foreground">{t("yourSummary")}</p>
        <ul className="mt-3 grid gap-3">
          {screen.summary.map((line) => (
            <li key={line} className="flex gap-3 text-lg font-medium">
              <Check className="mt-1 size-5 shrink-0 text-success" aria-hidden />
              {line}
            </li>
          ))}
        </ul>
      </Card>
      <div className="glass flex gap-3 rounded-3xl p-4">
        <X className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
        <div>
          <p className="font-semibold">{t("leftOut")}</p>
          <p className="text-muted-foreground">{screen.omitted.join(", ")}</p>
        </div>
      </div>
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

export function AgentViewScreen(p: { destination: Destination; summary: string[]; state: ApiResponse["state"]; t: Translate; onContinue: () => void }) {
  const { state, t } = p;
  return (
    <div className="flex flex-col gap-5">
      <div className="overflow-hidden rounded-3xl border border-border bg-card text-[0.95rem]">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border px-5 py-4 sm:px-6">
          <div className="min-w-0 flex-1">
            <p className="text-sm text-muted-foreground">{t("agentCase")}</p>
            <h1 tabIndex={-1} className="text-lg font-semibold text-navy focus:outline-none">
              {t(p.destination as TextKey)}
            </h1>
          </div>
          <SimTag>{t("agentView")}</SimTag>
        </div>
        <div className="flex flex-wrap gap-x-8 gap-y-3 border-b border-border px-5 py-3 sm:px-6">
          <p className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-destructive" aria-hidden />
            <span className="text-muted-foreground">{t("risk")}</span>
            <span className="font-semibold text-destructive">{t(RISK_TEXT[state.risk])}</span>
          </p>
          <p className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-warning" aria-hidden />
            <span className="text-muted-foreground">{t("urgency")}</span>
            <span className="font-semibold">{t(URGENCY_TEXT[state.urgency])}</span>
          </p>
        </div>
        <div className="grid gap-2 px-5 py-4 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-6 sm:px-6">
          <p className="text-sm text-muted-foreground">{t("confirmed")}</p>
          <ul className="grid gap-2">
            {p.summary.map((line) => (
              <li key={line} className="flex items-start gap-2.5">
                <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>
        <p className="flex items-center gap-2 border-t border-border px-5 py-3 text-sm text-muted-foreground sm:px-6">
          <CircleCheck className="size-4 text-success" aria-hidden />
          {t("agentNote")}
        </p>
      </div>
      <Btn onClick={p.onContinue}>{t("receiptTitle")}</Btn>
    </div>
  );
}

export function ReceiptScreen(p: { receipt: DataReceipt; t: Translate; onEnd: () => void }) {
  const { receipt, t } = p;
  const sections = [
    { title: t("receiptUsed"), items: receipt.used, icon: <Check className="size-4 text-success" aria-hidden /> },
    { title: t("receiptRefused"), items: receipt.refused, icon: <X className="size-4 text-destructive" aria-hidden /> },
    { title: t("receiptNotAccessed"), items: receipt.notAccessed, icon: <Minus className="size-4 text-muted-foreground" aria-hidden /> },
  ];
  return (
    <div className="flex flex-col gap-5">
      <H1>{t("receiptTitle")}</H1>
      <Card className="divide-y divide-border p-0">
        {sections.map((section) => (
          <div key={section.title} className="px-5 py-4">
            <p className="flex items-center gap-2 font-bold">
              {section.icon}
              {section.title}
            </p>
            <ul className="mt-2 grid gap-1 pl-6 text-muted-foreground">
              {section.items.length > 0 ? section.items.map((item) => <li key={item}>{t(item)}</li>) : <li>{t("receiptNothing")}</li>}
            </ul>
          </div>
        ))}
        <div className="px-5 py-4">
          <p className="flex items-center justify-between font-bold">
            {t("receiptAi")}
            <span className="rounded-full bg-muted px-3 py-0.5">{receipt.sentToLlm ? t("yes") : t("no")}</span>
          </p>
          <p className="mt-1 text-muted-foreground">{receipt.sentToLlm ? t("receiptAiYes") : t("receiptAiNo")}</p>
        </div>
      </Card>
      <Btn onClick={p.onEnd}>{t("endSession")}</Btn>
    </div>
  );
}

// Always "needs checking": a fallback means nothing was decided, whatever came before it.
export function FallbackScreen(p: { screen: ScreenOf<"fallback">; t: Translate; onTalk: () => void; onRestart: () => void }) {
  const { screen, t } = p;
  return (
    <div className="flex flex-col gap-5">
      <StatusLabel status="needs_verification" label={t("needsChecking")} />
      <H1>{screen.message}</H1>
      {screen.actions.length > 0 && (
        <Card className="grid gap-2">
          {screen.actions.map((action) => (
            <p key={action} className="text-lg font-semibold">
              {action}
            </p>
          ))}
        </Card>
      )}
      <div className="grid gap-3">
        <TalkButton t={t} onTalk={p.onTalk} variant="secondary" />
        <Btn variant="secondary" onClick={p.onRestart}>
          <RotateCcw className="size-5" aria-hidden />
          {t("startAgain")}
        </Btn>
      </div>
    </div>
  );
}

export function EndScreen(p: { screen: ScreenOf<"end">; t: Translate; onRestart: () => void }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 text-center">
      <div className="relative flex size-24 items-center justify-center">
        <span className="animate-ring-out absolute inset-0 rounded-full bg-success/15" />
        <span className="absolute inset-2 rounded-full bg-success-soft" />
        <CircleCheck className="animate-pop relative size-12 text-success" aria-hidden />
      </div>
      <H1>{p.screen.message}</H1>
      <Btn onClick={p.onRestart}>
        <RotateCcw className="size-5" aria-hidden />
        {p.t("startNew")}
      </Btn>
    </div>
  );
}
