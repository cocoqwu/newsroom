"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Download, Loader2, Send, Sparkles, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { SectionLabel } from "@/components/shell/SectionLabel";
import type { WebflowPayload } from "@/lib/export/webflow";

export type PublishProps = {
  draftId: number;
  title: string;
  words: number;
  version: number;
  claimCounts: { verified: number; corrected: number; unverified: number };
  payload: WebflowPayload;
  snippets: { newsletter: string; social: string; linkedin: string; generatedAt: string } | null;
  lastMockSend: string | null;
  demo: boolean;
};

export function PublishPanel(p: PublishProps) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(p.lastMockSend);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [snips, setSnips] = useState(p.snippets);

  async function post(path: string) {
    const res = await fetch(`/api/drafts/${p.draftId}/${path}`, { method: "POST" });
    const data = (await res.json()) as Record<string, unknown> & { ok?: boolean; error?: string };
    if (!res.ok || !data.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  }
  async function mockSend() {
    setBusy("send"); setError(null);
    try { const d = (await post("publish-mock")) as { sentAt: string }; setSent(d.sentAt); router.refresh(); } catch (e) { setError((e as Error).message); } finally { setBusy(null); }
  }
  async function genSnippets() {
    setBusy("snips"); setError(null);
    try { const d = (await post("snippets")) as { snippets: PublishProps["snippets"] }; setSnips(d.snippets); router.refresh(); } catch (e) { setError((e as Error).message); } finally { setBusy(null); }
  }
  async function copy(key: string, text: string) {
    try { await navigator.clipboard.writeText(text); setCopied(key); setTimeout(() => setCopied(null), 1500); } catch { /* clipboard unavailable */ }
  }

  const ready = p.claimCounts.unverified === 0;
  return (
    <div className="mx-auto max-w-[820px] px-6 py-6">
      <h2 className="text-[22px] font-semibold leading-7 tracking-[-0.5px]">{p.title}</h2>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px] text-text-3">
        <span className="num">v{p.version} · {p.words} words</span><span>·</span>
        <span className={ready ? "text-verified" : "text-unverified"}>{ready ? "all claims verified or corrected" : `${p.claimCounts.unverified} unverified claim${p.claimCounts.unverified === 1 ? "" : "s"} still highlighted in the draft`}</span>
        {p.demo ? <span className="ml-1 rounded-full border border-rose/40 px-2 py-0.5 text-[10px] uppercase tracking-wide text-rose">demo</span> : null}
      </div>

      <SectionLabel className="mt-8 mb-3">Export</SectionLabel>
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-fill bg-panel p-4">
        <a href={`/api/drafts/${p.draftId}/export?format=md`}><Button variant="outline" size="sm"><Download className="size-3.5" /> Markdown (.md)</Button></a>
        <a href={`/api/drafts/${p.draftId}/export?format=html`}><Button variant="outline" size="sm"><Download className="size-3.5" /> HTML (.html)</Button></a>
        <a href={`/preview/${p.draftId}`} target="_blank" rel="noreferrer"><Button variant="ghost" size="sm">Open blog preview</Button></a>
        <span className="text-[12px] text-text-3">Markdown carries front matter (title, category, author, date). HTML is standalone with the blog fonts.</span>
      </div>

      <SectionLabel className="mt-8 mb-3">Send to blog as draft · mock</SectionLabel>
      <div className="rounded-lg border border-fill bg-panel p-4">
        <p className="text-[13px] leading-5 text-text-2">
          <span className="rounded bg-rose/15 px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-rose">Mocked in this version</span>{" "}
          This button does not call Webflow. It shows the exact request the integration would send to the Webflow CMS API, creating the post as a <em>draft</em> item so an editor still publishes from Webflow. A real integration needs a site API token and the blog collection id from the AGI House team.
        </p>
        <div className="mt-3 flex items-center gap-2">
          <Button size="sm" onClick={mockSend} disabled={busy !== null}>{busy === "send" ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />} Send to blog as draft (mock)</Button>
          {sent ? <span className="flex items-center gap-1 text-[12px] text-verified"><Check className="size-3.5" /> Logged as a mock send at {new Date(sent).toLocaleTimeString()}; nothing was transmitted.</span> : null}
        </div>
        <div className="mt-4 rounded-md border border-fill bg-page/70">
          <div className="flex items-center justify-between border-b border-fill px-3 py-1.5 text-[11px] text-text-3">
            <span className="num">{p.payload.request.method} {p.payload.request.url}</span>
            <button onClick={() => copy("payload", JSON.stringify(p.payload.request, null, 2))} className="flex items-center gap-1 hover:text-text"><Copy className="size-3" /> {copied === "payload" ? "copied" : "copy JSON"}</button>
          </div>
          <pre className="num max-h-[360px] overflow-auto p-3 text-[11px] leading-4 text-text-2">{JSON.stringify({ headers: p.payload.request.headers, body: { ...p.payload.request.body, fieldData: { ...p.payload.request.body.fieldData, "post-body": truncateHtml(String(p.payload.request.body.fieldData["post-body"])) } } }, null, 2)}</pre>
        </div>
        <ul className="mt-3 list-disc pl-5 text-[12px] leading-5 text-text-3">
          {p.payload.followUps.map((f) => <li key={f}>{f}</li>)}
        </ul>
      </div>

      <SectionLabel className="mt-8 mb-3">Newsletter blurb and social post</SectionLabel>
      <div className="rounded-lg border border-fill bg-panel p-4">
        <div className="flex items-center gap-2">
          <Button size="sm" variant={snips ? "outline" : "default"} onClick={genSnippets} disabled={busy !== null}>{busy === "snips" ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />} {snips ? "Regenerate from the final text" : "Generate from the final text"}</Button>
          {snips ? <span className="text-[12px] text-text-3">generated {new Date(snips.generatedAt).toLocaleTimeString()}</span> : null}
        </div>
        {snips ? (
          <div className="mt-4 grid gap-4">
            {([["newsletter", "Newsletter blurb", snips.newsletter], ["social", "Post for X", snips.social], ["linkedin", "LinkedIn", snips.linkedin]] as const).map(([k, label, text]) => (
              <div key={k}>
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="section-label">{label} <span className="num normal-case tracking-normal">· {text.length} chars</span></span>
                  <button onClick={() => copy(k, text)} className="flex items-center gap-1 text-[11px] text-text-3 hover:text-text"><Copy className="size-3" /> {copied === k ? "copied" : "copy"}</button>
                </div>
                <Textarea defaultValue={text} className="min-h-20 text-[13px]" />
              </div>
            ))}
          </div>
        ) : null}
      </div>
      {error ? <div className="mt-3 rounded-md border border-rose/30 bg-rose/10 px-3 py-2 text-[12px] text-rose">{error}</div> : null}
    </div>
  );
}

function truncateHtml(s: string) {
  return s.length > 1200 ? s.slice(0, 1200) + `… (${s.length.toLocaleString()} characters total)` : s;
}
