import type { ReactNode } from "react";
import type { ApiRequest, ApiResponse, DataReceipt } from "@/engine/screens";
import type { Risk, Urgency } from "@/engine/types";
import type { AgentPreview } from "@/lib/client";
import type { TextKey, Translate } from "@/lib/ui-text";
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

const Heading = ({ children }: { children: ReactNode }) => (
  <h1 tabIndex={-1} className="text-[1.0625rem] leading-relaxed font-medium focus:outline-none">
    {children}
  </h1>
);

export function agentTurn(agent: AgentPreview, state: ApiResponse["state"], { t }: Actions, onContinue: () => void): Turn {
  return {
    recap: t(agent.destination),
    body: (
      <>
        <Heading>
          {t("agentView")}: {t(agent.destination)}
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
  const { t, reply, handoff, restart, business } = actions;
  const { screen, state } = response;
  const talk = (recap: string): Reply => ({ label: t("talk"), run: () => reply(recap, t("talk"), { kind: "talk_to_person" }) });

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
            <Heading>{screen.question}</Heading>
            <p className="text-sm text-muted-foreground">{screen.why}</p>
          </>
        ),
        replies: [ask("yes", t("yes")), ask("no", t("no")), ask("unsure", t("notSure"))],
      };
    }
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
              {t("simulatedHandoff")}: {t(screen.destination)}
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
      const list = safe ? [] : screen.steps;
      return {
        recap: screen.statusLabel,
        body: (
          <>
            <StatusLabel status={state.status} label={screen.statusLabel} />
            {screen.branches ? (
              <>
                <Heading>{t("eachCase")}</Heading>
                {screen.branches.map((branch) => (
                  <div key={branch.condition}>
                    <p className="font-medium">{branch.condition}</p>
                    {branch.steps.map((step) => (
                      <p key={step}>{step}</p>
                    ))}
                  </div>
                ))}
              </>
            ) : safe ? (
              <Heading>{screen.reason}</Heading>
            ) : (
              <ol className="grid list-decimal gap-1.5 pl-5">
                {list.map((step, index) => (
                  <li key={step}>{index === 0 ? <Heading>{step}</Heading> : step}</li>
                ))}
              </ol>
            )}
            {!safe && <p className="text-muted-foreground">{screen.reason}</p>}
            <Details title={t("details")}>
              <p>{screen.confidence}</p>
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
          </>
        ),
        replies: [{ label: t("startAgain"), primary: true, run: restart }, ...(safe ? [] : [talk(screen.statusLabel)])],
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
      return {
        recap: screen.message,
        body: <Heading>{screen.message}</Heading>,
        replies: [{ label: t("startNew"), primary: true, run: restart }],
      };
  }
}
