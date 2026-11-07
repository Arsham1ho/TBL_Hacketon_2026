import type { Assessment, CaseInput } from "../engine/assess";
import type { Case, VisibleSignals } from "../engine/case";

// Reads assistant-visible fields only. ground_truth, simulation, tags, title,
// difficulty and scenario_family never reach the engine.
export function toCaseInput(raw: any): CaseInput {
  const { signals } = raw;
  const artifact = signals.artifact;
  const parts = [artifact?.sender, artifact?.body, signals.user_call_notes].filter((part) => typeof part === "string");
  const call = signals.call_warning;
  const visible: VisibleSignals = {
    hasLink: (artifact?.links?.length ?? 0) > 0,
    linkVerdict: signals.link_check?.verdict ?? null,
    callWarning: call?.warning ?? null,
    callerSpoofed: call?.caller_id_possibly_spoofed === true,
  };
  return {
    audience: raw.audience,
    language: raw.language,
    openingMessage: raw.opening_message,
    incidentContent: parts.length ? parts.join("\n") : null,
    incidentChannel: artifact?.type ?? null,
    signals: visible,
    consent: { requires: raw.consent.requires_consent, preGranted: raw.consent.pre_granted },
  };
}

function signalsUsed(raw: any, item: Case): string[] {
  const used: string[] = [];
  if (raw.signals.artifact) used.push("artifact");
  if (item.signals.linkVerdict) used.push("link_check");
  if (item.signals.callWarning) used.push("call_warning");
  return used;
}

export function toSubmission(raw: any, item: Case, assessment: Assessment, activity: { requested?: string[]; used?: string[] } = {}) {
  const { decision, outcome, composed, flip, confidence } = assessment;
  return {
    case_id: raw.case_id,
    risk_level: decision.risk,
    primary_action: decision.primaryAction,
    advice_text: composed.adviceText,
    escalation_required: decision.destination !== null,
    escalation_target: decision.destination,
    urgency: decision.urgency,
    // Only the branch the advice leads with: a flat list would mix "lock your SIM now" with the
    // other branch's "nothing to do" and lose its condition. The advice text keeps both branches.
    steps: composed.branches?.[0]?.steps ?? composed.steps,
    questions_asked: composed.question ? [composed.question] : [],
    question_topics: flip ? [flip.topic] : [],
    signals_used: [...signalsUsed(raw, item), ...(activity.used ?? [])],
    // One-answer mode has no consent interaction. Never claim that a request occurred.
    consent_requested_for: activity.requested ?? [],
    citations: outcome.guidance,
    confidence,
    abstained: outcome.situation === "unclear",
  };
}
