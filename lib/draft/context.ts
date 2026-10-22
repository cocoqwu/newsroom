// Loads everything the draft steps need about one draft: the story, its sources, the format
// template, the house style guide and the editor's angle note.
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";
import { editorialProfile, type FormatId } from "@/config/editorial-profile";
import { getHouseStyle } from "@/lib/pipeline/coverage";
import { getStory, type StoryWithItems } from "@/lib/db/queries";

export type Draft = typeof schema.drafts.$inferSelect;
export type OutlineSection = { heading: string; bullets: string[] };
export type Outline = OutlineSection[];

export type DraftContext = {
  draft: Draft;
  story: StoryWithItems;
  format: FormatId;
  template: { name: string; when: string; sections: readonly string[] };
  houseStyle: string;
  outline: Outline;
};

export function loadDraftContext(draftId: number): DraftContext {
  const draft = db.select().from(schema.drafts).where(eq(schema.drafts.id, draftId)).get();
  if (!draft) throw new Error(`draft ${draftId} not found`);
  const story = getStory(draft.storyId);
  if (!story) throw new Error(`story ${draft.storyId} not found`);
  const format = (draft.format in editorialProfile.formats ? draft.format : "research-brief") as FormatId;
  const template = editorialProfile.formats[format];
  let outline: Outline = [];
  try { outline = draft.outline ? (JSON.parse(draft.outline) as Outline) : []; } catch { outline = []; }
  return { draft, story, format, template, houseStyle: getHouseStyle(), outline };
}

export function sourceList(story: StoryWithItems, max = 8): string {
  return story.items
    .slice(0, max)
    .map((it, i) => `${i + 1}. ${it.title}\n   ${it.url}\n   ${it.sourceName}${it.publishedAt ? `, ${it.publishedAt.slice(0, 10)}` : ""}${it.summary ? `\n   ${it.summary.slice(0, 350)}` : ""}`)
    .join("\n");
}

export function touch(draftId: number, patch: Partial<typeof schema.drafts.$inferInsert>) {
  db.update(schema.drafts).set({ ...patch, updatedAt: new Date().toISOString() }).where(eq(schema.drafts.id, draftId)).run();
}

export function logAction(draftId: number, storyId: number, action: string, note?: string) {
  db.insert(schema.editorActions).values({ draftId, storyId, action, note: note ?? null, createdAt: new Date().toISOString() }).run();
}
