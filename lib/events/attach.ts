// Starred highlights become cited evidence in a draft (research notes with an event:// source URL
// that points at the transcript timestamp), or start a new event-recap draft through the usual
// outline-approval flow. Consent is enforced here: only approved speakers contribute quotes,
// off-the-record speakers contribute nothing.
import { and, eq, desc } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";
import { canQuote, canUse } from "./consent";
import { nowIso } from "@/lib/text";

export function eventSourceUrl(eventId: number, sourceId: number, highlightId: number, timestamp: string | null): string {
  return `event://${eventId}/source/${sourceId}/highlight/${highlightId}${timestamp ? `#t=${timestamp}` : ""}`;
}

export function parseEventUrl(url: string): { eventId: number; sourceId: number; highlightId: number; timestamp: string | null } | null {
  const m = url.match(/^event:\/\/(\d+)\/source\/(\d+)\/highlight\/(\d+)(?:#t=(.+))?$/);
  return m ? { eventId: Number(m[1]), sourceId: Number(m[2]), highlightId: Number(m[3]), timestamp: m[4] ?? null } : null;
}

type Starred = { highlight: typeof schema.highlights.$inferSelect; permission: string; speakerName: string; eventName: string };

export function starredHighlights(eventId: number): Starred[] {
  const event = db.select().from(schema.events).where(eq(schema.events.id, eventId)).get();
  if (!event) throw new Error("event not found");
  const spk = new Map(db.select().from(schema.speakers).where(eq(schema.speakers.eventId, eventId)).all().map((s) => [s.id, s]));
  return db.select().from(schema.highlights).where(and(eq(schema.highlights.eventId, eventId), eq(schema.highlights.status, "starred"))).all().map((h) => {
    const s = h.speakerId ? spk.get(h.speakerId) : undefined;
    return { highlight: h, permission: s?.permission ?? "paraphrase", speakerName: s?.name ?? h.speakerName ?? "Speaker", eventName: event.name };
  });
}

// Write evidence rows for a draft. Returns how many were added and how many were held back.
export function attachToDraft(eventId: number, draftId: number, section = "Event evidence"): { added: number; quotes: number; heldBack: number } {
  const draft = db.select().from(schema.drafts).where(eq(schema.drafts.id, draftId)).get();
  if (!draft) throw new Error("draft not found");
  let added = 0, quotes = 0, heldBack = 0;
  for (const s of starredHighlights(eventId)) {
    if (!canUse(s.permission)) { heldBack++; continue; }
    const url = eventSourceUrl(eventId, s.highlight.sourceId, s.highlight.id, s.highlight.timestamp);
    const exists = db.select({ id: schema.researchNotes.id }).from(schema.researchNotes).where(and(eq(schema.researchNotes.draftId, draftId), eq(schema.researchNotes.sourceUrl, url))).get();
    if (exists) continue;
    const quoteOk = canQuote(s.permission);
    const claim = `${s.speakerName} (${s.eventName}${s.highlight.timestamp ? `, ${s.highlight.timestamp}` : ""}): ${s.highlight.paraphrase}${quoteOk ? " [direct quote allowed]" : " [paraphrase only, no direct quote]"}`;
    db.insert(schema.researchNotes).values({ draftId, section, claim, sourceUrl: url, excerpt: quoteOk ? s.highlight.quote : `(paraphrase only) ${s.highlight.paraphrase}` }).run();
    db.insert(schema.editorActions).values({ draftId, storyId: draft.storyId, action: "attach_highlight", note: `highlight ${s.highlight.id}`, createdAt: nowIso() }).run();
    added++;
    if (quoteOk) quotes++;
  }
  return { added, quotes, heldBack };
}

// A new event-recap draft: a synthetic story row for the event, a draft in "outline" status, and
// the starred highlights pre-attached as evidence so the outline and the draft build on them.
export function startRecapDraft(eventId: number): { draftId: number; storyId: number; attached: number } {
  const event = db.select().from(schema.events).where(eq(schema.events.id, eventId)).get();
  if (!event) throw new Error("event not found");
  const starred = starredHighlights(eventId);
  if (!starred.length) throw new Error("star at least one highlight first");
  const run = db.select().from(schema.runs).orderBy(desc(schema.runs.id)).get();
  const tagCounts = new Map<string, number>();
  for (const s of starred) for (const t of JSON.parse(s.highlight.tags ?? "[]") as string[]) tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
  const theme = [...tagCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "other";
  const now = nowIso();
  const story = db.insert(schema.stories).values({
    runId: run?.id ?? 0, rank: null, isWildcard: false, title: `${event.name}: what we learned`, summary: event.description ?? `Recap of ${event.name}`,
    whyNow: `Recap of an AGI House event${event.date ? ` on ${event.date}` : ""}, from ${starred.length} starred highlights.`, theme, format: "event-recap", primaryItemId: null,
    sourceCount: 0, scoreTotal: null, signals: null, coveredBefore: null, embedding: null, status: "picked",
  }).returning().get();
  const draft = db.insert(schema.drafts).values({ storyId: story.id, status: "outline", format: "event-recap", angleNote: `Event recap of ${event.name}. Build on the attached highlights; respect each speaker's quote permission.`, createdAt: now, updatedAt: now }).returning().get();
  const { added } = attachToDraft(eventId, draft.id, "Event highlights");
  db.insert(schema.editorActions).values({ draftId: draft.id, storyId: story.id, action: "start_recap", note: event.name, createdAt: now }).run();
  return { draftId: draft.id, storyId: story.id, attached: added };
}

export function listDraftOptions() {
  const rows = db.select().from(schema.drafts).orderBy(desc(schema.drafts.updatedAt)).all();
  const titles = new Map(db.select({ id: schema.stories.id, title: schema.stories.title }).from(schema.stories).all().map((s) => [s.id, s.title]));
  return rows.map((d) => ({ id: d.id, title: d.title ?? titles.get(d.storyId) ?? `Draft ${d.id}`, status: d.status }));
}
