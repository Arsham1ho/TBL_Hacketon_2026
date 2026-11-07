# Small Business Plan: SafeStep for Companies

## Context

Small businesses are a named audience in DNA's brief, and they are 33% of dev cases (192 of 588) and 28% of test cases (95 of 335). Today they get the consumer flow with a different destination. The engine never reads the company profile, although every business case carries one.

This plan adds what a company needs that a consumer doesn't: seeing its own exposure, knowing who must do what, and meeting business obligations. Deadline: Sunday 10:00, about 26 hours away.

## Key finding: we can't honestly "predict" risk

The dataset shows no link between company profile and incidents. Critical incidents are 25% for every group, with or without two-person approval or IT support. Escalation (20–24%) doesn't vary meaningfully either.

So a "your risk is 73%" score would be invented, and it would break the brief's "unjustified certainty" rule. **We show control gaps, not predictions:** facts we can see, why each matters, and one fix. It is more honest, more useful, and it can't be disproved by a judge.

| Available signal | Real data | Gap it shows |
|---|---|---|
| `payment_approval` | 69% single person | One person can be tricked into paying |
| `it_support` | 67% none | Nobody to call in an incident |
| `admins` | 68% only one | One lost login locks the company out |
| `staff_accounts` (consent) | Former employee still active in some cases | Old access is still open |
| `device.summary` | 41% behind on updates | Known weaknesses stay open |

The profile may change the **steps and wording**, never the status, risk, action or destination. The safety contract stays intact.

## The user flow

```text
Business portal: user already identified
        │
1. "What's happening at your business?"  (one free-text box)
        │
2. Live danger? ──► Stop Screen: "Hold the payment"
        │
3. One deciding question: "Has the payment been sent?"  Yes / No / Not sure
        │
4. Consent only if it changes the answer: "Check staff accounts?"
        │
5. Action Plan with owners: You → Second approver → IT partner or DNA support
   + What this could reach   + 72-hour reminder if personal data may be involved
        │
6. Warn your team: editable draft, approved by the user (simulated send)
        │
7. Human handoff with an approved summary
        │
8. "Stop this happening again": Company Exposure Check, top 3 gaps, one fix each
```

The Exposure Check comes **after** the incident, when motivation is highest. It also works alone from a "Check my company" button. It asks at most 2 yes/no questions, and only what the profile doesn't already show.

## What to build

### Must build (fits today)

1. **Fix the wrong advice.** A fake domain invoice currently gives `account_password_exposed`, meaning "change your password". Add an unmatched-invoice situation: don't pay, check your own records. Uses `guidance_fake_domain_invoice`. Also check complaint-attachment cases.
2. **Company context.** Add `company` to `Case`, filled from `signals.business.profile` in `eval/to-submission.ts` and from a simulated demo profile in the app.
3. **Company-aware Action Plan.** Add owners to steps, plus profile-based steps: two-person approval when payments are single-person, "call your IT partner" or DNA business support depending on `it_support`, and warn staff when there are employees.
4. **What this could reach.** One short line per incident, always "may": a mailbox can reach customers and invoices, a device can reach the same network.
5. **Company Exposure Check.** Top 3 gaps, each with the evidence, why it matters, one fix and a guidance source. Unknowns are shown as unknown.
6. **72-hour reminder.** For mailbox, staff phishing and ransomware incidents: "may have to report" to the Data Protection Ombudsman, from `guidance_data_protection_breach`. Written as guidance, not legal advice.
7. **Warn Your Team.** An approved template in fi, en and sv that the user edits and approves. It never includes secrets, and sending is simulated.

### Build if time allows

8. **Payment Pause.** A two-person check that records who confirmed what and when, on a simulated record. It never stops a real payment.
9. **Incident Pack.** A timeline for the bank, police or IT partner.

## Files

| File | Change |
|---|---|
| `engine/case.ts`, `eval/to-submission.ts` | Add `company` |
| `engine/company.ts` (new) | Owners, reach, 72-hour rule, Exposure Check. Pure functions |
| `engine/situations.ts`, `engine/offline-extractor.ts`, `adapters/llm.ts` | Unmatched invoice, with a new prompt version |
| `engine/screens.ts` | Add one optional `business` block to `ApiResponse`, so no existing screen breaks |
| `engine/handle-event.ts`, `adapters/signals.ts` | Fill the block; add a demo company profile |
| `engine/output-guard.ts` | Check all new text |
| `content/company.json` (new), `steps.json`, `reasons.json` | All new text in fi, en and sv |
| `components/safestep-app.tsx` | Render owners, reach, 72-hour reminder, Exposure Check, Warn Your Team |

**Reuse:** `person()` in `situations.ts`, `signalLabel` and `readSimulatedSignal` in `adapters/signals.ts`, `requestSignal` consent flow in `handle-event.ts`, `withinContract()` and `safeIsBlocked()` unchanged, `guidance-titles.json` for sources.

**Coordination:** the main folder has another session's uncommitted UI changes, and `mehrab-ui` is active. Agree who owns `engine/screens.ts`, and build in a separate worktree from current `main`.

## How this meets the brief

| Brief requirement | How it is met |
|---|---|
| Advice for small enterprises on company security | Company-aware plan, owners, staff warning |
| Clear, proportionate next step | One action first, owners named, gaps limited to 3 |
| Explain why, show source | Every gap and step shows evidence and guidance |
| Ask only for necessary information | Profile is reused; at most 2 extra questions |
| Recognise uncertainty, don't guess | Gaps, not predictions; "may" wording; unknowns shown |
| Hand off to a human | Business support, or the company's IT partner |
| Clear consent for optional data | Staff accounts stay consent-gated |
| No irreversible action without approval | Staff alert and Payment Pause are simulated and user-approved |
| Inside identified DNA services | Business portal entry, no re-identification |
| Packaging as a hypothesis | Basic check included; monitoring and support as a paid hypothesis |

## What makes us win

Most teams will build a chatbot that gives a verdict. Our story is: **"It doesn't just answer. It gets the whole company through the incident."**

1. **Gaps, not fake scores.** Say out loud that the data can't predict incidents, so we don't claim to. Judges reward this honesty directly under Uncertainty.
2. **Who does what.** The finance assistant, owner and IT partner each get their own step.
3. **The 72-hour reminder.** Almost no one will think of this, and it's real business value.
4. **Warn Your Team.** One phished employee protects everyone else in 30 seconds.
5. **Incident to prevention.** Each incident ends by closing the gap that caused it.

**Best demo (60 seconds):** a finance assistant gets a CEO payment demand. Stop Screen, "Has it been sent?", No, Action Plan with owners, the gap "one person approves payments", Payment Pause turned on.

## Pitch only (don't build)

- **Monthly Exposure Report** that tracks the company's gaps over time
- **Scam Wave Alerts:** anonymised reports warn other Finnish companies, with legal review
- **Supplier Safe List:** remembers verified supplier bank details
- **"Is this really DNA?"** check for calls and invoices claiming to be DNA
- **IT partner portal** that receives handoffs directly
- **Insurance link:** a cyber insurer could use the report, with consent
- **Package hypothesis:** check included in business plans; monitoring and human response as a monthly add-on. Validate with DNA

## Verification

1. **Unit tests** in `tests/company.test.ts`:
   - The profile never changes status, risk, action or destination. Run every dev case with different profiles and require identical decisions.
   - Single-person payment adds two-person approval, and no gap claims certainty.
   - Staff accounts can't be read without consent.
   - All new text exists in fi, en and sv and passes the Output Guard.
2. **Regression:** run `npm test`, `npm run typecheck` and `npm run build`, keep the 0 wrongly-Safe count, and compare dev scores before and after.
3. **Business score:** report the evaluator's small-business breakdown, and check that the domain invoice inputs no longer get password advice. Check the irrelevant-step score doesn't rise.
4. **Browser:** run the CEO demo, supplier change, ransomware and a refused-consent path, in English and Finnish.
5. **Human review:** read at least 20 business answers, including every incident type.
