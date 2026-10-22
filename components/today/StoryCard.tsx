"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ExternalLink, Sparkles, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { rankingWeights, signalDescriptions, type SignalId } from "@/config/ranking";
import { formatName, formatOptions, hostname, themeName, timeAgo } from "@/lib/format";

export type CardStory = {
  id: number;
  rank: number | null;
  isWildcard: boolean;
  title: string;
  whyNow: string | null;
  theme: string | null;
  format: string | null;
  scoreTotal: number | null;
  sourceCount: number;
  status: string;
  draftId: number | null;
  signals: Record<SignalId, { value: number; note: string }> | null;
  covered: { url: string; title: string; similarity: number } | null;
  items: { id: number; title: string; url: string; sourceName: string; publishedAt: string | null; primary: boolean }[];
};

const signalLabels: Record<SignalId, string> = {
  theme_fit: "Theme fit", significance: "Significance", novelty: "Novelty", momentum: "Momentum",
  event_tie_in: "Event tie-in", source_quality: "Source quality", freshness: "Freshness",
};

export function StoryCard({ story, slot }: { story: CardStory; slot: number }) {
  const router = useRouter();
  const [open, setOpen] = useState<"none" | "score" | "sources" | "pick">("none");
  const [format, setFormat] = useState(story.format ?? "research-brief");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function act(action: "pick" | "skip" | "save" | "unskip") {
    setBusy(action);
    setError(null);
    try {
      const res = await fetch(`/api/stories/${story.id}/action`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(action === "pick" ? { action, format, note } : { action }),
      });
      const data = (await res.json()) as { ok?: boolean; draftId?: number; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error || `HTTP ${res.status}`);
      if (action === "pick" && data.draftId) router.push(`/draft/${data.draftId}`);
      else router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const score = Math.round(story.scoreTotal ?? 0);
  const skipped = story.status === "skipped";
  const toggle = (k: typeof open) => setOpen(open === k ? "none" : k);

  return (
    <article className={`rounded-lg border border-fill bg-panel transition-opacity ${skipped ? "opacity-50" : ""}`}>
      <div className="flex gap-4 p-4">
        {/* rank + score */}
        <div className="w-12 shrink-0 text-center">
          <div className={`text-[10px] font-semibold uppercase tracking-[0.5px] ${story.isWildcard ? "text-rose" : "text-text-3"}`}>{story.isWildcard ? "wild" : "rank"}</div>
          <div className="num text-[22px] font-semibold leading-7">{story.isWildcard ? "★" : slot}</div>
          <button onClick={() => toggle("score")} className="num mt-0.5 rounded-full bg-fill px-2 py-0.5 text-[11px] text-text-2 hover:text-text" title="Score breakdown">
            {score}
          </button>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <h3 className="text-[15px] font-semibold leading-5 text-text">{story.title}</h3>
          </div>
          {story.whyNow ? <p className="mt-1 text-[13px] leading-5 text-text-2">{story.whyNow}</p> : null}

          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-text-3">
            <button onClick={() => toggle("sources")} className="hover:text-text">
              {story.sourceCount} source{story.sourceCount === 1 ? "" : "s"}
            </button>
            <span>·</span>
            <Badge variant="secondary" className="h-[18px] text-[11px]">{formatName(story.format)}</Badge>
            <span>·</span>
            <span>{themeName(story.theme)}</span>
            {story.isWildcard ? (<><span>·</span><Badge className="h-[18px] bg-rose/15 text-[11px] text-rose">wildcard · ranked #{story.rank}</Badge></>) : null}
            {story.covered ? (
              <>
                <span>·</span>
                <a href={story.covered.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-corrected hover:underline" title={`${Math.round(story.covered.similarity * 100)}% similar: ${story.covered.title}`}>
                  <History className="size-3" /> covered before
                </a>
              </>
            ) : (
              <><span>·</span><span>not covered before</span></>
            )}
            {story.status !== "new" ? (<><span>·</span><span className="uppercase tracking-wide">{story.status}</span></>) : null}
          </div>

          {/* expandable: score breakdown */}
          {open === "score" && story.signals ? (
            <div className="mt-3 rounded-md border border-fill bg-page/60 p-3">
              <div className="section-label mb-2">Score breakdown · {story.scoreTotal} / 100</div>
              <table className="w-full text-[12px]">
                <tbody>
                  {(Object.keys(rankingWeights) as SignalId[]).map((k) => {
                    const s = story.signals![k];
                    const contrib = rankingWeights[k] * (s?.value ?? 0);
                    return (
                      <tr key={k} className="align-top">
                        <td className="w-28 py-1 pr-2 text-text-2" title={signalDescriptions[k]}>{signalLabels[k]}</td>
                        <td className="w-24 py-1 pr-2">
                          <div className="h-1.5 w-full rounded-full bg-fill"><div className="h-1.5 rounded-full bg-text-2" style={{ width: `${Math.round((s?.value ?? 0) * 100)}%` }} /></div>
                        </td>
                        <td className="num w-14 py-1 pr-2 text-right text-text-2">{(s?.value ?? 0).toFixed(2)}</td>
                        <td className="num w-12 py-1 pr-2 text-right text-text-3">× {rankingWeights[k]}</td>
                        <td className="num w-12 py-1 pr-2 text-right text-text">{contrib.toFixed(1)}</td>
                        <td className="py-1 text-text-3">{s?.note}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null}

          {/* expandable: sources */}
          {open === "sources" ? (
            <ul className="mt-3 flex flex-col gap-1.5 rounded-md border border-fill bg-page/60 p-3 text-[12px]">
              {story.items.map((it) => (
                <li key={it.id} className="flex items-start gap-2">
                  <ExternalLink className="mt-0.5 size-3 shrink-0 text-text-3" />
                  <a href={it.url} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate text-text-2 hover:text-text" title={it.title}>{it.title}</a>
                  <span className="shrink-0 text-text-3">{it.primary ? "primary · " : ""}{it.sourceName.replace(/ \(.*\)$/, "")} · {hostname(it.url)} · {timeAgo(it.publishedAt)}</span>
                </li>
              ))}
            </ul>
          ) : null}

          {/* pick form */}
          {open === "pick" ? (
            <div className="mt-3 rounded-md border border-fill bg-page/60 p-3">
              <div className="section-label mb-2">Format</div>
              <div className="flex flex-wrap gap-1.5">
                {formatOptions.map((f) => (
                  <button key={f.id} onClick={() => setFormat(f.id)} title={f.when} className={`rounded-full border px-3 py-1 text-[12px] ${format === f.id ? "border-text bg-text text-page" : "border-fill text-text-2 hover:text-text"}`}>
                    {f.name}
                  </button>
                ))}
              </div>
              <div className="section-label mt-3 mb-2">Angle note (optional)</div>
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="What is our angle? Who is it for? Anything to avoid?" className="min-h-16 text-[13px]" />
              <div className="mt-3 flex items-center gap-2">
                <Button size="sm" onClick={() => act("pick")} disabled={busy !== null}>
                  <Sparkles className="size-3.5" /> {busy === "pick" ? "Creating draft…" : story.draftId ? "Open draft" : "Pick and start outline"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setOpen("none")}>Cancel</Button>
              </div>
            </div>
          ) : null}
          {error ? <div className="mt-2 text-[12px] text-rose">{error}</div> : null}
        </div>

        {/* actions */}
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          {story.draftId ? (
            <Button size="sm" onClick={() => router.push(`/draft/${story.draftId}`)}>Open draft</Button>
          ) : (
            <Button size="sm" onClick={() => toggle("pick")} disabled={busy !== null}>Pick</Button>
          )}
          {skipped ? (
            <Button size="sm" variant="ghost" onClick={() => act("unskip")} disabled={busy !== null}>Undo skip</Button>
          ) : (
            <>
              <Button size="sm" variant="outline" onClick={() => act("skip")} disabled={busy !== null}>Skip</Button>
              <Button size="sm" variant="ghost" onClick={() => act("save")} disabled={busy !== null || story.status === "saved"}>{story.status === "saved" ? "Saved" : "Save for later"}</Button>
            </>
          )}
          <button onClick={() => toggle("score")} className="mt-1 flex items-center gap-1 text-[11px] text-text-3 hover:text-text">
            breakdown <ChevronDown className={`size-3 transition-transform ${open === "score" ? "rotate-180" : ""}`} />
          </button>
        </div>
      </div>
    </article>
  );
}
