# PLAN.md: Newsroom build plan

Written at the start of the overnight build (Oct 22, 2026). Plain language on purpose, so the
architecture can be explained in an interview. DECISIONS.md records judgment calls as they happen.

## What it is

Newsroom turns the daily flood of frontier AI news into publish-ready research posts for the AGI
House blog. A pipeline collects, clusters and ranks stories; an editor makes two calls: **which
story to cover** (Today screen) and **whether the draft is ready** (Draft screen); Publish exports
the result. Everything is one Next.js app with a local SQLite file.

## Architecture in one picture

```
 sources (RSS, arXiv, HF papers, GitHub, HN, press)
        │  collect: normalize to one Item schema
        ▼
   items ──► cluster (local embeddings + LLM check) ──► stories
                                                         │  rank: 7 signals → 0-100
                                                         ▼
                                      Today screen: top 10 (+ wildcard), Pick / Skip / Save
                                                         │ pick
                                                         ▼
    outline (LLM) → editor approves → research per section (fetch sources, save claims)
        → draft in house style → fact-check (separate call) → 3 SVG headers (+ AI image slot)
                                                         │
                                                         ▼
                   Publish: Markdown + HTML export, mock Webflow payload, newsletter + social
```

All model calls go through one provider interface (`lib/llm`). The Gemini implementation is the
only live provider; a replay/mock provider plays back recorded responses for demo mode and for
when the key is missing or rate-limited. Every call is logged with tokens and list-price cost.

## Stack

- Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, shadcn/ui.
- SQLite through better-sqlite3 + Drizzle ORM. One file: `data/newsroom.db` (git-ignored).
- `@google/genai` for Gemini. Roles: `triage` = gemini-3.5-flash-lite, `draft` = gemini-3.8-flash,
  `image` = gemini-nano-banana-2.1 (inactive on the free-tier key; shown as a placeholder).
- `@huggingface/transformers` (transformers.js) with a small sentence-embedding model for
  clustering and novelty. Falls back to a TF-IDF cosine if the model cannot load.
- `rss-parser` for feeds, native fetch for JSON APIs, `marked` for Markdown to HTML.

## File layout

```
app/
  layout.tsx                 three-pane shell: sidebar, center column, right assistant panel
  page.tsx                   redirects to /today
  today/page.tsx             daily digest
  draft/[id]/page.tsx        outline → draft → fact-check → images → revisions
  publish/[id]/page.tsx      exports, mock Webflow send, newsletter + social snippets
  preview/[id]/page.tsx      blog-style preview (white page, Tenor Sans + Source Serif)
  style-tile/page.tsx        milestone 1 design check
  api/**/route.ts            server actions for every editor action and pipeline step
components/
  shell/                     Sidebar, RightPanel (Assistant), SectionLabel, ModeBadge
  today/                     StoryCard, ScoreBreakdown, RunSummary, PickDialog
  draft/                     OutlineEditor, DraftBody, FactCheckPanel, ImagePicker, VersionList
  publish/                   ExportPanel, WebflowPayload, Snippets
  ui/                        shadcn components
lib/
  db/schema.ts, db/client.ts, db/queries.ts
  llm/provider.ts            the interface
  llm/gemini.ts              Gemini implementation
  llm/replay.ts              record/replay + mock fallback
  llm/index.ts               picks provider, logs usage + cost
  pipeline/collect.ts, sources/*.ts, cluster.ts, embeddings.ts, rank.ts, coverage.ts,
           research.ts, draft.ts, factcheck.ts, images.ts, run.ts
  export/markdown.ts, html.ts, webflow.ts, snippets.ts
  text.ts                    html→text, truncation helpers
config/
  editorial-profile.ts, sources.ts, ranking.ts, pricing.ts
scripts/
  run-pipeline.ts            `npm run pipeline` (safe to rerun), load-demo.ts, save-demo.ts,
  db-reset.ts, check-keys.mjs
data/
  demo-snapshot.json         one real day, committed
  llm-cache/                 recorded responses for replay, committed
docs/screenshots/            one PNG per screen per milestone
```

## Data model (SQLite)

- **runs**: id, started_at, finished_at, mode (live|demo), status, items_collected, stories_count,
  tokens_in, tokens_out, cost_usd, notes (JSON: per-source results, errors).
- **items**: id, run_id, source_id, source_name, source_type, title, url (unique), summary,
  author, published_at, fetched_at.
- **stories**: id, run_id, rank, is_wildcard, title, summary, why_now, format, primary_item_id,
  source_count, score_total, signals (JSON of the 7 values 0-1 and their notes), covered_before
  (JSON: url, title, similarity), embedding (JSON).
- **story_items**: story_id, item_id.
- **editor_actions**: id, story_id, action (pick|skip|save|approve_outline|revise|select_image|
  publish_mock|export), format, note, created_at. Every click is logged.
- **drafts**: id, story_id, status (outline|approved|drafting|drafted|checked), title, thesis,
  outline (JSON), body_md, current_version, created_at, updated_at.
- **draft_versions**: id, draft_id, version, body_md, note, created_at.
- **claims**: id, draft_id, text, section, status (verified|corrected|unverified), source_url,
  correction, note.
- **images**: id, draft_id, kind (svg|ai), label, svg, selected.
- **llm_calls**: id, run_id, draft_id, role, model, provider, tokens_in, tokens_out, cost_usd,
  duration_ms, cached, created_at.
- **past_posts**: id, url, title, category, published_at, summary, embedding (JSON).
- **settings**: key, value (house style guide, last run id, mode).

## Pipeline details

1. **Collect** (`lib/pipeline/collect.ts`): every source in `config/sources.ts` has an adapter
   (rss, arxiv, hf_papers, github, hn). Each returns normalized items or an error; errors are
   recorded per source and never fail the run. Only items newer than the last run (or the last 3
   days on first run) are kept; URL is the dedupe key.
2. **Cluster**: embed title + summary; greedy agglomerative merge above a similarity threshold;
   borderline pairs (between two thresholds) go to a batched Flash-Lite yes/no check. Primary
   source = the item from the highest-quality source (lab blog > paper > press > aggregator).
3. **Rank**: signals in [0,1]: theme_fit, significance (batched LLM judge with rubric from
   `config/editorial-profile.ts`), novelty (1 - max similarity to past posts), momentum
   (source count + HN points + GitHub stars, log-scaled), event_tie_in (keyword match to upcoming
   events), source_quality (per-source weight), freshness (hours since publish). Weighted total
   from `config/ranking.ts`. All stored.
4. **Coverage memory**: fetch blog.agihouse.org post list + 10-20 post pages, store summary +
   embedding, and ask the draft model for a short house-style guide (saved in settings).
5. **Research + draft**: outline call → approval → per-section research in parallel (fetch each
   source URL, extract text, Flash-Lite pulls claims with URL) → draft call with format template +
   style guide + claims → stored as version 1.
6. **Fact-check**: draft model, fresh context, receives claims + source excerpts, returns a status
   per claim. Unverified claims are highlighted in the preview.
7. **Images**: three seeded abstract SVGs from the story's theme in the blog palette, plus the AI
   image card (Gemini image model behind the same interface; "enable billing" state on this key).

## Rate limits and reliability

- Free tier: batch 8-10 stories per judge call, retry with backoff on 429, and cap LLM calls per
  run. If a call still fails, use the replay cache or a deterministic mock and mark the run.
- Demo mode: `npm run demo:load` seeds the DB from `data/demo-snapshot.json`; the UI shows a
  "Demo snapshot" badge. The draft flow in demo mode replays recorded model responses.

## Milestones (from SPEC.md)

1. Tokens + style tile, checked against the live pages. Screenshots side by side.
2. Today screen on real data: collect, cluster, rank, digest, run summary.
3. Draft flow: outline approval, cited draft, fact-check panel, three image options, revisions.
4. Publish screen (mock send), demo mode snapshot, README with screenshots.
5. Final run, full click-through, MORNING_REPORT.md with the demo script.

After each milestone: run the app, open it in the Browser pane, screenshot every screen to
`docs/screenshots/`, fix, `npm run build`, commit, update MORNING_REPORT.md.
