import { randomUUID } from "node:crypto";
import type { Case } from "../engine/case";

// In-memory sessions: nothing is written to disk, and data is gone when a session ends.
type Session = { item: Case; asked: number; touched: number; extractedBy: string; secretFound: boolean };

const TTL_MS = Number(process.env.SESSION_TTL_MINUTES ?? 30) * 60_000;
const sessions = new Map<string, Session>();

function sweep(now: number) {
  for (const [id, session] of sessions) {
    if (now - session.touched > TTL_MS) sessions.delete(id);
  }
}

export function createSession(session: Omit<Session, "touched">): string {
  const now = Date.now();
  sweep(now);
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
