import Parser from "rss-parser";
import { htmlToText, truncate } from "@/lib/text";
import type { Adapter, RawItem } from "./types";
import { fetchWithTimeout } from "./types";

// We fetch the feed text ourselves (consistent user agent, timeout, redirects) and let rss-parser
// parse the string. Some feeds fail through parser.parseURL but parse fine this way.
const parser = new Parser({ timeout: 20000 });

export const rssAdapter: Adapter = async (source) => {
  const res = await fetchWithTimeout(source.url, 20000, { headers: { accept: "application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.8" } });
  if (!res.ok) throw new Error(`Status code ${res.status}`);
  const text = (await res.text()).replace(/^﻿/, "");
  const feed = await parser.parseString(text.slice(Math.max(0, text.indexOf("<"))));
  const out: RawItem[] = [];
  for (const it of feed.items ?? []) {
    if (!it.link || !it.title) continue;
    const raw = it.contentSnippet || it.summary || it.content || "";
    out.push({
      title: it.title.replace(/\s+/g, " ").trim(),
      url: it.link,
      summary: truncate(htmlToText(String(raw)), 600) || undefined,
      author: (it.creator || it.author || undefined) as string | undefined,
      publishedAt: it.isoDate || (it.pubDate ? new Date(it.pubDate).toISOString() : undefined),
    });
  }
  return out;
};
