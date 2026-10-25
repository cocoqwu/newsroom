import { NextResponse } from "next/server";
import { startRecapDraft } from "@/lib/events/attach";
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  try { return NextResponse.json({ ok: true, ...startRecapDraft(Number(id)) }); } catch (e) { return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 }); }
}
