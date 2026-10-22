import { NextResponse } from "next/server";
import { writeDraft } from "@/lib/draft/write";
import { ensureSvgOptions } from "@/lib/images";
import { draftIdFrom, fail } from "../_helpers";
export const maxDuration = 300;
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const id = await draftIdFrom(ctx);
    const r = await writeDraft(id);
    ensureSvgOptions(id);
    return NextResponse.json({ ok: true, ...r });
  } catch (e) { return fail(e); }
}
