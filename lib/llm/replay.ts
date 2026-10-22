// Record / replay cache for model responses. Live runs record every successful response here
// (keyed by a hash of model + prompt + schema). Demo mode and failures replay from it, so the
// demo works with no network and no key. Files are small JSON and are committed for the snapshot.
import fs from "node:fs";
import path from "node:path";
import { sha256 } from "@/lib/text";
import type { GenerateOpts, GenerateResult } from "./provider";

const CACHE_DIR = process.env.LLM_CACHE_DIR || path.join(process.cwd(), "data", "llm-cache");

type Entry = {
  task: string;
  model: string;
  promptPreview: string;
  text: string;
  tokensIn: number;
  tokensOut: number;
  createdAt: string;
};

export function cacheKey(opts: GenerateOpts, model: string): string {
  return sha256(JSON.stringify({ model, system: opts.system ?? "", prompt: opts.prompt, schema: opts.schema ?? null }));
}

export function readExact(opts: GenerateOpts, model: string): Entry | null {
  const f = path.join(CACHE_DIR, `${cacheKey(opts, model)}.json`);
  if (!fs.existsSync(f)) return null;
  try { return JSON.parse(fs.readFileSync(f, "utf8")) as Entry; } catch { return null; }
}

// Newest recorded response for the same task, used when the exact prompt differs
// (for example the editor typed a different angle note in demo mode).
export function readLatestForTask(task: string): Entry | null {
  if (!fs.existsSync(CACHE_DIR)) return null;
  let best: Entry | null = null;
  for (const name of fs.readdirSync(CACHE_DIR)) {
    if (!name.endsWith(".json")) continue;
    try {
      const e = JSON.parse(fs.readFileSync(path.join(CACHE_DIR, name), "utf8")) as Entry;
      if (e.task === task && (!best || e.createdAt > best.createdAt)) best = e;
    } catch { /* skip bad file */ }
  }
  return best;
}

export function record(opts: GenerateOpts, result: GenerateResult): void {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const entry: Entry = {
    task: opts.task,
    model: result.model,
    promptPreview: opts.prompt.slice(0, 160),
    text: result.text,
    tokensIn: result.tokensIn,
    tokensOut: result.tokensOut,
    createdAt: new Date().toISOString(),
  };
  fs.writeFileSync(path.join(CACHE_DIR, `${cacheKey(opts, result.model)}.json`), JSON.stringify(entry, null, 2));
}
