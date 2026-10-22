// Step 1 of the draft flow: a proposed title, thesis and outline. The editor edits and approves
// this before anything expensive runs.
import { db, schema } from "@/lib/db/client";
import { generateJSON } from "@/lib/llm";
import { editorialProfile } from "@/config/editorial-profile";
import { loadDraftContext, sourceList, touch, type Outline } from "./context";

export type OutlineProposal = { title: string; thesis: string; outline: Outline };

const schemaJson = {
  type: "object",
  properties: {
    title: { type: "string" },
    thesis: { type: "string" },
    outline: { type: "array", items: { type: "object", properties: { heading: { type: "string" }, bullets: { type: "array", items: { type: "string" } } }, required: ["heading", "bullets"] } },
  },
  required: ["title", "thesis", "outline"],
};

export async function proposeOutline(draftId: number): Promise<OutlineProposal> {
  const ctx = loadDraftContext(draftId);
  const pastTitles = db.select({ t: schema.pastPosts.title }).from(schema.pastPosts).all().map((r) => r.t).slice(0, 16);
  const r = await generateJSON<OutlineProposal>({
    role: "draft",
    task: "outline",
    draftId,
    system: `You are the editor of the ${editorialProfile.publication}, planning a post for ${editorialProfile.audience.join(", ")}.\n\nHouse style:\n${ctx.houseStyle}`,
    prompt: `Plan a ${ctx.template.name.toLowerCase()} about this story.

Story: ${ctx.story.title}
Why now: ${ctx.story.whyNow ?? ""}
Summary: ${ctx.story.summary ?? ""}
${ctx.draft.angleNote ? `Editor's angle note: ${ctx.draft.angleNote}\n` : ""}
Sources:
${sourceList(ctx.story)}

Format guidance: ${ctx.template.when}
Suggested section flow (adapt the wording to this story, keep roughly this shape): ${ctx.template.sections.join(" → ")}

Avoid duplicating these recent posts: ${pastTitles.join(" | ")}

Return JSON: title (specific, under 80 characters, Title Case, no colon-heavy clickbait), thesis (two sentences: what we claim and why it matters to builders), outline (4 to 6 sections; each heading in plain words, with 2 to 4 bullets of what the section must establish, naming sources where relevant).`,
    schema: schemaJson,
    temperature: 0.5,
    fallback: () => fallbackOutline(ctx.story.title, ctx.story.summary ?? "", [...ctx.template.sections]),
  });
  const proposal = normalize(r.data, ctx.story.title, [...ctx.template.sections]);
  touch(draftId, { title: proposal.title, thesis: proposal.thesis, outline: JSON.stringify(proposal.outline), status: "outline" });
  return proposal;
}

function normalize(p: OutlineProposal, fallbackTitle: string, sections: string[]): OutlineProposal {
  const outline = Array.isArray(p.outline) && p.outline.length ? p.outline.filter((s) => s?.heading).map((s) => ({ heading: String(s.heading).trim(), bullets: (s.bullets ?? []).map(String).filter(Boolean).slice(0, 5) })) : fallbackOutline(fallbackTitle, "", sections).outline;
  return { title: (p.title || fallbackTitle).trim().slice(0, 120), thesis: (p.thesis || "").trim(), outline };
}

function fallbackOutline(title: string, summary: string, sections: string[]): OutlineProposal {
  return {
    title,
    thesis: summary ? summary.split(/(?<=\.)\s/).slice(0, 2).join(" ") : `What ${title} means for builders.`,
    outline: sections.map((heading) => ({ heading, bullets: ["Establish the facts from the primary source", "Name who did it and when", "Say what it changes for builders"] })),
  };
}

export function approveOutline(draftId: number, edited: { title: string; thesis: string; outline: Outline }) {
  touch(draftId, { title: edited.title.trim(), thesis: edited.thesis.trim(), outline: JSON.stringify(edited.outline), status: "approved" });
}
