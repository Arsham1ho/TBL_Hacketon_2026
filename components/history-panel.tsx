"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Building2, FileText, History, MessageSquareText, Mic, MessageSquareReply, SquarePen, Trash, X } from "lucide-react";
import type { Language, Status } from "@/engine/types";
import { clearHistory, deleteConversation, loadHistory, type Conversation } from "@/lib/history";
import { cn } from "@/lib/utils";
import type { Translate } from "@/lib/ui-text";
import { AssessmentNote, PastItem } from "./turns";
import { Btn, StatusLabel } from "./ui";

// The same column as the live chat.
const COLUMN = "mx-auto w-full max-w-[640px] px-4";

const LOCALE: Record<Language, string> = { en: "en-GB", fi: "fi-FI", sv: "sv-FI" };
const time = (at: number, language: Language) => new Intl.DateTimeFormat(LOCALE[language], { hour: "2-digit", minute: "2-digit" }).format(at);
const day = (at: number, language: Language) => new Intl.DateTimeFormat(LOCALE[language], { day: "numeric", month: "short" }).format(at);
const startOfDay = (at: number) => new Date(at).setHours(0, 0, 0, 0);

// "17:07" today, "Yesterday" before that, then the date.
function when(at: number, language: Language, t: Translate) {
  const today = startOfDay(Date.now());
  if (at >= today) return time(at, language);
  if (at >= today - 86_400_000) return t("historyYesterday");
  return day(at, language);
}

// Today, Yesterday and Earlier, newest first.
function groups(list: Conversation[], t: Translate): [string, Conversation[]][] {
  const today = startOfDay(Date.now());
  const buckets: [string, Conversation[]][] = [
    [t("historyToday"), list.filter((item) => item.updatedAt >= today)],
    [t("historyYesterday"), list.filter((item) => item.updatedAt < today && item.updatedAt >= today - 86_400_000)],
    [t("historyEarlier"), list.filter((item) => item.updatedAt < today - 86_400_000)],
  ];
  return buckets.filter(([, items]) => items.length > 0);
}

// A greeting such as "hi" says nothing about the case, so the title is the scam type if one
// was found, else the first message with some substance, and the preview is what follows.
function describe(conversation: Conversation) {
  const said = conversation.items.filter((item) => item.from === "user" && !item.assessment).map((item) => item.text);
  const substantial = said.find((text) => text.trim().split(/\s+/).length >= 3) ?? said[0] ?? conversation.title;
  const title = conversation.likelyType || substantial;
  const preview = conversation.likelyType ? substantial : (said.find((text) => text !== substantial && text.trim().split(/\s+/).length >= 3) ?? "");
  return { title, preview };
}

// The status as a small dot in its colour, beside plain text, as in the rest of the app.
const STATUS_DOT: Record<Status, string> = {
  safe: "bg-success",
  needs_verification: "bg-warning",
  threat_in_progress: "bg-destructive",
  incident_occurred: "bg-danger-deep",
};

function HistoryCard({ conversation, t, language, onOpen, onDelete }: { conversation: Conversation; t: Translate; language: Language; onOpen: () => void; onDelete: () => void }) {
  const { title, preview } = describe(conversation);
  return (
    <li className="relative">
      <button type="button" onClick={onOpen} className="grid w-full gap-0.5 px-3.5 py-3 pr-12 text-left transition-colors hover:bg-accent/60 focus-visible:bg-accent/60">
        <span className="truncate font-medium">{title}</span>
        {preview && <span className="truncate text-sm text-muted-foreground">{preview}</span>}
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {conversation.voice && <Mic className="size-3" aria-label={t("voiceChat")} />}
          {conversation.audience === "small_business" && <Building2 className="size-3" aria-hidden />}
          {when(conversation.updatedAt, language, t)}
          {conversation.status && conversation.statusLabel && (
            <>
              <span aria-hidden>·</span>
              <span className={cn("size-1.5 rounded-full", STATUS_DOT[conversation.status])} aria-hidden />
              {conversation.statusLabel}
            </>
          )}
        </span>
      </button>
      <button
        type="button"
        onClick={onDelete}
        aria-label={`${t("deleteChat")}: ${title}`}
        title={t("deleteChat")}
        className="absolute top-1/2 right-2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-danger-soft hover:text-destructive"
      >
        <Trash className="size-4" aria-hidden />
      </button>
    </li>
  );
}

// Past chats saved in this browser: a bottom sheet on phones, a drawer from the left on desktop.
// A saved chat opens as a read-only transcript; the live session behind it has already ended.
export function HistoryPanel({ open, onClose, onNewChat, onContinue, onOpenReport, activeId, t, language }: { open: boolean; onClose: () => void; onNewChat: () => void; onContinue: (conversation: Conversation) => void; onOpenReport: (report: NonNullable<Conversation["report"]>) => void; activeId?: string | null; t: Translate; language: Language }) {
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

  // A saved chat opens full page, laid out like the live chat. Back returns to the list.
  if (selected) {
    const { title } = describe(selected);
    return (
      <div role="dialog" aria-modal="true" aria-label={title} className="fixed inset-0 z-50 flex flex-col bg-background text-foreground motion-safe:animate-[fade-up_.25s_ease-out]">
        <header className="border-b border-border pt-[env(safe-area-inset-top)]">
          <div className={cn(COLUMN, "flex items-center gap-2 py-3")}>
            <button type="button" onClick={() => setSelected(null)} aria-label={t("back")} className="flex size-10 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground">
              <ArrowLeft className="size-5" aria-hidden />
            </button>
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-base font-bold">{title}</h2>
              <p className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                {selected.voice && <Mic className="size-3" aria-label={t("voiceChat")} />}
                {selected.audience === "small_business" && <Building2 className="size-3" aria-hidden />}
                {`${day(selected.startedAt, language)}, ${time(selected.startedAt, language)}`}
              </p>
            </div>
            {/* A finished chat keeps its decision report. */}
            {selected.report && (
              <button type="button" onClick={() => onOpenReport(selected.report!)} className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border border-border-strong px-3 text-sm font-medium hover:bg-accent">
                <FileText className="size-4" aria-hidden />
                {t("viewReport")}
              </button>
            )}
            <button type="button" onClick={onClose} aria-label={t("close")} className="flex size-10 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground">
              <X className="size-5" aria-hidden />
            </button>
          </div>
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <div className={cn(COLUMN, "py-6")}>
            <Transcript conversation={selected} t={t} />
          </div>
        </main>
        <footer className="border-t border-border pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {/* Review it here, carry on with it, or start something new. */}
          <div className={cn(COLUMN, "flex items-center gap-2 pt-3")}>
            <Btn onClick={onNewChat} className="min-h-11 flex-1 gap-2 text-sm">
              <SquarePen className="size-4" aria-hidden />
              {t("newChat")}
            </Btn>
            <Btn variant="primary" onClick={() => onContinue(selected)} className="min-h-11 flex-1 gap-2 text-sm">
              <MessageSquareReply className="size-4" aria-hidden />
              {t(selected.id === activeId ? "backToChat" : "continueChat")}
            </Btn>
          </div>
        </footer>
      </div>
    );
  }

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
          <span className="flex size-10 items-center justify-center rounded-full bg-accent" aria-hidden>
            <History className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-base font-bold">{t("history")}</h2>
            <p className="truncate text-xs text-muted-foreground">{t("historySaved")}</p>
          </div>
          <button type="button" onClick={onClose} aria-label={t("close")} className="flex size-10 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground">
            <X className="size-5" aria-hidden />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {list.length === 0 ? (
            <div className="grid justify-items-center gap-3 py-12 text-center">
              <span className="flex size-14 items-center justify-center rounded-full bg-accent text-muted-foreground" aria-hidden>
                <MessageSquareText className="size-6" />
              </span>
              <p className="max-w-[240px] text-sm text-muted-foreground">{t("historyEmpty")}</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {groups(list, t).map(([label, items]) => (
                <section key={label} className="grid gap-1.5">
                  <h3 className="px-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{label}</h3>
                  <ul className="grid divide-y divide-border overflow-hidden rounded-2xl border border-border">
                    {items.map((conversation) => (
                      <HistoryCard
                        key={conversation.id}
                        conversation={conversation}
                        t={t}
                        language={language}
                        onOpen={() => setSelected(conversation)}
                        onDelete={() => {
                          deleteConversation(conversation.id);
                          setList(loadHistory());
                        }}
                      />
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </div>

        {/* Laid out like the Options footer: the destructive action left, the main one right. */}
        <footer className="flex items-center justify-between gap-2 border-t border-border px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {list.length > 0 ? (
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
          ) : (
            <span />
          )}
          <Btn variant="primary" onClick={onNewChat} className="min-h-10 gap-2 px-5 text-sm">
            <SquarePen className="size-4" aria-hidden />
            {t("newChat")}
          </Btn>
        </footer>
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
          <PastItem key={index} item={item} open t={t} />
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
