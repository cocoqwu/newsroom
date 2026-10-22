import { NextResponse } from "next/server";
import { ensureSvgOptions, getImages } from "@/lib/images";
import { draftIdFrom, fail } from "../_helpers";
// POST regenerates the three SVG options with a new seed.
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try { const id = await draftIdFrom(ctx); ensureSvgOptions(id, true); return NextResponse.json({ ok: true, images: getImages(id).map((i) => ({ id: i.id, kind: i.kind, label: i.label, status: i.status })) }); } catch (e) { return fail(e); }
}
