import type { Answers, Case, VisibleSignals } from "./case";
import { compose, type Composed } from "./composer";
import { checkDecision } from "./contract";
import { guardInput } from "./input-guard";
import { interruptionFor, type InterruptionKind } from "./interruption";
import { offlineExtract, type ExtractionInput } from "./offline-extractor";
import { decide, MAX_FLIPS, pickFlip, unresolvedFlip, worstCase, type Flip } from "./question-picker";
import type { Outcome } from "./situations";
import { caseConfidence, confirmedFacts } from "./summary";
import { mergeFacts, validateFacts } from "./fact-validator";
import { GatedSignal, type Audience, type ConfirmedFact, type Decision, type Language, type SecretKind, type Topic } from "./types";

// May return anything: the Fact Validator decides what survives.
export type Extractor = (input: ExtractionInput) => unknown;

export type CaseInput = {
  audience: Audience;
  language: Language;
  openingMessage: string;
  incidentContent: string | null;
  incidentChannel: string | null;
  signals: VisibleSignals;
  consent: { requires: string[]; preGranted: string[] };
};

export type Intake = { item: Case; secretsFound: SecretKind[]; extractedBy: "primary" | "fallback" };

const gated = (values: string[]) => values.filter((value): value is GatedSignal => GatedSignal.safeParse(value).success);

const LINK = /https?:\/\/|www\.|(?<![\p{L}\p{N}@.-])[\p{L}\p{N}-]+\.(?:fi|se|com|net|org|io|eu|ly|example|test|invalid)(?![\p{L}\p{N}])/iu;

export async function intake(input: CaseInput, extract: Extractor = offlineExtract): Promise<Intake> {
  const guarded = guardInput(input.openingMessage, input.incidentContent);
  // Users paste scams into their own message, so links are looked for in everything.
  const hasLink = input.signals.hasLink || LINK.test(`${input.openingMessage}\n${input.incidentContent ?? ""}`);
  const incidentText = guarded.incidentContent ?? "";
  const extraction = {
    userText: guarded.userText,
    incidentText,
    language: input.language,
    incidentChannel: input.incidentChannel,
    hasRiskyLink: hasLink && input.signals.linkVerdict !== "clean",
  };
  const source = `${guarded.userText}\n${incidentText}`;
  const primary = validateFacts(await attempt(extract, extraction), source);
  const backstop = validateFacts(offlineExtract(extraction), source) ?? offlineExtract({ ...extraction, userText: "", incidentText: "" });
  const facts = primary ? { ...mergeFacts(primary, backstop), language: input.language } : backstop;
  return {
    extractedBy: primary ? "primary" : "fallback",
    secretsFound: guarded.secretsFound,
    item: {
      audience: input.audience,
      language: input.language,
      facts,
      answers: {},
      unsure: [],
      signals: { ...input.signals, hasLink },
      pregrantedSignals: gated(input.consent.preGranted),
      availableSignals: gated(input.consent.requires),
    },
  };
}

async function attempt(extract: Extractor, extraction: ExtractionInput): Promise<unknown> {
  try {
    return await extract(extraction);
  } catch {
    return null;
  }
}

export type Assessment = {
  outcome: Outcome;
  decision: Decision;
  flip: Flip | null;
  unknownTopics: Topic[];
  interruption: InterruptionKind | null;
  confidence: number;
  confirmedFacts: ConfirmedFact[];
  composed: Composed;
};

function toDecision(outcome: Outcome, unknownTopics: Topic[]): Decision {
  return {
    status: outcome.status,
    risk: outcome.risk,
    urgency: outcome.urgency,
    primaryAction: outcome.primaryAction,
    destination: outcome.destination,
    externalContacts: outcome.externalContacts,
    unknownDecisiveFacts: unknownTopics,
    rescue: outcome.rescue,
  };
}

const UNCLEAR_FALLBACK: Outcome = {
  situation: "unclear",
  status: "needs_verification",
  risk: "medium",
  urgency: "today",
  primaryAction: "verify_via_official_channel",
  destination: null,
  externalContacts: [],
  rescue: false,
  steps: ["verify_official_channel", "dont_open_link", "dont_share_codes"],
  guidance: ["guidance_asking_for_evidence", "guidance_handing_off"],
  wantsSignals: [],
};

// The contract is the last word: anything outside it becomes the unclear path.
export function withinContract(outcome: Outcome, unknownTopics: Topic[]): { outcome: Outcome; decision: Decision } {
  const decision = toDecision(outcome, unknownTopics);
  if (checkDecision(decision).length === 0) return { outcome, decision };
  return { outcome: UNCLEAR_FALLBACK, decision: toDecision(UNCLEAR_FALLBACK, unknownTopics) };
}

export function assess(item: Case, asked = 0): Assessment {
  const open = asked < MAX_FLIPS ? pickFlip(item) : null;
  const pending = open ?? unresolvedFlip(item);
  const unknownTopics = pending ? [pending.topic] : [];
  const { outcome, decision } = withinContract(pending ? worstCase(pending) : decide(item), unknownTopics);

  return {
    outcome,
    decision,
    flip: open,
    unknownTopics,
    interruption: interruptionFor(item.facts),
    confidence: caseConfidence(item, unknownTopics.length, outcome.situation === "unclear"),
    confirmedFacts: confirmedFacts(item),
    composed: compose(outcome, item.language, open, pending?.topic ?? null),
  };
}

export type { Answers };
