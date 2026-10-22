"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

// Runs the daily pipeline from the UI (same code as `npm run pipeline`). Takes a few minutes live.
export function RunButton({ demo }: { demo: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  async function run() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/pipeline/run", { method: "POST" });
      const data = (await res.json()) as { ok: boolean; stories?: number; items?: number; error?: string };
      if (!data.ok) throw new Error(data.error || "run failed");
      setMsg(`Done: ${data.items} items, ${data.stories} stories`);
      router.refresh();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="flex items-center gap-2">
      {msg ? <span className="text-[12px] text-text-3">{msg}</span> : null}
      <Button variant="outline" size="sm" onClick={run} disabled={busy || demo} title={demo ? "Off in demo mode: a run would replace the recorded day. Use npm run pipeline for a live run." : "Collect, cluster and rank now (about 2 minutes)"}>
        <RefreshCw className={`size-3.5 ${busy ? "animate-spin" : ""}`} /> {busy ? "Running pipeline…" : demo ? "Run pipeline (off in demo)" : "Run pipeline"}
      </Button>
    </div>
  );
}
