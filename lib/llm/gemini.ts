// Gemini implementation of the provider interface, through the official @google/genai SDK.
// Handles the free tier politely: a small per-model spacing between calls and backoff on 429.
import { GoogleGenAI } from "@google/genai";
import type { GenerateOpts, GenerateResult, LLMProvider } from "./provider";
import { ProviderError } from "./provider";

const MIN_GAP_MS = Number(process.env.GEMINI_MIN_GAP_MS || 4500); // ~13 requests/minute per model
const lastCallAt = new Map<string, number>();
let chain: Promise<unknown> = Promise.resolve();

// Serialize calls per process and keep a minimum gap between them.
function schedule<T>(model: string, fn: () => Promise<T>): Promise<T> {
  const run = async () => {
    const wait = (lastCallAt.get(model) ?? 0) + MIN_GAP_MS - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastCallAt.set(model, Date.now());
    return fn();
  };
  const p = chain.then(run, run);
  chain = p.catch(() => undefined);
  return p;
}

export class GeminiProvider implements LLMProvider {
  readonly name = "gemini";
  private ai: GoogleGenAI;
  constructor(apiKey: string) {
    this.ai = new GoogleGenAI({ apiKey });
  }

  async generate(opts: GenerateOpts, model: string): Promise<GenerateResult> {
    const attempt = async (): Promise<GenerateResult> => {
      const t0 = Date.now();
      const res = await this.ai.models.generateContent({
        model,
        contents: opts.prompt,
        config: {
          systemInstruction: opts.system,
          temperature: opts.temperature ?? 0.4,
          maxOutputTokens: opts.maxOutputTokens,
          ...(opts.schema ? { responseMimeType: "application/json", responseJsonSchema: opts.schema } : {}),
        },
      });
      const text = res.text ?? "";
      if (!text) {
        const reason = res.candidates?.[0]?.finishReason ?? res.promptFeedback?.blockReason ?? "empty";
        throw new ProviderError(`empty response (${reason})`, undefined, false);
      }
      const u = res.usageMetadata;
      return {
        text,
        model,
        provider: "gemini",
        tokensIn: u?.promptTokenCount ?? 0,
        tokensOut: (u?.candidatesTokenCount ?? 0) + (u?.thoughtsTokenCount ?? 0),
        durationMs: Date.now() - t0,
      };
    };

    // Up to 3 tries on rate limits / transient errors, with growing waits.
    const delays = [20000, 45000];
    for (let i = 0; ; i++) {
      try {
        return await schedule(model, attempt);
      } catch (e: unknown) {
        const err = e as { status?: number; message?: string };
        const msg = err?.message ?? String(e);
        const status = err?.status ?? (/\b(429|503|500)\b/.exec(msg)?.[1] ? Number(/\b(429|503|500)\b/.exec(msg)![1]) : undefined);
        const retryable = status === 429 || status === 503 || status === 500;
        // Free tier with a zero quota for this model: retrying will not help.
        const hardBlock = /limit:\s*0/.test(msg);
        if (!retryable || hardBlock || i >= delays.length) {
          throw new ProviderError(msg.slice(0, 400), status, retryable && !hardBlock);
        }
        await new Promise((r) => setTimeout(r, delays[i]));
      }
    }
  }
}
