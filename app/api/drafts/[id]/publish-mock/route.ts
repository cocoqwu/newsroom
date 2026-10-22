// "Send to blog as draft" (mock): logs the action and returns the payload that would be sent.
// Nothing leaves this machine.
import { NextResponse } from "next/server";
import { loadDraftContext, logAction } from "@/lib/draft/context";
import { draftIdFrom, fail } from "../_helpers";
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const id = await draftIdFrom(ctx);
    const c = loadDraftContext(id);
    logAction(id, c.story.id, "publish_mock", "Webflow CMS payload shown, not sent");
    return NextResponse.json({ ok: true, sentAt: new Date().toISOString(), mocked: true });
  } catch (e) { return fail(e); }
}
