import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { TopBar } from "@/components/shell/TopBar";
import { SectionLabel } from "@/components/shell/SectionLabel";
import { Badge } from "@/components/ui/badge";
import { db, schema } from "@/lib/db/client";
import { NewEventForm } from "@/components/events/NewEventForm";

export const dynamic = "force-dynamic";

export default function EventsPage() {
  const events = db.select().from(schema.events).orderBy(desc(schema.events.id)).all();
  const counts = events.map((e) => ({
    sources: db.select().from(schema.eventSources).where(eq(schema.eventSources.eventId, e.id)).all().length,
    highlights: db.select().from(schema.highlights).where(eq(schema.highlights.eventId, e.id)).all(),
  }));
  return (
    <div>
      <TopBar title="Events" />
      <div className="mx-auto max-w-[820px] px-6 py-6">
        <h2 className="text-[26px] font-semibold tracking-[-0.65px]">Event capture</h2>
        <p className="mt-1 text-[14px] text-text-2">Talks, panels and build-day demos become highlight cards that feed posts. Transcripts in, starred highlights out, with each speaker&apos;s quote permission enforced.</p>

        <SectionLabel className="mt-8 mb-3">Events</SectionLabel>
        {events.length === 0 ? <p className="text-[13px] text-text-3">No events yet. Create one below.</p> : (
          <ul className="flex flex-col divide-y divide-fill rounded-lg border border-fill bg-panel">
            {events.map((e, i) => (
              <li key={e.id}>
                <Link href={`/events/${e.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-fill/40">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-[14px] text-text">{e.name}{e.isSample ? <Badge className="bg-rose/15 text-[10px] text-rose">sample · fictional</Badge> : null}</div>
                    <div className="mt-0.5 text-[12px] text-text-3">{e.date ?? "no date"} · {counts[i].sources} source{counts[i].sources === 1 ? "" : "s"} · {counts[i].highlights.length} highlights · {counts[i].highlights.filter((h) => h.status === "starred").length} starred</div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}

        <SectionLabel className="mt-8 mb-3">New event</SectionLabel>
        <NewEventForm />
      </div>
    </div>
  );
}
