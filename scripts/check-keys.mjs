#!/usr/bin/env node
// Smoke test for the Gemini key in .env.local.
//
//   node scripts/check-keys.mjs              text + image checks
//   node scripts/check-keys.mjs --text-only
//   node scripts/check-keys.mjs --image-only
//
// Plain language: this makes one tiny call per model role so we know the key works before a
// pipeline run. The text calls cost nothing on the free tier. The image call generates ONE 16:9
// hero image, logs its list price in docs/image-spend-log.md and refuses to run past
// IMAGE_BUDGET_USD. The key value is never printed. No npm packages needed (Node 20+ has fetch).

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ENV_FILE = path.join(ROOT, ".env.local");
const SPEND_LOG = path.join(ROOT, "docs", "image-spend-log.md");
const TEST_IMAGE = path.join(ROOT, "docs", "hero-image-test.png");
const BASE = "https://generativelanguage.googleapis.com/v1beta";

// Default model per role. Overridable in .env.local. Chosen from the models the key can reach.
const DEFAULT_MODELS = {
  triage: "gemini-3.5-flash-lite",   // fast, cheap: triage, scoring, borderline-cluster checks
  draft: "gemini-3.8-flash",         // stronger: research, drafting, fact-check (strongest free-tier Flash)
  image: "gemini-nano-banana-2.1",   // hero images; needs a project with billing
};

// Google list prices, Oct 2026, USD. Text per 1M tokens; images per generated image.
// Free-tier calls are billed at $0; we still show the list price so cost per run is visible.
const TEXT_PRICES = {
  "gemini-3.5-flash-lite": { in: 0.30, out: 2.50 },
  "gemini-3.1-flash-lite": { in: 0.25, out: 1.50 },
  "gemini-2.5-flash-lite": { in: 0.10, out: 0.40 },
  "gemini-3.8-flash": { in: 0.75, out: 3.75 },
  "gemini-3.6-flash": { in: 0.75, out: 3.75 },
  "gemini-2.5-flash": { in: 0.30, out: 2.50 },
  "gemini-3.1-pro-preview": { in: 2.00, out: 12.00 },
  "gemini-2.5-pro": { in: 1.25, out: 10.00 },
};
const IMAGE_PRICES = {
  "gemini-nano-banana-2.1": { "1K": 0.0336, "2K": 0.0504, "4K": 0.113 },
  "gemini-3.1-flash-image": { "0.5K": 0.045, "1K": 0.067, "2K": 0.101, "4K": 0.151 },
  "gemini-3.1-flash-lite-image": { "1K": 0.0336 },
};

// ---------- helpers ----------

function loadEnv(file) {
  const env = {};
  if (!fs.existsSync(file)) return env;
  for (const raw of fs.readFileSync(file, "utf8").split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
    env[line.slice(0, eq).trim()] = val;
  }
  return env;
}

async function readJson(res) {
  const text = await res.text();
  try { return JSON.parse(text); } catch { return { raw: text.slice(0, 300) }; }
}

// Error text with the key scrubbed, just in case an API ever echoes it.
function errorSummary(json, key) {
  const msg = json?.error?.message ?? json?.raw ?? JSON.stringify(json);
  return String(msg).split(key).join("[KEY]").replace(/\s+/g, " ").slice(0, 320);
}

function textCost(model, usage) {
  const p = TEXT_PRICES[model];
  if (!p) return null;
  const inTok = usage.promptTokenCount ?? 0;
  const outTok = (usage.candidatesTokenCount ?? 0) + (usage.thoughtsTokenCount ?? 0);
  return (inTok * p.in + outTok * p.out) / 1e6;
}

function readSpend() {
  if (!fs.existsSync(SPEND_LOG)) return 0;
  let total = 0;
  for (const line of fs.readFileSync(SPEND_LOG, "utf8").split("\n")) {
    const cells = line.split("|").map((c) => c.trim());
    if (cells.length >= 7 && /^\d{4}-\d{2}-\d{2}/.test(cells[1])) {
      const price = Number(cells[5]);
      if (!Number.isNaN(price)) total += price;
    }
  }
  return total;
}

function appendSpend({ model, size, purpose, price }) {
  const header =
    "# Image spend log\n\n" +
    "Every AI-generated image, with its list price in US dollars. The cap is IMAGE_BUDGET_USD in .env.local.\n" +
    "Prices are Google's published per-image list prices, not a bill: check the Google Cloud console for actual charges.\n\n" +
    "| When (UTC) | Model | Size | Purpose | Price (USD) | Running total (USD) |\n" +
    "|---|---|---|---|---|---|\n";
  if (!fs.existsSync(SPEND_LOG)) fs.writeFileSync(SPEND_LOG, header);
  const total = readSpend() + price;
  const when = new Date().toISOString().slice(0, 16) + "Z";
  fs.appendFileSync(SPEND_LOG, `| ${when} | ${model} | ${size} | ${purpose} | ${price.toFixed(4)} | ${total.toFixed(4)} |\n`);
  return total;
}

async function generate(key, model, body) {
  const res = await fetch(`${BASE}/models/${model}:generateContent`, {
    method: "POST",
    headers: { "x-goog-api-key": key, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return { res, json: await readJson(res) };
}

const isFreeTierBlock = (res, json) => res.status === 429 && /free_tier/.test(JSON.stringify(json));

// ---------- text checks ----------

async function checkText(key, models) {
  const out = { lines: [], failed: false };

  // Confirm the chosen models exist for this key.
  const listRes = await fetch(`${BASE}/models?pageSize=200`, { headers: { "x-goog-api-key": key } });
  const listJson = await readJson(listRes);
  if (!listRes.ok) throw new Error(`model list failed: HTTP ${listRes.status} ${errorSummary(listJson, key)}`);
  const available = new Set((listJson.models ?? []).map((m) => m.name.replace(/^models\//, "")));
  for (const role of ["triage", "draft"]) {
    if (!available.has(models[role])) { out.lines.push(`  ${role} model ${models[role]}: NOT AVAILABLE to this key`); out.failed = true; }
  }
  out.lines.push(`  ${available.size} models visible to this key.`);

  // Triage role: one structured-output call, the same shape the scoring step uses.
  {
    const model = models.triage;
    const { res, json } = await generate(key, model, {
      contents: [{ role: "user", parts: [{ text: "Classify this headline for an AI research blog: 'DeepMind releases a new world model for robotics'. Return JSON with theme (short string) and relevance (0-100 integer)." }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: { type: "OBJECT", properties: { theme: { type: "STRING" }, relevance: { type: "INTEGER" } }, required: ["theme", "relevance"] },
      },
    });
    if (!res.ok) { out.failed = true; out.lines.push(`  triage ${model}: FAIL HTTP ${res.status} ${errorSummary(json, key)}`); }
    else {
      const text = (json.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? "").join("");
      let parsed; try { parsed = JSON.parse(text); } catch { parsed = null; }
      const u = json.usageMetadata ?? {};
      const cost = textCost(model, u);
      out.lines.push(`  triage ${model}: ${parsed ? "PASS" : "FAIL (not JSON)"}, ${u.promptTokenCount ?? 0} in / ${u.candidatesTokenCount ?? 0} out tokens, list price $${cost?.toFixed(5) ?? "?"}, got ${JSON.stringify(parsed ?? text.slice(0, 60))}`);
      if (!parsed) out.failed = true;
    }
  }

  // Draft role: one tiny call. Also tells us the tier (a 429 mentioning free_tier means no billing).
  {
    const model = models.draft;
    const { res, json } = await generate(key, model, {
      contents: [{ role: "user", parts: [{ text: "Reply with the single word OK." }] }],
      generationConfig: { maxOutputTokens: 200 },
    });
    if (!res.ok) {
      out.failed = true;
      out.lines.push(`  draft ${model}: FAIL HTTP ${res.status} ${errorSummary(json, key)}`);
      if (isFreeTierBlock(res, json)) out.lines.push(`  (this model is not on the free tier; the key's project has no billing account)`);
    } else {
      const text = (json.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? "").join("").trim();
      const u = json.usageMetadata ?? {};
      const cost = textCost(model, u);
      out.lines.push(`  draft ${model}: PASS, ${u.promptTokenCount ?? 0} in / ${(u.candidatesTokenCount ?? 0) + (u.thoughtsTokenCount ?? 0)} out tokens, list price $${cost?.toFixed(5) ?? "?"}, said "${text.slice(0, 30)}"`);
    }
  }
  return out;
}

// ---------- image check ----------

async function checkImage(key, model, env) {
  const budget = Number(env.IMAGE_BUDGET_USD || 5);
  const size = "1K";
  const price = IMAGE_PRICES[model]?.[size] ?? 0.07; // unknown model: assume 7 cents, the high end
  const spent = readSpend();
  if (spent + price > budget) throw new Error(`image budget reached: $${spent.toFixed(3)} of $${budget.toFixed(2)} spent; next image would cost $${price}`);

  const prompt =
    "Abstract editorial header illustration for a technology research blog post about voice AI agents. " +
    "Flowing layered sound-wave ribbons in black ink on an off-white paper background, one muted accent of deep teal, " +
    "generous negative space, minimal, modern, print-like. No text, no letters, no logos, no people.";
  const body = (withSize) => ({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { responseModalities: ["TEXT", "IMAGE"], imageConfig: withSize ? { aspectRatio: "16:9", imageSize: size } : { aspectRatio: "16:9" } },
  });

  let lastError = "";
  for (const withSize of [true, false]) {
    const { res, json } = await generate(key, model, body(withSize));
    if (!res.ok) {
      lastError = `HTTP ${res.status} ${errorSummary(json, key)}`;
      if (isFreeTierBlock(res, json)) throw new Error(`${lastError}\n  => Image models are not on the free tier. Enable billing on the key's project to unlock them; until then the app shows the SVG headers plus a marked placeholder.`);
      if (res.status === 400 && withSize) continue; // maybe imageSize unsupported: retry without it
      throw new Error(lastError);
    }
    const parts = json.candidates?.[0]?.content?.parts ?? [];
    const img = parts.find((p) => p.inlineData?.data);
    if (!img) throw new Error(`call succeeded but returned no image (${json.promptFeedback?.blockReason ?? json.candidates?.[0]?.finishReason ?? "no image part"})`);
    fs.mkdirSync(path.dirname(TEST_IMAGE), { recursive: true });
    fs.writeFileSync(TEST_IMAGE, Buffer.from(img.inlineData.data, "base64"));
    const total = appendSpend({ model, size, purpose: "pre-flight key test", price });
    return { mime: img.inlineData.mimeType, kb: Math.round(Buffer.byteLength(img.inlineData.data, "base64") / 1024), price, total, budget, withSize };
  }
  throw new Error(lastError);
}

// ---------- main ----------

const args = new Set(process.argv.slice(2));
const env = loadEnv(ENV_FILE);
const models = {
  triage: env.GEMINI_TRIAGE_MODEL || DEFAULT_MODELS.triage,
  draft: env.GEMINI_DRAFT_MODEL || DEFAULT_MODELS.draft,
  image: env.GEMINI_IMAGE_MODEL || DEFAULT_MODELS.image,
};
let failed = false;

console.log(`Newsroom key check (${path.relative(process.cwd(), ENV_FILE)})`);
if (!env.GEMINI_API_KEY) {
  console.log("  GEMINI_API_KEY: not set. Paste a key from https://aistudio.google.com/apikey");
  process.exit(1);
}
console.log(`  GEMINI_API_KEY: set (${env.GEMINI_API_KEY.length} chars, value hidden)`);

if (!args.has("--image-only")) {
  console.log("Text:");
  try {
    const r = await checkText(env.GEMINI_API_KEY, models);
    r.lines.forEach((l) => console.log(l));
    if (r.failed) failed = true;
  } catch (e) { failed = true; console.log(`  FAIL. ${e.message}`); }
}

if (!args.has("--text-only")) {
  console.log(`Image (${models.image}):`);
  try {
    const r = await checkImage(env.GEMINI_API_KEY, models.image, env);
    console.log(`  PASS. ${r.mime}, ${r.kb} KB, 16:9${r.withSize ? " 1K" : ""}, saved ${path.relative(process.cwd(), TEST_IMAGE)}.`);
    console.log(`  Image spend: $${r.price.toFixed(4)} this run, $${r.total.toFixed(4)} total of $${r.budget.toFixed(2)} cap. Logged in ${path.relative(process.cwd(), SPEND_LOG)}.`);
  } catch (e) { failed = true; console.log(`  FAIL. ${e.message}`); }
}

process.exit(failed ? 1 : 0);
