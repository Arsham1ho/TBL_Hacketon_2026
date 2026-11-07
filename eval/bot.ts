import { createInterface } from "node:readline";
import { readAnswerOffline } from "../engine/answer-reader";
import { assess, intake } from "../engine/assess";
import { applyAnswer, type Case } from "../engine/case";
import type { Topic } from "../engine/types";
import { cachedExtractor } from "./cached-extractor";
import { toCaseInput, toSubmission } from "./to-submission";
import { interpretConsentedSignal } from "../adapters/signals";
import { GatedSignal } from "../engine/types";

// Multi-turn bot for the Python simulator: one JSON object per line.
let raw: any = null;
let item: Case | null = null;
let asked = 0;
let pendingTopic: Topic | null = null;
let pendingConsent: string | null = null;
let consentRequested: string[] = [];
let consentUsed: string[] = [];
let consentHandled: string[] = [];

function next() {
  const assessment = assess(item!, asked);
  if (assessment.flip && assessment.composed.question) {
    pendingTopic = assessment.flip.topic;
    asked += 1;
    return { type: "question", text: assessment.composed.question, topics: [assessment.flip.topic] };
  }
  const signal = assessment.outcome.wantsSignals.find(s => item!.availableSignals.includes(s) && !item!.pregrantedSignals.includes(s) && !consentHandled.includes(s));
  if (signal) {
    pendingConsent = signal;
    consentRequested.push(signal);
    const prompt = item!.language === "fi" ? `Saanko tarkistaa simuloidun tiedon ${signal}? Voit kieltäytyä ja silti saada ohjeita.`
      : item!.language === "sv" ? `Får jag kontrollera den simulerade uppgiften ${signal}? Du kan avstå och ändå få råd.`
      : `May I check the simulated ${signal} signal to clarify this case? You can refuse and still get advice.`;
    return { type: "consent_request", fields: [signal], text: prompt };
  }
  return { type: "final", answer: toSubmission(raw, item!, assessment, { requested: consentRequested, used: consentUsed }) };
}

const lines = createInterface({ input: process.stdin });
const extract = process.env.USE_LLM === "1" ? cachedExtractor() : undefined;

lines.on("line", async (line) => {
  if (!line.trim()) return;
  const event = JSON.parse(line);
  let reply: object;
  if (event.type === "start") {
    raw = event.case;
    item = (await intake(toCaseInput(raw), extract)).item;
    asked = 0;
    pendingTopic = null;
    pendingConsent = null;
    consentRequested = [];
    consentUsed = [];
    consentHandled = [];
    reply = next();
  } else if (event.type === "user_reply" && pendingTopic) {
    item = applyAnswer(item!, pendingTopic, readAnswerOffline(event.text, item!.language, pendingTopic));
    reply = next();
  } else if (event.type === "consent_reply" && pendingConsent) {
    const signal = pendingConsent;
    pendingConsent = null;
    consentHandled.push(signal);
    if (event.granted?.includes(signal) && Object.hasOwn(event.signals ?? {}, signal)) {
      const parsed = GatedSignal.safeParse(signal);
      if (parsed.success) {
        const finding = interpretConsentedSignal(parsed.data, event.signals[signal]);
        item = { ...item!, gatedFindings: { ...item!.gatedFindings, [signal]: finding } };
        consentUsed.push(signal);
      }
    }
    reply = next();
  } else {
    reply = { type: "final", answer: toSubmission(raw, item!, assess(item!, 99), { requested: consentRequested, used: consentUsed }) };
  }
  process.stdout.write(`${JSON.stringify(reply)}\n`);
});
