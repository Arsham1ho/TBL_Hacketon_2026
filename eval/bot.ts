import { createInterface } from "node:readline";
import { readAnswerOffline } from "../engine/answer-reader";
import { assess, intake } from "../engine/assess";
import type { Case } from "../engine/case";
import type { Topic } from "../engine/types";
import { cachedExtractor } from "./cached-extractor";
import { toCaseInput, toSubmission } from "./to-submission";

// Multi-turn bot for the Python simulator: one JSON object per line.
let raw: any = null;
let item: Case | null = null;
let asked = 0;
let pendingTopic: Topic | null = null;

function next() {
  const assessment = assess(item!, asked);
  if (assessment.flip && assessment.composed.question) {
    pendingTopic = assessment.flip.topic;
    asked += 1;
    return { type: "question", text: assessment.composed.question, topics: [assessment.flip.topic] };
  }
  return { type: "final", answer: toSubmission(raw, item!, assessment) };
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
    reply = next();
  } else if (event.type === "user_reply" && pendingTopic) {
    const answer = readAnswerOffline(event.text, item!.language);
    item =
      answer === "unsure"
        ? { ...item!, unsure: [...item!.unsure, pendingTopic] }
        : { ...item!, answers: { ...item!.answers, [pendingTopic]: answer } };
    reply = next();
  } else {
    reply = { type: "final", answer: toSubmission(raw, item!, assess(item!, 99)) };
  }
  process.stdout.write(`${JSON.stringify(reply)}\n`);
});
