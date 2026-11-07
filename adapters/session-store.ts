import { randomUUID } from "node:crypto";
import type { Case } from "../engine/case";

// In-memory sessions: nothing is written to disk, and data is gone when a session ends.
type Session = { item: Case; asked: number; touched: number; extractedBy: string; secretFound: boolean };

const MAX_SESSIONS = 1_000;
const ttlMinutes = Number(process.env.SESSION_TTL_MINUTES);
const TTL_MS = (Number.isFinite(ttlMinutes) && ttlMinutes > 0 ? ttlMinutes : 30) * 60_000;

// Kept on globalThis so a hot reload in development doesn't drop open sessions.
const store = globalThis as typeof globalThis & { safestepSessions?: Map<string, Session> };
const sessions = (store.safestepSessions ??= new Map<string, Session>());

function sweep(now: number) {
  for (const [id, session] of sessions) {
    if (now - session.touched > TTL_MS) sessions.delete(id);
  }
}

export function createSession(session: Omit<Session, "touched">): string {
  const now = Date.now();
  sweep(now);
  if (sessions.size >= MAX_SESSIONS) {
    const oldest = sessions.keys().next().value;
    if (oldest) sessions.delete(oldest);
  }
  const id = randomUUID();
  sessions.set(id, { ...session, touched: now });
  return id;
}

export function getSession(id: string): Session | null {
  const now = Date.now();
  sweep(now);
  const session = sessions.get(id) ?? null;
  if (session) session.touched = now;
  return session;
}

export function endSession(id: string): void {
  sessions.delete(id);
}
