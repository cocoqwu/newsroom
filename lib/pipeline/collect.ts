// Step 1: pull items from every source, normalize, dedupe by URL, store summary + link.
// Each source runs with its own timeout; failures are recorded in the run notes, never thrown.
import { eq, gte, or, and, isNull } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";
import { sources, maxItemsPerSource, type Source } from "@/config/sources";
import { adapters, normalizeUrl } from "./sources";
import { nowIso } from "@/lib/text";

export type SourceResult = { sourceId: string; name: string; ok: boolean; fetched: number; kept: number; inserted: number; ms: number; error?: string };

export type ItemRow = typeof schema.items.$inferSelect;

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error(`${label} timed out after ${ms / 1000}s`)), ms))]);
}

export async function collect(runId: number, sinceIso: string, log: (s: string) => void = console.log): Promise<{ results: SourceResult[]; items: ItemRow[] }> {
  const results: SourceResult[] = [];
  const fetchedAt = nowIso();

  // Sources in parallel, but politely: at most 5 at a time.
  const queue = [...sources];
  const workers = Array.from({ length: 5 }, async () => {
    while (queue.length) {
      const src = queue.shift()!;
      results.push(await collectOne(src, runId, sinceIso, fetchedAt, log));
    }
  });
  await Promise.all(workers);

  // Everything published in the window, whichever run first saw it. Undated items count if fetched in the window.
  const items = db
    .select()
    .from(schema.items)
    .where(or(gte(schema.items.publishedAt, sinceIso), and(isNull(schema.items.publishedAt), gte(schema.items.fetchedAt, sinceIso))))
    .all();
  return { results: results.sort((a, b) => a.sourceId.localeCompare(b.sourceId)), items };
}

async function collectOne(src: Source, runId: number, sinceIso: string, fetchedAt: string, log: (s: string) => void): Promise<SourceResult> {
  const t0 = Date.now();
  if (src.disabled) {
    log(`  ${src.name}: skipped (${src.disabled})`);
    return { sourceId: src.id, name: src.name, ok: false, fetched: 0, kept: 0, inserted: 0, ms: 0, error: `skipped: ${src.disabled}` };
  }
  try {
    const raw = await withTimeout(adapters[src.type](src, sinceIso), 30000, src.name);
    const since = Date.parse(sinceIso);
    const kept = raw
      .filter((r) => r.title && r.url)
      .filter((r) => !r.publishedAt || Number.isNaN(Date.parse(r.publishedAt)) || Date.parse(r.publishedAt) >= since)
      .slice(0, maxItemsPerSource);
    let inserted = 0;
    for (const r of kept) {
      const url = normalizeUrl(r.url);
      const res = db
        .insert(schema.items)
        .values({
          runId,
          sourceId: src.id,
          sourceName: src.name,
          sourceType: src.type,
          sourceGroup: src.group,
          sourceQuality: src.quality,
          title: r.title.slice(0, 300),
          url,
          summary: r.summary ?? null,
          author: r.author ?? null,
          publishedAt: r.publishedAt && !Number.isNaN(Date.parse(r.publishedAt)) ? new Date(r.publishedAt).toISOString() : null,
          fetchedAt,
          signals: r.signals ? JSON.stringify(r.signals) : null,
        })
        .onConflictDoNothing({ target: schema.items.url })
        .run();
      if (res.changes > 0) inserted++;
      else if (r.signals) {
        // Refresh public signals (points, stars) on items we already had.
        db.update(schema.items).set({ signals: JSON.stringify(r.signals) }).where(eq(schema.items.url, url)).run();
      }
    }
    const result = { sourceId: src.id, name: src.name, ok: true, fetched: raw.length, kept: kept.length, inserted, ms: Date.now() - t0 };
    log(`  ${src.name}: ${raw.length} fetched, ${kept.length} in window, ${inserted} new (${result.ms} ms)`);
    return result;
  } catch (e) {
    const error = (e as Error).message.slice(0, 200);
    log(`  ${src.name}: FAILED (${error})`);
    return { sourceId: src.id, name: src.name, ok: false, fetched: 0, kept: 0, inserted: 0, ms: Date.now() - t0, error };
  }
}
