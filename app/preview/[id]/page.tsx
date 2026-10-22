import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { BlogPost } from "@/components/blog/BlogPost";
import { db, schema } from "@/lib/db/client";
import { getStory } from "@/lib/db/queries";
import { renderMarkdown } from "@/lib/export/markdown";
import { themeName } from "@/lib/format";

export const dynamic = "force-dynamic";

// Full-page blog preview (white page, black top bar), what the post would look like on blog.agihouse.org.
export default async function PreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const draft = db.select().from(schema.drafts).where(eq(schema.drafts.id, Number(id))).get();
  if (!draft?.bodyMd) notFound();
  const story = getStory(draft.storyId);
  const claims = db.select().from(schema.claims).where(eq(schema.claims.draftId, draft.id)).all();
  const images = db.select().from(schema.images).where(eq(schema.images.draftId, draft.id)).all();
  const hero = images.find((i) => i.id === draft.selectedImageId) ?? images[0];
  const { html, toc } = renderMarkdown(draft.bodyMd, claims);
  return (
    <BlogPost
      title={draft.title ?? story?.title ?? "Untitled"}
      category={themeName(story?.theme)}
      author="Coco Wu"
      date={new Date(draft.updatedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
      heroSvg={hero?.svg}
      heroDataUrl={hero?.dataUrl}
      html={html}
      toc={toc}
      banner={`Preview · v${draft.currentVersion} · not published`}
    />
  );
}
