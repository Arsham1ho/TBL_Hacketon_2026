import type { ApiRequest, ApiResponse } from "../engine/screens";
import { mockClient } from "../mocks/journey";

// The UI's only connection to the engine. When the session routes exist, replace
// mockClient here, and no screen needs to change.
//
// Two actions aren't in ApiRequest yet, and need adding to engine/screens.ts together:
// "continue" moves past the Stop Screen, and "talk_to_person" asks for a human at any point.
export type UiRequest = ApiRequest | { kind: "continue" } | { kind: "talk_to_person" };

export type SafeStepClient = {
  send: (request: UiRequest) => Promise<ApiResponse>;
  end: () => Promise<ApiResponse>;
};

export const client: SafeStepClient = mockClient;
