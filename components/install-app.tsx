"use client";

import { useEffect, useRef, useState } from "react";
import { Download, Share, SquarePlus, X } from "lucide-react";
import type { Language } from "@/engine/types";

// Chrome, Edge and Android fire this event when the app can be installed.
type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

const COPY: Record<Language, { install: string; title: string; step1: string; step2: string; done: string }> = {
  en: { install: "Install app", title: "Install SafeStep", step1: "Tap Share in the browser bar", step2: "Choose Add to Home Screen", done: "Got it" },
  fi: { install: "Asenna sovellus", title: "Asenna SafeStep", step1: "Napauta Jaa-painiketta selaimen palkissa", step2: "Valitse Lisää Koti-valikkoon", done: "Selvä" },
  sv: { install: "Installera appen", title: "Installera SafeStep", step1: "Tryck på Dela i webbläsarens fält", step2: "Välj Lägg till på hemskärmen", done: "Okej" },
};

const standalone = () => window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
const ios = () => /iphone|ipad|ipod/iu.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

// Registers the service worker once, in production only, so development never serves stale code.
export function useServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
  }, []);
}

// One tap to install where the browser supports it; Share → Add to Home Screen steps on iOS.
export function InstallButton({ language }: { language: Language }) {
  const c = COPY[language];
  const [prompt, setPrompt] = useState<InstallEvent | null>(null);
  const [showIos, setShowIos] = useState(false);
  const [available, setAvailable] = useState<"prompt" | "ios" | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (standalone()) return;
    if (ios()) setAvailable("ios");
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallEvent);
      setAvailable("prompt");
    };
    const onInstalled = () => setAvailable(null);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (showIos && !element.open) element.showModal();
    if (!showIos && element.open) element.close();
  }, [showIos]);

  if (!available) return null;

  async function install() {
    if (available === "ios") return setShowIos(true);
    if (!prompt) return;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === "accepted") setAvailable(null);
    setPrompt(null);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => void install()}
        title={c.install}
        aria-label={c.install}
        className="inline-flex items-center gap-1.5 rounded-full border border-border-strong bg-card/90 px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-xs hover:bg-accent hover:text-foreground"
      >
        <Download className="size-3.5" aria-hidden />
        <span className="hidden sm:inline">{c.install}</span>
      </button>
      <dialog
        ref={dialog}
        aria-label={c.title}
        onClose={() => setShowIos(false)}
        className="m-0 mx-auto mt-auto w-full max-w-[420px] rounded-t-2xl bg-card p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-foreground shadow-2xl outline-none backdrop:bg-black/40 sm:my-auto sm:rounded-2xl"
      >
        <div className="grid gap-4">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2.5 text-base font-bold">
              <img src="/icons/icon-192.png" alt="" className="size-9 rounded-xl ring-1 ring-border" />
              {c.title}
            </h2>
            <button type="button" onClick={() => setShowIos(false)} aria-label={c.done} className="flex size-9 items-center justify-center rounded-full text-muted-foreground hover:bg-accent">
              <X className="size-4" aria-hidden />
            </button>
          </div>
          <ol className="grid gap-2">
            <li className="flex items-center gap-3 rounded-xl bg-accent p-3 text-sm font-medium">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-card"><Share className="size-4" aria-hidden /></span>
              {c.step1}
            </li>
            <li className="flex items-center gap-3 rounded-xl bg-accent p-3 text-sm font-medium">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-card"><SquarePlus className="size-4" aria-hidden /></span>
              {c.step2}
            </li>
          </ol>
          <button type="button" onClick={() => setShowIos(false)} className="inline-flex min-h-12 items-center justify-center rounded-lg bg-primary px-4 text-base font-medium text-primary-foreground hover:opacity-90">
            {c.done}
          </button>
        </div>
      </dialog>
    </>
  );
}
