# Session API for the UI track

Use `POST /api/sessions` for every event. Each successful call returns the `ApiResponse` shape in `engine/screens.ts`; render `response.screen.type` and retain `response.sessionId` for subsequent calls. The API owns all safety decisions.

The start request includes the first message. This follows the current `ApiRequest` contract. For subsequent events, the path aliases `POST /api/sessions/:id/answers`, `/consent`, `/rescue`, `/handoff`, and `/continue` accept the same event fields without `kind` or `sessionId`. `DELETE /api/sessions/:id` ends the session. The single `POST /api/sessions` event route remains available for the UI integration.

Start:

```json
{"kind":"start","audience":"consumer","language":"en","message":"A caller is asking for my code now","incident":"Optional pasted message"}
```

Subsequent events include `sessionId`:

```json
{"kind":"continue","sessionId":"..."}
{"kind":"answer","sessionId":"...","topic":"code_shared","answer":"unsure"}
{"kind":"consent","sessionId":"...","signal":"subscription.recent_events","granted":false}
{"kind":"rescue","sessionId":"...","stepId":"0","outcome":"done"}
{"kind":"handoff","sessionId":"...","approved":false}
{"kind":"end","sessionId":"..."}
```

Send only the event that corresponds to the current screen. A Stop screen advances with `continue`; a Flip screen uses its returned `topic`; an Unlock screen uses its returned `signal`; a Rescue screen uses its returned `step.id`. A Handoff screen requires the user's explicit approval or refusal. `end` clears the session.

After an approved handoff, `GET /api/sessions?sessionId=...` returns the simulated Agent View (`destination`, reviewed `summary`, and `omitted`). Before approval it returns `403`. A declined handoff never exposes this view.

The optional `demoScenario` on start can be `flagged_link`, `warned_call`, `sim_change`, `unknown_login`, `device_issue`, or `business_access`. These are synthetic. `demoSignals` can additionally list consent-gated paths from `engine/types.ts`. A missing or inconclusive signal never proves safety.
Signal Unlock appears only when a simulated finding would change the action, urgency, or handoff. A granted check enters the case as `consented_signal`; refusal leaves that finding unknown. The demo findings are invented for the prototype and must be labeled as simulated in the UI.

The route returns `400` for malformed input, `404` for an expired session, `409` for an event that does not match the current screen, and `503` if start fails. The Gemini key is read from `.env.local` on the server; without it, the offline extractor runs.
