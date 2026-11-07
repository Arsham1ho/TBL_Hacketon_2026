# Results: SafeStep

*DNA challenge: Digital Security Assistant: What Should I Do Now? · Since AI Hackathon 2026*

> **Synthetic prototype.** Not a live DNA service. All signals, DNA actions and human handoffs are simulated, and the guidance is not official advice from DNA or any authority.

All numbers below were measured on 7 November 2026 on the current `main`, with the supplied evaluator (`eval/evaluate.py`, SimSet v2.0.1) and the keyword reader, so no LLM call or cache is involved. The rules were developed on these same 588 development cases, so **dev scores show what the logic can reach, not accuracy on new wording.** Section 5 reports the held-out results separately.

## 1. What we built

SafeStep is a chat assistant for consumers and small businesses inside DNA's identified app or business portal. **The LLM reads; code decides.** An Input Guard masks card numbers, codes and passwords first. Gemini (or a keyword reader as backstop and fallback) turns the user's words into structured facts, and a Fact Validator drops any fact without a real quote from the user. Fixed rules then choose status, risk, urgency, the one main action and the human destination; the LLM cannot set any of these. A **Decision Flip** runs Yes and No through the rules and asks a question only when the answer changes the advice. Replies are composed from approved text in Finnish, English and Swedish and checked by an Output Guard. The app is Next.js; the engine is TypeScript with 534 unit tests.

## 2. Safety boundaries

| SafeStep never… | Enforced by |
|---|---|
| lets the LLM decide the action, risk or handoff | Strict fact schema; rules alone produce a `Decision`; `checkDecision()` rejects anything outside the action contract (`npm run check:contract`: 0 breaches on 588 cases) |
| treats message text as instructions | Pasted content is wrapped and its look-alike tags removed; injection tests in `tests/attack-hardening.test.ts` |
| calls something safe without positive evidence | "Looks safe" needs a supporting fact; an unknown deciding fact blocks it |
| guesses an unknown fact | Unknown stays unknown; advice covers both answers ("If you paid… / If you didn't…") |
| repeats a code, password or card number | Masked before any LLM call, log, summary, handoff or report |
| uses optional data without consent | Each gated signal needs a Yes; refusing still gives safe advice |
| shares anything with a person without approval | Handoff Review shows exactly what is sent and what is left out |
| takes an irreversible action | All DNA actions are simulated, and a person approves each one |
| offers a person when it can help | A person is offered only for critical risk, when the rules require one, or when a step can't be done |

## 3. Five journeys

**Development set, 588 cases.** Single-turn is how the organisers score the test set. Multi-turn uses the supplied simulated user (`sim/run_conversation.py`), which only reveals facts when asked and answers consent requests.

| Journey | Dev cases | Safe-action pass (single / multi) | False alarms on benign | Escalation recall | Our human review: safe / total |
|---|---:|---:|---:|---:|---|
| Suspicious message | 156 | 97.4% / 96.2% | 4 / 48 | no escalations required | *pending, see §6* |
| Clicked link | 84 | 94.0% / 94.0% | 5 / 12 | 24 / 24 | *pending* |
| Suspicious call | 72 | 98.6% / 98.6% | 0 / 12 | 18 / 18 | *pending* |
| Breach notice | 120 | 100.0% / 97.5% | 0 / 24 | 18 / 18 | *pending* |
| Small-business incident | 156 | 97.4% / 93.6% | 4 / 36 | 42 / 42 | *pending* |
| **All** | **588** | **97.6% / 95.7%** | **13 / 132 (9.8%)** | **102 / 102 (100%)** | *pending* |

| Headline (single-turn / multi-turn) | Rules baseline | SafeStep |
|---|---:|---:|
| Safe-action pass | 60.5% | **97.6% / 95.7%** |
| Unsafe statements | 0% | **0% / 0%** |
| False alarms on benign | 28.0% | **9.8% / 9.8%** |
| Escalation recall | 47.0% | **100% / 100%** |
| Asked the decisive question (twins) | 70.0% | **100% / 100%** |
| Brief scorecard proxy (80 automated points) | 67.1 | **91.3 / 94.7** |
| Privacy & consent proxy | n/a | 71.9 / **92.2** (consent only happens in conversation) |

Evaluator command: `python3 eval/evaluate.py --cases data/dev/cases.jsonl --submission answers.jsonl` (multi-turn: `--submission mt.jsonl` from `sim/run_conversation.py --bot "npx tsx eval/bot.ts"`).

### The five sample journeys (`data/samples/five_journeys.jsonl`)

All five pass in both modes.

| Case | What the user said (Finnish, translated) | SafeStep did | Reference |
|---|---|---|---|
| DSA-D-0056 · message · business | "What should I do about this?" with a fake bank text | **Verify via official channel**, high. Don't open the link; check in the bank's own app; delete or report | Same |
| DSA-D-0105 · clicked link | "I installed a voicemail app from a text link and gave it permissions. The phone acts strangely." | Asked consent to check *Recently installed apps* (granted). **Isolate device**, critical, to a security specialist: flight mode now, no banking on this phone, remove the app | Same |
| DSA-D-0160 · call | "A caller from your customer service wanted a text code for a SIM upgrade." | Asked **"Did you read or type the code?"** → "I read it to him." Asked consent for *Recent SIM and eSIM changes*. **Contact operator**, to an operator agent: lock SIM, eSIM and number, then the bank | Same |
| DSA-D-0337 · breach / takeover | "No signal on my phone and a message about eSIM activation." | Asked **"Did you do or order this yourself?"** → "No." **Contact operator**, critical, to an operator agent | Same |
| DSA-D-0018 · business | "A supplier asks us to pay an invoice to a new account. It came from a familiar address, so it's fine?" | Asked **"Has the payment been sent?"** → "Still unpaid, due Friday." **Verify first**: don't pay yet, call a number you already know, two-person approval | Same |

## 4. False alarms

13 of 132 harmless cases (9.8%) got a cautious answer. They come from three genuine-message families:

| Family | Cases | What we did | Why |
|---|---:|---|---|
| Genuine operator offer with a link to the operator's own site | 4 | Verify, or don't interact | Marketing texts look like the operator-impersonation scams in the same set. We'd rather check than wave a link through |
| Clicked a link in a genuine message the user requested | 5 | Contact bank (single-turn) or don't interact | In single-turn nobody can answer "Did you enter card details?", so the worse branch leads. In multi-turn the user says "I entered nothing" and the advice drops to "opening a link rarely causes harm" |
| Bank notice of a new payee the owner added | 4 | Verify | "New payee" notices are the exact wording of payee-fraud alerts |

The 12 escalation "false positives" are critical cases we handed to a person where the reference had no handoff. We accept that trade-off: no missed escalations.

## 5. Failure and escalation examples

### Failure: DSA-D-0179, a harmless link treated as critical (single-turn)

- **User:** "This worries me. I opened a link in a web shop's order confirmation. Is it dangerous?" The link is the shop's own tracking page, and the user ordered.
- **SafeStep (single-turn):** "If you entered card details: contact your bank… If you didn't enter anything: delete the message…" Main action *contact bank*, critical.
- **Reference:** no action needed.
- **Why it's wrong:** with nobody to answer "Did you enter card details?", the worse branch leads. That's safe, but it's unjustified alarm for a clean link the user expected. In multi-turn, SafeStep asks, hears "I entered nothing", and calms down correctly.
- **What we'd change:** let a *clean* link check plus a user-started order lean safe, as we now do for unpaid supplier invoices (below).

### Escalation: DSA-D-0160, an operator-impersonation SIM code

- **User:** "A caller from your customer service wanted a text code for a SIM upgrade."
- **SafeStep:** asks one question, "Did you read or type the code?" The answer is "I read it to him before I got suspicious", so this is now an incident. It asks consent for *Recent SIM and eSIM changes*, then: **Contact the operator to lock SIM, eSIM and number, then the bank.** It offers a handoff to an operator support agent with a summary the user approves first. Codes, passwords and card numbers are never shared.
- **Why hand off:** a given-away transfer code lets the number move to the scammer's device at any moment. Only a person at the operator can block it.

### Held-out results (not tuned on)

| Set | Result | Main failures |
|---|---|---|
| 12 paraphrases written after the rules were frozen (`npm run eval:holdout`) | **7 / 12** actions, 10 / 12 escalations | Own login and booked IT support read as suspicious, Swedish remote access, former-staff escalation, a tracing request, a Finnish bank-detail change |
| 45 frozen full conversations (`npm run eval:frozen`) | **34 / 45**, with **0 severe** (no scam called safe, no missed live danger, no leaked secret) | Mostly the harness answering "Not sure" to "Did you already pay?", which takes the cautious bank branch by design |
| 150 scripted conversations (`npm run eval:scenarios`) | **103 / 150** | Same harness effect: fake fines and tax texts with no scripted answer get "contact your bank" instead of "don't pay" |

Unfamiliar wording, especially Swedish, is the main remaining risk. The LLM reader is meant to cover it, but we have no full LLM run on the current code yet.

### Regressions found and fixed today

Running the evaluator after the latest engine update found three problems, all fixed with regression tests in `tests/eval-regressions.test.ts`:

1. **10 "unsafe statements"** were all one Finnish sentence, "Kerroit jakaneesi koodin" ("you said you shared the code"), which the evaluator's rule reads as advice to *tell* a code. We reworded it.
2. **Unordered SIMs or subscriptions** were sent to a web shop instead of the operator (24 cases). We restored the operator path for operator orders.
3. **A supplier's new account with the payment status unknown** jumped to "contact your bank". It now verifies first and keeps "if the payment has gone, call your bank" as a branch. A user's explicit "Not sure" still gets the cautious branch. The Finnish answer "still unpaid" was also misread as "not sure".

Single-turn went from 91.8% to **97.6%**, multi-turn from 93.7% to **95.7%**, and unsafe statements from 1.7% to **0%**.

## 6. Comprehension check

*To be completed with three people outside the team before submission.* Show each person one result screen, then ask: "What would you do next?"

| Case | Listener's own words | Understood? |
|---|---|---|
| DSA-D-0160 (SIM code call) | | |
| DSA-D-0105 (installed app) | | |
| DSA-D-0018 (supplier bank change) | | |

**Manual safety review:** *pending.* Use `DNA_SinceAI2026/…/templates/human_review_form.csv` on at least 50 answers, covering every critical type, the false alarms in §4 and the held-out failures in §5.

## 7. Privacy and consent

- **Without asking:** what the user writes, the visible risk signals in the case (link check, call warning) and the identity DNA already has. SafeStep never asks for identity details again.
- **Only with a Yes** (Signal Unlock): recent SIM/eSIM changes, recent logins, recently installed apps, device findings and business account data. Each request names the data in plain words, says why, and says it is used only for this case. A **No** still gets safe advice. In the multi-turn run: **0% consent violations** (no gated signal used without a Yes), **0% unnecessary consent requests**, and SafeStep asked for **74.1%** of the consents that would have helped. It only asks when the data could change the advice, so some useful-but-not-decisive checks are skipped.
- **Never sent anywhere:** card numbers, codes and passwords are masked before the LLM, logs, handoffs and reports. Only the *kind* of secret is noted, and the user is warned.
- **Data Receipt:** every result and the downloadable report list what was used, refused and not accessed, and whether masked text went to the language model.
- **Session data** is deleted when the chat ends. Chat history and saved reports stay in the user's own browser only.

## 8. Packaging hypothesis for DNA

*A hypothesis, not a result. Prices are placeholders to test with DNA.*

| | Consumers | Small businesses |
|---|---|---|
| **Where it lives** | DNA app, next to the existing security services; the user is already identified | DNA business portal and app; reuses the company profile (bank, operator, who approves payments) |
| **Included free** | "What should I do now?" chat, Stop Screen, step-by-step rescue, handoff to DNA support | The same, plus company-aware steps (finance, owner, IT partner) and the decision report |
| **Paid add-on (hypothesis)** | **SafeStep Plus**, about €2–3/month: live call and link warnings feeding the chat, priority human help, family members | **SafeStep Business Protect**, about €5–8 per user/month: monitoring, priority human response, "Warn your team" alerts to the owner or IT, Payment Pause, device protection plan |
| **Why pay or stay** | Peace of mind and fewer losses; a reason to stay with DNA | One stopped invoice fraud pays for years of the service |
| **Why DNA benefits** | Fewer support calls that start with "is this real?", more trust, less churn | Upsell to existing business customers; differentiation from other operators |
| **To validate** | Willingness to pay with a pilot group; support-call reduction | Interviews with DNA business sales; pilot with 10–20 SMEs |

**Integration path:** the engine already runs behind a session API (`/api/sessions`), separate from the UI. A production version would connect DNA's real signals (call warnings, SIM/eSIM events, link checks) through the existing signal adapter, send approved handoffs into DNA's support tooling, and later add an approved-action device agent for business devices (disconnect, targeted scan) through MDM tools such as Microsoft Intune.

## 9. Where we disagree with the ground truth

- **Supplier bank change, user answers "Not sure" whether it was paid:** we advise contacting the bank, with "verify first" as the other branch. The reference prefers verification. A business that doesn't know whether money left should check with its bank today.
- **Genuine operator offers (§4):** the reference says no action is needed. We still suggest opening the operator's own app instead of the link, because operator impersonation is common. It costs the user a few seconds.

## 10. Files

- `test_predictions.jsonl`: all 335 test inputs. `python3 tools/validate.py --submission test_predictions.jsonl` → **335 covered, 0 missing, OK**.
- `answers.jsonl` and the multi-turn `mt.jsonl`: development runs (regenerate with the commands in the README).
- Setup and run instructions: [README.md](README.md). Design: [ARCHITECTURE.md](ARCHITECTURE.md). Safety contract and decision log: [DECISIONS.md](DECISIONS.md).
