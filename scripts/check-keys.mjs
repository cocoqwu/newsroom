#!/usr/bin/env node
// Smoke test for the two Google keys in .env.local.
//
//   node scripts/check-keys.mjs              checks both keys
//   node scripts/check-keys.mjs --text-only  checks only GEMINI_API_KEY
//   node scripts/check-keys.mjs --image-only checks only GOOGLE_CLOUD_API_KEY
//
// In plain language: before the overnight build starts, this makes ONE tiny call with each key
// so we know they work. The text check costs nothing (free tier). The image check generates one
// 16:9 image on Vertex AI, logs its list price in docs/image-spend-log.md, and refuses to run
// if that would push total image spend past IMAGE_BUDGET_USD. Key values are never printed.
// No npm packages needed: Node 20+ has fetch built in.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ENV_FILE = path.join(ROOT, ".env.local");
const SPEND_LOG = path.join(ROOT, "docs", "image-spend-log.md");
const TEST_IMAGE = path.join(ROOT, "docs", "hero-image-test.png");

// Image model and its list prices per generated image (USD), from Google's pricing pages, Oct 2026.
const IMAGE_MODEL = "gemini-3.1-flash-image";
const IMAGE_PRICES = { "0.5K": 0.045, "1K": 0.067, "2K": 0.101, "4K": 0.151 };

// ---------- helpers ----------

// Minimal .env parser: KEY=value lines, # comments, optional quotes. No dependency needed.
function loadEnv(file) {
  const env = {};
  if (!fs.existsSync(file)) return env;
  for (const raw of fs.readFileSync(file, "utf8").split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    env[key] = val;
  }
  return env;
}

async function readJson(res) {
  const text = await res.text();
  try { return JSON.parse(text); } catch { return { raw: text.slice(0, 300) }; }
}

function errorSummary(json) {
  const msg = json?.error?.message ?? json?.raw ?? JSON.stringify(json);
  return String(msg).slice(0, 300);
}

// Total spent so far, summed from the price column of the spend log.
function readSpend() {
  if (!fs.existsSync(SPEND_LOG)) return 0;
  let total = 0;
  for (const line of fs.readFileSync(SPEND_LOG, "utf8").split("\n")) {
    const cells = line.split("|").map((c) => c.trim());
    // A data row looks like: | 2026-10-22T05:00Z | model | size | purpose | 0.067 | 0.067 |
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
    "Prices are Google's published per-image list prices, not a bill: check the Cloud console for actual charges.\n\n" +
    "| When (UTC) | Model | Size | Purpose | Price (USD) | Running total (USD) |\n" +
    "|---|---|---|---|---|---|\n";
  if (!fs.existsSync(SPEND_LOG)) fs.writeFileSync(SPEND_LOG, header);
  const total = readSpend() + price;
  const when = new Date().toISOString().slice(0, 16) + "Z";
  fs.appendFileSync(SPEND_LOG, `| ${when} | ${model} | ${size} | ${purpose} | ${price.toFixed(3)} | ${total.toFixed(3)} |\n`);
  return total;
}

// ---------- text key: Gemini API, free tier ----------

async function checkTextKey(key) {
  const base = "https://generativelanguage.googleapis.com/v1beta";
  const headers = { "x-goog-api-key": key, "content-type": "application/json" };

  // 1. List models so we pick one that actually exists for this key.
  const listRes = await fetch(`${base}/models?pageSize=200`, { headers });
  const listJson = await readJson(listRes);
  if (!listRes.ok) throw new Error(`model list failed: HTTP ${listRes.status} ${errorSummary(listJson)}`);
  const usable = (listJson.models ?? [])
    .filter((m) => (m.supportedGenerationMethods ?? []).includes("generateContent"))
    .map((m) => m.name.replace(/^models\//, ""))
    .filter((n) => !/image|tts|live|audio|embedding|robotics/.test(n));
  const preferred = ["gemini-3.5-flash-lite", "gemini-3.1-flash-lite", "gemini-2.5-flash-lite"];
  const model =
    preferred.find((p) => usable.includes(p)) ??
    usable.find((n) => /flash-lite/.test(n)) ??
    usable.find((n) => /flash/.test(n));
  if (!model) throw new Error(`no Flash model available to this key (saw ${usable.length} usable models)`);

  // 2. One tiny structured-output call, the same shape the triage step will use.
  const body = {
    contents: [{
      role: "user",
      parts: [{ text: "Classify this headline for an AI research blog: 'DeepMind releases a new world model for robotics'. Return JSON with theme (short string) and relevance (0-100 integer)." }],
    }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: {
        type: "OBJECT",
        properties: { theme: { type: "STRING" }, relevance: { type: "INTEGER" } },
        required: ["theme", "relevance"],
      },
    },
  };
  const res = await fetch(`${base}/models/${model}:generateContent`, { method: "POST", headers, body: JSON.stringify(body) });
  const json = await readJson(res);
  if (!res.ok) throw new Error(`generateContent failed: HTTP ${res.status} ${errorSummary(json)}`);
  const text = (json.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? "").join("");
  let parsed;
  try { parsed = JSON.parse(text); } catch { throw new Error(`model did not return valid JSON: ${text.slice(0, 120)}`); }
  const u = json.usageMetadata ?? {};
  return { model, parsed, tokensIn: u.promptTokenCount ?? 0, tokensOut: u.candidatesTokenCount ?? 0, modelCount: usable.length };
}

// ---------- image key: Vertex AI on the Cloud project with credits ----------

async function checkImageKey(env) {
  const key = env.GOOGLE_CLOUD_API_KEY;
  const project = env.GOOGLE_CLOUD_PROJECT;
  const budget = Number(env.IMAGE_BUDGET_USD || 5);
  const size = "1K";
  const price = IMAGE_PRICES[size];

  // Budget guard first: never generate past the cap.
  const spent = readSpend();
  if (spent + price > budget) {
    throw new Error(`image budget reached: $${spent.toFixed(3)} spent of $${budget.toFixed(2)}, next image would cost $${price}`);
  }

  const prompt =
    "Abstract editorial header illustration for a technology research blog post about voice AI agents. " +
    "Flowing layered sound-wave ribbons in black ink on an off-white paper background, one muted accent of deep teal, " +
    "generous negative space, minimal, modern, print-like. No text, no letters, no logos, no people.";

  const makeBody = (withSize) => ({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      responseModalities: ["TEXT", "IMAGE"],
      imageConfig: withSize ? { aspectRatio: "16:9", imageSize: size } : { aspectRatio: "16:9" },
    },
  });

  // Vertex accepts an API key in the x-goog-api-key header. Try the project-less global endpoint
  // first, then the explicit project path if a project ID was given.
  const endpoints = [
    { label: "global endpoint", url: `https://aiplatform.googleapis.com/v1/publishers/google/models/${IMAGE_MODEL}:generateContent` },
  ];
  if (project) {
    endpoints.push({ label: `project ${project}, location global`, url: `https://aiplatform.googleapis.com/v1/projects/${project}/locations/global/publishers/google/models/${IMAGE_MODEL}:generateContent` });
  }

  let lastError = "no endpoint tried";
  for (const ep of endpoints) {
    for (const withSize of [true, false]) {
      const res = await fetch(ep.url, {
        method: "POST",
        headers: { "x-goog-api-key": key, "content-type": "application/json" },
        body: JSON.stringify(makeBody(withSize)),
      });
      const json = await readJson(res);
      const variant = withSize ? "" : " (without imageSize)";
      if (!res.ok) {
        lastError = `${ep.label}${variant}: HTTP ${res.status} ${errorSummary(json)}`;
        console.log(`    tried ${lastError}`);
        // 401/403 means the key itself is rejected: a different body will not help, move to next endpoint.
        if (res.status === 401 || res.status === 403) break;
        continue;
      }
      const parts = json.candidates?.[0]?.content?.parts ?? [];
      const img = parts.find((p) => p.inlineData?.data);
      if (!img) {
        const reason = json.promptFeedback?.blockReason ?? json.candidates?.[0]?.finishReason ?? "no image part in response";
        lastError = `${ep.label}${variant}: call succeeded but returned no image (${reason})`;
        console.log(`    tried ${lastError}`);
        continue;
      }
      fs.mkdirSync(path.dirname(TEST_IMAGE), { recursive: true });
      fs.writeFileSync(TEST_IMAGE, Buffer.from(img.inlineData.data, "base64"));
      const total = appendSpend({ model: IMAGE_MODEL, size, purpose: "pre-flight key test", price });
      return { endpoint: ep.label + variant, mime: img.inlineData.mimeType, bytes: Buffer.byteLength(img.inlineData.data, "base64"), price, total, budget, usage: json.usageMetadata ?? {} };
    }
  }
  throw new Error(lastError);
}

// ---------- main ----------

const args = new Set(process.argv.slice(2));
const doText = !args.has("--image-only");
const doImage = !args.has("--text-only");
const env = loadEnv(ENV_FILE);
let failed = false;

console.log("Newsroom key check (" + path.relative(process.cwd(), ENV_FILE) + ")");

if (doText) {
  process.stdout.write("  GEMINI_API_KEY (text, free tier): ");
  if (!env.GEMINI_API_KEY) {
    console.log("SKIP, not set. Paste a key from https://aistudio.google.com/apikey (new project, no billing).");
  } else {
    try {
      const r = await checkTextKey(env.GEMINI_API_KEY);
      console.log(`PASS. Model ${r.model}, ${r.tokensIn} tokens in / ${r.tokensOut} out, parsed ${JSON.stringify(r.parsed)}. ${r.modelCount} text models visible.`);
    } catch (e) {
      failed = true;
      console.log(`FAIL. ${e.message}`);
    }
  }
}

if (doImage) {
  process.stdout.write("  GOOGLE_CLOUD_API_KEY (images, Vertex AI): ");
  if (!env.GOOGLE_CLOUD_API_KEY) {
    console.log("SKIP, not set. Paste an API key from the Cloud project that holds the credits (see .env.local comments).");
  } else {
    console.log("");
    try {
      const r = await checkImageKey(env);
      console.log(`  PASS via ${r.endpoint}. ${r.mime}, ${(r.bytes / 1024).toFixed(0)} KB, saved ${path.relative(process.cwd(), TEST_IMAGE)}.`);
      console.log(`  Image spend: $${r.price.toFixed(3)} this run, $${r.total.toFixed(3)} total of $${r.budget.toFixed(2)} cap. Logged in ${path.relative(process.cwd(), SPEND_LOG)}.`);
    } catch (e) {
      failed = true;
      console.log(`  FAIL. ${e.message}`);
    }
  }
}

process.exit(failed ? 1 : 0);
