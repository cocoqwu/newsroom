// Newsletter blurb and social post from the final text. One draft-model call; stored on the draft.
import { generateJSON } from "@/lib/llm";
import { loadDraftContext, touch } from "@/lib/draft/context";
import { truncate } from "@/lib/text";

export type Snippets = { newsletter: string; social: string; linkedin: string; generatedAt: string };

export async function generateSnippets(draftId: number): Promise<Snippets> {
  const ctx = loadDraftContext(draftId);
  const body = (ctx.draft.bodyMd ?? "").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
  const r = await generateJSON<Omit<Snippets, "generatedAt">>({
    role: "draft",
    task: "snippets",
    draftId,
    system: "You write short promotional copy for a technical research blog. Plain, specific, no hype, no emoji, no hashtags except at most one topical tag on the social post.",
    prompt: `Post title: ${ctx.draft.title}\nThesis: ${ctx.draft.thesis}\n\nPost text:\n${truncate(body, 9000)}\n\nReturn JSON with:\n- newsletter: 80 to 120 words for the AGI House newsletter, ending with "Read the full post: [link]".\n- social: a post for X under 260 characters that states the most concrete finding.\n- linkedin: 3 short paragraphs, under 600 characters total, for LinkedIn, ending with a question for builders.`,
    schema: { type: "object", properties: { newsletter: { type: "string" }, social: { type: "string" }, linkedin: { type: "string" } }, required: ["newsletter", "social", "linkedin"] },
    temperature: 0.6,
    fallback: () => ({
      newsletter: `${ctx.draft.title}. ${ctx.draft.thesis ?? ""} Read the full post: [link]`,
      social: truncate(`${ctx.draft.title}: ${ctx.draft.thesis ?? ""}`, 250),
      linkedin: `${ctx.draft.title}\n\n${ctx.draft.thesis ?? ""}\n\nWhat would you build with this?`,
    }),
  });
  const snippets: Snippets = { ...r.data, generatedAt: new Date().toISOString() };
  touch(draftId, { snippets: JSON.stringify(snippets) });
  return snippets;
}
