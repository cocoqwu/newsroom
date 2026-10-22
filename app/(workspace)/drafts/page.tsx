import Link from "next/link";
import { TopBar } from "@/components/shell/TopBar";
import { Badge } from "@/components/ui/badge";
import { listDrafts } from "@/lib/db/queries";
import { formatName, timeAgo } from "@/lib/format";

export const dynamic = "force-dynamic";

const statusLabel: Record<string, string> = { outline: "Outline", approved: "Outline approved", drafting: "Drafting", drafted: "Drafted", checked: "Fact-checked" };

export default function DraftsPage() {
  const drafts = listDrafts();
  return (
    <div>
      <TopBar title="Drafts" />
      <div className="mx-auto max-w-[820px] px-6 py-6">
        {drafts.length === 0 ? (
          <p className="text-[13px] text-text-2">No drafts yet. Pick a story on the Today screen.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-fill rounded-lg border border-fill bg-panel">
            {drafts.map((d) => (
              <li key={d.id}>
                <Link href={`/draft/${d.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-fill/40">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[14px] text-text">{d.title || d.storyTitle}</div>
                    <div className="mt-0.5 text-[12px] text-text-3">{formatName(d.format)} · v{d.currentVersion} · updated {timeAgo(d.updatedAt)}</div>
                  </div>
                  <Badge variant="secondary">{statusLabel[d.status] ?? d.status}</Badge>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
