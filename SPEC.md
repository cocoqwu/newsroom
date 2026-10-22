# Build: Newsroom, a prototype for AGI House

## Context
I'm interviewing for an AI product manager role at AGI House, an AI community and research organization in Hillsborough, CA. Their research blog (https://blog.agihouse.org) publishes long technical primers before events, such as https://blog.agihouse.org/posts/voice-agents-research-brief. I want to show I can build tools, not only write: a working prototype of an internal tool that turns the daily flood of frontier AI news into publish-ready research posts, with a human editor making two calls: which story to cover, and whether the draft is ready.

This is for a live interview demo on Friday. Optimize for a polished, reliable demo of the core flow on real data, be honest in the UI about anything mocked, and build it so it could become a real internal tool.

## Pre-flight: do this first, then stop and wait for me
When I first send this spec, do only the following, then report back as a short checklist and wait. Don't start building yet.
1. Save this spec as SPEC.md in the project folder and initialize git.
2. Check that Node.js 20 or newer is installed. If it isn't, tell me how to install it.
3. Create .env.local containing an empty ANTHROPIC_API_KEY= line, add it to .gitignore, and ask me to paste my key into the file. Once I confirm, make one small test call to check that the key works.
4. Confirm you can open a page in the Browser pane.
I'll start the overnight build afterwards with /goal.

## How to work: you are building this overnight, unattended
I'll be asleep while you build. Nobody can answer questions or approve anything until morning, so:
- Never stop to ask me. When something is ambiguous, pick the most reasonable option, log it in DECISIONS.md (what you chose, why, and the alternative), and keep going.
- Start by writing PLAN.md (architecture, file layout, data model, milestone plan), then build. Don't wait for approval.
- Work through the milestones below in order. After each one: run the app, open it in the Browser pane, click through every screen, save screenshots to docs/screenshots/, fix what you find, make sure `npm run build` succeeds, and commit with a clear message.
- Stop any dev server or other background process before you end each turn, so the goal's progress check can run.
- Update MORNING_REPORT.md after every milestone, so it's accurate even if you stop early: what works, what is mocked, screenshots, decisions I should review, open questions, how to run the demo, and anything that failed.
- If you're stuck on one problem after a few genuine attempts, mock it behind the same interface, note it in MORNING_REPORT.md, and move on. One blocker must never stop the whole build.
- Stay inside this project folder. Don't change system settings, install system software, sign up for services or spend money. The only paid service is the Anthropic key in .env.local.
- Never commit .env.local, and document every setting in .env.example. If the API key is missing or fails, use recorded mock responses behind the same interface and say so in the report.
- Write the report and code comments in plain language. I'm a PM, not a full-time engineer, and I need to walk an interviewer through how it works.
- Keep a CLAUDE.md with the architecture, commands and decisions as you go.
- This runs on a usage budget. Use subagents only where they clearly help, and keep the work focused on this spec.
- If time or usage runs short, cut in this order: newsletter and social snippets, the Publish screen, the wildcard slot. Never cut demo mode or the morning report.

## Stack
- Next.js (App Router), TypeScript, Tailwind CSS and shadcn/ui, so the UI can closely match AGI House's own app.
- SQLite (Drizzle or better-sqlite3) for items, stories, scores, picks, drafts and run logs.
- Anthropic API through the official TypeScript SDK: a small, cheap model (Claude Haiku) for high-volume triage and scoring, and a stronger model (Claude Sonnet or Opus) for research, drafting and fact-checking. Use structured outputs for anything the code parses. For research that needs the web, use the API's web search tool if my account has it; otherwise use the simplest alternative and note it in DECISIONS.md.
- For clustering, use a small local embedding model (for example through transformers.js) so no extra API key is needed.
- Track token cost per pipeline run and show it in the UI.

## Look and feel: match AGI House
This should look like it belongs inside AGI House's product. There are two surfaces with two styles.

1. The workspace UI matches their app at https://www.agihouse.org/events:
   - Dark theme on Tailwind's zinc scale: page #09090b, panels #18181b, borders and fills #27272a, primary text #fafafa, secondary text #a1a1aa and #71717a.
   - The system font stack (-apple-system, Segoe UI, Roboto), with a monospace font for numbers and code.
   - 8px corner radius on cards and inputs, pill-shaped buttons, and small uppercase section labels in muted grey with slight letter spacing (like "NEXT UP" and "QUICK LINKS" on their site).
   - Their three-pane layout: a left sidebar with search and navigation (add "Newsroom" as a section next to "Events"), a center content column about 820px wide, and a right panel. Use the right panel for the AI assistant, the same way their app has an "Assistant" tab there.
2. The draft preview matches their blog at https://blog.agihouse.org:
   - White page, black text, a black top bar.
   - Headlines in Tenor Sans, uppercase, regular weight (H1 about 54px with 60px line height, H2 about 30px). Body text in Source Serif Pro, 18px on 30px lines. Small uppercase sans-serif labels for category, author and date.
   - A contents sidebar and a thin black rule above the hero image, like their posts. Both fonts are free Google Fonts.

Before building any screens, open those two pages yourself, confirm or correct these values from their live CSS, and put them in the Tailwind theme as design tokens. Then build a one-page style tile (colors, type, a story card, a button, a tag, a blog heading), screenshot it next to screenshots of both live pages, and adjust until they clearly look like the same family. Save all three images to docs/screenshots/ for my review in the morning.

Do not copy AGI House's logo or present this as an official AGI House product. Use "Newsroom" as the section name, with a small "Prototype by Coco Wu" label in the sidebar footer and in the README.

## Screens
1. Today (the daily digest)
   - The top 10 stories as ranked cards. Each card shows the title, one line on why it matters now, the 0 to 100 score with an expandable breakdown, source count with links, a suggested format (technical primer, research brief or event recap), and a "covered before" flag linking the matching past post.
   - Slot 10 is a wildcard from ranks 11 to 30, labeled as such.
   - Actions: Pick (choose a format and add an angle note), Skip, Save for later. Log every action.
   - A run summary: when collection ran, items collected, stories after clustering, and the cost of the run.
2. Draft
   - Step 1: a proposed title, thesis and outline for the picked story. The editor edits and approves it before anything else runs.
   - Step 2: the full draft in house style, with inline links to primary sources, rendered in the blog-style preview.
   - A fact-check panel: every factual claim (names, numbers, dates, quotes) marked verified, corrected or unverified, with its source. Unverified claims are highlighted in the draft.
   - Image options: three header images side by side; the editor picks one.
   - Revision: the editor can edit inline, or select text and ask the assistant panel for a change ("tighten this paragraph"). Untouched sections stay as they are. Keep version history.
3. Publish
   - Export Markdown and HTML.
   - "Send to blog as draft" is a mock in this version. Show the exact payload it would send to the Webflow CMS API, and explain in the UI that a real integration needs an API token from the AGI House team.
   - Generate a newsletter blurb and a social post from the final text.

## Pipeline
1. Collect: pull new items since the last run from the sources in config/sources.ts: frontier lab blogs (OpenAI, Anthropic, Google DeepMind, Meta AI, Microsoft Research, NVIDIA, Mistral, xAI and others), arXiv (cs.AI, cs.LG, cs.CL, cs.CV, cs.RO), Hugging Face daily papers, trending ML repos on GitHub, Hacker News, and tech press RSS. Normalize to one schema. Use RSS feeds or official APIs where they exist, respect robots rules and rate limits, and store a summary and link rather than full text. One failing source must not fail the run.
2. Cluster: merge items about the same event into one story (embedding similarity plus an LLM check on borderline pairs). Each story keeps all its sources and names one primary source.
3. Rank: score each story 0 to 1 on seven signals and compute a weighted 0 to 100 total. Starting weights: theme fit 25, significance 20, novelty 15, momentum 15, event tie-in 10, source quality 10, freshness 5. Theme fit and significance use an LLM judge with a written rubric against config/editorial-profile.ts; novelty compares against past posts; momentum uses cross-source counts and public signals. Store every signal value, not only the total.
4. Coverage memory: fetch 10 to 20 recent posts from blog.agihouse.org to compute novelty and the "covered before" flag, and to write a short house-style guide.
5. Research and draft: research in parallel by outline section, saving each claim with its source URL. Draft in house style using the chosen format's template.
6. Fact-check: a separate model call that did not write the draft checks each claim against the saved sources. Quotes stay under 15 words and attributed.
7. Images: by default, generate three abstract SVG header graphics from the post's theme in the blog's palette (free, on-brand, no rights issues). Leave a clearly marked spot to add an image-model option later. Never reuse figures from papers or articles.

## Config to create with sensible placeholders
- config/editorial-profile.ts: audience (founders, engineers, researchers), focus themes with weights (self-improving systems and AI for science, physical AI, agents, world models, voice), formats, upcoming events and sponsors, house style notes.
- config/sources.ts: each source with type, URL and cadence.
- config/ranking.ts: signal weights.

## Demo reliability
- Add a demo mode that loads a saved snapshot of one real day (collected items, ranked stories, one finished draft with its fact-check report and images), generated from a real run, so the live demo works even if the network or an API fails.
- Add one command that runs the full daily pipeline end to end, safe to rerun.
- Write a README: what it does, a screenshot of each screen, how to run it, what is real versus mocked, and a short roadmap (a scheduled daily run, a Slack digest each morning, real Webflow publishing, ranking weights that learn from the editor's picks).

## Milestones
1. Design tokens and style tile, checked against the live pages (no screens yet).
2. Today screen working on real data: collect, cluster, rank, digest.
3. Draft flow working for one picked story: outline approval, cited draft, fact-check panel, three image options.
4. Publish screen (mocked send), demo mode with a saved snapshot, README with screenshots.
5. Final pass: run the full pipeline once more, click through the whole demo flow in the Browser pane, fix anything rough, and finish MORNING_REPORT.md with a step-by-step demo script I can rehearse.
