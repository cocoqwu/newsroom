import { NextResponse } from "next/server";
import { approveOutline } from "@/lib/draft/outline";
import { loadDraftContext, logAction } from "@/lib/draft/context";
import { draftIdFrom, fail } from "../_helpers";
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const id = await draftIdFrom(ctx);
    const body = (await req.json()) as { title: string; thesis: string; outline: { heading: string; bullets: string[] }[] };
    if (!body?.title || !Array.isArray(body.outline) || !body.outline.length) return fail(new Error("title and outline are required"), 400);
    approveOutline(id, body);
    const c = loadDraftContext(id);
    logAction(id, c.story.id, "approve_outline", `${body.outline.length} sections`);
    return NextResponse.json({ ok: true });
  } catch (e) { return fail(e); }
}
