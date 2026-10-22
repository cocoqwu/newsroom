// Standalone HTML export of a post: the blog's fonts and type scale inlined, no app CSS needed.
export function toHtmlDocument(opts: { title: string; category: string; author: string; date: string; bodyHtml: string; heroSvg?: string | null; heroDataUrl?: string | null }): string {
  const hero = opts.heroDataUrl ? `<img class="hero" src="${opts.heroDataUrl}" alt="">` : opts.heroSvg ? `<div class="hero">${opts.heroSvg}</div>` : "";
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(opts.title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Tenor+Sans&family=Source+Serif+4:ital,wght@0,400;0,600;1,400&family=Libre+Franklin:wght@600&display=swap" rel="stylesheet">
<style>
  body { margin: 0; background: #fff; color: #000; font-family: "Source Serif 4", "Source Serif Pro", Georgia, serif; }
  .wrap { max-width: 900px; margin: 0 auto; padding: 56px 40px 96px; }
  .label { font-family: "Libre Franklin", sans-serif; font-size: 10px; font-weight: 600; letter-spacing: 1px; text-transform: uppercase; }
  .muted { color: #999; }
  h1, h2, h3 { font-family: "Tenor Sans", sans-serif; font-weight: 400; text-transform: uppercase; }
  h1 { font-size: 54px; line-height: 60px; margin: 20px 0 0; }
  h2 { font-size: 30px; line-height: 36px; margin: 40px 0 20px; }
  h3 { font-size: 22px; line-height: 28px; margin: 28px 0 12px; }
  .meta { display: flex; gap: 24px; margin-top: 24px; }
  .rule { border-top: 2px solid #000; margin-top: 40px; }
  .hero { width: 100%; aspect-ratio: 16 / 9; display: block; }
  .hero svg { width: 100%; height: 100%; }
  article { max-width: 734px; }
  p, li { font-size: 18px; line-height: 30px; }
  p { margin: 15px 0; }
  a { color: #0000ee; }
  blockquote { border-left: 2px solid #000; margin: 20px 0; padding-left: 20px; font-style: italic; }
  mark { background: #fff3bf; }
  code { font-family: "SF Mono", Menlo, monospace; font-size: 15px; background: #f2f2f2; padding: 1px 4px; border-radius: 3px; }
</style>
</head>
<body>
<div class="wrap">
  <div class="label muted">${escapeHtml(opts.category)}</div>
  <h1>${escapeHtml(opts.title)}</h1>
  <div class="meta"><span class="label">By ${escapeHtml(opts.author)}</span><span class="label">${escapeHtml(opts.date)}</span></div>
  <div class="rule"></div>
  ${hero}
  <article>
${opts.bodyHtml}
  </article>
</div>
</body>
</html>
`;
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
