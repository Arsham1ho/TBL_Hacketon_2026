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

// An unquoted false is a claim too, so only null and an empty list count as saying nothing.
function isEmpty(field: keyof Facts, value: unknown): boolean {
  if (field === "asksToTracePerson") return value === false;
  return value === null || (Array.isArray(value) && value.length === 0);
}

const VAGUE_TYPES: Facts["incidentType"][] = [null, "other", "message_or_notice"];

// The LLM reads better, but keyword rules catch some things it misses. Missing a danger
// costs far more than one extra caution, so a danger fact from either source is kept.
// The backstop only adds danger: keyword hits never reassure on the LLM's behalf.
export function mergeFacts(primary: Facts, backstop: Facts): Facts {
  const did = [...new Set([...primary.userAlreadyDid, ...backstop.userAlreadyDid])];
  const asksNothing = primary.asksNothing ?? backstop.asksNothing;
  return {
    ...primary,
    incidentType: VAGUE_TYPES.includes(primary.incidentType) ? backstop.incidentType ?? primary.incidentType : primary.incidentType,
    // A vague "other" must not hide a specific match such as a claimed bank or operator.
    pretendsToBe: !primary.pretendsToBe || primary.pretendsToBe === "other" ? backstop.pretendsToBe ?? primary.pretendsToBe : primary.pretendsToBe,
    contactStartedBy: primary.contactStartedBy ?? backstop.contactStartedBy,
    selfInitiated: primary.selfInitiated ?? (backstop.selfInitiated === "no" ? "no" : null),
    passwordReused: primary.passwordReused ?? backstop.passwordReused,
    serviceLost: primary.serviceLost ?? backstop.serviceLost,
    pressureOrSecrecy: primary.pressureOrSecrecy ?? backstop.pressureOrSecrecy,
    asksNothing,
    userAlreadyDid: did.length > 1 ? did.filter((action) => action !== "nothing") : did,
    dataExposed: [...new Set([...primary.dataExposed, ...backstop.dataExposed])],
    asksFor: asksNothing === true ? primary.asksFor : [...new Set([...primary.asksFor, ...backstop.asksFor])],
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
    if (!isEmpty(key, facts[key]) && !supported.has(field)) {
      (facts as Record<keyof Facts, unknown>)[key] = unknown;
    }
  }
  return facts;
}
