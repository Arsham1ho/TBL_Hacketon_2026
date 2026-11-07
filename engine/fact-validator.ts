import { fold } from "./offline-extractor";
import { Facts } from "./types";

// A fact survives only if its quote really appears in the masked source text.
// Everything else returns to unknown, so a model can't narrow a case by inventing.
const UNKNOWN_IF_UNSUPPORTED: Partial<Record<keyof Facts, unknown>> = {
  incidentType: null,
  contactStartedBy: null,
  pretendsToBe: null,
  assetInvolved: [],
  asksFor: [],
  userAlreadyDid: [],
  dataExposed: [],
  selfInitiated: null,
  independentlyVerified: null,
  asksNothing: null,
  passwordReused: null,
  serviceLost: null,
  happeningNow: null,
  pressureOrSecrecy: null,
  personalSafetyRisk: null,
  asksToTracePerson: false,
};

const squash = (text: string) => fold(text).toLowerCase().replace(/\s+/g, " ").trim();

function isEmpty(value: unknown): boolean {
  return value === null || value === false || (Array.isArray(value) && value.length === 0);
}

// The LLM reads better, but keyword rules catch some things it misses. Missing a danger
// costs far more than one extra caution, so a danger fact from either source is kept.
export function mergeFacts(primary: Facts, backstop: Facts): Facts {
  const did = [...new Set([...primary.userAlreadyDid, ...backstop.userAlreadyDid])];
  const asksFor = [...new Set([...primary.asksFor, ...backstop.asksFor])];
  // A model claiming that a message asks for nothing must never erase a
  // concrete request found by the deterministic safety backstop.
  const asksNothing = asksFor.length > 0 ? false : primary.asksNothing ?? backstop.asksNothing;
  const selfInitiated = primary.selfInitiated !== null && backstop.selfInitiated !== null
    && primary.selfInitiated !== backstop.selfInitiated ? null : primary.selfInitiated ?? backstop.selfInitiated;
  const independentlyVerified = primary.independentlyVerified !== null && backstop.independentlyVerified !== null
    && primary.independentlyVerified !== backstop.independentlyVerified ? null : primary.independentlyVerified ?? backstop.independentlyVerified;
  return {
    ...primary,
    incidentType: primary.incidentType ?? backstop.incidentType,
    // A vague "other" must not hide a specific match such as a claimed bank or operator.
    pretendsToBe: !primary.pretendsToBe || primary.pretendsToBe === "other" ? backstop.pretendsToBe ?? primary.pretendsToBe : primary.pretendsToBe,
    contactStartedBy: primary.contactStartedBy ?? backstop.contactStartedBy,
    selfInitiated,
    independentlyVerified,
    passwordReused: primary.passwordReused ?? backstop.passwordReused,
    serviceLost: primary.serviceLost ?? backstop.serviceLost,
    pressureOrSecrecy: primary.pressureOrSecrecy ?? backstop.pressureOrSecrecy,
    asksNothing,
    userAlreadyDid: did.length > 1 ? did.filter((action) => action !== "nothing") : did,
    dataExposed: [...new Set([...primary.dataExposed, ...backstop.dataExposed])],
    asksFor,
    happeningNow: primary.happeningNow === true || backstop.happeningNow === true ? true : primary.happeningNow,
    personalSafetyRisk: primary.personalSafetyRisk === true || backstop.personalSafetyRisk === true ? true : primary.personalSafetyRisk,
    asksToTracePerson: primary.asksToTracePerson || backstop.asksToTracePerson,
    evidence: [...primary.evidence, ...backstop.evidence],
  };
}

export function validateFacts(raw: unknown, sourceText: string): Facts | null {
  const parsed = Facts.safeParse(raw);
  if (!parsed.success) return null;

  const source = squash(sourceText);
  const supported = new Set(
    parsed.data.evidence
      .filter(({ quote }) => quote.trim().length > 0 && source.includes(squash(quote)))
      .map(({ fact }) => fact),
  );

  const facts: Facts = { ...parsed.data, evidence: parsed.data.evidence.filter(({ fact }) => supported.has(fact)) };
  for (const [field, unknown] of Object.entries(UNKNOWN_IF_UNSUPPORTED)) {
    const key = field as keyof Facts;
    if (!isEmpty(facts[key]) && !supported.has(field)) {
      (facts as Record<keyof Facts, unknown>)[key] = unknown;
    }
  }
  return facts;
}
