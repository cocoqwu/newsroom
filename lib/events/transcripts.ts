// Turn pasted or uploaded transcript files into one plain-text transcript with [mm:ss] markers.
// Handles WebVTT (.vtt), SubRip (.srt), Markdown and plain text.

export function parseTranscriptFile(filename: string, raw: string): string {
  const text = raw.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  const lower = filename.toLowerCase();
  if (lower.endsWith(".vtt") || /^WEBVTT/m.test(text)) return parseVtt(text);
  if (lower.endsWith(".srt") || /^\d+\n\d{2}:\d{2}:\d{2},\d{3} -->/m.test(text)) return parseSrt(text);
  return text.trim();
}

function fmt(ts: string): string {
  // 00:01:02.500 → 01:02 ; 01:02:03.000 → 1:02:03
  const m = ts.trim().match(/(?:(\d+):)?(\d{1,2}):(\d{2})[.,]?\d*/);
  if (!m) return ts.trim();
  const h = m[1] ? Number(m[1]) : 0;
  return h ? `${h}:${m[2].padStart(2, "0")}:${m[3]}` : `${m[2].padStart(2, "0")}:${m[3]}`;
}

function cuesToText(cues: { start: string; text: string }[]): string {
  const lines: string[] = [];
  let last = "";
  for (const c of cues) {
    const clean = c.text.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    if (!clean || clean === last) continue;
    last = clean;
    lines.push(`[${fmt(c.start)}] ${clean}`);
  }
  return lines.join("\n");
}

export function parseVtt(text: string): string {
  const blocks = text.split(/\n\s*\n/);
  const cues: { start: string; text: string }[] = [];
  for (const b of blocks) {
    const lines = b.split("\n").filter(Boolean);
    const i = lines.findIndex((l) => l.includes("-->"));
    if (i < 0) continue;
    cues.push({ start: lines[i].split("-->")[0], text: lines.slice(i + 1).join(" ") });
  }
  return cuesToText(cues);
}

export function parseSrt(text: string): string {
  const blocks = text.split(/\n\s*\n/);
  const cues: { start: string; text: string }[] = [];
  for (const b of blocks) {
    const lines = b.split("\n").filter(Boolean);
    const i = lines.findIndex((l) => l.includes("-->"));
    if (i < 0) continue;
    cues.push({ start: lines[i].split("-->")[0], text: lines.slice(i + 1).join(" ") });
  }
  return cuesToText(cues);
}

export const transcriptExtensions = [".txt", ".vtt", ".srt", ".md"];
export const mediaMimes: Record<string, string> = { ".mp3": "audio/mpeg", ".m4a": "audio/mp4", ".wav": "audio/wav", ".mp4": "video/mp4" };
