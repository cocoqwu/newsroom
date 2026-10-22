import { Sidebar } from "@/components/shell/Sidebar";
import { RightPanel } from "@/components/shell/RightPanel";

// Three-pane layout, same bones as agihouse.org/events: sidebar | center column | right panel.
export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen grid-cols-[240px_minmax(0,1fr)] lg:grid-cols-[240px_minmax(0,1fr)_300px]">
      <Sidebar />
      <main className="min-w-0 border-r border-fill/60">{children}</main>
      <RightPanel />
    </div>
  );
}
