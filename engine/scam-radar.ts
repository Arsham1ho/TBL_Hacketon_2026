import type { Case } from "./case";
import type { Audience, Language } from "./types";

// Synthetic demonstration feed. No counts, dates or DNA reporting claims are implied.
export type RadarPattern = {
  id: string;
  priority: number;
  audience: Audience | "both";
  title: Record<Language, string>;
  clue: Record<Language, string>;
};

export const RADAR_PATTERNS: RadarPattern[] = [
  { id: "family_new_number", priority: 1, audience: "consumer", title: { en: "Family member, new number", fi: "Läheinen, uusi numero", sv: "Anhörig, nytt nummer" }, clue: { en: "A relative claims a new number and asks for money.", fi: "Läheinen väittää käyttävänsä uutta numeroa ja pyytää rahaa.", sv: "En anhörig säger sig ha ett nytt nummer och ber om pengar." } },
  { id: "bank_code", priority: 2, audience: "consumer", title: { en: "Bank code request", fi: "Pankkikoodin pyyntö", sv: "Begäran om bankkod" }, clue: { en: "A claimed bank contact asks for a login or confirmation code.", fi: "Pankkina esiintyvä yhteydenotto pyytää kirjautumis- tai vahvistuskoodia.", sv: "En påstådd bankkontakt ber om en inloggnings- eller bekräftelsekod." } },
  { id: "parcel_fee", priority: 3, audience: "consumer", title: { en: "Parcel fee link", fi: "Paketin maksulinkki", sv: "Länk till paketavgift" }, clue: { en: "A delivery notice sends the recipient to a payment link.", fi: "Toimitusilmoitus ohjaa maksulinkkiin.", sv: "Ett leveransmeddelande leder till en betalningslänk." } },
  { id: "supplier_account", priority: 1, audience: "small_business", title: { en: "Supplier bank details changed", fi: "Toimittajan tilinumero vaihtui", sv: "Leverantörens bankuppgifter ändrades" }, clue: { en: "A supplier asks for an invoice to be paid to a new account.", fi: "Toimittaja pyytää maksamaan laskun uudelle tilille.", sv: "En leverantör ber att en faktura betalas till ett nytt konto." } },
];

const hasCue = (item: Case, kind: string) => item.manipulationCues?.some(cue => cue.kind === kind) ?? false;

// Match only combinations of independently extracted facts. A trend cannot
// label an incident, change risk, or supply a missing fact.
export function radarMatch(item: Case): RadarPattern | null {
  const f = item.facts;
  const matches = RADAR_PATTERNS.filter(pattern => {
    if (pattern.audience !== "both" && pattern.audience !== item.audience) return false;
    switch (pattern.id) {
      case "family_new_number": return f.pretendsToBe === "family" && f.asksFor.includes("money") && hasCue(item, "channel_change");
      case "bank_code": return f.pretendsToBe === "bank" && f.asksFor.includes("code");
      case "parcel_fee": return f.pretendsToBe === "support" && f.asksFor.includes("money") && item.signals.hasLink;
      case "supplier_account": return f.pretendsToBe === "supplier" && f.asksFor.includes("bank_change");
      default: return false;
    }
  });
  return matches.sort((a, b) => a.priority - b.priority)[0] ?? null;
}
