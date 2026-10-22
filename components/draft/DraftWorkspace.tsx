"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ExternalLink, Loader2, RefreshCw, Sparkles, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SectionLabel } from "@/components/shell/SectionLabel";
import { BlogPost } from "@/components/blog/BlogPost";
import { assistantStore } from "@/lib/assistant-store";
import { formatName, timeAgo } from "@/lib/format";

export type WorkspaceProps = {
  draft: { id: number; status: string; format: string; angleNote: string | null; title: string | null; thesis: string | null; outline: { heading: string; bullets: string[] }[]; bodyMd: string | null; currentVersion: number; selectedImageId: number | null };
  story: { id: number; title: string; whyNow: string | null; theme: string | null; themeName: string; sources: { title: string; url: string; sourceName: string }[] };
  rendered: { html: string; toc: { id: string; text: string }[]; words: number };
  claims: { id: number; text: string; kind: string | null; status: string; sourceUrl: string | null; correction: string | null; note: string | null }[];
  images: { id: number; kind: string; label: string; svg: string | null; dataUrl: string | null; status: string; note: string | null }[];
  versions: { version: number; note: string | null; createdAt: string; words: number }[];
  researchCount: number;
  dateLabel: string;
  demo: boolean;
};

type Step = { key: string; label: string; state: "todo" | "running" | "done" | "failed"; detail?: string };

export function DraftWorkspace(p: WorkspaceProps) {
  const router = useRouter();
  const d = p.draft;
  const hasOutline = d.outline.length > 0;
  const hasBody = Boolean(d.bodyMd);

  // outline editor state
  const [title, setTitle] = useState(d.title ?? p.story.title);
  const [thesis, setThesis] = useState(d.thesis ?? "");
  const [outline, setOutline] = useState(d.outline);
  useEffect(() => { setTitle(d.title ?? p.story.title); setThesis(d.thesis ?? ""); setOutline(d.outline); }, [d.title, d.thesis, d.outline, p.story.title]);

  const [busy, setBusy] = useState<string | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"preview" | "edit" | "facts" | "images" | "versions">(hasBody ? "preview" : "facts");
  const [md, setMd] = useState(d.bodyMd ?? "");
  useEffect(() => { setMd(d.bodyMd ?? ""); }, [d.bodyMd]);
  const previewRef = useRef<HTMLDivElement>(null);

  // Register with the right-panel assistant.
  useEffect(() => {
    assistantStore.set({ draftId: d.id, draftTitle: d.title ?? p.story.title, selection: "" });
    return () => assistantStore.set({ draftId: null, draftTitle: null, selection: "" });
  }, [d.id, d.title, p.story.title]);

  function captureSelection() {
    const sel = window.getSelection();
    const text = sel?.toString().trim() ?? "";
    if (!text || !previewRef.current || !sel?.anchorNode || !previewRef.current.contains(sel.anchorNode)) return;
    assistantStore.set({ selection: text });
  }

  async function post(path: string, body?: unknown) {
    const res = await fetch(`/api/drafts/${d.id}/${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown> & { ok?: boolean; error?: string };
    if (!res.ok || data.ok === false) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  }

  async function proposeOutline() {
    setBusy("outline"); setError(null);
    try { await post("outline"); router.refresh(); } catch (e) { setError((e as Error).message); } finally { setBusy(null); }
  }

  // Approve the outline, then run research → write → fact-check with visible progress.
  async function approveAndRun() {
    setBusy("run"); setError(null);
    const plan: Step[] = [
      { key: "approve", label: "Approve outline", state: "todo" },
      { key: "research", label: `Research ${outline.length} sections in parallel`, state: "todo" },
      { key: "write", label: "Write the draft in house style", state: "todo" },
      { key: "factcheck", label: "Fact-check with a separate model call", state: "todo" },
    ];
    setSteps(plan);
    const mark = (key: string, state: Step["state"], detail?: string) => setSteps((s) => s.map((x) => (x.key === key ? { ...x, state, detail } : x)));
    try {
      mark("approve", "running");
      await post("approve", { title, thesis, outline });
      mark("approve", "done");
      mark("research", "running");
      const r = (await post("research")) as { claims: number; pagesFetched: number };
      mark("research", "done", `${r.claims} claims from ${r.pagesFetched} fetched pages`);
      mark("write", "running");
      const w = (await post("write")) as { words: number; version: number; provider: string };
      mark("write", "done", `${w.words} words, v${w.version}${w.provider !== "gemini" ? ` (${w.provider})` : ""}`);
      router.refresh();
      mark("factcheck", "running");
      const f = (await post("factcheck")) as { total: number; verified: number; corrected: number; unverified: number };
      mark("factcheck", "done", `${f.total} claims: ${f.verified} verified, ${f.corrected} corrected, ${f.unverified} unverified`);
      setTab("preview");
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
      setSteps((s) => s.map((x) => (x.state === "running" ? { ...x, state: "failed", detail: (e as Error).message } : x)));
    } finally {
      setBusy(null);
    }
  }

  async function simple(path: string, label: string, body?: unknown) {
    setBusy(label); setError(null);
    try { await post(path, body); router.refresh(); } catch (e) { setError((e as Error).message); } finally { setBusy(null); }
  }

  const selected = p.images.find((i) => i.id === d.selectedImageId) ?? p.images[0];
  const counts = { verified: p.claims.filter((c) => c.status === "verified").length, corrected: p.claims.filter((c) => c.status === "corrected").length, unverified: p.claims.filter((c) => c.status === "unverified").length };
  const stage = d.status === "checked" ? 4 : hasBody ? 3 : d.status === "approved" || d.status === "drafting" ? 2 : hasOutline ? 1 : 0;

  return (
    <div className="mx-auto max-w-[820px] px-6 py-6">
      {/* header */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[12px] text-text-3">
            <Link href="/today" className="hover:text-text">Today</Link><span>/</span><span>Draft {d.id}</span>
            {p.demo ? <span className="ml-2 rounded-full border border-rose/40 px-2 py-0.5 text-[10px] uppercase tracking-wide text-rose">demo</span> : null}
          </div>
          <h2 className="mt-1 text-[22px] font-semibold leading-7 tracking-[-0.5px]">{d.title ?? p.story.title}</h2>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px] text-text-3">
            <Badge variant="secondary">{formatName(d.format)}</Badge>
            <span>{p.story.themeName}</span>
            <span>·</span><span>{p.story.sources.length} source{p.story.sources.length === 1 ? "" : "s"}</span>
            {hasBody ? (<><span>·</span><span className="num">v{d.currentVersion} · {p.rendered.words} words</span></>) : null}
          </div>
          {d.angleNote ? <p className="mt-2 text-[13px] text-text-2"><span className="text-text-3">Angle note: </span>{d.angleNote}</p> : null}
        </div>
        {hasBody ? (
          <div className="flex shrink-0 items-center gap-2">
            <a href={`/preview/${d.id}`} target="_blank" rel="noreferrer">
              <Button variant="outline" size="sm"><ExternalLink className="size-3.5" /> Full preview</Button>
            </a>
            <Link href={`/publish/${d.id}`}><Button size="sm">Publish →</Button></Link>
          </div>
        ) : null}
      </div>

      {/* stepper */}
      <ol className="mt-6 grid grid-cols-5 gap-2">
        {["Picked", "Outline", "Approved", "Drafted", "Fact-checked"].map((s, i) => (
          <li key={s} className={`rounded-md border px-3 py-2 text-[12px] ${i <= stage ? "border-fill bg-panel text-text" : "border-fill/50 text-text-3"}`}>
            <span className="num mr-1.5 text-text-3">{i + 1}</span>{s}{i < stage || (i === stage && stage === 4) ? <Check className="ml-1 inline size-3 text-verified" /> : null}
          </li>
        ))}
      </ol>

      {/* Step 1: outline */}
      <SectionLabel className="mt-8 mb-3">Step 1 · title, thesis and outline</SectionLabel>
      {!hasOutline ? (
        <div className="rounded-lg border border-fill bg-panel p-5">
          <p className="text-[13px] text-text-2">Propose a title, thesis and outline from the story&apos;s sources and the house style guide. You edit and approve it before research or drafting runs.</p>
          <Button className="mt-4" onClick={proposeOutline} disabled={busy !== null}>
            {busy === "outline" ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />} {busy === "outline" ? "Proposing…" : "Propose outline"}
          </Button>
        </div>
      ) : (
        <div className="rounded-lg border border-fill bg-panel p-5">
          <div className="section-label mb-1.5">Title</div>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} disabled={hasBody} className="text-[15px] font-semibold" />
          <div className="section-label mt-4 mb-1.5">Thesis</div>
          <Textarea value={thesis} onChange={(e) => setThesis(e.target.value)} disabled={hasBody} className="min-h-16 text-[13px]" />
          <div className="section-label mt-4 mb-1.5">Outline · {outline.length} sections</div>
          <ol className="flex flex-col gap-2">
            {outline.map((s, i) => (
              <li key={i} className="rounded-md border border-fill bg-page/60 p-3">
                <div className="flex items-center gap-2">
                  <span className="num w-5 text-[12px] text-text-3">{i + 1}</span>
                  <Input value={s.heading} disabled={hasBody} onChange={(e) => setOutline(outline.map((x, k) => (k === i ? { ...x, heading: e.target.value } : x)))} className="h-7 text-[13px] font-medium" />
                  {!hasBody ? <button className="text-[11px] text-text-3 hover:text-rose" onClick={() => setOutline(outline.filter((_, k) => k !== i))}>remove</button> : null}
                </div>
                <Textarea value={s.bullets.join("\n")} disabled={hasBody} onChange={(e) => setOutline(outline.map((x, k) => (k === i ? { ...x, bullets: e.target.value.split("\n") } : x)))} className="mt-2 min-h-14 text-[12px] text-text-2" />
              </li>
            ))}
          </ol>
          {!hasBody ? (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Button onClick={approveAndRun} disabled={busy !== null || !title.trim() || outline.length === 0}>
                {busy === "run" ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />} {busy === "run" ? "Working…" : "Approve outline and write the draft"}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setOutline([...outline, { heading: "New section", bullets: [""] }])} disabled={busy !== null}>Add section</Button>
              <Button variant="ghost" size="sm" onClick={proposeOutline} disabled={busy !== null}><RefreshCw className="size-3.5" /> Propose again</Button>
            </div>
          ) : (
            <div className="mt-3 flex items-center gap-2 text-[12px] text-text-3">
              Outline approved. <Button variant="ghost" size="xs" onClick={() => simple("write", "rewrite")} disabled={busy !== null}>Rewrite draft from outline (new version)</Button>
            </div>
          )}
        </div>
      )}

      {steps.length ? (
        <ol className="mt-3 flex flex-col gap-1 rounded-lg border border-fill bg-panel p-4 text-[13px]">
          {steps.map((s) => (
            <li key={s.key} className="flex items-center gap-2">
              {s.state === "done" ? <Check className="size-3.5 text-verified" /> : s.state === "running" ? <Loader2 className="size-3.5 animate-spin text-text-2" /> : s.state === "failed" ? <span className="text-rose">✕</span> : <span className="inline-block size-3.5 rounded-full border border-fill" />}
              <span className={s.state === "todo" ? "text-text-3" : "text-text"}>{s.label}</span>
              {s.detail ? <span className="text-text-3">· {s.detail}</span> : null}
            </li>
          ))}
        </ol>
      ) : null}
      {error ? <div className="mt-3 rounded-md border border-rose/30 bg-rose/10 px-3 py-2 text-[12px] text-rose">{error}</div> : null}

      {/* Step 2: the draft */}
      {hasBody ? (
        <>
          <SectionLabel className="mt-10 mb-3">Step 2 · the draft</SectionLabel>
          <div className="flex items-center justify-between">
            <div className="flex gap-1 rounded-full bg-panel p-1">
              {([["preview", "Preview"], ["facts", `Fact-check (${p.claims.length})`], ["images", "Images"], ["edit", "Edit Markdown"], ["versions", `Versions (${p.versions.length})`]] as const).map(([k, label]) => (
                <button key={k} onClick={() => setTab(k)} className={`rounded-full px-3 py-1 text-[12px] ${tab === k ? "bg-fill text-text" : "text-text-3 hover:text-text-2"}`}>{label}</button>
              ))}
            </div>
            {p.claims.length ? (
              <div className="flex items-center gap-3 text-[11px]">
                <span className="flex items-center gap-1 text-text-2"><i className="inline-block size-2 rounded-full bg-verified" />{counts.verified} verified</span>
                <span className="flex items-center gap-1 text-text-2"><i className="inline-block size-2 rounded-full bg-corrected" />{counts.corrected} corrected</span>
                <span className="flex items-center gap-1 text-text-2"><i className="inline-block size-2 rounded-full bg-unverified" />{counts.unverified} unverified</span>
              </div>
            ) : null}
          </div>

          {tab === "preview" ? (
            <div className="mt-3">
              <p className="mb-2 text-[12px] text-text-3">Blog-style preview. Highlighted text is a corrected (amber) or unverified (rose) claim. Select any text and use the Assistant panel on the right to change it.</p>
              <div ref={previewRef} onMouseUp={captureSelection} className="overflow-hidden rounded-lg border border-fill">
                <BlogPost compact title={d.title ?? p.story.title} category={p.story.themeName} author="Coco Wu" date={p.dateLabel} heroSvg={selected?.svg} heroDataUrl={selected?.dataUrl} html={p.rendered.html} toc={p.rendered.toc} />
              </div>
            </div>
          ) : null}

          {tab === "facts" ? (
            <div className="mt-3 rounded-lg border border-fill bg-panel">
              <div className="flex items-center justify-between border-b border-fill px-4 py-2 text-[12px] text-text-3">
                <span>{p.claims.length} claims checked against {p.researchCount} research notes by a separate model call.</span>
                <Button variant="ghost" size="xs" onClick={() => simple("factcheck", "factcheck")} disabled={busy !== null}>{busy === "factcheck" ? "Checking…" : "Re-run fact-check"}</Button>
              </div>
              {p.claims.length === 0 ? <p className="px-4 py-6 text-[13px] text-text-3">No fact-check yet.</p> : (
                <ul className="divide-y divide-fill">
                  {p.claims.map((c) => (
                    <li key={c.id} className="grid grid-cols-[88px_minmax(0,1fr)] gap-3 px-4 py-3 text-[13px]">
                      <div>
                        <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${c.status === "verified" ? "bg-verified/15 text-verified" : c.status === "corrected" ? "bg-corrected/15 text-corrected" : "bg-unverified/15 text-unverified"}`}>{c.status}</span>
                        <div className="mt-1 text-[10px] uppercase text-text-3">{c.kind}</div>
                      </div>
                      <div className="min-w-0">
                        <div className="text-text">“{c.text}”</div>
                        {c.correction ? <div className="mt-1 text-corrected">Correction: {c.correction}</div> : null}
                        {c.note ? <div className="mt-1 text-[12px] text-text-3">{c.note}</div> : null}
                        {c.sourceUrl ? <a href={c.sourceUrl} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-[12px] text-text-2 hover:text-text"><ExternalLink className="size-3" />{c.sourceUrl.replace(/^https?:\/\//, "").slice(0, 70)}</a> : null}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}

          {tab === "images" ? (
            <div className="mt-3">
              <div className="mb-2 flex items-center justify-between text-[12px] text-text-3">
                <span>Three generated SVG headers in the blog palette (free, on-brand, no rights issues) plus the AI image option. Click one to use it as the hero.</span>
                <Button variant="ghost" size="xs" onClick={() => simple("images", "images")} disabled={busy !== null}><RefreshCw className="size-3" /> New SVG set</Button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {p.images.map((img) => (
                  <button key={img.id} onClick={() => img.status === "ready" && simple("images/select", "select", { imageId: img.id })} disabled={busy !== null || img.status !== "ready"} className={`overflow-hidden rounded-lg border text-left ${d.selectedImageId === img.id ? "border-text" : "border-fill hover:border-text-3"} ${img.status !== "ready" ? "cursor-default" : ""}`}>
                    {img.kind === "svg" && img.svg ? (
                      <div className="aspect-video w-full bg-paper [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: img.svg }} />
                    ) : img.dataUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={img.dataUrl} alt="" className="aspect-video w-full object-cover" />
                    ) : (
                      <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 bg-page/60 px-6 text-center">
                        <Wand2 className="size-5 text-text-3" />
                        <div className="text-[12px] leading-4 text-text-3">{img.note}</div>
                      </div>
                    )}
                    <div className="flex items-center justify-between px-3 py-2 text-[12px]">
                      <span className="text-text">{img.label}{d.selectedImageId === img.id ? " · selected" : ""}</span>
                      {img.kind === "ai" ? (
                        <span role="button" onClick={(e) => { e.stopPropagation(); simple("images/ai", "ai"); }} className="rounded-full border border-fill px-2.5 py-0.5 text-[11px] text-text-2 hover:text-text">{busy === "ai" ? "Calling Gemini…" : img.status === "ready" ? "Regenerate" : "Try AI image"}</span>
                      ) : null}
                    </div>
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-text-3">Image-model slot: the AI card calls the Gemini image model behind the same interface as the SVG generator. Every generated image is logged with its list price against the $5 cap.</p>
            </div>
          ) : null}

          {tab === "edit" ? (
            <div className="mt-3">
              <Textarea value={md} onChange={(e) => setMd(e.target.value)} className="min-h-[520px] font-mono text-[12px] leading-5" />
              <div className="mt-2 flex items-center gap-2">
                <Button size="sm" onClick={() => simple("version", "save", { bodyMd: md, note: "Manual edit" })} disabled={busy !== null || md === (d.bodyMd ?? "")}>{busy === "save" ? "Saving…" : "Save as new version"}</Button>
                <Button size="sm" variant="ghost" onClick={() => setMd(d.bodyMd ?? "")} disabled={md === (d.bodyMd ?? "")}>Discard changes</Button>
                <span className="text-[12px] text-text-3">Inline edits never touch other versions.</span>
              </div>
            </div>
          ) : null}

          {tab === "versions" ? (
            <ul className="mt-3 divide-y divide-fill rounded-lg border border-fill bg-panel">
              {p.versions.map((v) => (
                <li key={v.version} className="flex items-center gap-3 px-4 py-3 text-[13px]">
                  <span className="num w-8 text-text-3">v{v.version}</span>
                  <span className="min-w-0 flex-1 truncate text-text">{v.note}</span>
                  <span className="num text-[12px] text-text-3">{v.words} words · {timeAgo(v.createdAt)}</span>
                  {v.version !== d.currentVersion ? <Button variant="ghost" size="xs" onClick={() => simple("version", "restore", { restoreVersion: v.version })} disabled={busy !== null}>Restore</Button> : <span className="text-[11px] text-text-3">current</span>}
                </li>
              ))}
            </ul>
          ) : null}
        </>
      ) : null}

      <SectionLabel className="mt-10 mb-3">Sources for this story</SectionLabel>
      <ul className="flex flex-col gap-1 text-[12px]">
        {p.story.sources.map((s) => (
          <li key={s.url} className="flex items-center gap-2"><ExternalLink className="size-3 text-text-3" /><a href={s.url} target="_blank" rel="noreferrer" className="truncate text-text-2 hover:text-text">{s.title}</a><span className="shrink-0 text-text-3">{s.sourceName}</span></li>
        ))}
      </ul>
    </div>
  );
}
