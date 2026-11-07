import type { GatedSignal, Language } from "../engine/types";

// The packaging hypothesis in BUSINESS.md, as a demo switch. Nothing is charged. Safety
// guidance, stop-the-harm steps, Rescue Mode and handoff to a person are free on every plan:
// the paid plans add DNA signal checks, the decision report and priority help.
export type Plan = "free" | "bundle" | "business";
export const PLANS: Plan[] = ["free", "bundle", "business"];
export type Feature = "signals" | "business_signals" | "report" | "priority";

const ACCESS: Record<Feature, Plan[]> = {
  signals: ["bundle", "business"],
  business_signals: ["business"],
  report: ["bundle", "business"],
  priority: ["bundle", "business"],
};

export const hasFeature = (plan: Plan, feature: Feature) => ACCESS[feature].includes(plan);
export const signalFeature = (signal: GatedSignal): Feature => (signal.startsWith("business.") ? "business_signals" : "signals");
// The cheapest plan that unlocks a feature.
export const planFor = (feature: Feature): Plan => ACCESS[feature][0];

const KEY = "safestep-plan";
export function loadPlan(): Plan {
  try {
    const saved = localStorage.getItem(KEY);
    return PLANS.includes(saved as Plan) ? (saved as Plan) : "free";
  } catch {
    return "free";
  }
}
export function savePlan(plan: Plan) {
  try {
    localStorage.setItem(KEY, plan);
  } catch {}
}

type PlanCopy = { name: string; price: string; tagline: string; features: string[] };
type Copy = {
  title: string;
  subtitle: string;
  current: string;
  choose: string;
  demo: string;
  free: string;
  always: string;
  alwaysList: string[];
  plans: Record<Plan, PlanCopy>;
  locked: Record<Feature, string>;
  seePlans: string;
  continueWithout: string;
  priority: string;
  standard: string;
  upgradedTo: string;
  recommended: string;
  unlocksNow: string;
  perYear: string;
};

export const PLAN_COPY: Record<Language, Copy> = {
  en: {
    title: "SafeStep plans",
    subtitle: "Part of DNA's security services.",
    current: "Current plan",
    choose: "Choose",
    demo: "Demo only. No payment is taken and prices are a hypothesis.",
    free: "Free",
    always: "Always free on every plan",
    alwaysList: ["Is this a scam? check", "Link and message analysis", "Stop-the-harm steps and Rescue Mode", "Handoff to a person when needed"],
    plans: {
      free: { name: "SafeStep Free", price: "€0", tagline: "In the DNA app", features: ["Clear next step and why", "Link and message check", "Rescue Mode"] },
      bundle: { name: "DNA Security bundle", price: "€2.99 / month", tagline: "Included in DNA Digiturva", features: ["Everything in Free", "DNA signal checks with your consent", "Decision report to save or share", "Priority handoff to a DNA advisor"] },
      business: { name: "DNA Business Security", price: "€9 / month per company", tagline: "Add-on for DNA Business, up to 10 users", features: ["Everything in the Security bundle", "Staff account and access checks", "Invoice and payment fraud checks", "Report for insurer or police", "Business security support"] },
    },
    locked: {
      signals: "Checking DNA data for this case is part of the DNA Security bundle.",
      business_signals: "Checking staff accounts is part of DNA Business Security.",
      report: "The decision report is part of the DNA Security bundle.",
      priority: "Priority handoff is part of the DNA Security bundle.",
    },
    seePlans: "See plans",
    continueWithout: "Continue without",
    priority: "Priority queue",
    standard: "Standard queue",
    upgradedTo: "Plan changed to",
    recommended: "Recommended for you",
    unlocksNow: "Unlocks for this case",
    perYear: "Billed monthly, cancel anytime",
  },
  fi: {
    title: "SafeStep-paketit",
    subtitle: "Osa DNA:n tietoturvapalveluita.",
    current: "Nykyinen paketti",
    choose: "Valitse",
    demo: "Vain demo. Maksua ei veloiteta, ja hinnat ovat oletus.",
    free: "Maksuton",
    always: "Aina maksutta kaikissa paketeissa",
    alwaysList: ["Onko tämä huijaus? -tarkistus", "Linkin ja viestin analyysi", "Haitan pysäyttäminen ja Pelastustila", "Ohjaus ihmiselle tarvittaessa"],
    plans: {
      free: { name: "SafeStep Maksuton", price: "0 €", tagline: "DNA-sovelluksessa", features: ["Selkeä seuraava askel ja syy", "Linkin ja viestin tarkistus", "Pelastustila"] },
      bundle: { name: "DNA Turvapaketti", price: "2,99 € / kk", tagline: "Sisältyy DNA Digiturvaan", features: ["Kaikki Maksuttoman ominaisuudet", "DNA-tietojen tarkistus luvallasi", "Päätösraportti tallennettavaksi tai jaettavaksi", "Etusija DNA:n neuvojalle"] },
      business: { name: "DNA Yritysturva", price: "9 € / kk / yritys", tagline: "Lisäpalvelu DNA Businessiin, enintään 10 käyttäjää", features: ["Kaikki Turvapaketin ominaisuudet", "Työntekijätilien ja käyttöoikeuksien tarkistus", "Lasku- ja maksupetosten tarkistus", "Raportti vakuutusyhtiölle tai poliisille", "Yritysten tietoturvatuki"] },
    },
    locked: {
      signals: "DNA-tietojen tarkistus tähän tapaukseen kuuluu DNA Turvapakettiin.",
      business_signals: "Työntekijätilien tarkistus kuuluu DNA Yritysturvaan.",
      report: "Päätösraportti kuuluu DNA Turvapakettiin.",
      priority: "Etusija neuvojalle kuuluu DNA Turvapakettiin.",
    },
    seePlans: "Katso paketit",
    continueWithout: "Jatka ilman",
    priority: "Etusijajono",
    standard: "Tavallinen jono",
    upgradedTo: "Paketiksi vaihdettiin",
    recommended: "Suositus sinulle",
    unlocksNow: "Avautuu tähän tapaukseen",
    perYear: "Laskutetaan kuukausittain, peru milloin vain",
  },
  sv: {
    title: "SafeStep-paket",
    subtitle: "En del av DNA:s säkerhetstjänster.",
    current: "Nuvarande paket",
    choose: "Välj",
    demo: "Endast demo. Ingen betalning tas och priserna är en hypotes.",
    free: "Gratis",
    always: "Alltid gratis i alla paket",
    alwaysList: ["Är det här bedrägeri? -kontroll", "Analys av länk och meddelande", "Stoppa skadan och Räddningsläge", "Överlämning till en person vid behov"],
    plans: {
      free: { name: "SafeStep Gratis", price: "0 €", tagline: "I DNA-appen", features: ["Tydligt nästa steg och varför", "Kontroll av länk och meddelande", "Räddningsläge"] },
      bundle: { name: "DNA Säkerhetspaket", price: "2,99 € / mån", tagline: "Ingår i DNA Digiturva", features: ["Allt i Gratis", "Kontroll av DNA-data med ditt samtycke", "Beslutsrapport att spara eller dela", "Förtur till en DNA-rådgivare"] },
      business: { name: "DNA Företagssäkerhet", price: "9 € / mån per företag", tagline: "Tillägg till DNA Business, upp till 10 användare", features: ["Allt i Säkerhetspaketet", "Kontroll av personalkonton och åtkomst", "Kontroll av faktura- och betalningsbedrägeri", "Rapport till försäkringsbolag eller polis", "Säkerhetsstöd för företag"] },
    },
    locked: {
      signals: "Kontroll av DNA-data för det här ärendet ingår i DNA Säkerhetspaket.",
      business_signals: "Kontroll av personalkonton ingår i DNA Företagssäkerhet.",
      report: "Beslutsrapporten ingår i DNA Säkerhetspaket.",
      priority: "Förtur ingår i DNA Säkerhetspaket.",
    },
    seePlans: "Visa paket",
    continueWithout: "Fortsätt utan",
    priority: "Förtursskö",
    standard: "Vanlig kö",
    upgradedTo: "Paketet byttes till",
    recommended: "Rekommenderas för dig",
    unlocksNow: "Låses upp för det här ärendet",
    perYear: "Faktureras månadsvis, avsluta när du vill",
  },
};
