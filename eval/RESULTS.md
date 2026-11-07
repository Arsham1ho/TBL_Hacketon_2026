# Engine evaluation status

The current results are in [RESULTS.md](../RESULTS.md) at the repository root. This file only keeps notes on how the evaluation was run.

## Summary (7 November 2026, keyword extractor)

| | One message | Conversation |
|---|---:|---:|
| Safe-action pass | 97.6% | 95.7% |
| Unsafe statements | 0% | 0% |
| False alarms on 132 harmless cases | 9.8% | 9.8% |
| Escalation recall | 100% | 100% |
| Asked the decisive question | 100% | 100% |

The rules were developed on these same cases, so this is a development score, not held-out accuracy.

All 335 test inputs have predictions in `test_predictions.jsonl`, and `tools/validate.py` accepts it: 335 covered, 0 missing. Their reference answers are withheld, so no accuracy score is available.

The supplied multi-turn simulator runs on macOS and Linux with `--bot "npx tsx eval/bot.ts"`. It failed on Windows because it uses `select.select()` on a subprocess pipe.

Gemini has only been measured on a 50-case sample. Don't present the keyword scores as Gemini scores.

## Frozen paraphrase holdout

On 7 November 2026, 12 new English, Finnish and Swedish paraphrases were written after the development rules were frozen and run once with the keyword extractor. The action matched in **7 of 12** and the escalation check passed in **10 of 12**. The failures were kept rather than used for tuning: own login, booked support, Swedish remote access, former-staff escalation, an out-of-scope tracing request, and a Finnish bank-detail change. Run it again with `npm run eval:holdout`.

Unfamiliar wording and multilingual extraction remain the main risk. These are automated checks and don't replace the manual safety review or a native-speaker review of the Finnish and Swedish text.
