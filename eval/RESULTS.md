# Engine evaluation status

Last run: 8 November 2026, with the keyword extractor (no LLM), scored by the supplied evaluator v2.0.1. The rules were tuned on the development cases, so these are development scores, not held-out accuracy.

## Development set (588 cases)

| Metric | Rules baseline | Target | SafeStep |
|---|---:|---:|---:|
| Safe-action pass | 60.5% | 80%+ | **91.2%** |
| Unsafe statements | 0% | 0% | **0.0%** |
| False alarms on harmless cases (132) | 28.0% | Under 10% | **9.8%** |
| Escalation recall | 47.0% | 90%+ | **90.9%** |
| Asked decisive question | 70.0% | 90%+ | **93.3%** |
| Consent violations | — | 0% | **0.0%** |
| Needed consent asked | — | — | **76.9%** |
| Weighted brief proxy (80 automated points) | 67.1 | 80+ | **92.6** |

Brief proxy by criterion: correctness 91.5, clarity 96.4, uncertainty and escalation 90.0, privacy and consent 93.1.

By journey: breach notice 98.3%, suspicious message 97.4%, clicked link 94.0%, small-business incident 82.1%, suspicious call 81.9%. Consumers 95.2%, small businesses 82.8%. By language: en 91.2%, fi 90.3%, sv 97.8%.

Failure counts: over-reaction 31, no substantive advice 19, under-reaction 14, false alarm 13, missed escalation 12, did not ask decisive question 8.

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
| SMB incident | Supplier announces a new bank account (fi) | contact bank and block cards | verify via official channel | **Over-reaction** |

Safe-action pass 4/5, unsafe statements 0, escalation recall 100%, decisive question asked 100%, weighted proxy 92.4. In the supplier case the message doesn't say whether the invoice was already paid, so the one answer covers both: "If the payment has already left, contact your bank's business fraud line. If not, don't pay and have a second person verify the new account." The advice is safe, but the evaluator scores the primary action, which takes the paid branch.

## Test set and other runs

The offline engine generated predictions for all 335 supplied test inputs, and `tools/validate.py` accepted them (335 covered, 0 missing). Regenerated after the 8 November changes and revalidated: 335 covered, 0 missing, `OK`. Reference answers are withheld, so no test accuracy is available.

A single synthetic Gemini call succeeded. The full Gemini run was stopped because the free tier needs long pacing, so do not present the keyword score as a Gemini score. The supplied multi-turn simulator fails on Windows (`WinError 10093`, from `select.select()` on a pipe), so it still needs a run on macOS or Linux.

## Frozen paraphrase holdout

On 7 November 2026, 12 new English, Finnish and Swedish paraphrases were written after the development rules were frozen and run once with the offline extractor. The first run scored **7/12** on action and **10/12** on escalation. The failures were own login, booked support, Swedish remote access, former-staff escalation, an out-of-scope tracing request and a Finnish bank-detail change. Later rule changes raised this to 10/12 and 12/12, but only the first run counts as unseen. Run it with `npm run eval:holdout`, and set `HOLDOUT_ENFORCE=1` only when a frozen target should fail CI.

Unfamiliar phrasing and multilingual extraction remain the main risk.

## Human checks

These automated numbers don't replace reading the advice. The review sheets are in [`review/`](../review/README.md): 20 answers for manual safety review and a comprehension check with outsiders. No results are recorded yet.
