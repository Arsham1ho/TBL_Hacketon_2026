import { didAction, topicValue, type Case } from "./case";
import type { Outcome } from "./situations";
import guide from "../content/incident-guide.json";
import type { Language, Status } from "./types";

export type IncidentCategory = { label: string; title: string; description: string };

type CategoryKey = "code_theft" | "payment_fraud" | "credential_phishing" | "remote_access" | "device_compromise" | "sim_takeover" | "account_takeover" | "ransomware";

const COPY: Record<CategoryKey, Record<Language, IncidentCategory>> = {
  code_theft: {
    en: { label: "Likely incident type", title: "One-time code theft", description: "Someone may be trying to use a verification code to access an account or service as you." },
    fi: { label: "Todennäköinen tapaustyyppi", title: "Kertakäyttökoodin kalastelu", description: "Joku voi yrittää käyttää vahvistuskoodia päästäkseen tilillesi tai palveluusi sinun nimissäsi." },
    sv: { label: "Trolig händelsetyp", title: "Stöld av engångskod", description: "Någon kan försöka använda en verifieringskod för att få åtkomst till ett konto eller en tjänst i ditt namn." },
  },
  payment_fraud: {
    en: { label: "Likely incident type", title: "Payment or card fraud", description: "The contact appears designed to move money or capture card details under pressure." },
    fi: { label: "Todennäköinen tapaustyyppi", title: "Maksu- tai korttihuijaus", description: "Yhteydenoton tarkoitus näyttää olevan rahan tai korttitietojen saaminen painostamalla." },
    sv: { label: "Trolig händelsetyp", title: "Betalnings- eller kortbedrägeri", description: "Kontakten verkar vara utformad för att få pengar eller kortuppgifter genom påtryckning." },
  },
  credential_phishing: {
    en: { label: "Likely incident type", title: "Credential phishing", description: "The contact or site appears designed to capture sign-in details." },
    fi: { label: "Todennäköinen tapaustyyppi", title: "Kirjautumistietojen kalastelu", description: "Yhteydenoton tai sivuston tarkoitus näyttää olevan kirjautumistietojen saaminen." },
    sv: { label: "Trolig händelsetyp", title: "Nätfiske efter inloggningsuppgifter", description: "Kontakten eller webbplatsen verkar vara utformad för att samla inloggningsuppgifter." },
  },
  remote_access: {
    en: { label: "Likely incident type", title: "Remote-access scam", description: "Someone sought or used remote access, which can expose the device and accounts." },
    fi: { label: "Todennäköinen tapaustyyppi", title: "Etäkäyttöhuijaus", description: "Joku pyysi tai käytti etäkäyttöä, mikä voi altistaa laitteen ja tilit." },
    sv: { label: "Trolig händelsetyp", title: "Fjärråtkomstbedrägeri", description: "Någon begärde eller använde fjärråtkomst, vilket kan exponera enheten och konton." },
  },
  device_compromise: {
    en: { label: "Likely incident type", title: "Device compromise", description: "A harmful app, profile, or attachment may have affected this device." },
    fi: { label: "Todennäköinen tapaustyyppi", title: "Laitteen vaarantuminen", description: "Haitallinen sovellus, profiili tai liite on voinut vaikuttaa tähän laitteeseen." },
    sv: { label: "Trolig händelsetyp", title: "Enhetsintrång", description: "En skadlig app, profil eller bilaga kan ha påverkat den här enheten." },
  },
  sim_takeover: {
    en: { label: "Likely incident type", title: "SIM or number takeover", description: "Someone may be attempting to move your number or use a code to take control of mobile service." },
    fi: { label: "Todennäköinen tapaustyyppi", title: "SIM- tai numerokaappaus", description: "Joku voi yrittää siirtää numeroasi tai käyttää koodia mobiililiittymän hallintaan." },
    sv: { label: "Trolig händelsetyp", title: "SIM- eller nummerkapning", description: "Någon kan försöka flytta ditt nummer eller använda en kod för att ta kontroll över abonnemanget." },
  },
  account_takeover: {
    en: { label: "Likely incident type", title: "Account takeover", description: "Someone may have gained, or be trying to gain, access to an account." },
    fi: { label: "Todennäköinen tapaustyyppi", title: "Tilikaappaus", description: "Joku on voinut saada tai yrittää saada pääsyn tiliin." },
    sv: { label: "Trolig händelsetyp", title: "Kontokapning", description: "Någon kan ha fått, eller försöker få, åtkomst till ett konto." },
  },
  ransomware: {
    en: { label: "Likely incident type", title: "Ransomware", description: "The device or files appear to be held or disrupted to pressure for payment or action." },
    fi: { label: "Todennäköinen tapaustyyppi", title: "Kiristyshaittaohjelma", description: "Laitetta tai tiedostoja näyttää häirittävän tai panttaavan painostus maksamaan tai toimimaan." },
    sv: { label: "Trolig händelsetyp", title: "Ransomware", description: "Enheten eller filer verkar hållas eller störas för att pressa fram betalning eller åtgärd." },
  },
};

function supported(item: Case): boolean {
  return Object.keys(item.answers).length > 0 && (item.facts.evidence.length > 0 || item.answers.time_of_event !== undefined);
}

function categoryKey(item: Case, outcome: Outcome): CategoryKey | null {
  if (outcome.situation === "ransomware" || item.facts.incidentType === "ransomware") return "ransomware";
  if (item.facts.incidentType === "sim_or_number_change" || (item.facts.pretendsToBe === "operator" && item.facts.asksFor.includes("code"))) return "sim_takeover";
  if (item.facts.incidentType === "remote_session" || didAction(item, "gave_remote_access") || topicValue(item, "remote_access_given") === "yes") return "remote_access";
  if (item.facts.incidentType === "unwanted_app_or_profile" || item.facts.incidentType === "suspicious_attachment" || didAction(item, "installed_app")) return "device_compromise";
  if (didAction(item, "paid") || didAction(item, "entered_card") || item.facts.asksFor.includes("money") || item.facts.asksFor.includes("card")) return "payment_fraud";
  if (didAction(item, "shared_code") || item.facts.asksFor.includes("code")) return "code_theft";
  if (item.facts.incidentType === "unknown_login" || item.facts.incidentType === "mailbox_takeover" || item.facts.incidentType === "unrequested_reset") return "account_takeover";
  if (didAction(item, "entered_login") || item.facts.asksFor.includes("login") || item.facts.incidentType === "link_or_site") return "credential_phishing";
  return null;
}

export type IncidentStory = { attempted: string; prevent: string[]; investigation: { why: string; wanted: string; spot: string } };

// Always gives the user a plain account. A case with no clear type gets general guidance,
// so nothing here claims more than the rules have established.
export function incidentStory(item: Case, outcome: Outcome, status: Status): IncidentStory {
  const key = outcome.situation === "left_alone" ? "left_alone" : status === "safe" ? "harmless" : outcome.situation === "personal_safety" ? "personal_safety" : categoryKey(item, outcome) ?? "general";
  const { attempted, why, wanted, spot, prevent } = guide[key][item.language];
  return { attempted, prevent, investigation: { why, wanted, spot } };
}

export function incidentCategory(item: Case, outcome: Outcome, status: Status, hasUnknownDecisiveFact: boolean): IncidentCategory | null {
  if ((status !== "threat_in_progress" && status !== "incident_occurred") || hasUnknownDecisiveFact || !supported(item)) return null;
  const key = categoryKey(item, outcome);
  return key ? COPY[key][item.language] : null;
}

export function isApprovedIncidentCategory(value: IncidentCategory, language: Language): boolean {
  return Object.values(COPY).some(copy => {
    const expected = copy[language];
    return expected.label === value.label && expected.title === value.title && expected.description === value.description;
  });
}
