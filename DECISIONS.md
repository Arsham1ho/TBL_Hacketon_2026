# SafeStep Decisions

Stage 1 safety and product contract. **Both teammates must approve it before Stage 2.**

## 1. Terms

| Term | Answers | Values |
|---|---|---|
| **Status** | What is the situation? | Safe, Needs verification, Threat in progress, Incident occurred |
| **Risk** | How bad could it get? | None, low, medium, high, critical |
| **Urgency** | How soon must the user act? | None, routine, today, immediate |
| **Action** | What is the one main thing to do? | The 10 supplied actions |
| **Destination** | Which person takes over? | The 4 supplied human targets, or none |
| **External contact** | Who must the user contact themselves? | Bank, police, cyber authority |
| **Confidence** | How well does the evidence support this? | 0 to 1, from evidence only |

These are independent. A case can be high risk with routine urgency, and critical with low confidence.

## 2. Action contract

`engine/contract.ts` enforces this table. `checkDecision()` rejects anything outside it.

| Action | Status | Risk | Urgency | Human destinations |
|---|---|---|---|---|
| `no_action_needed` | Safe | None, low | None, routine | None |
| `do_not_interact_and_delete` | Needs verification, Threat | Low to high | Routine, today | None |
| `verify_via_official_channel` | Needs verification, Threat | Low to high | Routine, today | None |
| `contact_operator_support` | Any open status | Low to critical | Routine to immediate | All four |
| `change_password_and_enable_mfa` | Any open status | Low to critical | Routine to immediate | Specialist, business support |
| `isolate_device_and_scan` | Any open status | High, critical | Today, immediate | Specialist, business support |
| `contact_bank_and_block_cards` | Any open status | High, critical | Today, immediate | Specialist, business support, advisor |
| `report_to_authority` | Incident | Medium to critical | Routine, today | None |
| `escalate_to_human` | Any open status | Medium to critical | Today, immediate | All four |
| `decline_out_of_scope` | Any open status | Low to critical | Routine to immediate | None |

Open statuses are every status except Safe.

Extra rules:

- Safe needs `no_action_needed`, low risk at most, no decisive unknowns, no outside contacts and no Rescue Mode.
- Password, device and bank actions under Needs verification must name the unknown fact. This is the "Not sure" path: worst-case-safe advice without claiming harm happened.
- `escalate_to_human` must name a destination.
- `contact_bank_and_block_cards` must list the bank. DNA staff can't block a card.

## 3. Immediate interruption

The Stop Screen appears before any question when `interruptionFor()` returns a kind.

1. Personal safety risk always interrupts. It gives 112 and says not to remove anything yet.
2. Otherwise the threat must be stated as happening now.
3. Nothing interrupts if the user started it or already verified it, such as their own login or booked IT support. Unknown doesn't count as started by the user.
4. Active ransomware, approval prompts and a live remote session interrupt.
5. A live request interrupts, in this order: remote access, install, code, approval, money, card, login, bank change.

If timing is unknown, there is no Stop Screen, but the advice still says what not to do. This avoids false alarms from old messages. A takeover with nothing for the user to stop, such as a lost SIM, goes straight to Rescue Mode. Fast Danger Check will keep phrases like "he's still on the phone" from depending on the LLM.

## 4. Uncertainty and confidence

- Unknown facts stay unknown, and `null` never means "no".
- Safe is refused while a decisive fact is unknown.
- Confidence rises with confirmed facts and falls with decisive unknowns and conflicts.
- Severity isn't an input to confidence.
- Confidence never reaches 1.

## 5. Boundaries

**Non-goals:** tracing or exposing scammers, retaliation, reading unrelated data, irreversible actions without human approval, and presenting uncertain conclusions as fact.

**Prototype:** every signal, DNA action and human handoff is simulated. The app shows a permanent notice.

**Guidance:** supplied passages can support advice, but they are synthetic. They are never described as official DNA or authority guidance.

**Untrusted content:** text in messages, links, call notes and attachments is evidence, never instructions.

- It is wrapped in `<incident_content>`, and look-alike tags are removed from it and from the user's own text, because people paste scams straight into their message.
- `Facts` is strict, so the LLM can't return a risk, action or destination.
- Rules alone produce a `Decision`.

**Sensitive input:** cards, codes and passwords are masked before any LLM call, log or summary. Only the kind of secret is recorded, and the user sees a warning. IBANs, phone numbers and links stay visible because they are evidence.

Known masking limits: letter-and-number codes, a code with no code word nearby, a code in a different sentence from the word, and plain-word passwords after a descriptive word, as in "the password is still kissa". Stage 3 tests what reaches summaries and handoffs.

**Session data:** don't ask for identity details the app already has. Keep only what the active journey needs, delete it when the session ends, and leave unnecessary details out of handoffs.

**LLM provider:** masked text and permitted facts are sent to the Gemini API. A free-tier key may let Google use that data to improve its products, so a real service would need a paid tier. The consent text and Data Receipt must say so.

## 6. Fallbacks

`content/approved-text.json` has three fallbacks: analysis failed, unclear input and service unavailable. Each one:

- says we can't confirm it is safe
- keeps the stop line for anyone being pressured right now
- offers a person

## 7. Decision log

| Decision | Why |
|---|---|
| Four statuses, with critical as a risk level | Critical cases span four actions in the dev set, so a fifth status adds no routing value |
| Separate `destination` and `externalContacts` | The evaluator's four targets are people. The bank and police are contacts the user reaches alone |
| New `incidentType` field and added facts | The old schema couldn't express breach, login, MFA, device or staff-access cases |
| Added `dataExposed`, `independentlyVerified`, `passwordReused` and `serviceLost` | These facts change the action in harmless and account cases |
| `incidentType` values are neutral, such as `message_or_notice` | Genuine bills land there too, so the label must not assume a scam |
| Needs verification allowed for worst-case actions | 84 twin answers need that advice before the deciding fact is known |
| Stop Screen doesn't fire for self-started or verified events | Own logins and booked IT support are harmless cases in the dataset |
| User-facing label "Looks safe", not "Safe" | Avoids claiming certainty the evidence can't support |
| Safe needs positive evidence | "Nothing risky found" called a grandchild money call and an emptied account Safe |
| Decision Flips are computed by running Yes and No through the rules | A question exists only if the answers lead to different responses |
| Not sure gives conditional advice under Needs verification | Advice is safe for the worse answer without claiming it is true |
| Don't advise blocking a card until exposure is known | The bank can decide, and unneeded blocking is unjustified alarm |
| Facts need a quote that appears in the source text | A model can't narrow a case by inventing facts |
| Offline extractor stays on beside the LLM | It catches facts the LLM misses, and it is the fallback when the LLM fails |
| User-facing "Talk to a person" | "Rescue service" means the fire and rescue service in Finland |

## 8. Stage 1 exit gate

| Gate | State | Evidence |
|---|---|---|
| Every action maps to status, urgency and escalation | Done | Table above; `npm run check:contract` found no breaches across 588 dev cases, including no-reply twin answers. The dataset has no status labels, so statuses are our design |
| Team can explain status, risk, urgency, action and escalation | Done | Team agreed section 1 |
| Immediate danger has a clear rule | Done | `engine/interruption.ts` and tests |
| Uncertainty is represented | Done | `checkDecision()` and confidence tests |
| Synthetic and official content are separated | Partly done | Notice exists in three languages; the Output Guard check comes later |
| Injection can't override the contract | Partly done | Delimiter and strict schema tests; needs a real LLM attack test once extraction exists |
| Secrets are masked everywhere | Partly done | Input Guard tested and run on 1,846 dataset texts; summaries and handoffs are tested once they exist |
| Reviewed fallback exists | **Needs review** | Drafted in three languages; Finnish and Swedish need a native speaker |
| Both teammates approve | Done | Confirmed below |

**Approved by:** Arsham and Mehrab, 7 November 2026.

## 9. Stage 2 results

Run on 7 November 2026 on the 588 dev cases with `gpt-5.4-mini`. The rules were tuned on these same cases, so **these numbers show what the logic can reach, not expected accuracy on new cases**. Stage 5 tests held-out scenarios.

| Metric | Baseline | Target | Keywords only | **LLM, one answer** | **LLM, multi-turn** |
|---|---:|---:|---:|---:|---:|
| Safe-action pass | 60.5% | 80%+ | 98.0% | **95.9%** | **95.9%** |
| Reference-action match | 65.6% | 75%+ | 86.1% | **84.5%** | **90.6%** |
| False alarms on harmless cases | 28.0% | Under 10% | 9.1% | **11.4%** | **11.4%** |
| Escalation recall | 47.0% | 90%+ | 100% | **98.5%** | **99.0%** |
| Asked decisive question | 70.0% | 90%+ | 100% | **95.0%** | **95.0%** |
| Weighted proxy | 67.1 | 80+ | 96.6 | **95.7** | **95.5** |
| Unsafe statements | 0% | 0% | 0% | **0%** | **0%** |
| Called Safe when action was needed | n/a | 0 | not measured | **0** | not measured |

The keyword column is higher because those rules were tuned on these exact sentences. The LLM column is the honest guide to the product, and it should cope better with new wording.

**Target missed:** false alarms are 11.4% with the LLM, above the 10% target. These are mostly genuine notices and offers sent to a cautious check, and Stage 5 needs to bring this down.

**Known false alarms:** genuine operator offers with a noisy link result, new-payee notices and some genuine bank notices.

**Decisions from the LLM run:**

- The LLM reads, and the keyword extractor stays on as a backstop. A danger fact from either is kept.
- Reassuring facts need nothing against them, because a true quote can still support a wrong conclusion.
- Rules, not the model, decide. A model reading an opened link as "self-started" must not produce Safe.

## 10. Stage 2 exit gate

| Gate | State | Evidence |
|---|---:|---|
| Every dev scenario has a valid route | Done | All 49 dev scenarios pass in most cases in both modes |
| Twin scenarios have a Decision Flip | Done | Decisive question asked in 100% of required cases |
| No question exists only to name a scam | Done | Questions are computed from differing responses |
| Yes and No change the action | Done | Unit tests across nine flips |
| Not sure never forces a conclusion | Done | Unit tests across nine flips |
| Unseen cases fall back safely | Done for tested cases | Our own unseen cases are never called Safe, by keyword tests and a live LLM run. This can't prove every case |
| Unsupported facts return to unknown | Done | Fact Validator tests and real LLM runs |
| Every action has a short reason | Done | Test checks every outcome; text is a draft |
| Zero to two questions | Done | Multi-turn with the LLM averages 0.20 questions, and no case needed more than 1 |

**Live check:** 16 hard cases through the running app with the real LLM, including injection and pasted secrets. All behaved safely, and no secret or scam link appeared in any response. Replies took 1 to 4 seconds. A browser run of the Decision Flip showed the advice changing with the answer.

**Known issues:**

- A scam message with a payment link and no named sender can read as a colleague's payment demand. The advice is over-cautious but safe.
- Some fake operator code calls get the wrong question when the LLM calls them a SIM problem.
- The test page has no simulated link or call signals.

**Not done yet:** Finnish and Swedish text is still drafted by Claude, so a native speaker should confirm it before the demo.

**Full-flow fixes (7 Nov):**

- `npm run eval:scenarios` runs 50 full conversations in three languages. These were tuned, so 150 of 150 proves coverage, not accuracy on new wording.
- `npm run eval:frozen` scored 36 of 45 with 2 severe misses on its first run. Both severe misses were live danger in Finnish and Swedish. It now passes 45 of 45, but those fixes used the set, so it no longer counts as unseen.
- The keyword extractor did all of this. The LLM path was not checked, because the Gemini free quota is used up.
- A message the user deleted or ignored now reads as Safe, unless money, a code, a card, an app install, pressure or an unchecked link is involved.
- A caller posing as the bank offers the bank first, even when the outcome names no bank contact.
