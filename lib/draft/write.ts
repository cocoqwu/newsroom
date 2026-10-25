// Write the full draft in house style from the approved outline and the researched claims.
// Saves version 1 (or the next version on a rewrite).
import { eq, desc } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";
import { generateText } from "@/lib/llm";
import { editorialProfile } from "@/config/editorial-profile";
import { loadDraftContext, touch } from "./context";
import { getResearchNotes } from "./research";

export async function writeDraft(draftId: number, log: (s: string) => void = console.log): Promise<{ version: number; words: number; provider: string }> {
  const ctx = loadDraftContext(draftId);
  const notes = getResearchNotes(draftId);
  const bySection = ctx.outline.map((s) => ({
    heading: s.heading,
    bullets: s.bullets,
    claims: notes.filter((n) => n.section === s.heading).map((n) => `- ${n.claim} [source: ${n.sourceUrl}]`),
  }));
  const primary = ctx.story.items.find((it) => it.id === ctx.story.primaryItemId) ?? ctx.story.items[0];

  const r = await generateText({
    role: "draft",
    task: "write",
    draftId,
    system: `You write for the ${editorialProfile.publication}. Audience: ${editorialProfile.audience.join("; ")}.

House style guide:
${ctx.houseStyle}

Hard rules:
- Markdown only. Start with the first section heading (## ...). No H1, no front matter, no "Introduction" heading.
- Use the approved section headings as H2s, in order.
- Every factual claim (names, numbers, dates, mechanisms) comes from the provided research claims. Link primary sources inline as Markdown links on the relevant phrase, like [GPT-Realtime-2](https://...). Link each source at least once; do not link the same URL more than twice.
- Direct quotes stay under 15 words, in quotation marks, attributed.
- No hype words (groundbreaking, revolutionary, game-changing). No filler. Short paragraphs.
- If a detail is not in the research claims, say so plainly or leave it out. Never invent.
- Event highlights: a claim marked "[direct quote allowed]" may be quoted verbatim from its excerpt (under 15 words, attributed to the speaker). A claim marked "[paraphrase only, no direct quote]" must be paraphrased and attributed as "said" or "argued"; never put it in quotation marks. Cite event sources with their event:// URL as the link target.`,
    prompt: `Write the ${ctx.template.name.toLowerCase()} "${ctx.draft.title}".

Thesis: ${ctx.draft.thesis}
${ctx.draft.angleNote ? `Editor's angle note: ${ctx.draft.angleNote}\n` : ""}Primary source: ${primary?.title} (${primary?.url})
Target length: ${ctx.format === "event-recap" ? "900 to 1,200" : "1,200 to 1,600"} words.

Sections and research claims:
${bySection.map((s) => `## ${s.heading}\nMust establish:\n- ${s.bullets.join("\n- ")}\nResearch claims:\n${s.claims.length ? s.claims.join("\n") : "- (none found; keep this section short and non-specific)"}`).join("\n\n")}

Close the last section with what the reader should build, read or watch next.`,
    temperature: 0.6,
    fallback: () => fallbackDraft(bySection, notes.map((n) => ({ claim: n.claim, url: n.sourceUrl }))),
  });

  const body = r.text.trim().replace(/^```(?:markdown|md)?\s*/i, "").replace(/\s*```$/, "");
  const last = db.select().from(schema.draftVersions).where(eq(schema.draftVersions.draftId, draftId)).orderBy(desc(schema.draftVersions.version)).get();
  const version = (last?.version ?? 0) + 1;
  db.insert(schema.draftVersions).values({ draftId, version, bodyMd: body, note: version === 1 ? "First draft from the approved outline" : "Rewrite from the outline", createdAt: new Date().toISOString() }).run();
  touch(draftId, { bodyMd: body, currentVersion: version, status: "drafted" });
  const words = body.split(/\s+/).length;
  log(`  draft v${version}: ${words} words (${r.provider})`);
  return { version, words, provider: r.provider };
}

function fallbackDraft(sections: { heading: string; bullets: string[]; claims: string[] }[], notes: { claim: string; url: string }[]): string {
  void notes;
  return sections
    .map((s) => `## ${s.heading}\n\n${s.bullets.map((b) => b.replace(/\.$/, "") + ".").join(" ")}\n\n${s.claims.map((c) => c.replace(/^- /, "").replace(/ \[source: (\S+)\]$/, " ([source]($1))")).join("\n\n")}`)
    .join("\n\n");
}

export function saveVersion(draftId: number, bodyMd: string, note: string): number {
  const last = db.select().from(schema.draftVersions).where(eq(schema.draftVersions.draftId, draftId)).orderBy(desc(schema.draftVersions.version)).get();
  const version = (last?.version ?? 0) + 1;
  db.insert(schema.draftVersions).values({ draftId, version, bodyMd, note, createdAt: new Date().toISOString() }).run();
  touch(draftId, { bodyMd, currentVersion: version });
  return version;
}
