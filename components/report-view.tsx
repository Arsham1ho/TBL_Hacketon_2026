"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, BadgeCheck, BookOpen, Braces, ChartColumn, CircleCheck, CircleQuestionMark, Clock, Database, FileDown, Info, ListChecks, MessageCircleQuestionMark, Quote, Route, ShieldCheck, Tag, Target, TrendingUp, TriangleAlert, X } from "lucide-react";
import type { Language, Risk } from "@/engine/types";
import type { SavedReport } from "@/lib/history";
import type { TextKey, Translate } from "@/lib/ui-text";
import { cn } from "@/lib/utils";
import { RiskGauge } from "./risk-gauge";
import { StatusLabel } from "./ui";

const COLUMN = "mx-auto w-full max-w-[800px] px-4 print:max-w-none print:px-0";
const LOCALE: Record<Language, string> = { en: "en-GB", fi: "fi-FI", sv: "sv-FI" };
const LEVELS: Risk[] = ["none", "low", "medium", "high", "critical"];
const RISK_TEXT: Record<Risk, TextKey> = { none: "riskNone", low: "riskLow", medium: "riskMedium", high: "riskHigh", critical: "riskCritical" };
const URGENCY_TEXT = { none: "urgencyNone", routine: "urgencyRoutine", today: "urgencyToday", immediate: "urgencyImmediate" } as const;
// Status colours, used only for risk, and always next to the level written out.
const RISK_FILL: Record<Risk, string> = { none: "fill-success", low: "fill-success", medium: "fill-warning", high: "fill-destructive", critical: "fill-danger-deep" };
const RISK_TEXT_COLOR: Record<Risk, string> = { none: "text-success", low: "text-success", medium: "text-warning", high: "text-destructive", critical: "text-danger-deep" };
const RISK_BG: Record<Risk, string> = { none: "bg-success", low: "bg-success", medium: "bg-warning", high: "bg-destructive", critical: "bg-danger-deep" };
const pct = (value: number) => `${Math.round(value * 100)}%`;
// Long codes such as contact_bank_and_block_cards wrap at the underscores instead of overflowing.
const wrapCode = (code: string) => code.replace(/_/g, "_​");

// A section of the report: an icon badge, a title, a one-line note and its content.
function Section({ icon, title, note, children, className }: { icon: ReactNode; title: string; note?: string; children: ReactNode; className?: string }) {
  return (
    <section className={cn("grid content-start gap-4 rounded-2xl border border-border-strong bg-card p-4 sm:p-5", className)}>
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-foreground" aria-hidden>{icon}</span>
        <div className="grid gap-0.5 pt-0.5">
          <h2 className="text-base font-semibold">{title}</h2>
          {note && <p className="text-sm text-muted-foreground">{note}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

const Label = ({ children, icon }: { children: ReactNode; icon?: ReactNode }) => (
  <span className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
    {icon}
    {children}
  </span>
);

const Code = ({ children }: { children: string }) => <code className="rounded-md bg-accent px-1.5 py-0.5 font-mono text-xs [overflow-wrap:anywhere]">{wrapCode(children)}</code>;

// One headline number with its label, like a dashboard tile.
function Stat({ label, value, sub, tone, children }: { label: string; value: string; sub?: string; tone?: string; children?: ReactNode }) {
  return (
    <div className="grid content-start gap-1.5 rounded-xl bg-accent p-3">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <span className="flex items-baseline gap-1.5">
        <span className={cn("text-2xl leading-none font-bold tabular-nums", tone)}>{value}</span>
        {sub && <span className="text-xs font-semibold text-muted-foreground">{sub}</span>}
      </span>
      {children}
    </div>
  );
}

// A row of small segments filled up to a value, for scores on a short scale.
function Meter({ value, max, tone }: { value: number; max: number; tone: string }) {
  return (
    <span className="flex gap-1" aria-hidden>
      {Array.from({ length: max }, (_, index) => (
        <span key={index} className={cn("h-1.5 flex-1 rounded-full", index < value ? tone : "bg-border-strong")} />
      ))}
    </span>
  );
}

// Risk after each update, as a step line over the five levels. One series, so no legend:
// the level names on the axis say what each height means.
function RiskTimeline({ timeline, t }: { timeline: Risk[]; t: Translate }) {
  const points = timeline.length > 0 ? timeline : (["none"] as Risk[]);
  const W = 640;
  const H = 200;
  const left = 92;
  const right = 24;
  const top = 14;
  const bottom = 30;
  const x = (index: number) => (points.length === 1 ? left + (W - left - right) / 2 : left + (index * (W - left - right)) / (points.length - 1));
  const y = (risk: Risk) => top + ((4 - LEVELS.indexOf(risk)) * (H - top - bottom)) / 4;
  const line = points.map((risk, index) => (index === 0 ? `M ${x(0)} ${y(risk)}` : `H ${x(index)} V ${y(risk)}`)).join(" ");
  const area = `${line} V ${H - bottom} H ${x(0)} Z`;
  const [hover, setHover] = useState<number | null>(null);
  const last = points.at(-1)!;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`${t("reportRiskTimeline")}: ${points.map((risk) => t(RISK_TEXT[risk])).join(", ")}`}>
        {LEVELS.map((level) => (
          <g key={level}>
            <line x1={left} x2={W - right} y1={y(level)} y2={y(level)} className="stroke-border" strokeWidth={1} />
            <text x={left - 12} y={y(level) + 4} textAnchor="end" className={cn("text-[12px]", level === last ? "fill-foreground font-semibold" : "fill-muted-foreground")}>{t(RISK_TEXT[level])}</text>
          </g>
        ))}
        {/* A soft fill under the line, in the colour of the final level. */}
        <path d={area} className={cn(RISK_FILL[last], "opacity-10")} />
        <path d={line} fill="none" className="stroke-foreground" strokeWidth={2} strokeLinejoin="round" />
        {points.map((risk, index) => (
          <g key={index}>
            <text x={x(index)} y={H - 8} textAnchor="middle" className="fill-muted-foreground text-[11px] tabular-nums">{index + 1}</text>
            <circle cx={x(index)} cy={y(risk)} r={hover === index ? 7.5 : 6} className={cn(RISK_FILL[risk], "stroke-card")} strokeWidth={2} />
            {/* A wide invisible target, so the point is easy to hover. */}
            <rect x={x(index) - 18} y={top - 8} width={36} height={H - top - bottom + 16} fill="transparent" onMouseEnter={() => setHover(index)} onMouseLeave={() => setHover(null)}>
              <title>{`${t("reportUpdate")} ${index + 1}: ${t(RISK_TEXT[risk])}`}</title>
            </rect>
          </g>
        ))}
      </svg>
      {hover !== null && (
        <div className="pointer-events-none absolute top-0 rounded-lg border border-border-strong bg-card px-2.5 py-1.5 text-xs shadow-md print:hidden" style={{ left: `${(x(hover) / W) * 100}%`, transform: "translateX(-50%)" }}>
          <span className="text-muted-foreground">{t("reportUpdate")} {hover + 1}</span> · <span className="font-semibold">{t(RISK_TEXT[points[hover]!])}</span>
        </div>
      )}
    </div>
  );
}

// How the score was built, step by step, on a 0 to 100% scale. Gains and losses carry
// their sign in text, so the colour is never the only cue.
function ConfidenceWaterfall({ report, t }: { report: SavedReport; t: Translate }) {
  const c = report.confidence;
  const gain = c.confirmed * c.perConfirmed;
  const loss = c.unknown * c.perUnknown;
  const raw = c.base + gain - loss;
  const rows: { label: string; detail?: string; from: number; to: number; kind: "total" | "gain" | "loss" | "limit" }[] = [
    { label: t("confStart"), from: 0, to: c.base, kind: "total" },
    { label: t("confConfirmed"), detail: `${c.confirmed} × ${pct(c.perConfirmed)}`, from: c.base, to: c.base + gain, kind: "gain" },
    { label: t("confUnknown"), detail: `${c.unknown} × ${pct(c.perUnknown)}`, from: c.base + gain, to: raw, kind: "loss" },
  ];
  if (Math.abs(raw - c.score) > 0.001) rows.push({ label: t("confLimit"), detail: c.unclearCap !== null ? `≤ ${pct(c.unclearCap)}` : `${pct(c.floor)}–${pct(c.ceiling)}`, from: raw, to: c.score, kind: "limit" });
  rows.push({ label: t("confFinal"), from: 0, to: c.score, kind: "total" });
  const clamp = (value: number) => Math.min(1, Math.max(0, value));

  return (
    <div className="grid gap-3">
      {rows.map((row) => {
        const start = clamp(Math.min(row.from, row.to));
        const end = clamp(Math.max(row.from, row.to));
        const change = row.to - row.from;
        const value = row.kind === "total" ? pct(row.to) : `${change >= 0 ? "+" : "−"}${pct(Math.abs(change))}`;
        return (
          <div key={row.label} className="grid gap-1.5" title={`${row.label}: ${value}`}>
            <span className="flex items-baseline justify-between gap-2 text-sm">
              <span className={cn(row.kind === "total" && "font-semibold")}>
                {row.label}
                {row.detail && <span className="ml-1.5 text-xs text-muted-foreground tabular-nums">{row.detail}</span>}
              </span>
              <span className={cn("tabular-nums", row.kind === "total" ? "font-bold" : row.kind === "gain" ? "font-semibold text-success" : row.kind === "loss" && change < 0 ? "font-semibold text-destructive" : "text-muted-foreground")}>{value}</span>
            </span>
            <span className="relative h-3 rounded-full bg-accent">
              {end > start && (
                <span
                  className={cn("absolute inset-y-0 rounded-[4px]", row.kind === "total" ? "bg-foreground" : row.kind === "gain" ? "bg-success" : row.kind === "loss" ? "bg-destructive" : "bg-border-strong")}
                  style={{ left: `${start * 100}%`, width: `${(end - start) * 100}%` }}
                />
              )}
            </span>
          </div>
        );
      })}
      <span className="flex justify-between text-[11px] text-muted-foreground tabular-nums" aria-hidden>
        <span>0%</span>
        <span>50%</span>
        <span>100%</span>
      </span>
    </div>
  );
}

// The confirmed facts behind the confidence score, by where they came from. They add up to the
// "Confirmed facts" count above, so the two charts agree.
function EvidenceBars({ report, t }: { report: SavedReport; t: Translate }) {
  const counts = report.evidenceCounts ?? { userWords: 0, answers: 0, visibleSignals: 0, consentedSignals: 0 };
  const rows = [
    { label: t("srcUserWords"), count: counts.userWords },
    { label: t("srcAnswer"), count: counts.answers },
    { label: t("srcVisible"), count: counts.visibleSignals },
    { label: t("srcConsented"), count: counts.consentedSignals },
  ];
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  const max = Math.max(1, ...rows.map((row) => row.count));
  return (
    <div className="grid gap-3">
      {rows.map((row) => (
        <div key={row.label} className="grid gap-1.5" title={`${row.label}: ${row.count}`}>
          <span className="flex items-baseline justify-between gap-2 text-sm">
            <span>{row.label}</span>
            <span className="font-semibold tabular-nums">{row.count}</span>
          </span>
          <span className="relative h-3 rounded-full bg-accent">
            {row.count > 0 && <span className="absolute inset-y-0 left-0 rounded-[4px] bg-navy" style={{ width: `${(row.count / max) * 100}%` }} />}
          </span>
        </div>
      ))}
      <span className="flex items-center justify-between border-t border-border pt-2 text-sm font-semibold">
        <span>{t("confConfirmed")}</span>
        <span className="tabular-nums">{total}</span>
      </span>
    </div>
  );
}

function Check({ ok, children }: { ok: boolean; children: ReactNode }) {
  return (
    <li className="flex items-start gap-2.5 rounded-xl bg-accent px-3 py-2.5 text-sm leading-snug">
      {ok ? <CircleCheck className="mt-px size-4 shrink-0 text-success" aria-hidden /> : <TriangleAlert className="mt-px size-4 shrink-0 text-warning" aria-hidden />}
      <span>{children}</span>
    </li>
  );
}

// The full decision report, full page. It's drawn into <body> so printing shows only the
// report, and the browser's print dialog saves it as a PDF.
export function ReportView({ report, t, language, onClose }: { report: SavedReport; t: Translate; language: Language; onClose: () => void }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const stamp = new Intl.DateTimeFormat(LOCALE[language], { dateStyle: "medium", timeStyle: "short" }).format(new Date(report.generatedAt));
  const fileName = `safestep-report-${report.generatedAt.slice(0, 16).replace(/[:T]/g, "-")}`;
  const { decision, safety, data } = report;
  const risk = report.timeline.at(-1) ?? decision.risk;
  const level = LEVELS.indexOf(risk);
  const intervention = report.intervention ?? { level: 0, max: 4 };
  const actionName = t(`action.${decision.primaryAction}`);

  // Each fact, with the user's own words that support it beside it.
  const quotes = new Map<string, string[]>();
  for (const entry of report.evidence) quotes.set(entry.fact, [...new Set([...(quotes.get(entry.fact) ?? []), entry.quote])]);
  const factRows = [...report.facts, ...[...quotes.keys()].filter((field) => !report.facts.some((fact) => fact.field === field)).map((field) => ({ field, value: "—" }))];

  // The PDF file is named after the page title, so it's set while the dialog is open.
  function savePdf() {
    const title = document.title;
    document.title = fileName;
    window.addEventListener("afterprint", () => (document.title = title), { once: true });
    window.print();
  }

  function saveData() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: "application/json" }));
    const link = Object.assign(document.createElement("a"), { href: url, download: `${fileName}.json` });
    link.click();
    URL.revokeObjectURL(url);
  }

  const decisionRows: [string, string][] = [
    ["status", decision.status],
    ["risk", decision.risk],
    ["urgency", decision.urgency],
    ["situation", decision.situation],
    ["primary_action", decision.primaryAction],
    ["destination", decision.destination ?? "none"],
    ["external_contacts", decision.externalContacts.join(", ") || "none"],
    ["rescue_mode", String(decision.rescue)],
  ];
  const noData = data.used.length + data.refused.length + data.notAccessed.length === 0;

  if (!mounted) return null;
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={t("reportTitle")} className="print-report fixed inset-0 z-[60] flex flex-col bg-background text-foreground motion-safe:animate-[fade-up_.25s_ease-out] print:static print:block">
      <header className="border-b border-border pt-[env(safe-area-inset-top)] print:hidden">
        <div className={cn(COLUMN, "flex items-center gap-2 py-3")}>
          <button type="button" onClick={onClose} aria-label={t("back")} className="flex size-10 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground">
            <ArrowLeft className="size-5" aria-hidden />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-bold">{t("reportTitle")}</h1>
            <p className="truncate text-xs text-muted-foreground">{stamp}</p>
          </div>
          <button type="button" onClick={saveData} className="hidden min-h-10 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground sm:inline-flex">
            <Braces className="size-4" aria-hidden />
            {t("downloadData")}
          </button>
          <button type="button" onClick={savePdf} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90">
            <FileDown className="size-4" aria-hidden />
            {t("downloadPdf")}
          </button>
          <button type="button" onClick={onClose} aria-label={t("close")} className="flex size-10 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground">
            <X className="size-5" aria-hidden />
          </button>
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain print:overflow-visible">
        <div className={cn(COLUMN, "grid gap-4 py-6 print:gap-3 print:py-0")}>
          {/* Title band, which also heads the PDF. */}
          <div className="grid gap-3 rounded-2xl bg-primary p-5 text-primary-foreground sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold tracking-[0.18em] uppercase opacity-80">SafeStep</span>
              <span className="rounded-full border border-current/30 px-2.5 py-0.5 text-[11px] font-medium opacity-80">{t("prototype")}</span>
            </div>
            <div className="grid gap-1">
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("reportPage")}</h1>
              <p className="text-sm opacity-80">{t("reportIntro")}</p>
            </div>
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs opacity-80">
              <span className="flex items-center gap-1.5">
                <Clock className="size-3.5" aria-hidden />
                {stamp}
              </span>
              <span>·</span>
              <span>{t(report.audience === "small_business" ? "smallBusiness" : "consumer")}</span>
              <span>·</span>
              <span className="uppercase">{report.language}</span>
            </p>
          </div>

          {/* Key findings: the gauge, four headline numbers and the one step that matters most. */}
          <Section icon={<ListChecks className="size-5" />} title={t("reportKeyFindings")}>
            <div className="flex flex-wrap items-center gap-2">
              <StatusLabel status={decision.status} label={decision.statusLabel} />
              {report.likelyType && (
                <span className="flex items-center gap-1.5 rounded-full bg-accent px-2.5 py-1 text-sm font-medium">
                  <Tag className="size-3.5" aria-hidden />
                  {report.likelyType.title}
                </span>
              )}
            </div>
            <div className="grid items-center gap-4 sm:grid-cols-[minmax(0,14rem)_1fr] print:grid-cols-[14rem_1fr]">
              <RiskGauge risk={risk} label={t(RISK_TEXT[risk])} caption={t("risk")} />
              <div className="grid grid-cols-2 gap-2">
                <Stat label={t("reportRiskLevel")} value={`${level + 1}`} sub="/ 5" tone={RISK_TEXT_COLOR[risk]}>
                  <Meter value={level + 1} max={5} tone={RISK_BG[risk]} />
                </Stat>
                <Stat label={t("reportConfidenceShort")} value={pct(report.confidence.score)} sub={t(`confBand.${report.confidence.band}`)}>
                  <Meter value={Math.round(report.confidence.score * 10)} max={10} tone="bg-foreground" />
                </Stat>
                <Stat label={t("reportQuestionsShort")} value={String(report.questions.length)} />
                <Stat label={t("urgency")} value={t(URGENCY_TEXT[decision.urgency])} tone={decision.urgency === "immediate" ? "text-destructive" : undefined} />
              </div>
            </div>
            {report.steps[0] && (
              <div className="flex items-center gap-3 rounded-xl border-l-4 border-foreground bg-accent p-3.5">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground" aria-hidden>
                  <Target className="size-5" />
                </span>
                <div className="grid gap-0.5">
                  <Label>{t("reportNextStep")}</Label>
                  <p className="text-[15px] leading-snug font-semibold">{report.steps[0]}</p>
                </div>
              </div>
            )}
          </Section>

          <Section icon={<TrendingUp className="size-5" />} title={t("reportRiskTimeline")} note={t("reportRiskTimelineNote")}>
            <RiskTimeline timeline={report.timeline} t={t} />
          </Section>

          <div className="grid gap-4 md:grid-cols-2 print:grid-cols-2 print:gap-3">
            <Section icon={<BadgeCheck className="size-5" />} title={t("reportConfidence")} note={t("reportConfidenceNote")}>
              <ConfidenceWaterfall report={report} t={t} />
            </Section>
            <Section icon={<ChartColumn className="size-5" />} title={t("reportEvidence")} note={t("reportEvidenceNote")}>
              <EvidenceBars report={report} t={t} />
            </Section>
          </div>

          <Section icon={<Route className="size-5" />} title={t("reportDecision")} note={t("reportDecisionNote")}>
            <div className="grid gap-3 sm:grid-cols-2 print:grid-cols-2">
              <div className="grid content-start gap-2 rounded-xl bg-accent p-3.5">
                <Label icon={<Target className="size-3.5" aria-hidden />}>{t("reportAction")}</Label>
                <p className="text-lg leading-snug font-bold">{actionName}</p>
                <Code>{decision.primaryAction}</Code>
              </div>
              <div className="grid content-start gap-2 rounded-xl bg-accent p-3.5">
                <Label icon={<Info className="size-3.5" aria-hidden />}>{t("reportIntervention")}</Label>
                <p className="text-lg leading-none font-bold tabular-nums">
                  {intervention.level}
                  <span className="text-sm font-semibold text-muted-foreground"> / {intervention.max}</span>
                </p>
                <Meter value={intervention.level} max={intervention.max} tone={RISK_BG[risk]} />
                <p className="text-xs text-muted-foreground">{t("reportInterventionNote")}</p>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-xl border-l-4 border-foreground bg-accent p-3.5">
              <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
              <div className="grid gap-0.5">
                <Label>{t("reportWhy")}</Label>
                <p className="text-[15px] leading-snug font-medium">{report.reason}</p>
              </div>
            </div>

            {report.steps.length > 0 && (
              <div className="grid gap-2">
                <Label icon={<ListChecks className="size-3.5" aria-hidden />}>{t("reportSteps")}</Label>
                <ol className="grid gap-1.5">
                  {report.steps.map((step, index) => (
                    <li key={step} className={cn("flex items-start gap-3 rounded-xl px-3 py-2.5 text-sm", index === 0 ? "bg-danger-soft font-semibold" : "bg-accent")}>
                      <span className={cn("flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums", index === 0 ? "bg-destructive text-alert-foreground" : "bg-card")}>{index + 1}</span>
                      <span className="pt-0.5">{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {report.unknowns.length > 0 && (
              <div className="flex items-start gap-2.5 rounded-xl bg-warning-soft px-3 py-2.5 text-sm">
                <CircleQuestionMark className="mt-px size-4 shrink-0 text-warning" aria-hidden />
                <span>
                  <span className="font-semibold">{t("stillUnknown")}:</span> {report.unknowns.join(" ")}
                </span>
              </div>
            )}

            {/* The rule engine's raw output, for technical readers. */}
            <div className="overflow-hidden rounded-xl border border-border">
              <dl className="grid grid-cols-2 sm:grid-cols-4 print:grid-cols-4">
                {decisionRows.map(([key, value]) => (
                  <div key={key} className="grid content-start gap-1 border-b border-border p-2.5 [&:nth-last-child(-n+4)]:sm:border-b-0">
                    <dt className="font-mono text-[11px] text-muted-foreground">{key}</dt>
                    <dd className="font-mono text-xs font-semibold [overflow-wrap:anywhere]">{wrapCode(value)}</dd>
                  </div>
                ))}
              </dl>
            </div>

            {report.sources.length > 0 && (
              <div className="grid gap-2">
                <Label icon={<BookOpen className="size-3.5" aria-hidden />}>{t("syntheticGuidance")}</Label>
                <span className="flex flex-wrap gap-1.5">
                  {report.sources.map((source) => (
                    <span key={source.id} className="flex items-center gap-1.5 rounded-full border border-border-strong px-2.5 py-1 text-xs font-medium">
                      <BookOpen className="size-3 text-muted-foreground" aria-hidden />
                      {source.title}
                    </span>
                  ))}
                </span>
              </div>
            )}
          </Section>

          <Section icon={<Braces className="size-5" />} title={t("reportFacts")} note={t("reportFactsNote")}>
            {factRows.length > 0 ? (
              <div className="overflow-hidden rounded-xl border border-border">
                <table className="w-full table-fixed text-left text-sm">
                  <thead className="bg-accent text-xs tracking-wide text-muted-foreground uppercase">
                    <tr>
                      <th className="w-[30%] px-3 py-2 font-semibold">{t("reportField")}</th>
                      <th className="w-[30%] px-3 py-2 font-semibold">{t("reportValue")}</th>
                      <th className="px-3 py-2 font-semibold">{t("reportSupportedBy")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {factRows.map((fact) => (
                      <tr key={fact.field} className="align-top">
                        <td className="px-3 py-2.5"><Code>{fact.field}</Code></td>
                        <td className="px-3 py-2.5 font-mono text-xs leading-relaxed font-semibold [overflow-wrap:anywhere]">{wrapCode(fact.value)}</td>
                        <td className="px-3 py-2">
                          <span className="flex flex-wrap gap-1">
                            {(quotes.get(fact.field) ?? []).map((quote) => (
                              <span key={quote} className="inline-flex items-center gap-1 rounded-md bg-warning-soft px-1.5 py-0.5 text-xs italic">
                                <Quote className="size-3 shrink-0 text-warning not-italic" aria-hidden />
                                {quote}
                              </span>
                            ))}
                            {!quotes.get(fact.field) && <span className="text-xs text-muted-foreground">—</span>}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{t("reportNone")}</p>
            )}
          </Section>

          <Section icon={<MessageCircleQuestionMark className="size-5" />} title={t("reportQuestions")}>
            {report.questions.length > 0 ? (
              <ol className="grid gap-2">
                {report.questions.map((entry, index) => (
                  <li key={index} className="grid gap-2 rounded-xl bg-accent p-3 text-sm">
                    <span className="flex items-center gap-2">
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-card text-xs font-semibold tabular-nums">{index + 1}</span>
                      <span className="rounded-full border border-border-strong px-2 py-0.5 text-[11px] font-medium text-muted-foreground">{t(entry.kind === "decisive" ? "qDecisive" : "qFollowUp")}</span>
                    </span>
                    <span className="font-medium">{entry.question}</span>
                    <span className="ml-auto w-fit rounded-2xl rounded-br-sm bg-primary px-3 py-1.5 font-semibold text-primary-foreground">{entry.answer}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-muted-foreground">{t("reportNone")}</p>
            )}
          </Section>

          <div className="grid gap-4 md:grid-cols-2 print:grid-cols-2 print:gap-3">
            <Section icon={<ShieldCheck className="size-5" />} title={t("reportSafety")}>
              <ul className="grid gap-1.5">
                <Check ok>{t(safety.secretsMasked ? "safeSecrets" : "safeNoSecrets")}</Check>
                <Check ok={!safety.liveDanger || safety.stopShown}>{safety.liveDanger ? <>{t("safeLive")} <Code>{safety.liveDanger}</Code></> : t("safeNoLive")}</Check>
                <Check ok>{t("safeRules")}</Check>
                <Check ok>{t(data.sentToLlm ? "safeLlm" : "safeNoLlm")}</Check>
                <Check ok>{safety.handoff.approved && safety.handoff.destination ? t("safeShared").replace("{name}", t(safety.handoff.destination)) : t("safeNotShared")}</Check>
              </ul>
            </Section>
            <Section icon={<Database className="size-5" />} title={t("receiptTitle")}>
              {noData ? (
                <p className="flex items-start gap-2.5 rounded-xl bg-success-soft px-3 py-2.5 text-sm font-medium">
                  <ShieldCheck className="mt-px size-4 shrink-0 text-success" aria-hidden />
                  {t("reportNoData")}
                </p>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-2">
                    {([
                      ["receiptUsed", data.used, "text-success"],
                      ["receiptRefused", data.refused, "text-destructive"],
                      ["receiptNotAccessed", data.notAccessed, "text-muted-foreground"],
                    ] as const).map(([key, list, tone]) => (
                      <Stat key={key} label={t(key)} value={String(list.length)} tone={tone} />
                    ))}
                  </div>
                  <ul className="grid gap-1 text-sm">
                    {data.used.map((signal) => (
                      <li key={signal.id} className="flex items-center gap-2"><CircleCheck className="size-4 text-success" aria-hidden />{signal.label}</li>
                    ))}
                    {data.refused.map((signal) => (
                      <li key={signal.id} className="flex items-center gap-2"><X className="size-4 text-destructive" aria-hidden />{signal.label}</li>
                    ))}
                  </ul>
                </>
              )}
            </Section>
          </div>

          <p className="flex items-start gap-2 rounded-xl border border-dashed border-border-strong p-3 text-xs text-muted-foreground print:hidden">
            <Info className="mt-px size-3.5 shrink-0" aria-hidden />
            {t("prototype")}
          </p>
        </div>
      </main>
    </div>,
    document.body,
  );
}
