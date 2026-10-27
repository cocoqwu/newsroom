# Decisions log

Plain-language record of every judgment call, so Coco can review them in the morning.
Format: what was chosen, why, and the alternative that was not taken.

## Pre-flight (Oct 21, 2026, evening, with Coco present)

### 1. Project lives in its own `newsroom/` folder
- **Chose:** a new `newsroom/` folder with its own git repo, separate from any other work on the machine.
- **Why:** the spec says "the project folder" without naming one, and the working directory at the time was a parent folder holding unrelated projects.
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

### 15. Rank the 72-hour window, not only new items
- **Chose:** every run builds stories from all items published in the lookback window; new items are inserted, known ones reused.
- **Why:** "safe to rerun" has to mean a second run the same day still shows a full digest. Strictly "new since last run" would give an empty Today screen on rerun.
- **Alternative:** strict delta plus carrying forward yesterday's stories. More state, same demo.

### 16. Sources with no feed stay in the config, marked disabled
- **Chose:** Anthropic, xAI (no RSS) and VentureBeat (429 for bots) keep an entry with a `disabled` reason, shown as "no feed" in the run summary.
- **Why:** honesty in the UI about what is not covered, and a slot for a future HTML adapter.
- **Alternative:** scrape their news pages. Skipped: the spec asks for feeds and official APIs.

### 17. Judge batching and the free-tier cap
- **Chose:** 8 stories per judge call, at most 12 calls per run (`JUDGE_MAX_CALLS`), ordered by a cheap heuristic so the likely-important stories are judged first; the rest keep heuristic values.
- **Why:** free-tier rate limits and a demo-friendly run time (about 100 s). Cost at list price: about 3 cents per run.

### 18. Two rubric tweaks after the first real run
- Significance: a lone arXiv preprint with no pickup is capped near 0.45. Event tie-in: one generic keyword gives 0.4, two or more give 1.0. Both because the first digest was all single-source papers with "event tie-in 1.0" from the word "agent".

### 19. Model fallback chain per role
- **Chose:** draft role tries gemini-3.8-flash, then 3.6-flash, 2.5-flash, then the triage model; triage tries 3.5-flash-lite, 3.1-flash-lite, 2.5-flash-lite. One quick retry on 503, one 20 s retry on 429, then the next model.
- **Why:** during the build, 3.8 Flash answered "high demand" (503) for minutes at a time. Without the chain the outline and draft fell back to the heuristic mock.
- **Trade-off:** a draft written by a smaller model is shorter and plainer. The model that actually answered is logged per call and shown in the step detail.

### 20. Database durability after a lost batch of writes
- **What happened:** after restarting the dev server once, several minutes of committed writes (a draft body, claims, model-call rows) were missing, while the on-disk replay cache proved the calls had happened. A direct reproduction (write, kill, read) did not lose data, so the likely cause is the old and new server overlapping on the WAL file during a one-second restart.
- **Chose:** `synchronous=FULL`, a passive WAL checkpoint every 4 s, a clean close on SIGTERM/SIGINT/exit, and `scripts/dev-restart.sh`, which waits for the port and the db file to be free before starting again.
- **Safety net:** `npm run demo:load` restores the committed snapshot in seconds, so the live demo never depends on the local db surviving.

### 21. Webflow "send" is a payload, not a request
- **Chose:** build the exact Webflow CMS API v2 request (POST to the collection's items endpoint, `isDraft: true`, field data with slug, summary, body HTML, category, author, date, image slot) and show it in the UI; the button logs a mock send and transmits nothing.
- **Why:** the spec calls for a mock, and the real call needs the AGI House site token and collection id. Showing the payload makes the handoff concrete for whoever wires it up.

### 22. Demo snapshot shifts dates to today
- **Chose:** `demo:load` moves every timestamp so the saved run reads as "collected 20 minutes ago", marks the run `mode=demo` and keeps the original date in the run notes; the UI shows a "Demo snapshot" badge.
- **Why:** a digest dated three days ago looks broken in a live demo; the badge keeps it honest.

### 23. Replay is exact-match only
- **Chose:** demo mode (and outage fallback) replays a recorded response only when model, prompt and schema match exactly; otherwise a labeled heuristic answers and the UI says so ("heuristic placeholder", "no model was reachable").
- **Why:** the first version replayed the newest response for the same task, which put the NVIDIA Cosmos outline on a different story. Wrong content with a confident face is worse than an honest placeholder.
- **Consequence for the demo:** the recorded story (the one in the snapshot) replays every step; picking a new story in demo mode shows placeholders. The demo script uses the recorded story.

### 24. Chain adjusted after the final run
- `gemini-2.5-flash` returned 404 "no longer available to new users", so the draft chain is now 3.8 Flash → 3.6 Flash → 3.7 Flash → Flash-Lite, and a 404 puts a model on cooldown like a spent quota.
- One model output carried a control character inside "Lovász"; it was cleaned in the database by hand. Roadmap item: strip control characters from model text in the provider layer.

## Event Capture branch (Oct 25, 2026)

### 25. Event evidence rides the existing research-note rail
- **Chose:** a starred highlight attached to a draft becomes a `research_notes` row whose source URL is `event://{event}/source/{source}/highlight/{id}#t={timestamp}`. Research keeps those rows, the writer sees them as claims, the fact-checker sees them as evidence, and the renderer turns the URL into a link to the highlight card.
- **Why:** no new concept for the draft flow to learn; the fact-check panel "treats the transcript timestamp as the source" for free.
- **Alternative:** a separate evidence table and a second prompt section. More code, same effect.

### 26. Consent is enforced in three places, not one
- **Chose:** the attach step tags each note "[direct quote allowed]" or "[paraphrase only, no direct quote]" and drops off-the-record speakers entirely; the writer's system prompt forbids quoting a paraphrase-only note; the fact-checker flags any such quotation as "corrected". Every highlight card shows the speaker's current permission, and changing a permission applies to all cards at once.
- **Why:** a single prompt rule is not a guarantee. Belt, braces and a checker.
- **Default:** paraphrase only, as the spec asks, so nothing is quotable until someone says so.

### 27. Boosts are narrow and re-rank the digest
- **Chose:** a starred highlight boosts a Today story only with a shared theme tag plus two specific shared words, or four shared words; at most eight stories per event; theme fit +0.15 and event tie-in +0.5; the run is re-ranked by the new totals; the signal note says which event caused it. Un-starring restores the base values.
- **Why:** the first version matched 76 of 269 stories on the word "agent". That is noise, not a signal.

### 28. Transcription limits
- **Chose:** inline upload under 18 MB, the Files API up to 100 MB, three Flash models tried in turn, and any failure saved as a source in "failed" state with a plain message asking for a transcript. Demo mode never transcribes.
- **Why:** the free-tier key is rate-limited and no audio was available to test at scale tonight; the UI must degrade to "paste a transcript" without losing the upload.

### 29. The sample event is fictional and says so
- **Chose:** a panel transcript written for this project with invented speakers, companies and numbers, marked "sample · fictional" in the list, on the event page and inside the transcript itself. Three speakers cover the three consent levels so the demo shows all three behaviors.

### 30. demo:load refuses to run while the app holds the database
- **What happened:** a load during a running server corrupted the SQLite file (two processes rewriting every table through the WAL at once). Rebuilt from the committed snapshot; integrity check passes.
- **Chose:** the load script checks for another process holding the file (via lsof) and stops with the exact fix. The snapshot remains the source of truth for the demo.
