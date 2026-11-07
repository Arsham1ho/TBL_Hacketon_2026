import type { ReactNode } from "react";
import type { ApiRequest, ApiResponse, DataReceipt, SupportRoute } from "@/engine/screens";
import type { Risk, Urgency } from "@/engine/types";
import type { AgentPreview } from "@/lib/client";
import type { TextKey, Translate } from "@/lib/ui-text";
import { CircleCheck, FileText, ShieldCheck, TriangleAlert, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { Details, StatusLabel } from "./ui";

// One step of the conversation: what SafeStep says, and the replies on offer.
export type Reply = { label: string; primary?: boolean; run: () => void };
export type Turn = { body: ReactNode; recap: string; replies: Reply[] };

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
    <div className="grid gap-2">
      <p className="font-medium text-foreground">{t("receiptTitle")}</p>
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

const List = ({ items }: { items: string[] }) => (
  <ul className="grid list-disc gap-1 pl-5">
    {items.map((item) => (
      <li key={item}>{item}</li>
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
  <section className={cn("grid gap-2 rounded-xl border-l-4 border p-4 text-sm", PANEL[tone])}>
    <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide">
      {icon}
      {title}
    </h2>
    {children}
  </section>
);

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
  const { t, reply, handoff, restart, business, closed, close } = actions;
  const { screen, state } = response;
  const talk = (recap: string): Reply => ({ label: t("talk"), run: () => reply(recap, t("talk"), { kind: "talk_to_person" }) });
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
          <div role="alert" className="rounded-lg bg-danger-deep p-4 text-primary-foreground">
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
        body: (
          <>
            {screen.context && screen.context.length > 0 && <p className="text-sm text-muted-foreground">{screen.context.join(" ")}</p>}
            <Heading>{screen.question}</Heading>
            <p className="text-sm text-muted-foreground">{screen.why}</p>
          </>
        ),
        replies: [ask("yes", t("yes")), ask("no", t("no")), ask("unsure", t("notSure"))],
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
          : [talk(screen.message)],
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
        body: (
          <>
            <p className="text-sm text-muted-foreground">{t("step").replace("{n}", String(screen.position)).replace("{total}", String(screen.total))}</p>
            <Heading>{screen.step.title}</Heading>
            {screen.step.detail !== screen.step.title && <p>{screen.step.detail}</p>}
          </>
        ),
        replies: [step("done", t("done"), true), step("not_possible", t("notPossible"), false), talk(screen.step.title)],
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
      const { story } = screen;
      const toDo = screen.steps.filter((step) => !screen.completed.includes(step));
      const done = [
        ...(screen.stopped ? [t("didStop")] : []),
        ...screen.completed,
        ...(screen.sharedWith ? [t("didShare").replace("{name}", t(screen.sharedWith))] : []),
      ];
      const recap = screen.statusLabel;
      const routes = screen.supportRoutes.slice(0, 3).map((route) => contact(recap, route));
      const firstRoute = screen.supportRoutes[0];
      const stillHappening = firstRoute ? contact(recap, firstRoute, t("stillHappening")) : { ...talk(recap), label: t("stillHappening") };
      // The chat stays open after a result, so there is no "start again" here: the user keeps
      // writing in the box below, and can still reach a person.
      const replies: Reply[] = safe
        ? []
        : live && !closed
          ? [{ label: t("isStopped"), primary: true, run: () => close(recap, t("isStopped")) }, stillHappening]
          : routes.length > 0
            ? [{ ...routes[0]!, primary: true }, ...routes.slice(1)]
            : [talk(recap)];
      const type = screen.classification ?? screen.likelyType;
      const level = RISK_LEVEL[state.risk];
      return {
        recap,
        body: (
          <>
            <section aria-labelledby="summary-title" className="grid gap-3 rounded-xl border border-border-strong bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h1 id="summary-title" tabIndex={-1} className="flex items-center gap-2 text-base font-semibold focus:outline-none">
                  <FileText className="size-4" aria-hidden />
                  {t("incidentSummary")}
                </h1>
                <StatusLabel status={state.status} label={screen.statusLabel} />
              </div>
              <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
                <Fact label={t("risk")}>
                  <span className="flex items-center gap-2">
                    <span className="flex gap-0.5" aria-hidden>
                      {[1, 2, 3, 4, 5].map((step) => (
                        <span key={step} className={cn("h-2 w-4 rounded-sm", step <= level ? METER[state.risk] : "bg-muted")} />
                      ))}
                    </span>
                    {t(RISK_TEXT[state.risk])}
                  </span>
                </Fact>
                <Fact label={t("urgency")}>{t(URGENCY_TEXT[state.urgency])}</Fact>
                <Fact label={t("scamType")}>{type ? type.title : t("notClearYet")}</Fact>
                <Fact label={t("howSure")}>{screen.confidence}</Fact>
                {screen.supportRoutes.length > 0 && (
                  <Fact label={t("whoCanHelp")}>{screen.supportRoutes.map((route) => t(route)).join(", ")}</Fact>
                )}
              </dl>
              {type && <p className="text-sm text-muted-foreground">{type.description}</p>}
              <div className="grid gap-1 border-t border-border pt-3">
                <h2 className="text-sm font-semibold">{t("whatHappened")}</h2>
                <p className="text-sm">{story.attempted}</p>
                {response.summary.length > 0 && <List items={response.summary} />}
                <p className="text-sm text-muted-foreground">{screen.reason}</p>
              </div>
            </section>

            {screen.branches ? (
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
            ) : (
              toDo.length > 0 && (
                <Panel
                  tone={urgent ? "danger" : "calm"}
                  icon={urgent ? <Zap className="size-4" aria-hidden /> : <CircleCheck className="size-4" aria-hidden />}
                  title={urgent ? t("doNow") : safe ? t("storyDo") : t(state.status === "incident_occurred" ? "storyClear" : "storyDo")}
                >
                  <ol className="grid list-decimal gap-1.5 pl-5">
                    {toDo.map((step) => (
                      <li key={step} className={urgent ? "font-medium" : undefined}>{step}</li>
                    ))}
                  </ol>
                </Panel>
              )
            )}

            {done.length > 0 && (
              <Panel tone="success" icon={<CircleCheck className="size-4" aria-hidden />} title={t("storyDone")}>
                <List items={done} />
              </Panel>
            )}

            <Panel tone="info" icon={<ShieldCheck className="size-4" aria-hidden />} title={t("storyPrevent")}>
              <List items={story.prevent} />
            </Panel>

            {closed && <p className="font-medium">{t("stoppedThanks")}</p>}
            <Details title={t("investigate")}>
              <p>
                <span className="font-medium text-foreground">{t("investigateWhy")}: </span>
                {story.investigation.why}
              </p>
              <p>
                <span className="font-medium text-foreground">{t("investigateWanted")}: </span>
                {story.investigation.wanted}
              </p>
              <p>
                <span className="font-medium text-foreground">{t("investigateSpot")}: </span>
                {story.investigation.spot}
              </p>
            </Details>
            <Details title={t("details")}>
              {screen.unknowns.length > 0 && (
                <p>
                  {t("stillUnknown")}: {screen.unknowns.join(" ")}
                </p>
              )}
              {screen.sources.length > 0 && (
                <p>
                  {t("syntheticGuidance")}: {screen.sources.map((source) => source.title).join(", ")}
                </p>
              )}
              <Receipt receipt={response.dataReceipt} t={t} />
              <p>{response.notice}</p>
            </Details>
            <p className="text-sm text-muted-foreground">{t("keepChatting")}</p>
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
            <p className="text-sm text-muted-foreground">{t("keepChatting")}</p>
          </>
        ),
        replies: [{ label: t("newConversation"), run: restart }],
      };
  }
}
