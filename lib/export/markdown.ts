// Markdown → HTML for the preview and exports. Adds ids to H2s (for the contents sidebar) and
// wraps corrected / unverified claims in <mark> so the preview highlights them.
import { marked } from "marked";
import { slugify } from "@/lib/text";

export type Claim = { text: string; status: string; note?: string | null; correction?: string | null };

function escapeRe(s: string) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

export function highlightClaims(md: string, claims: Claim[]): string {
  let out = md;
  for (const c of claims) {
    if (c.status === "verified" || !c.text || c.text.length < 8) continue;
    const re = new RegExp(escapeRe(c.text.trim()));
    if (!re.test(out)) continue;
    const title = `${c.status}${c.correction ? `: ${c.correction}` : ""}${c.note ? ` (${c.note})` : ""}`.replace(/"/g, "&quot;");
    out = out.replace(re, (m) => `<mark class="claim-${c.status}" title="${title}">${m}</mark>`);
  }
  return out;
}

export function renderMarkdown(md: string, claims: Claim[] = []): { html: string; toc: { id: string; text: string }[] } {
  const toc: { id: string; text: string }[] = [];
  const renderer = new marked.Renderer();
  renderer.heading = ({ text, depth, tokens }) => {
    const plainText = tokens.map((t) => ("text" in t ? (t as { text: string }).text : "")).join("") || text;
    const id = slugify(plainText);
    if (depth === 2) toc.push({ id, text: plainText });
    return `<h${depth} id="${id}">${text}</h${depth}>\n`;
  };
  renderer.link = ({ href, title, text }) => {
    const ev = href.match(/^event:\/\/(\d+)\/source\/(\d+)\/highlight\/(\d+)(?:#t=(.+))?$/);
    const h = ev ? `/events/${ev[1]}#h${ev[3]}` : href;
    return `<a href="${h}" target="_blank" rel="noreferrer"${title ? ` title="${title}"` : ev ? ` title="Event transcript${ev[4] ? ` at ${ev[4]}` : ""}"` : ""}>${text}</a>`;
  };
  const html = marked.parse(highlightClaims(md, claims), { renderer, gfm: true, breaks: false }) as string;
  return { html, toc };
}

export function wordCount(md: string): number {
  return md.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").split(/\s+/).filter(Boolean).length;
}
