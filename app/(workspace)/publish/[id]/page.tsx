import { notFound } from "next/navigation";
import { eq, and, desc } from "drizzle-orm";
import { TopBar } from "@/components/shell/TopBar";
import { PublishPanel } from "@/components/publish/PublishPanel";
import { db, schema } from "@/lib/db/client";
import { getStory } from "@/lib/db/queries";
import { renderMarkdown, wordCount } from "@/lib/export/markdown";
import { webflowPayload } from "@/lib/export/webflow";
import { themeName } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function PublishPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const draft = db.select().from(schema.drafts).where(eq(schema.drafts.id, Number(id))).get();
  if (!draft?.bodyMd) notFound();
  const story = getStory(draft.storyId);
  const claims = db.select().from(schema.claims).where(eq(schema.claims.draftId, draft.id)).all();
  const images = db.select().from(schema.images).where(eq(schema.images.draftId, draft.id)).all();
  const hero = images.find((i) => i.id === draft.selectedImageId) ?? images[0];
  const { html } = renderMarkdown(draft.bodyMd, []);
  const title = draft.title ?? story?.title ?? "Untitled";
  const date = new Date(draft.updatedAt).toISOString().slice(0, 10);
  const payload = webflowPayload({ title, summary: draft.thesis ?? "", bodyHtml: html, category: themeName(story?.theme), author: "Coco Wu", date, heroHint: hero ? `${hero.kind} "${hero.label}"` : "none selected" });
  const lastSend = db.select().from(schema.editorActions).where(and(eq(schema.editorActions.draftId, draft.id), eq(schema.editorActions.action, "publish_mock"))).orderBy(desc(schema.editorActions.id)).get();
  let snippets = null;
  try { snippets = draft.snippets ? JSON.parse(draft.snippets) : null; } catch { snippets = null; }
  return (
    <div>
      <TopBar title="Publish" />
      <PublishPanel
        draftId={draft.id}
        title={title}
        words={wordCount(draft.bodyMd)}
        version={draft.currentVersion}
        claimCounts={{ verified: claims.filter((c) => c.status === "verified").length, corrected: claims.filter((c) => c.status === "corrected").length, unverified: claims.filter((c) => c.status === "unverified").length }}
        payload={payload}
        snippets={snippets}
        lastMockSend={lastSend?.createdAt ?? null}
        demo={process.env.NEWSROOM_MODE === "demo"}
      />
    </div>
  );
}
