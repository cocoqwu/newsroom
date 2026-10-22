"use client";

import { useState } from "react";
import { ExternalLink } from "lucide-react";
import { SectionLabel } from "./SectionLabel";

// Right panel with Assistant / Links tabs, mirroring the live site's right column.
// The Assistant tab becomes live on the Draft screen (milestone 3); elsewhere it explains the page.
export function RightPanel({ assistant }: { assistant?: React.ReactNode }) {
  const [tab, setTab] = useState<"assistant" | "links">(assistant ? "assistant" : "links");
  return (
    <aside className="sticky top-0 hidden h-screen flex-col bg-page px-5 py-3 lg:flex">
      <div className="flex items-center justify-end gap-1">
        {(["assistant", "links"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-full px-3 py-1 text-[12px] capitalize transition-colors ${tab === t ? "bg-fill text-text" : "text-text-3 hover:text-text-2"}`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "links" ? (
        <div className="mt-6">
          <SectionLabel className="mb-3">Quick links</SectionLabel>
          <ul className="flex flex-col gap-2 text-[13px] text-text-2">
            {[
              ["blog.agihouse.org", "https://blog.agihouse.org"],
              ["agihouse.org/events", "https://www.agihouse.org/events"],
              ["Voice agents research brief", "https://blog.agihouse.org/posts/voice-agents-research-brief"],
            ].map(([label, href]) => (
              <li key={href}>
                <a href={href} target="_blank" rel="noreferrer" className="flex items-center gap-2 hover:text-text">
                  <ExternalLink className="size-3.5 text-text-3" />
                  {label}
                </a>
              </li>
            ))}
          </ul>
          <SectionLabel className="mt-8 mb-3">About Newsroom</SectionLabel>
          <p className="text-[13px] leading-5 text-text-2">
            An internal tool prototype that turns the daily flood of frontier AI news into publish-ready research posts.
            The editor makes two calls: which story to cover, and whether the draft is ready.
          </p>
        </div>
      ) : (
        <div className="mt-6 flex min-h-0 flex-1 flex-col">{assistant ?? <AssistantPlaceholder />}</div>
      )}
    </aside>
  );
}

function AssistantPlaceholder() {
  return (
    <div>
      <SectionLabel className="mb-3">Assistant</SectionLabel>
      <p className="text-[13px] leading-5 text-text-2">
        On the Draft screen, select any text and ask for a change here. Untouched sections stay as they are.
      </p>
    </div>
  );
}
