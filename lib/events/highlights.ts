// Pull 8 to 15 highlights out of one transcript with structured output, map speakers to the
// event's speaker list (for consent), and store them. The editor then stars, edits or rejects.
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";
import { generateJSON } from "@/lib/llm";
import { editorialProfile } from "@/config/editorial-profile";
import { truncate } from "@/lib/text";

export const highlightTypes = ["claim", "number", "prediction", "demo", "open_question"] as const;
export type HighlightType = (typeof highlightTypes)[number];
type Extracted = { speaker: string; timestamp: string; type: HighlightType; quote: string; paraphrase: string; tags: string[] };

export async function extractHighlights(sourceId: number): Promise<{ count: number; provider: string }> {
  const src = db.select().from(schema.eventSources).where(eq(schema.eventSources.id, sourceId)).get();
  if (!src?.transcript) throw new Error("source has no transcript yet");
  const event = db.select().from(schema.events).where(eq(schema.events.id, src.eventId)).get()!;
  const spk = db.select().from(schema.speakers).where(eq(schema.speakers.eventId, src.eventId)).all();
  const themeIds = editorialProfile.themes.map((t) => String(t.id));

  const r = await generateJSON<{ highlights: Extracted[] }>({
    role: "draft",
    task: "highlights",
    system: `You turn event transcripts into highlight cards for the editors of the ${editorialProfile.publication}. Audience: ${editorialProfile.audience.join("; ")}. Pick what a builder or researcher would want to know: specific claims, numbers, predictions, live demos and open questions. Quotes must be verbatim spans from the transcript, under 25 words. Paraphrases are one plain sentence. Tags come only from this list: ${themeIds.join(", ")}.`,
    prompt: `Event: ${event.name}${event.date ? ` (${event.date})` : ""}
Speakers on the bill: ${spk.map((s) => `${s.name}${s.title ? `, ${s.title}` : ""}`).join("; ") || "(none listed)"}
Source: ${src.label}

TRANSCRIPT:
${truncate(src.transcript, 60000)}

Return JSON {"highlights": [...]} with 8 to 15 items: speaker (name as it appears, or "Speaker N"), timestamp (the nearest [..] marker, like 12:34, or "" if none), type (one of ${highlightTypes.join(", ")}), quote (verbatim, under 25 words), paraphrase (one sentence), tags (1 to 3 ids from the list).`,
    schema: {
      type: "object",
      properties: {
        highlights: {
          type: "array",
          items: {
            type: "object",
            properties: {
              speaker: { type: "string" },
              timestamp: { type: "string" },
              type: { type: "string", enum: [...highlightTypes] },
              quote: { type: "string" },
              paraphrase: { type: "string" },
              tags: { type: "array", items: { type: "string", enum: themeIds } },
            },
            required: ["speaker", "timestamp", "type", "quote", "paraphrase", "tags"],
          },
        },
      },
      required: ["highlights"],
    },
    temperature: 0.2,
    fallback: () => ({ highlights: heuristicHighlights(src.transcript ?? "") }),
  });

  const items = (r.data.highlights ?? []).filter((h) => h?.quote && h?.paraphrase).slice(0, 15);
  db.delete(schema.highlights).where(eq(schema.highlights.sourceId, sourceId)).run();
  const now = new Date().toISOString();
  for (const h of items) {
    const match = matchSpeaker(h.speaker, spk);
    db.insert(schema.highlights).values({
      eventId: src.eventId, sourceId, speakerId: match?.id ?? null, speakerName: match?.name ?? h.speaker ?? null,
      timestamp: h.timestamp || null, type: highlightTypes.includes(h.type) ? h.type : "claim",
      quote: truncate(h.quote.replace(/^["“]|["”]$/g, ""), 220), paraphrase: truncate(h.paraphrase, 300),
      tags: JSON.stringify((h.tags ?? []).filter((t) => themeIds.includes(t)).slice(0, 3)), status: "new", createdAt: now,
    }).run();
  }
  return { count: items.length, provider: r.provider };
}

function matchSpeaker(name: string, spk: { id: number; name: string }[]) {
  const n = (name ?? "").toLowerCase().trim();
  if (!n) return null;
  return spk.find((s) => s.name.toLowerCase() === n) ?? spk.find((s) => n.includes(s.name.toLowerCase().split(" ")[0]) || s.name.toLowerCase().includes(n)) ?? null;
}

// No model: sentences with numbers, "will", "we built", or a question mark, one per speaker turn.
function heuristicHighlights(transcript: string): Extracted[] {
  const out: Extracted[] = [];
  for (const line of transcript.split("\n")) {
    const m = line.match(/^\[(\d{1,2}:\d{2}(?::\d{2})?)\]\s*([^:]{2,40}):\s*(.+)$/);
    if (!m) continue;
    const [, ts, speaker, body] = m;
    const sent = body.split(/(?<=[.!?])\s+/).find((s) => /\d|\bwill\b|\bwe built\b|\?/.test(s));
    if (!sent) continue;
    const type: HighlightType = /\?/.test(sent) ? "open_question" : /\bwill\b|by 20\d\d/.test(sent) ? "prediction" : /\d/.test(sent) ? "number" : /\bbuilt\b|\bdemo\b/.test(sent) ? "demo" : "claim";
    out.push({ speaker: speaker.trim(), timestamp: ts, type, quote: truncate(sent.split(" ").slice(0, 24).join(" "), 200), paraphrase: truncate(sent, 200), tags: [] });
    if (out.length >= 12) break;
  }
  return out;
}
