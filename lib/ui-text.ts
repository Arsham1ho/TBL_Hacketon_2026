import text from "../content/ui-text.json";
import type { Language } from "../engine/types";

export type TextKey = Exclude<keyof typeof text, "_review">;
export type Translate = (key: TextKey | (string & {})) => string;

// Unknown keys fall back to the key itself, so a new engine value can't blank the screen.
export const translator =
  (language: Language): Translate =>
  (key) =>
    (text as Record<string, Record<Language, string>>)[key]?.[language] ?? key;
