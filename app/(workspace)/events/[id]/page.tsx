import { notFound } from "next/navigation";
import { eq, asc } from "drizzle-orm";
import { TopBar } from "@/components/shell/TopBar";
import { db, schema } from "@/lib/db/client";
import { EventWorkspace } from "@/components/events/EventWorkspace";
import { listDraftOptions } from "@/lib/events/attach";
import { themeName } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const eventId = Number(id);
  const event = db.select().from(schema.events).where(eq(schema.events.id, eventId)).get();
  if (!event) notFound();
  const speakers = db.select().from(schema.speakers).where(eq(schema.speakers.eventId, eventId)).orderBy(asc(schema.speakers.id)).all();
  const sources = db.select().from(schema.eventSources).where(eq(schema.eventSources.eventId, eventId)).orderBy(asc(schema.eventSources.id)).all();
  const hl = db.select().from(schema.highlights).where(eq(schema.highlights.eventId, eventId)).orderBy(asc(schema.highlights.id)).all();
  return (
    <div>
      <TopBar title="Events" />
      <EventWorkspace
        event={{ id: event.id, name: event.name, date: event.date, description: event.description, isSample: event.isSample }}
        speakers={speakers.map((s) => ({ id: s.id, name: s.name, title: s.title, permission: s.permission }))}
        sources={sources.map((s) => ({ id: s.id, kind: s.kind, label: s.label, status: s.status, note: s.note, sizeBytes: s.sizeBytes, transcriptChars: s.transcript?.length ?? 0, transcriptPreview: (s.transcript ?? "").slice(0, 1200) }))}
        highlights={hl.map((h) => ({ id: h.id, sourceId: h.sourceId, speakerId: h.speakerId, speakerName: h.speakerName, timestamp: h.timestamp, type: h.type, quote: h.quote, paraphrase: h.paraphrase, tags: JSON.parse(h.tags ?? "[]") as string[], tagNames: (JSON.parse(h.tags ?? "[]") as string[]).map(themeName), status: h.status, edited: h.edited }))}
        drafts={listDraftOptions()}
        demo={process.env.NEWSROOM_MODE === "demo"}
      />
    </div>
  );
}
