import type { ReactNode } from "react";
import type { ApiRequest, ApiResponse, DataReceipt, SupportRoute } from "@/engine/screens";
import type { Risk, Urgency } from "@/engine/types";
import type { AgentPreview } from "@/lib/client";
import type { TextKey, Translate } from "@/lib/ui-text";
import { BadgeCheck, BookOpen, Database, Info, Target, Wallet, Headset, Hourglass, PenLine, Ban, Check, CircleQuestionMark, MessageCircleQuestionMark, SkipForward, X, CircleCheck, Clock, CreditCard, Eye, FileText, KeyRound, Landmark, Link2Off, Phone, PhoneOff, Search, ShieldCheck, Siren, Smartphone, Tag, Trash, TriangleAlert, WifiOff, Zap } from "lucide-react";
import { RiskGauge } from "./risk-gauge";
import { BANKS, CARD_BLOCKING, OPERATORS, POLICE, providerById, type ProviderChoice, type ProviderKind } from "@/lib/providers";
import { cn } from "@/lib/utils";
import { Details, StatusLabel } from "./ui";

// One step of the conversation: what SafeStep says, and the replies on offer.
export type Reply = { label: string; primary?: boolean; run: () => void; icon?: ReactNode };
// `say` is what voice mode reads aloud for a result card; other screens are read from the screen itself.
export type Turn = { body: ReactNode; recap: string; replies: Reply[]; say?: string };

type Actions = {
  t: Translate;
  business: boolean;
  // Records the exchange in the chat, then sends the request.
  reply: (recap: string, label: string, request: ApiRequest) => void;
  handoff: (recap: string, label: string, approved: boolean) => void;
  restart: () => void;
  // Set once the user confirms a threat has stopped.
  closed: boolean;
  close: (recap: string, label: string) => void;
  // The result is revealed card by card.
  stage: number;
  // Records the card and the user's choice as chat lines, then shows the next card.
  advance: (recap: string, label: string) => void;
  // Action steps the user confirmed with Done, shown under "What has been done".
  confirmed: string[];
  revealed: ("why" | "details")[];
  reveal: (part: "why" | "details") => void;
  providers: ProviderChoice;
  choose: (kind: ProviderKind, id: string) => void;
};

const RISK_TEXT: Record<Risk, TextKey> = { none: "riskNone", low: "riskLow", medium: "riskMedium", high: "riskHigh", critical: "riskCritical" };
const URGENCY_TEXT: Record<Urgency, TextKey> = { none: "urgencyNone", routine: "urgencyRoutine", today: "urgencyToday", immediate: "urgencyImmediate" };

function Receipt({ receipt, t }: { receipt: DataReceipt; t: Translate }) {
  const sections = [
    { title: t("receiptUsed"), items: receipt.used },
    { title: t("receiptRefused"), items: receipt.refused },
    { title: t("receiptNotAccessed"), items: receipt.notAccessed },
  ].filter((section) => section.items.length > 0);
  return (
    <div className="grid gap-1">
      {sections.map((section) => (
        <p key={section.title}>
          {section.title}: {section.items.map((item) => t(item)).join(", ")}
        </p>
      ))}
      <p>{receipt.sentToLlm ? t("receiptAiYes") : t("receiptAiNo")}</p>
    </div>
  );
}

const Section = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className="grid gap-1">
    <h2 className="text-sm font-semibold">{title}</h2>
    {children}
  </section>
);

// Bigger markers and more space than a plain bullet list, so each point reads on its own.
const List = ({ items }: { items: string[] }) => (
  <ul className="grid gap-2">
    {items.map((item) => (
      <li key={item} className="flex items-start gap-3 text-[15px] leading-relaxed">
        <span className="mt-[9px] size-2.5 shrink-0 rounded-full bg-foreground/70" aria-hidden />
        {item}
      </li>
    ))}
  </ul>
);

const RISK_LEVEL: Record<Risk, number> = { none: 0, low: 1, medium: 2, high: 4, critical: 5 };
const METER: Record<Risk, string> = { none: "bg-success", low: "bg-success", medium: "bg-warning", high: "bg-destructive", critical: "bg-danger-deep" };

const Fact = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="grid gap-0.5">
    <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</dt>
    <dd className="font-medium">{children}</dd>
  </div>
);

// Each part of the result has its own look, so the urgent part is seen first.
const PANEL = {
  danger: "border-destructive bg-danger-soft",
  warning: "border-warning bg-warning-soft",
  success: "border-success bg-success-soft",
  info: "border-navy/40 bg-accent",
  calm: "border-border-strong bg-card",
};
const Panel = ({ tone, icon, title, children }: { tone: keyof typeof PANEL; icon: ReactNode; title: string; children: ReactNode }) => (
  <section className={cn("grid gap-2 rounded-2xl border-l-4 border p-4 text-sm motion-safe:animate-[fade-up_.35s_ease-out]", PANEL[tone])}>
    <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide">
      {icon}
      {title}
    </h2>
    {children}
  </section>
);

// Picks an icon for a step from its words, in Finnish, English or Swedish.
type StepKind = "card" | "bank" | "police" | "operator" | "call" | "link" | "delete" | "password" | "device" | "check" | "other";
const STEP_KINDS: [StepKind, RegExp][] = [
  ["card", /card|kortti|kortin|kort\b|kortet/iu],
  ["police", /police|poliisi|polis/iu],
  ["operator", /operator|sim|operaattori|operatör/iu],
  ["bank", /bank|pankk/iu],
  ["call", /hang up|call|puhelu|soit|lopeta puhelu|lägg på|samtal/iu],
  ["link", /link|linkki|länk/iu],
  ["delete", /delete|report it as|poista|ilmoita|radera|anmäl/iu],
  ["password", /password|salasan|lösenord|two-step|kaksivaihe|tvåstegs/iu],
  ["device", /device|disconnect|flight mode|laite|lentotila|enhet|flygläge|app/iu],
  ["check", /check|tarkista|kontrollera|look/iu],
];
const stepKind = (step: string): StepKind => STEP_KINDS.find(([, pattern]) => pattern.test(step))?.[0] ?? "other";
const STEP_ICON: Record<StepKind, typeof Zap> = {
  card: CreditCard, bank: Landmark, police: Siren, operator: Smartphone, call: PhoneOff, link: Link2Off,
  delete: Trash, password: KeyRound, device: WifiOff, check: Eye, other: Zap,
};

// Buttons that let the user act on a step straight away.
function quickButtons(step: string, t: Translate, providers: ProviderChoice): ReactNode[] {
  const kind = stepKind(step);
  const bank = providerById("bank", providers.bank);
  const operator = providerById("operator", providers.operator);
  return [
    ...(kind === "card" ? [<LinkButton key="block" href={`tel:${CARD_BLOCKING.tel}`}>{t("call")} {CARD_BLOCKING.display}</LinkButton>] : []),
    ...((kind === "card" || kind === "bank") && bank ? [<LinkButton key="bank" href={bank.website}>{bank.name}</LinkButton>] : []),
    ...(kind === "police" ? [<LinkButton key="police" href={POLICE.website}>{t("policeReport")}</LinkButton>] : []),
    ...(kind === "operator" && operator ? [<LinkButton key="operator" href={operator.website}>{operator.name}</LinkButton>] : []),
  ];
}

const answerButtons = (ask: (answer: "yes" | "no" | "unsure", label: string) => Reply, t: Translate): Reply[] => [
  { ...ask("yes", t("yes")), icon: <Check className="size-4" aria-hidden /> },
  { ...ask("no", t("no")), icon: <X className="size-4" aria-hidden /> },
  { ...ask("unsure", t("notSure")), icon: <CircleQuestionMark className="size-4" aria-hidden /> },
];

// A question in its own card, like every other step of the chat.
function QuestionCard({ question, hint, context }: { question: string; hint?: string; context?: string[] }) {
  return (
    <section className="grid gap-3 rounded-2xl border border-border-strong bg-card p-4 motion-safe:animate-[fade-up_.35s_ease-out]">
      {context && context.length > 0 && <p className="text-sm text-muted-foreground">{context.join(" ")}</p>}
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-foreground text-background" aria-hidden>
          <MessageCircleQuestionMark className="size-5" />
        </span>
        <h1 tabIndex={-1} className="pt-1.5 text-lg leading-snug font-semibold text-balance focus:outline-none">{question}</h1>
      </div>
      {hint && <p className="pl-13 text-sm text-muted-foreground">{hint}</p>}
    </section>
  );
}

// An icon for each prevention tip, picked from its words in Finnish, English or Swedish.
const TIP_ICONS: [RegExp, typeof Zap][] = [
  [/two-step|two-factor|kaksivaihe|tvåsteg/iu, ShieldCheck],
  [/password|salasan|lösenord/iu, KeyRound],
  [/urgent|pause|pressure|kiire|pysähdy|brådsk|stanna/iu, Hourglass],
  [/link|linkki|länk/iu, Link2Off],
  [/app|sovellu/iu, Smartphone],
  [/call|soit|ring|puhel|samtal/iu, PhoneOff],
  [/bank|pankk/iu, Landmark],
  [/code|koodi|kod/iu, KeyRound],
  [/device|update|laite|päivit|enhet|uppdater/iu, WifiOff],
];
const tipIcon = (tip: string) => TIP_ICONS.find(([pattern]) => pattern.test(tip))?.[1] ?? ShieldCheck;

// Habits that stop this happening again, one tile each.
function PreventCard({ title, tips }: { title: string; tips: string[] }) {
  return (
    <section className="grid gap-3 rounded-2xl border border-success/30 bg-card p-4 motion-safe:animate-[fade-up_.35s_ease-out]">
      <div className="flex items-center gap-3">
        <span className="flex size-11 items-center justify-center rounded-full bg-success-soft text-success" aria-hidden>
          <ShieldCheck className="size-6" />
        </span>
        <h2 className="flex-1 text-base font-semibold">{title}</h2>
        <span className="rounded-full bg-success-soft px-2.5 py-0.5 text-xs font-semibold text-success tabular-nums">{tips.length}</span>
      </div>
      <ul className="grid gap-2">
        {tips.map((tip, index) => {
          const Icon = tipIcon(tip);
          return (
            <li
              key={tip}
              className="flex items-center gap-3 rounded-xl bg-accent p-3 motion-safe:animate-[fade-up_.4s_ease-out_both]"
              style={{ animationDelay: `${150 + index * 120}ms` }}
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-card text-success" aria-hidden>
                <Icon className="size-5" />
              </span>
              <span className="text-sm leading-snug font-medium">{tip}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// A card with a round icon badge and a title, shared by the result's extra cards.
const SHELL_TONE = {
  info: { border: "border-navy/20", badge: "bg-accent text-foreground" },
  neutral: { border: "border-border-strong", badge: "bg-accent text-foreground" },
};
function CardShell({ icon, title, tone, children }: { icon: ReactNode; title: string; tone: keyof typeof SHELL_TONE; children: ReactNode }) {
  return (
    <section className={cn("grid gap-3 rounded-2xl border bg-card p-4 motion-safe:animate-[fade-up_.35s_ease-out]", SHELL_TONE[tone].border)}>
      <div className="flex items-center gap-3">
        <span className={cn("flex size-11 items-center justify-center rounded-full", SHELL_TONE[tone].badge)} aria-hidden>{icon}</span>
        <h2 className="text-base font-semibold">{title}</h2>
      </div>
      {children}
    </section>
  );
}

// One insight with its own icon, label and full text.
const InsightTile = ({ icon, label, text, index }: { icon: ReactNode; label: string; text: string; index: number }) => (
  <div className="flex items-start gap-3 rounded-xl bg-accent p-3.5 motion-safe:animate-[fade-up_.4s_ease-out_both]" style={{ animationDelay: `${120 + index * 120}ms` }}>
    <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-card" aria-hidden>{icon}</span>
    <div className="grid gap-0.5">
      <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{label}</span>
      <span className="text-[15px] leading-relaxed">{text}</span>
    </div>
  </div>
);

const DetailRow = ({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) => (
  <div className="flex items-start gap-3 border-t border-border pt-3 first-of-type:border-0 first-of-type:pt-0">
    <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent text-muted-foreground" aria-hidden>{icon}</span>
    <div className="grid min-w-0 gap-0.5 text-sm">
      <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{label}</span>
      <div className="leading-relaxed">{children}</div>
    </div>
  </div>
);

// What is already done, as a short completed timeline.
function DoneCard({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="grid gap-3 rounded-2xl border border-success/30 bg-card p-4 motion-safe:animate-[fade-up_.35s_ease-out]">
      <div className="flex items-center gap-3">
        <span className="flex size-11 items-center justify-center rounded-full bg-success text-background" aria-hidden>
          <Check className="size-6" strokeWidth={3} />
        </span>
        <h2 className="flex-1 text-base font-semibold">{title}</h2>
        <span className="rounded-full bg-success-soft px-2.5 py-0.5 text-xs font-semibold text-success tabular-nums">{items.length}</span>
      </div>
      <ol className="grid">
        {items.map((item, index) => (
          <li key={item} className="relative flex gap-3 pb-3 last:pb-0 motion-safe:animate-[fade-up_.4s_ease-out_both]" style={{ animationDelay: `${120 + index * 120}ms` }}>
            {/* The line joining each step to the next. */}
            {index < items.length - 1 && <span className="absolute top-8 bottom-0 left-[15px] w-0.5 rounded-full bg-success/30" aria-hidden />}
            <span className="relative flex size-8 shrink-0 items-center justify-center rounded-full bg-success-soft text-success" aria-hidden>
              <CircleCheck className="size-5" />
            </span>
            <span className="flex-1 rounded-xl bg-success-soft/60 px-3.5 py-2.5 text-[15px] leading-relaxed font-medium">{item}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

const KeepChatting = ({ text }: { text: string }) => (
  <p className="flex w-fit items-center gap-2 rounded-full bg-accent px-3 py-1.5 text-xs text-muted-foreground">
    <PenLine className="size-3.5" aria-hidden />
    {text}
  </p>
);

// One action at a time: a big icon, the step, quick buttons to act on it, and progress dots.
function ActionStep({ title, step, index, total, urgent, quick }: { title: string; step: string; index: number; total: number; urgent: boolean; quick: ReactNode[] }) {
  const Icon = STEP_ICON[stepKind(step)];
  return (
    <section
      className={cn(
        "grid gap-4 rounded-2xl border p-4 motion-safe:animate-[fade-up_.35s_ease-out]",
        urgent ? "border-destructive bg-danger-soft" : "border-border-strong bg-card",
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-xs font-semibold tracking-wider uppercase">
          {urgent && (
            <span className="relative flex size-2.5" aria-hidden>
              <span className="absolute inline-flex size-full rounded-full bg-destructive opacity-75 motion-safe:animate-ping" />
              <span className="relative inline-flex size-2.5 rounded-full bg-destructive" />
            </span>
          )}
          {title}
        </h2>
        <ol className="flex items-center gap-1.5" aria-label={`${index + 1} / ${total}`}>
          {Array.from({ length: total }, (_, dot) => (
            <li
              key={dot}
              className={cn(
                "h-1.5 rounded-full transition-all",
                dot === index ? "w-6" : "w-1.5",
                dot <= index ? (urgent ? "bg-destructive" : "bg-foreground") : "bg-border-strong",
              )}
            />
          ))}
        </ol>
      </div>
      <div className="flex items-center gap-4">
        <span
          className={cn(
            "flex size-14 shrink-0 items-center justify-center rounded-2xl",
            urgent ? "bg-destructive text-alert-foreground" : "bg-accent text-foreground",
          )}
          aria-hidden
        >
          <Icon className="size-7" />
        </span>
        <p className="text-xl leading-snug font-semibold text-balance">{step}</p>
      </div>
      {quick.length > 0 && <div className="flex flex-wrap gap-2">{quick}</div>}
    </section>
  );
}

const Tile = ({ icon, label, value }: { icon: ReactNode; label: string; value: string }) => (
  <div className="grid gap-1 rounded-xl bg-accent px-3 py-2.5">
    <span className="flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
      {icon}
      {label}
    </span>
    <span className="text-sm leading-snug font-semibold">{value}</span>
  </div>
);

const ContactRow = ({ name, note, children }: { name: string; note?: string; children: ReactNode }) => (
  <div className="grid gap-1.5 border-t border-border pt-2 first-of-type:border-0 first-of-type:pt-0">
    <p className="font-semibold">{name}</p>
    {note && <p className="text-muted-foreground">{note}</p>}
    <div className="flex flex-wrap items-center gap-2">{children}</div>
  </div>
);

const LinkButton = ({ href, children }: { href: string; children: ReactNode }) => (
  <a
    href={href}
    target={href.startsWith("http") ? "_blank" : undefined}
    rel="noopener noreferrer"
    className="inline-flex min-h-10 items-center rounded-lg border border-border-strong bg-card px-3 text-sm font-medium hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
  >
    {children}
  </a>
);

// Shows the AI's assessment in the chat each time it changes.
export function AssessmentNote({ state, t }: { state: ApiResponse["state"]; t: Translate }) {
  return (
    <div role="status" className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-2xl border border-border-strong bg-card px-4 py-3 text-sm motion-safe:animate-[fade-up_.35s_ease-out]">
      <div className="w-[170px] shrink-0">
        <RiskGauge risk={state.risk} label={t(RISK_TEXT[state.risk])} caption={t("risk")} size="sm" />
      </div>
      <div className="grid min-w-0 gap-1.5">
        <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{t("aiAssessment")}</span>
        <StatusLabel status={state.status} label={state.statusLabel ?? ""} />
        {state.likelyType && (
          <span className="flex items-center gap-1.5 font-medium">
            <Tag className="size-4" aria-hidden />
            {state.likelyType}
          </span>
        )}
      </div>
    </div>
  );
}

const Heading = ({ children }: { children: ReactNode }) => (
  <h1 tabIndex={-1} className="text-[1.0625rem] leading-relaxed font-medium focus:outline-none">
    {children}
  </h1>
);

export function agentTurn(agent: AgentPreview, state: ApiResponse["state"], { t }: Actions, onContinue: () => void): Turn {
  return {
    recap: t(agent.route),
    body: (
      <>
        <Heading>
          {t("agentView")}: {t(agent.route)}
        </Heading>
        <p className="text-sm text-muted-foreground">
          {t("risk")}: {t(RISK_TEXT[state.risk])} · {t("urgency")}: {t(URGENCY_TEXT[state.urgency])}
        </p>
        <ul className="grid gap-1">
          {agent.summary.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </>
    ),
    replies: [{ label: t("continue"), primary: true, run: onContinue }],
  };
}

export function screenTurn(response: ApiResponse, actions: Actions): Turn | null {
  const { t, reply, handoff, restart, business, closed, close, stage, advance, confirmed, revealed, reveal, providers, choose } = actions;
  const { screen, state } = response;
  const talk = (recap: string): Reply => ({ label: t("talk"), icon: <Headset className="size-4" aria-hidden />, run: () => reply(recap, t("talk"), { kind: "talk_to_person" }) });
  const contact = (recap: string, route: SupportRoute, label = t("contactRoute").replace("{name}", t(route))): Reply => ({
    label,
    run: () => reply(recap, label, { kind: "talk_to_person", route }),
  });

  switch (screen.type) {
    case "stop": {
      const label = t(business ? "stoppedBusiness" : "stopped");
      return {
        recap: screen.message,
        body: (
          <div role="alert" className="rounded-2xl bg-alert p-4 text-alert-foreground motion-safe:animate-[fade-up_.35s_ease-out]">
            <h1 tabIndex={-1} className="text-xl leading-snug font-semibold focus:outline-none">
              {screen.message}
            </h1>
            {screen.actions.map((action) => (
              <p key={action} className="mt-2">
                {action}
              </p>
            ))}
          </div>
        ),
        replies: [{ label, primary: true, run: () => reply(screen.message, label, { kind: "continue" }) }, talk(screen.message)],
      };
    }
    case "flip": {
      const ask = (answer: "yes" | "no" | "unsure", label: string): Reply => ({
        label,
        run: () => reply(screen.question, label, { kind: "answer", topic: screen.topic, answer }),
      });
      return {
        recap: screen.question,
        body: <QuestionCard question={screen.question} hint={screen.why} context={screen.context} />,
        replies: answerButtons(ask, t),
      };
    }
    case "ask": {
      const ask = (answer: "yes" | "no" | "unsure", label: string): Reply => ({
        label,
        run: () => reply(screen.question, label, { kind: "ai_answer", id: screen.id, answer }),
      });
      return {
        recap: screen.question,
        body: <QuestionCard question={screen.question} />,
        replies: answerButtons(ask, t),
      };
    }
    case "describe":
      return {
        recap: screen.message,
        body: (
          <>
            <Heading>{screen.message}</Heading>
            <p className="text-sm text-muted-foreground">{screen.hint}</p>
          </>
        ),
        replies: screen.reason === "off_topic"
          ? [
              { label: t("yes"), run: () => reply(screen.message, t("yes"), { kind: "add_details", text: t("yes") }) },
              { label: t("no"), run: () => reply(screen.message, t("no"), { kind: "add_details", text: t("no") }) },
            ]
          : [],
      };
    case "unlock": {
      const choose = (granted: boolean, label: string): Reply => ({
        label,
        primary: granted,
        run: () => reply(`${t("unlockTitle")} ${screen.what}`, label, { kind: "consent", signal: screen.signal, granted }),
      });
      return {
        recap: screen.what,
        body: (
          <>
            <Heading>
              {t("unlockTitle")} {screen.what}
            </Heading>
            <p className="text-sm text-muted-foreground">
              {screen.why} {screen.limit} {screen.ifRefused}
            </p>
          </>
        ),
        replies: [choose(true, t("allow")), choose(false, t("deny"))],
      };
    }
    case "rescue": {
      const step = (outcome: "done" | "not_possible", label: string, primary: boolean): Reply => ({
        label,
        primary,
        run: () => reply(screen.step.title, label, { kind: "rescue", stepId: screen.step.id, outcome }),
      });
      return {
        recap: screen.step.title,
        body: <ActionStep title={t("doNow")} step={screen.step.title} index={screen.position - 1} total={screen.total} urgent quick={quickButtons(screen.step.title, t, providers)} />,
        replies: [
          { ...step("done", t("done"), true), icon: <Check className="size-4" aria-hidden /> },
          { ...step("not_possible", t("notPossible"), false), icon: <Ban className="size-4" aria-hidden /> },
          ...(state.risk === "high" || state.risk === "critical" ? [talk(screen.step.title)] : []),
        ],
      };
    }
    case "handoff": {
      const recap = t("handoffTitle");
      return {
        recap,
        body: (
          <>
            <Heading>{recap}</Heading>
            <p className="text-sm text-muted-foreground">
              {t("simulatedHandoff")}: {t(screen.route)}
            </p>
            <ul className="grid gap-1">
              {screen.summary.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <p className="text-sm text-muted-foreground">
              {t("leftOut")}: {screen.omitted.join(", ")}
            </p>
          </>
        ),
        replies: [
          { label: t("approve"), primary: true, run: () => handoff(recap, t("approve"), true) },
          { label: t("dontShare"), run: () => handoff(recap, t("dontShare"), false) },
        ],
      };
    }
    case "result": {
      const safe = state.status === "safe";
      const live = state.status === "threat_in_progress";
      const urgent = !safe && (state.urgency === "immediate" || state.status === "incident_occurred" || live);
      const sensitive = state.risk === "high" || state.risk === "critical";
      const { story } = screen;
      const toDo = screen.steps.filter((step) => !screen.completed.includes(step));
      const done = [
        ...(screen.stopped ? [t("didStop")] : []),
        ...screen.completed,
        ...confirmed.filter((step) => !screen.completed.includes(step)),
        ...(screen.sharedWith ? [t("didShare").replace("{name}", t(screen.sharedWith))] : []),
      ];
      const recap = screen.statusLabel;
      const type = screen.classification ?? screen.likelyType;
      const level = RISK_LEVEL[state.risk];
      const needsBank = screen.supportRoutes.includes("bank");
      const needsOperator = screen.supportRoutes.includes("operator_support_agent") || /SIM/i.test(type?.title ?? "");
      const needsPolice = screen.supportRoutes.includes("police");

      // The result is shown one card at a time, so each part gets the user's attention.
      // "info" cards are confirmed with "I understand". Each action step is its own card that
      // waits for Done, I don't want to, or Can't do this.
      const cards: { title: string; recap: string; node: ReactNode; action?: boolean }[] = [];
      cards.push({
        title: t("incidentSummary"),
        recap: `${t("incidentSummary")}: ${screen.statusLabel}${type ? ` · ${type.title}` : ""}`,
        node: (
          <section aria-labelledby="summary-title" className="grid gap-4 rounded-2xl border border-border-strong bg-card p-4 motion-safe:animate-[fade-up_.4s_ease-out]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h1 id="summary-title" tabIndex={-1} className="flex items-center gap-2 text-base font-semibold focus:outline-none">
                <FileText className="size-4" aria-hidden />
                {t("incidentSummary")}
              </h1>
              <StatusLabel status={state.status} label={screen.statusLabel} />
            </div>
            <RiskGauge risk={state.risk} label={t(RISK_TEXT[state.risk])} caption={t("risk")} />
            <div className="grid grid-cols-2 gap-2">
              <Tile icon={<Clock className="size-4" aria-hidden />} label={t("urgency")} value={t(URGENCY_TEXT[state.urgency])} />
              <Tile icon={<Tag className="size-4" aria-hidden />} label={t("scamType")} value={type ? type.title : t("notClearYet")} />
            </div>
            <div className="grid gap-2">
              <p className="flex items-start gap-2 text-sm font-medium">
                <Search className="mt-0.5 size-4 shrink-0" aria-hidden />
                {story.attempted}
              </p>
              {response.summary.length > 0 && (
                <ul className="flex flex-wrap gap-1.5">
                  {response.summary.map((line) => (
                    <li key={line} className="rounded-full bg-accent px-2.5 py-1 text-xs font-medium">{line}</li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        ),
      });
      if (screen.branches) {
        cards.push({
          title: t("eachCase"),
          recap: t("eachCase"),
          node: (
            <Panel tone="warning" icon={<TriangleAlert className="size-4" aria-hidden />} title={t("eachCase")}>
              {screen.branches.map((branch) => (
                <div key={branch.condition} className="grid gap-1">
                  <p className="font-medium">{branch.condition}</p>
                  <ol className="grid list-decimal gap-1 pl-5">
                    {branch.steps.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ol>
                </div>
              ))}
            </Panel>
          ),
        });
      } else if (toDo.length > 0) {
        const title = urgent ? t("doNow") : t(state.status === "incident_occurred" ? "storyClear" : "storyDo");
        toDo.forEach((step, index) => {
          const quick = quickButtons(step, t, providers);
          cards.push({
            title,
            recap: step,
            action: true,
            node: <ActionStep title={title} step={step} index={index} total={toDo.length} urgent={urgent} quick={quick} />,
          });
        });
      }
      if (done.length > 0) {
        cards.push({ title: t("storyDone"), recap: t("storyDone"), node: <DoneCard title={t("storyDone")} items={done} /> });
      }
      cards.push({ title: t("storyPrevent"), recap: t("storyPrevent"), node: <PreventCard title={t("storyPrevent")} tips={story.prevent} /> });
      if (needsBank || needsOperator || needsPolice) {
        const bank = providerById("bank", providers.bank);
        const operator = providerById("operator", providers.operator);
        cards.push({
          title: t("contactTitle"),
          recap: t("contactTitle"),
          node: (
            <Panel tone="calm" icon={<Phone className="size-4" aria-hidden />} title={t("contactTitle")}>
              {needsBank && (
                <ContactRow name={bank?.name ?? t("bank")} note={bank ? undefined : providers.bank ? t("findBankContact") : t("whichBank")}>
                  {bank && <LinkButton href={bank.website}>{t("officialWebsite")}</LinkButton>}
                  <LinkButton href={`tel:${CARD_BLOCKING.tel}`}>{t("call")} {CARD_BLOCKING.display}</LinkButton>
                  <span className="text-xs text-muted-foreground">{t("cardBlocking")}</span>
                </ContactRow>
              )}
              {needsOperator && (
                <ContactRow name={operator?.name ?? t("operator_support_agent")} note={operator ? undefined : t("whichOperator")}>
                  {operator && <LinkButton href={operator.website}>{t("officialWebsite")}</LinkButton>}
                </ContactRow>
              )}
              {needsPolice && (
                <ContactRow name={t("police")}>
                  <LinkButton href={POLICE.website}>{t("policeReport")}</LinkButton>
                  <LinkButton href={`tel:${POLICE.emergency}`}>{t("emergency")} {POLICE.emergency}</LinkButton>
                </ContactRow>
              )}
            </Panel>
          ),
        });
      }

      const shown = Math.min(stage, cards.length - 1);
      const extras = [
        ...(revealed.includes("why")
          ? [
              <CardShell key="why" icon={<Search className="size-6" aria-hidden />} title={t("investigate")} tone="info">
                <InsightTile icon={<Target className="size-5" aria-hidden />} label={t("investigateWhy")} text={story.investigation.why} index={0} />
                <InsightTile icon={<Wallet className="size-5" aria-hidden />} label={t("investigateWanted")} text={story.investigation.wanted} index={1} />
                <InsightTile icon={<Eye className="size-5" aria-hidden />} label={t("investigateSpot")} text={story.investigation.spot} index={2} />
              </CardShell>,
            ]
          : []),
        ...(revealed.includes("details")
          ? [
              <CardShell key="details" icon={<FileText className="size-6" aria-hidden />} title={t("details")} tone="neutral">
                {type && <DetailRow icon={<Tag className="size-4" aria-hidden />} label={t("scamType")}>{type.description}</DetailRow>}
                <DetailRow icon={<Info className="size-4" aria-hidden />} label={t("whatHappened")}>{screen.reason}</DetailRow>
                <DetailRow icon={<BadgeCheck className="size-4" aria-hidden />} label={t("howSure")}>{screen.confidence}</DetailRow>
                {screen.unknowns.length > 0 && <DetailRow icon={<CircleQuestionMark className="size-4" aria-hidden />} label={t("stillUnknown")}>{screen.unknowns.join(" ")}</DetailRow>}
                {screen.sources.length > 0 && (
                  <DetailRow icon={<BookOpen className="size-4" aria-hidden />} label={t("syntheticGuidance")}>
                    <span className="flex flex-wrap gap-1.5 pt-0.5">
                      {screen.sources.map((source) => (
                        <span key={source.id} className="rounded-full border border-border-strong px-2.5 py-0.5 text-xs font-medium">{source.title}</span>
                      ))}
                    </span>
                  </DetailRow>
                )}
                <DetailRow icon={<Database className="size-4" aria-hidden />} label={t("receiptTitle")}>
                  <Receipt receipt={response.dataReceipt} t={t} />
                </DetailRow>
                <p className="flex items-start gap-2 rounded-xl bg-accent p-3 text-xs text-muted-foreground">
                  <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                  {response.notice}
                </p>
              </CardShell>,
            ]
          : []),
      ];

      // Replies: "Next" until every card is shown, then a provider question if the contact
      // card needs one, then the closing options. A person only for high or critical risk.
      let replies: Reply[];
      const current = cards[shown]!;
      const atContact = current.title === t("contactTitle");
      if (current.action) {
        replies = [
          { label: t("done"), primary: true, run: () => advance(current.recap, t("done")), icon: <Check className="size-4" aria-hidden /> },
          { label: t("skipStep"), run: () => advance(current.recap, t("skipStep")), icon: <SkipForward className="size-4" aria-hidden /> },
          { label: t("notPossible"), run: () => advance(current.recap, t("notPossible")), icon: <Ban className="size-4" aria-hidden /> },
          ...(sensitive ? [talk(current.recap)] : []),
        ];
      } else if (shown < cards.length - 1) {
        replies = [{ label: t("understand"), primary: true, run: () => advance(current.recap, t("understand")), icon: <Check className="size-4" aria-hidden /> }];
      } else if (atContact && needsBank && !providers.bank) {
        replies = [...BANKS.map((bank) => ({ label: bank.name, run: () => choose("bank", bank.id) })), { label: t("otherProvider"), run: () => choose("bank", "other") }];
      } else if (atContact && needsOperator && !providers.operator) {
        replies = [...OPERATORS.map((operator) => ({ label: operator.name, run: () => choose("operator", operator.id) })), { label: t("otherProvider"), run: () => choose("operator", "other") }];
      } else {
        replies = [
          ...(live && !closed ? [{ label: t("isStopped"), primary: true, run: () => close(recap, t("isStopped")), icon: <CircleCheck className="size-4" aria-hidden /> }] : []),
          ...(revealed.includes("why") ? [] : [{ label: t("investigate"), run: () => reveal("why"), icon: <Search className="size-4" aria-hidden /> }]),
          ...(revealed.includes("details") ? [] : [{ label: t("details"), run: () => reveal("details"), icon: <FileText className="size-4" aria-hidden /> }]),
          ...(sensitive ? [talk(recap)] : []),
        ];
      }
      const spoken =
        current.title === t("incidentSummary")
          ? [screen.statusLabel, story.attempted]
          : current.action
            ? [current.title, current.recap]
            : current.title === t("storyPrevent")
              ? [current.title, ...story.prevent]
              : current.title === t("storyDone")
                ? [current.title, ...done]
                : current.title === t("eachCase")
                  ? [current.title, ...(screen.branches ?? []).flatMap((branch) => [branch.condition, ...branch.steps])]
                  : [current.recap];
      return {
        recap,
        say: spoken.map((line) => line.trim().replace(/([^.!?:])$/, "$1.")).join(" "),
        body: (
          <>
            {/* Only the current card is shown. Earlier ones stay in the chat as one line each. */}
            <div key={shown}>{current.node}</div>
            {closed && (
              <p className="flex items-center gap-3 rounded-2xl border border-success/30 bg-success-soft p-3.5 font-medium motion-safe:animate-[fade-up_.35s_ease-out]">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-success text-background" aria-hidden>
                  <Check className="size-5" strokeWidth={3} />
                </span>
                {t("stoppedThanks")}
              </p>
            )}
            {extras}
            {shown === cards.length - 1 && <KeepChatting text={t("keepChatting")} />}
          </>
        ),
        replies,
      };
    }
    case "fallback":
      return {
        recap: screen.message,
        body: (
          <>
            <Heading>{screen.message}</Heading>
            {screen.actions.map((action) => (
              <p key={action}>{action}</p>
            ))}
          </>
        ),
        replies: [talk(screen.message), { label: t("startAgain"), run: restart }],
      };
    case "end":
      // Not a dead end: the box below starts a new case and the chat history stays.
      return {
        recap: screen.message,
        body: (
          <>
            <Heading>{screen.message}</Heading>
            <KeepChatting text={t("keepChatting")} />
          </>
        ),
        replies: [{ label: t("newConversation"), run: restart }],
      };
  }
}
