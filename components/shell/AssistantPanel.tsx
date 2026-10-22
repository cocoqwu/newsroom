"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { SectionLabel } from "./SectionLabel";
import { assistantStore, useAssistant } from "@/lib/assistant-store";

const quick = ["Tighten this paragraph", "Make it more concrete, with the numbers", "Cut the hype, plainer words", "Add a one-line takeaway for builders"];

// The Assistant tab in the right panel. On the Draft screen: select text in the preview,
// type an instruction, apply. Only that paragraph changes; a new version is saved.
export function AssistantPanel() {
  const a = useAssistant();
  const router = useRouter();
  const [instruction, setInstruction] = useState("");

  async function apply(text?: string) {
    const ins = (text ?? instruction).trim();
    if (!a.draftId || !a.selection || !ins) return;
    assistantStore.set({ busy: true, lastError: null });
    try {
      const res = await fetch(`/api/drafts/${a.draftId}/revise`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ selection: a.selection, instruction: ins }) });
      const data = (await res.json()) as { ok: boolean; error?: string; version: number; before: string; after: string; provider: string };
      if (!data.ok) throw new Error(data.error || "revision failed");
      assistantStore.set({ history: [{ instruction: ins, before: data.before, after: data.after, version: data.version, provider: data.provider }, ...a.history], selection: "", lastError: data.provider === "mock" ? (data.before === data.after ? "No model was reachable, so the paragraph was left unchanged (saved as a version anyway)." : "No model was reachable: applied a small heuristic edit instead.") : null });
      setInstruction("");
      router.refresh();
    } catch (e) {
      assistantStore.set({ lastError: (e as Error).message });
    } finally {
      assistantStore.set({ busy: false });
    }
  }

  if (!a.draftId) {
    return (
      <div>
        <SectionLabel className="mb-3">Assistant</SectionLabel>
        <p className="text-[13px] leading-5 text-text-2">On the Draft screen, select any text in the preview and ask for a change here. Untouched sections stay exactly as they are, and every change is saved as a new version.</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <SectionLabel className="mb-2">Assistant · {a.draftTitle ? a.draftTitle.slice(0, 40) : `draft ${a.draftId}`}</SectionLabel>
      <div className="rounded-lg border border-fill bg-panel p-3">
        <div className="section-label mb-1.5">Selected text</div>
        {a.selection ? (
          <p className="max-h-28 overflow-y-auto text-[12px] leading-4 text-text-2">“{a.selection.slice(0, 400)}{a.selection.length > 400 ? "…" : ""}”</p>
        ) : (
          <p className="text-[12px] leading-4 text-text-3">Select a sentence or paragraph in the preview.</p>
        )}
      </div>
      <Textarea value={instruction} onChange={(e) => setInstruction(e.target.value)} placeholder="What should change? e.g. tighten this paragraph" className="mt-3 min-h-16 text-[13px]" disabled={!a.selection || a.busy} />
      <div className="mt-2 flex flex-wrap gap-1.5">
        {quick.map((q) => (
          <button key={q} onClick={() => apply(q)} disabled={!a.selection || a.busy} className="rounded-full border border-fill px-2.5 py-1 text-[11px] text-text-2 hover:text-text disabled:opacity-40">{q}</button>
        ))}
      </div>
      <Button size="sm" className="mt-3 self-start" onClick={() => apply()} disabled={!a.selection || !instruction.trim() || a.busy}>
        <Sparkles className="size-3.5" /> {a.busy ? "Rewriting…" : "Apply to this paragraph"}
      </Button>
      {a.lastError ? <div className="mt-2 text-[12px] text-rose">{a.lastError}</div> : null}

      {a.history.length ? (
        <div className="mt-6 min-h-0 flex-1 overflow-y-auto">
          <SectionLabel className="mb-2">Changes this session</SectionLabel>
          <ul className="flex flex-col gap-2">
            {a.history.map((h, i) => (
              <li key={i} className="rounded-lg border border-fill bg-panel p-3 text-[12px]">
                <div className="text-text">{h.instruction} <span className="text-text-3">· v{h.version} · {h.provider === "gemini" ? "Gemini" : h.provider === "replay" ? "recorded" : "heuristic"}</span></div>
                <div className="mt-1 line-clamp-3 text-text-3">{h.after}</div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
