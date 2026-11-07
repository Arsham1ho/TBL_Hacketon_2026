import type { Destination, ExternalContact, GatedSignal, Language, Risk, Status, Topic, Urgency } from "./types";
import type { IncidentCategory } from "./incident-category";

// The contract between the engine and the UI. The API returns these and the UI only
// renders them, so the UI holds no safety logic. Change this file together, not alone.

export type Branch = { condition: string; steps: string[] };

export type RescueStep = {
  id: string;
  title: string;
  detail: string;
  // True for a real-world step only the user can take, such as calling the bank.
  userAction: boolean;
};

export type Screen =
  | { type: "stop"; message: string; actions: string[] }
  | { type: "flip"; topic: Topic; question: string; why: string; statusLabel: string; branches: Branch[] }
  | { type: "unlock"; signal: GatedSignal; what: string; why: string; limit: string; ifRefused: string }
  | {
      type: "result";
      statusLabel: string;
      steps: string[];
      branches: Branch[] | null;
      reason: string;
      confidence: string;
      unknowns: string[];
      sources: { id: string; title: string }[];
      classification: IncidentCategory | null;
    }
  | { type: "rescue"; step: RescueStep; position: number; total: number }
  | { type: "handoff"; destination: Destination; summary: string[]; omitted: string[] }
  | { type: "fallback"; message: string; actions: string[] }
  | { type: "end"; message: string };

export type DataReceipt = {
  used: GatedSignal[];
  refused: GatedSignal[];
  notAccessed: GatedSignal[];
  sentToLlm: boolean;
};

export type ApiResponse = {
  sessionId: string;
  language: Language;
  screen: Screen;
  state: {
    status: Status;
    risk: Risk;
    urgency: Urgency;
    destination: Destination | null;
    externalContacts: ExternalContact[];
  };
  summary: string[];
  secretWarning: string | null;
  notice: string;
  dataReceipt: DataReceipt;
};

// Requests the UI sends. Each one goes to the route named in ARCHITECTURE.md.
export type ApiRequest =
  | { kind: "start"; audience: "consumer" | "small_business"; language: Language | "auto"; message: string; incident?: string; demoScenario?: string }
  | { kind: "continue" }
  | { kind: "talk_to_person" }
  | { kind: "answer"; topic: Topic; answer: "yes" | "no" | "unsure" }
  | { kind: "consent"; signal: GatedSignal; granted: boolean }
  | { kind: "rescue"; stepId: string; outcome: "done" | "not_possible" }
  | { kind: "handoff"; approved: boolean };
