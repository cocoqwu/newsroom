import { TopBar } from "@/components/shell/TopBar";
import { SectionLabel } from "@/components/shell/SectionLabel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const swatches = [
  ["Page", "#09090b", "bg-page"],
  ["Panel", "#18181b", "bg-panel"],
  ["Fill / border", "#27272a", "bg-fill"],
  ["Text", "#fafafa", "bg-text"],
  ["Text 2", "#a1a1aa", "bg-text-2"],
  ["Text 3", "#71717a", "bg-text-3"],
  ["Accent", "#fda4af", "bg-rose"],
];

// One-page style tile: colors, type, a story card, a button, a tag, a blog heading.
// Compared against screenshots of agihouse.org/events and blog.agihouse.org (docs/screenshots/m1-*).
export default function StyleTile() {
  return (
    <div>
      <TopBar title="Style tile" right={<Button variant="outline" size="sm">Sign in</Button>} />
      <div className="mx-auto max-w-[820px] px-6 py-6">
        <h2 className="text-[26px] font-semibold tracking-[-0.65px]">Newsroom design tokens</h2>
        <p className="mt-1 text-[14px] text-text-2">Measured from the live AGI House app and blog on Oct 22, 2026.</p>

        <SectionLabel className="mt-8 mb-3">Workspace colors</SectionLabel>
        <div className="grid grid-cols-7 gap-2">
          {swatches.map(([name, hex, cls]) => (
            <div key={hex}>
              <div className={`h-14 rounded-lg border border-fill ${cls}`} />
              <div className="mt-1.5 text-[12px] text-text">{name}</div>
              <div className="num text-[11px] text-text-3">{hex}</div>
            </div>
          ))}
        </div>

        <SectionLabel className="mt-8 mb-3">Type</SectionLabel>
        <Card>
          <CardContent className="flex flex-col gap-3">
            <div className="text-[20px] font-semibold tracking-[-0.5px]">Top bar title, 20px semibold</div>
            <div className="text-[26px] font-semibold tracking-[-0.65px]">Page heading, 26px semibold</div>
            <div className="text-[14px] text-text-2">Body 14px zinc-400. Exclusive gatherings for AI founders and researchers.</div>
            <div className="section-label">Section label, 10px, 0.12em</div>
            <div className="num text-[13px]">Numbers in SF Mono: 0.84 · 1,204 items · $0.0132</div>
          </CardContent>
        </Card>

        <SectionLabel className="mt-8 mb-3">Buttons and tags</SectionLabel>
        <div className="flex flex-wrap items-center gap-2">
          <Button>Pick story</Button>
          <Button variant="outline">Skip</Button>
          <Button variant="secondary">Save for later</Button>
          <Button variant="ghost">Ghost</Button>
          <Badge variant="secondary">technical primer</Badge>
          <Badge variant="outline">research brief</Badge>
          <Badge className="bg-rose/15 text-rose">wildcard</Badge>
          <Input placeholder="Angle note…" className="w-56" />
        </div>

        <SectionLabel className="mt-8 mb-3">Next up · story card</SectionLabel>
        <Card>
          <CardContent>
            <div className="flex items-start gap-4">
              <div className="w-10 shrink-0 text-center">
                <div className="text-[10px] font-medium uppercase tracking-[0.5px] text-rose">rank</div>
                <div className="num text-[22px] font-semibold leading-7">1</div>
                <div className="num text-[10px] text-text-3">87</div>
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[15px] font-semibold leading-5">DeepMind releases a new world model for robotics</div>
                <div className="mt-1 text-[13px] text-text-2">Why now: first open weights at this scale, and three labs shipped embodied demos this week.</div>
                <div className="mt-2 flex items-center gap-2 text-[12px] text-text-3">
                  <span>4 sources</span>
                  <span>·</span>
                  <Badge variant="secondary">technical primer</Badge>
                  <span>·</span>
                  <span>covered before: no</span>
                </div>
              </div>
              <Button size="sm">Pick</Button>
            </div>
          </CardContent>
        </Card>

        <SectionLabel className="mt-8 mb-3">Blog preview type (blog.agihouse.org)</SectionLabel>
        <div className="blog overflow-hidden rounded-lg">
          <div className="h-10 bg-ink" />
          <div className="px-10 py-8">
            <div className="blog-label text-ink-3">Voice agents</div>
            <h1 className="mt-6 max-w-[900px]">Voice agents research brief: the technical stack behind realtime conversation</h1>
            <div className="mt-6 flex gap-6">
              <span className="font-montserrat text-[10px] font-semibold uppercase tracking-[1px]">Jessica Chen</span>
              <span className="font-montserrat text-[10px] font-semibold uppercase tracking-[1px]">July 30, 2026</span>
            </div>
            <div className="mt-8 h-px bg-ink" />
            <h2>Architectures: cascaded, speech-to-speech, full-duplex</h2>
            <p className="max-w-[734px]">
              Twelve months ago, full-duplex voice was a research demo. Today three labs ship it in production, and the
              question for builders has moved from &ldquo;can it&rdquo; to &ldquo;which layer do I own&rdquo;. Body text is Source Serif, 18px on 30px lines.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
