// When a starred highlight matches a Today story (same theme tag, or similar words in the title),
// that story's theme fit and event tie-in go up and its total is recomputed. The signal notes say
// why, so the breakdown stays explainable. Un-starring removes the boost.
import { and, eq, desc, isNotNull } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";
import { rankingWeights, type SignalId } from "@/config/ranking";

type Signals = Record<SignalId, { value: number; note: string; base?: number }>;
const STOP = new Set("the a an and or of to in on for with by from at as is are was were be this that these those it its into over about we our you your they their what how why new agent agents model models learning data system systems training using based large language".split(" "));
const words = (s: string) => new Set(s.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 3 && !STOP.has(w)));

export function applyEventBoosts(eventId: number): { boosted: number } {
  const event = db.select().from(schema.events).where(eq(schema.events.id, eventId)).get();
  const run = db.select().from(schema.runs).where(eq(schema.runs.status, "done")).orderBy(desc(schema.runs.id)).get();
  if (!event || !run) return { boosted: 0 };
  const starred = db.select().from(schema.highlights).where(and(eq(schema.highlights.eventId, eventId), eq(schema.highlights.status, "starred"))).all();
  const stories = db.select().from(schema.stories).where(and(eq(schema.stories.runId, run.id), isNotNull(schema.stories.signals))).all();
  // Score every story by real word overlap with the starred highlights; only the closest few
  // (same theme and two shared specific words, or four shared words) get the boost.
  const scored = stories.map((st) => {
    const title = words(`${st.title} ${st.summary ?? ""}`);
    const hits = starred.filter((h) => {
      const tags = JSON.parse(h.tags ?? "[]") as string[];
      const overlap = [...words(`${h.paraphrase} ${h.quote}`)].filter((w) => title.has(w)).length;
      return (tags.includes(st.theme ?? "") && overlap >= 2) || overlap >= 4;
    });
    return { st, hits };
  });
  const winners = new Set(scored.filter((x) => x.hits.length).sort((a, b) => b.hits.length - a.hits.length).slice(0, 8).map((x) => x.st.id));
  let boosted = 0;
  for (const { st, hits: allHits } of scored) {
    let sig: Signals;
    try { sig = JSON.parse(st.signals!) as Signals; } catch { continue; }
    const hits = winners.has(st.id) ? allHits : [];
    const had = typeof sig.event_tie_in.base === "number";
    if (!hits.length && !had) continue;
    // restore base values first, then apply the current boost (or none)
    for (const k of ["theme_fit", "event_tie_in"] as const) if (typeof sig[k].base === "number") { sig[k].value = sig[k].base!; sig[k].note = sig[k].note.replace(/ · boosted by .*$/, ""); delete sig[k].base; }
    if (hits.length) {
      for (const k of ["theme_fit", "event_tie_in"] as const) {
        sig[k].base = sig[k].value;
        sig[k].value = Math.min(1, sig[k].value + (k === "event_tie_in" ? 0.5 : 0.15));
        sig[k].note = `${sig[k].note} · boosted by ${hits.length} highlight${hits.length === 1 ? "" : "s"} from "${event.name}"`;
      }
      boosted++;
    }
    const total = (Object.keys(rankingWeights) as SignalId[]).reduce((s, k) => s + rankingWeights[k] * (sig[k]?.value ?? 0), 0);
    db.update(schema.stories).set({ signals: JSON.stringify(sig), scoreTotal: Math.round(total * 10) / 10 }).where(eq(schema.stories.id, st.id)).run();
  }
  // Re-rank the run by the new totals so boosted stories actually move on the Today screen.
  const ranked = db.select({ id: schema.stories.id, score: schema.stories.scoreTotal }).from(schema.stories).where(and(eq(schema.stories.runId, run.id), isNotNull(schema.stories.scoreTotal))).all().sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  db.transaction((tx) => { ranked.forEach((r, i) => tx.update(schema.stories).set({ rank: i + 1 }).where(eq(schema.stories.id, r.id)).run()); });
  return { boosted };
}
