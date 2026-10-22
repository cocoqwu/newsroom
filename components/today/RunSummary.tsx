import { ChevronDown } from "lucide-react";
import type { Run, RunNotes } from "@/lib/db/queries";
import { fmtDateTime, money, timeAgo } from "@/lib/format";

// "When collection ran, items collected, stories after clustering, and the cost of the run."
export function RunSummary({ run, notes, cost }: { run: Run; notes: RunNotes; cost: { calls: number; tokensIn: number; tokensOut: number; costUsd: number; byProvider: Record<string, number> } }) {
  const srcs = notes.sources ?? [];
  const ok = srcs.filter((s) => s.ok).length;
  const durationS = run.finishedAt ? Math.round((Date.parse(run.finishedAt) - Date.parse(run.startedAt)) / 1000) : null;
  const stats: [string, string, string?][] = [
    ["Collected", timeAgo(run.startedAt), fmtDateTime(run.startedAt)],
    ["Items", String(run.itemsCollected), `last ${notes.lookbackHours ?? 72} h, ${ok}/${srcs.length} sources`],
    ["Stories", String(run.storiesCount), notes.cluster ? `${notes.cluster.merged} merged by model check` : undefined],
    ["Model calls", String(cost.calls), `${(cost.tokensIn + cost.tokensOut).toLocaleString()} tokens`],
    ["Run cost", money(cost.costUsd), run.mode === "demo" ? "demo snapshot" : "list price · free tier bills $0"],
  ];
  return (
    <div className="rounded-lg border border-fill bg-panel">
      <div className="grid grid-cols-5 divide-x divide-fill">
        {stats.map(([label, value, sub]) => (
          <div key={label} className="px-4 py-3">
            <div className="section-label">{label}</div>
            <div className="num mt-1 text-[18px] font-semibold leading-6">{value}</div>
            {sub ? <div className="mt-0.5 truncate text-[11px] text-text-3" title={sub}>{sub}</div> : null}
          </div>
        ))}
      </div>
      <details className="group border-t border-fill">
        <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-2 text-[12px] text-text-3 hover:text-text">
          <span>Sources{durationS !== null ? ` · run took ${durationS} s` : ""}{notes.embeddingBackend ? ` · embeddings: ${notes.embeddingBackend === "minilm" ? "MiniLM (local)" : "TF-IDF fallback"}` : ""}{notes.coverage ? ` · ${notes.coverage.posts} past posts in memory` : ""}</span>
          <ChevronDown className="size-3.5 transition-transform group-open:rotate-180" />
        </summary>
        <ul className="grid grid-cols-2 gap-x-6 gap-y-1 px-4 pb-3 text-[12px]">
          {srcs.map((s) => (
            <li key={s.sourceId} className="flex items-center justify-between gap-2">
              <span className={s.ok ? "text-text-2" : "text-text-3"}>{s.name}</span>
              <span className="num shrink-0 text-text-3">{s.ok ? `${s.kept} in window · ${s.inserted} new` : <span className="text-rose/80" title={s.error}>{s.error?.startsWith("skipped") ? "no feed" : "failed"}</span>}</span>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
