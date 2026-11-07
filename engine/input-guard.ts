import type { SecretKind } from "./types";

// Runs before any LLM call, log or summary. It records that a secret was shared,
// never its value. Over-masking is acceptable; a missed secret is not.

const WORD_START = String.raw`(?<![\p{L}\p{N}])`;
const WORD_END = String.raw`(?![\p{L}\p{N}])`;

const CARD_DIGITS = new RegExp(String.raw`${WORD_START}\d(?:[ .\-\u00A0]{0,3}\d){12,18}${WORD_END}`, "gu");
const CARD_WORD = /(?:kortti|kortin|kort|card|visa|mastercard)/iu;
const CARD_WORD_WINDOW = 40;
// IBANs are evidence in payment fraud, not secrets, so they stay readable.
const IBAN_PREFIX = /[A-Z]{2}\d{2}[ -]$/u;

// Length limits cover real compounds and inflections, and keep matching linear on hostile input.
const PREFIX = String.raw`[\p{L}-]{0,30}`;
const SUFFIX = String.raw`[\p{L}:-]{0,12}`;

// Hyphens are part of the prefix, so a long hyphenated run has only one starting point.
const COMPOUND_START = String.raw`(?<![\p{L}\p{N}-])`;

const CODE_WORD = String.raw`(?:${WORD_START}pin${SUFFIX}|${COMPOUND_START}${PREFIX}(?:koodi|kood|kod|code|tunnusluku|tunnusluv|vahvistusnumero|otp|cvv|cvc)${SUFFIX})`;
const CODE_VALUE = String.raw`\d(?:[ .-]?\d){2,9}`;
const MIXED_CODE = String.raw`(?=[A-Za-z0-9-]{0,12}\d)(?=[A-Za-z0-9-]{0,12}[A-Za-z])[A-Za-z0-9-]{4,12}`;
const CODE_FILLER = String.raw`[^\d.!?+]{0,48}?`;
const CODE_AFTER_WORD = new RegExp(`(${CODE_WORD}${CODE_FILLER})(?<![+\\p{N}])(${CODE_VALUE}|${MIXED_CODE})${WORD_END}`, "giu");
const CODE_BEFORE_WORD = new RegExp(`${WORD_START}(${CODE_VALUE})(${CODE_FILLER}${CODE_WORD})`, "giu");

const PASSWORD_WORD = String.raw`${COMPOUND_START}${PREFIX}(?:salasana|password|passwd|pwd|passphrase|lösenord|losenord)${SUFFIX}`;
const PASSWORD_LINK = String.raw`(?:\s{0,4}(?:[=:]|(?:is|was|on|oli|är|ar|var|nyt|now|nu)(?=[\s"'“”]|$))){1,4}\s{0,4}`;
// Words that describe a password rather than being one, as in "the password is still the default".
const NOT_A_VALUE = String.raw`(?!(?:still|the|same|my|not|weak|default|changed|reset|stolen|leaked|hacked|wrong|expired|compromised|edelleen|vielä|sama|se|ei|heikko|vaihdettu|muutettu|varastettu|vuotanut|väärä|fortfarande|samma|det|inte|svagt|ändrat|stulet|läckt|fel)${WORD_END})`;
const PASSWORD_VALUE = String.raw`${NOT_A_VALUE}(?:"[^"\n]{1,200}"|'[^'\n]{1,200}'|“[^”\n]{1,200}”|\S+)`;
const PASSWORD_LISTED = new RegExp(`(${PASSWORD_WORD})(\\s{0,4}[=:]\\s{0,4})(${NOT_A_VALUE}[^\\n.,;!?]{1,60})`, "giu");
const PASSWORD_DIRECT = new RegExp(`(${PASSWORD_WORD})(${PASSWORD_LINK})(${PASSWORD_VALUE})`, "giu");
// Catches "password hunter2" and "the password I used was hunter2": a few plain words,
// then a token with a digit or symbol. Links stay readable as evidence.
const PASSWORD_GAP = String.raw`(?:\s+[^\s\d]{1,20}){0,5}\s+`;
const PASSWORD_TOKEN = String.raw`(?!https?:|www\.)(?=\S{0,60}[\d!@#$%&*])\S{4,60}`;
const PASSWORD_NEARBY = new RegExp(`(${PASSWORD_WORD})(${PASSWORD_GAP})(${PASSWORD_TOKEN})`, "giu");
// Short words like "pass" have other meanings, so they need a token that looks like a password.
const PASSWORD_SHORT = new RegExp(`(${WORD_START}(?:pw|pass))(${PASSWORD_LINK})(${PASSWORD_TOKEN})`, "giu");
const PASSWORD_FIRST = new RegExp(
  `${WORD_START}${PASSWORD_TOKEN}(\\s+(?:was|is|oli|on|var|är|ar)\\s+(?:(?:my|the|our|minun|mun|min|mitt|vår)\\s+)?${PASSWORD_WORD})`,
  "giu",
);

// Numbers typed together, like a card then its CVV, hide the card inside a longer run.
function containsCard(digits: string): boolean {
  for (let length = 13; length <= Math.min(19, digits.length); length++) {
    if (passesLuhn(digits.slice(0, length))) return true;
  }
  return false;
}

function passesLuhn(digits: string): boolean {
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = Number(digits[i]);
    if (double) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    double = !double;
  }
  return sum % 10 === 0;
}

export type MaskResult = { text: string; found: SecretKind[] };

export function maskSecrets(input: string): MaskResult {
  const found = new Set<SecretKind>();

  const maskPassword = (_match: string, word: string, link: string) => {
    found.add("password");
    return `${word}${link}[PASSWORD]`;
  };
  let text = input.replace(PASSWORD_FIRST, (_match, rest: string) => {
    found.add("password");
    return `[PASSWORD]${rest}`;
  });
  text = text
    .replace(PASSWORD_LISTED, maskPassword)
    .replace(PASSWORD_DIRECT, maskPassword)
    .replace(PASSWORD_NEARBY, maskPassword)
    .replace(PASSWORD_SHORT, maskPassword);

  text = text.replace(CARD_DIGITS, (match, offset: number, whole: string) => {
    const digits = match.replace(/\D/g, "");
    if (digits.length < 13 || digits.length > 19) return match;
    if (IBAN_PREFIX.test(whole.slice(Math.max(0, offset - 5), offset))) return match;
    // A mistyped card number fails Luhn but is still a secret, so nearby card words count too.
    const before = whole.slice(Math.max(0, offset - CARD_WORD_WINDOW), offset);
    if (!containsCard(digits) && !CARD_WORD.test(before)) return match;
    found.add("card_number");
    return "[CARD_NUMBER]";
  });

  text = text.replace(CODE_AFTER_WORD, (_match, prefix: string) => {
    found.add("code");
    return `${prefix}[CODE]`;
  });
  text = text.replace(CODE_BEFORE_WORD, (_match, _code: string, suffix: string) => {
    found.add("code");
    return `[CODE]${suffix}`;
  });

  return { text, found: [...found] };
}

// Stops incident content closing its own delimiter and posing as instructions.
const DELIMITER_LOOKALIKE = /<\s*\/?\s*(?:incident[_ -]?content|user[_ -]?report)[^>\n]{0,200}>?/giu;

function removeDelimiters(text: string): string {
  return text.replace(DELIMITER_LOOKALIKE, "[removed tag]");
}

export function wrapIncidentContent(content: string): string {
  return `<incident_content>\n${removeDelimiters(content)}\n</incident_content>`;
}

const MAX_INPUT_CHARS = 10_000;

export type GuardedInput = {
  userText: string;
  incidentContent: string | null;
  maskedIncident: string | null;
  secretsFound: SecretKind[];
};

export function guardInput(userText: string, incidentContent: string | null = null): GuardedInput {
  const user = maskSecrets(userText.slice(0, MAX_INPUT_CHARS));
  const incident = incidentContent === null ? null : maskSecrets(incidentContent.slice(0, MAX_INPUT_CHARS));
  return {
    // Users often paste the scam straight into their own message.
    userText: removeDelimiters(user.text),
    incidentContent: incident && wrapIncidentContent(incident.text),
    maskedIncident: incident && removeDelimiters(incident.text),
    secretsFound: [...new Set([...user.found, ...(incident?.found ?? [])])],
  };
}
