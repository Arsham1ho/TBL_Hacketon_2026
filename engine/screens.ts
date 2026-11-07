import type { IncidentCategory, IncidentStory } from "./incident-category";
import type { EvidenceChannel, EvidenceField, LinkCheck } from "./link-check";
import type { Destination, ExternalContact, GatedSignal, Language, Risk, Status, Topic, Urgency } from "./types";

// The contract between the engine and the UI. The API returns these and the UI only
// renders them, so the UI holds no safety logic. Change this file together, not alone.

// Who can actually help. The bank and police are contacts, and the rest are people at DNA.
export type SupportRoute = Destination | "bank" | "police";

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
  // context: approved lines saying what was understood, shown before a triage question.
  | { type: "flip"; topic: Topic; question: string; why: string; statusLabel: string; branches: Branch[]; context?: string[] }
  // Shown when the first message holds nothing to assess, such as only a greeting.
  // "off_topic" also asks whether anything happened, with Yes and No replies.
  | { type: "describe"; reason: "greeting" | "off_topic" | "link_context"; message: string; hint: string }
  // A live follow-up question written by the LLM for an unclear report. Answers become facts.
  | { type: "ask"; id: string; question: string }
  // Asks for what the user received, with fields that fit it: a link, the sender and the message
  // text, or for a call the number and what was said. All optional. retry: the link couldn't be read.
  | { type: "evidence"; channel: EvidenceChannel; message: string; hint: string; fields: EvidenceField[]; retry: boolean }
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
      // Hedged scam type for the summary card, available even while a fact is unknown.
      likelyType: IncidentCategory | null;
      story: IncidentStory;
      // Steps the user finished in Rescue Mode, so they aren't repeated as to-dos.
      completed: string[];
      stopped: boolean;
      sharedWith: SupportRoute | null;
      supportRoutes: SupportRoute[];
    }
  | { type: "rescue"; step: RescueStep; position: number; total: number }
  // details: the same summary split into its parts, so the review can lay each one out.
  | { type: "handoff"; destination: Destination; route: SupportRoute; summary: string[]; omitted: string[]; details?: HandoffDetails }
  | { type: "fallback"; message: string; actions: string[] }
  | { type: "end"; message: string };

export type HandoffDetails = { facts: string[]; reason: string; completed: string[]; unable: string[] };

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
    // For showing the AI's current assessment in the chat as it changes.
    statusLabel?: string;
    likelyType?: string | null;
  };
  summary: string[];
  secretWarning: string | null;
  // The latest check of a link the user received, shown once in the chat when it arrives.
  linkCheck: LinkCheck | null;
  // The latest check of who sent the message or made the call.
  senderCheck: LinkCheck | null;
  notice: string;
  dataReceipt: DataReceipt;
};

// Requests the UI sends. Each one goes to the route named in ARCHITECTURE.md.
export type ApiRequest =
  | { kind: "start"; audience: "consumer" | "small_business"; language: Language | "auto"; fallbackLanguage?: Language; message: string; incident?: string; demoScenario?: string }
  | { kind: "continue" }
  | { kind: "talk_to_person"; route?: SupportRoute }
  | { kind: "answer"; topic: Topic; answer: "yes" | "no" | "unsure" }
  | { kind: "answer_text"; topic: Topic; text: string }
  | { kind: "add_details"; text: string }
  | { kind: "ai_answer"; id: string; answer?: "yes" | "no" | "unsure"; text?: string }
  | { kind: "consent"; signal: GatedSignal; granted: boolean }
  | { kind: "evidence"; link?: string; sender?: string; content?: string }
  | { kind: "skip_evidence" }
  | { kind: "rescue"; stepId: string; outcome: "done" | "not_possible" }
  | { kind: "handoff"; approved: boolean };
