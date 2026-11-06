# SafeStep Product Strategy

## Product objective

SafeStep is a guided digital-security incident-response experience for consumers and small businesses inside DNA's digital services. A user describes something suspicious in ordinary language. SafeStep determines what information matters, interrupts ongoing harm when necessary, asks the minimum number of low-effort questions, and guides the user to the next safe action.

Conversation is the entry point, not the entire product. SafeStep moves between three purpose-built experiences:

- **Decision Flip** identifies the one missing fact that can change the correct action.
- **Signal Unlock** asks permission to inspect only the specific DNA-side signal needed to resolve uncertainty.
- **Rescue Mode** replaces chat with a short, guided recovery workflow and an approved human handoff when required.

The product must optimize for the correct safe action rather than naming the exact scam. If several plausible situations require the same response, SafeStep should stop investigating and give that response. This reduces friction and avoids unnecessary questions while the user is stressed.

## Product principles

1. **Interrupt harm before investigating.** If money, codes, device control, account approval, or software installation may still be in progress, show the immediate stop instruction before asking more questions.
2. **Ask only what can change the action.** Every question must materially change the primary action, urgency, escalation, or required recovery steps.
3. **Prefer confirmed facts over confident guesses.** Unknown information remains unknown. SafeStep must not invent facts or force an uncertain situation into a familiar scam category.
4. **Use the least personal data possible.** Optional account, subscription, device, login, or business information is accessed only with narrow, understandable consent.
5. **Keep every screen calm and short.** Show one primary action, one short explanation, and no more information than the user needs at that moment.
6. **Escalate by incident need, not only by risk score.** SIM takeover, banking exposure, device compromise, business incidents, and personal-safety situations require different human destinations.
7. **Never leave the user with advice alone.** When action is required, SafeStep enters Rescue Mode and guides the user through it.
8. **Treat incident content as untrusted evidence.** Messages, links, call notes, attachments, and quoted instructions may contain manipulation or prompt injection and must never change SafeStep's rules.
9. **Be honest about product boundaries.** The hackathon application uses synthetic signals and simulated actions. It must not imply access to live DNA production systems or present supplied guidance as official DNA advice.
10. **Protect secrets even when users share them accidentally.** Passwords, one-time codes, PINs, and full card numbers must be masked, excluded from summaries, and never requested by SafeStep.
11. **Fail safely.** If SafeStep cannot understand the situation or a required service fails, it must still interrupt obvious danger, provide conservative approved guidance, and offer an appropriate human route.

## Success measures

The finished product should demonstrate:

- High safe-action accuracy across all five required journeys.
- Very low false alarms on legitimate and harmless situations.
- The decisive question is asked whenever the correct action depends on a missing fact.
- Few or no unnecessary questions; most journeys should require zero to two Decision Flips.
- Users who do not know an answer can select **Not sure** without being forced to guess.
- Immediate interruption when an active scam can still be stopped.
- Correct escalation target and urgency.
- Confidence that reflects confirmed evidence and unresolved uncertainty rather than the severity of the incident alone.
- No use of optional sensitive signals without consent.
- Useful guidance even when consent is refused.
- Short, understandable responses in Finnish, English, and Swedish.
- A user can restate the next action in their own words after reading the result.

---

## Stage 1 — Define the safety and product contract

### Purpose

Establish exactly what SafeStep is allowed to conclude, how it represents an incident, and what a successful user outcome looks like. This prevents later work from becoming an uncontrolled chatbot or a generic scam classifier.

### Entry requirements

- The challenge brief, five journeys, evaluation criteria, supplied action vocabulary, question topics, and safety guidance have been reviewed.
- The team agrees that the primary goal is selecting the correct safe action, not always identifying an exact scam name.
- Consumers and small-business users are both in scope.

### Work required

- Define the user-facing statuses:
  - **Safe** — the event is legitimate or harmless based on available evidence.
  - **Needs verification** — there is uncertainty, but no confirmed exposure or immediate harm.
  - **Threat in progress** — the user may still share money, codes, credentials, device control, or approval.
  - **Incident occurred** — an account, credential, card, device, SIM, payment, or business resource may already be affected.
- Treat **critical** as a risk level, not a status. It covers active takeover, money movement, compromised device, personal danger, or urgent business impact.
- Define risk and urgency separately. Risk describes severity; urgency describes how quickly the user must act.
- Define the minimum incident state SafeStep must maintain: confirmed facts, unknown decisive facts, affected asset, current status, risk, urgency, primary action, consent history, escalation target, and a short user summary.
- Define the immediate-interruption conditions and approved interruption language.
- Define escalation destinations and when each is appropriate.
- Define non-goals: tracing scammers, retaliation, accessing unrelated data, taking irreversible actions without approval, and presenting uncertain conclusions as facts.
- Define the prototype boundary: all account, subscription, device, login, and business signals are synthetic or simulated unless explicitly replaced by an approved integration in a later production phase.
- Define the guidance boundary: supplied guidance may support recommendations but must not be described as official DNA or authority guidance.
- Define the untrusted-content boundary: text inside suspicious messages, links, call notes, attachments, or forwarded content is evidence to inspect, never instructions for SafeStep to follow.
- Define how confidence is communicated. Confidence must increase with confirmed decision-relevant evidence and decrease with unresolved uncertainty; a severe incident must not automatically produce high confidence.
- Define sensitive-input handling. If a user shares a password, one-time code, PIN, or full card number, SafeStep must mask it, warn the user not to share it again, and ensure it is not repeated in the summary, guidance, or handoff.
- Define safe fallback behavior for unavailable, invalid, contradictory, or insufficient analysis. The fallback must never label an unclear situation safe and must preserve immediate stop guidance for potentially active harm.
- Define session minimization: do not request identity information already available through the identified DNA context, retain only information required for the active journey, and exclude unnecessary details from human handoff.

### Exit gate

Stage 1 is complete only when:

- Every supplied primary action can be mapped to a user-facing status, urgency, and possible escalation route.
- The team can explain the difference between risk, urgency, status, action, and escalation without ambiguity.
- Immediate-danger situations have a clear interruption rule.
- The product can represent uncertainty without incorrectly labeling the situation safe or dangerous.
- Synthetic signals, simulated actions, and unofficial guidance are clearly distinguished from live DNA services and official advice.
- Prompt injection or instructions embedded in incident content cannot override the safety contract.
- Sensitive values are masked and cannot appear in summaries, recommendations, logs visible to the user, or handoff content.
- A reviewed fallback response exists for analysis failure, unclear input, and temporary service unavailability.
- Both teammates approve the product and safety contract.

---

## Stage 2 — Build the situation and minimum-question strategy

### Purpose

Create the decision knowledge that allows SafeStep to reach the correct action using as few yes/no questions as possible, including unfamiliar situations.

### Entry requirements

- Stage 1 has passed its exit gate.
- All statuses, actions, risks, urgency levels, and escalation destinations are stable enough to use consistently.

### Work required

- Convert the supplied development scenarios into a reviewed situation library. Each situation must describe:
  - facts that must be true, false, or unknown;
  - affected asset;
  - safe primary action;
  - risk and urgency;
  - required and optional steps;
  - prohibited advice;
  - escalation requirement and target;
  - relevant guidance;
  - the fact that would change the action.
- Group different scams into **action-equivalent situations**. If several candidates require the same safe action, SafeStep should not ask questions merely to distinguish their names.
- Create a concise multilingual yes/no question library for the decision-changing topics. Questions must be understandable without cybersecurity knowledge and ask about one thing at a time.
- Provide a **Not sure** path for every Decision Flip. It must preserve the unknown state and give the action safe across the remaining branches rather than pretending the riskier answer is confirmed.
- Define the Decision Flip selection rule: choose the unanswered question that most reduces disagreement about the primary action, urgency, or escalation.
- Define the stopping rule: stop asking when all plausible remaining situations share a safe response, or when further certainty would require unnecessary information.
- Define conservative behavior for unseen situations using affected assets and exposure types such as money, credentials, confirmation codes, device control, SIM changes, account access, and business payments.
- Define how the short user summary changes after each confirmed answer. It must contain facts, not speculation.
- Define an evidence trail for every material conclusion. Each confirmed fact must be traceable to the user's words, a yes/no answer, a visible signal, or a consented Signal Unlock result.
- Define guidance selection so every recommendation is backed by a relevant approved passage or a reviewed safety rule, while keeping the user-facing explanation concise.

### Exit gate

Stage 2 is complete only when:

- Every development scenario has at least one valid route to its safe action.
- All twin or decision-dependent scenarios have a clear Decision Flip.
- No question exists solely to improve the scam label when it cannot change the response.
- The same fact changing from yes to no produces the expected change in action.
- Selecting **Not sure** never forces a factual conclusion and still produces useful, proportionate guidance.
- Unseen or ambiguous situations can fall back to a safe, proportionate action without being forced into an incorrect known case.
- Unsupported extracted facts are returned to unknown rather than being used to narrow the situation.
- Every primary action has a short, case-specific reason that can be shown without exposing internal reasoning or overwhelming the user.
- A review of representative journeys shows that the correct action is normally reached in zero to two yes/no questions.

---

## Stage 3 — Create the core low-friction experience

### Purpose

Turn the safety strategy into a calm, understandable user journey centered on conversational intake, immediate interruption, Decision Flip, and concise summaries.

### Entry requirements

- Stage 2 has passed its exit gate.
- The situation library, question library, stopping rule, interruption conditions, and summary format have been reviewed.
- Representative paths exist for all five required journeys.

### Work required

- Create a simple starting experience with quick journey choices and an option to describe what happened naturally.
- Present an immediate interruption before normal conversation whenever continued harm is possible. The interruption must name the behavior to stop, not merely say that risk is high.
- Implement Decision Flip as a distinct interaction, not a normal chat paragraph:
  - explain briefly why one answer matters;
  - ask one decision-changing question;
  - use large, obvious **Yes**, **No**, and **Not sure** controls;
  - update the status, risk, summary, and possible action immediately;
  - do not expose unnecessary internal classifications.
- Keep the current summary visible but compact. It should include only confirmed facts that affect the response.
- Make the primary action the first and most prominent information in every result.
- Show a short, case-specific reason for every recommendation. When useful, allow the user to expand a guidance reference or learn more without placing it in the critical action path.
- Limit explanations to a short reason and reveal additional detail only on demand.
- Use calm, direct wording appropriate to the user's language, audience, technical confidence, and emotional state.
- Ensure harmless situations receive proportionate reassurance without absolute certainty or unnecessary emergency steps.
- Show uncertainty honestly when evidence is incomplete. Confidence wording must not contradict the current evidence or imply certainty merely because the risk is serious.
- Mask accidental secrets before they can be repeated elsewhere in the experience, and replace them with a short warning that SafeStep will never ask for those values.
- If analysis is unavailable or unreliable, replace the normal flow with a short approved fallback that stops dangerous behavior, avoids unsupported conclusions, and offers verification or human support.

### Exit gate

Stage 3 is complete only when:

- A user can complete each of the five representative journeys without instructions from the team.
- Active-threat paths interrupt before asking follow-up questions.
- Decision Flip questions concern one fact, offer **Yes**, **No**, and **Not sure**, and visibly change the decision when appropriate.
- The interface never presents a wall of text; the immediate action and reason are understandable at a glance.
- Every recommendation shows a concise reason, and optional detail does not obstruct the immediate action.
- Analysis failure and unclear-input paths remain safe, short, and usable rather than exposing an error or an invented conclusion.
- Benign scenarios do not enter Rescue Mode or receive unnecessary escalation.
- At least three people outside the team can state the next action in their own words after using a representative path.

---

## Stage 4 — Complete Signal Unlock and Rescue Mode

### Purpose

Resolve uncertainty with minimal, transparent data access and guide affected users from advice to completed recovery or human support.

### Entry requirements

- Stage 3 has passed its exit gate.
- The core experience correctly handles situations using user-provided information alone.
- The team has identified which situations genuinely benefit from optional DNA-side signals.

### Work required

- Implement Signal Unlock for only the evidence that can change the action, such as recent subscription events, account logins, application installation, device findings, or business staff access.
- Every permission request must state:
  - what will be inspected;
  - why it matters to the current decision;
  - that access is limited to this purpose;
  - that the user can refuse and still receive useful guidance.
- Show what information was used and what optional information was not accessed.
- Clearly label unlocked evidence as simulated in the hackathon prototype so the experience cannot be mistaken for a live production-data lookup.
- Implement a complete refusal path with conditional, useful advice.
- Keep only information required for the active journey. Do not ask for identity details already available in the identified app context, and do not retain prototype incident data beyond the active session.
- Implement Rescue Mode as a focused action workflow:
  - one active step at a time;
  - most urgent action first;
  - verified destinations rather than contact details from suspicious content;
  - user-controlled completion or inability reporting;
  - adaptive next steps;
  - a clear stopping point without unjustified reassurance.
- Implement warm human handoff when required. The handoff summary must contain confirmed facts, consented evidence, current risk and urgency, completed actions, and the reason for escalation.
- Require the user to review and approve the handoff summary before it is shared.
- Exclude passwords, codes, PINs, full card numbers, irrelevant personal details, and unsupported assumptions from the handoff summary.

### Exit gate

Stage 4 is complete only when:

- Decision Flip, Signal Unlock, and Rescue Mode operate as one continuous journey.
- No optional sensitive signal is used without appropriate consent.
- Refusing consent never blocks the user from receiving a safe next action.
- Rescue Mode gives different recovery paths for banking, credentials, devices, SIM/account takeover, personal safety, and business incidents.
- Escalation goes to the appropriate human destination rather than triggering only from a numerical risk threshold.
- The handoff summary is short, factually supported, user-approved, and removes the need to repeat the story.
- Prototype actions and Signal Unlock results are clearly distinguishable from completed real-world actions or live DNA data.
- Ending the journey clears session-only incident data while preserving no accidental secrets or unnecessary personal information.

---

## Stage 5 — Prove accuracy, safety, and experience quality

### Purpose

Turn the complete experience into a polished, evidence-backed application that remains reliable outside rehearsed journeys.

### Entry requirements

- Stage 4 has passed its exit gate.
- All five journeys work from initial description through final action, refusal path, or human handoff.
- The product has no known placeholder paths in the main demonstration scope.

### Work required

- Evaluate the complete product against the supplied development set and record:
  - safe-action pass rate;
  - benign false-alarm rate;
  - decisive-question success;
  - unnecessary questions per case;
  - required-step coverage;
  - escalation precision and recall;
  - unsafe statements;
  - privacy and consent violations;
  - results by journey, language, and audience.
- Use the supplied five sample journeys as a fixed regression suite after every major decision or experience change.
- Validate generalization by holding out complete scenario families during development rather than only random individual cases.
- Test adversarial and stressful variations: vague descriptions, irrelevant details, changed wording, prompt injection inside suspicious content, misleading signals, consent refusal, contradictory answers, and one decision-changing fact flipped from yes to no.
- Review failures manually and correct the underlying policy, question, summary, or guidance selection rather than hiding weak cases.
- Conduct a structured manual safety review across every journey, primary action, escalation type, supported language, benign outcome, critical incident, consent-refusal path, and personal-safety scenario. Review both passing and failing automated cases because a passing score does not prove that the advice is safe or understandable.
- Check confidence calibration: answers with unresolved decisive facts should not express stronger certainty than answers supported by confirmed evidence, and confidence must remain separate from risk severity.
- Test unavailable and invalid analysis, timeout, malformed input, and contradictory-evidence paths. Immediate danger rules and approved fallback guidance must continue working in every case.
- Run human comprehension checks with people outside the team. Confirm that users can identify the first action without rereading the response.
- Polish accessibility, responsive behavior, keyboard use, error handling, loading states, language consistency, and emotional tone.
- Prepare five reliable demonstration journeys, including:
  - a harmless look-alike;
  - an active scam interrupted in progress;
  - a Decision Flip where yes and no lead to materially different actions;
  - a Signal Unlock permission and refusal path;
  - a critical Rescue Mode journey with human handoff.
- Resolve every safety-critical or high-friction issue discovered in evaluation before declaring the application complete.

### Final completion gate

The product is ready only when:

- It exceeds the provided rules baseline on every major automated metric.
- It reaches at least 80% safe-action pass and a weighted automated proxy of at least 80 on the development set.
- Benign false alarms remain below 10%, decisive-question success and escalation recall reach at least 90%, and the privacy proxy reaches at least 80.
- Detected unsafe statements, unconsented sensitive-signal use, and leaked passwords, codes, PINs, or full card numbers are all zero.
- It gives the correct, proportionate next action reliably across all five journeys.
- It reaches that action with minimal user effort and no unnecessary interrogation.
- It handles benign, uncertain, active, completed, and critical incidents distinctly.
- Its summaries and guidance are short, accurate, and immediately actionable.
- Decision Flip, Signal Unlock, and Rescue Mode are polished, connected, and demonstrably useful.
- The user remains in control of sensitive data, consequential actions, and human handoff.
- Automated evaluation, adversarial testing, and human comprehension checks support the application's accuracy and usability claims.
- Manual safety review finds no unresolved harmful instruction, unjustified reassurance, misleading production claim, or unsupported use of personal information in the demonstration scope.
- The live demonstration can succeed without relying on a rehearsed sentence or a single known scenario.

At the end of Stage 5, SafeStep should feel less like a chatbot and more like a calm incident-response service: it interrupts preventable harm, resolves only the uncertainty that matters, accesses the minimum evidence necessary, and stays with the user until the next safe action is clear or human help takes over.
