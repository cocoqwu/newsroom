// `npm run pipeline` : the full daily run. `npm run pipeline -- --only collect` for a source check.
// `--lookback 48` changes the window in hours. Safe to rerun.
import { loadEnvLocal } from "@/lib/env";
loadEnvLocal();

async function main() {
  const { runPipeline } = await import("@/lib/pipeline/run");
  const args = process.argv.slice(2);
  const get = (flag: string) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : undefined; };
  const only = get("--only") === "collect" ? "collect" : "all";
  const lookbackHours = get("--lookback") ? Number(get("--lookback")) : undefined;
  await runPipeline({ only, lookbackHours });
}
main()
  .then(() => process.exit(0)) // exit explicitly: a slow feed can leave a socket open
  .catch((e) => { console.error(e); process.exit(1); });
