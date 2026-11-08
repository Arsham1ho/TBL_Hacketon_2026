<div align="center">

# 🛡️ SafeStep

### Digital Security Assistant: *What should I do now?*

One clear, proportionate next step when a call, message, link or account looks wrong.<br/>
For consumers and small businesses, in Finnish, English and Swedish.

![Node.js](https://img.shields.io/badge/Node.js-22%2B-339933?logo=nodedotjs&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=nextdotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-7-3178C6?logo=typescript&logoColor=white)
![Tests](https://img.shields.io/badge/tests-550%20passing-2ea44f)
![Unsafe statements](https://img.shields.io/badge/unsafe%20statements-0%25-2ea44f)
![License](https://img.shields.io/badge/license-MIT-blue)

**[Live demo](https://tblhacketon2026.vercel.app)** · **[Screenshots](#screenshots)** · **[Quick start](#quick-start)** · **[How it works](#how-it-works)** · **[Results](#results)** · **[Business model](BUSINESS.md)**

Built for the **DNA challenge** at the **Since AI Hackathon 2026**, Turku, 6–8 November.

<br/>

<img src="docs/screenshots/02-stop.png" alt="Stop screen: a caller is asking for a code right now" width="250"/>&nbsp;&nbsp;
<img src="docs/screenshots/03-link-check.png" alt="Link and message check with a 100/100 risk score" width="250"/>&nbsp;&nbsp;
<img src="docs/screenshots/05-rescue.png" alt="Rescue Mode: contact your bank first" width="250"/>

<sub><b>Stop the harm</b> &nbsp;·&nbsp; <b>Check the link</b> &nbsp;·&nbsp; <b>Recover step by step</b></sub>

</div>

> [!WARNING]
> **Synthetic prototype.** This is not a live DNA service. All DNA signals, account data and human handoffs are simulated, and the guidance is not official advice from DNA or any authority.

---

## Contents

- [Overview](#overview)
- [Screenshots](#screenshots)
- [Features](#features)
- [How it works](#how-it-works)
- [Safety boundaries](#safety-boundaries)
- [Quick start](#quick-start)
- [Testing and evaluation](#testing-and-evaluation)
- [Results](#results)
- [Integration path](#integration-path)
- [Business model](#business-model)
- [Tech stack](#tech-stack)
- [Project structure](#project-structure)
- [Known limits](#known-limits)
- [Team](#team)

---

## Overview

People get warnings about suspicious calls, messages and logins all the time, but a warning doesn't tell them what to do. SafeStep reads what happened, **stops ongoing harm first**, asks **only the question that would change the advice**, and gives **one clear next step** with the reason behind it. When a person is needed, it hands off with a summary the user approves first.

### At a glance

| Metric (588 dev cases) | SafeStep | Target |
|---|---:|---:|
| Safe-action pass | **91.2%** | 80%+ |
| Unsafe statements | **0.0%** | 0% |
| False alarms on harmless cases | **9.8%** | under 10% |
| Escalation recall | **90.9%** | 90%+ |
| Consent violations | **0.0%** | 0% |
| Weighted brief score (automated 80 points) | **92.6** | 80+ |

<sub>Measured with the supplied evaluator v2.0.1. Details and caveats are in [Results](#results).</sub>

### Demo

| | |
|---|---|
| 🌐 **Live demo** | [tblhacketon2026.vercel.app](https://tblhacketon2026.vercel.app) |
| 🎬 **Demo video** | _Add the link here before submitting_ |
| 📋 **Results (organisers' template)** | [RESULTS.md](RESULTS.md) |
| 📊 **Evaluation detail** | [eval/RESULTS.md](eval/RESULTS.md) |
| 🔒 **Safety contract** | [DECISIONS.md](DECISIONS.md) |
| 🏗️ **Architecture** | [ARCHITECTURE.md](ARCHITECTURE.md) |
| 💼 **Business hypothesis** | [BUSINESS.md](BUSINESS.md) |

---

## Screenshots

<sub>Taken from the live demo on a phone-sized screen (390 × 844).</sub>

<table>
  <tr>
    <td align="center" width="33%">
      <img src="docs/screenshots/01-start.png" alt="Start screen" width="240"/><br/>
      <b>1. Describe what happened</b><br/>
      <sub>One open question, in Finnish, English or Swedish, by text or voice.</sub>
    </td>
    <td align="center" width="33%">
      <img src="docs/screenshots/02-stop.png" alt="Stop screen" width="240"/><br/>
      <b>2. Stop the harm first</b><br/>
      <sub>A caller asking for a code right now gets a Stop screen before anything else.</sub>
    </td>
    <td align="center" width="33%">
      <img src="docs/screenshots/03-link-check.png" alt="Link and message check" width="240"/><br/>
      <b>3. Link and message check</b><br/>
      <sub>The link is opened safely on the server and scored 0–100, with the warning signs explained.</sub>
    </td>
  </tr>
  <tr>
    <td align="center" width="33%">
      <img src="docs/screenshots/04-decision-flip.png" alt="Decision Flip question" width="240"/><br/>
      <b>4. Decision Flip</b><br/>
      <sub>Only the question that would change the advice, with Yes, No and Not sure.</sub>
    </td>
    <td align="center" width="33%">
      <img src="docs/screenshots/05-rescue.png" alt="Rescue Mode" width="240"/><br/>
      <b>5. Rescue Mode</b><br/>
      <sub>Money already sent: one recovery step at a time, starting with the bank.</sub>
    </td>
    <td align="center" width="33%">
      <img src="docs/screenshots/06-plans.png" alt="Plans sheet" width="240"/><br/>
      <b>6. Plans</b><br/>
      <sub>How DNA could package it. Safety help is free on every plan.</sub>
    </td>
  </tr>
</table>

---

## Features

| Feature | What the user gets |
|---|---|
| **Clear next step** | One action first, then why it matters, in Finnish, English or Swedish. |
| **Stop the harm first** | If something is happening now, like a caller still on the line, SafeStep shows a Stop screen before anything else. |
| **Only the question that matters** | Decision Flip runs Yes and No through the rules and asks only if the answer would change the advice. |
| **Honest uncertainty** | "Not sure" keeps the fact unknown, and the advice covers both answers. Nothing is called safe without positive evidence. |
| **Link and message check** | When someone says they received something, SafeStep asks them to paste it, opens any link safely on the server and gives it a 0–100 risk score. |
| **Rescue Mode** | Step-by-step recovery for incidents that already happened, such as money sent or a code shared. |
| **Signal Unlock** | Uses simulated DNA data (SIM changes, logins, device findings) only after consent, and only when it would change the advice. |
| **Natural conversation** | Gemini replies to every message in the user's own terms and answers their questions in context. Every reply is checked: it can't contradict the steps, call anything safe unless the rules did, or ask for codes. |
| **Voice mode** | Speak instead of typing. Speech is turned into the same events as text, so the engine still makes every decision. |
| **Talk to DNA** | "Talk to a person" opens DNA Customer Service by chat or call-back, with a case number and a summary the user approves before it's sent. The bank or police are shown as extra contacts when they're the ones who can act. |
| **Decision report** | A record of what was understood, what was decided and why, with sources. |
| **Plans** | A demo switch showing how DNA could package the service. Safety advice is free on every plan. |
| **Installable app** | A PWA: install it from the browser on Android, iPhone, iPad, Windows or Mac. Loads fast, and shows emergency guidance when offline. The chat API is never cached, so no case data stays on the device. |

<details>
<summary><b>Scam coverage</b></summary>

<br/>

Bank, police and operator impostor calls, SIM and eSIM takeover, phishing SMS and email, parcel and tax lures, clicked links, malicious apps and remote access, data breaches, unknown logins, MFA fatigue, invoice and CEO fraud, ransomware, former-staff access, and partner monitoring. In addition:

- **Crypto:** seed-phrase requests, drained wallets, withdrawal fees and recovery scams, each with its own rules and advice.
- **People asking for money:** investment, romance, "Hi mum, new number", job and task scams, lottery and inheritance fees, gift cards.
- **Shopping and accounts:** marketplace courier links, fake shops, QR codes, social-account takeovers, unknown card charges, identity theft.
- **Sextortion and blackmail:** handed to a human advisor, with the police listed.

</details>

---

## How it works

> **The LLM reads. Code decides.**

```mermaid
flowchart LR
    U[User message<br/>+ pasted content] --> G[Input Guard<br/>masks codes, cards, passwords]
    G --> R[Fact reading<br/>Gemini or OpenAI<br/>+ keyword backstop]
    G --> L[Link check<br/>sandboxed fetch, 0–100 score]
    R --> V[Fact Validator<br/>drops facts without a quote]
    L --> S[Visible link signal]
    V --> D[Decision rules<br/>status, risk, urgency,<br/>action, handoff]
    S --> D
    C[Simulated DNA signals<br/>after consent] --> D
    D --> F{Decision Flip<br/>would an answer<br/>change the advice?}
    F -- yes --> Q[Ask one question]
    Q --> D
    F -- no --> O[Composer<br/>approved text in fi, en, sv]
    O --> X[Output Guard<br/>blocks unsafe or unapproved text]
    X --> A[Answer, Rescue Mode<br/>or human handoff]

    classDef guard fill:#b42318,stroke:#7a1810,color:#fff
    classDef llm fill:#6941c6,stroke:#42307d,color:#fff
    classDef rules fill:#1570ef,stroke:#1849a9,color:#fff
    classDef out fill:#067647,stroke:#054f31,color:#fff
    class G,X guard
    class R,L llm
    class V,D,F,Q rules
    class O,A out
```

<sub>🟥 Guards &nbsp; 🟪 Reading (LLM and link check) &nbsp; 🟦 Deterministic rules &nbsp; 🟩 Output</sub>

| # | Stage | What it does |
|:-:|---|---|
| 1 | **Input Guard** | Masks card numbers, codes and passwords before anything else sees them. |
| 2 | **Fact reading** | The LLM turns the user's words into structured facts. A keyword extractor runs beside it and takes over if the LLM fails or is rate-limited. |
| 3 | **Fact Validator** | Drops any fact that isn't backed by a real quote from the user's text. |
| 4 | **Decision rules** | Choose the status, risk, urgency, action and human destination. The LLM can't set any of these. |
| 5 | **Decision Flip** | Asks a question only when Yes and No lead to different advice. |
| 6 | **Composer + Output Guard** | Builds the reply only from approved text, and blocks anything unsafe before it is shown. |

### A journey, step by step

What happens when someone says *"A caller from my bank wants the code I just got"*:

```mermaid
sequenceDiagram
    autonumber
    actor U as User
    participant A as SafeStep app
    participant E as Engine (rules)
    participant L as LLM
    U->>A: "A caller from my bank wants the code I just got"
    A->>E: Masked text
    E-->>A: Live danger detected (Fast Danger Check, no LLM wait)
    A-->>U: 🛑 Stop. Don't read out any code. End the call.
    U->>A: "I've stopped"
    A->>L: Read the facts
    L-->>E: Facts, each with a quote from the user
    E->>E: Rules choose action. Decision Flip: does any answer change it?
    E-->>A: "Did you read out the code?"  Yes / No / Not sure
    U->>A: Not sure
    E-->>A: Advice that covers both answers, with sources
    A-->>U: Contact your bank via its official app or number
    opt User wants help
        U->>A: Talk to a person
        A-->>U: Summary to review first
        U->>A: Approve
        A->>A: Simulated handoff to DNA Customer Service
    end
```

---

## Safety boundaries

| Boundary | How it's enforced |
|---|---|
| 🧠 **The model never decides** | Risk, urgency, action and escalation come from rules checked against an action contract. An outcome outside the contract becomes the cautious "unclear" path. |
| ⚖️ **No unjustified reassurance** | "Safe" needs positive evidence. Finding nothing risky is never enough, and text inside a scam message that claims to be "verified safe" is ignored. |
| ✋ **Consent before data** | DNA signals are read only after the user agrees, only when they would change the advice, and only for that session. |
| 🔁 **No irreversible action** | SafeStep never blocks, pays or contacts anyone by itself. Every handoff shows the summary first and waits for approval. |
| 🔑 **Secrets stay out** | Codes, card numbers and passwords are masked before the LLM, the chat history and the handoff summary. |
| 🧪 **Sandboxed link check** | Links are fetched as plain text: no scripts run, nothing is submitted, no cookies are kept, and private or internal network addresses are refused. |
| 🆓 **Safety is never behind a paywall** | Stop-the-harm advice, Rescue Mode and human handoff are free on every plan. |

---

## Quick start

### Prerequisites

- **Node.js 22** or newer
- **Python 3.10** or newer, for the evaluation commands only
- Optional: a Gemini or OpenAI API key. Without one, the app runs on the keyword extractor alone.

### Install and run

```bash
npm install
cp .env.example .env.local   # add your keys, or leave them empty for keyword mode
npm run dev
```

Open **<http://localhost:3000>**.

### Configuration

All variables are optional. Set them in `.env.local`, which is gitignored. Never put real keys in `.env.example`.

| Variable | Purpose | Default |
|---|---|---|
| `GEMINI_API_KEY` | Fact reading and replies with Gemini. Used first if set | — |
| `OPENAI_API_KEY` | Fact reading with OpenAI if there is no Gemini key, and speech to text | — |
| `LLM_MODEL` | Override the LLM model | `gemini-3.5-flash-lite`, or `gpt-5.4-mini` with OpenAI |
| `LLM_TIMEOUT_MS` | Time before falling back to the keyword extractor | `8000` |
| `GOOGLE_SAFE_BROWSING_KEY` | Adds Google Safe Browsing to the link check | — |
| `ELEVENLABS_API_KEY` | Voice output with ElevenLabs, falling back to OpenAI | — |
| `ELEVENLABS_VOICE_ID` / `ELEVENLABS_MODEL` | ElevenLabs voice and model | `eleven_multilingual_v2` |
| `SESSION_TTL_MINUTES` | How long a session is kept in memory | `30` |
| `NEXT_PUBLIC_API_URL` | API base URL, for running the UI separately (for example a mobile shell) | same origin |
| `SIMSET_DIR` | Full path to the DNA SimSet folder, for evaluation only | — |

The SimSet and challenge brief come from the organisers and aren't in this repository.

### Try these

| Type this | What you'll see |
|---|---|
| *I got a text about my parcel*, then paste: *Posti: pay the €2.99 customs fee within 24h: https://posti-fi-tracking.top/pay* | The paste step, then the link and message check with a risk score, then the advice |
| *Someone wants my seed phrase* | Crypto-specific advice: never share it |
| *My wallet got drained* | Rescue Mode: move what's left to a new wallet, revoke approvals, report |
| *Someone called saying they were from my operator and asked for a code. I didn't give it.* | Signal Unlock for recent SIM changes. On the Free plan it shows a lock; switch plans from the chip in the top bar |
| *The police called and told me to move my money to a safe account. I already moved some.* | Rescue Mode, with contacting the bank as the first step |
| *Someone threatens to share my intimate photos unless I pay* | Handoff to a human advisor, with the police listed |

> [!TIP]
> In development, `?screen=` opens a single screen with example data, for example `/?screen=fallback`. The options are `stop`, `flip`, `describe`, `unlock`, `rescue`, `handoff`, `fallback`, `end`, `threat`, `unsure` and `safe`.

---

## Testing and evaluation

| Command | What it does |
|---|---|
| `npm test` | Unit and attack-hardening tests (Vitest) |
| `npm run typecheck` | TypeScript check |
| `npm run build` | Production build |
| `npm run check:contract` | Checks the safety contract against all 588 SimSet dev cases |
| `npm run eval:dev` | Writes answers for the 588 dev cases to `answers.jsonl` |
| `npm run eval:scenarios` | Full multi-turn conversations: 50 scenarios × 3 languages |
| `npm run eval:frozen` | Frozen paraphrase set |
| `npm run eval:holdout` | Held-out paraphrases written after the rules were frozen |

Score the answers with the supplied evaluator (set `SIMSET_DIR` in your shell first):

```bash
python3 "$SIMSET_DIR/eval/evaluate.py" \
  --cases "$SIMSET_DIR/data/dev/cases.jsonl" \
  --submission answers.jsonl
```

Add `USE_LLM=1` to `eval:dev` to use the LLM instead of keywords. Results are cached in `.cache/`, so rule changes rerun without new calls. On a free API tier, slow the run with `EVAL_CONCURRENCY=1 EVAL_PACE_MS=4500`.

---

## Results

> [!NOTE]
> All numbers are from 8 November 2026, with the keyword extractor (no LLM), scored by the supplied evaluator v2.0.1. The rules were tuned on the development cases, so these show what the logic can reach, not accuracy on unseen cases.

### Development set (588 cases)

| Metric | Rules baseline | Target | SafeStep |
|---|---:|---:|---:|
| Safe-action pass | 60.5% | 80%+ | **91.2%** |
| Unsafe statements | 0% | 0% | **0.0%** |
| False alarms on harmless cases | 28.0% | under 10% | **9.8%** |
| Escalation recall | 47.0% | 90%+ | **90.9%** |
| Asked decisive question | 70.0% | 90%+ | **93.3%** |
| Consent violations | — | 0% | **0.0%** |
| Weighted brief proxy | 67.1 | 80+ | **92.6** |

```mermaid
xychart-beta
    title "SafeStep vs the supplied rules baseline (higher is better)"
    x-axis ["Safe-action pass", "Escalation recall", "Decisive question", "Weighted score"]
    y-axis "Score (%)" 0 --> 100
    bar [60.5, 47.0, 70.0, 67.1]
    bar [91.2, 90.9, 93.3, 92.6]
```

<sub>Left bar in each pair: supplied rules baseline. Right bar: SafeStep. False alarms also fell, from 28.0% to 9.8%.</sub>

### Brief criteria (automated proxy)

| Criterion | Weight | Score | |
|---|---:|---:|---|
| Security advice and correctness | 25% | **91.5** | `██████████████████░░` |
| Clarity for both audiences | 20% | **96.4** | `███████████████████░` |
| Uncertainty and escalation | 20% | **90.0** | `██████████████████░░` |
| Privacy and consent | 15% | **93.1** | `███████████████████░` |
| Working implementation | 20% | judged by people | |

### By journey

```mermaid
xychart-beta
    title "Safe-action pass by journey (%)"
    x-axis ["Breach notice", "Suspicious message", "Clicked link", "Small business", "Suspicious call"]
    y-axis "Pass (%)" 0 --> 100
    bar [98.3, 97.4, 94.0, 82.1, 81.9]
```

| Journey | Cases | Safe-action pass |
|---|---:|---:|
| Breach notice | 120 | 98.3% |
| Suspicious message | 156 | 97.4% |
| Clicked link | 84 | 94.0% |
| Small-business incident | 156 | 82.1% |
| Suspicious call | 72 | 81.9% |

Consumers pass 95.2% and small businesses 82.8%. Most misses in the weaker journeys are over-reactions, such as sending a cautious check to the bank, rather than unsafe advice.

### The five sample journeys

The supplied `five_journeys.jsonl` passes **4 of 5**, with no unsafe statements and every needed escalation made. The miss is a supplier asking to be paid to a new bank account. The message doesn't say whether the invoice was paid, so SafeStep covers both cases ("if the payment already left, call your bank's fraud line; if not, don't pay and verify the new account"), and the evaluator scores the paid branch as an over-reaction.

### Other runs

| Run | Result |
|---|---|
| Full conversations (`eval:scenarios`, 50 scenarios × 3 languages) | **116 / 150**, 0 severe failures (scam called safe, missed live danger, secret leaked) |
| Multi-turn with the simulated user (`sim/run_conversation.py`, 588 conversations) | **89.8%** safe-action, 0% unsafe, 94.1% escalation recall, weighted 91.8 (baseline 65.3%, 69.1) |
| Test set (335 inputs) | Predictions in `test_predictions.jsonl`, accepted by the supplied validator |
| Safety contract (`check:contract`) | 588 cases, 0 breaches |
| Unit tests | 550 passing |

<details>
<summary><b>Failure and escalation examples</b></summary>

<br/>

- **Escalation:** "Someone threatens to share my intimate photos unless I pay" goes to a human advisor, with the police listed and the advice not to pay, to keep evidence and to report the account.
- **Failure, fixed:** a bank-impostor caller mentioning "suspicious payments" was read as an unknown card charge, sending 8 call cases to the wrong action. The charge pattern now runs after the call pattern.
- **Failure, fixed:** the Finnish line "Kerroit jakaneesi koodin" ("You said you shared a code") was flagged by the evaluator as telling users to share a code, in 10 answers. It was reworded.
- **Remaining:** 31 over-reactions and 13 false alarms on harmless cases, mostly genuine operator and bank notices sent to a cautious check.

</details>

<details>
<summary><b>Review status</b></summary>

<br/>

- **Safety review:** an AI-assisted first pass scored 18 of 20 sampled answers safe, 2 incomplete and 0 unsafe ([details](eval/RESULTS.md)). The human review sheet is in [review/](review/README.md).
- **Comprehension:** the check with people outside the team is prepared in [review/comprehension-check.md](review/comprehension-check.md).

</details>

---

## Integration path

How SafeStep could move from prototype to a DNA service. None of this is built against live DNA systems.

| Step | Prototype today | In DNA's services |
|---|---|---|
| **Entry point** | Web app at `/` | A "Is this a scam?" entry in the DNA app and Oma portal, opened from a call warning or a flagged SMS |
| **Identity** | Mock login (`lib/mock-users.ts`) | The user's existing DNA login, so no extra sign-up and no identity questions |
| **Signals** | Simulated data (`adapters/signals.ts`) behind consent | DNA APIs for SIM and eSIM events, account logins and call warnings, behind the same consent screen and only when they change the advice |
| **Link check** | Server-side fetch (`adapters/link-scan.ts`) | An isolated scanning service, plus DNA's own threat feeds |
| **Human handoff** | Simulated summary (`adapters/handoff.ts`) | A ticket in DNA customer service or business security support, with the summary the user approved |
| **Sessions** | In-memory, cleared at the end | DNA's data-retention rules; the decision report saved only if the user chooses |
| **Plans** | Demo switch | Included in DNA Digiturva / Turvapaketti, or added to a DNA Business subscription |

The engine talks to the UI only through one API (`/api/sessions`), so the DNA app can call the same API, and each simulated adapter can be swapped for a real one without changing the decision rules.

---

## Business model

SafeStep is designed to sit inside DNA's app and portal, where users are already identified, and to extend DNA's existing security bundle (built on F-Secure). The full hypothesis, with sources, is in [BUSINESS.md](BUSINESS.md).

| Plan | Price *(hypothesis)* | Adds |
|---|---|---|
| Free, in the DNA app | €0 | Next step, link check, Rescue Mode, human handoff |
| DNA Security bundle | €2.99 / month | DNA signal checks, decision report, priority help |
| DNA Business Security | €9 / month per company | Staff-account and invoice-fraud checks, business security support |

---

## Tech stack

| Layer | Technology |
|---|---|
| Language | TypeScript 7 |
| Web app and API | Next.js 16, React 19 |
| Styling | Tailwind CSS 4 |
| Validation | Zod 4 (API input and LLM output) |
| LLM | Gemini (`gemini-3.5-flash-lite`) or OpenAI (`gpt-5.4-mini`), with a keyword extractor as backstop |
| Voice | Browser or OpenAI speech to text, ElevenLabs or OpenAI speech |
| Testing | Vitest, plus the supplied Python evaluator |

---

## Project structure

```text
app/            Next.js app and API routes (/api/sessions is the main flow)
components/     UI: chat turns, link check card, plans sheet, report, voice mode
engine/         Rules, Decision Flip, fact reading, composer, guards
adapters/       LLM, link scanner, simulated DNA signals, handoff, session store, voice
content/        Approved text in Finnish, English and Swedish
docs/           README screenshots
lib/            Client API, mock users, plans, UI text
eval/           Evaluation runners, scenarios and RESULTS.md
review/         Safety review and comprehension check sheets
tests/          Unit and attack-hardening tests
```

### Documentation

| File | Contents |
|---|---|
| [ARCHITECTURE.md](ARCHITECTURE.md) | Components, data flow, API, LLM layer, security and privacy |
| [DECISIONS.md](DECISIONS.md) | Action contract, safety rules, decision log |
| [RESULTS.md](RESULTS.md) | Results in the organisers' template |
| [eval/RESULTS.md](eval/RESULTS.md) | Full evaluation results and the five journeys |
| [BUSINESS.md](BUSINESS.md) | Packaging and pricing hypothesis |
| [strategy.md](strategy.md) | Product strategy and stages |
| [TASKS.md](TASKS.md) | Team plan and status |

---

## Known limits

- Sessions are kept in server memory. On the hosted demo, a follow-up answer can land on a different serverless instance and fail with "Something went wrong"; locally it works. A shared session store would fix this.
- The link check reaches the open internet from the server. In production it should run in an isolated network.
- Plans are a demo switch with hypothesis prices, not billing.
- Finnish and Swedish text still needs review by native speakers.
- The free Gemini tier allows 15 requests a minute. Above that, the app falls back to the keyword extractor.
- Masking can miss letter-and-number codes and codes with no code word nearby.
- Swedish source titles fall back to English, because the supplied guidance has no Swedish titles.
- Full conversations pass 116 of 150. Most misses come from the simulator answering "Not sure" to "Did you transfer money?", where SafeStep takes the cautious path.

---

## Team

| Member | Role |
|---|---|
| **Mehrab** | Safety engine, API and evaluation |
| **Arsham** | Product, UI, accessibility and usability |

### Acknowledgements

- **DNA Oyj** for the challenge and the Digital Security Assistant SimSet
- **Since AI** for organising the hackathon

## License

Released under the [MIT License](LICENSE).
