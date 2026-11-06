import text from "../content/approved-text.json";
import type { InterruptionKind } from "./interruption";
import type { Language } from "./types";

export type FallbackReason = keyof typeof text.fallback;

export type FallbackScreen = { type: "fallback"; message: string; actions: string[] };
export type StopScreen = { type: "stop"; message: string; actions: string[] };

export function stopScreen(kind: InterruptionKind, language: Language): StopScreen {
  const { message, action } = text.stop[kind][language];
  return { type: "stop", message, actions: [action] };
}

// Every reason keeps the stop line, so losing the LLM never loses the warning.
export function fallbackScreen(reason: FallbackReason, language: Language): FallbackScreen {
  const { message, actions } = text.fallback[reason][language];
  return { type: "fallback", message, actions };
}
