import type { Language } from "./types";

export type ManipulationCue = { kind: "relationship" | "authority" | "channel_change" | "urgency" | "secrecy" | "fear" | "scarcity" | "reward" | "social_proof" | "guilt" | "verification_pretext"; quote: string };

// These are observable claims, not a verdict about the sender's intent.
const PATTERNS: { kind: ManipulationCue["kind"]; pattern: RegExp }[] = [
  { kind: "relationship", pattern: /\b(?:mom|mum|mother|dad|father|son|daughter|grandchild|boss|colleague)\b|\b(?:äiti|isä|poika|tytär|pomo|kollega)\b|\b(?:mamma|pappa|son|dotter|chef|kollega)\b/iu },
  { kind: "authority", pattern: /\b(?:police|bank|tax office|operator|poliisi|pankki|operaattori|polis|banken|operatör)\b/iu },
  { kind: "channel_change", pattern: /(?:lost|broke|changed|new) (?:my |the )?phone|(?:this is|from) my new (?:number|phone)|(?:uusi|uudesta) (?:numero|puhelin)|(?:puhelin|numero) (?:katosi|vaihtui|hajosi)|(?:nytt|nya) (?:nummer|telefon)|(?:tappat|trasig) (?:telefon|mobil)/iu },
  { kind: "urgency", pattern: /\b(?:now|today|immediately|urgent|right away|asap|heti|nyt|tänään|kiire|omedelbart|genast|bråttom|idag)\b/iu },
  { kind: "secrecy", pattern: /(?:don't|do not) tell|keep (?:it )?(?:secret|confidential)|älä kerro|pidä (?:salassa|salaisuutena)|berätta inte|håll (?:det )?hemligt/iu },
  { kind: "fear", pattern: /(?:account|tili|konto).{0,30}(?:closed|locked|suljetaan|lukitaan|spärras|stängs)|(?:police|poliisi|polis).{0,30}(?:arrest|pidättää|griper)/iu },
  { kind: "scarcity", pattern: /(?:only|last) (?:\d+ )?(?:spots?|places?|tickets?|left)|offer ends|limited time|vain \d+ (?:paikkaa|jäljellä)|viimeinen mahdollisuus|rajoitetun ajan|bara \d+ (?:platser|kvar)|sista chansen|begränsad tid/iu },
  { kind: "reward", pattern: /(?:you(?:'ve| have) won|claim your (?:prize|reward)|free (?:gift|prize)|guaranteed (?:profit|return)|voitit|lunasta (?:palkinto|voitot)|ilmainen lahja|taattu tuotto|du har vunnit|hämta ditt pris|gratis gåva|garanterad avkastning)/iu },
  { kind: "social_proof", pattern: /(?:everyone|all your (?:friends|colleagues)|other customers) (?:has|have|already|did|are)|kaikki muut (?:ovat|tekivät)|muut asiakkaat ovat|alla andra (?:har|gjorde)|andra kunder har/iu },
  { kind: "guilt", pattern: /(?:if you (?:really )?(?:care|love|trust) me|don't you trust me|you(?:'ll| will) let me down|jos (?:oikeasti )?(?:välität|minua rakastat|luotat minuun)|etkö luota minuun|om du (?:verkligen )?(?:bryr dig|älskar mig|litar på mig)|litar du inte på mig)/iu },
  { kind: "verification_pretext", pattern: /(?:verify|confirm|secure) (?:your )?(?:account|identity|payment|login)|(?:send|share|read out|give) (?:me |us |the )?(?:verification|security|one.time) code|vahvista (?:tilisi|henkilöllisyytesi|maksu|kirjautuminen)|lähetä (?:vahvistus|turva)koodi|bekräfta (?:ditt konto|din identitet|betalningen|inloggningen)|skicka (?:verifierings|säkerhets)kod/iu },
];

export function detectManipulationCues(text: string): ManipulationCue[] {
  return PATTERNS.flatMap(({ kind, pattern }) => {
    const match = pattern.exec(text);
    return match ? [{ kind, quote: match[0] }] : [];
  });
}

const EXPLANATION: Record<Language, Record<ManipulationCue["kind"], string>> = {
  en: { relationship: "claims a personal or work relationship", authority: "claims authority", channel_change: "moves contact to a new number or phone", urgency: "presses for a quick response", secrecy: "asks for secrecy", fear: "uses a threat of loss or punishment", scarcity: "claims the opportunity is about to disappear", reward: "promises a reward", social_proof: "claims others have already complied", guilt: "uses guilt or loyalty", verification_pretext: "frames a sensitive action as account verification" },
  fi: { relationship: "vetoaa läheiseen tai työrooliin", authority: "vetoaa viranomaiseen tai palveluun", channel_change: "siirtää yhteyden uuteen numeroon tai puhelimeen", urgency: "kiirehtii vastausta", secrecy: "pyytää pitämään asian salassa", fear: "uhkaa menetyksellä tai seuraamuksella", scarcity: "väittää mahdollisuuden loppuvan pian", reward: "lupaa palkinnon", social_proof: "väittää muiden jo toimineen", guilt: "vetoaa syyllisyyteen tai lojaaliuteen", verification_pretext: "esittää arkaluonteisen toimen tilin vahvistuksena" },
  sv: { relationship: "hänvisar till en nära relation eller arbetsroll", authority: "hänvisar till en myndighet eller tjänst", channel_change: "flyttar kontakten till ett nytt nummer eller en ny telefon", urgency: "pressar fram ett snabbt svar", secrecy: "ber om hemlighållande", fear: "hotar med förlust eller följder", scarcity: "påstår att möjligheten snart försvinner", reward: "lovar en belöning", social_proof: "påstår att andra redan har gjort det", guilt: "spelar på skuld eller lojalitet", verification_pretext: "framställer en känslig åtgärd som kontoverifiering" },
};

export function manipulationExplanation(cues: ManipulationCue[], language: Language): string | null {
  if (cues.length < 2) return null;
  const priority: ManipulationCue["kind"][] = ["channel_change", "secrecy", "fear", "verification_pretext", "guilt", "authority", "relationship", "reward", "scarcity", "social_proof", "urgency"];
  const parts = [...cues].sort((a, b) => priority.indexOf(a.kind) - priority.indexOf(b.kind)).slice(0, 3).map(cue => EXPLANATION[language][cue.kind]);
  return { en: `The message ${parts.join(", ")}. These are reasons to verify the request independently, not proof of fraud.`, fi: `Viesti ${parts.join(", ")}. Tarkista pyyntö erillistä kautta; nämä merkit eivät yksin todista huijausta.`, sv: `Meddelandet ${parts.join(", ")}. Kontrollera begäran via en annan kanal; tecknen bevisar inte i sig bedrägeri.` }[language];
}

const approvedSuffixes = new Map<Language, Set<string>>();

export function isApprovedManipulationReason(reason: string, baseReasons: string[], language: Language): boolean {
  let suffixes = approvedSuffixes.get(language);
  if (!suffixes) {
    suffixes = new Set<string>();
  const kinds = Object.keys(EXPLANATION[language]) as ManipulationCue["kind"][];
    for (const first of kinds) for (const second of kinds) for (const third of [undefined, ...kinds]) {
      const cues = [first, second, third].filter((kind): kind is ManipulationCue["kind"] => kind !== undefined).map(kind => ({ kind, quote: "" }));
      const explanation = manipulationExplanation(cues, language);
      if (explanation) suffixes.add(explanation);
    }
    approvedSuffixes.set(language, suffixes);
  }
  return baseReasons.some(base => reason.startsWith(`${base} `) && suffixes!.has(reason.slice(base.length + 1)));
}
