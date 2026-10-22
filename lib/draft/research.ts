// Research by outline section, in parallel: fetch each source page once, then ask the triage
// model to pull the claims each section needs, each with its source URL and a short excerpt.
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";
import { generateJSON } from "@/lib/llm";
import { extractArticleText, truncate } from "@/lib/text";
import { fetchWithTimeout } from "@/lib/pipeline/sources";
import { loadDraftContext, touch } from "./context";

export type ResearchClaim = { claim: string; sourceUrl: string; excerpt: string };
type SourceText = { url: string; title: string; sourceName: string; text: string };

export async function researchDraft(draftId: number, log: (s: string) => void = console.log): Promise<{ sections: number; claims: number; pagesFetched: number }> {
  const ctx = loadDraftContext(draftId);
  touch(draftId, { status: "drafting" });
  db.delete(schema.researchNotes).where(eq(schema.researchNotes.draftId, draftId)).run();

  // 1. Fetch source pages (up to 8), in parallel, each with a timeout. Failures fall back to the stored summary.
  const sources: SourceText[] = await Promise.all(
    ctx.story.items.slice(0, 8).map(async (it) => {
      try {
        const res = await fetchWithTimeout(it.url, 15000, { headers: { accept: "text/html,application/xhtml+xml" } });
        const type = res.headers.get("content-type") ?? "";
        if (!res.ok || !/html|xml|text/.test(type)) throw new Error(`HTTP ${res.status} ${type}`);
        const text = extractArticleText(await res.text(), 7000);
        return { url: it.url, title: it.title, sourceName: it.sourceName, text: text.length > 300 ? text : (it.summary ?? text) };
      } catch (e) {
        log(`  source ${it.url}: ${(e as Error).message.slice(0, 80)}; using summary`);
        return { url: it.url, title: it.title, sourceName: it.sourceName, text: it.summary ?? it.title };
      }
    })
  );
  const pagesFetched = sources.filter((s) => s.text.length > 300).length;
  const corpus = sources.map((s, i) => `[S${i + 1}] ${s.title} (${s.sourceName})\nURL: ${s.url}\n${truncate(s.text, Math.floor(14000 / sources.length))}`).join("\n\n");

  // 2. One claim-extraction call per section, run concurrently (the provider spaces them out).
  const results = await Promise.all(
    ctx.outline.map((section) =>
      generateJSON<{ claims: ResearchClaim[] }>({
        role: "triage",
        task: "research",
        draftId,
        system: "You are a research assistant for a technical blog. You only report facts that appear in the provided sources. Every claim must cite the URL of the source it came from and quote a short excerpt (under 25 words) that supports it. Never invent numbers, names or dates.",
        prompt: `Post: ${ctx.draft.title}\nThesis: ${ctx.draft.thesis}\n\nSection: ${section.heading}\nThis section must establish:\n- ${section.bullets.join("\n- ")}\n\nSources:\n${corpus}\n\nReturn JSON {"claims": [{"claim": "...", "sourceUrl": "...", "excerpt": "..."}]} with 3 to 7 specific, checkable claims (names, numbers, dates, mechanisms) useful for this section. Use only the sources above.`,
        schema: { type: "object", properties: { claims: { type: "array", items: { type: "object", properties: { claim: { type: "string" }, sourceUrl: { type: "string" }, excerpt: { type: "string" } }, required: ["claim", "sourceUrl", "excerpt"] } } }, required: ["claims"] },
        temperature: 0.1,
        fallback: () => ({ claims: sources.slice(0, 3).map((s) => ({ claim: truncate(s.text.replace(/\s+/g, " "), 180), sourceUrl: s.url, excerpt: truncate(s.text.replace(/\s+/g, " "), 120) })) }),
      }).then((r) => ({ section: section.heading, claims: (r.data.claims ?? []).filter((c) => c?.claim && c?.sourceUrl) }))
    )
  );

  let count = 0;
  for (const r of results) {
    for (const c of r.claims.slice(0, 8)) {
      db.insert(schema.researchNotes).values({ draftId, section: r.section, claim: c.claim.slice(0, 400), sourceUrl: c.sourceUrl.slice(0, 500), excerpt: (c.excerpt ?? "").slice(0, 300) }).run();
      count++;
    }
  }
  log(`  research: ${count} claims across ${results.length} sections from ${pagesFetched} fetched pages`);
  return { sections: results.length, claims: count, pagesFetched };
}

export function getResearchNotes(draftId: number) {
  return db.select().from(schema.researchNotes).where(eq(schema.researchNotes.draftId, draftId)).all();
}
