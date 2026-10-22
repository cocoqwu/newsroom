import { truncate } from "@/lib/text";
import type { Adapter, RawItem } from "./types";
import { fetchWithTimeout } from "./types";

// "Trending" via the public search API: young repos sorted by stars. Two queries, well under the
// unauthenticated limit of ten searches a minute.
export const githubAdapter: Adapter = async (source) => {
  const since = new Date(Date.now() - 14 * 864e5).toISOString().slice(0, 10);
  const queries = [`llm created:>${since} stars:>40`, `agent AI created:>${since} stars:>40`, `robotics OR "world model" created:>${since} stars:>30`];
  const seen = new Set<string>();
  const out: RawItem[] = [];
  for (const q of queries) {
    const url = `${source.url}?q=${encodeURIComponent(q)}&sort=stars&order=desc&per_page=25`;
    const res = await fetchWithTimeout(url, 20000, { headers: { accept: "application/vnd.github+json" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as { items?: { full_name: string; html_url: string; description?: string; stargazers_count: number; created_at: string; pushed_at: string; owner?: { login: string } }[] };
    for (const r of data.items ?? []) {
      if (seen.has(r.html_url)) continue;
      seen.add(r.html_url);
      out.push({
        title: `${r.full_name}: ${truncate(r.description ?? "", 90)}`.replace(/:\s*$/, ""),
        url: r.html_url,
        summary: truncate(r.description ?? "", 400) || undefined,
        author: r.owner?.login,
        publishedAt: r.pushed_at || r.created_at,
        signals: { stars: r.stargazers_count },
      });
    }
  }
  return out;
};
