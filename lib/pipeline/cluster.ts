// Step 2: merge items about the same event. Embedding similarity decides the clear cases;
// borderline pairs go to the triage model in batches. Each story names a primary source.
import { clustering } from "@/config/ranking";
import { generateJSON } from "@/lib/llm";
import { cosine, centroid } from "./embeddings";
import type { ItemRow } from "./collect";

export type Cluster = { items: ItemRow[]; vectors: number[][]; center: number[] };

export async function clusterItems(items: ItemRow[], vectors: number[][], runId: number, log: (s: string) => void = console.log): Promise<{ clusters: Cluster[]; borderlineChecked: number; merged: number }> {
  // Best sources first, so a cluster is seeded by its most authoritative item.
  const order = items.map((_, i) => i).sort((a, b) => items[b].sourceQuality - items[a].sourceQuality || (items[b].publishedAt ?? "").localeCompare(items[a].publishedAt ?? ""));
  const clusters: Cluster[] = [];
  const borderline: { itemIdx: number; clusterIdx: number; sim: number }[] = [];

  for (const i of order) {
    let best = -1, bestSim = -1;
    for (let c = 0; c < clusters.length; c++) {
      const s = cosine(vectors[i], clusters[c].center);
      if (s > bestSim) { bestSim = s; best = c; }
    }
    if (best >= 0 && bestSim >= clustering.mergeAbove) {
      add(clusters[best], items[i], vectors[i]);
    } else {
      if (best >= 0 && bestSim >= clustering.borderlineAbove) borderline.push({ itemIdx: i, clusterIdx: clusters.length, sim: bestSim });
      clusters.push({ items: [items[i]], vectors: [vectors[i]], center: vectors[i] });
      if (best >= 0 && bestSim >= clustering.borderlineAbove) borderline[borderline.length - 1].clusterIdx = best; // remember the candidate
      // Note: the item starts its own cluster; if the model says "same", we merge the two clusters below.
    }
  }

  // Ask the triage model about borderline pairs, 15 per call, capped to keep the free tier happy.
  const pairs = borderline.slice(0, 60);
  let merged = 0;
  for (let i = 0; i < pairs.length; i += 15) {
    const batch = pairs.slice(i, i + 15);
    const lines = batch.map((p, k) => {
      const a = items[p.itemIdx];
      const b = clusters[p.clusterIdx].items[0];
      return `${k + 1}. A: "${a.title}" (${a.sourceName})\n   B: "${b.title}" (${b.sourceName})`;
    });
    const res = await generateJSON<{ same: boolean[] }>({
      role: "triage",
      task: "cluster-check",
      runId,
      system: "You deduplicate news for an AI research blog. Two items are the SAME story only if they report the same specific release, paper, event or announcement. Same topic is not enough.",
      prompt: `For each pair, answer whether A and B are the same story.\n\n${lines.join("\n")}\n\nReturn {"same": [true/false, ...]} with exactly ${batch.length} booleans in order.`,
      schema: { type: "object", properties: { same: { type: "array", items: { type: "boolean" } } }, required: ["same"] },
      temperature: 0,
      fallback: () => ({ same: batch.map((p) => titleJaccard(items[p.itemIdx].title, clusters[p.clusterIdx].items[0].title) > 0.5) }),
    });
    batch.forEach((p, k) => {
      if (!res.data.same?.[k]) return;
      // Find the singleton cluster this item started, and fold it into the candidate.
      const own = clusters.findIndex((c) => c.items.length >= 1 && c.items[0].id === items[p.itemIdx].id);
      const target = clusters[p.clusterIdx];
      if (own < 0 || clusters[own] === target) return;
      for (let j = 0; j < clusters[own].items.length; j++) add(target, clusters[own].items[j], clusters[own].vectors[j]);
      clusters.splice(own, 1);
      merged++;
    });
  }
  log(`  ${items.length} items → ${clusters.length} stories (${pairs.length} borderline pairs checked, ${merged} merged)`);
  return { clusters, borderlineChecked: pairs.length, merged };
}

function add(c: Cluster, item: ItemRow, v: number[]) {
  c.items.push(item);
  c.vectors.push(v);
  c.center = centroid(c.vectors);
}

export function primaryItem(c: Cluster): ItemRow {
  return [...c.items].sort((a, b) => b.sourceQuality - a.sourceQuality || (a.publishedAt ?? "z").localeCompare(b.publishedAt ?? "z"))[0];
}

export function titleJaccard(a: string, b: string): number {
  const tok = (s: string) => new Set(s.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 3));
  const A = tok(a), B = tok(b);
  const inter = [...A].filter((w) => B.has(w)).length;
  return inter / (A.size + B.size - inter || 1);
}
