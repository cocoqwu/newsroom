// SQLite schema (Drizzle). One table per noun in PLAN.md. JSON columns hold small structured blobs.
import { sqliteTable, text, integer, real, primaryKey } from "drizzle-orm/sqlite-core";

export const runs = sqliteTable("runs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  startedAt: text("started_at").notNull(),
  finishedAt: text("finished_at"),
  mode: text("mode").notNull().default("live"), // live | demo
  status: text("status").notNull().default("running"), // running | done | failed
  itemsCollected: integer("items_collected").notNull().default(0),
  storiesCount: integer("stories_count").notNull().default(0),
  tokensIn: integer("tokens_in").notNull().default(0),
  tokensOut: integer("tokens_out").notNull().default(0),
  costUsd: real("cost_usd").notNull().default(0),
  notes: text("notes"), // JSON: per-source results, step timings, errors
});

export const items = sqliteTable("items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  runId: integer("run_id").notNull(),
  sourceId: text("source_id").notNull(),
  sourceName: text("source_name").notNull(),
  sourceType: text("source_type").notNull(),
  sourceGroup: text("source_group").notNull(),
  sourceQuality: real("source_quality").notNull(),
  title: text("title").notNull(),
  url: text("url").notNull().unique(),
  summary: text("summary"),
  author: text("author"),
  publishedAt: text("published_at"),
  fetchedAt: text("fetched_at").notNull(),
  signals: text("signals"), // JSON: points, stars, upvotes, comments
});

export const stories = sqliteTable("stories", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  runId: integer("run_id").notNull(),
  rank: integer("rank"), // 1..N within the run; null if not ranked
  isWildcard: integer("is_wildcard", { mode: "boolean" }).notNull().default(false),
  title: text("title").notNull(),
  summary: text("summary"),
  whyNow: text("why_now"),
  theme: text("theme"),
  format: text("format"), // technical-primer | research-brief | event-recap
  primaryItemId: integer("primary_item_id"),
  sourceCount: integer("source_count").notNull().default(1),
  scoreTotal: real("score_total"),
  signals: text("signals"), // JSON: { signalId: { value, note } }
  coveredBefore: text("covered_before"), // JSON: { url, title, similarity } | null
  embedding: text("embedding"), // JSON number[]
  status: text("status").notNull().default("new"), // new | picked | skipped | saved
});

export const storyItems = sqliteTable(
  "story_items",
  {
    storyId: integer("story_id").notNull(),
    itemId: integer("item_id").notNull(),
  },
  (t) => [primaryKey({ columns: [t.storyId, t.itemId] })]
);

export const editorActions = sqliteTable("editor_actions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  storyId: integer("story_id"),
  draftId: integer("draft_id"),
  action: text("action").notNull(),
  format: text("format"),
  note: text("note"),
  createdAt: text("created_at").notNull(),
});

export const drafts = sqliteTable("drafts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  storyId: integer("story_id").notNull(),
  status: text("status").notNull().default("outline"), // outline | approved | drafting | drafted | checked
  format: text("format").notNull(),
  angleNote: text("angle_note"),
  title: text("title"),
  thesis: text("thesis"),
  outline: text("outline"), // JSON: [{ heading, bullets[] }]
  bodyMd: text("body_md"),
  currentVersion: integer("current_version").notNull().default(0),
  selectedImageId: integer("selected_image_id"),
  snippets: text("snippets"), // JSON: { newsletter, social, generatedAt }
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const draftVersions = sqliteTable("draft_versions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  draftId: integer("draft_id").notNull(),
  version: integer("version").notNull(),
  bodyMd: text("body_md").notNull(),
  note: text("note"),
  createdAt: text("created_at").notNull(),
});

export const claims = sqliteTable("claims", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  draftId: integer("draft_id").notNull(),
  section: text("section"),
  text: text("text").notNull(),
  kind: text("kind"), // name | number | date | quote | other
  sourceUrl: text("source_url"),
  status: text("status").notNull().default("pending"), // pending | verified | corrected | unverified
  correction: text("correction"),
  note: text("note"),
});

export const researchNotes = sqliteTable("research_notes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  draftId: integer("draft_id").notNull(),
  section: text("section").notNull(),
  claim: text("claim").notNull(),
  sourceUrl: text("source_url").notNull(),
  excerpt: text("excerpt"),
});

export const images = sqliteTable("images", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  draftId: integer("draft_id").notNull(),
  kind: text("kind").notNull(), // svg | ai
  label: text("label").notNull(),
  svg: text("svg"),
  dataUrl: text("data_url"),
  status: text("status").notNull().default("ready"), // ready | unavailable
  note: text("note"),
});

export const llmCalls = sqliteTable("llm_calls", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  runId: integer("run_id"),
  draftId: integer("draft_id"),
  role: text("role").notNull(), // triage | draft | image
  task: text("task").notNull(), // judge | cluster-check | outline | research | draft | factcheck | revise | ...
  model: text("model").notNull(),
  provider: text("provider").notNull(), // gemini | replay | mock
  tokensIn: integer("tokens_in").notNull().default(0),
  tokensOut: integer("tokens_out").notNull().default(0),
  costUsd: real("cost_usd").notNull().default(0),
  durationMs: integer("duration_ms").notNull().default(0),
  ok: integer("ok", { mode: "boolean" }).notNull().default(true),
  error: text("error"),
  createdAt: text("created_at").notNull(),
});

export const pastPosts = sqliteTable("past_posts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  url: text("url").notNull().unique(),
  title: text("title").notNull(),
  category: text("category"),
  publishedAt: text("published_at"),
  summary: text("summary"),
  embedding: text("embedding"),
  fetchedAt: text("fetched_at").notNull(),
});

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: text("updated_at").notNull(),
});

// ---- Event Capture: in-person talks, panels and demos become highlights that feed posts ----

export const events = sqliteTable("events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  date: text("date"), // YYYY-MM-DD
  description: text("description"),
  isSample: integer("is_sample", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull(),
});

export const speakers = sqliteTable("speakers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  eventId: integer("event_id").notNull(),
  name: text("name").notNull(),
  title: text("title"),
  // approved = may be quoted directly; paraphrase = ideas only, no direct quotes; off = off the record
  permission: text("permission").notNull().default("paraphrase"),
});

export const eventSources = sqliteTable("event_sources", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  eventId: integer("event_id").notNull(),
  kind: text("kind").notNull(), // paste | transcript | audio | video
  label: text("label").notNull(),
  mime: text("mime"),
  sizeBytes: integer("size_bytes"),
  transcript: text("transcript"),
  status: text("status").notNull().default("ready"), // ready | transcribing | failed
  note: text("note"),
  createdAt: text("created_at").notNull(),
});

export const highlights = sqliteTable("highlights", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  eventId: integer("event_id").notNull(),
  sourceId: integer("source_id").notNull(),
  speakerId: integer("speaker_id"),
  speakerName: text("speaker_name"),
  timestamp: text("timestamp"), // mm:ss or hh:mm:ss as spoken in the transcript
  type: text("type").notNull(), // claim | number | prediction | demo | open_question
  quote: text("quote").notNull(),
  paraphrase: text("paraphrase").notNull(),
  tags: text("tags"), // JSON string[] of theme ids
  status: text("status").notNull().default("new"), // new | starred | rejected
  edited: integer("edited", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull(),
});
