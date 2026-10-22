import { NextResponse } from "next/server";
import { reviseSelection } from "@/lib/draft/revise";
import { draftIdFrom, fail } from "../_helpers";
export const maxDuration = 120;
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const id = await draftIdFrom(ctx);
    const { selection, instruction } = (await req.json()) as { selection: string; instruction: string };
    if (!selection?.trim() || !instruction?.trim()) return fail(new Error("selection and instruction are required"), 400);
    return NextResponse.json({ ok: true, ...(await reviseSelection(id, selection, instruction)) });
  } catch (e) { return fail(e); }
}
