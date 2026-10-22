// Step 4: coverage memory. Fetch recent posts from blog.agihouse.org, store a summary and
// embedding for each (novelty and the "covered before" flag), and keep a short house-style guide.
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";
import { editorialProfile } from "@/config/editorial-profile";
import { generateText } from "@/lib/llm";
import { extractArticleText, htmlToText, metaContent, nowIso, pageTitle, truncate } from "@/lib/text";
import { embed } from "./embeddings";
import { fetchWithTimeout } from "./sources";

const BLOG = "https://blog.agihouse.org";

export async function refreshCoverage(runId: number, log: (s: string) => void = console.log, maxPosts = 16): Promise<{ posts: number; fetched: number; styleGuide: "fresh" | "kept" | "fallback" }> {
  let fetched = 0;
  try {
    const home = await (await fetchWithTimeout(BLOG + "/", 20000)).text();
    const slugs = [...new Set([...home.matchAll(/href="(?:https?:\/\/blog\.agihouse\.org)?(\/posts\/[a-z0-9-]+)"/gi)].map((m) => m[1]))].slice(0, maxPosts);
    const existing = new Set(db.select({ url: schema.pastPosts.url }).from(schema.pastPosts).all().map((r) => r.url));
    for (const slug of slugs) {
      const url = BLOG + slug;
      if (existing.has(url)) continue;
      try {
        const html = await (await fetchWithTimeout(url, 20000)).text();
        // The blog's <title> is a generic "Blog Post", so the H1 is the reliable title.
        const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1];
        const title = (h1 ? htmlToText(h1) : "").trim() || (metaContent(html, "og:title") || pageTitle(html) || slug).replace(/\s*[|–-]\s*AGI House.*$/i, "").trim();
        const category = html.match(/class="[^"]*post-category-text[^"]*"[^>]*>([\s\S]*?)<\/(?:div|a)>/i)?.[1];
        const date = metaContent(html, "article:published_time") || html.match(/\b(January|February|March|April|May|June|July|August|September|October|November|December) \d{1,2}, \d{4}\b/)?.[0] || null;
        const text = extractArticleText(html, 6000);
        const summary = truncate(text.replace(/\s+/g, " "), 1200);
        const [vec] = await embed([`${title}. ${summary}`]);
        db.insert(schema.pastPosts)
          .values({ url, title, category: category ? htmlToText(category).trim() : null, publishedAt: date ? new Date(date).toISOString() : null, summary, embedding: JSON.stringify(vec), fetchedAt: nowIso() })
          .onConflictDoNothing()
          .run();
        fetched++;
      } catch (e) {
        log(`  past post ${slug}: ${(e as Error).message.slice(0, 80)}`);
      }
    }
  } catch (e) {
    log(`  blog index unavailable: ${(e as Error).message.slice(0, 100)} (using stored posts)`);
  }
  const posts = db.select().from(schema.pastPosts).all();
  log(`  coverage memory: ${posts.length} past posts (${fetched} fetched now)`);

  // House style guide: refreshed weekly from three recent posts, else kept, else the static notes.
  let styleGuide: "fresh" | "kept" | "fallback" = "kept";
  const current = db.select().from(schema.settings).where(eq(schema.settings.key, "house_style")).get();
  const stale = !current || Date.now() - Date.parse(current.updatedAt) > 7 * 864e5;
  if (stale && posts.length) {
    const samples = posts.slice(0, 3).map((p) => `### ${p.title}\n${truncate(p.summary ?? "", 1500)}`).join("\n\n");
    const r = await generateText({
      role: "draft",
      task: "style-guide",
      runId,
      system: "You are an editor describing a publication's house style for other writers. Be concrete and brief.",
      prompt: `Here are excerpts from three recent posts on the ${editorialProfile.publication}.\n\n${samples}\n\nWrite a house-style guide in Markdown, under 300 words: voice and tone, how posts open, paragraph and heading habits, how sources and numbers are handled, how posts close, and three things to avoid. These notes from the editors also apply:\n- ${editorialProfile.houseStyle.join("\n- ")}`,
      fallback: () => `# House style (static notes)\n\n- ${editorialProfile.houseStyle.join("\n- ")}`,
    });
    db.insert(schema.settings).values({ key: "house_style", value: r.text, updatedAt: nowIso() }).onConflictDoUpdate({ target: schema.settings.key, set: { value: r.text, updatedAt: nowIso() } }).run();
    styleGuide = r.provider === "mock" ? "fallback" : "fresh";
  } else if (!current) {
    const v = `# House style (static notes)\n\n- ${editorialProfile.houseStyle.join("\n- ")}`;
    db.insert(schema.settings).values({ key: "house_style", value: v, updatedAt: nowIso() }).run();
    styleGuide = "fallback";
  }
  return { posts: posts.length, fetched, styleGuide };
}

export function getPastPosts(): { url: string; title: string; embedding: number[] | null }[] {
  return db.select().from(schema.pastPosts).all().map((p) => ({ url: p.url, title: p.title, embedding: p.embedding ? (JSON.parse(p.embedding) as number[]) : null }));
}

export function getHouseStyle(): string {
  return db.select().from(schema.settings).where(eq(schema.settings.key, "house_style")).get()?.value ?? `- ${editorialProfile.houseStyle.join("\n- ")}`;
}
