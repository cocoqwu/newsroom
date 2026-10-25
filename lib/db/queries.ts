// Read helpers for the screens. Everything the Today, Draft and Publish pages need, in one place.
import { desc, eq, inArray, and } from "drizzle-orm";
import { db, schema } from "./client";
import type { SignalId } from "@/config/ranking";
import type { SourceResult } from "@/lib/pipeline/collect";

export type Run = typeof schema.runs.$inferSelect;
export type Story = typeof schema.stories.$inferSelect;
export type Item = typeof schema.items.$inferSelect;
export type Draft = typeof schema.drafts.$inferSelect;

export type RunNotes = { lookbackHours?: number; sinceIso?: string; sources?: SourceResult[]; steps?: Record<string, number>; cluster?: { clusters: number; borderlineChecked: number; merged: number }; coverage?: { posts: number; fetched: number; styleGuide: string }; embeddingBackend?: string; error?: string };

export type StoryWithItems = Story & {
  items: Item[];
  parsedSignals: Record<SignalId, { value: number; note: string }> | null;
  parsedCovered: { url: string; title: string; similarity: number } | null;
  draftId: number | null;
};

export function getLatestRun(): Run | null {
  return db.select().from(schema.runs).where(eq(schema.runs.status, "done")).orderBy(desc(schema.runs.id)).get() ?? null;
}

export function parseNotes(run: Run | null): RunNotes {
  try { return run?.notes ? (JSON.parse(run.notes) as RunNotes) : {}; } catch { return {}; }
}

// The digest: ranks 1-9 by score plus the wildcard, in display order. Also returns the rest for "more".
export function getDigest(runId: number): { top: StoryWithItems[]; rest: StoryWithItems[] } {
  // Stories without a rank are synthetic (event recaps) and belong on Drafts, not in the digest.
  const rows = db.select().from(schema.stories).where(eq(schema.stories.runId, runId)).orderBy(schema.stories.rank).all().filter((r) => r.rank !== null);
  const withItems = attachItems(rows);
  const wildcard = withItems.find((s) => s.isWildcard) ?? null;
  const top = withItems.filter((s) => (s.rank ?? 99) <= 9);
  if (wildcard) top.push(wildcard);
  const topIds = new Set(top.map((s) => s.id));
  return { top, rest: withItems.filter((s) => !topIds.has(s.id)) };
}

export function getStory(id: number): StoryWithItems | null {
  const row = db.select().from(schema.stories).where(eq(schema.stories.id, id)).get();
  return row ? attachItems([row])[0] : null;
}

function attachItems(rows: Story[]): StoryWithItems[] {
  if (!rows.length) return [];
  const links = db.select().from(schema.storyItems).where(inArray(schema.storyItems.storyId, rows.map((r) => r.id))).all();
  const itemIds = [...new Set(links.map((l) => l.itemId))];
  const items = itemIds.length ? db.select().from(schema.items).where(inArray(schema.items.id, itemIds)).all() : [];
  const byId = new Map(items.map((i) => [i.id, i]));
  const draftRows = db.select({ id: schema.drafts.id, storyId: schema.drafts.storyId }).from(schema.drafts).where(inArray(schema.drafts.storyId, rows.map((r) => r.id))).all();
  const draftByStory = new Map<number, number>();
  for (const d of draftRows) if (!draftByStory.has(d.storyId)) draftByStory.set(d.storyId, d.id);
  return rows.map((r) => {
    const its = links.filter((l) => l.storyId === r.id).map((l) => byId.get(l.itemId)).filter((x): x is Item => Boolean(x));
    its.sort((a, b) => (a.id === r.primaryItemId ? -1 : b.id === r.primaryItemId ? 1 : b.sourceQuality - a.sourceQuality));
    return {
      ...r,
      items: its,
      parsedSignals: safe(r.signals),
      parsedCovered: safe(r.coveredBefore),
      draftId: draftByStory.get(r.id) ?? null,
    };
  });
}

export function listDrafts(): (Draft & { storyTitle: string })[] {
  const rows = db.select().from(schema.drafts).orderBy(desc(schema.drafts.updatedAt)).all();
  if (!rows.length) return [];
  const stories = db.select({ id: schema.stories.id, title: schema.stories.title }).from(schema.stories).where(inArray(schema.stories.id, rows.map((r) => r.storyId))).all();
  const t = new Map(stories.map((s) => [s.id, s.title]));
  return rows.map((r) => ({ ...r, storyTitle: t.get(r.storyId) ?? "" }));
}

export function getRunCost(runId: number): { calls: number; tokensIn: number; tokensOut: number; costUsd: number; byProvider: Record<string, number> } {
  const calls = db.select().from(schema.llmCalls).where(and(eq(schema.llmCalls.runId, runId))).all();
  const byProvider: Record<string, number> = {};
  for (const c of calls) byProvider[c.provider] = (byProvider[c.provider] ?? 0) + 1;
  return { calls: calls.length, tokensIn: calls.reduce((s, c) => s + c.tokensIn, 0), tokensOut: calls.reduce((s, c) => s + c.tokensOut, 0), costUsd: calls.reduce((s, c) => s + c.costUsd, 0), byProvider };
}

function safe<T>(s: string | null): T | null {
  try { return s ? (JSON.parse(s) as T) : null; } catch { return null; }
}
