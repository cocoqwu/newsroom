// Create the sample event for the demo: fictional speakers, a transcript written for this project.
// Idempotent: skips if the sample event already exists. Run with `npx tsx scripts/seed-sample-event.ts`.
import fs from "node:fs";
import path from "node:path";
import { loadEnvLocal } from "@/lib/env";
loadEnvLocal();

async function main() {
  const { db, schema } = await import("@/lib/db/client");
  const { eq } = await import("drizzle-orm");
  const existing = db.select().from(schema.events).where(eq(schema.events.isSample, true)).get();
  if (existing) { console.log(`sample event already exists (id ${existing.id})`); return existing.id; }
  const now = new Date().toISOString();
  const ev = db.insert(schema.events).values({
    name: "Long-Horizon Agents Build Day (sample)", date: "2026-10-31",
    description: "Sample event for the demo. Panel \"Why agents fall apart after hour two\" plus one live demo. Speakers and transcript are fictional.",
    isSample: true, createdAt: now,
  }).returning().get();
  const spk = [
    { name: "Priya Venkataraman", title: "Moderator (fictional)", permission: "approved" },
    { name: "Dara Okonkwo-Lindqvist", title: "Agents platform lead, Halvard Systems (fictional)", permission: "approved" },
    { name: "Mateus Ferreira-Nakamura", title: "Research scientist, Northlake Institute (fictional)", permission: "paraphrase" },
    { name: "Sunniva Achterberg", title: "Founder, Quillon (fictional)", permission: "off" },
  ];
  for (const s of spk) db.insert(schema.speakers).values({ eventId: ev.id, ...s }).run();
  const transcript = fs.readFileSync(path.join(process.cwd(), "data", "samples", "sample-event-transcript.txt"), "utf8");
  const src = db.insert(schema.eventSources).values({ eventId: ev.id, kind: "transcript", label: "Panel transcript (sample, fictional).txt", mime: "text/plain", sizeBytes: Buffer.byteLength(transcript), transcript, status: "ready", note: "Sample transcript written for the demo", createdAt: now }).returning().get();
  console.log(`created sample event ${ev.id} with ${spk.length} speakers and source ${src.id}`);
  return ev.id;
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
