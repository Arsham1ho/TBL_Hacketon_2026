import type { ApiResponse, Screen } from "../engine/screens";
import type { SafeStepClient, UiRequest } from "../lib/client";
import { mockResponse } from "./screens";

// A fixed click-through of every screen, for building the UI. It reads nothing the user
// types and makes no decisions, so all real logic stays in the engine.
const RESCUE_STEPS = [
  {
    id: "contact_operator",
    title: "Contact your operator's support",
    detail: "Use the official number or the app, and ask them to lock your SIM and number.",
    userAction: true,
  },
  {
    id: "change_bank_password",
    title: "Change your bank app password",
    detail: "Open your bank's own app. Do not use links from messages.",
    userAction: true,
  },
  {
    id: "tell_close_people",
    title: "Tell people close to you",
    detail: "Let them know messages from your number may not be from you.",
    userAction: false,
  },
];

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
  incident: { status: "incident_occurred", risk: "critical", urgency: "immediate", destination: "operator_support_agent", externalContacts: ["bank"] },
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

export function createMockClient(): SafeStepClient {
  let rescueIndex = 0;
  const rescue = () =>
    respond("rescue", {
      screen: { type: "rescue", step: RESCUE_STEPS[rescueIndex]!, position: rescueIndex + 1, total: RESCUE_STEPS.length },
      state: WITH_STATUS.incident,
    });
  const handoffSummary = (mockResponse("handoff").screen as Extract<Screen, { type: "handoff" }>).summary;
  const handoff = () => respond("handoff", { state: WITH_STATUS.incident, summary: handoffSummary });

  const next = (request: UiRequest): ApiResponse => {
    switch (request.kind) {
      case "start":
        return respond("stop");
      case "continue":
        return respond("flip", { state: WITH_STATUS.check });
      case "answer":
        if (request.answer === "yes") return respond("unlock", { state: WITH_STATUS.incident });
        return request.answer === "no" ? respond("result") : respond("result", { screen: unsureResult, state: WITH_STATUS.check });
      case "consent":
        rescueIndex = 0;
        return rescue();
      case "rescue":
        rescueIndex += 1;
        return rescueIndex < RESCUE_STEPS.length ? rescue() : handoff();
      case "talk_to_person":
        return handoff();
      case "handoff":
        return handoff();
    }
  };

  return {
    send: async (request) => {
      await new Promise((resolve) => setTimeout(resolve, request.kind === "start" ? 1200 : 150));
      return next(request);
    },
    end: async () => respond("end"),
  };
}

export const mockClient = createMockClient();
