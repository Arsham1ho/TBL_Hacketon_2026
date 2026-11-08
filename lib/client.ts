import type { ApiRequest, ApiResponse, HandoffDetails, SupportRoute } from "../engine/screens";
import type { Destination } from "../engine/types";
import type { DecisionReport } from "../engine/report";

// The UI's only connection to the engine. A configurable URL keeps a Capacitor app possible.
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

export type AgentPreview = { destination: Destination; route: SupportRoute; summary: string[]; omitted: string[]; details?: HandoffDetails };

export type SafeStepClient = {
  send: (request: ApiRequest) => Promise<ApiResponse>;
  agentView: () => Promise<AgentPreview>;
  // The full decision report for this session. Fetch it before ending the session.
  report: () => Promise<DecisionReport | null>;
  end: () => Promise<ApiResponse | null>;
};

export function createClient(request: typeof fetch = (...args) => fetch(...args)): SafeStepClient {
  let sessionId: string | null = null;
  // Encrypted copy of the session from the server. Sent back with each request so any server
  // instance can continue the conversation. The client can't read it.
  let sessionToken: string | null = null;
  const tokenHeader = (): Record<string, string> => (sessionToken ? { "x-session-token": sessionToken } : {});

  async function post(body: object): Promise<ApiResponse> {
    const response = await request(`${API_URL}/api/sessions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(sessionToken ? { ...body, sessionToken } : body),
    });
    if (!response.ok) throw new Error(`Request failed: ${response.status}`);
    const { sessionToken: next, ...data } = await response.json();
    if (typeof next === "string") sessionToken = next;
    return data as ApiResponse;
  }

  return {
    send: async (event) => {
      if (event.kind === "start") sessionToken = null;
      const data = await post(event.kind === "start" ? event : { ...event, sessionId });
      sessionId = data.sessionId;
      return data;
    },
    agentView: async () => {
      const response = await request(`${API_URL}/api/sessions?sessionId=${sessionId}`, { headers: tokenHeader() });
      if (!response.ok) throw new Error(`Request failed: ${response.status}`);
      return response.json();
    },
    report: async () => {
      if (!sessionId) return null;
      const response = await request(`${API_URL}/api/sessions?sessionId=${sessionId}&view=report`, { headers: tokenHeader() });
      if (!response.ok) return null;
      return response.json();
    },
    // Ends the session on the server and forgets the encrypted copy, so its data is cleared.
    end: async () => {
      if (!sessionId) return null;
      const data = await post({ kind: "end", sessionId });
      sessionId = null;
      sessionToken = null;
      return data;
    },
  };
}

export const client = createClient();
