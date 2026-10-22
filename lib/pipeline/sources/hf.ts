import { truncate } from "@/lib/text";
import type { Adapter, RawItem } from "./types";
import { fetchWithTimeout } from "./types";

// Hugging Face daily papers (public JSON API).
export const hfPapersAdapter: Adapter = async (source) => {
  const res = await fetchWithTimeout(`${source.url}?limit=50`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = (await res.json()) as { paper?: { id: string; title: string; summary?: string; upvotes?: number; publishedAt?: string; authors?: { name?: string }[] }; publishedAt?: string; title?: string }[];
  const out: RawItem[] = [];
  for (const d of data) {
    const p = d.paper;
    if (!p?.id) continue;
    out.push({
      title: (p.title || d.title || "").replace(/\s+/g, " ").trim(),
      url: `https://huggingface.co/papers/${p.id}`,
      summary: truncate((p.summary ?? "").replace(/\s+/g, " ").trim(), 600),
      author: p.authors?.slice(0, 3).map((a) => a.name).filter(Boolean).join(", ") || undefined,
      publishedAt: d.publishedAt || p.publishedAt,
      signals: { upvotes: p.upvotes ?? 0 },
    });
  }
  return out;
};
