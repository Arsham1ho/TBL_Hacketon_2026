import { readFileSync, writeFileSync } from "node:fs";
import { assess, type CaseInput } from "../engine/assess";
import { handleEvent, type Journey } from "../engine/handle-event";
import type { ApiResponse } from "../engine/screens";
import { detectLanguage } from "../engine/language";
import type { Language } from "../engine/types";
import { extractFacts, llmAvailable, llmModel } from "../adapters/llm";
import type { ExtractionInput } from "../engine/offline-extractor";

// Full conversations against the real engine. Expected answers were written before this
// suite first ran, and each one is judged on what a user would actually experience.
type Expect = {
  actions: string[];
  status?: string[];
  stop?: boolean;
  person?: boolean;
  anySteps?: string[];
  harmless?: boolean;
  neverSafe?: boolean;
  asked?: boolean;
  secretHidden?: string;
};
type Scenario = {
  id: string;
  group: string;
  audience?: "consumer" | "small_business";
  text: Record<Language, string>;
  incident?: Record<Language, string>;
  answers: Record<string, "yes" | "no" | "unsure">;
  expect: Partial<Expect>;
};

const file = process.env.SCENARIO_FILE ?? "eval/scenarios/scenarios.json";
const scenarios: Scenario[] = JSON.parse(readFileSync(file, "utf8"));
const LANGUAGES: Language[] = ["en", "fi", "sv"];
const MAX_TURNS = 16;

// LLM=1 runs the same fact extraction the live app uses, so the result reflects what a judge
// typing into the demo would get. Calls are paced and retried for free-tier rate limits; a call
// that still fails falls back to the keyword reader, and the report counts how often that happened.
const USE_LLM = process.env.LLM === "1" && llmAvailable();
const DELAY_MS = Number(process.env.LLM_DELAY_MS ?? (USE_LLM ? 4200 : 0));
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
async function pacedExtractor(input: ExtractionInput): Promise<unknown> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await pause(DELAY_MS * (attempt + 1));
    try {
      return await extractFacts(input, { timeoutMs: 20000 });
    } catch (error) {
      if (attempt === 2) throw error;
    }
  }
  throw new Error("unreachable");
}

async function converse(scenario: Scenario, language: Language) {
  const input: CaseInput = {
    audience: scenario.audience ?? "consumer",
    language,
    openingMessage: scenario.text[language],
    incidentContent: scenario.incident?.[language] ?? null,
    incidentChannel: null,
    signals: { hasLink: Boolean(scenario.incident), linkVerdict: null, callWarning: null, callerSpoofed: false },
    consent: { requires: [], preGranted: [] },
  };
  let { journey, response } = await handleEvent("test", null, { kind: "start", input, sentToLlm: USE_LLM, extractor: USE_LLM ? pacedExtractor : undefined });
  const seen: ApiResponse[] = [response];
  let stopped = response.screen.type === "stop";
  let questions = 0;

  for (let turn = 0; turn < MAX_TURNS; turn += 1) {
    const { screen } = response;
    if (screen.type === "stop") stopped = true;
    if (screen.type === "result" || screen.type === "fallback" || screen.type === "end") break;
    let event: Parameters<typeof handleEvent>[2];
    if (screen.type === "stop") event = { kind: "continue" };
    else if (screen.type === "flip") {
      questions += 1;
      event = { kind: "answer", topic: screen.topic, answer: scenario.answers[screen.topic] ?? "unsure" };
    } else if (screen.type === "unlock") event = { kind: "consent", signal: screen.signal, granted: true };
    else if (screen.type === "rescue") event = { kind: "rescue", stepId: screen.step.id, outcome: "done" };
    else if (screen.type === "handoff") event = { kind: "handoff", approved: true };
    else break; // This simulator has no scripted answer for an open description.
    ({ journey, response } = await handleEvent("test", journey, event));
    seen.push(response);
  }

  const item = (journey as Journey).item;
  const final = assess(item, (journey as Journey).asked);
  return { response, seen, stopped, questions, final, firstScreen: seen[0]!.screen.type, usedLlm: Boolean((journey as Journey).sentToLlm) };
}

function judge(scenario: Scenario, language: Language, run: Awaited<ReturnType<typeof converse>>): string[] {
  const { expect } = scenario;
  const { response, final, stopped, questions, seen } = run;
  const problems: string[] = [];
  const action = final.decision.primaryAction;
  const status = final.decision.status;
  const steps = final.outcome.steps;

  if (response.screen.type === "fallback") problems.push("ended in fallback");
  if (response.screen.type === "describe" || response.screen.type === "ask") problems.push(`simulator cannot answer ${response.screen.type}`);
  if (expect.actions && !expect.actions.includes(action)) problems.push(`action ${action}`);
  if (expect.status && !expect.status.includes(status)) problems.push(`status ${status}`);
  if (!expect.harmless && status === "safe") problems.push("SCAM CALLED SAFE");
  if (expect.neverSafe && status === "safe") problems.push("SCAM CALLED SAFE");
  if (expect.harmless && (stopped || final.decision.destination)) problems.push("false alarm on harmless case");
  if (expect.stop && !stopped) problems.push("MISSED LIVE DANGER");
  if (expect.person === true && !final.decision.destination) problems.push("no human handoff");
  if (expect.anySteps && !expect.anySteps.some((step) => steps.includes(step))) problems.push(`missing step: ${expect.anySteps.join("/")}`);
  if (expect.asked && questions === 0) problems.push("asked no question");
  if (response.screen.type === "result") {
    const { story, supportRoutes } = response.screen;
    if (!story.attempted || story.prevent.length === 0 || !story.investigation.why) problems.push("result missing story");
    if (status !== "safe" && final.decision.externalContacts.includes("bank") && !supportRoutes.includes("bank")) problems.push("bank not offered");
    if (final.decision.destination && !supportRoutes.includes(final.decision.destination)) problems.push("handoff route not offered");
  }
  if (questions > 4) problems.push(`${questions} questions`);

  const text = JSON.stringify(seen.map((entry) => entry.screen));
  if (expect.secretHidden && text.includes(expect.secretHidden)) problems.push("SECRET LEAKED");
  const shown = response.screen.type === "result" ? [...response.screen.steps, response.screen.reason].join(" ") : "";
  const detected = shown ? detectLanguage(shown) : language;
  if (detected !== language) problems.push(`replied in ${detected}`);
  return problems;
}

const rows: { id: string; group: string; language: Language; audience: string; problems: string[]; action: string; status: string; questions: number; stopped: boolean; usedLlm: boolean }[] = [];
for (const scenario of scenarios) {
  for (const language of LANGUAGES) {
    const run = await converse(scenario, language);
    rows.push({
      id: scenario.id,
      group: scenario.group,
      language,
      audience: scenario.audience ?? "consumer",
      problems: judge(scenario, language, run),
      action: run.final.decision.primaryAction,
      status: run.final.decision.status,
      questions: run.questions,
      stopped: run.stopped,
      usedLlm: run.usedLlm,
    });
  }
}

const passed = rows.filter((row) => row.problems.length === 0).length;
const severe = rows.filter((row) => row.problems.some((problem) => /^[A-Z ]{6,}/.test(problem)));
const by = (key: "group" | "language") => {
  const groups = new Map<string, number[]>();
  for (const row of rows) groups.set(row[key], [...(groups.get(row[key]) ?? []), row.problems.length === 0 ? 1 : 0]);
  return [...groups].map(([name, values]) => `${name} ${values.reduce((a, b) => a + b, 0)}/${values.length}`).join(", ");
};

console.log(`Scenarios: ${scenarios.length}, conversations: ${rows.length}`);
console.log(`Extractor: ${USE_LLM ? `${llmModel()} (used in ${rows.filter((row) => row.usedLlm).length}/${rows.length}, rest fell back to keywords)` : "keyword reader (offline)"}`);
console.log(`Passed: ${passed}/${rows.length}`);
console.log(`Severe (scam called safe, missed live danger, secret leaked): ${severe.length}`);
console.log(`By group: ${by("group")}`);
console.log(`By language: ${by("language")}`);
console.log(`Average questions: ${(rows.reduce((sum, row) => sum + row.questions, 0) / rows.length).toFixed(1)}`);
const failures = rows.filter((row) => row.problems.length > 0);
if (failures.length) console.log("\nFailures:");
for (const row of failures) console.log(`- ${row.id} [${row.language}] ${row.problems.join("; ")}`);
if (process.argv[2]) writeFileSync(process.argv[2], JSON.stringify(rows, null, 1));
if (process.env.SCENARIOS_ENFORCE === "1" && severe.length > 0) process.exitCode = 1;
