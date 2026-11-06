import { fold } from "./offline-extractor";
import type { Language } from "./types";

export type ReadAnswer = "yes" | "no" | "unsure";

const word = (source: string) => new RegExp(fold(String.raw`(?<![\p{L}:])(${source})(?![\p{L}])`), "iu");

const UNSURE = new RegExp(fold(String.raw`not sure|don't know|do not know|can't say|no idea|maybe|perhaps|en ole varma|en tiedä|en osaa sanoa|en muista|ehkä|inte säker|vet inte|kanske|minns inte`), "iu");
// "en" and "et" are "not" in Finnish but ordinary words in Swedish and English.
const NEGATIVE: Record<Language, RegExp> = {
  en: word(String.raw`no|nope|not|never|nothing|didn't|haven't|hasn't|wasn't|isn't|don't`),
  fi: word(String.raw`ei|en|et|emme|eivät|enkä|no|not`),
  sv: word(String.raw`nej|inte|aldrig|inget|ingen|no|not`),
};
const POSITIVE = word(String.raw`yes|yeah|yep|i did|i have|it was|myself|i clicked|i pressed|i moved|ordered|logged in|kyllä|joo|juu|tein|teimme|itse|painoin|klikkasin|tilasi|tilasin|ja|jo|gjorde|själv|klickade|beställde|tryckte|asensin|installerade`);

// Only the first clause counts: in "I clicked it, but nothing appeared" the answer
// is yes. Anything it can't read is unsure, which keeps the fact unknown.
const CLAUSE_BREAK = /\s(?:but|mutta|men|vaan)\s/iu;

export function readAnswerOffline(reply: string, language: Language): ReadAnswer {
  const clause = fold(reply).split(CLAUSE_BREAK)[0];
  if (UNSURE.test(clause)) return "unsure";
  if (NEGATIVE[language].test(clause)) return "no";
  return POSITIVE.test(clause) ? "yes" : "unsure";
}
