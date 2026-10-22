import { NextResponse } from "next/server";
import { proposeOutline } from "@/lib/draft/outline";
import { draftIdFrom, fail } from "../_helpers";
export const maxDuration = 300;
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try { return NextResponse.json({ ok: true, proposal: await proposeOutline(await draftIdFrom(ctx)) }); } catch (e) { return fail(e); }
}
