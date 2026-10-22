// The blog-style article: white page, Tenor Sans uppercase headings, Source Serif body, small
// uppercase labels, a contents sidebar and a thin black rule above the hero. Mirrors
// blog.agihouse.org's post layout. Used inside the Draft screen and on /preview/[id].
export type BlogPostProps = {
  title: string;
  category: string;
  author: string;
  date: string;
  heroSvg?: string | null;
  heroDataUrl?: string | null;
  html: string;
  toc: { id: string; text: string }[];
  compact?: boolean; // embedded in the Draft screen: smaller hero, no top bar
  banner?: string;   // e.g. "Preview · not published"
};

export function BlogPost(p: BlogPostProps) {
  return (
    <div className="blog min-h-full">
      {!p.compact ? (
        <div className="flex h-[72px] items-center justify-between bg-ink px-8 text-paper">
          <span className="font-franklin text-[13px] font-semibold uppercase tracking-[2px]">Newsroom · blog preview</span>
          <span className="font-franklin text-[10px] font-semibold uppercase tracking-[1px] text-[#bbb]">{p.banner ?? "Preview · not published"}</span>
        </div>
      ) : null}
      <div className={`mx-auto ${p.compact ? "max-w-[900px] px-8 py-8" : "max-w-[1200px] px-10 pt-14 pb-20"}`}>
        <div className="blog-label text-ink-3">{p.category}</div>
        <h1 className={`mt-5 max-w-[900px] ${p.compact ? "text-[38px]! leading-[44px]!" : ""}`}>{p.title}</h1>
        <div className="mt-6 flex items-center gap-6">
          <span className="font-montserrat text-[10px] font-semibold uppercase tracking-[1px]">By {p.author}</span>
          <span className="font-montserrat text-[10px] font-semibold uppercase tracking-[1px]">{p.date}</span>
        </div>
        <div className="mt-10 border-t-2 border-ink" />
        {p.heroDataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.heroDataUrl} alt="" className="aspect-video w-full object-cover" />
        ) : p.heroSvg ? (
          <div className="aspect-video w-full [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: p.heroSvg }} />
        ) : null}
        <div className={`mt-10 grid gap-10 ${p.compact ? "grid-cols-1" : "grid-cols-[200px_minmax(0,734px)]"}`}>
          {!p.compact ? (
            <nav className="sticky top-8 self-start">
              <div className="blog-label mb-4">Contents</div>
              <ul className="flex flex-col gap-2">
                {p.toc.map((t) => (
                  <li key={t.id}><a href={`#${t.id}`} className="font-sans text-[13px] leading-5 text-ink no-underline hover:underline">{t.text}</a></li>
                ))}
              </ul>
            </nav>
          ) : null}
          <article className="blog-body max-w-[734px]" dangerouslySetInnerHTML={{ __html: p.html }} />
        </div>
      </div>
    </div>
  );
}
