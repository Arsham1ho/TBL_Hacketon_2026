import type { Answers, Case, VisibleSignals } from "./case";
import { compose, type Composed } from "./composer";
import { checkDecision } from "./contract";
import { guardInput } from "./input-guard";
import { detectMentions } from "./mentions";
import { interruptionFor, type InterruptionKind } from "./interruption";
import { offlineExtract, type ExtractionInput } from "./offline-extractor";
import { detectManipulationCues } from "./manipulation";
import { decide, flipLimit, isTriage, pickFlip, unresolvedFlip, worstCase, type Flip } from "./question-picker";
import { UNCLEAR, type Outcome } from "./situations";
import { caseConfidence, confirmedFacts } from "./summary";
import { conflictingTopics, mergeFacts, validateFacts } from "./fact-validator";
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
  let facts = primary ? { ...mergeFacts(primary, backstop), language: input.language } : backstop;
  // A breach notice that *asks* for a password does not establish that the
  // password was in the breach. Both readers can otherwise turn that request
  // into unnecessary password-recovery advice.
  const exposureClaim = /(?:passwords?|salasan\w*|lösenord\w*).{0,45}(?:leak|expos|breach|compromis|vuot|läck)|(?:leak|expos|breach|compromis|vuot|läck).{0,45}(?:passwords?|salasan\w*|lösenord\w*)/iu;
  if (facts.incidentType === "data_breach_notice" && facts.dataExposed.includes("password") && !exposureClaim.test(`${guarded.userText}\n${guarded.maskedIncident ?? ""}`)) {
    facts = { ...facts, dataExposed: facts.dataExposed.filter(value => value !== "password"), evidence: facts.evidence.filter(entry => entry.fact !== "dataExposed") };
  }
  // "Asks for nothing" needs evidence: the pasted message itself, or the user saying so.
  // A short report that simply doesn't mention a request ("I won something") is unknown, not
  // harmless, so the model can't make it look safe by leaving the request out.
  const saysNothingAsked = /asks? for nothing|asked for nothing|didn'?t ask (me )?for anything|no links?\b|in the app|as usual|ei pyyd|ei pyytänyt|ei kysynyt|sovelluksessa|kuten tavallisesti|ber inte om|bad inte om|i appen|som vanligt/iu;
  if (facts.asksNothing === true && !guarded.maskedIncident?.trim() && !saysNothingAsked.test(guarded.userText)) {
    facts = { ...facts, asksNothing: null, evidence: facts.evidence.filter(entry => entry.fact !== "asksNothing") };
  }
  // A request to disclose a code is not evidence that the user disclosed it.
  // Explicit first-person denial wins over an extracted quote from the request.
  if (/\b(?:i (?:have not|haven't|did not|didn't|never) (?:shared|given|read out|sent|typed)|en (?:ole )?(?:jakanut|antanut|kertonut|syöttänyt)|jag har inte (?:delat|gett|läst upp|skickat))\b.{0,25}\b(?:code|pin|koodi|koodia|kod|it)\b/iu.test(guarded.userText)) {
    facts = { ...facts, userAlreadyDid: facts.userAlreadyDid.filter(action => action !== "shared_code"), evidence: facts.evidence.filter(entry => entry.fact !== "userAlreadyDid:shared_code") };
  }
  const paymentDenied = /\b(?:(?:i|we) (?:have not|haven't|did not|didn't|never) (?:paid|sent|transferred)\b(?:.{0,35}\b(?:money|payment|invoice|funds|anything|it)\b| yet\b|(?=[.!?;,]|$))|en (?:ole )?(?:vielä )?(?:maksanut|lähettänyt maksua|siirtänyt rahaa)|jag har inte (?:ännu )?(?:betalat|skickat pengar|fört över pengar))\b/iu.test(guarded.userText);
  const codeDenied = facts.asksFor.includes("code") && !facts.userAlreadyDid.includes("shared_code")
    && /\b(?:i (?:refused|declined)(?:\b|\b.{0,25}\b(?:code|it))|i (?:did not|didn't|have not|haven't)\b.{0,25}\b(?:code|share|give|read|send|it)|en (?:antanut|kertonut|jakanut|lähettänyt)\b.{0,20}\b(?:koodi|koodia|sitä)|jag (?:vägrade|delade inte|gav inte|läste inte upp)\b.{0,20}\b(?:kod|koden|den))\b/iu.test(guarded.userText);
  const explicitAnswers: Answers = paymentDenied && !facts.userAlreadyDid.includes("paid")
    ? { payment_status: "no", money_transferred: "no" } : {};
  if (codeDenied) explicitAnswers.code_shared = "no";
  return {
    extractedBy: primary || extract === offlineExtract ? "primary" : "fallback",
    secretsFound: guarded.secretsFound,
    item: {
      audience: input.audience,
      language: input.language,
      facts,
      manipulationCues: detectManipulationCues(`${guarded.userText}\n${guarded.maskedIncident ?? ""}`),
      conflicts: primary ? conflictingTopics(primary, backstop) : [],
      answers: explicitAnswers,
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
    composed: compose(outcome, item.language, open, pending?.topic ?? null, item.audience, item),
  };
}

export type { Answers };
