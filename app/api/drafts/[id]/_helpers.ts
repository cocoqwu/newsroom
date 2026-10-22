import { NextResponse } from "next/server";

export async function draftIdFrom(ctx: { params: Promise<{ id: string }> }): Promise<number> {
  const { id } = await ctx.params;
  const n = Number(id);
  if (!n) throw new Error("bad draft id");
  return n;
}

export function fail(e: unknown, status = 500) {
  const msg = (e as Error).message ?? String(e);
  console.error("[api]", msg);
  return NextResponse.json({ ok: false, error: msg }, { status });
}
