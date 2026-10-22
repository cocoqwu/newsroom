import Link from "next/link";
import { TopBar } from "@/components/shell/TopBar";
import { SectionLabel } from "@/components/shell/SectionLabel";
import { StoryCard, type CardStory } from "@/components/today/StoryCard";
import { RunSummary } from "@/components/today/RunSummary";
import { RunButton } from "@/components/today/RunButton";
import { getDigest, getLatestRun, getRunCost, parseNotes, type StoryWithItems } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

function toCard(s: StoryWithItems): CardStory {
  return {
    id: s.id, rank: s.rank, isWildcard: s.isWildcard, title: s.title, whyNow: s.whyNow, theme: s.theme, format: s.format,
    scoreTotal: s.scoreTotal, sourceCount: s.sourceCount, status: s.status, draftId: s.draftId, signals: s.parsedSignals, covered: s.parsedCovered,
    items: s.items.map((it) => ({ id: it.id, title: it.title, url: it.url, sourceName: it.sourceName, publishedAt: it.publishedAt, primary: it.id === s.primaryItemId })),
  };
}

export default function TodayPage() {
  const run = getLatestRun();
  const demo = run?.mode === "demo" || process.env.NEWSROOM_MODE === "demo";
  if (!run) {
    return (
      <div>
        <TopBar title="Today" right={<RunButton demo={demo} />} />
        <div className="mx-auto max-w-[820px] px-6 py-16 text-center">
          <div className="text-[15px] text-text">No run yet.</div>
          <p className="mt-2 text-[13px] text-text-2">Run <code className="num">npm run pipeline</code> for a live collection, or <code className="num">npm run demo:load</code> for the saved snapshot, then refresh.</p>
        </div>
      </div>
    );
  }
  const notes = parseNotes(run);
  const cost = getRunCost(run.id);
  const { top, rest } = getDigest(run.id);
  const dateLabel = new Date(run.startedAt).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  return (
    <div>
      <TopBar title="Today" right={<RunButton demo={demo} />} />
      <div className="mx-auto max-w-[820px] px-6 py-6">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="text-[26px] font-semibold tracking-[-0.65px]">{dateLabel}</h2>
            <p className="mt-1 text-[14px] text-text-2">Top stories from the last {notes.lookbackHours ?? 72} hours, ranked for the AGI House blog. Pick one to start a draft.</p>
          </div>
          {demo ? <span className="rounded-full border border-rose/40 px-3 py-1 text-[11px] uppercase tracking-wide text-rose">Demo snapshot</span> : null}
        </div>

        <SectionLabel className="mt-8 mb-3">Run summary</SectionLabel>
        <RunSummary run={run} notes={notes} cost={cost} />

        <SectionLabel className="mt-8 mb-3">Top 10 · slot 10 is the wildcard</SectionLabel>
        <div className="flex flex-col gap-3">
          {top.map((s, i) => (
            <StoryCard key={s.id} story={toCard(s)} slot={i + 1} />
          ))}
        </div>

        {rest.length ? (
          <details className="group mt-8">
            <summary className="section-label cursor-pointer list-none">More stories ({rest.length}) · click to expand</summary>
            <ul className="mt-3 flex flex-col divide-y divide-fill rounded-lg border border-fill bg-panel">
              {rest.map((s) => (
                <li key={s.id} className="flex items-center gap-3 px-4 py-2 text-[13px]">
                  <span className="num w-8 text-text-3">{s.rank}</span>
                  <span className="num w-8 text-text-2">{Math.round(s.scoreTotal ?? 0)}</span>
                  <span className="min-w-0 flex-1 truncate text-text-2">{s.title}</span>
                  <span className="shrink-0 text-[11px] text-text-3">{s.sourceCount} src</span>
                  {s.draftId ? <Link href={`/draft/${s.draftId}`} className="text-[11px] text-text hover:underline">draft</Link> : null}
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </div>
    </div>
  );
}
