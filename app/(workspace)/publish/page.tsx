import Link from "next/link";
import { TopBar } from "@/components/shell/TopBar";
import { listDrafts } from "@/lib/db/queries";
import { formatName } from "@/lib/format";

export const dynamic = "force-dynamic";

export default function PublishIndex() {
  const ready = listDrafts().filter((d) => d.bodyMd);
  return (
    <div>
      <TopBar title="Publish" />
      <div className="mx-auto max-w-[820px] px-6 py-6">
        {ready.length === 0 ? (
          <p className="text-[13px] text-text-2">Nothing to publish yet. Finish a draft first.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-fill rounded-lg border border-fill bg-panel">
            {ready.map((d) => (
              <li key={d.id}>
                <Link href={`/publish/${d.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-fill/40">
                  <div className="min-w-0 flex-1 truncate text-[14px] text-text">{d.title || d.storyTitle}</div>
                  <span className="text-[12px] text-text-3">{formatName(d.format)} · v{d.currentVersion}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
