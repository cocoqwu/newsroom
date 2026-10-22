// Image spend ledger: docs/image-spend-log.md, one row per generated image at list price.
import fs from "node:fs";
import path from "node:path";

const SPEND_LOG = path.join(process.cwd(), "docs", "image-spend-log.md");

export function readImageSpend(): number {
  if (!fs.existsSync(SPEND_LOG)) return 0;
  let total = 0;
  for (const line of fs.readFileSync(SPEND_LOG, "utf8").split("\n")) {
    const cells = line.split("|").map((c) => c.trim());
    if (cells.length >= 7 && /^\d{4}-\d{2}-\d{2}/.test(cells[1])) total += Number(cells[5]) || 0;
  }
  return total;
}

export function appendImageSpend(row: { model: string; size: string; purpose: string; price: number }): number {
  const header = "# Image spend log\n\nEvery AI-generated image, with its list price in US dollars. The cap is IMAGE_BUDGET_USD in .env.local.\nPrices are Google's published per-image list prices, not a bill: check the Google Cloud console for actual charges.\n\n| When (UTC) | Model | Size | Purpose | Price (USD) | Running total (USD) |\n|---|---|---|---|---|---|\n";
  if (!fs.existsSync(SPEND_LOG)) fs.writeFileSync(SPEND_LOG, header);
  const total = readImageSpend() + row.price;
  fs.appendFileSync(SPEND_LOG, `| ${new Date().toISOString().slice(0, 16)}Z | ${row.model} | ${row.size} | ${row.purpose} | ${row.price.toFixed(4)} | ${total.toFixed(4)} |\n`);
  return total;
}
