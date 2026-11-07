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
  const did = [...new Set([...primary.userAlreadyDid, ...backstop.userAlreadyDid.filter((action) => action !== "nothing")])];
  const asksFor = [...new Set([...primary.asksFor, ...backstop.asksFor])];
  // A model claiming that a message asks for nothing must never erase a
  // concrete request found by the deterministic safety backstop.
  const asksNothing = asksFor.length > 0 ? false : primary.asksNothing;
  return {
    ...primary,
    incidentType: VAGUE_TYPES.includes(primary.incidentType) ? backstop.incidentType ?? primary.incidentType : primary.incidentType,
    // A vague "other" must not hide a specific match such as a claimed bank or operator.
    pretendsToBe: !primary.pretendsToBe || primary.pretendsToBe === "other" ? backstop.pretendsToBe ?? primary.pretendsToBe : primary.pretendsToBe,
    contactStartedBy: primary.contactStartedBy ?? backstop.contactStartedBy,
    // A denial from either source wins.
    selfInitiated: backstop.selfInitiated === "no" ? "no" : primary.selfInitiated,
    passwordReused: primary.passwordReused ?? backstop.passwordReused,
    serviceLost: primary.serviceLost ?? backstop.serviceLost,
    pressureOrSecrecy: primary.pressureOrSecrecy ?? backstop.pressureOrSecrecy,
    asksNothing,
    userAlreadyDid: did.length > 1 ? did.filter((action) => action !== "nothing") : did,
    dataExposed: [...new Set([...primary.dataExposed, ...backstop.dataExposed.filter((data) => data !== "email_only")])],
    asksFor,
    happeningNow: primary.happeningNow === true || backstop.happeningNow === true ? true : primary.happeningNow,
    personalSafetyRisk: primary.personalSafetyRisk === true || backstop.personalSafetyRisk === true ? true : primary.personalSafetyRisk,
    asksToTracePerson: primary.asksToTracePerson || backstop.asksToTracePerson,
    evidence: [...primary.evidence, ...backstop.evidence],
  };
}

// Short enough for "CEO", "kod" and "pin", long enough to refuse a stray letter.
const MIN_QUOTE = 3;

// What the user did or started can't be proven by the scam's own words.
const USER_WORDS_ONLY = new Set<string>(["selfInitiated", "userAlreadyDid", "passwordReused"]);

export type FactSources = { userText: string; maskedIncident: string | null };

export function validateFacts(raw: unknown, sources: FactSources): Facts | null {
  const parsed = Facts.safeParse(raw);
  if (!parsed.success) return null;

  const userText = squash(sources.userText);
  const everything = squash(`${sources.userText}\n${sources.maskedIncident ?? ""}`);
  const isOrder = parsed.data.incidentType === "unexpected_order_or_bill";
  const quoted = ({ fact, quote }: Facts["evidence"][number]) => {
    const text = squash(quote);
    if (text.length < MIN_QUOTE) return false;
    const userOnly = USER_WORDS_ONLY.has(fact) || (fact === "independentlyVerified" && !isOrder);
    return (userOnly ? userText : everything).includes(text);
  };

  const evidence = parsed.data.evidence.filter(quoted);
  const supported = new Set(evidence.map(({ fact }) => fact));
  const facts: Facts = { ...parsed.data, evidence };
  for (const [field, unknown] of Object.entries(UNKNOWN_IF_UNSUPPORTED)) {
    const key = field as keyof Facts;
    if (!isEmpty(key, facts[key]) && !supported.has(field)) {
      (facts as Record<keyof Facts, unknown>)[key] = unknown;
    }
  }
  return facts;
}
