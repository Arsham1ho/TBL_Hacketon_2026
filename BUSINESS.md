# SafeStep business hypothesis

> **Hypothesis, not a proven result.** Prices, adoption and savings below are assumptions to test in a pilot. Market figures are from public sources and are linked.

## The problem in money terms

- Finnish banks recorded **€148 million in attempted digital fraud in 2025**, up from €107.2 million in 2024. "Safe account" scams alone took €38.4 million. ([Finance Finland](https://www.finanssiala.fi/en/news/total-value-of-attempted-digital-fraud-climbed-to-148-million/), [2024 figures](https://www.finanssiala.fi/en/news/volume-of-fraud-skyrockets-in-finland-banks-blocked-more-than-e44-millions-worth-of-fraud-related-payments-in-2024/))
- Scams arrive through calls and SMS, which run on operator networks. The EU Commission has proposed **extending fraud-prevention liability to telecom operators**. ([Finance Finland](https://www.finanssiala.fi/en/news/the-european-commission-proposes-extending-fraud-prevention-liability-to-telecom-operators-social-media-platforms-and-online-marketplaces-should-also-be-included/))
- Warnings flag a risk, but people still call customer service asking "what do I do now?". That is the gap SafeStep fills.

## Why DNA

1. **DNA already sells security.** DNA Digiturva / Turvapaketti is built on F-Secure Total ([DNA × F-Secure](https://thepaypers.com/fraud-and-fincrime/news/dna-collaborates-with-f-secure-to-launch-security-service)). F-Secure blocks threats; SafeStep tells the person what to do next. It extends an existing product line instead of starting a new one.
2. **DNA sees the signals.** Call warnings, SIM and eSIM changes, number transfers, link checks and router status are operator data. SafeStep uses them only with consent, and only when they change the advice.
3. **Users are already identified** in the DNA app and portal, so there is no extra sign-up.

## Packaging

| | **Consumer** | **Small business** |
|---|---|---|
| **Free, in the DNA app** | "Is this a scam?" check, link and message analysis, next step and stop-the-harm guidance | Same check for the account owner |
| **Included in the security bundle** (Digiturva / Turvapaketti) | Rescue Mode, signal checks with consent, decision report, priority handoff to a DNA advisor | — |
| **DNA Business add-on** | — | Staff accounts and devices, payment and invoice fraud checks, former-employee access checks, incident report for the insurer or police, handoff to business security support |

**Why the free tier is free:** it's the acquisition and trust layer. Every scam it stops before money moves saves a support call and a churn risk. Paid features carry the cost of human handoff and signal access.

## Pricing hypothesis

| Offer | Price to test | Reasoning |
|---|---|---|
| Consumer free tier | €0 | Drives app engagement; low cost per check |
| Consumer, inside the security bundle | No price increase; used to reduce churn and raise the bundle's attach rate | F-Secure Total retails at €69.99/year for one device ([Taloustaito](https://www.taloustaito.fi/Rahat/2026/maksullinen-tietoturvapaketti--kannattaako-sellainen-ostaa/)); operators bill monthly |
| Consumer standalone "SafeStep Plus" | €1.99–2.99/month | Matches the low-price in-app add-ons DNA already sells |
| Small business add-on | €4–9/month per company (up to 10 users), or per user on larger plans | Cheaper than one hour of external IT help; invoice fraud is the main loss to prevent |

To test in the pilot: willingness to pay at €1.99 vs €2.99 for consumers, and per-company vs per-user pricing for businesses.

## Unit economics (assumptions to measure)

- **Cost per check:** two to four small LLM calls, plus the link check. Without an LLM, the offline rules still work, so cost can be capped.
- **Human handoff** is the main cost. SafeStep sends a structured summary, so each handoff should take less advisor time than a cold call.
- **Value per prevented case:** one avoided support call, plus one avoided fraud loss that would otherwise hurt trust in DNA.

## What a pilot should measure

1. Share of checks that end in a clear next step without a human (target: most of them).
2. Calls to DNA customer service about scams, before and after.
3. Handoff rate and advisor time per handoff.
4. Bundle attach rate and churn for users who used SafeStep vs those who didn't.
5. Free → paid conversion for the consumer add-on and the business add-on.
6. Safety: false reassurances (target zero) and false alarms.

## Risks

- **Liability:** advice must stay proportionate and never promise safety. SafeStep only says "safe" with positive evidence and always offers a human.
- **Privacy:** operator signals are sensitive. Each one is used only with consent, only when it changes the advice, and only for that session.
- **Cannibalisation:** the free tier must not replace the paid bundle. It answers the question; the bundle adds recovery, signals and priority help.
