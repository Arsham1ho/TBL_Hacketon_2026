# SafeStep Team Plan

**Submissions close Sunday 8 November at 10:00. Our target is Sunday 08:00.** Feature freeze is Saturday 22:00.

Two tracks run side by side. Each person owns their own files, so you can work at the same time without merge conflicts.

| | **Track A: Engine and API** | **Track B: Product and UI** |
|---|---|---|
| **Owner** | Arsham | Mehrab |
| **Branch** | `track/engine` | `track/ui` |
| **Owns** | `engine/`, `adapters/`, `app/api/`, `eval/`, `tests/` | `app/` except `app/api/`, `components/`, `mocks/`, `content/ui-text.json` |

The owners are a suggestion, so swap them if that suits you better.

**Shared, so agree before changing:** `engine/screens.ts`, `content/*.json` except `ui-text.json`, `ARCHITECTURE.md`, `DECISIONS.md`, `README.md`.

## How the tracks connect

`engine/screens.ts` is the contract. The API returns those types, and the UI only renders them.

- **Track B starts now** with `mockResponse()` from `mocks/screens.ts`, which has every screen.
- **Track A ships** the real routes behind the same types.
- **Join point:** Track B replaces the mock with the API. Nothing else should change.

## Working rules

1. Start each session with `git pull`, then work on your own branch.
2. Merge to `main` through a small pull request, at least every few hours.
3. Before merging, run `npm test`, `npm run typecheck` and `npm run build`.
4. Never commit `.env.local`, `DNA_SinceAI2026/` or `*.jsonl` run output.
5. Don't move safety decisions into the UI.
6. Tell the other person before changing `engine/screens.ts`.

## Track A: Engine and API

| # | Task | Stage | Needs | Done when |
|---:|---|---:|---|---|
| A1 | `handleEvent()` session flow | 3 | None | Stop, Flip, Result and Fallback come back as `Screen` objects |
| A2 | Fast Danger Check in fi, en, sv | 3 | None | Live danger shows Stop without waiting for the LLM |
| A3 | Output Guard | 3 | A1 | Banned phrases, wrong language and secrets are blocked |
| A4 | `/api/sessions` routes | 3 | A1 | **Join point 1:** every route returns `ApiResponse` |
| A5 | Consent Gate and simulated signals | 4 | A1 | Gated data can't be read without consent |
| A6 | Rescue steps for each recovery path | 4 | A1 | Bank, login, device, SIM, safety and business paths work |
| A7 | Handoff adapter and agent summary | 4 | A6 | **Join point 2:** summary has no secrets or guesses |
| A8 | Held-out scenario test | 5 | A1 | Score on unseen families is recorded |
| A9 | Full Gemini run, false alarms under 10% | 5 | A1 | `DECISIONS.md` has the real numbers |
| A10 | Attack tests on injection, secrets and contradictions | 5 | A3 | Cases are scripted and passing |
| A11 | `test_predictions.jsonl`, validated | 5 | A9 | `tools/validate.py --submission` passes |

## Track B: Product and UI

| # | Task | Stage | Needs | Done when |
|---:|---|---:|---|---|
| B1 | App shell, DNA-style layout, permanent prototype label | 3 | Mock | Works at phone width |
| B2 | Start screen with quick choices | 3 | B1 | Consumer and business entry both work |
| B3 | Stop Screen | 3 | B1 | Clear at a glance, and shows before anything else |
| B4 | Decision Flip with Yes, No, Not sure | 3 | B1 | Large buttons, and the Flip reads as its own step |
| B5 | Result screen | 3 | B1 | Action first; conditional branches shown; source on demand |
| B6 | Connect to the real API | 3 | A4 | Mock removed; five journeys work end to end |
| B7 | Signal Unlock screen | 4 | B1 | What, why, limit and a real refuse option |
| B8 | Rescue Mode screen | 4 | B1 | One step at a time, with Done and Not possible |
| B9 | Handoff Review and Agent View | 4 | A7 | User approves the summary before sharing |
| B10 | Data Receipt | 4 | B1 | Used, refused and not accessed are clear |
| B11 | Keyboard, focus states, loading and failure states | 5 | B6 | Usable without a mouse |
| B12 | Comprehension test with 3 outsiders | 5 | B6 | Results recorded |

## Together

| Task | When | Done when |
|---|---|---|
| Native review of Finnish and Swedish text | Saturday | Draft label removed from `content/` |
| Hand review of at least 50 answers, including every critical type | After freeze | `templates/human_review_form.csv` is filled in |
| Five demo journeys, including one failure | After freeze | Rehearsed, plus the live-test situations |
| `RESULTS_TEMPLATE.md`, packaging hypothesis, integration path | Saturday evening | In the repo |
| Demo video, three minutes at most | Saturday night | On YouTube |
| Final submission: repo link, source zip, IP terms, AI tools disclosed | Sunday by 08:00 | Upload confirmed |
| Participant vote: 20 comparisons each | Sunday by 12:00 | Done by both |

## Timeline

| When (EET) | Track A | Track B |
|---|---|---|
| **Saturday morning** | A1, A2, A3 | B1 to B5 on mock data |
| **Saturday midday** | A4, then **join point 1** | B6; attend DNA's Q&A together |
| **Saturday afternoon** | A5, A6, A7, then **join point 2** | B7 to B10 |
| **Saturday 22:00** | **Feature freeze** | **Feature freeze** |
| **Saturday evening** | A8 to A11 | B11, B12 |
| **Saturday night** | Hand review, results | Video, demo rehearsal |
| **Sunday by 08:00** | **Submit** | **Submit** |

**If you fall behind, cut in this order:** Agent View, then polish, then Data Receipt detail. **Never cut:** safety rules, consent, the five journeys, or the honest failure example.

## Questions for DNA's Q&A

- What can a human agent actually do: lock a number, stop a transfer or cancel an order?
- Which handoff format helps an agent most?
- Should a business user's report go to DNA or to their IT partner first?
