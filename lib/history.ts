import type { ApiResponse } from "../engine/screens";
import type { Xray } from "../engine/xray";
import type { DecisionReport } from "../engine/report";
import type { LinkCheck } from "../engine/link-check";
import type { Audience, Language, Risk, Status } from "../engine/types";

// Past chats, kept only in this browser. Nothing here is sent anywhere. Messages are stored
// exactly as the chat shows them, which already has codes and passwords masked.

// kind and detail keep what SafeStep showed, not just its title: a question with its context,
// an action step, or a card with its lines, so History can show the whole conversation.
export type HistoryItem = { from: "user" | "safestep"; text: string; assessment?: ApiResponse["state"]; kind?: "question" | "step" | "card"; detail?: string[]; link?: LinkCheck; xray?: Xray; safety?: boolean };

// What SafeStep said before a reply: plain text, or the text with its kind and lines.
export type Recap = string | { text: string; kind?: HistoryItem["kind"]; detail?: string[] };

export function recapItem(recap: Recap): HistoryItem {
  if (typeof recap === "string") return { from: "safestep", text: recap };
  const detail = recap.detail?.map((line) => line.trim()).filter(Boolean);
  return { from: "safestep", text: recap.text, ...(recap.kind ? { kind: recap.kind } : {}), ...(detail?.length ? { detail } : {}) };
}

export const recapText = (recap: Recap) => (typeof recap === "string" ? recap : recap.text);

// The decision report saved with a finished chat, plus the risk after each update in the chat.
export type SavedReport = DecisionReport & { timeline: Risk[] };

export type Conversation = {
  id: string;
  startedAt: number;
  updatedAt: number;
  audience: Audience;
  language: Language;
  title: string;
  items: HistoryItem[];
  // The latest assessment, for the list and the end of the transcript.
  status?: Status;
  statusLabel?: string;
  likelyType?: string | null;
  // Held in voice mode rather than typed.
  voice?: boolean;
  // Saved when the chat is finished, so the report can be opened again from History.
  report?: SavedReport;
};

const KEY = "safestep-history";
// Enough to look back over, small enough to stay well inside browser storage.
const MAX = 30;

export function loadHistory(): Conversation[] {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

function write(list: Conversation[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
  } catch {
    // Private mode or full storage: the chat still works, it just isn't remembered.
  }
}

// Adds or updates a chat, newest first.
export function saveConversation(conversation: Conversation) {
  write([conversation, ...loadHistory().filter((item) => item.id !== conversation.id)]);
}

export function deleteConversation(id: string) {
  write(loadHistory().filter((item) => item.id !== id));
}

export function clearHistory() {
  try {
    localStorage.removeItem(KEY);
  } catch {}
}

export const newConversationId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
