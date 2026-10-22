// Sticky title bar at the top of the center column, like "Events ... Sign in" on the live site.
export function TopBar({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <div className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-fill/60 bg-page/80 px-6 backdrop-blur">
      <h1 className="text-[20px] font-semibold tracking-[-0.5px] text-text">{title}</h1>
      <div className="flex items-center gap-2">{right}</div>
    </div>
  );
}
