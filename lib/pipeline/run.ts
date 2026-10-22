// The daily pipeline, end to end: collect → coverage memory → embed → cluster → rank → store.
// Safe to rerun: items dedupe by URL, each run writes its own story set, and the Today screen
// always shows the latest finished run.
import { eq, sum, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";
import { firstRunLookbackHours } from "@/config/sources";
import { digest } from "@/config/ranking";
import { nowIso } from "@/lib/text";
import { collect } from "./collect";
import { refreshCoverage, getPastPosts } from "./coverage";
import { embed, embeddingBackend } from "./embeddings";
import { clusterItems, primaryItem } from "./cluster";
import { rankClusters } from "./rank";

export type RunOptions = { only?: "collect" | "all"; lookbackHours?: number; log?: (s: string) => void; mode?: "live" | "demo" };

export async function runPipeline(opts: RunOptions = {}): Promise<{ runId: number; items: number; stories: number; costUsd: number; durationMs: number }> {
  const log = opts.log ?? console.log;
  const t0 = Date.now();
  const startedAt = nowIso();
  const lookback = opts.lookbackHours ?? firstRunLookbackHours;
  const sinceIso = new Date(Date.now() - lookback * 36e5).toISOString();
  const run = db.insert(schema.runs).values({ startedAt, mode: opts.mode ?? "live", status: "running" }).returning().get();
  const notes: Record<string, unknown> = { lookbackHours: lookback, sinceIso, steps: {} as Record<string, number> };
  const steps = notes.steps as Record<string, number>;
  const timed = async <T,>(name: string, fn: () => Promise<T>): Promise<T> => {
    const s = Date.now();
    log(`▸ ${name}`);
    const r = await fn();
    steps[name] = Date.now() - s;
    return r;
  };

  try {
    const { results, items } = await timed("collect", () => collect(run.id, sinceIso, log));
    notes.sources = results;
    log(`  ${items.length} items in the last ${lookback} h from ${results.filter((r) => r.ok).length}/${results.length} sources`);
    db.update(schema.runs).set({ itemsCollected: items.length }).where(eq(schema.runs.id, run.id)).run();

    if (opts.only === "collect") {
      return finish(run.id, startedAt, t0, notes, 0, log);
    }

    const coverage = await timed("coverage", () => refreshCoverage(run.id, log));
    notes.coverage = coverage;

    const vectors = await timed("embed", () => embed(items.map((it) => `${it.title}. ${(it.summary ?? "").slice(0, 400)}`)));
    notes.embeddingBackend = embeddingBackend;

    const { clusters, borderlineChecked, merged } = await timed("cluster", () => clusterItems(items, vectors, run.id, log));
    notes.cluster = { clusters: clusters.length, borderlineChecked, merged };

    const scored = await timed("rank", () => rankClusters(clusters, getPastPosts(), run.id, log));

    // Store stories and their items. Rank = position by score. Wildcard = one story from ranks 11-30.
    const wildcardIdx = pickWildcard(scored.length, run.id, scored.map((s) => s.signals.novelty.value));
    db.transaction((tx) => {
      scored.forEach((s, i) => {
        const p = primaryItem(s.cluster);
        const story = tx
          .insert(schema.stories)
          .values({
            runId: run.id,
            rank: i + 1,
            isWildcard: i === wildcardIdx,
            title: s.title,
            summary: s.summary,
            whyNow: s.whyNow,
            theme: s.theme,
            format: s.format,
            primaryItemId: p.id,
            sourceCount: s.cluster.items.length,
            scoreTotal: s.total,
            signals: JSON.stringify(s.signals),
            coveredBefore: s.coveredBefore ? JSON.stringify(s.coveredBefore) : null,
            embedding: JSON.stringify(s.cluster.center.map((x) => Math.round(x * 1e4) / 1e4)),
          })
          .returning({ id: schema.stories.id })
          .get();
        for (const it of s.cluster.items) tx.insert(schema.storyItems).values({ storyId: story.id, itemId: it.id }).onConflictDoNothing().run();
      });
    });
    log(`  stored ${scored.length} stories; wildcard is rank ${wildcardIdx + 1}`);
    return finish(run.id, startedAt, t0, notes, scored.length, log);
  } catch (e) {
    const error = (e as Error).stack ?? String(e);
    notes.error = error;
    db.update(schema.runs).set({ status: "failed", finishedAt: nowIso(), notes: JSON.stringify(notes) }).where(eq(schema.runs.id, run.id)).run();
    log(`✗ run ${run.id} failed: ${(e as Error).message}`);
    throw e;
  }
}

function finish(runId: number, startedAt: string, t0: number, notes: Record<string, unknown>, storiesCount: number, log: (s: string) => void) {
  const usage = db
    .select({ tin: sum(schema.llmCalls.tokensIn), tout: sum(schema.llmCalls.tokensOut), cost: sum(schema.llmCalls.costUsd), n: sql<number>`count(*)` })
    .from(schema.llmCalls)
    .where(eq(schema.llmCalls.runId, runId))
    .get();
  const costUsd = Number(usage?.cost ?? 0);
  const itemsCollected = db.select({ n: sql<number>`count(*)` }).from(schema.items).get()?.n ?? 0;
  void itemsCollected;
  db.update(schema.runs)
    .set({ status: "done", finishedAt: nowIso(), storiesCount, tokensIn: Number(usage?.tin ?? 0), tokensOut: Number(usage?.tout ?? 0), costUsd, notes: JSON.stringify(notes) })
    .where(eq(schema.runs.id, runId))
    .run();
  db.insert(schema.settings).values({ key: "last_run_id", value: String(runId), updatedAt: nowIso() }).onConflictDoUpdate({ target: schema.settings.key, set: { value: String(runId), updatedAt: nowIso() } }).run();
  const durationMs = Date.now() - t0;
  const items = db.select({ n: schema.runs.itemsCollected }).from(schema.runs).where(eq(schema.runs.id, runId)).get()?.n ?? 0;
  log(`✓ run ${runId} done in ${Math.round(durationMs / 1000)} s: ${items} items, ${storiesCount} stories, ${usage?.n ?? 0} model calls, list cost $${costUsd.toFixed(4)} (started ${startedAt})`);
  return { runId, items, stories: storiesCount, costUsd, durationMs };
}

// Deterministic per run: among ranks 11-30, favor novelty, seeded by run id.
function pickWildcard(n: number, seed: number, novelty: number[]): number {
  const from = digest.wildcardFromRank - 1, to = Math.min(n, digest.wildcardToRank);
  if (to <= from) return -1;
  let x = (seed * 9301 + 49297) % 233280;
  let best = from, bestScore = -1;
  for (let i = from; i < to; i++) {
    x = (x * 9301 + 49297) % 233280;
    const score = (x / 233280) * 0.6 + novelty[i] * 0.4;
    if (score > bestScore) { bestScore = score; best = i; }
  }
  return best;
}
