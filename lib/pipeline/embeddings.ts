// Local sentence embeddings with transformers.js (no API key). First use downloads a ~20 MB model
// into .cache/transformers. If that fails (offline), a hashed TF-IDF vector keeps clustering working.
import path from "node:path";

type Extractor = (texts: string[], opts: { pooling: "mean"; normalize: boolean }) => Promise<{ tolist: () => number[][] }>;
let extractorPromise: Promise<Extractor | null> | null = null;
export let embeddingBackend: "minilm" | "tfidf" = "minilm";

async function getExtractor(): Promise<Extractor | null> {
  if (!extractorPromise) {
    extractorPromise = (async () => {
      try {
        const tf = await import("@huggingface/transformers");
        tf.env.cacheDir = path.join(process.cwd(), ".cache", "transformers");
        const pipe = await tf.pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2", { dtype: "q8" });
        return pipe as unknown as Extractor;
      } catch (e) {
        console.warn("[embeddings] MiniLM unavailable, using hashed TF-IDF:", (e as Error).message.slice(0, 120));
        embeddingBackend = "tfidf";
        return null;
      }
    })();
  }
  return extractorPromise;
}

export async function embed(texts: string[]): Promise<number[][]> {
  const ex = await getExtractor();
  if (!ex) return texts.map(hashEmbed);
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += 32) {
    const batch = texts.slice(i, i + 32).map((t) => t.slice(0, 1000));
    const res = await ex(batch, { pooling: "mean", normalize: true });
    out.push(...res.tolist());
  }
  return out;
}

export function cosine(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

export function centroid(vectors: number[][]): number[] {
  const n = vectors[0]?.length ?? 0;
  const c = new Array(n).fill(0);
  for (const v of vectors) for (let i = 0; i < n; i++) c[i] += v[i];
  const norm = Math.sqrt(c.reduce((s, x) => s + x * x, 0)) || 1;
  return c.map((x) => x / norm);
}

// Fallback: 512-dim hashed bag of words with sublinear tf, L2-normalized.
const STOP = new Set("the a an and or of to in on for with by from at as is are was were be been this that these those it its into over under about we our you your they their".split(" "));
function hashEmbed(text: string): number[] {
  const v = new Array(512).fill(0);
  for (const w of text.toLowerCase().split(/[^a-z0-9]+/)) {
    if (!w || STOP.has(w) || w.length < 3) continue;
    let h = 2166136261;
    for (let i = 0; i < w.length; i++) { h ^= w.charCodeAt(i); h = Math.imul(h, 16777619); }
    v[Math.abs(h) % 512] += 1;
  }
  const norm = Math.sqrt(v.reduce((s: number, x: number) => s + Math.log1p(x) ** 2, 0)) || 1;
  return v.map((x: number) => Math.log1p(x) / norm);
}
