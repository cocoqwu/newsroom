// Run the daily pipeline from the UI. Same code path as `npm run pipeline`.
import { NextResponse } from "next/server";
import { runPipeline } from "@/lib/pipeline/run";

export const maxDuration = 600;

export async function POST() {
  try {
    const lines: string[] = [];
    const result = await runPipeline({ log: (s) => { lines.push(s); console.log(s); } });
    return NextResponse.json({ ok: true, ...result, log: lines });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
