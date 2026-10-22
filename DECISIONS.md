# Decisions log

Plain-language record of every judgment call, so Coco can review them in the morning.
Format: what was chosen, why, and the alternative that was not taken.

## Pre-flight (Oct 21, 2026, evening, with Coco present)

### 1. Project lives in `cs193v/projects/newsroom/`
- **Chose:** a new `newsroom/` folder inside the projects directory the session was opened in, with its own git repo.
- **Why:** the spec says "the project folder" without naming one, and the session's working directory was a parent folder holding several unrelated projects.
- **Alternative:** the Downloads folder where SPEC.md was written. Rejected because Downloads is not a place for a repo.

### 2. Gemini replaces the Anthropic API for text models
- **Chose:** the Gemini API via the official `@google/genai` SDK, free tier. Flash-Lite class for triage and scoring, Flash class for drafting and fact-checking. Exact model IDs are picked at build time from the live model list.
- **Why:** Coco has no Anthropic key and asked to use Gemini instead. Gemini supports JSON-schema structured output, which is what the pipeline parses.
- **Alternative:** buying prepaid Anthropic credits to follow the spec as written. Coco chose Gemini.
- **Follow-on:** all model calls go through one provider interface so swapping to Anthropic later is a config change, not a rewrite.

### 3. Research fetches source pages instead of using a search tool
- **Chose:** the research step reads the actual pages behind each story's collected links.
- **Why:** Google Search grounding is not available on the Gemini free tier. The collector already has primary-source links, and citing those is cleaner than citing search snippets.
- **Alternative:** paying for grounding. Rejected: it would spend money on text, which Coco limited to the free tier.

### 4. Hero images go through Vertex AI, not the Gemini Developer API
- **Chose:** generate images with a Gemini image model (Nano Banana family, planned: `gemini-3.1-flash-image`) on Vertex AI, authenticated with a Google Cloud API key from the project that holds the credits.
- **Why:** Google's billing docs state that Cloud welcome and free-trial credits "can't be used towards the Gemini API or AI Studio". Vertex AI is an ordinary Cloud service, so credits apply there. A plain API key also avoids the browser-based `gcloud` login that Coco asked me to avoid.
- **Alternative:** an AI Studio key created in the credits project. Simpler, but if the credits are the free-trial kind, text and image calls would be charged to a real card. Too risky unattended.
- **Price basis:** about $0.067 per 1K image, $0.045 at 512px, from Google's pricing pages. A $5 cap is roughly 70 images at 1K. The cap is enforced in code and every image is logged in `docs/image-spend-log.md`.

### 5. Two separate Google keys
- **Chose:** `GEMINI_API_KEY` (free tier, text only) and `GOOGLE_CLOUD_API_KEY` (credits project, images only), each used by exactly one code path.
- **Why:** Coco said the credits are only for image generation. Tier is set per project, so the text key must come from a project with no billing account.
- **Alternative:** one key for everything. Rejected because text would then bill to the credits project.

### 6. Git identity set per repo
- **Chose:** `git config user.name "Coco Wu"` and the account email, local to this repo only.
- **Why:** no global identity existed and commits need one. Nothing outside the project folder was changed.

## Oct 22, 2026, late evening (Coco present): one Gemini key for everything

Decisions 4 and 5 above are **superseded** by 7 to 10.

### 7. Single Gemini key, Gemini Developer API, no Vertex AI
- **Chose:** every model call, text and image, goes through the Gemini API with `GEMINI_API_KEY`.
- **Why:** Coco's Google account blocks service-account key creation, which ruled out the Vertex AI route. The pasted key was tested against both endpoints: the Gemini API accepts it (63 models visible); Vertex rejects it because that API is not enabled on the key's project.
- **Alternative:** the two-key Vertex plan from decision 4. Dropped at Coco's request.

### 8. Drafting runs on Gemini 3.8 Flash, not a Pro model
- **Chose:** `gemini-3.8-flash` for research, drafting and fact-checking; `gemini-3.5-flash-lite` for triage and scoring.
- **Why:** a tiny test call to `gemini-3.1-pro-preview` returned HTTP 429 "free_tier ... limit: 0", which means the key's project has no billing account and Pro models are unavailable. 3.8 Flash is the newest and strongest Flash the key can use. Both test calls passed (structured JSON from Flash-Lite in under a second).
- **Alternative:** enable billing on the key's Google Cloud project, then set `GEMINI_DRAFT_MODEL=gemini-3.1-pro-preview` ($2 in / $12 out per 1M tokens). The code reads the override, so no code change is needed.

### 9. AI hero image is built but inactive on this key
- **Chose:** the fourth image card calls `gemini-nano-banana-2.1` ($0.0336 per 1K image, the cheapest current image model) behind the same image interface as the SVG generator. On this key it shows a clear "enable billing to turn on" state instead of failing.
- **Why:** the one-image test returned the same free-tier 429. Google lists no image model as free. Coco asked that this feature never block the build.
- **To turn it on:** link a billing account to the key's project in the Google Cloud console and rerun `node scripts/check-keys.mjs --image-only`. Note Google's billing docs say Cloud trial credits cannot be spent on the Gemini API, so this would bill a card at list price. The $5 cap in `IMAGE_BUDGET_USD` is enforced in code.

### 10. Cost logging
- **Chose:** every model call records model, input and output tokens, and list-price cost; each pipeline run sums them and the Today screen shows the run cost. Images append to `docs/image-spend-log.md`. Prices live in one config table (`config/pricing.ts` at build time; the smoke test carries the same numbers).
- **Why:** the spec asks for cost per run, and Coco asked to keep spend low and log it. Free-tier calls cost $0 in reality; showing the list price keeps the number honest for the day billing is turned on.
- **Alternative:** reading actual charges from Google Cloud billing. Not possible from the API key alone.

## Overnight build, Oct 22, 2026 (unattended)

### 11. Scaffold copied in from a temp folder
- **Chose:** run `create-next-app` in the scratch folder and copy the result into `newsroom/`.
- **Why:** create-next-app refuses a folder that already holds SPEC.md and scripts.
- **Alternative:** hand-writing the Next config. More error-prone.

### 12. Next's cache components mode turned off
- **Chose:** `cacheComponents: false` in next.config.
- **Why:** every workspace page reads the SQLite file per request; the experimental cache mode would
  require Suspense boundaries or "use cache" on each data read, which adds risk for no demo benefit.
- **Alternative:** keep it on and wrap reads. Not worth it overnight.

### 13. Screenshots via local Chrome headless
- **Chose:** `scripts/screenshot.mjs` drives the Chrome already installed on the Mac.
- **Why:** full-resolution 1440px PNGs without installing Playwright's browsers (hundreds of MB).
- **Alternative:** the Browser pane's own screenshots (800px wide, fine for checks, small for docs).

### 14. Style decisions from the live CSS
- Labels use the events page's exact recipe (10px, 600, 0.12em). The blog's small labels use Libre
  Franklin (category) and Montserrat (author, date) as on the live post. The only accent color is
  rose-300, which the events page uses for dates; Newsroom uses it for the wildcard tag and
  unverified claims. Sidebar nav "Events" links out to the real site; "Newsroom" is our section.
