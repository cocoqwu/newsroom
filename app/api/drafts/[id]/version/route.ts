import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";
import { saveVersion } from "@/lib/draft/write";
import { loadDraftContext, logAction } from "@/lib/draft/context";
import { draftIdFrom, fail } from "../_helpers";
// POST { bodyMd, note } saves the editor's inline edit as a new version.
// POST { restoreVersion } copies an old version forward as a new one.
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const id = await draftIdFrom(ctx);
    const body = (await req.json()) as { bodyMd?: string; note?: string; restoreVersion?: number };
    const storyId = loadDraftContext(id).story.id;
    if (body.restoreVersion) {
      const v = db.select().from(schema.draftVersions).where(and(eq(schema.draftVersions.draftId, id), eq(schema.draftVersions.version, body.restoreVersion))).get();
      if (!v) return fail(new Error("version not found"), 404);
      const version = saveVersion(id, v.bodyMd, `Restored v${body.restoreVersion}`);
      logAction(id, storyId, "restore_version", String(body.restoreVersion));
      return NextResponse.json({ ok: true, version });
    }
    if (typeof body.bodyMd !== "string" || !body.bodyMd.trim()) return fail(new Error("bodyMd is required"), 400);
    const version = saveVersion(id, body.bodyMd, body.note || "Manual edit");
    logAction(id, storyId, "edit", body.note);
    return NextResponse.json({ ok: true, version });
  } catch (e) { return fail(e); }
}
