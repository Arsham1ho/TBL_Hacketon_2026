"use client";

import { Fragment, useState } from "react";
import { Bot, Info, ScanSearch } from "lucide-react";
import type { Xray, XrayFlag, XrayKind } from "@/engine/xray";
import type { Translate } from "@/lib/ui-text";
import { cn } from "@/lib/utils";

const MARK: Record<XrayFlag["level"], string> = {
  high: "bg-danger-soft decoration-destructive",
  medium: "bg-warning-soft decoration-warning",
};
const DOT: Record<XrayFlag["level"], string> = { high: "bg-destructive", medium: "bg-warning" };

// The message the user received, with each scam trick marked where it appears and explained
// underneath. Tapping a mark or a sign highlights the matching pair.
export function XrayCard({ xray, t }: { xray: Xray; t: Translate }) {
  const [focus, setFocus] = useState<XrayKind | null>(null);
  const signs = xray.kinds.map((kind) => xray.flags.find((flag) => flag.kind === kind)!).filter(Boolean);
  const injection = xray.kinds.includes("injection");
  const number = (kind: XrayKind) => signs.findIndex((sign) => sign.kind === kind) + 1;

  const parts: React.ReactNode[] = [];
  let cursor = 0;
  for (const flag of xray.flags) {
    if (flag.start > cursor) parts.push(xray.text.slice(cursor, flag.start));
    const active = focus === flag.kind;
    parts.push(
      <mark
        key={flag.start}
        title={flag.label}
        onClick={() => setFocus(active ? null : flag.kind)}
        className={cn(
          "cursor-pointer rounded-[4px] px-0.5 text-foreground underline decoration-2 underline-offset-[3px] transition",
          flag.kind === "injection" ? "bg-danger-soft decoration-destructive decoration-wavy" : MARK[flag.level],
          active && "ring-2 ring-foreground",
          focus && !active && "opacity-60",
        )}
      >
        {xray.text.slice(flag.start, flag.end)}
        <sup className={cn("ml-0.5 inline-flex size-3.5 items-center justify-center rounded-full align-super text-[9px] font-bold text-background no-underline", DOT[flag.level])} aria-hidden>
          {number(flag.kind)}
        </sup>
      </mark>,
    );
    cursor = flag.end;
  }
  if (cursor < xray.text.length) parts.push(xray.text.slice(cursor));

  return (
    <section aria-labelledby="xray-title" className="grid gap-3.5 rounded-2xl border border-border-strong bg-card p-4 motion-safe:animate-[fade-up_.35s_ease-out]">
      <div className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground" aria-hidden>
          <ScanSearch className="size-5" />
        </span>
        <div className="grid gap-0.5">
          <h2 id="xray-title" className="text-base leading-tight font-semibold">{t("xrayTitle")}</h2>
          <p className="text-sm text-muted-foreground">{t("xraySubtitle").replace("{n}", String(signs.length))}</p>
        </div>
      </div>

      {injection && (
        <p className="flex items-start gap-2.5 rounded-xl border border-destructive/30 bg-danger-soft px-3 py-2.5 text-sm font-medium">
          <Bot className="mt-px size-4 shrink-0 text-destructive" aria-hidden />
          {t("xrayInjection")}
        </p>
      )}

      <blockquote className="rounded-xl border-l-4 border-border-strong bg-accent/60 px-3.5 py-3 text-[15px] leading-[1.9] break-words whitespace-pre-wrap">
        {parts.map((part, index) => (
          <Fragment key={index}>{part}</Fragment>
        ))}
      </blockquote>

      <ol className="grid gap-1.5">
        {signs.map((sign, index) => (
          <li key={sign.kind}>
            <button
              type="button"
              onClick={() => setFocus(focus === sign.kind ? null : sign.kind)}
              aria-pressed={focus === sign.kind}
              className={cn("flex w-full items-start gap-2.5 rounded-xl px-2.5 py-2 text-left transition hover:bg-accent", focus === sign.kind && "bg-accent")}
            >
              <span className={cn("mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-background", DOT[sign.level])} aria-hidden>
                {index + 1}
              </span>
              <span className="grid gap-0.5">
                <span className="text-sm font-semibold">{sign.label}</span>
                {sign.why && <span className="text-sm leading-snug text-muted-foreground">{sign.why}</span>}
              </span>
            </button>
          </li>
        ))}
      </ol>

      <p className="flex items-start gap-2 text-xs leading-snug text-muted-foreground">
        <Info className="mt-px size-3.5 shrink-0" aria-hidden />
        {t("xrayNote")}
      </p>
    </section>
  );
}
