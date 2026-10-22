// "Select text and ask the assistant for a change." Only the paragraph that contains the
// selection is rewritten; every other section stays byte-for-byte the same. Saves a new version.
import { generateText } from "@/lib/llm";
import { loadDraftContext, logAction } from "./context";
import { saveVersion } from "./write";

function plain(md: string): string {
  return md.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/[*_`>#]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
}

// Without a model (demo mode with no recording, or an outage): a small deterministic edit so the
// editor still sees the mechanism work. "Tighten"-style requests drop filler words; anything else
// leaves the paragraph unchanged. The provider is reported as "mock" so the UI can say so.
export function heuristicRevise(paragraph: string, instruction: string): string {
  if (!/tight|short|concise|trim|cut|plain/i.test(instruction)) return paragraph;
  const fillers = /\b(currently|typically|essentially|actually|really|very|quite|in order to|it is worth noting that|notably|importantly|fundamentally|significantly)\b,?\s*/gi;
  return paragraph.replace(fillers, (m) => (/in order to/i.test(m) ? "to " : "")).replace(/\s{2,}/g, " ").replace(/\s+([.,;])/g, "$1").trim();
}

export async function reviseSelection(draftId: number, selection: string, instruction: string): Promise<{ version: number; before: string; after: string; provider: string }> {
  const ctx = loadDraftContext(draftId);
  const body = ctx.draft.bodyMd ?? "";
  const paragraphs = body.split(/\n\s*\n/);
  const sel = plain(selection);
  // Find the paragraph that contains the selection; fall back to the best word-overlap match.
  let idx = paragraphs.findIndex((p) => plain(p).includes(sel.slice(0, 80)));
  if (idx < 0) {
    const words = new Set(sel.split(" ").filter((w) => w.length > 3));
    let best = 0;
    paragraphs.forEach((p, i) => {
      const score = plain(p).split(" ").filter((w) => words.has(w)).length;
      if (score > best) { best = score; idx = i; }
    });
  }
  if (idx < 0 || !paragraphs[idx]) throw new Error("could not find the selected text in the draft");
  const target = paragraphs[idx];

  const r = await generateText({
    role: "draft",
    task: "revise",
    draftId,
    system: `You are a line editor. Rewrite ONLY the paragraph you are given, following the instruction. Keep Markdown links intact, keep facts and numbers exactly as they are, keep the same voice. Return only the rewritten paragraph in Markdown, nothing else.\n\nHouse style:\n${ctx.houseStyle.slice(0, 1500)}`,
    prompt: `Instruction: ${instruction}\n\nThe editor selected this part: "${selection.slice(0, 600)}"\n\nParagraph to rewrite:\n${target}`,
    temperature: 0.4,
    fallback: () => heuristicRevise(target, instruction),
  });
  const after = r.text.trim().replace(/^```(?:markdown|md)?\s*/i, "").replace(/\s*```$/, "");
  paragraphs[idx] = after;
  const version = saveVersion(draftId, paragraphs.join("\n\n"), `Assistant: ${instruction.slice(0, 80)}`);
  logAction(draftId, ctx.story.id, "revise", instruction.slice(0, 200));
  return { version, before: target, after, provider: r.provider };
}
