import type { Language } from "../engine/types";

// Spots a first message that says the user received a message, email or link but didn't
// include it, so SafeStep can ask them to paste it before assessing.
const RECEIVED = [
  /\b(?:got|get|getting|received?|recieved?|recived?|have|has|was sent|sent me|keep getting|i've got|came)\b[\s\S]{0,60}\b(?:texts?|sms|messages?|massages?|msg|e-?mails?|mails?|links?|dms?|whatsapp|letters?|invoices?)\b/iu,
  /\b(?:texts?|sms|messages?|massages?|e-?mails?|links?)\b[\s\S]{0,40}\b(?:arrived|came|sent to me|i got|i received)\b/iu,
  /\b(?:sain|saan|tuli|saapui|lähetettiin|lähetti)\b[\s\S]{0,60}(?:viesti|tekstiviesti|sähköposti|linkki|meili|sms|whatsapp|lasku)/iu,
  /(?:viesti|tekstiviesti|sähköposti|linkki)[\s\S]{0,40}\b(?:tuli|saapui|sain)\b/iu,
  /\b(?:fick|får|har fått|kom|skickade)\b[\s\S]{0,60}(?:sms|meddelande|mejl|e-?post|mail|länk|whatsapp|faktura)/iu,
];

// Something is already happening, so the guidance shouldn't wait for a paste.
const ALREADY_ACTED = /\b(?:clicked|opened|typed|entered|paid|gave|shared|installed|logged in|sent (?:them|him|her) (?:money|the code)|klikkasin|avasin|syötin|maksoin|annoin|asensin|kirjauduin|klickade|öppnade|skrev in|betalade|gav|installerade|loggade in)\b/iu;

const HAS_CONTENT = /https?:\/\/|www\.|\b[a-z0-9-]+\.(?:fi|se|com|net|org|info|top|xyz|click|link|shop|online|live|icu|ly)\/|^\s*(?:from|lähettäjä|från)\s*:/imu;

export function wantsPaste(text: string): boolean {
  const value = text.trim();
  if (!value || value.length > 400) return false;
  if (HAS_CONTENT.test(value) || ALREADY_ACTED.test(value)) return false;
  return RECEIVED.some((pattern) => pattern.test(value));
}

export const pasteCopy: Record<Language, { title: string; hint: string; placeholder: string; skip: string; send: string; pasted: string }> = {
  en: {
    title: "Paste the message, email or link you received",
    hint: "Copy the whole thing: the sender, the text and any link. Don't open the link yourself. SafeStep opens it safely and checks it for you. Leave out any codes or passwords you may have typed.",
    placeholder: "Paste the message, email or link here",
    skip: "I don't have it",
    send: "Analyse",
    pasted: "Pasted content",
  },
  fi: {
    title: "Liitä saamasi viesti, sähköposti tai linkki",
    hint: "Kopioi koko viesti: lähettäjä, teksti ja mahdollinen linkki. Älä avaa linkkiä itse. SafeStep avaa sen turvallisesti ja tarkistaa sen puolestasi. Jätä pois koodit ja salasanat.",
    placeholder: "Liitä viesti, sähköposti tai linkki tähän",
    skip: "Minulla ei ole sitä",
    send: "Analysoi",
    pasted: "Liitetty sisältö",
  },
  sv: {
    title: "Klistra in meddelandet, mejlet eller länken du fick",
    hint: "Kopiera allt: avsändaren, texten och eventuell länk. Öppna inte länken själv. SafeStep öppnar den säkert och kontrollerar den åt dig. Utelämna koder och lösenord.",
    placeholder: "Klistra in meddelandet, mejlet eller länken här",
    skip: "Jag har det inte",
    send: "Analysera",
    pasted: "Inklistrat innehåll",
  },
};
