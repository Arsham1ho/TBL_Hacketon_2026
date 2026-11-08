"use client";

import { useEffect, useRef, useState } from "react";
import { Building2, Check, Crown, FileText, Headset, LifeBuoy, Lock, Radar, Receipt, ScanSearch, ShieldCheck, Star, Users, X, Zap, LockOpen, Minus } from "lucide-react";
import type { Language } from "@/engine/types";
import { PLAN_COPY, PLANS, type Feature, type Plan } from "@/lib/plans";
import { cn } from "@/lib/utils";

const ICON: Record<Plan, typeof ShieldCheck> = { free: ShieldCheck, bundle: Crown, business: Building2 };

// A small chip showing the current plan. Opens the plan sheet.
export function PlanChip({ plan, language, onClick }: { plan: Plan; language: Language; onClick: () => void }) {
  const Icon = ICON[plan];
  const name = PLAN_COPY[language].plans[plan].name;
  return (
    <button
      type="button"
      onClick={onClick}
      title={PLAN_COPY[language].title}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold shadow-xs",
        plan === "free" ? "border-border-strong bg-card/90 text-muted-foreground hover:bg-accent hover:text-foreground" : "border-success/30 bg-success-soft text-success",
      )}
    >
      <Icon className="size-3.5" aria-hidden />
      <span className="max-w-[120px] truncate">{name}</span>
    </button>
  );
}

// Shown where a paid feature would be. The free path always carries on.
export function LockedNote({ feature, language }: { feature: Feature; language: Language }) {
  return (
    <p className="flex items-start gap-2.5 rounded-xl border border-border-strong bg-accent px-3.5 py-3 text-sm">
      <Lock className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>{PLAN_COPY[language].locked[feature]}</span>
    </p>
  );
}

export function QueueChip({ priority, language }: { priority: boolean; language: Language }) {
  const c = PLAN_COPY[language];
  return (
    <span className={cn("inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold", priority ? "bg-success-soft text-success" : "bg-accent text-muted-foreground")}>
      {priority ? <Zap className="size-3.5" aria-hidden /> : <Lock className="size-3.5" aria-hidden />}
      {priority ? c.priority : c.standard}
    </span>
  );
}

// Short labels for the compact sheet. The full copy stays in lib/plans.ts.
const SHEET: Record<Language, { names: Record<Plan, string>; prices: Record<Plan, string>; units: Record<Plan, string>; switchTo: string; demo: string; rows: string[] }> = {
  en: {
    names: { free: "Free", bundle: "Security", business: "Business" },
    prices: { free: "€0", bundle: "€2.99", business: "€9" },
    units: { free: "always", bundle: "/ month", business: "/ month · company" },
    switchTo: "Switch to",
    demo: "Demo · no payment · prices are a hypothesis",
    rows: ["Next step & Rescue Mode", "Link & message check", "Talk to a person", "DNA signal checks", "Decision report", "Priority help", "Staff & access checks", "Invoice fraud checks"],
  },
  fi: {
    names: { free: "Maksuton", bundle: "Turva", business: "Yritys" },
    prices: { free: "0 €", bundle: "2,99 €", business: "9 €" },
    units: { free: "aina", bundle: "/ kk", business: "/ kk · yritys" },
    switchTo: "Vaihda:",
    demo: "Demo · ei maksua · hinnat ovat oletus",
    rows: ["Seuraava askel ja Pelastustila", "Linkin ja viestin tarkistus", "Puhu ihmisen kanssa", "DNA-tietojen tarkistus", "Päätösraportti", "Etusija avussa", "Työntekijätilien tarkistus", "Laskupetosten tarkistus"],
  },
  sv: {
    names: { free: "Gratis", bundle: "Säkerhet", business: "Företag" },
    prices: { free: "0 €", bundle: "2,99 €", business: "9 €" },
    units: { free: "alltid", bundle: "/ mån", business: "/ mån · företag" },
    switchTo: "Byt till",
    demo: "Demo · ingen betalning · priserna är en hypotes",
    rows: ["Nästa steg och Räddningsläge", "Kontroll av länk och meddelande", "Prata med en person", "Kontroll av DNA-data", "Beslutsrapport", "Förtur till hjälp", "Kontroll av personal och åtkomst", "Kontroll av fakturabedrägeri"],
  },
};

// Which plans include each row of the comparison, in the order of SHEET.rows.
const ROWS: { icon: typeof ShieldCheck; plans: Plan[] }[] = [
  { icon: LifeBuoy, plans: ["free", "bundle", "business"] },
  { icon: ScanSearch, plans: ["free", "bundle", "business"] },
  { icon: Headset, plans: ["free", "bundle", "business"] },
  { icon: Radar, plans: ["bundle", "business"] },
  { icon: FileText, plans: ["bundle", "business"] },
  { icon: Zap, plans: ["bundle", "business"] },
  { icon: Users, plans: ["business"] },
  { icon: Receipt, plans: ["business"] },
];

// Pick a plan, see what each one includes, then confirm. Matches the Settings sheet.
export function PlansSheet({ open, plan, language, highlight, recommended, reason, onChoose, onClose }: { open: boolean; plan: Plan; language: Language; highlight?: Plan; recommended: Plan; reason?: Feature; onChoose: (plan: Plan) => void; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const suggested = highlight ?? recommended;
  const [picked, setPicked] = useState<Plan>(plan);
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open) setPicked(suggested !== plan ? suggested : plan);
    if (open && !element.open) element.showModal();
    if (!open && element.open) element.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const c = PLAN_COPY[language];
  const sheet = SHEET[language];
  return (
    <dialog
      ref={dialog}
      aria-label={c.title}
      onClose={onClose}
      className="m-0 mx-auto mt-auto max-h-[92dvh] w-full max-w-[640px] overflow-y-auto overscroll-contain rounded-t-2xl bg-card p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-foreground shadow-2xl outline-none backdrop:bg-black/40 sm:my-auto sm:rounded-2xl sm:pb-5"
    >
      <div className="grid gap-4">
        <div className="flex items-center justify-between">
          {/* Focus starts on the title, so the close button doesn't open with a focus ring. */}
          <h2 tabIndex={-1} autoFocus className="flex items-center gap-2.5 text-base font-bold tracking-tight outline-none">
            <span className="flex size-9 items-center justify-center rounded-full bg-accent">
              <Crown className="size-4" aria-hidden />
            </span>
            {c.title}
          </h2>
          <button type="button" onClick={onClose} aria-label="Close" className="flex size-9 items-center justify-center rounded-full text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
            <X className="size-4" aria-hidden />
          </button>
        </div>

        {reason && (
          <p className="flex items-center gap-2 rounded-full bg-success-soft px-3.5 py-2 text-sm font-medium text-success">
            <LockOpen className="size-4 shrink-0" aria-hidden />
            {c.locked[reason]}
          </p>
        )}

        <div role="radiogroup" aria-label={c.title} className="grid grid-cols-3 gap-2">
          {PLANS.map((id) => {
            const Icon = ICON[id];
            const selected = picked === id;
            return (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setPicked(id)}
                className={cn(
                  "relative grid justify-items-center gap-1 rounded-2xl border px-2 pt-4 pb-2.5 text-center transition-all",
                  selected ? "border-foreground bg-accent shadow-sm" : "border-border-strong hover:bg-accent",
                )}
              >
                {(id === plan || id === suggested) && (
                  <span className={cn("absolute -top-2.5 rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase", id === plan ? "bg-foreground text-background" : "bg-success text-background")}>
                    {id === plan ? c.current : (
                      <span className="flex items-center gap-1">
                        <Star className="size-3 fill-current" aria-hidden />
                        {c.recommended.split(" ")[0]}
                      </span>
                    )}
                  </span>
                )}
                <span className={cn("flex size-9 items-center justify-center rounded-full", selected ? "bg-card" : "bg-accent")} aria-hidden>
                  <Icon className="size-4" />
                </span>
                <span className="text-sm font-semibold">{sheet.names[id]}</span>
                <span className="text-xl leading-none font-bold tabular-nums">{sheet.prices[id]}</span>
                <span className="text-[11px] text-muted-foreground">{sheet.units[id]}</span>
              </button>
            );
          })}
        </div>

        <div className="grid divide-y divide-border rounded-2xl border border-border">
          <div className="grid grid-cols-[1fr_repeat(3,3.25rem)] items-center gap-1 px-3 py-2 sm:grid-cols-[1fr_repeat(3,4.5rem)]">
            <span />
            {PLANS.map((id) => (
              <span key={id} className="flex justify-center" title={sheet.names[id]}>
                {(() => {
                  const Icon = ICON[id];
                  return (
                    <span className={cn("flex size-7 items-center justify-center rounded-full", picked === id ? "bg-foreground text-background" : "bg-accent text-muted-foreground")}>
                      <Icon className="size-3.5" aria-label={sheet.names[id]} />
                    </span>
                  );
                })()}
              </span>
            ))}
          </div>
          {ROWS.map((row, index) => {
            const RowIcon = row.icon;
            return (
              <div key={index} className="grid grid-cols-[1fr_repeat(3,3.25rem)] items-center gap-1 px-3 py-2 sm:grid-cols-[1fr_repeat(3,4.5rem)]">
                <span className="flex min-w-0 items-center gap-2.5 text-sm font-medium">
                  <RowIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="truncate">{sheet.rows[index]}</span>
                </span>
                {PLANS.map((id) => (
                  <span key={id} className="flex justify-center">
                    {row.plans.includes(id) ? (
                      <span className={cn("flex size-6 items-center justify-center rounded-full", picked === id ? "bg-success text-background" : "text-success")}>
                        <Check className="size-3.5" strokeWidth={3} aria-label={sheet.names[id]} />
                      </span>
                    ) : (
                      <Minus className="size-4 text-muted-foreground/40" aria-label={`${sheet.names[id]}: —`} />
                    )}
                  </span>
                ))}
              </div>
            );
          })}
        </div>

        {/* Pinned to the bottom, so the choice stays in reach on short screens. */}
        <div className="sticky -bottom-5 -mx-5 -mb-5 grid gap-2 bg-card px-5 pt-2 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:pb-5">
        <button
          type="button"
          disabled={picked === plan}
          onClick={() => onChoose(picked)}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-base font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {picked === plan ? c.current : `${sheet.switchTo} ${sheet.names[picked]} · ${sheet.prices[picked]}`}
        </button>
        <p className="text-center text-xs text-muted-foreground">{sheet.demo}</p>
        </div>
      </div>
    </dialog>
  );
}

const ROW_TEXT: Record<Language, { label: string; change: string }> = {
  en: { label: "Plan", change: "Change" },
  fi: { label: "Paketti", change: "Vaihda" },
  sv: { label: "Paket", change: "Byt" },
};
export const planLabel = (language: Language) => ROW_TEXT[language].label;

// The current plan with a button that opens the plans sheet. Used in Settings and the profile.
export function PlanRow({ plan, language, onChange }: { plan: Plan; language: Language; onChange: () => void }) {
  const Icon = ICON[plan];
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex min-w-0 items-center gap-2 text-sm font-semibold">
        <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-full", plan === "free" ? "bg-accent" : "bg-success-soft text-success")} aria-hidden>
          <Icon className="size-3.5" />
        </span>
        <span className="truncate">{PLAN_COPY[language].plans[plan].name}</span>
      </span>
      <button type="button" onClick={onChange} className="inline-flex min-h-9 shrink-0 items-center rounded-lg border border-border-strong px-3 text-sm font-medium hover:bg-accent">
        {ROW_TEXT[language].change}
      </button>
    </div>
  );
}
