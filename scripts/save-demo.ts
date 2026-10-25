// `npm run demo:save` : write the latest finished run, its stories and items, every draft on
// those stories (versions, claims, research notes, images), the coverage memory, settings,
// editor actions and model-call logs to data/demo-snapshot.json. Committed, so the demo works
// on a fresh clone with no network and no key.
import fs from "node:fs";
import path from "node:path";
import { loadEnvLocal } from "@/lib/env";
loadEnvLocal();

async function main() {
  const { db, schema } = await import("@/lib/db/client");
  const { desc, eq, inArray } = await import("drizzle-orm");
  const run = db.select().from(schema.runs).where(eq(schema.runs.status, "done")).orderBy(desc(schema.runs.id)).get();
  if (!run) throw new Error("no finished run to snapshot");
  const stories = db.select().from(schema.stories).where(eq(schema.stories.runId, run.id)).all();
  const storyIds = stories.map((s) => s.id);
  const storyItems = storyIds.length ? db.select().from(schema.storyItems).where(inArray(schema.storyItems.storyId, storyIds)).all() : [];
  const itemIds = [...new Set(storyItems.map((l) => l.itemId))];
  const items = itemIds.length ? db.select().from(schema.items).where(inArray(schema.items.id, itemIds)).all() : [];
  const drafts = storyIds.length ? db.select().from(schema.drafts).where(inArray(schema.drafts.storyId, storyIds)).all() : [];
  const draftIds = drafts.map((d) => d.id);
  const draftVersions = draftIds.length ? db.select().from(schema.draftVersions).where(inArray(schema.draftVersions.draftId, draftIds)).all() : [];
  const claims = draftIds.length ? db.select().from(schema.claims).where(inArray(schema.claims.draftId, draftIds)).all() : [];
  const researchNotes = draftIds.length ? db.select().from(schema.researchNotes).where(inArray(schema.researchNotes.draftId, draftIds)).all() : [];
  const images = draftIds.length ? db.select().from(schema.images).where(inArray(schema.images.draftId, draftIds)).all() : [];
  const editorActions = db.select().from(schema.editorActions).all().filter((a) => (a.storyId && storyIds.includes(a.storyId)) || (a.draftId && draftIds.includes(a.draftId)));
  const llmCalls = db.select().from(schema.llmCalls).all().filter((c) => c.runId === run.id || (c.draftId && draftIds.includes(c.draftId)));
  const pastPosts = db.select().from(schema.pastPosts).all();
  const settings = db.select().from(schema.settings).all();
  const events = db.select().from(schema.events).all();
  const speakers = db.select().from(schema.speakers).all();
  const eventSources = db.select().from(schema.eventSources).all();
  const highlights = db.select().from(schema.highlights).all();
  const snapshot = { events, speakers, eventSources, highlights, savedAt: new Date().toISOString(), snapshotOf: run.startedAt, run, stories, storyItems, items, drafts, draftVersions, claims, researchNotes, images, editorActions, llmCalls, pastPosts, settings };
  const out = path.join(process.cwd(), "data", "demo-snapshot.json");
  fs.writeFileSync(out, JSON.stringify(snapshot));
  const mb = (fs.statSync(out).size / 1e6).toFixed(1);
  console.log(`saved ${out} (${mb} MB): run ${run.id} of ${run.startedAt}, ${stories.length} stories, ${items.length} items, ${drafts.length} drafts, ${claims.length} claims, ${images.length} images, ${llmCalls.length} model calls, ${events.length} events / ${highlights.length} highlights`);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
