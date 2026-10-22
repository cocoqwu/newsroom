import Parser from "rss-parser";
import { truncate } from "@/lib/text";
import type { Adapter, RawItem } from "./types";
import { fetchWithTimeout } from "./types";

// arXiv Atom API, one request per run (their guideline is one request every three seconds).
const parser = new Parser({ customFields: { item: ["published", "summary"] } });

export const arxivAdapter: Adapter = async (source) => {
  const q = "cat:cs.AI OR cat:cs.LG OR cat:cs.CL OR cat:cs.CV OR cat:cs.RO";
  const url = `${source.url}?search_query=${encodeURIComponent(q)}&sortBy=submittedDate&sortOrder=descending&max_results=80`;
  const res = await fetchWithTimeout(url, 25000);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const feed = await parser.parseString(await res.text());
  const out: RawItem[] = [];
  for (const it of feed.items ?? []) {
    const link = (it.link || (it as { id?: string }).id || "").replace(/^http:/, "https:").replace(/v\d+$/, "");
    if (!link || !it.title) continue;
    const extra = it as unknown as { published?: string; summary?: string; author?: string | { name?: string }[] };
    out.push({
      title: it.title.replace(/\s+/g, " ").trim(),
      url: link.replace("/abs/", "/abs/"),
      summary: truncate(String(extra.summary ?? it.contentSnippet ?? "").replace(/\s+/g, " ").trim(), 600),
      author: typeof extra.author === "string" ? extra.author : undefined,
      publishedAt: extra.published || it.isoDate,
    });
  }
  return out;
};
