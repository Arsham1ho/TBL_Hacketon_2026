import lines from "../content/fact-lines.json";
import { topicValue, type Case } from "./case";
import { computeConfidence } from "./confidence";
import type { ConfirmedFact, Topic } from "./types";

// Facts only, in the user's language. Every line traces to the user's words, an
// answer or a visible signal.
export function confirmedFacts(item: Case): ConfirmedFact[] {
  const { language } = item;
  const facts: ConfirmedFact[] = [];
  for (const [key, line] of Object.entries(lines.topics)) {
    const topic = key as Topic;
    const value = topicValue(item, topic);
    if (!value) continue;
    facts.push({ text: line[value][language], source: item.answers[topic] ? "answer" : "user_words" });
  }
  if (item.signals.linkVerdict === "malicious" || item.signals.linkVerdict === "suspicious") {
    facts.push({ text: lines.signals.linkFlagged[language], source: "visible_signal" });
  }
  if (item.signals.callWarning === "suspected_scam") {
    facts.push({ text: lines.signals.callWarned[language], source: "visible_signal" });
  }
  if (item.gatedFindings?.["operator_account.recent_logins"] === "unfamiliar_login") {
    facts.push({
      text: {
        en: "The simulated account check shows an unfamiliar successful login.",
        fi: "Simuloitu tilitarkistus näyttää onnistuneen kirjautumisen tuntemattomalla laitteella.",
        sv: "Den simulerade kontokontrollen visar en lyckad inloggning från en okänd enhet.",
      }[language],
      source: "consented_signal",
    });
  }
  const gatedLines = {
    "subscription.recent_events": {
      recent_sim_change: { en: "The simulated subscription check shows a recent SIM change; it does not establish who requested it.", fi: "Simuloitu liittymätarkistus näyttää äskettäisen SIM-muutoksen, mutta ei todista pyytäjää.", sv: "Den simulerade abonnemangskontrollen visar ett nyligt SIM-byte men inte vem som begärde det." },
    },
    "device.security_findings": {
      suspicious_app: { en: "The simulated device check found a suspicious app.", fi: "Simuloitu laitetarkistus löysi epäilyttävän sovelluksen.", sv: "Den simulerade enhetskontrollen hittade en misstänkt app." },
    },
    "business.staff_accounts": {
      active_former_staff: { en: "The simulated staff-account check shows a former employee's account is still active.", fi: "Simuloitu työntekijätilien tarkistus näyttää entisen työntekijän tilin olevan yhä käytössä.", sv: "Den simulerade kontrollen visar att en före detta anställds konto fortfarande är aktivt." },
    },
  } as const;
  for (const signal of Object.keys(gatedLines) as (keyof typeof gatedLines)[]) {
    const finding = item.gatedFindings?.[signal];
    const line = finding && (gatedLines[signal] as Record<string, Record<typeof language, string>>)[finding];
    if (line) facts.push({ text: line[language], source: "consented_signal" });
  }
  return facts;
}

const UNCLEAR_CEILING = 0.3;

// Counts distinct supported facts, so two extractors agreeing doesn't double the
// evidence. An unclear case can never read as confident, however much was extracted.
export function caseConfidence(item: Case, unknownDecisiveFacts: number, unclear: boolean): number {
  const supported = new Set(item.facts.evidence.map(({ fact }) => fact));
  const score = computeConfidence({
    confirmedFacts: Object.keys(item.answers).length + supported.size,
    unknownDecisiveFacts,
    conflicts: (item.conflicts ?? []).filter(topic => !item.answers[topic]).length,
  });
  return unclear ? Math.min(score, UNCLEAR_CEILING) : score;
}
