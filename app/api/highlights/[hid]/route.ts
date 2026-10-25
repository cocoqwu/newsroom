// POST { status: "starred" | "rejected" | "new" } or { quote, paraphrase, type, speakerId } to edit.
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";
import { applyEventBoosts } from "@/lib/events/boost";
import { nowIso } from "@/lib/text";
export async function POST(req: Request, ctx: { params: Promise<{ hid: string }> }) {
  const { hid } = await ctx.params;
  const h = db.select().from(schema.highlights).where(eq(schema.highlights.id, Number(hid))).get();
  if (!h) return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
  const b = (await req.json().catch(() => ({}))) as { status?: string; quote?: string; paraphrase?: string; type?: string; speakerId?: number | null };
  const patch: Partial<typeof schema.highlights.$inferInsert> = {};
  if (b.status && ["starred", "rejected", "new"].includes(b.status)) patch.status = b.status;
  if (typeof b.quote === "string") patch.quote = b.quote.slice(0, 220);
  if (typeof b.paraphrase === "string") patch.paraphrase = b.paraphrase.slice(0, 300);
  if (b.type) patch.type = b.type;
  if (b.speakerId !== undefined) { patch.speakerId = b.speakerId; if (b.speakerId) { const s = db.select().from(schema.speakers).where(eq(schema.speakers.id, b.speakerId)).get(); if (s) patch.speakerName = s.name; } }
  if (b.quote !== undefined || b.paraphrase !== undefined || b.type !== undefined) patch.edited = true;
  db.update(schema.highlights).set(patch).where(eq(schema.highlights.id, h.id)).run();
  db.insert(schema.editorActions).values({ action: `highlight_${b.status ?? "edit"}`, note: `highlight ${h.id}`, createdAt: nowIso() }).run();
  const boost = b.status ? applyEventBoosts(h.eventId) : { boosted: 0 };
  return NextResponse.json({ ok: true, ...boost });
}
