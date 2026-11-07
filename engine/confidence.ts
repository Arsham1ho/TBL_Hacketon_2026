export type ConfidenceEvidence = {
  confirmedFacts: number;
  unknownDecisiveFacts: number;
  conflicts: number;
};

export type ConfidenceBand = "low" | "medium" | "high";

export const BASE = 0.3;
export const PER_CONFIRMED_FACT = 0.1;
export const PER_UNKNOWN_FACT = 0.2;
const PER_CONFLICT = 0.2;
export const FLOOR = 0.1;
export const CEILING = 0.95;

// Takes evidence only. Severity is deliberately not an input, so a critical case
// with little evidence stays low confidence.
export function computeConfidence({ confirmedFacts, unknownDecisiveFacts, conflicts }: ConfidenceEvidence): number {
  const score =
    BASE +
    PER_CONFIRMED_FACT * confirmedFacts -
    PER_UNKNOWN_FACT * unknownDecisiveFacts -
    PER_CONFLICT * conflicts;
  return Math.round(Math.min(CEILING, Math.max(FLOOR, score)) * 100) / 100;
}

export function confidenceBand(confidence: number): ConfidenceBand {
  if (confidence >= 0.7) return "high";
  if (confidence >= 0.4) return "medium";
  return "low";
}
