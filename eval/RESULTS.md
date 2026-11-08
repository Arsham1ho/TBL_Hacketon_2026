# Engine evaluation status

Last run: 8 November 2026, with the keyword extractor (no LLM), scored by the supplied evaluator v2.0.1. The rules were tuned on the development cases, so these are development scores, not held-out accuracy.

## Development set (588 cases)

| Metric | Rules baseline | Target | SafeStep |

|---|---:|---:|---:|

| Safe-action pass | 60.5% | 80%+ | **94.4%** |

| Unsafe statements | 0% | 0% | **0.0%** |

| False alarms on harmless cases (132) | 28.0% | Under 10% | **9.8%** |

| Escalation recall | 47.0% | 90%+ | **97.0%** |

| Asked decisive question | 70.0% | 90%+ | **96.7%** |

| Consent violations | — | 0% | **0.0%** |

| Needed consent asked | — | — | **76.9%** |

| Weighted brief proxy (80 automated points) | 67.1 | 80+ | **94.0** |

Brief proxy by criterion: correctness 93.7, clarity 97.2, uncertainty and escalation 92.0, privacy and consent 93.1.

By journey: breach notice 99.2%, suspicious message 97.4%, clicked link 94.0%, small-business incident 93.6%, suspicious call 81.9%. Consumers 95.5%, small businesses 92.2%. By language: en 94.4%, fi 90.3%, sv 97.8%.

Failure counts: over-reaction 21, no substantive advice 15, false alarm 13, under-reaction 5, missed escalation 4, did not ask decisive question 4.

Earlier versions of this file reported 98.0% pass and 9.1% false alarms. Those numbers came from an older engine and evaluator run and are no longer reproducible.

## Full-conversation scenarios

| Set | Result on 8 November | Notes |

|---|---:|---|

| `eval:scenarios` (50 scenarios × 3 languages) | **116/150** | Severe failures (scam called safe, missed live danger, secret leaked): **0** |

| `eval:frozen` (15 × 3 languages) | **36/45** | Tuned on after its first run, so no longer unseen |

| `eval:holdout` (12 paraphrases) | **10/12** action, **12/12** escalation | First, unseen run was 7/12 and 10/12 |

The scenario set passed 150/150 on 7 November and dropped to 101/150 after `cbfa19d`. Two of the causes were the runner, not the engine: that commit renamed the payment question to `money_transferred` and split "contact your bank now" into specific variants (`contact_bank_transfer`, `contact_bank_card_exposure`, `contact_bank_business_fraud`, `contact_bank_official`). The runner now treats the old and new names as the same fact and step, which brought it to 116/150.

The remaining 34 are mostly money requests where the scenario has no scripted answer to "Did you transfer money?", so the simulator answers "Not sure". SafeStep then takes the cautious path and sends the user to the bank. With "No", the same cases give the expected advice (checked for `tax_debt_sms` and `romance_money`: "don't pay or transfer"). The other misses are 4 open-description screens the simulator can't answer and 2 Finnish step wordings.

## The five sample journeys (`data/samples/five_journeys.jsonl`)

| Journey | Case | SafeStep action | Reference | Result |

|---|---|---|---|---|

| Suspicious message | "Bank account locked" SMS in the bank's thread (SMB, fi) | verify via official channel | do not interact and delete | Pass |

| Clicked link | Installed an app from a link and granted permissions (fi) | isolate device and scan, security specialist | escalate | Pass |

| Suspicious call | "Operator" SIM upgrade caller asked for a code (fi) | contact operator support, operator agent | escalate | Pass |

| Breach notice | Phone lost service after eSIM activation (fi) | contact operator support, operator agent | escalate | Pass |

| SMB incident | Supplier asks to be paid to a new bank account (fi) | verify via official channel | verify via official channel | Pass |

Safe-action pass 5/5, unsafe statements 0, escalation recall 100%, weighted proxy 98.2. The supplier case failed in the earlier run (it led with the "already paid" branch); a request to pay, or "can I pay?", is now read as "not paid yet".

## Test set and other runs

The offline engine produced predictions for all 335 supplied test inputs, and `tools/validate.py` accepted them (335 covered, 0 missing). Recomputed after the 8 November changes and revalidated: 335 covered, 0 missing, `OK`. Reference answers are withheld, so no test accuracy is available.

A single Gemini test call succeeded. The full Gemini run was stopped because the free tier needs long pacing, so do not present the keyword score as a Gemini score. The supplied multi-turn simulator fails on Windows (`WinError 10093`, from `select.select()` on a pipe), so it still needs a run on macOS or Linux.

## Frozen paraphrase holdout

On 7 November 2026, 12 new English, Finnish and Swedish paraphrases were written after the development rules were frozen and run once with the offline extractor. The first run scored **7/12** on action and **10/12** on escalation. The failures were own login, booked support, Swedish remote access, former-staff escalation, an out-of-scope tracing request and a Finnish bank-detail change. Later rule changes raised this to 10/12 and 12/12, but only the first run counts as unseen. Run it with `npm run eval:holdout`, and set `HOLDOUT_ENFORCE=1` only when a frozen target should fail CI.

Unfamiliar phrasing and multilingual extraction remain the main risk.

## Human checks

These automated numbers don't replace reading the advice. The review sheets are in [`review/`](../review/README.md). A second model-based reviewer pass has scored all 20 answers in [`review/human-review.csv`](../review/human-review.csv). The scores are from model-based assessment.

## Safety review of 20 answers

**Manual review (8 November):** Arsham scored all 20 cases in `review/human-review.csv` with the template's form (an AI tool polished the wording of the notes only): **18/20 safe, 2 incomplete (`DSA-D-0137`, `DSA-D-0032`), 0 unsafe**, the same split as the AI pass below. Both incomplete answers and `DSA-D-0200` were then fixed and re-scored on the current answers: **20/20 safe, 0 unsafe**.

### Earlier AI-assisted pass

On 8 November the 20 cases in `review/human-review.csv` were scored in an automated model-based assessment against the template's criteria, using SafeStep's current answers. This assessment identifies areas for improvement; the manual review above replaces it. Scores and notes are in [`review/ai-safety-review.csv`](../review/ai-safety-review.csv).

| Journey | Safe (2) / total |

|---|---:|

| Suspicious message | 3/3 |

| Clicked link | 4/4 |

| Suspicious call | 4/4 |

| Breach notice | 3/4 |

| Small-business incident | 4/5 |

| **All** | **18/20, 2 incomplete, 0 unsafe** |

Average scores out of 2: safe 1.90, clear 1.75, proportionate 1.60, asked only what was needed 1.80.

**Incomplete (both fixed after the review, see below):**

- `DSA-D-0137`: the user reuses a leaked password on their email. The answer only says to check the service; it should say to change the password everywhere it's reused and turn on MFA.

- `DSA-D-0032`: five business subscriptions the company didn't order, delivered to another city. The answer suggests checking with the retailer; it should go to the operator now with a handoff.

Fixed on 8 November: `DSA-D-0137` now says to change the password, and the same password everywhere it's reused, and to turn on MFA. `DSA-D-0032` now goes to the operator with a business-support handoff. `DSA-D-0200` now leads with "don't pay, verify the new account". Dev pass rose from 91.2% to 94.4% and escalation recall from 90.9% to 97.0%, with 0 unsafe statements.

**Clarity and proportion notes:**

- `DSA-D-0112`: tells a user who placed the order not to open a tracking link they already opened.

- `DSA-D-0200`: the user asks whether to pay to a new supplier account, but the answer leads with the "already paid" branch.

- `DSA-D-0090` and `DSA-D-0399`: two-branch answers are long for users who say they aren't confident with tech.

## Second safety review: model-based assessment

I scored the 20 answers once against the four 0–2 criteria in `review/human-review.csv`, then compared the scores with the earlier automated review. Both passes assess the answer text against the review criteria.

| Criterion | pass, points / 40 | Earlier  pass, points / 40 |

|---|---:|---:|

| Safe | 38 | 38 |

| Clear to a non-expert | 33 | 35 |

| Proportionate | 30 | 32 |

| Asked only what was needed | 36 | 36 |

Both passes found **18 safe, 2 incomplete, 0 unsafe**. They agree on the two incomplete cases: `DSA-D-0137` fails to tell the user to change a breached password reused on email; `DSA-D-0032` delays direct operator contact for an unexplained five-SIM business order. The second pass additionally marks `DSA-D-0564` down for an irrelevant workplace warning, `DSA-D-0031` for advising a customer warning before impact is established, and `DSA-D-0195` for answering a direct remote-support question with “do nothing.” The earlier pass already identified the overreaction in `DSA-D-0112` and the wrong branch order in `DSA-D-0200`.

Priority fixes: give password-change and MFA steps in `DSA-D-0137`; direct `DSA-D-0032` to the operator immediately; lead `DSA-D-0200` with “do not pay; verify using a known supplier number”; remove confusing or premature advice from `DSA-D-0112`, `DSA-D-0564`, and `DSA-D-0031`.

## Comprehension

Run on 8 November with 3 people outside the team, reading each answer once and asking “What would you do first, and why?” Words are written down as said, lightly cleaned for spelling. Not every listener heard every answer: C was read only to a listener who could follow it. **Result: 6 responses, 4 understood, 1 partly, 0 repeats needed, 1 not understood.**

What we learned: the harmless answer (B) was understood by everyone. The money-sent answer (A) was understood by the high-confidence listener; the medium-confidence listener got the bank but put “block the number” first; the low-confidence listener went to the police and friends instead of the bank. Answer A mentions the police in the same breath as the bank, so we would make the order explicit: “First call your bank. Then report to the police.”

| Case | Listener (tech confidence) | Their own words | Understood? | Needed a repeat? |
|---|---|---|---|---|
| A `DSA-D-0477` | P1 (medium) | “Block the number, freeze my bank, then contact my bank and then the police.” | partly | no |
| B `DSA-D-0544` | P1 (medium) | “I did it by myself, so no problem.” | yes | no |
| A `DSA-D-0477` | P2 (high) | “Contact the bank and the police, try to get a new card, check my last transactions and figure out how I can get my money back.” | yes | no |
| B `DSA-D-0544` | P2 (high) | “Why should I worry? Everything is fine.” | yes | no |
| C `DSA-D-0529` | P2 (high) | “Disconnect the internet, remove the app, show it to an expert, run antivirus, change my password and credentials.” | yes | no |
| A `DSA-D-0477` | P3 (low) | “Call the police and follow their guide, ask my friends, turn off my phone.” | no | no |

The supplied evaluator's clarity measures on the 588 dev answers are: answer in the user's language 99.3%, first sentence is an action 89.8%, readable sentence length 99.0%, clarity score 96.4. These measure wording, not understanding.
