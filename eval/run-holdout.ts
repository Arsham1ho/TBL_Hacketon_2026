import { assess, intake } from "../engine/assess";
import { HOLDOUT_CASES } from "./holdout-cases";

let actionPasses = 0;
let escalationPasses = 0;
const failures: string[] = [];

for (const testCase of HOLDOUT_CASES) {
  const { item } = await intake({
    audience: testCase.audience ?? "consumer",
    language: testCase.language,
    openingMessage: testCase.message,
    incidentContent: null,
    incidentChannel: null,
    signals: { hasLink: false, linkVerdict: null, callWarning: null, callerSpoofed: false },
    consent: { requires: [], preGranted: [] },
  });
  const result = assess(item);
  const actionPass = testCase.acceptedActions.includes(result.decision.primaryAction);
  const escalationPass = testCase.mustEscalate === undefined
    || (result.decision.destination !== null) === testCase.mustEscalate;
  if (actionPass) actionPasses += 1;
  if (escalationPass) escalationPasses += 1;
  if (!actionPass || !escalationPass) {
    failures.push(`${testCase.id}: action=${result.decision.primaryAction}, destination=${result.decision.destination ?? "none"}`);
  }
}

console.log(`Holdout action pass: ${actionPasses}/${HOLDOUT_CASES.length}`);
console.log(`Holdout escalation check: ${escalationPasses}/${HOLDOUT_CASES.length}`);
if (failures.length) {
  console.log("Observed failures (not tuned in this run):");
  for (const failure of failures) console.log(`- ${failure}`);
  if (process.env.HOLDOUT_ENFORCE === "1") process.exitCode = 1;
}
