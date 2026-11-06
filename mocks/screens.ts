import type { ApiResponse, DataReceipt, Screen } from "../engine/screens";

// One example of every screen, so the UI can be built before the session API exists.
const receipt: DataReceipt = {
  used: ["subscription.recent_events"],
  refused: ["device.security_findings"],
  notAccessed: ["operator_account.recent_logins", "credential_exposure"],
  sentToLlm: true,
};

const branches = [
  { condition: "If you typed your card details:", steps: ["Contact your bank now on the number on your card or in its own app."] },
  { condition: "If you entered nothing:", steps: ["Delete the message or report it as a scam."] },
];

const SCREENS: Record<Screen["type"], Screen> = {
  stop: {
    type: "stop",
    message: "Stop. Don't read out or type any code.",
    actions: ["End the call now. No bank, authority or operator will ask you to read out a code."],
  },
  flip: {
    type: "flip",
    topic: "card_details_entered",
    question: "Did you type your card details on that page?",
    why: "Card details change what you need to do next.",
    statusLabel: "Needs checking",
    branches,
  },
  unlock: {
    type: "unlock",
    signal: "subscription.recent_events",
    what: "Recent SIM and eSIM changes on your subscription",
    why: "It shows whether your number was moved.",
    limit: "We only use this for this check.",
    ifRefused: "You can say no and still get advice.",
  },
  result: {
    type: "result",
    statusLabel: "Threat in progress",
    steps: ["Delete the message or report it as a scam.", "Do not open the link."],
    branches: null,
    reason: "Opening a link alone rarely causes harm if you entered nothing.",
    confidence: "What you told us points clearly to this.",
    unknowns: [],
    sources: [{ id: "guidance_link_opened_no_input", title: "A link was opened, but nothing was entered" }],
  },
  rescue: {
    type: "rescue",
    step: {
      id: "contact_operator",
      title: "Contact your operator's support",
      detail: "Use the official number or the app, and ask them to lock your SIM and number.",
      userAction: true,
    },
    position: 1,
    total: 3,
  },
  handoff: {
    type: "handoff",
    destination: "operator_support_agent",
    summary: ["Your phone lost signal.", "You did not order the eSIM change."],
    omitted: ["Codes, passwords and card numbers"],
  },
  fallback: {
    type: "fallback",
    message: "We couldn't check this properly, so we can't say whether it is safe.",
    actions: ["If someone is asking you for money, a code or access right now, stop and end the contact.", "Talk to a person."],
  },
  end: { type: "end", message: "This session has ended and its data has been cleared." },
};

export function mockResponse(type: Screen["type"]): ApiResponse {
  return {
    sessionId: "mock-session",
    language: "en",
    screen: SCREENS[type],
    state: { status: "threat_in_progress", risk: "high", urgency: "today", destination: null, externalContacts: [] },
    summary: ["A link was opened."],
    secretWarning: null,
    notice: "Synthetic prototype. Not a live DNA service.",
    dataReceipt: receipt,
  };
}
