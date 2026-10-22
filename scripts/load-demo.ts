// `npm run demo:load` : replace the local database with the saved snapshot of one real day.
// Dates are shifted so the run reads as "today" (pass --keep-dates to skip that). The run is
// marked mode=demo, so the UI shows the "Demo snapshot" badge. Pair with NEWSROOM_MODE=demo to
// replay recorded model responses instead of calling Gemini.
import fs from "node:fs";
import path from "node:path";
import { loadEnvLocal } from "@/lib/env";
loadEnvLocal();

type Row = Record<string, unknown>;

async function main() {
  const file = path.join(process.cwd(), "data", "demo-snapshot.json");
  if (!fs.existsSync(file)) throw new Error("data/demo-snapshot.json not found; run npm run demo:save after a live pipeline run");
  const snap = JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, unknown> & { run: Row; snapshotOf: string };
  const keepDates = process.argv.includes("--keep-dates");
  const shiftMs = keepDates ? 0 : Date.now() - Date.parse(String(snap.run.finishedAt ?? snap.run.startedAt)) - 20 * 60 * 1000; // "collected 20 min ago"
  const shift = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v) && shiftMs ? new Date(Date.parse(v) + shiftMs).toISOString() : v);
  const shiftRow = (r: Row, keys: string[]) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, keys.includes(k) ? shift(v) : v]));

  const { db, schema } = await import("@/lib/db/client");
  const tables = [
    ["runs", schema.runs, ["startedAt", "finishedAt"]],
    ["items", schema.items, ["publishedAt", "fetchedAt"]],
    ["stories", schema.stories, []],
    ["storyItems", schema.storyItems, []],
    ["drafts", schema.drafts, ["createdAt", "updatedAt"]],
    ["draftVersions", schema.draftVersions, ["createdAt"]],
    ["claims", schema.claims, []],
    ["researchNotes", schema.researchNotes, []],
    ["images", schema.images, []],
    ["editorActions", schema.editorActions, ["createdAt"]],
    ["llmCalls", schema.llmCalls, ["createdAt"]],
    ["pastPosts", schema.pastPosts, ["fetchedAt"]],
    ["settings", schema.settings, ["updatedAt"]],
  ] as const;

  db.transaction((tx) => {
    for (const [, table] of [...tables].reverse()) tx.delete(table).run();
    for (const [key, table, dateKeys] of tables) {
      const rows = key === "runs" ? [snap.run as Row] : ((snap[key] as Row[]) ?? []);
      for (const r of rows) {
        const row = shiftRow(r, [...dateKeys]);
        if (key === "runs") {
          row.mode = "demo";
          const notes = typeof row.notes === "string" ? JSON.parse(row.notes) : {};
          notes.snapshotOf = snap.snapshotOf;
          row.notes = JSON.stringify(notes);
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        tx.insert(table as any).values(row as any).run();
      }
    }
    tx.insert(schema.settings).values({ key: "last_run_id", value: String(snap.run.id), updatedAt: new Date().toISOString() }).onConflictDoUpdate({ target: schema.settings.key, set: { value: String(snap.run.id) } }).run();
  });
  const n = (k: string) => ((snap[k] as Row[]) ?? []).length;
  console.log(`loaded demo snapshot of ${snap.snapshotOf.slice(0, 10)}: ${n("stories")} stories, ${n("items")} items, ${n("drafts")} drafts, ${n("claims")} claims, ${n("images")} images. Dates ${keepDates ? "kept" : "shifted to today"}.`);
  console.log("Start the app with: npm run demo   (NEWSROOM_MODE=demo replays recorded model responses)");
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
