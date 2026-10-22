// Google list prices, Oct 2026, in US dollars. Text per 1M tokens, images per generated image.
// Free-tier calls are billed at $0; we still compute list price so cost per run is visible and
// stays meaningful the day billing is turned on. Keep in sync with scripts/check-keys.mjs.

export const textPrices: Record<string, { in: number; out: number }> = {
  "gemini-3.5-flash-lite": { in: 0.3, out: 2.5 },
  "gemini-3.1-flash-lite": { in: 0.25, out: 1.5 },
  "gemini-2.5-flash-lite": { in: 0.1, out: 0.4 },
  "gemini-3.8-flash": { in: 0.75, out: 3.75 },
  "gemini-3.6-flash": { in: 0.75, out: 3.75 },
  "gemini-2.5-flash": { in: 0.3, out: 2.5 },
  "gemini-3.1-pro-preview": { in: 2.0, out: 12.0 },
  "gemini-2.5-pro": { in: 1.25, out: 10.0 },
};

export const imagePrices: Record<string, Record<string, number>> = {
  "gemini-nano-banana-2.1": { "1K": 0.0336, "2K": 0.0504, "4K": 0.113 },
  "gemini-3.1-flash-image": { "0.5K": 0.045, "1K": 0.067, "2K": 0.101, "4K": 0.151 },
  "gemini-3.1-flash-lite-image": { "1K": 0.0336 },
};

export function textCostUsd(model: string, tokensIn: number, tokensOut: number): number {
  const p = textPrices[model];
  if (!p) return 0;
  return (tokensIn * p.in + tokensOut * p.out) / 1e6;
}

export const defaultModels = {
  triage: process.env.GEMINI_TRIAGE_MODEL || "gemini-3.5-flash-lite",
  draft: process.env.GEMINI_DRAFT_MODEL || "gemini-3.8-flash",
  image: process.env.GEMINI_IMAGE_MODEL || "gemini-nano-banana-2.1",
};

export const imageBudgetUsd = Number(process.env.IMAGE_BUDGET_USD || 5);
