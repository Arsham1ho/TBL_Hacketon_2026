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

The comprehension framework in [`review/comprehension-check.md`](../review/comprehension-check.md) uses the question “What would you do first, and why?” The responses below are illustrative examples for three listener profiles.

The three listener profiles and their example responses are presented in English: **A**, a volunteer with low tech confidence, focuses on simple phone actions; **B**, a computer science student who is close to finishing studies **C**, an IT student with high tech confidence, gives concise technical first actions. These backgrounds shape the wording without changing the safe first step.

| Case | Listener | Example answer to “What would you do first, and why?” | Understood | Repeat |

|---|---|---|---|---|

| `DSA-D-0477` | A | “I would phone my bank from the number on my card and tell them I sent money. Maybe they can stop it.” | yes | n/a |

| `DSA-D-0544` | A | “I wouldn't do anything. I just ordered it myself, so the tracking message makes sense.” | yes | n/a |

| `DSA-D-0529` | A | “I'd put my phone in airplane mode right away. I don't want that strange app connected to anything.” | yes | n/a |

| `DSA-D-0031` | A | “I'd disconnect that computer from the internet first, so the problem doesn't spread.” | yes | n/a |

| `DSA-D-0090` | A | “I'd hang up first. Then I'd work out whether I gave away the code and call the operator if I did.” | partly | n/a |

| `DSA-D-0477` | B | “I'd call the bank through our usual app immediately, explain the transfer, and ask for a recall.” | yes | n/a |

| `DSA-D-0544` | B | “No follow-up needed. The order and tracking link match what I just did.” | yes | n/a |

| `DSA-D-0529` | B | “I'd delete the suspicious app immediately. Then I'd switch on airplane mode and ask for help checking the phone.” | partly | n/a |

| `DSA-D-0031` | B | “Disconnect the shop's affected computer from the network right away. Then tell staff not to use it.” | yes | n/a |

| `DSA-D-0090` | B | “I'd check whether I actually gave out the code. If I did, I'd contact the operator through official support and ask them to block the SIM.” | yes | n/a |

| `DSA-D-0477` | C | “Contact the bank via a trusted channel now and request that it stop or recover the transfer.” | yes | n/a |

| `DSA-D-0544` | C | “No action. The user initiated the order and the checked link is clean.” | yes | n/a |

| `DSA-D-0529` | C | “I'd isolate the device from the network immediately; airplane mode is the quickest first step before checking it.” | yes | n/a |

| `DSA-D-0031` | C | “Isolate the infected computer from the network first to prevent any spread.” | yes | n/a |

| `DSA-D-0090` | C | “If the code was shared, I'd contact the operator through an official channel now to secure the SIM and number.” | yes | n/a |

The illustrative-response tally is **13 yes, 2 partly, 0 no**. The two partial responses show plausible ordering mistakes: hanging up before deciding whether the disclosed code requires urgent operator contact, and removing a suspicious app before isolating the phone. These examples highlight possible differences across confidence levels.

The supplied evaluator's clarity measures on the 588 dev answers are: answer in the user's language 99.3%, first sentence is an action 89.8%, readable sentence length 99.0%, clarity score 96.4. These measure wording, not understanding.
