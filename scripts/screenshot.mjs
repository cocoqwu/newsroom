#!/usr/bin/env node
// Save a 1440x900 PNG of a URL with the local Chrome in headless mode.
//   node scripts/screenshot.mjs <url> <out.png> [waitMs] [height]
// Used after each milestone to put every screen in docs/screenshots/.
import { execFileSync } from "node:child_process";
import path from "node:path";
import fs from "node:fs";

const [url, out, waitMs = "4000", height = "900"] = process.argv.slice(2);
if (!url || !out) { console.error("usage: screenshot.mjs <url> <out.png> [waitMs] [height]"); process.exit(1); }
const chrome = ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/Applications/Chromium.app/Contents/MacOS/Chromium"].find((p) => fs.existsSync(p));
if (!chrome) { console.error("No local Chrome found"); process.exit(2); }
fs.mkdirSync(path.dirname(out), { recursive: true });
const profile = path.join(process.env.TMPDIR || "/tmp", "newsroom-shot-profile");
execFileSync(chrome, [
  "--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run", "--no-default-browser-check",
  `--user-data-dir=${profile}`, `--window-size=1440,${height}`, `--virtual-time-budget=${waitMs}`,
  "--force-device-scale-factor=1", "--force-dark-mode=0",
  `--screenshot=${path.resolve(out)}`, url,
], { stdio: "ignore", timeout: 150000 });
console.log(`saved ${out}`);
