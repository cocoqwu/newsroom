# CLAUDE.md: Newsroom

Internal-tool prototype for AGI House: frontier AI news in, publish-ready research posts out, with a
human editor making two calls (which story, is the draft ready). Built overnight Oct 22, 2026 for an
interview demo. **Prototype by Coco Wu, not an official AGI House product.**

## Commands

```bash
npm run dev -- --port 3100   # dev server (Browser pane uses http://localhost:3100)
npm run build                # production build; must exit 0 after every milestone
npm run check:keys           # one tiny call per model role, plus one image attempt
npm run pipeline             # full daily run: collect → cluster → rank → coverage memory (safe to rerun)
npm run demo:load            # load the saved snapshot of one real day (dates shifted to today)
npm run demo                 # dev server in demo mode: NEWSROOM_MODE=demo replays recorded model responses
npm run demo:seed-event      # create the sample (fictional) event if missing
npm run demo:save            # snapshot the latest live run + drafts into data/demo-snapshot.json
npm run db:reset             # wipe data/newsroom.db
scripts/dev-restart.sh       # restart the dev server safely (waits for port and db file to free up)
node scripts/screenshot.mjs <url> <out.png>   # 1440px PNG via local Chrome headless
```

## Architecture (see PLAN.md for detail)

- Next.js 16 App Router + Tailwind 4 + shadcn (Base UI "nova" style). Workspace routes live in
  `app/(workspace)` behind the three-pane shell; `app/preview/[id]` is the white blog-style page.
- SQLite file `data/newsroom.db` via better-sqlite3 + Drizzle (`lib/db`).
- All model calls go through `lib/llm` (one provider interface; Gemini live, replay/mock fallback).
  Roles: triage = gemini-3.5-flash-lite, draft = gemini-3.8-flash, image = gemini-nano-banana-2.1.
  The key is free tier: Pro and image models are unavailable, so the AI image card is a placeholder.
- Event capture in `lib/events` (transcripts, transcribe, highlights, consent, attach, boost) with
  screens under `app/(workspace)/events`; event evidence enters drafts as research notes with
  `event://` source URLs that the renderer turns into links to the highlight.
- Pipeline in `lib/pipeline`; draft steps in `lib/draft` (outline → research → write → factcheck →
  revise); header images in `lib/images`; exports (Markdown, HTML, Webflow payload, snippets) in
  `lib/export`. Sources, editorial profile, ranking weights and prices live in `config/`.
- Model fallback: each role has a chain (draft: 3.8 Flash → 3.6 Flash → 3.7 Flash → Flash-Lite).
  A 503 "high demand" retries once after 3 s, then the next model takes the call.
- SQLite runs in WAL mode with a 4-second checkpoint timer and a clean close on SIGTERM. Restart
  the dev server with `scripts/dev-restart.sh`, never by starting a second one on the same file.

## Design tokens

Measured from the live pages (globals.css has the comments). Workspace: page #09090b, panel
#18181b, fill/border #27272a, text #fafafa / #a1a1aa / #71717a, 8px radius, pill buttons, system
font, SF Mono numbers, 10px uppercase labels at 0.12em. Blog preview: white, Tenor Sans uppercase
H1 54/60 and H2 30/36, Source Serif 18/30 body, 10px Libre Franklin labels, 734px text column.

## Conventions

- Plain-language comments: the reader is a PM walking an interviewer through the code.
- Never print or commit the key. `.env.example` documents every setting.
- Every editor action is logged in `editor_actions`; every model call in `llm_calls` with cost.
- One failing source, model call or image must never fail a run or a screen.
- Log judgment calls in DECISIONS.md; keep MORNING_REPORT.md accurate after every milestone.
