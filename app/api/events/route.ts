// POST /api/events { name, date, description, speakers: [{ name, title, permission }] }
import { NextResponse } from "next/server";
import { db, schema } from "@/lib/db/client";
import { nowIso } from "@/lib/text";
export async function POST(req: Request) {
  const b = (await req.json().catch(() => ({}))) as { name?: string; date?: string; description?: string; speakers?: { name: string; title?: string; permission?: string }[] };
  if (!b.name?.trim()) return NextResponse.json({ ok: false, error: "name is required" }, { status: 400 });
  const ev = db.insert(schema.events).values({ name: b.name.trim(), date: b.date || null, description: b.description || null, createdAt: nowIso() }).returning().get();
  for (const s of b.speakers ?? []) if (s.name?.trim()) db.insert(schema.speakers).values({ eventId: ev.id, name: s.name.trim(), title: s.title?.trim() || null, permission: ["approved", "paraphrase", "off"].includes(s.permission ?? "") ? s.permission! : "paraphrase" }).run();
  return NextResponse.json({ ok: true, eventId: ev.id });
}
