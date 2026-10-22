"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Calendar, Newspaper, FileText, Send, Palette, PanelLeft, Search } from "lucide-react";
import { SectionLabel } from "./SectionLabel";

const newsroomNav = [
  { href: "/today", label: "Today", icon: Newspaper },
  { href: "/drafts", label: "Drafts", icon: FileText },
  { href: "/publish", label: "Publish", icon: Send },
];

function NavItem({ href, label, icon: Icon, active, external }: { href: string; label: string; icon: React.ComponentType<{ className?: string }>; active?: boolean; external?: boolean }) {
  const cls = `flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[14px] transition-colors ${active ? "bg-panel text-text" : "text-text-2 hover:bg-panel/70 hover:text-text"}`;
  if (external) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={cls}>
        <Icon className="size-4" />
        {label}
      </a>
    );
  }
  return (
    <Link href={href} className={cls}>
      <Icon className="size-4" />
      {label}
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="sticky top-0 flex h-screen flex-col border-r border-fill/60 bg-page px-3 py-3">
      <div className="flex items-center justify-between px-1.5">
        {/* Plain mark, not the AGI House logo */}
        <div className="flex items-center gap-2">
          <div className="grid size-7 place-items-center rounded-md bg-text text-[13px] font-bold text-page">N</div>
        </div>
        <button className="rounded-md p-1.5 text-text-2 hover:text-text" aria-label="Collapse sidebar">
          <PanelLeft className="size-4" />
        </button>
      </div>

      <button className="mt-4 flex w-full items-center gap-2 rounded-md border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-[13px] text-text-3">
        <Search className="size-3.5" />
        <span className="flex-1 text-left">Search…</span>
        <kbd className="rounded border border-white/10 px-1 font-mono text-[10px]">⌘K</kbd>
      </button>

      <nav className="mt-4 flex flex-col gap-0.5">
        <NavItem href="https://www.agihouse.org/events" label="Events" icon={Calendar} external />
      </nav>

      <SectionLabel className="mt-6 mb-2 px-2.5">Newsroom</SectionLabel>
      <nav className="flex flex-col gap-0.5">
        {newsroomNav.map((n) => (
          <NavItem key={n.href} {...n} active={pathname === n.href || pathname.startsWith(n.href + "/")} />
        ))}
      </nav>

      <SectionLabel className="mt-6 mb-2 px-2.5">Prototype</SectionLabel>
      <nav className="flex flex-col gap-0.5">
        <NavItem href="/style-tile" label="Style tile" icon={Palette} active={pathname === "/style-tile"} />
      </nav>

      <div className="mt-auto px-2.5 pb-1">
        <div className="text-[11px] leading-4 text-text-3">
          Prototype by Coco Wu
          <br />
          Not an official AGI House product
        </div>
      </div>
    </aside>
  );
}
