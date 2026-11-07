import type { Language } from "./types";

const FINNISH = /(?<![\p{L}])(ja|ei|on|en|et|että|mitä|mutta|onko|tämä|minä|sain|mulle|mun|olen|apua|voitko|pitää|miten|kun|jos|viesti\w*|linki\w*|huijau\w*|puhelu\w*|soitti|maksa\w*|pankki\w*|tietokone\w*|teen|tehdä|tiedä|hyvä|kiitos|hei|moi|terve|päivää|huomenta|kyllä|joo)(?![\p{L}])/giu;
const SWEDISH = /(?<![\p{L}])(och|är|att|det|jag|inte|vad|hur|min|mitt|mig|fick|har|ska|kan|hjälp|från|för|på|med|ett|bedrägeri|meddelande\w*|länk\w*|banken|samtal|ringde|betala\w*|tack|hej|vet|hallå|tjena|ja|nej)(?![\p{L}])/giu;
const ENGLISH = /(?<![\p{L}])(the|and|is|to|my|i|it|this|that|what|how|have|got|from|with|please|help|should|was|a|an|of|in|for|not|do|hello|hi|hey|yes|no|can|could|will|would|need|me|you|we|they|them|are|were|be|been|had|has|did|does|get|received|just|now|scam|scammed|message|call|called|caller|phone|link|card|code|money|bank|account|email|suspicious|worried|weird)(?![\p{L}])/giu;

const count = (pattern: RegExp, text: string) => text.match(pattern)?.length ?? 0;

// Word counts only. A reply in the wrong language is a nuisance, not a safety risk,
// and the user can always pick the language by hand.
export function detectLanguage(text: string, fallback: Language = "fi"): Language {
  const scores: [Language, number][] = [
    ["fi", count(FINNISH, text)],
    ["sv", count(SWEDISH, text)],
    ["en", count(ENGLISH, text)],
  ];
  const [best, score] = scores.reduce((top, next) => (next[1] > top[1] ? next : top));
  return score === 0 || scores.filter(([, value]) => value === score).length > 1 ? fallback : best;
}
