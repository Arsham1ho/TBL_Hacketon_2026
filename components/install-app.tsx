"use client";

import { useEffect, useRef, useState } from "react";
import { Download, Share, SquarePlus, X } from "lucide-react";
import type { Language } from "@/engine/types";

// Chrome, Edge and Android fire this event when the app can be installed.
type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

const COPY: Record<Language, { install: string; title: string; body: string; later: string; step1: string; step2: string; done: string }> = {
  en: { install: "Install", title: "Install SafeStep", body: "Keep it on your home screen for quick help when something looks wrong.", later: "Not now", step1: "Tap Share in the browser bar", step2: "Choose Add to Home Screen", done: "Got it" },
  fi: { install: "Asenna", title: "Asenna SafeStep", body: "Pidä se aloitusnäytöllä, niin apu on lähellä, kun jokin näyttää oudolta.", later: "Ei nyt", step1: "Napauta Jaa-painiketta selaimen palkissa", step2: "Valitse Lisää Koti-valikkoon", done: "Selvä" },
  sv: { install: "Installera", title: "Installera SafeStep", body: "Ha den på hemskärmen för snabb hjälp när något verkar fel.", later: "Inte nu", step1: "Tryck på Dela i webbläsarens fält", step2: "Välj Lägg till på hemskärmen", done: "Okej" },
};

// Shown once per device: the first visit marks it as seen, whatever the user does.
const SEEN_KEY = "safestep-install-offered";
const alreadyOffered = () => {
  try {
    return localStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return true;
  }
};
const markOffered = () => {
  try {
    localStorage.setItem(SEEN_KEY, "1");
  } catch {}
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

// A one-time notification on the first visit. Install opens the browser's prompt, or the
// Share → Add to Home Screen steps on iPhone and iPad. It never comes back after that.
export function InstallPrompt({ language }: { language: Language }) {
  const c = COPY[language];
  const [prompt, setPrompt] = useState<InstallEvent | null>(null);
  const [showIos, setShowIos] = useState(false);
  const [available, setAvailable] = useState<"prompt" | "ios" | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);

  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (standalone() || alreadyOffered()) return;
    const offer = (kind: "prompt" | "ios") => {
      setAvailable(kind);
      setOpen(true);
      markOffered();
    };
    // Give the first screen a moment before offering.
    const timer = ios() ? window.setTimeout(() => offer("ios"), 1500) : undefined;
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallEvent);
      offer("prompt");
    };
    const onInstalled = () => setAvailable(null);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      if (timer) window.clearTimeout(timer);
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

  if (!available || (!open && !showIos)) return null;

  async function install() {
    setOpen(false);
    if (available === "ios") return setShowIos(true);
    if (!prompt) return;
    await prompt.prompt();
    await prompt.userChoice;
    setPrompt(null);
  }

  return (
    <>
      {open && (
        <div role="dialog" aria-label={c.title} className="fixed inset-x-0 top-[max(3.75rem,calc(env(safe-area-inset-top)+3.25rem))] z-50 mx-auto w-[calc(100%-2rem)] max-w-[420px] motion-safe:animate-[fade-up_.35s_ease-out]">
          <div className="flex items-start gap-3 rounded-2xl border border-border-strong bg-card p-3.5 shadow-xl">
            <img src="/icons/icon-192.png" alt="" className="size-10 shrink-0 rounded-xl ring-1 ring-border" />
            <div className="grid min-w-0 flex-1 gap-2">
              <div className="grid gap-0.5">
                <p className="text-sm font-semibold">{c.title}</p>
                <p className="text-xs leading-snug text-muted-foreground">{c.body}</p>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => void install()} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-primary px-3.5 text-sm font-medium text-primary-foreground hover:opacity-90">
                  <Download className="size-4" aria-hidden />
                  {c.install}
                </button>
                <button type="button" onClick={() => setOpen(false)} className="inline-flex min-h-9 items-center rounded-lg px-3 text-sm font-medium text-muted-foreground hover:bg-accent">
                  {c.later}
                </button>
              </div>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label={c.later} className="flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-accent">
              <X className="size-4" aria-hidden />
            </button>
          </div>
        </div>
      )}
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
