"use client";

import { useEffect, useRef } from "react";
import { EyeOff, LogOut, MonitorSmartphone, Phone, ShieldAlert, Trash2, Users } from "lucide-react";
import type { Language } from "@/engine/types";
import type { Translate } from "@/lib/ui-text";

// Discreet mode, for when someone close may be watching the device. The chat isn't saved,
// the tab title looks ordinary, and one tap or Esc twice leaves for a neutral page.

const NEUTRAL: Record<Language, string> = {
  fi: "https://www.google.com/search?q=s%C3%A4%C3%A4",
  en: "https://www.google.com/search?q=weather",
  sv: "https://www.google.com/search?q=v%C3%A4der",
};

export function neutralUrl(language: Language) {
  return NEUTRAL[language];
}

// Esc pressed twice within a second leaves at once, from anywhere on the page.
export function useQuickExit(active: boolean, exit: () => void) {
  const last = useRef(0);
  const run = useRef(exit);
  run.current = exit;
  useEffect(() => {
    if (!active) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      const now = Date.now();
      if (now - last.current < 1000) run.current();
      last.current = now;
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active]);
}

// The tab shows an ordinary title while discreet mode is on.
export function useDisguisedTitle(active: boolean, title: string) {
  useEffect(() => {
    if (!active) return;
    const original = document.title;
    document.title = title;
    return () => {
      document.title = original;
    };
  }, [active, title]);
}

export function QuickExitButton({ onExit, t }: { onExit: () => void; t: Translate }) {
  return (
    <button
      type="button"
      onClick={onExit}
      title={t("quickExitHint")}
      className="fixed top-[max(0.5rem,env(safe-area-inset-top))] left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full bg-destructive px-4 py-2 text-sm font-semibold text-background shadow-lg hover:opacity-90 focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 focus-visible:outline-none"
    >
      <LogOut className="size-4" aria-hidden />
      {t("quickExit")}
    </button>
  );
}

export function SafetyCard({ t }: { t: Translate }) {
  const rows = [
    { icon: EyeOff, text: t("safetyExit") },
    { icon: Trash2, text: t("safetyNotSaved") },
    { icon: ShieldAlert, text: t("safetyDontRemove") },
    { icon: MonitorSmartphone, text: t("safetyOtherDevice") },
    { icon: Users, text: t("safetySupport") },
  ];
  return (
    <section aria-labelledby="safety-title" className="grid gap-3 rounded-2xl border-2 border-destructive/40 bg-card p-4 motion-safe:animate-[fade-up_.35s_ease-out]">
      <h2 id="safety-title" className="flex items-center gap-2.5 text-base font-semibold">
        <span className="flex size-9 items-center justify-center rounded-full bg-danger-soft text-destructive" aria-hidden>
          <ShieldAlert className="size-5" />
        </span>
        {t("safetyTitle")}
      </h2>
      <ul className="grid gap-2">
        {rows.map(({ icon: Icon, text }) => (
          <li key={text} className="flex items-start gap-2.5 text-[15px] leading-snug">
            <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
            {text}
          </li>
        ))}
      </ul>
      <a href="tel:112" className="flex items-center justify-center gap-2 rounded-full bg-destructive px-4 py-2.5 text-sm font-semibold text-background">
        <Phone className="size-4" aria-hidden />
        {t("safetyDanger")}
      </a>
    </section>
  );
}
