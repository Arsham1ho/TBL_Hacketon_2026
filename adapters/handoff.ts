import type { ConfirmedFact, Destination, Language } from "../engine/types";

const OMITTED: Record<Language, string> = {
  en: "Codes, passwords and card numbers",
  fi: "Koodit, salasanat ja korttinumerot",
  sv: "Koder, lösenord och kortnummer",
};

// Only reviewed fact lines enter the simulated agent handoff. Raw messages stay local.
export function handoffPreview(destination: Destination, facts: ConfirmedFact[], language: Language) {
  return { destination, summary: facts.map(fact => fact.text), omitted: [OMITTED[language]] };
}
