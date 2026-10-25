// POST { speakerId, permission } to change consent, or { name, title, permission } to add a speaker.
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const b = (await req.json().catch(() => ({}))) as { speakerId?: number; permission?: string; name?: string; title?: string };
  const perm = ["approved", "paraphrase", "off"].includes(b.permission ?? "") ? b.permission! : "paraphrase";
  if (b.speakerId) { db.update(schema.speakers).set({ permission: perm }).where(eq(schema.speakers.id, b.speakerId)).run(); return NextResponse.json({ ok: true }); }
  if (b.name?.trim()) { const s = db.insert(schema.speakers).values({ eventId: Number(id), name: b.name.trim(), title: b.title?.trim() || null, permission: perm }).returning().get(); return NextResponse.json({ ok: true, speakerId: s.id }); }
  return NextResponse.json({ ok: false, error: "speakerId or name required" }, { status: 400 });
}
