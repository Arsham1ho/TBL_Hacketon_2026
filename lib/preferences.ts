// Display preferences, kept on this device only.
export type Preferences = { theme: "system" | "light" | "dark"; text: "normal" | "large"; motion: "on" | "off" };

// Light is the default for new visitors. Dark and System are a choice in Settings.
export const DEFAULT_PREFERENCES: Preferences = { theme: "light", text: "normal", motion: "on" };
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

// Runs before the page paints, so a saved dark theme doesn't flash white first. Without a
// saved choice the page stays light; "system" follows the device.
export const PREFERENCES_SCRIPT = `try{var p=JSON.parse(localStorage.getItem("${PREFERENCES_KEY}")||"{}"),r=document.documentElement,t=p.theme||"light";if(t==="system")delete r.dataset.theme;else r.dataset.theme=t;if(p.text)r.dataset.text=p.text;if(p.motion==="off")r.dataset.motion="reduce"}catch(e){}`;
