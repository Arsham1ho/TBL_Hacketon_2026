"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Building2, History, MessageSquareText, Trash, User, X } from "lucide-react";
import type { Language } from "@/engine/types";
import { clearHistory, deleteConversation, loadHistory, type Conversation } from "@/lib/history";
import type { Translate } from "@/lib/ui-text";
import { AssessmentNote } from "./turns";
import { StatusLabel } from "./ui";

const LOCALE: Record<Language, string> = { en: "en-GB", fi: "fi-FI", sv: "sv-FI" };
const when = (time: number, language: Language) =>
  new Intl.DateTimeFormat(LOCALE[language], { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(time);

// Past chats saved in this browser: a bottom sheet on phones, a drawer from the left on desktop.
// A saved chat opens as a read-only transcript; the live session behind it has already ended.
export function HistoryPanel({ open, onClose, t, language }: { open: boolean; onClose: () => void; t: Translate; language: Language }) {
  const [list, setList] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState<Conversation | null>(null);

  useEffect(() => {
    if (!open) return;
    setList(loadHistory());
    setSelected(null);
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("history")}
      onClick={(event) => event.target === event.currentTarget && onClose()}
      className="fixed inset-0 z-50 flex items-end bg-black/40 backdrop-blur-xs sm:items-stretch sm:justify-start"
    >
      <div className="flex max-h-[88dvh] w-full flex-col overflow-hidden rounded-t-[28px] border-t border-border bg-card text-foreground shadow-2xl motion-safe:animate-[sheet-up_.32s_cubic-bezier(.2,.9,.3,1)] sm:max-h-none sm:w-[400px] sm:rounded-none sm:rounded-r-3xl sm:border-t-0 sm:border-r sm:motion-safe:animate-[drawer-in_.3s_cubic-bezier(.2,.9,.3,1)]">
        <div className="flex justify-center pt-2 sm:hidden" aria-hidden>
          <span className="h-1.5 w-10 rounded-full bg-border-strong" />
        </div>

        <header className="flex items-center gap-2 border-b border-border px-4 py-3 sm:pt-[max(0.75rem,env(safe-area-inset-top))]">
          {selected ? (
            <button type="button" onClick={() => setSelected(null)} aria-label={t("back")} className="flex size-10 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground">
              <ArrowLeft className="size-5" aria-hidden />
            </button>
          ) : (
            <span className="flex size-10 items-center justify-center rounded-full bg-accent" aria-hidden>
              <History className="size-5" />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-base font-bold">{selected ? selected.title : t("history")}</h2>
            <p className="truncate text-xs text-muted-foreground">{selected ? when(selected.startedAt, language) : t("historySaved")}</p>
          </div>
          <button type="button" onClick={onClose} aria-label={t("close")} className="flex size-10 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground">
            <X className="size-5" aria-hidden />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {selected ? (
            <Transcript conversation={selected} t={t} />
          ) : list.length === 0 ? (
            <div className="grid justify-items-center gap-3 py-12 text-center">
              <span className="flex size-14 items-center justify-center rounded-full bg-accent text-muted-foreground" aria-hidden>
                <MessageSquareText className="size-6" />
              </span>
              <p className="max-w-[240px] text-sm text-muted-foreground">{t("historyEmpty")}</p>
            </div>
          ) : (
            <ul className="grid gap-2">
              {list.map((conversation) => (
                <li key={conversation.id} className="group relative">
                  <button
                    type="button"
                    onClick={() => setSelected(conversation)}
                    className="grid w-full gap-1.5 rounded-2xl border border-border-strong bg-card p-3.5 pr-12 text-left transition-colors hover:bg-accent/50 active:scale-[.99]"
                  >
                    <span className="line-clamp-2 leading-snug font-semibold">{conversation.title}</span>
                    <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        {conversation.audience === "small_business" ? <Building2 className="size-3.5" aria-hidden /> : <User className="size-3.5" aria-hidden />}
                        {when(conversation.updatedAt, language)}
                      </span>
                      {conversation.status && conversation.statusLabel && (
                        <span className="[&_p]:text-xs">
                          <StatusLabel status={conversation.status} label={conversation.statusLabel} />
                        </span>
                      )}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      deleteConversation(conversation.id);
                      setList(loadHistory());
                    }}
                    aria-label={`${t("deleteChat")}: ${conversation.title}`}
                    title={t("deleteChat")}
                    className="absolute top-2.5 right-2.5 flex size-9 items-center justify-center rounded-full text-muted-foreground hover:bg-danger-soft hover:text-destructive"
                  >
                    <Trash className="size-4" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {!selected && list.length > 0 && (
          <footer className="border-t border-border px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <button
              type="button"
              onClick={() => {
                clearHistory();
                setList([]);
              }}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-destructive hover:bg-danger-soft"
            >
              <Trash className="size-4" aria-hidden />
              {t("clearHistory")}
            </button>
          </footer>
        )}
      </div>
    </div>
  );
}

// The saved chat, drawn like the live one.
function Transcript({ conversation, t }: { conversation: Conversation; t: Translate }) {
  return (
    <div className="grid gap-3 leading-relaxed">
      {conversation.items.map((item, index) =>
        item.assessment ? (
          <AssessmentNote key={index} state={item.assessment} t={t} />
        ) : item.from === "user" ? (
          <p key={index} className="ml-auto max-w-[85%] rounded-2xl rounded-br-sm bg-accent px-3.5 py-2">
            {item.text}
          </p>
        ) : (
          <p key={index} className="flex max-w-[92%] items-start gap-2.5 text-sm text-muted-foreground">
            <span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-border-strong" aria-hidden />
            {item.text}
          </p>
        ),
      )}
      {conversation.status && conversation.statusLabel && (
        <div className="mt-1 grid gap-1 rounded-2xl border border-border-strong p-3">
          <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{t("aiAssessment")}</span>
          <StatusLabel status={conversation.status} label={conversation.statusLabel} />
          {conversation.likelyType && <span className="text-sm font-medium">{conversation.likelyType}</span>}
        </div>
      )}
    </div>
  );
}
