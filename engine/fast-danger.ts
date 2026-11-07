import type { InterruptionKind } from "./interruption";

// Conservative, multilingual pause while structured extraction is pending.
export function fastDanger(text: string): InterruptionKind | null {
  const live = /\b(now|right now|still on the line|just nu|fortfarande|nu|juuri nyt|nyt|linjalla)\b/iu.test(text);
  if (!live) return null;
  const demand = /\b(ask(?:s|ing|ed)?|request(?:s|ing|ed)?|want(?:s|ing|ed)?|tell(?:s|ing)? me|pyyt\w*|kysy\w*|vaati\w*|ber om|fråga\w*|kräv\w*)\b/iu.test(text);
  if (demand && /\b(code|codes|pin|koodi\w*|tunnuslu\w*|kod\w*)\b/iu.test(text)) return "code";
  if (/\b(remote access|remote support|etäyhtey\w*|etätuki|fjärråtkomst|fjärrhjälp)\b/iu.test(text)) return "remote_access";
  if (/\b(transfer|payment|send money|siir\w*|maks\w*|överför\w*|betal\w*)\b/iu.test(text)) return "money";
  return null;
}
