# Engine evaluation status

The offline extractor and deterministic rules were run on all 588 development cases with the supplied evaluator. Safe-action pass was 98.0%, false alarms on 132 benign cases were 9.1%, escalation recall was 100.0%, and the evaluator flagged no unsafe statements. These cases informed rule development, so this is a development score, not held-out accuracy.

The offline engine generated predictions for all 335 supplied test inputs. `tools/validate.py` accepted the submission: 335 covered, 0 missing. Their reference answers are withheld, so no accuracy score is available. Fourteen additional scenario regressions cover novel wording and safety classes, including WhatsApp code sharing, romance payment requests, gift cards, invoice wording, number transfer, and prompt injection.

A single synthetic Gemini call succeeded. The full Gemini development run was stopped before completion because the free tier required lengthy pacing. Do not present the offline score as a Gemini score. The supplied Windows multi-turn simulator uses `select.select()` on a subprocess pipe and fails locally with `WinError 10093`; the bot protocol still needs a compatible run before submission.

These are automated checks. They do not replace manual safety review or review of Finnish and Swedish wording.

## Frozen paraphrase holdout

On 7 November 2026, 12 new English, Finnish and Swedish paraphrases were written after the development rules were frozen and run once with the offline extractor. The first-run action result was **7/12** and the escalation check was **10/12**. The six observed failures were preserved rather than used for rule tuning: own login, booked support, Swedish remote access, former-staff escalation, an out-of-scope tracing request, and a Finnish bank-detail change. This is a small challenge set, not an estimate of production accuracy. Run it again with `npm run eval:holdout`; set `HOLDOUT_ENFORCE=1` only when a future frozen target should fail CI.

The failure pattern shows that unfamiliar phrasing and multilingual extraction remain the main risk. The Gemini comparison must report these cases separately from the tuned development score.
