import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ACTION_CONTRACT } from "../engine/contract";
import { Audience, Destination, ExternalContact, GatedSignal, PrimaryAction, Risk, Topic, Urgency } from "../engine/types";

// Compares the contract with the supplied vocabularies and every dev reference
// answer. Only this script reads ground truth; the engine never does.

const simsetDir = process.env.SIMSET_DIR;
if (!simsetDir) {
  console.error("Set SIMSET_DIR to the SimSet folder.");
  process.exit(1);
}

const readJson = (path: string) => JSON.parse(readFileSync(join(simsetDir, path), "utf8"));
const sameSet = (a: string[], b: string[]) => [...a].sort().join() === [...b].sort().join();

const vocabulary = readJson("data/reference/action_vocabulary.json");
const signals = readJson("data/reference/signal_dictionary.json").signals as Record<string, { consent: string }>;
const gated = Object.keys(signals).filter((key) => signals[key].consent === "requires_consent");

const vocabularyChecks: [string, string[], string[]][] = [
  ["actions", PrimaryAction.options, Object.keys(vocabulary.actions)],
  ["risk levels", Risk.options, vocabulary.risk_levels],
  ["urgency", Urgency.options, Object.keys(vocabulary.urgency)],
  ["destinations", Destination.options, Object.keys(vocabulary.escalation_targets)],
  ["topics", Topic.options, Object.keys(readJson("data/reference/question_topics.json").topics)],
  ["gated signals", GatedSignal.options, gated],
];

let failed = false;
for (const [name, ours, supplied] of vocabularyChecks) {
  const ok = sameSet(ours, supplied);
  failed ||= !ok;
  console.log(`${ok ? "ok  " : "FAIL"} ${name} (${ours.length})`);
}

const cases = readFileSync(join(simsetDir, "data/dev/cases.jsonl"), "utf8")
  .split("\n")
  .filter(Boolean)
  .map((line) => JSON.parse(line));

const breaches = new Map<string, number>();
const note = (key: string) => breaches.set(key, (breaches.get(key) ?? 0) + 1);

const audiences = [...new Set<string>(cases.map((item) => item.audience))];
const externalContacts = [...new Set<string>(cases.flatMap((item) => item.ground_truth.external_contacts ?? []))];
for (const [name, ours, supplied] of [
  ["audiences", Audience.options, audiences],
  ["external contacts", ExternalContact.options, externalContacts],
] as [string, string[], string[]][]) {
  const ok = sameSet(ours, supplied);
  failed ||= !ok;
  console.log(`${ok ? "ok  " : "FAIL"} ${name} (${ours.length})`);
}

for (const { ground_truth: truth } of cases) {
  const action = truth.primary_action as PrimaryAction;
  const contract = ACTION_CONTRACT[action];
  if (!contract.risks.includes(truth.risk_level)) note(`${action}: risk ${truth.risk_level}`);
  if (!contract.urgencies.includes(truth.urgency)) note(`${action}: urgency ${truth.urgency}`);
  if (truth.escalation.required && !contract.destinations.includes(truth.escalation.target)) {
    note(`${action}: destination ${truth.escalation.target}`);
  }

  // Twins in no-reply mode: the fact is unknown, so the worst-case action must fit Needs verification.
  if (!truth.twin_group) continue;
  const single = truth.single_turn;
  const [low, high] = single.risk_range.map((risk: Risk) => Risk.options.indexOf(risk));
  for (const twinAction of single.acceptable_actions as PrimaryAction[]) {
    const twinContract = ACTION_CONTRACT[twinAction];
    if (!twinContract.statuses.includes("needs_verification")) note(`${twinAction}: no status for an unknown twin fact`);
    const inRange = twinContract.risks.some((risk) => {
      const level = Risk.options.indexOf(risk);
      return level >= low && level <= high;
    });
    if (!inRange) note(`${twinAction}: no risk inside ${single.risk_range}`);
    if (single.escalation_required && twinContract.destinations.length === 0) {
      note(`${twinAction}: twin needs a person but the action allows none`);
    }
  }
}

console.log(`\n${cases.length} dev cases checked, ${breaches.size} breach types`);
for (const [key, count] of breaches) console.log(`FAIL ${key} (${count} cases)`);

process.exit(failed || breaches.size > 0 ? 1 : 0);
