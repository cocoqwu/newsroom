import { notFound } from "next/navigation";
import { eq, asc } from "drizzle-orm";
import { TopBar } from "@/components/shell/TopBar";
import { DraftWorkspace } from "@/components/draft/DraftWorkspace";
import { db, schema } from "@/lib/db/client";
import { getStory } from "@/lib/db/queries";
import { renderMarkdown, wordCount } from "@/lib/export/markdown";
import { themeName } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function DraftPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const draftId = Number(id);
  const draft = db.select().from(schema.drafts).where(eq(schema.drafts.id, draftId)).get();
  if (!draft) notFound();
  const story = getStory(draft.storyId);
  if (!story) notFound();
  const claims = db.select().from(schema.claims).where(eq(schema.claims.draftId, draftId)).all();
  const images = db.select().from(schema.images).where(eq(schema.images.draftId, draftId)).all();
  const versions = db.select().from(schema.draftVersions).where(eq(schema.draftVersions.draftId, draftId)).orderBy(asc(schema.draftVersions.version)).all();
  const notes = db.select().from(schema.researchNotes).where(eq(schema.researchNotes.draftId, draftId)).all();
  const researchCount = notes.length;
  const eventEvidence = notes.filter((n) => n.sourceUrl.startsWith("event://")).map((n) => { const m = n.sourceUrl.match(/^event:\/\/(\d+)\/source\/\d+\/highlight\/(\d+)(?:#t=(.+))?$/); return { id: n.id, claim: n.claim, excerpt: n.excerpt, eventId: m ? Number(m[1]) : 0, highlightId: m ? Number(m[2]) : 0, timestamp: m?.[3] ?? null }; });
  const rendered = draft.bodyMd ? renderMarkdown(draft.bodyMd, claims) : { html: "", toc: [] };
  let outline: { heading: string; bullets: string[] }[] = [];
  try { outline = draft.outline ? JSON.parse(draft.outline) : []; } catch { outline = []; }
  const dateLabel = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  return (
    <div>
      <TopBar title="Draft" />
      <DraftWorkspace
        draft={{ id: draft.id, status: draft.status, format: draft.format, angleNote: draft.angleNote, title: draft.title, thesis: draft.thesis, outline, bodyMd: draft.bodyMd, currentVersion: draft.currentVersion, selectedImageId: draft.selectedImageId }}
        story={{ id: story.id, title: story.title, whyNow: story.whyNow, theme: story.theme, themeName: themeName(story.theme), sources: story.items.map((it) => ({ title: it.title, url: it.url, sourceName: it.sourceName })) }}
        rendered={{ ...rendered, words: draft.bodyMd ? wordCount(draft.bodyMd) : 0 }}
        claims={claims.map((c) => ({ id: c.id, text: c.text, kind: c.kind, status: c.status, sourceUrl: c.sourceUrl, correction: c.correction, note: c.note }))}
        images={images.map((i) => ({ id: i.id, kind: i.kind, label: i.label, svg: i.svg, dataUrl: i.dataUrl, status: i.status, note: i.note }))}
        versions={versions.map((v) => ({ version: v.version, note: v.note, createdAt: v.createdAt, words: wordCount(v.bodyMd) })).reverse()}
        researchCount={researchCount}
        eventEvidence={eventEvidence}
        dateLabel={dateLabel}
        demo={process.env.NEWSROOM_MODE === "demo"}
      />
    </div>
  );
}
