# SafeStep Team Plan

This plan splits the remaining work between Mehrab and Arsham, so both can build at the same time without blocking each other.

See [strategy.md](strategy.md) for the product plan, [ARCHITECTURE.md](ARCHITECTURE.md) for the design and [DECISIONS.md](DECISIONS.md) for the safety contract.

## Current status

| Part | State |
|---|---|
| Safety contract, decision rules, Decision Flip, fact extraction | Done |
| Input Guard, composer, fallback text | Done |
| Evaluator link, including one-answer and multi-turn runs | Done |
| Fast Danger Check, Output Guard | Done (`engine/fast-danger.ts`, `engine/output-guard.ts`) |
| Session flow and final API routes | Done (`engine/handle-event.ts`, `/api/sessions`) |
| Final UI | Done; `app/page.tsx` runs the real product flow |
| Interactive consent, simulated signals, Rescue Mode, handoff | Built and connected to the engine |
| Held-out and attack testing | Done (`eval:holdout`, `eval:frozen`, `tests/attack-hardening.test.ts`) |
| Manual safety review (C4), comprehension check (B18) | **Sheets ready in `review/`, no results yet** |
| Finnish and Swedish review (C3) | **Not started**; `content/` still says draft |
| Full Gemini run (A14), remove `/api/assess` (A18) | **Not done** |

Status checked on 8 November 2026.

**Known problems:** the full-conversation scenario run regressed from 150/150 to 101/150 (no severe failures), because money-request messages now get "contact bank and block cards" even when nothing was paid. False alarms are 9.8% on the dev set, just under the 10% target. Small-business cases pass 82.8%. See [eval/RESULTS.md](eval/RESULTS.md).

## Who owns what

| | **Mehrab: Engine and API** | **Arsham: Product and UI** |
|---|---|---|
| **Branch** | `track/engine` | `track/ui` |
| **Owns** | `engine/`, `adapters/`, `app/api/`, `eval/`, `tests/` | `app/` except `app/api/`, `components/`, `mocks/`, `content/ui-text.json` |
| **Builds** | Safety logic, API, signals, handoff data, evaluation | Every screen, the user flow, accessibility and usability |

**Shared, so agree before changing:** `engine/screens.ts`, `content/*.json` except `ui-text.json`, `strategy.md`, `ARCHITECTURE.md`, `DECISIONS.md`, `README.md`.

## How the work connects

`engine/screens.ts` is the contract. The API returns those types, and the UI only renders them.

```text
Mehrab: engine + API ────────┐
                             ├── Join point 1: core journey works
Arsham: screens on mock data ┘
                             │
Mehrab: signals + handoff ───┐
                             ├── Join point 2: full journey works
Arsham: advanced screens ────┘
                             │
Both: testing and review
```

Arsham starts now with `mockResponse()` from `mocks/screens.ts`, which has every screen type. Mehrab builds real routes behind the same types. At each join point, Arsham replaces mock data with the API, and nothing else should need to change.

## Mehrab's tasks

### Phase 1: Safe core

| # | Task | Needs | Done when |
|---:|---|---|---|
| A1 | **Fast Danger Check** in fi, en and sv | None | "The bank is on the phone right now" gets a Stop Screen in all three languages, without waiting for the LLM |
| A2 | **Add new-scenario regression tests** | None | The 14 scenarios from the project review are in `tests/`, including romance, WhatsApp code, boss gift cards and injection |
| A3 | **Fix general rules** for account takeover, invoices and number transfers | A2 | WhatsApp takeover doesn't go to the bank, domain invoices don't get "change password", and unrequested number transfers say to contact the operator |
| A4 | **`handleEvent()` session flow** | None | Stop, Flip, Result and Fallback all return `Screen` objects through one engine entry point |
| A5 | **Output Guard** | A4 | Banned phrases, wrong language, secrets and unsafe text are blocked in fi, en and sv |
| A6 | **`/api/sessions` routes** | A4 | Every route validates input and returns `ApiResponse` |

**A6 completes Mehrab's side of join point 1.**

### Phase 2: Consent, recovery and handoff

| # | Task | Needs | Done when |
|---:|---|---|---|
| A7 | **Fix consent reporting** | A4 | `consent_requested_for` and `signals_used` report only what really happened |
| A8 | **Simulated signals adapter** | A4 | Link, call, subscription, device, login and business signals load for demo scenarios |
| A9 | **Consent Gate** | A7, A8 | Gated data can't be read without consent, refusal still gives safe advice, and the bot sends real `consent_request` events |
| A10 | **Data Receipt data** | A9 | The API reports used, refused and not-accessed signals correctly |
| A11 | **Rescue steps** | A4 | Banking, credentials, device, SIM, personal safety and business paths each work in all three languages |
| A12 | **Handoff adapter and summary** | A11 | The right destination is chosen, the summary has no secrets or guesses, and nothing is shared before approval |

**A12 completes Mehrab's side of join point 2.**

### Phase 3: Accuracy and hardening

| # | Task | Needs | Done when |
|---:|---|---|---|
| A13 | **Reduce false alarms** | A3 | False alarms are under 10% in an LLM run, without weakening safety |
| A14 | **Full Gemini run and model comparison** | A3 | The chosen model has full dev results and a 50-case comparison in `DECISIONS.md` |
| A15 | **Held-out scenario test** | A3 | New or left-out scenario results are recorded honestly |
| A16 | **Attack tests** | A5 | Injection, secrets, contradictions, timeouts and invalid LLM output are scripted and pass |
| A17 | **Selective Accuracy Gate, if needed** | A14 | Build it only if extraction errors are a real cause of failures, then compare score, speed and cost |
| A18 | **Remove temporary API** | Join point 2 | `/api/assess` is deleted, with no references left |

## Arsham's tasks

### Phase 1: Core screens on mock data

| # | Task | Needs | Done when |
|---:|---|---|---|
| B1 | **App shell** | None | DNA-style layout works at phone width, with a permanent "Synthetic prototype" label |
| B2 | **Start screen** | B1 | Consumer and business entry work, with quick choices, free text and an optional pasted message |
| B3 | **Language switching** | B1 | Interface text works in fi, en and sv from `ui-text.json` |
| B4 | **Stop Screen** | B1 | The stop action is clear at a glance and appears before anything else |
| B5 | **Decision Flip** | B1 | Large Yes, No and Not sure buttons, with the reason shown and one question at a time |
| B6 | **Result screen** | B1 | Action comes first, with reason, confidence, unknowns, conditional branches and expandable sources |
| B7 | **Fallback and warning states** | B1 | Fallback, secret warning, loading and error states are short and safe |
| B8 | **Replace the test page** | B2–B7 | `app/page.tsx` becomes the real product flow and still runs on mock data |

**B8 completes Arsham's side of join point 1.**

### Phase 2: Advanced screens on mock data

| # | Task | Needs | Done when |
|---:|---|---|---|
| B9 | **Connect the core flow to the API** | A6, B8 | Mock data is removed from the core flow, and all five journeys work end to end |
| B10 | **Signal Unlock screen** | B1 | Shows what, why and the limit, with a real refuse option |
| B11 | **Rescue Mode screen** | B1 | One step at a time, with Done and Not possible |
| B12 | **Handoff Review** | B1 | User sees the destination and summary, then approves or declines |
| B13 | **Agent View** | B12 | Clearly simulated view of what support would receive |
| B14 | **Data Receipt** | B1 | Used, refused and not-accessed data are easy to understand |

**B14 completes Arsham's side of join point 2.**

### Phase 3: Polish and usability

| # | Task | Needs | Done when |
|---:|---|---|---|
| B15 | **Connect advanced screens to the API** | A12, B14 | All mock data is removed, and consent, rescue and handoff work end to end |
| B16 | **Accessibility** | B15 | Usable by keyboard, with visible focus, clear labels and readable contrast |
| B17 | **Mobile and visual polish** | B15 | Works on phone and desktop, with calm and consistent screens |
| B18 | **Comprehension test** | B15 | At least three outsiders can state the next action in their own words, and results are recorded |
| B19 | **Demo journeys** | B15 | Five journeys and the live-test situations are rehearsed |

## Tasks for both of you

| # | Task | Lead | Done when |
|---:|---|---|---|
| C1 | **Join point 1 check** | Both | Stop, Flip, Result and Fallback work through the real API |
| C2 | **Join point 2 check** | Both | Consent, refusal, Rescue Mode, handoff and Data Receipt work as one journey |
| C3 | **Finnish and Swedish review** | Arsham | A capable speaker has checked approved text and the draft label is removed from `content/` |
| C4 | **Human safety review** | Mehrab | At least 50 answers are reviewed, including every critical type and all failure classes |
| C5 | **DNA questions** | Both | Answers are recorded in `DECISIONS.md` |
| C6 | **Final docs update** | Mehrab | README, architecture and decisions match what was built |

### Questions for DNA

- What can a human agent actually do: lock a number, stop a transfer or cancel an order?
- Which handoff format helps an agent most?
- Should a business user's report go to DNA or their IT partner first?

## Working rules

1. Start each session with `git pull`, then work on your own branch.
2. Merge to `main` through small pull requests.
3. Before merging, run `npm test`, `npm run typecheck` and `npm run build`.
4. Never commit `.env.local`, `DNA_SinceAI2026/` or `*.jsonl` run output.
5. Keep all safety decisions in the engine, never in the UI.
6. Tell the other person before changing `engine/screens.ts`.
7. Add a regression test for every safety bug.
8. Keep main screens as client components that use a configurable API URL, so a Capacitor app stays possible later.

**If work needs to be cut, cut in this order:** Agent View, visual polish, Data Receipt detail, then the Selective Accuracy Gate.

**Never cut:** safety rules, consent, the five journeys or honest failure reporting.
