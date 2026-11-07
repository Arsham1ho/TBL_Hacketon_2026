import type { GatedSignal, Language } from "../engine/types";
import type { VisibleSignals } from "../engine/case";

export const DEMO_SCENARIOS = ["none", "flagged_link", "warned_call", "sim_change", "unknown_login", "device_issue", "business_access"] as const;
export type DemoScenario = (typeof DEMO_SCENARIOS)[number];

const LABELS: Record<GatedSignal, Record<Language, string>> = {
  "subscription.recent_events": { en: "Recent SIM and eSIM changes", fi: "Viimeaikaiset SIM- ja eSIM-muutokset", sv: "Senaste SIM- och eSIM-ändringar" },
  "subscription.network_status": { en: "Subscription network status", fi: "Liittymän verkon tila", sv: "Abonnemangets nätstatus" },
  "device.recent_app_installs": { en: "Recently installed apps", fi: "Äskettäin asennetut sovellukset", sv: "Nyligen installerade appar" },
  "device.security_findings": { en: "Device security findings", fi: "Laitteen tietoturvahavainnot", sv: "Enhetens säkerhetsfynd" },
  "operator_account.recent_logins": { en: "Recent operator-account logins", fi: "Operaattoritilin viimeaikaiset kirjautumiset", sv: "Senaste inloggningar på operatörskontot" },
  "credential_exposure": { en: "Known credential exposure", fi: "Tiedossa olevat tunnusvuodot", sv: "Kända läckor av inloggningsuppgifter" },
  "business.staff_accounts": { en: "Business staff-account status", fi: "Yrityksen työntekijätilien tila", sv: "Status för företagets personalkonton" },
};

export const signalLabel = (signal: GatedSignal, language: Language) => LABELS[signal][language];

export function demoSignalsFor(scenario: DemoScenario): { visible: VisibleSignals; gated: GatedSignal[] } {
  const visible: VisibleSignals = { hasLink: scenario === "flagged_link", linkVerdict: scenario === "flagged_link" ? "suspicious" : null, callWarning: scenario === "warned_call" ? "suspected_scam" : null, callerSpoofed: false };
  const gated: GatedSignal[] = scenario === "sim_change" ? ["subscription.recent_events"]
    : scenario === "unknown_login" ? ["operator_account.recent_logins"]
    : scenario === "device_issue" ? ["device.security_findings", "device.recent_app_installs"]
    : scenario === "business_access" ? ["business.staff_accounts"] : [];
  return { visible, gated };
}

// The scenario is selected for a synthetic demo. A finding never proves safety or identity.
export function readSimulatedSignal(signal: GatedSignal, scenario: DemoScenario): { signal: GatedSignal; finding: string } {
  const finding = scenario === "unknown_login" && signal === "operator_account.recent_logins" ? "unfamiliar_login"
    : scenario === "sim_change" && signal === "subscription.recent_events" ? "recent_sim_change"
    : scenario === "device_issue" && signal === "device.security_findings" ? "suspicious_app"
    : scenario === "device_issue" && signal === "device.recent_app_installs" ? "suspicious_app"
    : scenario === "business_access" && signal === "business.staff_accounts" ? "active_former_staff"
    : "unknown";
  return { signal, finding };
}

// Interpret only the fields needed for a decision. An ambiguous value stays unknown.
export function interpretConsentedSignal(signal: GatedSignal, value: unknown): string {
  if (signal === "operator_account.recent_logins" && Array.isArray(value)) {
    return value.some(row => row && typeof row === "object" && row.result === "success" && row.device_known === false)
      ? "unfamiliar_login" : "unknown";
  }
  if (signal === "subscription.recent_events" && Array.isArray(value)) {
    return value.some(row => row && typeof row === "object" && typeof row.type === "string" && /^(?:esim|sim)_?(?:activation|transfer)/iu.test(row.type))
      ? "recent_sim_change" : "unknown";
  }
  if (signal === "device.security_findings" && value && typeof value === "object") {
    const findings = value as { accessibility_services?: unknown; remote_access_apps?: unknown };
    return (Array.isArray(findings.accessibility_services) && findings.accessibility_services.length > 0)
      || (Array.isArray(findings.remote_access_apps) && findings.remote_access_apps.length > 0)
      ? "suspicious_app" : "unknown";
  }
  if (signal === "business.staff_accounts" && Array.isArray(value)) {
    return value.some(row => row && typeof row === "object" && row.status === "active" && row.employment_status === "former")
      ? "active_former_staff" : "unknown";
  }
  return "unknown";
}
