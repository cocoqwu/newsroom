import type { Source } from "@/config/sources";

// One normalized item, whatever the source. Summary and link only, never full text.
export type RawItem = {
  title: string;
  url: string;
  summary?: string;
  author?: string;
  publishedAt?: string; // ISO
  signals?: { points?: number; comments?: number; stars?: number; upvotes?: number; hnUrl?: string };
};

export type Adapter = (source: Source, sinceIso: string) => Promise<RawItem[]>;

export const USER_AGENT = "NewsroomPrototype/0.1 (research tool; contact via github)";

export async function fetchWithTimeout(url: string, ms = 20000, init: RequestInit = {}): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal, headers: { "user-agent": USER_AGENT, accept: "application/json, application/xml, text/xml, text/html;q=0.9, */*;q=0.8", ...(init.headers ?? {}) } });
  } finally {
    clearTimeout(t);
  }
}

// Strip tracking parameters and fragments so the same article from two feeds dedupes.
export function normalizeUrl(u: string): string {
  try {
    const url = new URL(u.trim());
    url.hash = "";
    for (const k of [...url.searchParams.keys()]) if (/^(utm_|ref$|ref_|source$|fbclid|gclid|mc_)/i.test(k)) url.searchParams.delete(k);
    let s = url.toString();
    if (s.endsWith("/") && url.pathname !== "/") s = s.slice(0, -1);
    return s;
  } catch {
    return u.trim();
  }
}
