# Morning report: Newsroom

Updated after every milestone so it is accurate even if the build stopped early.
Last update: **after milestone 1** (design tokens and style tile).

## Status at a glance

| Milestone | Status |
|---|---|
| 1. Design tokens and style tile, checked against live pages | **Done** |
| 2. Today screen on real data (collect, cluster, rank) | Not started |
| 3. Draft flow (outline, cited draft, fact-check, images) | Not started |
| 4. Publish screen, demo mode, README | Not started |
| 5. Final pass and demo script | Not started |

## What works

- `npm run build` exits 0. The app shell runs at `http://localhost:3100` with the three-pane layout
  (sidebar with search and an Events link, center column, right panel with Assistant / Links tabs).
- `/style-tile`: colors, type, buttons, tags, a story card and a blog heading block.
- `npm run check:keys`: the Gemini key passes for both text roles.

## What is mocked or unavailable

- **AI hero image**: the key is on Google's free tier, where no image model is available. The
  fourth image card will show an "enable billing to turn on" state. The three SVG headers are real.
- **Gemini Pro**: also not on the free tier, so drafting and fact-checking use Gemini 3.8 Flash.

## Screenshots (docs/screenshots)

| Style tile | Live events page | Live blog post |
|---|---|---|
| ![](docs/screenshots/m1-style-tile.png) | ![](docs/screenshots/m1-live-events.png) | ![](docs/screenshots/m1-live-blog-post.png) |

Measured values matched the spec: page #09090b, panels #18181b, fills #27272a, text #fafafa /
#a1a1aa / #71717a, 10px semibold uppercase labels with 1.2px tracking, 8px radii, pill buttons,
SF Mono stack. Blog: Tenor Sans 54/60 uppercase H1 and 30/36 H2, Source Serif Pro 18/30 body,
Libre Franklin and Montserrat 10px uppercase labels, 734px text column, 200px contents nav.

## Decisions to review (details in DECISIONS.md)

- Gemini for everything, free tier; Flash for drafting because Pro is unavailable.
- Next's experimental cache mode turned off so pages can read SQLite on each request.
- Screenshots come from the local Chrome in headless mode (nothing installed).

## Open questions

- None yet.

## How to run the demo

Coming with milestone 4 (demo mode). For now: `npm run dev -- --port 3100` and open `/style-tile`.

## What failed

- Nothing so far. The live events page screenshot needed a longer timeout (the site runs timers).
