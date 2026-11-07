import type { GatedSignal } from "../engine/types";
import type { VisibleSignals } from "../engine/case";

export const DEMO_SCENARIOS = ["none", "flagged_link", "warned_call", "sim_change", "unknown_login", "device_issue", "business_access"] as const;
export type DemoScenario = (typeof DEMO_SCENARIOS)[number];

export function demoSignalsFor(scenario: DemoScenario): { visible: VisibleSignals; gated: GatedSignal[] } {
  const visible: VisibleSignals = { hasLink: scenario === "flagged_link", linkVerdict: scenario === "flagged_link" ? "suspicious" : null, callWarning: scenario === "warned_call" ? "suspected_scam" : null, callerSpoofed: false };
  const gated: GatedSignal[] = scenario === "sim_change" ? ["subscription.recent_events"]
    : scenario === "unknown_login" ? ["operator_account.recent_logins"]
    : scenario === "device_issue" ? ["device.security_findings", "device.recent_app_installs"]
    : scenario === "business_access" ? ["business.staff_accounts"] : [];
  return { visible, gated };
}

// Demo-only provider. Values are deliberately neutral; no simulated check can prove safety.
export function readSimulatedSignal(signal: GatedSignal): { signal: GatedSignal; finding: "unknown" } {
  return { signal, finding: "unknown" };
}
