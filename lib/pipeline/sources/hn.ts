import type { Adapter, RawItem } from "./types";
import { fetchWithTimeout } from "./types";

// Hacker News through the Algolia search API: AI stories with some traction since the cutoff.
export const hnAdapter: Adapter = async (source, sinceIso) => {
  const ts = Math.floor(Date.parse(sinceIso) / 1000);
  const queries = ["AI", "LLM", "agents", "robotics"];
  const seen = new Set<string>();
  const out: RawItem[] = [];
  for (const q of queries) {
    const url = `${source.url}?query=${encodeURIComponent(q)}&tags=story&numericFilters=${encodeURIComponent(`points>25,created_at_i>${ts}`)}&hitsPerPage=40`;
    const res = await fetchWithTimeout(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as { hits?: { objectID: string; title: string; url?: string; points?: number; num_comments?: number; created_at: string; author?: string }[] };
    for (const h of data.hits ?? []) {
      const hnUrl = `https://news.ycombinator.com/item?id=${h.objectID}`;
      const link = h.url || hnUrl;
      if (seen.has(link)) continue;
      seen.add(link);
      out.push({
        title: h.title,
        url: link,
        author: h.author,
        publishedAt: h.created_at,
        signals: { points: h.points ?? 0, comments: h.num_comments ?? 0, hnUrl },
      });
    }
  }
  return out;
};
