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
