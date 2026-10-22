// GET /api/drafts/:id/export?format=md|html  → downloads the post.
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";
import { getStory } from "@/lib/db/queries";
import { renderMarkdown } from "@/lib/export/markdown";
import { toHtmlDocument } from "@/lib/export/html";
import { themeName } from "@/lib/format";
import { slugify } from "@/lib/text";
import { loadDraftContext, logAction } from "@/lib/draft/context";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const draft = db.select().from(schema.drafts).where(eq(schema.drafts.id, Number(id))).get();
  if (!draft?.bodyMd) return new Response("not found", { status: 404 });
  const format = new URL(req.url).searchParams.get("format") === "html" ? "html" : "md";
  const story = getStory(draft.storyId);
  const title = draft.title ?? story?.title ?? "post";
  const date = new Date(draft.updatedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  logAction(draft.id, loadDraftContext(draft.id).story.id, "export", format);
  if (format === "md") {
    const front = `---\ntitle: "${title.replace(/"/g, '\\"')}"\ncategory: "${themeName(story?.theme)}"\nauthor: "Coco Wu"\ndate: "${date}"\nformat: "${draft.format}"\nversion: ${draft.currentVersion}\n---\n\n# ${title}\n\n${draft.thesis ? `*${draft.thesis}*\n\n` : ""}`;
    return new Response(front + draft.bodyMd, { headers: { "content-type": "text/markdown; charset=utf-8", "content-disposition": `attachment; filename="${slugify(title)}.md"` } });
  }
  const images = db.select().from(schema.images).where(eq(schema.images.draftId, draft.id)).all();
  const hero = images.find((i) => i.id === draft.selectedImageId) ?? images[0];
  const { html } = renderMarkdown(draft.bodyMd, []);
  const doc = toHtmlDocument({ title, category: themeName(story?.theme), author: "Coco Wu", date, bodyHtml: html, heroSvg: hero?.svg, heroDataUrl: hero?.dataUrl });
  return new Response(doc, { headers: { "content-type": "text/html; charset=utf-8", "content-disposition": `attachment; filename="${slugify(title)}.html"` } });
}
