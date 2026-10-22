// Step 3: score every story 0-1 on seven signals and combine them into a 0-100 total.
// Theme fit and significance come from a batched LLM judge with a written rubric; the other five
// are computed. Every signal value and its note are stored, not only the total.
import { editorialProfile, type FormatId } from "@/config/editorial-profile";
import { rankingWeights, coveredBeforeThreshold, type SignalId } from "@/config/ranking";
import { generateJSON } from "@/lib/llm";
import { hoursSince, truncate } from "@/lib/text";
import { cosine } from "./embeddings";
import { primaryItem, type Cluster } from "./cluster";

export type Signal = { value: number; note: string };
export type Scored = {
  cluster: Cluster;
  title: string;
  summary: string;
  whyNow: string;
  theme: string;
  format: FormatId;
  signals: Record<SignalId, Signal>;
  total: number;
  coveredBefore: { url: string; title: string; similarity: number } | null;
};

type Judge = { id: number; theme: string; theme_fit: number; significance: number; why_now: string; format: FormatId; headline: string };
type PastPost = { url: string; title: string; embedding: number[] | null };

const clamp01 = (x: number) => Math.max(0, Math.min(1, Number.isFinite(x) ? x : 0));

export async function rankClusters(clusters: Cluster[], pastPosts: PastPost[], runId: number, log: (s: string) => void = console.log): Promise<Scored[]> {
  // 1. LLM judge in batches of 8. Pre-rank by a cheap heuristic so the biggest stories go first if we ever cap calls.
  const judged = new Map<number, Judge>();
  const BATCH = 8;
  const maxCalls = Number(process.env.JUDGE_MAX_CALLS || 12); // free-tier guard: ~96 stories judged, rest heuristic
  const prelim = clusters.map((c, i) => ({ i, h: heuristicScore(c) })).sort((a, b) => b.h - a.h);
  const toJudge = prelim.slice(0, BATCH * maxCalls).map((p) => p.i);
  for (let b = 0; b < toJudge.length; b += BATCH) {
    const idxs = toJudge.slice(b, b + BATCH);
    const res = await generateJSON<{ scores: Judge[] }>({
      role: "triage",
      task: "judge",
      runId,
      system: judgeSystem(),
      prompt: judgePrompt(idxs.map((i) => ({ id: i, c: clusters[i] }))),
      schema: judgeSchema,
      temperature: 0.2,
      fallback: () => ({ scores: idxs.map((i) => heuristicJudge(i, clusters[i])) }),
    });
    for (const s of res.data.scores ?? []) if (typeof s?.id === "number") judged.set(s.id, s);
  }
  log(`  judged ${judged.size} of ${clusters.length} stories with the ${toJudge.length ? "triage model" : "heuristic"}`);

  // 2. Computed signals and the weighted total.
  const scored: Scored[] = clusters.map((c, i) => {
    const j = judged.get(i) ?? heuristicJudge(i, c);
    const p = primaryItem(c);
    const themeWeight = editorialProfile.themes.find((t) => t.id === j.theme)?.weight ?? 0.5;

    // novelty vs past posts
    let maxSim = 0, nearest: PastPost | null = null;
    for (const pp of pastPosts) {
      if (!pp.embedding) continue;
      const s = cosine(c.center, pp.embedding);
      if (s > maxSim) { maxSim = s; nearest = pp; }
    }
    const novelty = clamp01(1 - (maxSim - 0.3) / 0.5);
    const coveredBefore = nearest && maxSim >= coveredBeforeThreshold ? { url: nearest.url, title: nearest.title, similarity: round(maxSim) } : null;

    // momentum from cross-source pickup and public signals
    const sig = c.items.map((it) => safeJson(it.signals));
    const points = Math.max(0, ...sig.map((s) => s.points ?? 0));
    const stars = Math.max(0, ...sig.map((s) => s.stars ?? 0));
    const upvotes = Math.max(0, ...sig.map((s) => s.upvotes ?? 0));
    const distinctSources = new Set(c.items.map((it) => it.sourceId)).size;
    const momentum = clamp01(0.45 * Math.min(1, (distinctSources - 1) / 4) + 0.25 * Math.min(1, Math.log1p(points) / Math.log1p(300)) + 0.15 * Math.min(1, Math.log1p(stars) / Math.log1p(3000)) + 0.15 * Math.min(1, Math.log1p(upvotes) / Math.log1p(100)) + (distinctSources > 1 ? 0.1 : 0));

    // event tie-in from keyword overlap with upcoming events and sponsors
    const text = `${p.title} ${p.summary ?? ""} ${c.items.map((it) => it.title).join(" ")}`.toLowerCase();
    let eventHits = 0, eventName = "";
    for (const ev of editorialProfile.upcomingEvents) {
      const hits = ev.keywords.filter((k) => text.includes(k.toLowerCase())).length;
      if (hits > eventHits) { eventHits = hits; eventName = ev.name; }
    }
    const sponsorHit = editorialProfile.sponsors.some((s) => text.includes(s.toLowerCase()));
    // One generic keyword is weak evidence; two or more means a real tie-in.
    const eventTieIn = clamp01((eventHits >= 2 ? 1 : eventHits === 1 ? 0.4 : 0) + (sponsorHit ? 0.3 : 0));

    const sourceQuality = Math.max(...c.items.map((it) => it.sourceQuality));
    const newestHours = Math.min(...c.items.map((it) => hoursSince(it.publishedAt)));
    const freshness = clamp01(Math.exp((-newestHours / 36) * Math.LN2));

    const signals: Record<SignalId, Signal> = {
      theme_fit: { value: clamp01(j.theme_fit) * themeWeight, note: `${themeName(j.theme)} (judge ${round(j.theme_fit)} × theme weight ${themeWeight})` },
      significance: { value: clamp01(j.significance), note: "judge rubric: does this change what builders should do or believe" },
      novelty: { value: novelty, note: nearest ? `nearest past post ${round(maxSim)} similar: "${truncate(nearest.title, 60)}"` : "no past posts to compare" },
      momentum: { value: momentum, note: `${distinctSources} source${distinctSources === 1 ? "" : "s"}${points ? `, HN ${points} pts` : ""}${stars ? `, ${stars} stars` : ""}${upvotes ? `, ${upvotes} upvotes` : ""}` },
      event_tie_in: { value: eventTieIn, note: eventHits ? `${eventHits} keyword${eventHits === 1 ? "" : "s"} for ${eventName}${sponsorHit ? ", sponsor mention" : ""}` : sponsorHit ? "sponsor mention" : "no upcoming event match" },
      source_quality: { value: sourceQuality, note: `best source: ${p.sourceName}` },
      freshness: { value: freshness, note: `newest item ${newestHours < 1 ? "under an hour" : `${Math.round(newestHours)} h`} ago` },
    };
    const total = (Object.keys(rankingWeights) as SignalId[]).reduce((s, k) => s + rankingWeights[k] * signals[k].value, 0);
    return {
      cluster: c,
      title: (j.headline || p.title).slice(0, 160),
      summary: p.summary ?? "",
      whyNow: j.why_now || "",
      theme: j.theme,
      format: (["technical-primer", "research-brief", "event-recap"] as FormatId[]).includes(j.format) ? j.format : "research-brief",
      signals,
      total: Math.round(total * 10) / 10,
      coveredBefore,
    };
  });
  return scored.sort((a, b) => b.total - a.total);
}

const judgeSchema = {
  type: "object",
  properties: {
    scores: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "integer" },
          theme: { type: "string", enum: [...editorialProfile.themes.map((t) => String(t.id)), "other"] },
          theme_fit: { type: "number" },
          significance: { type: "number" },
          why_now: { type: "string" },
          format: { type: "string", enum: ["technical-primer", "research-brief", "event-recap"] },
          headline: { type: "string" },
        },
        required: ["id", "theme", "theme_fit", "significance", "why_now", "format", "headline"],
      },
    },
  },
  required: ["scores"],
};

function judgeSystem(): string {
  const themes = editorialProfile.themes.map((t) => `- ${t.id}: ${t.name}`).join("\n");
  const formats = Object.entries(editorialProfile.formats).map(([id, f]) => `- ${id}: ${f.when}`).join("\n");
  return `You are the ranking judge for the ${editorialProfile.publication}. Audience: ${editorialProfile.audience.join("; ")}.

Focus themes:
${themes}
- other: none of the above

Rubric for theme_fit (0-1): 1.0 = squarely one of the focus themes and the kind of thing this blog writes primers about; 0.6 = adjacent or a minor angle; 0.2 = general tech news; 0 = unrelated (politics, consumer gadgets, funding gossip).
Rubric for significance (0-1): 1.0 = changes what builders should do or believe this month (new capability, open weights at a new scale, a result that settles a debate); 0.6 = notable incremental progress; 0.3 = routine release or paper; 0.1 = marketing or a reprint. A single arXiv preprint with no pickup elsewhere and no frontier-lab author stays at or below 0.45 unless its result is clearly remarkable.
why_now: one plain sentence, under 25 words, on why this matters this week. No hype.
headline: a clean, specific headline under 90 characters, no clickbait, no trailing source name.
format: pick one:
${formats}`;
}

function judgePrompt(batch: { id: number; c: Cluster }[]): string {
  const blocks = batch.map(({ id, c }) => {
    const p = primaryItem(c);
    const others = c.items.filter((it) => it.id !== p.id).slice(0, 4).map((it) => `   also: ${it.sourceName}: ${truncate(it.title, 90)}`).join("\n");
    return `[id ${id}] ${p.title}\n   source: ${p.sourceName}${p.publishedAt ? ` (${p.publishedAt.slice(0, 10)})` : ""}\n   summary: ${truncate((p.summary ?? "").replace(/\s+/g, " "), 420) || "(none)"}${others ? "\n" + others : ""}`;
  });
  return `Score each story. Return {"scores": [...]} with one entry per id, in order.\n\n${blocks.join("\n\n")}`;
}

// Heuristic stand-ins used when the model is unavailable: keyword theme match and source-based significance.
function heuristicJudge(id: number, c: Cluster): Judge {
  const p = primaryItem(c);
  const text = `${p.title} ${p.summary ?? ""}`.toLowerCase();
  let best = { id: "other", hits: 0 };
  for (const t of editorialProfile.themes) {
    const hits = t.keywords.filter((k) => text.includes(k.toLowerCase())).length;
    if (hits > best.hits) best = { id: t.id, hits };
  }
  const themeFit = best.hits === 0 ? 0.15 : Math.min(1, 0.45 + best.hits * 0.2);
  const significance = Math.min(1, 0.25 + 0.4 * p.sourceQuality + 0.08 * (c.items.length - 1));
  const format: FormatId = /event|hackathon|summit|build day/.test(text) ? "event-recap" : /paper|arxiv|study|benchmark/.test(text) ? "research-brief" : "technical-primer";
  return { id, theme: best.id, theme_fit: themeFit, significance, why_now: "", format, headline: p.title };
}

function heuristicScore(c: Cluster): number {
  const j = heuristicJudge(0, c);
  return j.theme_fit * 2 + j.significance + Math.min(1, (c.items.length - 1) / 3);
}

function themeName(id: string): string {
  return editorialProfile.themes.find((t) => t.id === id)?.name ?? "Other";
}
function safeJson(s: string | null): { points?: number; stars?: number; upvotes?: number } {
  try { return s ? JSON.parse(s) : {}; } catch { return {}; }
}
function round(x: number): number { return Math.round(x * 100) / 100; }
