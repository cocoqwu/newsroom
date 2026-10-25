import { NextResponse } from "next/server";
import { extractHighlights } from "@/lib/events/highlights";
export const maxDuration = 300;
export async function POST(_req: Request, ctx: { params: Promise<{ id: string; sid: string }> }) {
  const { sid } = await ctx.params;
  try { return NextResponse.json({ ok: true, ...(await extractHighlights(Number(sid))) }); } catch (e) { return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 }); }
}
