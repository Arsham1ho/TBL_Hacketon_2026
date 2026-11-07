import type { Answers, Case, VisibleSignals } from "./case";
import { compose, type Composed } from "./composer";
import { checkDecision } from "./contract";
import { guardInput } from "./input-guard";
import { detectMentions } from "./mentions";
import { interruptionFor, type InterruptionKind } from "./interruption";
import { offlineExtract, type ExtractionInput } from "./offline-extractor";
import { decide, flipLimit, isTriage, pickFlip, unresolvedFlip, worstCase, type Flip } from "./question-picker";
import { UNCLEAR, type Outcome } from "./situations";
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

const LINK = /https?:\/\/|www\.|(?<![\p{L}\p{N}@.-])(?:[\p{L}\p{N}-]+\.)+(?:fi|se|com|net|org|io|eu|ly|co|uk|de|top|xyz|info|shop|app|site|online|club|link|example|test|invalid)(?![\p{L}\p{N}])/iu;

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
    audience: input.audience,
  };
  const primary = extract === offlineExtract ? null : validateFacts(await attempt(extract, extraction), guarded);
  // The keyword reader gets plain text: the wrapper tags are for the LLM only.
  const plain = { ...extraction, incidentText: guarded.maskedIncident ?? "" };
  const backstop = validateFacts(offlineExtract(plain), guarded) ?? offlineExtract({ ...plain, userText: "", incidentText: "" });
  const facts = primary ? { ...mergeFacts(primary, backstop), language: input.language } : backstop;
  return {
    extractedBy: primary || extract === offlineExtract ? "primary" : "fallback",
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
      mentions: detectMentions(`${guarded.userText}\n${guarded.maskedIncident ?? ""}`),
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

// The contract is the last word: anything outside it becomes the unclear path.
export function withinContract(item: Case, outcome: Outcome, unknownTopics: Topic[]): { outcome: Outcome; decision: Decision } {
  const decision = toDecision(outcome, unknownTopics);
  if (checkDecision(decision).length === 0) return { outcome, decision };
  const unclear = UNCLEAR.then(item);
  return { outcome: unclear, decision: toDecision(unclear, unknownTopics) };
}

export function assess(item: Case, asked = 0): Assessment {
  // Running out of questions doesn't answer them: an unasked fact stays unknown.
  const undecided = pickFlip(item);
  const open = asked < flipLimit(undecided) ? undecided : null;
  // A triage question is only a broad check, so an unanswered one must not raise the
  // case to its worst outcome. "help" alone isn't an emergency. "Not sure" still counts.
  const pending = (isTriage(undecided) ? null : undecided) ?? unresolvedFlip(item);
  const unknownTopics = pending ? [pending.topic] : [];
  const { outcome, decision } = withinContract(item, pending ? worstCase(pending) : decide(item), unknownTopics);

  return {
    outcome,
    decision,
    flip: open,
    unknownTopics,
    interruption: interruptionFor(item.facts) ?? (item.answers.time_of_event === "yes" ? "live_request" : null),
    confidence: caseConfidence(item, unknownTopics.length, outcome.situation === "unclear"),
    confirmedFacts: confirmedFacts(item),
    composed: compose(outcome, item.language, open, pending?.topic ?? null, item.audience),
  };
}

export type { Answers };
