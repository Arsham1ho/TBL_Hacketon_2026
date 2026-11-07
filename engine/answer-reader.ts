import { fold } from "./offline-extractor";
import type { Language, Topic } from "./types";

export type ReadAnswer = "yes" | "no" | "unsure";

const word = (source: string) => new RegExp(fold(String.raw`(?<![\p{L}:])(${source})(?![\p{L}])`), "iu");

const UNSURE = new RegExp(fold(String.raw`not sure|don't know|do not know|can't say|no idea|maybe|perhaps|en ole varma|en tiedä|en osaa sanoa|en muista|ehkä|inte säker|vet inte|kanske|minns inte`), "iu");

// "en" and "et" are "not" in Finnish but ordinary words in Swedish, and "ja" is "and"
// in Finnish but "yes" in Swedish, so every list is per language.
const NEGATIVE: Record<Language, RegExp> = {
  en: word(String.raw`no|nope|not|never|nothing|didn't|haven't|hasn't|wasn't|isn't|don't`),
  fi: word(String.raw`ei|en|et|emme|eivät|enkä`),
  sv: word(String.raw`nej|inte|aldrig|inget|ingen`),
};
const POSITIVE: Record<Language, RegExp> = {
  en: word(String.raw`yes|yeah|yep|yup|sure|correct|that's right|true|exactly|indeed|of course|i did|i have|i was|myself|i clicked|i pressed|i moved|i ordered|they ordered|logged in|i am|i'm|i typed|i entered|i gave|i paid|i sent|i shared|i installed|i told|i transferred|i read`),
  fi: word(String.raw`kyllä|joo|juu|jep|totta|pitää paikkansa|tein|teimme|itse|painoin|klikkasin|tilasi|tilasin|annoin|olen|maksoin|syötin|kirjoitin|lähetin|asensin|kerroin|luin|siirsin`),
  sv: word(String.raw`ja|jo|japp|stämmer|precis|gjorde|själv|klickade|beställde|tryckte|installerade|jag är|betalade|skrev|angav|gav|skickade|berättade|läste|överförde`),
};
// A clear opening word decides the reply, whatever follows it.
const OPENS_YES: Record<Language, RegExp> = {
  en: /^\s*(yes|yeah|yep)\b/iu,
  fi: /^\s*(no\s+)?(kyllä|joo|juu)\b/iu,
  sv: /^\s*(ja|jo)\b/iu,
};
// "Are you safe?" flips the meaning of a negative: "not in danger" means yes.
const SAFE_NOW = new RegExp(fold(String.raw`not in danger|i'm safe|i am safe|en ole (juuri nyt |nyt )?vaarassa|olen turvassa|inte i fara|jag är trygg`), "iu");
const CLAUSE_BREAK = /\s(?:but|mutta|men|vaan)\s/iu;

// Some answers say yes or no without the words for it: "the invoice is still unpaid" is a no to
// "has the payment gone?". These are read per topic, in every language, before the general words.
const TOPIC_NO: Partial<Record<Topic, RegExp>> = {
  payment_status: new RegExp(fold(String.raw`unpaid|not (yet )?(been )?paid|haven't paid|have not paid|not sent (it )?yet|maksamatta|en ole (vielä )?maksanut|ei ole (vielä )?maksettu|emme ole (vielä )?maksaneet|obetald|inte (har )?betalat|inte betald|har inte betalat`), "iu"),
  money_transferred: new RegExp(fold(String.raw`unpaid|not (yet )?(been )?paid|haven't paid|have not paid|maksamatta|en ole (vielä )?maksanut|obetald|inte betalat|har inte betalat`), "iu"),
  business_access: new RegExp(fold(String.raw`no longer ha(s|ve) access|(don't|doesn't|do not|does not) have access|(has|have)n't (got )?access|ei (ole )?(enää )?pääsyä|ei (enää )?pääse|(har|kommer) inte (längre )?(åtkomst|åt)`), "iu"),
};
const TOPIC_YES: Partial<Record<Topic, RegExp>> = {
  payment_status: new RegExp(fold(String.raw`already paid|paid it|we paid|maksoin|maksoimme|olen maksanut|on maksettu|betalade|har betalat|redan betalat`), "iu"),
  money_transferred: new RegExp(fold(String.raw`already paid|paid it|maksoin|olen maksanut|betalade|har betalat|redan betalat`), "iu"),
  business_access: new RegExp(fold(String.raw`ha(s|ve) access|on pääsy|pääsee|har åtkomst|kommer åt`), "iu"),
};

// Anything it can't read is unsure, which keeps the fact unknown.
export function readAnswerOffline(reply: string, language: Language, topic?: Topic): ReadAnswer {
  const text = fold(reply);
  if (topic === "user_safety" && SAFE_NOW.test(text)) return "yes";
  // A hedged reply stays unsure: "not sure, maybe it's still unpaid" must not read as a firm no.
  const hedged = UNSURE.test(text);
  if (topic && !hedged && TOPIC_NO[topic]?.test(text)) return "no";
  if (topic && !hedged && TOPIC_YES[topic]?.test(text)) return "yes";
  if (OPENS_YES[language].test(text)) return "yes";
  const clause = text.split(CLAUSE_BREAK)[0];
  if (UNSURE.test(clause)) return "unsure";
  if (NEGATIVE[language].test(clause)) return "no";
  return POSITIVE[language].test(clause) ? "yes" : "unsure";
}
