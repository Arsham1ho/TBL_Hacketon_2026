import type { InterruptionKind } from "./interruption";
import { fold } from "./offline-extractor";

// Fast danger check: deterministic, multilingual pause while structured extraction is pending.
// Live danger shows Stop without waiting for the LLM.

const re = (p: string) => new RegExp(fold(p), "iu");

const PERSONAL_SAFETY = [
  re(String.raw`\b(ex[- ]?(husband|wife|partner|spouse)|stalker|stalking|tracking my (phone|location)|tracks my phone|watches my phone|installed spyware|monitoring my phone)\b`),
  re(String.raw`\b(ex[- ]?(mieheni|vaimoni|kumppani\w*)|seuranta|seuraa (minua|puhelintani|sijaintiani)|stalkkaa|pelkään että seuraa|vakoiluohjelma|valvoo puhelintani)\b`),
  re(String.raw`\b(ex[- ]?(man|fru|partner)|spårar min telefon|övervakar min telefon|stalkar mig|installerat spionprogram|spårar min position)\b`),
  re(String.raw`\b(doctor|physician|ambulance|hospital|medical emergency|need a doctor|call an ambulance|lääkär\w*|ambulanssi|sairaala|hätätila|ensiapu|läkare|ambulans|sjukhus)\b`),
];

const PERSONAL_EXCLUSIONS = [
  re(String.raw`\bex[- ]?(colleague|työkaveri|kollega|boss|pomo|employee)\b`),
];

const RANSOMWARE = [
  re(String.raw`\b(files are encrypted|encrypted all files|ransomware|pay ransom|pay a ransom|screen is locked.*pay)\b`),
  re(String.raw`\b(tiedostot (on |ovat )salattu|kiristysohjelma|maksa lunn\w*|näyttö on lukittu.*maksa)\b`),
  re(String.raw`\b(filerna är krypterade|ransomware|kräver lösensumma|betala lösensumma|skärmen är låst.*betala)\b`),
];

const SELF_INITIATED = [
  re(String.raw`\b(i called|i contacted|booked|i booked|my own login|i initiated|verified myself)\b`),
  re(String.raw`\b(soitin itse|otin itse yhteyttä|tilasin|oma kirjautuminen|itse aloittamani|varmistin itse)\b`),
  re(String.raw`\b(jag ringde|kontaktade själv|bokade|egen inloggning|verifierade själv)\b`),
];

const LIVE_INDICATORS = [
  re(String.raw`\b(now|right now|still on the (line|phone)|calling me (now|right now)|someone is calling|caller (right now )?is|on the phone|on the line|on a (phone )?call|at this moment|currently connected|remote session)\b`),
  re(String.raw`\b(puhelimessa|parhaillaan|juuri nyt|linjalla|soittaa parhaillaan|soittaa minulle nyt|puhuu parhaillaan|vielä puhelimessa|yhteys on auki)\b`),
  re(String.raw`\b(i telefonen?|just nu|på tråden|ringer mig nu|pratar parhaillaan|sitter i telefonen nu|fortfarande i telefon|ansluten just nu)\b`),
];

const NEGATIONS = re(String.raw`\b(didn't|did not|haven't|have not|refused|declined|hung up|never|stopped|en|emme|älä|kieltäydyin|lopetin|suljin puhelun|en antanut|inte|har inte|nekade|lade på|avbröt|gav inte)\b`);

export function fastDanger(text: string): InterruptionKind | null {
  if (!text || !text.trim()) return null;
  const raw = text.trim();
  const folded = fold(raw);

  // 1. Personal safety always interrupts first
  if (PERSONAL_SAFETY.some((rx) => rx.test(folded)) && !PERSONAL_EXCLUSIONS.some((rx) => rx.test(folded))) {
    return "personal_safety";
  }

  // 2. Self-initiated or verified actions do not trigger immediate stop interruption
  // A legitimate booking does not authorise a separate live request for secrets,
  // money or access. Do not suppress those requests merely because both appear.
  const separateRequest = re(String.raw`\b(asking|asks|asked|wants|tells|telling|demands|insists|pyytää|pyysi|vaatii|ber|kräver)\b.{0,80}\b(code|pin|password|money|transfer|approve|koodi|salasana|raha|kod|lösenord|pengar)\w*`).test(folded);
  if (SELF_INITIATED.some((rx) => rx.test(folded)) && !separateRequest) {
    return null;
  }

  // 3. Ransomware interrupts immediately even without explicit phone call
  if (RANSOMWARE.some((rx) => rx.test(folded))) {
    return "ransomware";
  }

  // 4. Must be live threat
  const isLive = LIVE_INDICATORS.some((rx) => rx.test(folded));
  if (!isLive) return null;

  // 5. Check requests in priority order
  // remote_access
  if (re(String.raw`\b(anydesk|teamviewer|quicksupport|ultraviewer|rustdesk|remote (desktop|access|control|support)|control my (device|computer|phone)|etäyhtey\w*|etätuki|hallita laitetta|fjärråtkomst|fjärrsupport|styra (datorn|enheten|telefonen))\b`).test(folded)) {
    return "remote_access";
  }

  // Inflected forms such as "lataavan" and "laddar ner" count as a request to install.
  if (re(String.raw`\b(latau\w*|lataa\w*|lataam\w*|asenta\w*|laddar ner|ladda ner|installerar)\b`).test(folded)) {
    return "app_install";
  }

  // app_install
  if (re(String.raw`\b(install|download|asenna|lataa|installera|ladda ner|pyytää (asentamaan|lataamaan)|ber att installera) (the |an |your )?(security |turva\w* |säkerhets\w* )?(app|application|software|program|tool|sovellus|ohjelma|turvasovellus|appen|programmet)\b`).test(folded)) {
    return "app_install";
  }

  // code
  const codeMatch = re(String.raw`\b(read out|tell me|give me|send|type|share|enter|asking for|ask for|asks for|lue\w*|anna\w*|kerro\w*|lähet\w*|syöt\w*|jaa\w*|pyytä\w*|läs\w*|ange\w*|säg\w*|skicka\w*|ge\w*|dela\w*|ber\w*).{0,30}\b(code|pin|passcode|sms[- ]koodi\w*|koodi\w*|tunnusluku\w*|vahvistuskoodi\w*|kertakäyttökoodi\w*|koden|engångskoden|sms[- ]koden|verifieringskoden|pin[- ]koden|kod\w*)\b`).exec(folded);
  if (codeMatch) {
    const prefix = folded.slice(Math.max(0, codeMatch.index - 30), codeMatch.index);
    if (!NEGATIONS.test(prefix)) {
      return "code";
    }
  }

  // approval
  if (re(String.raw`\b(approve (the |this |a |an )?(login|request|prompt|sign[- ]?in)|mfa prompt|push notification.*approve|authenticator prompt|hyväksy\w* (kirjautumi\w*|pyyntö\w*|vahvistus\w*)|mfa[- ]pyyntö|godkänn\w* (en )?(inloggning\w*|begäran)|mfa[- ]begäran)\b`).test(folded)) {
    return "approval";
  }

  // A "safe account" is a scam by definition, whoever claims to be calling.
  if (re(String.raw`safe account|turvatili|säkert konto|säkerhetskonto|(move|transfer) .{0,20}savings|siirtä\w* .{0,12}säästö|flytta .{0,20}besparing`).test(folded)) {
    return "money";
  }

  // money
  if (re(String.raw`\b(transfer|send|wire|pay|siirtä\w*|siirrä\w*|lähetä\w*|maksa\w*|käskee siirtää|för\w* över|skicka\w*|betala\w*) (money|funds|euros|eur|cash|rahaa|rahat|euroa|pengar|pengarna).{0,35}(now|urgently|safe account|heti|kiireellisesti|turvatilille|nu|direkt|säkert konto)\b`).test(folded)) {
    return "money";
  }
  if (re(String.raw`\b(transfer|payment|send money|siir\w*|maks\w*|överför\w*|betal\w*)\b`).test(folded) && re(String.raw`\b(safe account|turvatilille|säkert konto|urgently|heti|nu)\b`).test(folded)) {
    return "money";
  }

  // card
  if (re(String.raw`\b(card number|card details|credit card|debit card|cvv|kortin numero|korttitiedot|luottokortti|pankkikortti|kortnummer|kortuppgifter|kreditkort|bankkort)\b`).test(folded)) {
    return "card";
  }

  // login
  if (re(String.raw`\b(banking credentials|bank password|online banking login|enter your password|verkkopankkitunnuk\w*|pankkitunnuk\w*|anna salasana|syötä salasana|bankinloggning|bankdosa|lösenord|ange ditt lösenord)\b`).test(folded)) {
    return "login";
  }

  // bank_change
  if (re(String.raw`\b(bank (account|details) (has|have) changed|new bank account for (invoice|payment)|tilinumero (on )?muuttunut|uusi tilinumero|bankkontot har ändrats|nytt bankkonto)\b`).test(folded)) {
    return "bank_change";
  }

  // live impostor / fake authority or bank call
  if (re(String.raw`\b(pretend\w*|fake|claiming to be|claims to be|valepoliisi|tekeytyy|esittäytyy)\b`).test(folded)) {
    return "live_request";
  }

  return null;
}

export const fastDangerCheck = fastDanger;
