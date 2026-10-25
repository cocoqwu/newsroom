import { NextResponse } from "next/server";
import { attachToDraft } from "@/lib/events/attach";
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const { draftId } = (await req.json().catch(() => ({}))) as { draftId?: number };
  if (!draftId) return NextResponse.json({ ok: false, error: "draftId required" }, { status: 400 });
  try { return NextResponse.json({ ok: true, ...attachToDraft(Number(id), Number(draftId)) }); } catch (e) { return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 }); }
}
