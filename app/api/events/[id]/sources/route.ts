// POST multipart: either `text` (pasted) or `file` (.txt/.vtt/.srt/.md transcript, or mp3/m4a/wav/mp4).
// Media is transcribed with Gemini; if that fails the source is saved as "failed" with a note.
import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { db, schema } from "@/lib/db/client";
import { nowIso } from "@/lib/text";
import { parseTranscriptFile, transcriptExtensions, mediaMimes } from "@/lib/events/transcripts";
import { transcribeMedia, MEDIA_LIMIT } from "@/lib/events/transcribe";
export const maxDuration = 600;
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const eventId = Number(id);
  const form = await req.formData();
  const text = String(form.get("text") ?? "").trim();
  const label = String(form.get("label") ?? "").trim();
  const file = form.get("file");
  const now = nowIso();
  if (text) {
    const src = db.insert(schema.eventSources).values({ eventId, kind: "paste", label: label || "Pasted transcript", transcript: text, status: "ready", createdAt: now }).returning().get();
    return NextResponse.json({ ok: true, sourceId: src.id, status: "ready" });
  }
  if (!(file instanceof File)) return NextResponse.json({ ok: false, error: "paste text or choose a file" }, { status: 400 });
  const ext = path.extname(file.name).toLowerCase();
  const buf = Buffer.from(await file.arrayBuffer());
  if (transcriptExtensions.includes(ext)) {
    const transcript = parseTranscriptFile(file.name, buf.toString("utf8"));
    const src = db.insert(schema.eventSources).values({ eventId, kind: "transcript", label: label || file.name, mime: file.type || null, sizeBytes: buf.length, transcript, status: "ready", createdAt: now }).returning().get();
    return NextResponse.json({ ok: true, sourceId: src.id, status: "ready" });
  }
  const mime = mediaMimes[ext] ?? file.type;
  if (!mime || !/^(audio|video)\//.test(mime)) return NextResponse.json({ ok: false, error: `Unsupported file type ${ext || file.type}. Use .txt, .vtt, .srt, .md, .mp3, .m4a, .wav or .mp4.` }, { status: 400 });
  const kind = mime.startsWith("video") ? "video" : "audio";
  const src = db.insert(schema.eventSources).values({ eventId, kind, label: label || file.name, mime, sizeBytes: buf.length, status: "transcribing", createdAt: now }).returning().get();
  if (buf.length <= MEDIA_LIMIT) { try { fs.mkdirSync(path.join(process.cwd(), "data", "uploads"), { recursive: true }); fs.writeFileSync(path.join(process.cwd(), "data", "uploads", `${src.id}${ext}`), buf); } catch { /* keeping the file is optional */ } }
  const r = await transcribeMedia(buf, mime, file.name);
  const { eq } = await import("drizzle-orm");
  if (r.ok) db.update(schema.eventSources).set({ transcript: r.transcript, status: "ready", note: `Transcribed with ${r.model}` }).where(eq(schema.eventSources.id, src.id)).run();
  else db.update(schema.eventSources).set({ status: "failed", note: r.note }).where(eq(schema.eventSources.id, src.id)).run();
  return NextResponse.json({ ok: true, sourceId: src.id, status: r.ok ? "ready" : "failed", note: r.ok ? undefined : r.note });
}
