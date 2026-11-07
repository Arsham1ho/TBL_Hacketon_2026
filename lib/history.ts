import type { ApiResponse } from "../engine/screens";
import type { Audience, Language, Status } from "../engine/types";

// Past chats, kept only in this browser. Nothing here is sent anywhere. Messages are stored
// exactly as the chat shows them, which already has codes and passwords masked.

export type HistoryItem = { from: "user" | "safestep"; text: string; assessment?: ApiResponse["state"] };

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
