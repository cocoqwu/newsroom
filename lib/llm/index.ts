// Entry point for every model call. Picks the model for the role, tries Gemini, falls back to the
// replay cache and then to a caller-supplied mock, and logs tokens and list-price cost to llm_calls.
//
//   const scores = await generateJSON<Scores>({ role: "triage", task: "judge", prompt, schema, fallback: () => heuristic });
//
// NEWSROOM_MODE=demo skips the network entirely (replay → mock), which is what the live demo uses.
import { db, schema } from "@/lib/db/client";
import { defaultModels, textCostUsd } from "@/config/pricing";
import { GeminiProvider } from "./gemini";
import type { GenerateOpts, GenerateResult } from "./provider";
import { readExact, readLatestForTask, record } from "./replay";

export type { GenerateOpts, Role } from "./provider";

export const llmMode = (): "live" | "demo" => (process.env.NEWSROOM_MODE === "demo" ? "demo" : "live");

let gemini: GeminiProvider | null | undefined;
function getGemini(): GeminiProvider | null {
  if (gemini !== undefined) return gemini;
  const key = process.env.GEMINI_API_KEY;
  gemini = key ? new GeminiProvider(key) : null;
  return gemini;
}

export function modelFor(role: "triage" | "draft"): string {
  return role === "triage" ? defaultModels.triage : defaultModels.draft;
}

// If the preferred model is overloaded or rate-limited, the next one in the chain takes the call.
// All of these have a free tier. The last resort for drafting is the triage model.
export function modelChain(role: "triage" | "draft"): string[] {
  const chain = role === "draft"
    ? [defaultModels.draft, "gemini-3.6-flash", "gemini-2.5-flash", defaultModels.triage]
    : [defaultModels.triage, "gemini-3.1-flash-lite", "gemini-2.5-flash-lite"];
  return [...new Set(chain)];
}

type CallOpts<T> = GenerateOpts & { fallback: () => T };

function logCall(opts: GenerateOpts, r: Omit<GenerateResult, "text">, ok: boolean, error?: string) {
  try {
    db.insert(schema.llmCalls)
      .values({
        runId: opts.runId ?? null,
        draftId: opts.draftId ?? null,
        role: opts.role,
        task: opts.task,
        model: r.model,
        provider: r.provider,
        tokensIn: r.tokensIn,
        tokensOut: r.tokensOut,
        costUsd: r.provider === "gemini" ? textCostUsd(r.model, r.tokensIn, r.tokensOut) : 0,
        durationMs: r.durationMs,
        ok,
        error: error ?? null,
        createdAt: new Date().toISOString(),
      })
      .run();
  } catch (e) {
    console.warn("[llm] could not log call:", (e as Error).message);
  }
}

// Returns raw text plus where it came from. Most callers want generateJSON below.
export async function generateText(opts: GenerateOpts & { fallback: () => string }): Promise<{ text: string; provider: GenerateResult["provider"]; model: string }> {
  const model = modelFor(opts.role);
  const mode = llmMode();
  let lastError: string | undefined;

  if (mode === "live") {
    const g = getGemini();
    if (g) {
      for (const m of modelChain(opts.role)) {
        try {
          const r = await g.generate(opts, m);
          logCall(opts, r, true, m !== model ? `fallback from ${model}: ${lastError ?? ""}`.slice(0, 300) : undefined);
          record(opts, r);
          return { text: r.text, provider: "gemini", model: m };
        } catch (e) {
          lastError = (e as Error).message;
          console.warn(`[llm] ${opts.task} on ${m} failed: ${lastError.slice(0, 160)}`);
          // A zero free-tier quota or an invalid request will not improve with another model of the same kind.
          if (/API key not valid|PERMISSION_DENIED/.test(lastError)) break;
        }
      }
    } else {
      lastError = "GEMINI_API_KEY not set";
    }
  }

  const exact = readExact(opts, model) ?? readLatestForTask(opts.task);
  if (exact) {
    logCall(opts, { model: exact.model, provider: "replay", tokensIn: exact.tokensIn, tokensOut: exact.tokensOut, durationMs: 0 }, true, lastError);
    return { text: exact.text, provider: "replay", model: exact.model };
  }

  logCall(opts, { model, provider: "mock", tokensIn: 0, tokensOut: 0, durationMs: 0 }, true, lastError ?? "no cache entry");
  return { text: opts.fallback(), provider: "mock", model };
}

// JSON-returning call. The fallback supplies a heuristic answer when no model or cache is available.
export async function generateJSON<T>(opts: CallOpts<T>): Promise<{ data: T; provider: GenerateResult["provider"]; model: string }> {
  const r = await generateText({ ...opts, fallback: () => JSON.stringify(opts.fallback()) });
  try {
    return { data: parseJson<T>(r.text), provider: r.provider, model: r.model };
  } catch (e) {
    console.warn(`[llm] ${opts.task}: response was not valid JSON (${(e as Error).message}); using fallback`);
    return { data: opts.fallback(), provider: "mock", model: r.model };
  }
}

// Tolerate a code fence or stray text around the JSON.
function parseJson<T>(text: string): T {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    const start = Math.min(...["{", "["].map((c) => trimmed.indexOf(c)).filter((i) => i >= 0));
    const end = Math.max(trimmed.lastIndexOf("}"), trimmed.lastIndexOf("]"));
    if (start >= 0 && end > start) return JSON.parse(trimmed.slice(start, end + 1)) as T;
    throw new Error("no JSON object found");
  }
}
