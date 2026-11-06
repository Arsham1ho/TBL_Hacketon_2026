import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { assess, intake } from "../engine/assess";
import { cachedExtractor } from "./cached-extractor";
import { toCaseInput, toSubmission } from "./to-submission";

// One-answer mode: nobody can reply, so each case gets its question plus worst-case-safe advice.
const simsetDir = process.env.SIMSET_DIR;
if (!simsetDir) throw new Error("Set SIMSET_DIR to the SimSet folder.");

const [casesFile = "data/dev/cases.jsonl", outFile = "answers.jsonl", limit] = process.argv.slice(2);
const model = process.env.LLM_MODEL_OVERRIDE;
const extract = process.env.USE_LLM === "1" ? cachedExtractor(model) : undefined;

const all = readFileSync(join(simsetDir, casesFile), "utf8").split("\n").filter(Boolean).map((line) => JSON.parse(line));
// An even spread across scenarios, so a small run still covers every journey.
const rows = limit ? all.filter((_, index) => index % Math.floor(all.length / Number(limit)) === 3).slice(0, Number(limit)) : all;

const CONCURRENCY = 10;
const answers: string[] = new Array(rows.length);
let next = 0;
let fellBack = 0;
const started = Date.now();

await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    while (next < rows.length) {
      const index = next++;
      const { item, extractedBy } = await intake(toCaseInput(rows[index]), extract);
      if (extractedBy === "fallback") fellBack += 1;
      answers[index] = JSON.stringify(toSubmission(rows[index], item, assess(item)));
    }
  }),
);

writeFileSync(outFile, `${answers.join("\n")}\n`);
console.log(`${answers.length} answers written to ${outFile}; ${fellBack} fell back; ${Math.round((Date.now() - started) / 1000)}s`);
