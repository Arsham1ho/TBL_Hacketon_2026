import { randomUUID } from "node:crypto";
import type { HandoffDetails, SupportRoute } from "../engine/screens";
import type { Audience, Destination, Language, Risk, Status, Urgency } from "../engine/types";

// Simulated DNA agent queue. A case enters only after the user approves the handoff, and it
// holds only the reviewed summary: no raw messages, no session id exposed, no secrets.
export type CaseStatus = "new" | "accepted" | "resolved";

// System events are stored as codes so each side can show them in its own language.
export type CaseMessage = { id: string; at: number } & ({ from: "agent" | "customer"; text: string; masked?: boolean } | { from: "system"; event: "joined" | "resolved" | "reopened"; name: string });

export type AgentCase = {
  caseId: string;
  createdAt: number;
  updatedAt: number;
  caseStatus: CaseStatus;
  agentName: string | null;
  route: SupportRoute;
  destination: Destination;
  audience: Audience;
  language: Language;
  status: Status;
  statusLabel: string | null;
  likelyType: string | null;
  risk: Risk;
  urgency: Urgency;
  details: HandoffDetails;
  omitted: string[];
  consentUsed: string[];
  // Someone close may be watching the customer's phone.
  discreet: boolean;
  messages: CaseMessage[];
};

// The customer's view: their place in the queue and the chat, never the case content.
export type CustomerCaseView = { caseId: string; caseStatus: CaseStatus; agentName: string | null; position: number; messages: CaseMessage[] };

type Stored = AgentCase & { sessionId: string; token: string };

const ttlMinutes = Number(process.env.HANDOFF_TTL_MINUTES);
const TTL_MS = (Number.isFinite(ttlMinutes) && ttlMinutes > 0 ? ttlMinutes : 120) * 60_000;
const MAX_CASES = 200;
const MAX_MESSAGES = 200;

// Kept on globalThis so a hot reload in development doesn't drop the queue.
const store = globalThis as typeof globalThis & { safestepCases?: Map<string, Stored>; safestepCaseSeq?: number };
const cases = (store.safestepCases ??= new Map<string, Stored>());

function sweep(now: number) {
  for (const [id, item] of cases) if (now - item.updatedAt > TTL_MS) cases.delete(id);
  while (cases.size > MAX_CASES) {
    const oldest = cases.keys().next().value;
    if (!oldest) break;
    cases.delete(oldest);
  }
}

const strip = ({ sessionId: _sessionId, token: _token, ...rest }: Stored): AgentCase => rest;

// One case per session: a second approval updates the same case and keeps its number and chat.
export function upsertCase(sessionId: string, input: Omit<AgentCase, "caseId" | "createdAt" | "updatedAt" | "caseStatus" | "agentName" | "messages">): { caseId: string; token: string } {
  const now = Date.now();
  sweep(now);
  const existing = [...cases.values()].find((item) => item.sessionId === sessionId);
  if (existing) {
    Object.assign(existing, input, { updatedAt: now });
    if (existing.caseStatus === "resolved") reopen(existing);
    return { caseId: existing.caseId, token: existing.token };
  }
  store.safestepCaseSeq = (store.safestepCaseSeq ?? 1040) + 1;
  const caseId = `SS-${store.safestepCaseSeq}`;
  const token = randomUUID();
  cases.set(caseId, { ...input, sessionId, token, caseId, createdAt: now, updatedAt: now, caseStatus: "new", agentName: null, messages: [] });
  return { caseId, token };
}

export function listCases(): AgentCase[] {
  sweep(Date.now());
  return [...cases.values()].map(strip).sort((a, b) => b.createdAt - a.createdAt);
}

export function tokenForSession(sessionId: string): { caseId: string; token: string } | null {
  const item = [...cases.values()].find((entry) => entry.sessionId === sessionId);
  return item ? { caseId: item.caseId, token: item.token } : null;
}

function position(item: Stored): number {
  if (item.caseStatus !== "new") return 0;
  return [...cases.values()].filter((other) => other.caseStatus === "new" && other.createdAt <= item.createdAt).length;
}

export function customerView(caseId: string, token: string): CustomerCaseView | null {
  sweep(Date.now());
  const item = cases.get(caseId);
  if (!item || item.token !== token) return null;
  return { caseId: item.caseId, caseStatus: item.caseStatus, agentName: item.agentName, position: position(item), messages: item.messages };
}

function push(item: Stored, message: CaseMessage) {
  item.messages.push(message);
  if (item.messages.length > MAX_MESSAGES) item.messages.shift();
  item.updatedAt = message.at;
}

function reopen(item: Stored) {
  item.caseStatus = item.agentName ? "accepted" : "new";
  if (item.agentName) push(item, { id: randomUUID(), at: Date.now(), from: "system", event: "reopened", name: item.agentName });
}

export function setCaseStatus(caseId: string, caseStatus: CaseStatus, agentName?: string): AgentCase | null {
  const item = cases.get(caseId);
  if (!item || item.caseStatus === caseStatus) return item ? strip(item) : null;
  const now = Date.now();
  if (caseStatus === "accepted") {
    const reopening = item.caseStatus === "resolved";
    item.agentName = agentName?.trim() || item.agentName || "DNA Support";
    item.caseStatus = "accepted";
    push(item, { id: randomUUID(), at: now, from: "system", event: reopening ? "reopened" : "joined", name: item.agentName });
  } else if (caseStatus === "resolved") {
    item.caseStatus = "resolved";
    push(item, { id: randomUUID(), at: now, from: "system", event: "resolved", name: item.agentName ?? "DNA Support" });
  } else {
    item.caseStatus = "new";
    item.updatedAt = now;
  }
  return strip(item);
}

export function addAgentMessage(caseId: string, text: string): AgentCase | null {
  const item = cases.get(caseId);
  if (!item || item.caseStatus !== "accepted") return null;
  push(item, { id: randomUUID(), at: Date.now(), from: "agent", text });
  return strip(item);
}

export function addCustomerMessage(caseId: string, token: string, text: string, masked: boolean): CustomerCaseView | null {
  const item = cases.get(caseId);
  if (!item || item.token !== token || item.caseStatus === "resolved") return null;
  push(item, { id: randomUUID(), at: Date.now(), from: "customer", text, masked });
  return customerView(caseId, token);
}
