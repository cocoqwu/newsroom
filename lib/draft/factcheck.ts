// A separate model call that did not write the draft checks every factual claim against the
// saved research notes (claims + excerpts + URLs). Output per claim: verified, corrected or
// unverified, with the source. Unverified claims are highlighted in the preview.
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";
import { generateJSON } from "@/lib/llm";
import { loadDraftContext, touch } from "./context";
import { getResearchNotes } from "./research";

export type CheckedClaim = { text: string; kind: "name" | "number" | "date" | "quote" | "other"; status: "verified" | "corrected" | "unverified"; sourceUrl: string; correction?: string; note: string };

export async function factCheckDraft(draftId: number, log: (s: string) => void = console.log): Promise<{ total: number; verified: number; corrected: number; unverified: number }> {
  const ctx = loadDraftContext(draftId);
  const body = ctx.draft.bodyMd ?? "";
  const notes = getResearchNotes(draftId);
  const evidence = notes.map((n, i) => `[E${i + 1}] ${n.claim}\n    source: ${n.sourceUrl}\n    excerpt: "${n.excerpt ?? ""}"`).join("\n");

  const r = await generateJSON<{ claims: CheckedClaim[] }>({
    role: "draft",
    task: "factcheck",
    draftId,
    system: `You are a fact-checker. You did not write this draft and you have no loyalty to it. Your only evidence is the list of research claims with source excerpts. For each factual statement in the draft (names, numbers, dates, quotes, specific mechanisms), decide:
- verified: supported by an evidence item (cite its source URL)
- corrected: an evidence item contradicts it; give the correct version
- unverified: no evidence item supports it
Quotes longer than 15 words are flagged "corrected" with a shortened version. Copy claim text exactly as it appears in the draft (a contiguous span, under 160 characters, without Markdown link syntax if possible).`,
    prompt: `DRAFT:\n${body.slice(0, 24000)}\n\nEVIDENCE:\n${evidence || "(no research notes)"}\n\nReturn JSON {"claims": [{"text", "kind", "status", "sourceUrl", "correction", "note"}]} covering every checkable claim, 8 to 30 items.`,
    schema: {
      type: "object",
      properties: {
        claims: {
          type: "array",
          items: {
            type: "object",
            properties: {
              text: { type: "string" },
              kind: { type: "string", enum: ["name", "number", "date", "quote", "other"] },
              status: { type: "string", enum: ["verified", "corrected", "unverified"] },
              sourceUrl: { type: "string" },
              correction: { type: "string" },
              note: { type: "string" },
            },
            required: ["text", "kind", "status", "sourceUrl", "note"],
          },
        },
      },
      required: ["claims"],
    },
    temperature: 0,
    fallback: () => ({ claims: heuristicCheck(body, notes.map((n) => ({ claim: n.claim, url: n.sourceUrl }))) }),
  });

  db.delete(schema.claims).where(eq(schema.claims.draftId, draftId)).run();
  const list = (r.data.claims ?? []).filter((c) => c?.text).slice(0, 40);
  for (const c of list) {
    db.insert(schema.claims).values({ draftId, text: c.text.slice(0, 300), kind: c.kind ?? "other", status: c.status ?? "unverified", sourceUrl: c.sourceUrl || null, correction: c.correction || null, note: c.note ?? null }).run();
  }
  touch(draftId, { status: "checked" });
  const count = (s: string) => list.filter((c) => c.status === s).length;
  const out = { total: list.length, verified: count("verified"), corrected: count("corrected"), unverified: count("unverified") };
  log(`  fact-check: ${out.total} claims, ${out.verified} verified, ${out.corrected} corrected, ${out.unverified} unverified (${r.provider})`);
  return out;
}

// Without a model: numbers and years in the draft are verified if the same token appears in a note.
function heuristicCheck(body: string, notes: { claim: string; url: string }[]): CheckedClaim[] {
  const out: CheckedClaim[] = [];
  const sentences = body.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").split(/(?<=[.!?])\s+/);
  for (const s of sentences) {
    const m = s.match(/\b\d[\d,.]*%?|\b(19|20)\d{2}\b/);
    if (!m) continue;
    const token = m[0];
    const hit = notes.find((n) => n.claim.includes(token));
    out.push({ text: s.trim().slice(0, 160), kind: /\b(19|20)\d{2}\b/.test(token) ? "date" : "number", status: hit ? "verified" : "unverified", sourceUrl: hit?.url ?? "", note: hit ? "token found in a research note" : "no research note contains this value" });
    if (out.length >= 20) break;
  }
  return out;
}

export function getClaims(draftId: number) {
  return db.select().from(schema.claims).where(eq(schema.claims.draftId, draftId)).all();
}
