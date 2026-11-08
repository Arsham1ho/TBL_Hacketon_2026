import { randomUUID } from "node:crypto";
import type { Case } from "../engine/case";
import type { Journey } from "../engine/handle-event";
import { sealJourney, unsealJourney } from "./session-seal";

// In-memory sessions: nothing is written to disk, and data is gone when a session ends.
type Session = { item: Case; asked: number; touched: number; extractedBy: string; secretFound: boolean; journey?: Journey | null };

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

// The token is the encrypted copy the client sends back. It is used only when this instance
// doesn't have the session in memory, for example when a serverless host routed the
// previous request to another instance.
export function getSession(id: string, token?: unknown): Session | null {
  const now = Date.now();
  sweep(now);
  let session = sessions.get(id) ?? null;
  if (!session && token) {
    const journey = unsealJourney(id, token);
    if (journey) {
      session = { item: journey.item, asked: journey.asked, extractedBy: "", secretFound: journey.secretFound, journey, touched: now };
      sessions.set(id, session);
    }
  }
  if (session) session.touched = now;
  return session;
}

// The encrypted copy of the session's current state, to send back to the client.
export function sessionToken(id: string): string | undefined {
  const journey = sessions.get(id)?.journey;
  return journey ? sealJourney(id, journey, TTL_MS) : undefined;
}

export function endSession(id: string): void {
  sessions.delete(id);
}

export function createJourneySession(journey: Journey): string {
  const now = Date.now();
  sweep(now);
  const id = randomUUID();
  sessions.set(id, { item: journey.item, asked: journey.asked, extractedBy: "", secretFound: journey.secretFound, journey, touched: now });
  return id;
}
