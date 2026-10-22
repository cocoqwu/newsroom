// Header image options for a draft: three SVGs (always) and one AI image card.
// The AI card calls the Gemini image model through the same provider SDK; on this free-tier key
// Google returns a quota error, and the card says so instead of failing.
import { eq } from "drizzle-orm";
import { GoogleGenAI } from "@google/genai";
import { db, schema } from "@/lib/db/client";
import { defaultModels, imageBudgetUsd, imagePrices } from "@/config/pricing";
import { loadDraftContext, touch } from "@/lib/draft/context";
import { headerOptions } from "./svg";
import { appendImageSpend, readImageSpend } from "./spend";

export function ensureSvgOptions(draftId: number, regenerate = false): void {
  const ctx = loadDraftContext(draftId);
  const existing = db.select().from(schema.images).where(eq(schema.images.draftId, draftId)).all();
  if (existing.some((i) => i.kind === "svg") && !regenerate) return;
  db.delete(schema.images).where(eq(schema.images.draftId, draftId)).run();
  const seed = regenerate ? draftId * 1000 + Date.now() % 1000 : draftId;
  for (const o of headerOptions(ctx.story.theme, seed)) db.insert(schema.images).values({ draftId, kind: "svg", label: o.label, svg: o.svg, status: "ready" }).run();
  const aiModel = defaultModels.image;
  db.insert(schema.images).values({ draftId, kind: "ai", label: `AI image (${aiModel})`, status: "unavailable", note: "Not generated yet. Click \"Try AI image\" to call the Gemini image model." }).run();
  if (!ctx.draft.selectedImageId) {
    const first = db.select().from(schema.images).where(eq(schema.images.draftId, draftId)).get();
    if (first) touch(draftId, { selectedImageId: first.id });
  }
}

export async function attemptAiImage(draftId: number): Promise<{ ok: boolean; note: string; costUsd?: number }> {
  const ctx = loadDraftContext(draftId);
  const model = defaultModels.image;
  const size = "1K";
  const price = imagePrices[model]?.[size] ?? 0.07;
  const row = db.select().from(schema.images).where(eq(schema.images.draftId, draftId)).all().find((i) => i.kind === "ai");
  const setNote = (status: "ready" | "unavailable", note: string, dataUrl?: string) => {
    if (row) db.update(schema.images).set({ status, note, dataUrl: dataUrl ?? null, label: `AI image (${model})` }).where(eq(schema.images.id, row.id)).run();
    else db.insert(schema.images).values({ draftId, kind: "ai", label: `AI image (${model})`, status, note, dataUrl: dataUrl ?? null }).run();
  };

  const spent = readImageSpend();
  if (spent + price > imageBudgetUsd) {
    const note = `Image budget reached: $${spent.toFixed(2)} of $${imageBudgetUsd.toFixed(2)} spent. Raise IMAGE_BUDGET_USD to continue.`;
    setNote("unavailable", note);
    return { ok: false, note };
  }
  const key = process.env.GEMINI_API_KEY;
  if (!key || process.env.NEWSROOM_MODE === "demo") {
    const note = key ? "Demo mode: no network calls. The SVG options are the real headers for this demo." : "GEMINI_API_KEY is not set.";
    setNote("unavailable", note);
    return { ok: false, note };
  }
  try {
    const ai = new GoogleGenAI({ apiKey: key });
    const prompt = `Abstract editorial header illustration for a technology research blog post titled "${ctx.draft.title ?? ctx.story.title}" about ${ctx.story.theme ?? "AI"}. Black ink on off-white paper with one muted accent color, generous negative space, minimal, modern, print-like. No text, no letters, no logos, no people, no screenshots.`;
    const res = await ai.models.generateContent({ model, contents: prompt, config: { responseModalities: ["TEXT", "IMAGE"], imageConfig: { aspectRatio: "16:9", imageSize: size } } as never });
    const part = res.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
    if (!part?.inlineData?.data) throw new Error(`no image in response (${res.candidates?.[0]?.finishReason ?? "unknown"})`);
    const dataUrl = `data:${part.inlineData.mimeType ?? "image/png"};base64,${part.inlineData.data}`;
    const total = appendImageSpend({ model, size, purpose: `draft ${draftId} header`, price });
    db.insert(schema.llmCalls).values({ draftId, role: "image", task: "hero-image", model, provider: "gemini", tokensIn: res.usageMetadata?.promptTokenCount ?? 0, tokensOut: res.usageMetadata?.candidatesTokenCount ?? 0, costUsd: price, durationMs: 0, ok: true, createdAt: new Date().toISOString() }).run();
    setNote("ready", `Generated with ${model}, 16:9 ${size}, $${price.toFixed(4)} list price (total $${total.toFixed(4)} of $${imageBudgetUsd}).`, dataUrl);
    return { ok: true, note: "generated", costUsd: price };
  } catch (e) {
    const msg = (e as Error).message ?? String(e);
    const freeTier = /free_tier|limit:\s*0|quota/i.test(msg);
    const note = freeTier
      ? `Not available on this key: Google's free tier includes no image models. Enable billing on the key's Google Cloud project to turn this on (${model}, about $${price.toFixed(3)} per image; capped at $${imageBudgetUsd} by IMAGE_BUDGET_USD).`
      : `Image call failed: ${msg.slice(0, 200)}`;
    db.insert(schema.llmCalls).values({ draftId, role: "image", task: "hero-image", model, provider: "gemini", costUsd: 0, durationMs: 0, ok: false, error: msg.slice(0, 300), createdAt: new Date().toISOString() }).run();
    setNote("unavailable", note);
    return { ok: false, note };
  }
}

export function getImages(draftId: number) {
  return db.select().from(schema.images).where(eq(schema.images.draftId, draftId)).all();
}
