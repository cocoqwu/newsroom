// Pick / Skip / Save for later. Every action is logged in editor_actions.
// Pick also creates the draft (status "outline") and returns its id so the UI can navigate.
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";
import { nowIso } from "@/lib/text";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const storyId = Number(id);
  const body = (await req.json().catch(() => ({}))) as { action?: string; format?: string; note?: string };
  const action = body.action;
  if (!storyId || !action || !["pick", "skip", "save", "unskip"].includes(action)) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  const story = db.select().from(schema.stories).where(eq(schema.stories.id, storyId)).get();
  if (!story) return NextResponse.json({ error: "story not found" }, { status: 404 });

  const now = nowIso();
  db.insert(schema.editorActions).values({ storyId, action, format: body.format ?? null, note: body.note ?? null, createdAt: now }).run();

  if (action === "pick") {
    const format = body.format && ["technical-primer", "research-brief", "event-recap"].includes(body.format) ? body.format : story.format ?? "research-brief";
    const existing = db.select().from(schema.drafts).where(eq(schema.drafts.storyId, storyId)).get();
    const draft = existing ?? db.insert(schema.drafts).values({ storyId, status: "outline", format, angleNote: body.note ?? null, createdAt: now, updatedAt: now }).returning().get();
    if (existing && (body.note || body.format)) db.update(schema.drafts).set({ angleNote: body.note ?? existing.angleNote, format, updatedAt: now }).where(eq(schema.drafts.id, existing.id)).run();
    db.update(schema.stories).set({ status: "picked" }).where(eq(schema.stories.id, storyId)).run();
    return NextResponse.json({ ok: true, draftId: draft.id });
  }
  const status = action === "skip" ? "skipped" : action === "save" ? "saved" : "new";
  db.update(schema.stories).set({ status }).where(eq(schema.stories.id, storyId)).run();
  return NextResponse.json({ ok: true, status });
}
