"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Star, X, Pencil, Loader2, Upload, Sparkles, FileText, Mic, Video, Check, Paperclip, Newspaper } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SectionLabel } from "@/components/shell/SectionLabel";
import { permissionLabel, type Permission } from "@/lib/events/consent";

export type EventProps = {
  event: { id: number; name: string; date: string | null; description: string | null; isSample: boolean };
  speakers: { id: number; name: string; title: string | null; permission: string }[];
  sources: { id: number; kind: string; label: string; status: string; note: string | null; sizeBytes: number | null; transcriptChars: number; transcriptPreview: string }[];
  highlights: { id: number; sourceId: number; speakerId: number | null; speakerName: string | null; timestamp: string | null; type: string; quote: string; paraphrase: string; tags: string[]; tagNames: string[]; status: string; edited: boolean }[];
  drafts: { id: number; title: string; status: string }[];
  demo: boolean;
};

const typeLabel: Record<string, string> = { claim: "Claim", number: "Number", prediction: "Prediction", demo: "Demo", open_question: "Open question" };
const permClass: Record<string, string> = { approved: "bg-verified/15 text-verified", paraphrase: "bg-corrected/15 text-corrected", off: "bg-unverified/15 text-unverified" };

export function EventWorkspace(p: EventProps) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paste, setPaste] = useState("");
  const [pasteLabel, setPasteLabel] = useState("");
  const [filter, setFilter] = useState<"all" | "starred" | "new">("all");
  const [editing, setEditing] = useState<number | null>(null);
  const [editQuote, setEditQuote] = useState("");
  const [editPara, setEditPara] = useState("");
  const [attachTo, setAttachTo] = useState<number | "">(p.drafts[0]?.id ?? "");
  const [newSpeaker, setNewSpeaker] = useState({ name: "", title: "" });
  const fileRef = useRef<HTMLInputElement>(null);
  const permOf = (speakerId: number | null) => p.speakers.find((s) => s.id === speakerId)?.permission ?? "paraphrase";

  async function call(url: string, body?: unknown, form?: FormData) {
    const res = await fetch(url, { method: "POST", ...(form ? { body: form } : { headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined }) });
    const d = (await res.json().catch(() => ({}))) as Record<string, unknown> & { ok?: boolean; error?: string };
    if (!res.ok || d.ok === false) throw new Error(d.error || `HTTP ${res.status}`);
    return d;
  }
  async function run(label: string, fn: () => Promise<string | void>) {
    setBusy(label); setError(null); setMsg(null);
    try { const m = await fn(); if (m) setMsg(m); router.refresh(); } catch (e) { setError((e as Error).message); } finally { setBusy(null); }
  }

  const starred = p.highlights.filter((h) => h.status === "starred");
  const shown = p.highlights.filter((h) => (filter === "all" ? h.status !== "rejected" : h.status === filter));

  return (
    <div className="mx-auto max-w-[820px] px-6 py-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-[12px] text-text-3"><Link href="/events" className="hover:text-text">Events</Link><span>/</span><span>{p.event.date ?? "no date"}</span></div>
          <h2 className="mt-1 text-[22px] font-semibold leading-7 tracking-[-0.5px]">{p.event.name}</h2>
          {p.event.description ? <p className="mt-1 text-[13px] text-text-2">{p.event.description}</p> : null}
          {p.event.isSample ? <p className="mt-2 inline-block rounded-full border border-rose/40 px-2.5 py-0.5 text-[11px] uppercase tracking-wide text-rose">Sample event · fictional speakers and transcript, written for the demo</p> : null}
        </div>
      </div>

      {/* speakers + consent */}
      <SectionLabel className="mt-8 mb-3">Speakers and quote permission</SectionLabel>
      <div className="rounded-lg border border-fill bg-panel">
        <ul className="divide-y divide-fill">
          {p.speakers.map((s) => (
            <li key={s.id} className="flex items-center gap-3 px-4 py-2.5 text-[13px]">
              <div className="min-w-0 flex-1"><span className="text-text">{s.name}</span>{s.title ? <span className="text-text-3"> · {s.title}</span> : null}</div>
              <select value={s.permission} disabled={busy !== null} onChange={(e) => run(`perm-${s.id}`, async () => { await call(`/api/events/${p.event.id}/speakers`, { speakerId: s.id, permission: e.target.value }); })} className={`h-7 rounded-full border border-fill bg-page px-2.5 text-[12px] ${permClass[s.permission] ?? ""}`}>
                {(Object.keys(permissionLabel) as Permission[]).map((k) => <option key={k} value={k}>{permissionLabel[k]}</option>)}
              </select>
            </li>
          ))}
          <li className="flex items-center gap-2 px-4 py-2.5">
            <Input value={newSpeaker.name} onChange={(e) => setNewSpeaker({ ...newSpeaker, name: e.target.value })} placeholder="Add speaker name" className="h-7 text-[12px]" />
            <Input value={newSpeaker.title} onChange={(e) => setNewSpeaker({ ...newSpeaker, title: e.target.value })} placeholder="Title" className="h-7 text-[12px]" />
            <Button size="xs" variant="outline" disabled={busy !== null || !newSpeaker.name.trim()} onClick={() => run("speaker", async () => { await call(`/api/events/${p.event.id}/speakers`, { ...newSpeaker, permission: "paraphrase" }); setNewSpeaker({ name: "", title: "" }); })}>Add</Button>
          </li>
        </ul>
        <p className="border-t border-fill px-4 py-2 text-[11px] text-text-3">Approved: may be quoted directly (under 15 words). Paraphrase only: ideas attributed, never in quotation marks. Off the record: nothing from this speaker reaches a draft. Changes apply to every highlight immediately.</p>
      </div>

      {/* sources */}
      <SectionLabel className="mt-8 mb-3">Sources · transcripts and recordings</SectionLabel>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-fill bg-panel p-4">
          <div className="section-label mb-1.5">Paste a transcript</div>
          <Input value={pasteLabel} onChange={(e) => setPasteLabel(e.target.value)} placeholder="Label, e.g. Panel: reliability at long horizons" className="mb-2 h-7 text-[12px]" />
          <Textarea value={paste} onChange={(e) => setPaste(e.target.value)} placeholder="[00:12] Jane: We saw a 3x gain on…" className="min-h-28 font-mono text-[12px]" />
          <Button size="sm" className="mt-2" disabled={busy !== null || paste.trim().length < 40} onClick={() => run("paste", async () => { const f = new FormData(); f.set("text", paste); f.set("label", pasteLabel); await call(`/api/events/${p.event.id}/sources`, undefined, f); setPaste(""); setPasteLabel(""); return "Transcript added."; })}><FileText className="size-3.5" /> Add transcript</Button>
        </div>
        <div className="rounded-lg border border-fill bg-panel p-4">
          <div className="section-label mb-1.5">Upload a file</div>
          <p className="text-[12px] leading-4 text-text-2">Transcripts: .txt, .vtt, .srt, .md. Recordings: .mp3, .m4a, .wav, .mp4 up to 100 MB, transcribed with Gemini audio understanding. If transcription fails or the file is too large, the source is kept and you can paste a transcript instead.</p>
          <input ref={fileRef} type="file" accept=".txt,.vtt,.srt,.md,.mp3,.m4a,.wav,.mp4,audio/*,video/mp4" className="mt-3 block w-full text-[12px] text-text-2 file:mr-3 file:rounded-full file:border file:border-fill file:bg-page file:px-3 file:py-1 file:text-[12px] file:text-text" />
          <Button size="sm" className="mt-2" disabled={busy !== null} onClick={() => run("upload", async () => { const file = fileRef.current?.files?.[0]; if (!file) throw new Error("choose a file first"); const f = new FormData(); f.set("file", file); const d = (await call(`/api/events/${p.event.id}/sources`, undefined, f)) as { status: string; note?: string }; if (fileRef.current) fileRef.current.value = ""; return d.status === "failed" ? `Saved, but not transcribed: ${d.note}` : "File added."; })}>{busy === "upload" ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />} {busy === "upload" ? "Uploading and transcribing…" : "Upload"}</Button>
          {p.demo ? <p className="mt-2 text-[11px] text-text-3">Demo mode: recordings are not transcribed (no network calls). Transcript files and pasted text work.</p> : null}
        </div>
      </div>
      {p.sources.length ? (
        <ul className="mt-3 flex flex-col gap-2">
          {p.sources.map((s) => {
            const n = p.highlights.filter((h) => h.sourceId === s.id).length;
            const Icon = s.kind === "audio" ? Mic : s.kind === "video" ? Video : FileText;
            return (
              <li key={s.id} className="rounded-lg border border-fill bg-panel px-4 py-3">
                <div className="flex items-center gap-3">
                  <Icon className="size-4 text-text-3" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] text-text">{s.label}</div>
                    <div className="text-[11px] text-text-3">{s.kind}{s.sizeBytes ? ` · ${(s.sizeBytes / 1e6).toFixed(1)} MB` : ""}{s.transcriptChars ? ` · ${s.transcriptChars.toLocaleString()} characters` : ""} · {s.status}{s.note ? ` · ${s.note}` : ""}{n ? ` · ${n} highlights` : ""}</div>
                  </div>
                  {s.status === "ready" ? (
                    <Button size="sm" variant={n ? "outline" : "default"} disabled={busy !== null} onClick={() => run(`extract-${s.id}`, async () => { const d = (await call(`/api/events/${p.event.id}/sources/${s.id}/highlights`)) as { count: number; provider: string }; return `${d.count} highlights extracted${d.provider !== "gemini" ? ` (${d.provider === "replay" ? "recorded response" : "heuristic, no model reachable"})` : ""}.`; })}>
                      {busy === `extract-${s.id}` ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />} {n ? "Re-extract" : "Extract highlights"}
                    </Button>
                  ) : s.status === "failed" ? <span className="text-[12px] text-unverified">needs a transcript</span> : <span className="text-[12px] text-text-3">transcribing…</span>}
                </div>
                {s.transcriptPreview ? <details className="mt-2"><summary className="cursor-pointer text-[11px] text-text-3">transcript preview</summary><pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap font-mono text-[11px] leading-4 text-text-2">{s.transcriptPreview}{s.transcriptChars > 1200 ? "…" : ""}</pre></details> : null}
              </li>
            );
          })}
        </ul>
      ) : null}

      {/* highlights */}
      <div className="mt-8 flex items-end justify-between">
        <SectionLabel>Highlights · {p.highlights.filter((h) => h.status !== "rejected").length} · {starred.length} starred</SectionLabel>
        <div className="flex gap-1 rounded-full bg-panel p-1">
          {(["all", "starred", "new"] as const).map((f) => <button key={f} onClick={() => setFilter(f)} className={`rounded-full px-3 py-1 text-[12px] capitalize ${filter === f ? "bg-fill text-text" : "text-text-3 hover:text-text-2"}`}>{f}</button>)}
        </div>
      </div>
      {shown.length === 0 ? <p className="mt-3 text-[13px] text-text-3">{p.highlights.length ? "Nothing in this filter." : "Add a source and extract highlights."}</p> : (
        <ul className="mt-3 flex flex-col gap-2">
          {shown.map((h) => {
            const perm = permOf(h.speakerId);
            const isEdit = editing === h.id;
            return (
              <li key={h.id} id={`h${h.id}`} className={`rounded-lg border bg-panel p-4 ${h.status === "starred" ? "border-text/40" : "border-fill"}`}>
                <div className="flex items-start gap-3">
                  <div className="w-14 shrink-0"><div className="num text-[13px] text-text">{h.timestamp || "–:–"}</div><div className="mt-1 text-[10px] uppercase tracking-wide text-text-3">{typeLabel[h.type] ?? h.type}</div></div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-[12px]">
                      <span className="text-text">{h.speakerName ?? "Speaker"}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${permClass[perm]}`}>{permissionLabel[perm as Permission]}</span>
                      {h.tagNames.map((t) => <Badge key={t} variant="secondary" className="h-[18px] text-[10px]">{t}</Badge>)}
                      {h.edited ? <span className="text-[10px] text-text-3">edited</span> : null}
                    </div>
                    {isEdit ? (
                      <div className="mt-2 flex flex-col gap-2">
                        <Textarea value={editQuote} onChange={(e) => setEditQuote(e.target.value)} className="min-h-12 text-[13px]" />
                        <Textarea value={editPara} onChange={(e) => setEditPara(e.target.value)} className="min-h-12 text-[13px]" />
                        <div className="flex gap-2"><Button size="xs" onClick={() => run(`edit-${h.id}`, async () => { await call(`/api/highlights/${h.id}`, { quote: editQuote, paraphrase: editPara }); setEditing(null); })}><Check className="size-3" /> Save</Button><Button size="xs" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button></div>
                      </div>
                    ) : (
                      <>
                        <p className={`mt-1.5 text-[14px] leading-5 ${perm === "approved" ? "text-text" : "text-text-2"}`}>“{h.quote}”{perm !== "approved" ? <span className="ml-2 text-[11px] text-text-3">{perm === "off" ? "(off the record: will not be used)" : "(will be paraphrased, not quoted)"}</span> : null}</p>
                        <p className="mt-1 text-[13px] leading-5 text-text-2">{h.paraphrase}</p>
                      </>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <button title={h.status === "starred" ? "Unstar" : "Star"} disabled={busy !== null} onClick={() => run(`star-${h.id}`, async () => { const d = (await call(`/api/highlights/${h.id}`, { status: h.status === "starred" ? "new" : "starred" })) as { boosted: number }; return d.boosted ? `Boosted ${d.boosted} Today stor${d.boosted === 1 ? "y" : "ies"} that match this event.` : undefined; })} className={`rounded-full p-1.5 ${h.status === "starred" ? "text-corrected" : "text-text-3 hover:text-text"}`}><Star className={`size-4 ${h.status === "starred" ? "fill-current" : ""}`} /></button>
                    <button title="Edit" disabled={busy !== null} onClick={() => { setEditing(h.id); setEditQuote(h.quote); setEditPara(h.paraphrase); }} className="rounded-full p-1.5 text-text-3 hover:text-text"><Pencil className="size-3.5" /></button>
                    <button title={h.status === "rejected" ? "Restore" : "Reject"} disabled={busy !== null} onClick={() => run(`rej-${h.id}`, async () => { await call(`/api/highlights/${h.id}`, { status: h.status === "rejected" ? "new" : "rejected" }); })} className="rounded-full p-1.5 text-text-3 hover:text-unverified"><X className="size-4" /></button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* into posts */}
      <SectionLabel className="mt-8 mb-3">Into posts · {starred.length} starred highlight{starred.length === 1 ? "" : "s"}</SectionLabel>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-fill bg-panel p-4">
          <div className="text-[13px] text-text">Attach to an existing draft</div>
          <p className="mt-1 text-[12px] text-text-2">Starred highlights become cited evidence (source = the transcript timestamp). The fact-check panel treats them like any other source.</p>
          <div className="mt-3 flex items-center gap-2">
            <select value={attachTo} onChange={(e) => setAttachTo(Number(e.target.value))} className="h-8 min-w-0 flex-1 rounded-lg border border-fill bg-page px-2 text-[12px] text-text">
              {p.drafts.length === 0 ? <option value="">No drafts yet</option> : p.drafts.map((d) => <option key={d.id} value={d.id}>{d.title.slice(0, 60)} · {d.status}</option>)}
            </select>
            <Button size="sm" disabled={busy !== null || !starred.length || !attachTo} onClick={() => run("attach", async () => { const d = (await call(`/api/events/${p.event.id}/attach`, { draftId: attachTo })) as { added: number; quotes: number; heldBack: number }; return `Attached ${d.added} highlight${d.added === 1 ? "" : "s"} (${d.quotes} quotable${d.heldBack ? `, ${d.heldBack} held back: off the record` : ""}). Open the draft and rerun the fact-check or a rewrite to use them.`; })}><Paperclip className="size-3.5" /> Attach</Button>
          </div>
        </div>
        <div className="rounded-lg border border-fill bg-panel p-4">
          <div className="text-[13px] text-text">Start an event recap draft</div>
          <p className="mt-1 text-[12px] text-text-2">Creates a draft in the event-recap format with the starred highlights pre-attached, then goes through the usual outline approval before anything is written.</p>
          <Button size="sm" className="mt-3" disabled={busy !== null || !starred.length} onClick={() => run("recap", async () => { const d = (await call(`/api/events/${p.event.id}/recap`)) as { draftId: number }; router.push(`/draft/${d.draftId}`); })}><Newspaper className="size-3.5" /> Start recap draft</Button>
        </div>
      </div>
      {msg ? <div className="mt-3 rounded-md border border-fill bg-panel px-3 py-2 text-[12px] text-text-2">{msg}</div> : null}
      {error ? <div className="mt-3 rounded-md border border-rose/30 bg-rose/10 px-3 py-2 text-[12px] text-rose">{error}</div> : null}
    </div>
  );
}
