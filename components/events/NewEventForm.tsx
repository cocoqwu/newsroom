"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { permissionLabel, type Permission } from "@/lib/events/consent";

type SpeakerRow = { name: string; title: string; permission: Permission };

export function NewEventForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [description, setDescription] = useState("");
  const [speakers, setSpeakers] = useState<SpeakerRow[]>([{ name: "", title: "", permission: "paraphrase" }]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    setBusy(true); setError(null);
    try {
      const res = await fetch("/api/events", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, date, description, speakers: speakers.filter((s) => s.name.trim()) }) });
      const d = (await res.json()) as { ok: boolean; eventId?: number; error?: string };
      if (!d.ok || !d.eventId) throw new Error(d.error || "could not create event");
      router.push(`/events/${d.eventId}`);
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  return (
    <div className="rounded-lg border border-fill bg-panel p-4">
      <div className="grid grid-cols-[1fr_160px] gap-3">
        <div><div className="section-label mb-1.5">Name</div><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Long-Horizon Agents Build Day" /></div>
        <div><div className="section-label mb-1.5">Date</div><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
      </div>
      <div className="section-label mt-3 mb-1.5">One line about it (optional)</div>
      <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Panel plus six team demos, AGI House, Hillsborough" />
      <div className="section-label mt-4 mb-1.5">Speakers and quote permission</div>
      <div className="flex flex-col gap-2">
        {speakers.map((s, i) => (
          <div key={i} className="grid grid-cols-[1fr_1fr_170px] gap-2">
            <Input value={s.name} onChange={(e) => setSpeakers(speakers.map((x, k) => (k === i ? { ...x, name: e.target.value } : x)))} placeholder="Name" />
            <Input value={s.title} onChange={(e) => setSpeakers(speakers.map((x, k) => (k === i ? { ...x, title: e.target.value } : x)))} placeholder="Title, company" />
            <select value={s.permission} onChange={(e) => setSpeakers(speakers.map((x, k) => (k === i ? { ...x, permission: e.target.value as Permission } : x)))} className="h-8 rounded-lg border border-fill bg-page px-2 text-[13px] text-text">
              {(Object.keys(permissionLabel) as Permission[]).map((p) => <option key={p} value={p}>{permissionLabel[p]}</option>)}
            </select>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => setSpeakers([...speakers, { name: "", title: "", permission: "paraphrase" }])}><Plus className="size-3.5" /> Add speaker</Button>
        <span className="text-[12px] text-text-3">Default is paraphrase only: no direct quotes until a speaker approves.</span>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <Button onClick={create} disabled={busy || !name.trim()}>{busy ? <Loader2 className="size-3.5 animate-spin" /> : null} Create event</Button>
        {error ? <span className="text-[12px] text-rose">{error}</span> : null}
      </div>
    </div>
  );
}
