import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { extractFacts, PROMPT_VERSION, llmModel } from "../adapters/llm";
import type { Extractor } from "../engine/assess";

// For synthetic evaluator runs only, so rule changes rerun without new LLM calls.
// The product never caches user text.
const CACHE_DIR = ".cache/facts";

export function cachedExtractor(model = llmModel()): Extractor {
  mkdirSync(CACHE_DIR, { recursive: true });
  return async (input) => {
    const key = createHash("sha256").update(JSON.stringify([PROMPT_VERSION, model, input])).digest("hex");
    const path = join(CACHE_DIR, `${key}.json`);
    if (existsSync(path)) return JSON.parse(readFileSync(path, "utf8"));
    const facts = await extractFacts(input, { model, timeoutMs: 60_000 });
    writeFileSync(path, JSON.stringify(facts));
    return facts;
  };
}
