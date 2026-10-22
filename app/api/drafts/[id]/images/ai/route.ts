import { NextResponse } from "next/server";
import { attemptAiImage } from "@/lib/images";
import { draftIdFrom, fail } from "../../_helpers";
export const maxDuration = 120;
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try { return NextResponse.json(await attemptAiImage(await draftIdFrom(ctx))); } catch (e) { return fail(e); }
}
