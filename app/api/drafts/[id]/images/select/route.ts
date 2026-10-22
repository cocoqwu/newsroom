import { NextResponse } from "next/server";
import { loadDraftContext, logAction, touch } from "@/lib/draft/context";
import { draftIdFrom, fail } from "../../_helpers";
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const id = await draftIdFrom(ctx);
    const { imageId } = (await req.json()) as { imageId: number };
    touch(id, { selectedImageId: Number(imageId) });
    logAction(id, loadDraftContext(id).story.id, "select_image", String(imageId));
    return NextResponse.json({ ok: true });
  } catch (e) { return fail(e); }
}
