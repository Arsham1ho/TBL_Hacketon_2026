import type { ApiResponse, Screen } from "../engine/screens";
import { mockResponse } from "./screens";

// Fixed examples for reviewing a single screen in development. They are never shown in production.
const resultWith = (statusLabel: string, extra: Partial<Extract<Screen, { type: "result" }>>): Screen => {
  const base = mockResponse("result").screen as Extract<Screen, { type: "result" }>;
  return { ...base, statusLabel, ...extra };
};

const unsureResult = resultWith("Needs checking", {
  steps: [],
  branches: [
    { condition: "If you typed your card details:", steps: ["Contact your bank now on the number on your card or in its own app."] },
    { condition: "If you entered nothing:", steps: ["Delete the message or report it as a scam."] },
  ],
  confidence: "We can't tell yet, so this covers both answers.",
  unknowns: ["Whether card details were entered"],
});

const safeResult = resultWith("Looks safe", {
  steps: ["No action is needed."],
  reason: "This looks genuine because it has no link and asks for nothing.",
  confidence: "If anything changes, you can check again.",
  sources: [],
});

const respond = (type: Screen["type"], overrides: Partial<ApiResponse> = {}): ApiResponse => ({
  ...mockResponse(type),
  ...overrides,
});

const WITH_STATUS = {
  check: { status: "needs_verification", risk: "medium", urgency: "today", destination: null, externalContacts: [] },
  safe: { status: "safe", risk: "none", urgency: "none", destination: null, externalContacts: [] },
} satisfies Record<string, ApiResponse["state"]>;

// Direct links for reviewing one screen, such as /?screen=fallback.
export function demoScreen(name: string): ApiResponse | null {
  switch (name) {
    case "stop":
    case "flip":
    case "unlock":
    case "rescue":
    case "handoff":
    case "fallback":
    case "end":
      return respond(name);
    case "threat":
      return respond("result");
    case "unsure":
      return respond("result", { screen: unsureResult, state: WITH_STATUS.check });
    case "safe":
      return respond("result", { screen: safeResult, state: WITH_STATUS.safe });
    default:
      return null;
  }
}
