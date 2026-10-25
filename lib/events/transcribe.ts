// Audio and video → timestamped transcript with Gemini's audio understanding. Small files go
// inline; larger ones go through the Files API first. Hard cap 100 MB. Any failure is reported
// back as a message so the UI can ask for a transcript instead; nothing throws past this file.
import { GoogleGenAI, createPartFromUri } from "@google/genai";
import { db, schema } from "@/lib/db/client";
import { defaultModels, textCostUsd } from "@/config/pricing";

const INLINE_LIMIT = 18 * 1024 * 1024;
export const MEDIA_LIMIT = 100 * 1024 * 1024;

export async function transcribeMedia(buffer: Buffer, mime: string, label: string): Promise<{ ok: true; transcript: string; model: string } | { ok: false; note: string }> {
  if (process.env.NEWSROOM_MODE === "demo") return { ok: false, note: "Demo mode makes no network calls. Paste or upload a transcript (.txt, .vtt, .srt, .md) instead." };
  const key = process.env.GEMINI_API_KEY;
  if (!key) return { ok: false, note: "GEMINI_API_KEY is not set. Paste a transcript instead." };
  if (buffer.length > MEDIA_LIMIT) return { ok: false, note: `File is ${(buffer.length / 1e6).toFixed(0)} MB; the limit here is 100 MB. Split the recording or paste a transcript.` };

  const ai = new GoogleGenAI({ apiKey: key });
  const prompt = `Transcribe this recording of a talk, panel or demo. Output plain text, one paragraph per speaker turn, each starting with a timestamp in square brackets like [12:34] and then the speaker label (use names if spoken, otherwise "Speaker 1", "Speaker 2"). Keep every number, name and claim exactly as said. Do not summarize.`;
  const models = [defaultModels.draft, "gemini-3.6-flash", "gemini-3.7-flash"];
  let lastErr = "";
  for (const model of [...new Set(models)]) {
    const t0 = Date.now();
    try {
      let mediaPart;
      if (buffer.length <= INLINE_LIMIT) {
        mediaPart = { inlineData: { mimeType: mime, data: buffer.toString("base64") } };
      } else {
        const uploaded = await ai.files.upload({ file: new Blob([new Uint8Array(buffer)], { type: mime }), config: { mimeType: mime, displayName: label } });
        let f = uploaded;
        for (let i = 0; i < 60 && f.state === "PROCESSING"; i++) { await new Promise((r) => setTimeout(r, 3000)); f = await ai.files.get({ name: f.name! }); }
        if (f.state !== "ACTIVE" || !f.uri) throw new Error(`upload state ${f.state}`);
        mediaPart = createPartFromUri(f.uri, f.mimeType ?? mime);
      }
      const res = await ai.models.generateContent({ model, contents: [{ role: "user", parts: [mediaPart, { text: prompt }] }], config: { temperature: 0.1 } });
      const text = (res.text ?? "").trim();
      if (!text) throw new Error("empty transcript");
      const u = res.usageMetadata;
      db.insert(schema.llmCalls).values({ role: "draft", task: "transcribe", model, provider: "gemini", tokensIn: u?.promptTokenCount ?? 0, tokensOut: u?.candidatesTokenCount ?? 0, costUsd: textCostUsd(model, u?.promptTokenCount ?? 0, u?.candidatesTokenCount ?? 0), durationMs: Date.now() - t0, ok: true, createdAt: new Date().toISOString() }).run();
      return { ok: true, transcript: text, model };
    } catch (e) {
      lastErr = (e as Error).message ?? String(e);
      db.insert(schema.llmCalls).values({ role: "draft", task: "transcribe", model, provider: "gemini", costUsd: 0, durationMs: Date.now() - t0, ok: false, error: lastErr.slice(0, 300), createdAt: new Date().toISOString() }).run();
      console.warn(`[transcribe] ${model} failed: ${lastErr.slice(0, 160)}`);
      if (/API key not valid|PERMISSION_DENIED/.test(lastErr)) break;
    }
  }
  const quota = /429|quota|limit:\s*0/i.test(lastErr);
  return { ok: false, note: quota ? "The Gemini models that understand audio are rate-limited or out of quota on this key right now. Upload or paste a transcript instead, or retry later." : `Transcription failed (${lastErr.slice(0, 140)}). Upload or paste a transcript instead.` };
}
