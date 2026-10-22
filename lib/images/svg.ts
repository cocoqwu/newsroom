// Three abstract header graphics generated from the post's theme, in the blog's palette
// (paper, ink, greys, one muted accent per theme). Deterministic from a seed so the same draft
// always gets the same options. No stock art, no figures from papers.

const accents: Record<string, string> = {
  agents: "#2f4858", "physical-ai": "#6b4f2a", "world-models": "#3b5b7a", voice: "#2f6f6b",
  "self-improving": "#5b3d6b", "ai-for-science": "#2e6b45", infra: "#4a4a4a", security: "#7a3b3b", other: "#3a3a3a",
};

function rng(seed: number) {
  let a = seed >>> 0;
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const W = 1600, H = 900;
const head = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img">`;

// Style 1: layered ribbons (sine waves with drifting phase), one filled in the accent.
export function ribbons(seed: number, accent: string): string {
  const r = rng(seed);
  const parts: string[] = [`<rect width="${W}" height="${H}" fill="#ffffff"/>`];
  const n = 9;
  for (let i = 0; i < n; i++) {
    const amp = 60 + r() * 140, freq = 0.8 + r() * 1.6, phase = r() * Math.PI * 2, y0 = 160 + (i / (n - 1)) * 580, thick = 1 + r() * 2.2;
    let d = "";
    for (let x = -40; x <= W + 40; x += 16) {
      const y = y0 + Math.sin((x / W) * Math.PI * 2 * freq + phase) * amp + Math.sin((x / W) * Math.PI * 7 + phase * 2) * amp * 0.15;
      d += (x === -40 ? "M" : "L") + x.toFixed(1) + " " + y.toFixed(1) + " ";
    }
    if (i === Math.floor(n / 2)) parts.push(`<path d="${d}L${W + 40} ${H + 40}L-40 ${H + 40}Z" fill="${accent}" fill-opacity="0.10"/>`);
    parts.push(`<path d="${d}" fill="none" stroke="${i % 3 === 0 ? accent : "#000"}" stroke-opacity="${i % 3 === 0 ? 0.85 : 0.75}" stroke-width="${thick.toFixed(1)}" stroke-linecap="round"/>`);
  }
  return head + parts.join("") + "</svg>";
}

// Style 2: a lattice of nodes with short edges, a few nodes filled with the accent.
export function lattice(seed: number, accent: string): string {
  const r = rng(seed);
  const parts: string[] = [`<rect width="${W}" height="${H}" fill="#ffffff"/>`];
  const cols = 14, rows = 8, pts: [number, number][] = [];
  for (let j = 0; j <= rows; j++) for (let i = 0; i <= cols; i++) pts.push([(i / cols) * (W - 200) + 100 + (r() - 0.5) * 70, (j / rows) * (H - 200) + 100 + (r() - 0.5) * 70]);
  for (let a = 0; a < pts.length; a++) {
    for (let b = a + 1; b < pts.length; b++) {
      const dx = pts[a][0] - pts[b][0], dy = pts[a][1] - pts[b][1], d = Math.hypot(dx, dy);
      if (d < 150 && r() < 0.55) parts.push(`<line x1="${pts[a][0].toFixed(0)}" y1="${pts[a][1].toFixed(0)}" x2="${pts[b][0].toFixed(0)}" y2="${pts[b][1].toFixed(0)}" stroke="#000" stroke-opacity="${(0.15 + r() * 0.35).toFixed(2)}" stroke-width="1"/>`);
    }
  }
  for (const [x, y] of pts) {
    const big = r() < 0.08;
    parts.push(`<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${big ? 9 : 3.5}" fill="${big ? accent : "#000"}" fill-opacity="${big ? 0.9 : 0.8}"/>`);
  }
  return head + parts.join("") + "</svg>";
}

// Style 3: contour lines around two or three centers, like a topographic map.
export function contours(seed: number, accent: string): string {
  const r = rng(seed);
  const parts: string[] = [`<rect width="${W}" height="${H}" fill="#ffffff"/>`];
  const centers = Array.from({ length: 2 + Math.floor(r() * 2) }, () => ({ x: 300 + r() * 1000, y: 200 + r() * 500, k: 0.6 + r() * 0.8 }));
  const rings = 14;
  for (let k = 1; k <= rings; k++) {
    for (const c of centers) {
      const base = k * 38 * c.k;
      let d = "";
      for (let a = 0; a <= 360; a += 6) {
        const t = (a * Math.PI) / 180;
        const wob = 1 + 0.08 * Math.sin(3 * t + k) + 0.05 * Math.sin(5 * t - k * 0.7) + 0.03 * Math.sin(11 * t);
        const rad = base * wob;
        d += (a === 0 ? "M" : "L") + (c.x + Math.cos(t) * rad * 1.25).toFixed(1) + " " + (c.y + Math.sin(t) * rad).toFixed(1) + " ";
      }
      parts.push(`<path d="${d}Z" fill="${k === 3 ? accent : "none"}" fill-opacity="0.12" stroke="${k % 4 === 0 ? accent : "#000"}" stroke-opacity="${k % 4 === 0 ? 0.8 : 0.55}" stroke-width="${k % 4 === 0 ? 1.8 : 1}"/>`);
    }
  }
  return head + parts.join("") + "</svg>";
}

export function headerOptions(theme: string | null | undefined, seed: number): { label: string; svg: string }[] {
  const accent = accents[theme ?? "other"] ?? accents.other;
  return [
    { label: "Ribbons", svg: ribbons(seed * 7 + 1, accent) },
    { label: "Lattice", svg: lattice(seed * 7 + 2, accent) },
    { label: "Contours", svg: contours(seed * 7 + 3, accent) },
  ];
}
