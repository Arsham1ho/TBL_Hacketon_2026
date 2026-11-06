# SafeStep

SafeStep helps consumers and small businesses work out what to do next when something looks like a digital scam or security incident. It reads what happened, stops ongoing harm, asks only the question that changes the advice, and gives one clear next step.

Built for the DNA challenge at the Since AI Hackathon 2026.

> **Synthetic prototype.** This is not a live DNA service. All signals, DNA actions and human handoffs are simulated, and the guidance is not official advice from DNA or any authority.

## How it works

**The LLM reads. Code decides.**

1. **Input Guard** masks card numbers, codes and passwords before anything else sees them.
2. **Fact reading:** the LLM turns the user's words into structured facts. A keyword extractor runs beside it as a backstop, and takes over if the LLM fails.
3. **Fact Validator** drops any fact without a real quote from the user's text.
4. **Decision rules** choose the status, risk, urgency, action and human destination. The LLM can't set any of these.
5. **Decision Flip** tries Yes and No through the rules, and asks only if the answer changes the response.
6. **Composer** writes the reply from approved text in Finnish, English or Swedish.

If a user answers "Not sure", the fact stays unknown and the advice covers both answers. Something is only called safe with positive evidence, so finding nothing risky is never enough.

See [TASKS.md](TASKS.md) for the team plan, [ARCHITECTURE.md](ARCHITECTURE.md) for the design, [DECISIONS.md](DECISIONS.md) for the safety contract and results, and [strategy.md](strategy.md) for the product plan.

## Setup

You need Node.js 22 or newer. The evaluation commands also need Python 3.10 or newer.

```bash
npm install
cp .env.example .env.local
```

Then edit `.env.local`:

| Variable | Purpose |
|---|---|
| `GEMINI_API_KEY` | Fact reading with Gemini. Used first if set |
| `OPENAI_API_KEY` | Fact reading with OpenAI, if there is no Gemini key |
| `SIMSET_DIR` | Full path to the DNA SimSet folder, needed for evaluation only |

With no key, the app still runs on the keyword extractor alone.

The SimSet and challenge brief aren't in this repository, so get them from the organisers.

## Run the app

```bash
npm run dev
```

Open <http://localhost:3000>.

The current page is a temporary test page that runs the real engine. It shows how each decision was made. Try the example buttons, then a Decision Flip with Yes, No and Not sure.

## Test and evaluate

```bash
npm test                 # unit tests
npm run typecheck
npm run check:contract   # checks the safety contract against the SimSet
npm run eval:dev         # writes answers.jsonl for the 588 dev cases
```

Add `USE_LLM=1` to `eval:dev` to use the LLM instead of keywords. Results are cached in `.cache/`, so rule changes rerun without new calls. On a free API tier, slow the run with `EVAL_CONCURRENCY=1 EVAL_PACE_MS=4500`.

Score the answers with the supplied evaluator. Set `SIMSET_DIR` in your shell first:

```bash
python3 "$SIMSET_DIR/eval/evaluate.py" \
  --cases "$SIMSET_DIR/data/dev/cases.jsonl" \
  --submission answers.jsonl
```

## Results so far

Measured on the 588 development cases with `gpt-5.4-mini`. The rules were tuned on these same cases, so these numbers show what the logic can reach, not expected accuracy on new cases.

| Metric | Rules baseline | Target | SafeStep |
|---|---:|---:|---:|
| Safe-action pass | 60.5% | 80%+ | 95.9% |
| False alarms on harmless cases | 28.0% | Under 10% | **11.4%, target missed** |
| Escalation recall | 47.0% | 90%+ | 98.5% |
| Asked decisive question | 70.0% | 90%+ | 95.0% |
| Unsafe statements | 0% | 0% | 0% |

`gemini-3.5-flash-lite`, the current default, has only been measured on a 50-case sample so far: 98.0% safe-action pass and no false alarms. The full run is still to do.

## Project status

| Stage | Scope | State |
|---|---|---|
| 1 | Safety and product contract | Approved by the team. Three checks finish in later stages |
| 2 | Decision rules, Decision Flip, fact extraction | Done |
| 3 | Core user experience | Not started |
| 4 | Signal Unlock, Rescue Mode, human handoff | Not started |
| 5 | Held-out testing, safety review, demo | Not started |

## Known limits

- False alarms are above the 10% target on the full development set.
- Finnish and Swedish text still needs review by native speakers.
- The free Gemini tier allows 15 requests a minute. Above that, the app falls back to the keyword extractor.
- Masking can miss letter-and-number codes and codes with no code word nearby.
- Consent is not interactive yet, and the test page has no simulated link or call signals.

## Licence

[MIT](LICENSE)
