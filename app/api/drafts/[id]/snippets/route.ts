import { NextResponse } from "next/server";
import { generateSnippets } from "@/lib/export/snippets";
import { draftIdFrom, fail } from "../_helpers";
export const maxDuration = 120;
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try { return NextResponse.json({ ok: true, snippets: await generateSnippets(await draftIdFrom(ctx)) }); } catch (e) { return fail(e); }
}
