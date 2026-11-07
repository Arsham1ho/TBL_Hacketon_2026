import type { ApiRequest, ApiResponse, SupportRoute } from "../engine/screens";
import type { Destination } from "../engine/types";

// The UI's only connection to the engine. A configurable URL keeps a Capacitor app possible.
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

export type AgentPreview = { destination: Destination; route: SupportRoute; summary: string[]; omitted: string[] };

export type SafeStepClient = {
  send: (request: ApiRequest) => Promise<ApiResponse>;
  agentView: () => Promise<AgentPreview>;
  end: () => Promise<ApiResponse | null>;
};

export function createClient(request: typeof fetch = (...args) => fetch(...args)): SafeStepClient {
  let sessionId: string | null = null;

  async function post(body: object): Promise<ApiResponse> {
    const response = await request(`${API_URL}/api/sessions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error(`Request failed: ${response.status}`);
    return response.json();
  }

  return {
    send: async (event) => {
      const data = await post(event.kind === "start" ? event : { ...event, sessionId });
      sessionId = data.sessionId;
      return data;
    },
    agentView: async () => {
      const response = await request(`${API_URL}/api/sessions?sessionId=${sessionId}`);
      if (!response.ok) throw new Error(`Request failed: ${response.status}`);
      return response.json();
    },
    // Ends the session on the server, so its data is cleared.
    end: async () => {
      if (!sessionId) return null;
      const data = await post({ kind: "end", sessionId });
      sessionId = null;
      return data;
    },
  };
}

export const client = createClient();
