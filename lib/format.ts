// Display helpers shared by server and client components.
import { editorialProfile, type FormatId } from "@/config/editorial-profile";

export function formatName(id: string | null | undefined): string {
  return (id && editorialProfile.formats[id as FormatId]?.name) || "Research brief";
}

export const formatOptions = Object.entries(editorialProfile.formats).map(([id, f]) => ({ id: id as FormatId, name: f.name, when: f.when }));

export function themeName(id: string | null | undefined): string {
  return editorialProfile.themes.find((t) => t.id === id)?.name ?? "Other";
}

export function money(usd: number | null | undefined): string {
  const v = usd ?? 0;
  if (v === 0) return "$0.00";
  return v < 0.01 ? `$${v.toFixed(4)}` : `$${v.toFixed(2)}`;
}

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "unknown";
  const ms = Date.now() - Date.parse(iso);
  const m = Math.round(ms / 6e4);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h} h ago`;
  return `${Math.round(h / 24)} d ago`;
}

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function hostname(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; }
}
