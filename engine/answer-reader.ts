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
  en: word(String.raw`yes|yeah|yep|i did|i have|myself|i clicked|i pressed|i moved|i ordered|they ordered|logged in|i am|i'm`),
  fi: word(String.raw`kyllä|joo|juu|tein|teimme|itse|painoin|klikkasin|tilasi|tilasin|annoin|olen`),
  sv: word(String.raw`ja|jo|gjorde|själv|klickade|beställde|tryckte|installerade|jag är`),
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

// Anything it can't read is unsure, which keeps the fact unknown.
export function readAnswerOffline(reply: string, language: Language, topic?: Topic): ReadAnswer {
  const text = fold(reply);
  if (topic === "user_safety" && SAFE_NOW.test(text)) return "yes";
  if (OPENS_YES[language].test(text)) return "yes";
  const clause = text.split(CLAUSE_BREAK)[0];
  if (UNSURE.test(clause)) return "unsure";
  if (NEGATIVE[language].test(clause)) return "no";
  return POSITIVE[language].test(clause) ? "yes" : "unsure";
}
