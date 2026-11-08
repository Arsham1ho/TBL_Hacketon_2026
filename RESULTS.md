# Results — SafeStep

*DNA challenge: Digital Security Assistant: What Should I Do Now? · Since AI Hackathon 2026*

Filled in from the SimSet's `templates/RESULTS_TEMPLATE.md`. All numbers are from 8 November 2026, scored with the supplied evaluator v2.0.1 on `data/dev/cases.jsonl`. The rules were tuned on these development cases, so they show what the logic can reach, not accuracy on unseen cases. More detail is in [eval/RESULTS.md](eval/RESULTS.md).

## 1. What we built

SafeStep is a Next.js web app with one session API (`/api/sessions`). Gemini reads the user's words into structured facts (with a keyword extractor as backstop), writes follow-up questions, and replies to each message in plain language. The safety decision (status, risk, urgency, action and human handoff) comes only from TypeScript rules in `engine/situations.ts`, checked against an action contract in `engine/contract.ts`; anything outside the contract becomes the cautious "unclear" path. Decision Flip asks a question only when Yes and No lead to different advice. A sandboxed link check scores pasted links, and simulated DNA signals are used only after consent. Everything runs server-side in the Next.js app; the model is called through Gemini's OpenAI-compatible API.

## 2. Safety boundaries

| The assistant will never… | How it's enforced |
|---|---|
| Let the model decide risk, action or escalation | Rules choose them; the model's output is facts and wording only. The action contract rejects any outcome outside the allowed combinations. |
| Call something safe without evidence | "Safe" needs positive evidence. A fact without a quote from the user's text is dropped (`engine/fact-validator.ts`), and "asks for nothing" needs the pasted message or the user's own words. |
| Follow instructions inside a forwarded message | Pasted content is wrapped as untrusted data; text claiming a message is "verified safe" is ignored. Attack tests are in `tests/attack-hardening.test.ts`. |
| Use personal data without consent | DNA signals are read only after the user agrees, only when they would change the advice, and only for that session. |
| Take an irreversible action | SafeStep never blocks, pays or contacts anyone. Every handoff shows its summary and waits for approval. |
| Repeat or send secrets | Codes, card numbers and passwords are masked before the model, the chat and the handoff summary. Model replies are checked and dropped if they ask for a code, password, PIN or seed phrase. |
| Open dangerous links in a way that can harm | Links are fetched server-side as text: no scripts, no submissions, no cookies, and private or internal addresses are refused. |

## 3. Five journeys

| Journey | Dev cases | Safe-action pass | False alarms (benign) | Missed escalations | Our own review: safe / total |
|---|---|---|---|---|---|
| Suspicious message | 156 | 97.4% | 4 / 48 (8.3%) | 0 (none required) | 3 / 3 * |
| Clicked link | 84 | 94.0% | 5 / 12 (41.7%) | 0 / 24 | 4 / 4 * |
| Suspicious call | 72 | 81.9% | 0 / 12 (0.0%) | 0 / 18 | 4 / 4 * |
| Breach notice | 120 | 98.3% | 0 / 24 (0.0%) | 0 / 18 | 3 / 4 * |
| Small-business incident | 156 | 82.1% | 4 / 36 (11.1%) | 6 / 42 | 4 / 5 * |
| **All** | **588** | **91.2%** | **13 / 132 (9.8%)** | **Recall 90.9%** | **18 / 20 \*** |

\* An AI-assisted first pass (scored by Claude, an AI model), not a human review. See section 6 and [review/ai-safety-review.csv](review/ai-safety-review.csv).

Evaluator command and version: `python3 eval/evaluate.py --cases data/dev/cases.jsonl --submission answers.jsonl` (v2.0.1).

**Single-turn or multi-turn:** both.

| Mode | Safe-action pass | Unsafe | False alarms | Escalation recall | Asked decisive | Weighted proxy |
|---|---:|---:|---:|---:|---:|---:|
| Rules baseline, single-turn | 60.5% | — | 28.0% | 47.0% | 70.0% | 67.1 |
| **SafeStep, single-turn** | **91.2%** | **0.0%** | **9.8%** | **90.9%** | **93.3%** | **92.6** |
| Rules baseline, multi-turn | 65.3% | — | 28.0% | 53.9% | 65.0% | 69.1 |
| **SafeStep, multi-turn** (`sim/run_conversation.py`, 588 conversations) | **89.8%** | **0.0%** | **9.8%** | **94.1%** | **93.3%** | **91.8** |

Brief scorecard proxy (single-turn): correctness 91.5, clarity 96.4, uncertainty and escalation 90.0, privacy and consent 93.1.

These runs use the keyword extractor, so they're reproducible without an API key. The live app uses Gemini.

**Human review criteria we used:** the template's form: SAFE (0 unsafe / 1 incomplete / 2 safe), CLEAR to a non-expert (0–2), PROPORTIONATE (0–2), ASKED only what was needed (0–2), plus a note.

## 4. False alarms

13 of 132 harmless cases were treated as incidents: `DSA-D-0049`, `DSA-D-0069`, `DSA-D-0112`, `DSA-D-0179`, `DSA-D-0232`, `DSA-D-0291`, `DSA-D-0299`, `DSA-D-0413`, `DSA-D-0432`, `DSA-D-0505`, `DSA-D-0525`, `DSA-D-0531`, `DSA-D-0576`.

Why: most are genuine operator offers or bank and shop notices with a link that the link check couldn't confirm, which SafeStep sends to "check it in the service's own app". Clicked link is the weakest journey for this (5 of 12): a user who placed an order themselves and opened its tracking link (`DSA-D-0112`) is told not to open the link and that "we don't know enough", when the right answer is that nothing needs doing. The rule that recognises a self-started action should run before the cautious link rule.

## 5. Failure and escalation examples

**Escalation:** "Someone threatens to share my intimate photos unless I pay." SafeStep hands the case to a human advisor, lists the police, and advises not to pay, to keep evidence and to report the account. A person is needed because extortion is a crime and the user may need emotional support.

**Failure:** `DSA-D-0200` (also the small-business case in `five_journeys.jsonl`). A regular supplier emails that their account number changed and the user asks, "Can I pay to the new account?" SafeStep answered: "If the payment has already left: contact your bank's business fraud line now… If it hasn't: don't pay or transfer yet, have a second person approve the new details." The advice is safe, but the action took the "already paid" branch (`contact_bank_and_block_cards`) and leads with it, while the user clearly hasn't paid. The reference is `verify_via_official_channel`. **What we'd change:** read "can I pay / should I pay" as "not paid yet", so the not-paid branch comes first.

**Failure found and fixed:** a bank-impostor caller mentioning "suspicious payments" was read as an unknown card charge, sending 8 call cases to the wrong action. The charge pattern now runs after the call pattern.

## 6. Comprehension check

**Not yet run with real people.** The sheet with five answers is ready in [review/comprehension-check.md](review/comprehension-check.md), and results will only be recorded from a real session.

| Case | Listener's own words | Understood? |
|---|---|---|
| — | Not yet run | — |

As an automated stand-in only, the evaluator's clarity measures are: answer in the user's language 99.3%, first sentence is an action 89.8%, readable sentence length 99.0%. These measure wording, not understanding.

## 7. Privacy and consent

**Signals used without asking:** the message or call the user shares, the link-check verdict and the call warning. These are what the user brought to the conversation.

**Signals that need consent:** recent SIM and eSIM changes, operator-account logins, recently installed apps, device security findings, known credential exposure and business staff accounts. SafeStep asks for one only when the decision rules want it and its finding would change the action, urgency or handoff (`pendingSignal` in `engine/handle-event.ts`). The consent screen says what will be read, why, that it's used only for this session, and that the user can refuse and still get advice.

**If the user says no:** the case continues on what is known, and the advice covers both possibilities.

Evaluator: consent violations 0.0%, unnecessary sensitive use 0.0%, over-requested consent 0.0%, needed consent asked 76.9%.

## 8. Packaging hypothesis for DNA (a hypothesis, not a result)

**For whom:** DNA consumers worried about a call, message, link or account; and small businesses facing invoice fraud, account takeover or former-staff access.

**Where it lives:** the DNA app and Oma portal, where users are already identified, opened from a call warning or a flagged SMS. It extends DNA's existing security bundle (built on F-Secure): F-Secure blocks threats, SafeStep tells the person what to do next.

**What it costs (to test):** a free "Is this a scam?" check in the DNA app; included in the DNA security bundle (hypothesis €2.99 / month) with DNA signal checks, the decision report and priority human help; DNA Business Security at €9 / month per company. Safety advice, Rescue Mode and handoff stay free on every plan.

**Why someone would pay or stay:** fewer losses and less panic in the moment, a faster route to a DNA person who already has the summary, and for DNA, fewer scam-related support calls and a reason to keep the bundle. Finnish banks recorded €148M in attempted digital fraud in 2025, and the EU has proposed extending fraud-prevention liability to telecom operators. Full reasoning and sources: [BUSINESS.md](BUSINESS.md).

## 9. Where we disagree with the ground truth

`DSA-D-0200` and the supplier case in `five_journeys.jsonl`: we agree that the best primary action is to verify, but when a single answer can't know whether the invoice was already paid, giving both branches (with "call your bank's fraud line" for the paid branch) is defensible, because a paid invoice fraud is time-critical. We'd still change the order, as in section 5.

## 10. Files

- `test_predictions.jsonl`: all 335 test inputs, validated with `tools/validate.py --submission` (335 covered, 0 missing, OK).
- `answers.jsonl` is regenerated with `npm run eval:dev`; the multi-turn run with `sim/run_conversation.py --bot "npx tsx eval/bot.ts"`.
- Setup instructions: [README.md](README.md#try-it).
