// Display preferences, kept on this device only.
export type Preferences = { theme: "system" | "light" | "dark"; text: "normal" | "large"; motion: "on" | "off" };

export const DEFAULT_PREFERENCES: Preferences = { theme: "system", text: "normal", motion: "on" };
export const PREFERENCES_KEY = "safestep-preferences";

export function loadPreferences(): Preferences {
  try {
    return { ...DEFAULT_PREFERENCES, ...JSON.parse(localStorage.getItem(PREFERENCES_KEY) ?? "{}") };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function applyPreferences(preferences: Preferences) {
  const root = document.documentElement;
  if (preferences.theme === "system") delete root.dataset.theme;
  else root.dataset.theme = preferences.theme;
  root.dataset.text = preferences.text;
  root.dataset.motion = preferences.motion === "off" ? "reduce" : "full";
}

export function savePreferences(preferences: Preferences) {
  applyPreferences(preferences);
  try {
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences));
  } catch {}
}

// True when animations should be skipped, by system setting or the app's own.
export const motionReduced = () =>
  document.documentElement.dataset.motion === "reduce" || window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Runs before the page paints, so a saved dark theme doesn't flash white first.
export const PREFERENCES_SCRIPT = `try{var p=JSON.parse(localStorage.getItem("${PREFERENCES_KEY}")||"{}"),r=document.documentElement;if(p.theme&&p.theme!=="system")r.dataset.theme=p.theme;if(p.text)r.dataset.text=p.text;if(p.motion==="off")r.dataset.motion="reduce"}catch(e){}`;
