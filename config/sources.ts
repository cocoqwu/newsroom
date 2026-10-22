// Every collection source: type, URL, cadence, and a 0-1 quality weight used by the ranker.
// RSS feeds and official APIs only. A failing source is logged and skipped, never fatal.

export type SourceType = "rss" | "arxiv" | "hf_papers" | "github" | "hn";

export type Source = {
  id: string;
  name: string;
  type: SourceType;
  url: string;
  cadence: "hourly" | "daily";
  quality: number; // 1.0 = frontier lab primary source, 0.4 = aggregator
  group: "lab" | "paper" | "code" | "community" | "press";
  disabled?: string; // reason, when a source has no usable feed; shown in the run summary
};

export const sources: Source[] = [
  // Frontier lab blogs
  { id: "openai", name: "OpenAI", type: "rss", url: "https://openai.com/news/rss.xml", cadence: "daily", quality: 1.0, group: "lab" },
  // Anthropic and xAI publish no RSS feed (checked Oct 22, 2026: every likely URL is 404/403).
  // Kept here so the run summary shows them as "no feed", and so a future adapter can slot in.
  { id: "anthropic", name: "Anthropic", type: "rss", url: "https://www.anthropic.com/rss.xml", cadence: "daily", quality: 1.0, group: "lab", disabled: "no public RSS feed; roadmap: parse anthropic.com/news" },
  { id: "deepmind", name: "Google DeepMind", type: "rss", url: "https://deepmind.google/blog/rss.xml", cadence: "daily", quality: 1.0, group: "lab" },
  { id: "google-ai", name: "Google AI blog", type: "rss", url: "https://blog.google/technology/ai/rss", cadence: "daily", quality: 0.9, group: "lab" },
  { id: "google-research", name: "Google Research blog", type: "rss", url: "https://research.google/blog/rss/", cadence: "daily", quality: 0.95, group: "lab" },
  { id: "meta-eng", name: "Meta Engineering (AI)", type: "rss", url: "https://engineering.fb.com/feed/", cadence: "daily", quality: 0.85, group: "lab" },
  { id: "msr", name: "Microsoft Research", type: "rss", url: "https://www.microsoft.com/en-us/research/feed/", cadence: "daily", quality: 0.9, group: "lab" },
  { id: "nvidia-dev", name: "NVIDIA Technical Blog", type: "rss", url: "https://developer.nvidia.com/blog/feed/", cadence: "daily", quality: 0.85, group: "lab" },
  { id: "nvidia", name: "NVIDIA Blog", type: "rss", url: "https://blogs.nvidia.com/feed/", cadence: "daily", quality: 0.8, group: "lab" },
  { id: "mistral", name: "Mistral AI", type: "rss", url: "https://mistral.ai/rss.xml", cadence: "daily", quality: 0.9, group: "lab" },
  { id: "xai", name: "xAI", type: "rss", url: "https://x.ai/news/rss.xml", cadence: "daily", quality: 0.9, group: "lab", disabled: "no public RSS feed (403/404)" },
  { id: "hf-blog", name: "Hugging Face blog", type: "rss", url: "https://huggingface.co/blog/feed.xml", cadence: "daily", quality: 0.8, group: "lab" },
  // Papers
  { id: "arxiv", name: "arXiv (cs.AI, cs.LG, cs.CL, cs.CV, cs.RO)", type: "arxiv", url: "https://export.arxiv.org/api/query", cadence: "daily", quality: 0.8, group: "paper" },
  { id: "hf-papers", name: "Hugging Face daily papers", type: "hf_papers", url: "https://huggingface.co/api/daily_papers", cadence: "daily", quality: 0.75, group: "paper" },
  // Code
  { id: "github", name: "GitHub trending ML repos", type: "github", url: "https://api.github.com/search/repositories", cadence: "daily", quality: 0.6, group: "code" },
  // Community
  { id: "hn", name: "Hacker News", type: "hn", url: "https://hn.algolia.com/api/v1/search", cadence: "hourly", quality: 0.5, group: "community" },
  // Tech press
  { id: "techcrunch", name: "TechCrunch AI", type: "rss", url: "https://techcrunch.com/category/artificial-intelligence/feed/", cadence: "hourly", quality: 0.55, group: "press" },
  { id: "verge", name: "The Verge AI", type: "rss", url: "https://www.theverge.com/rss/ai-artificial-intelligence/index.xml", cadence: "hourly", quality: 0.55, group: "press" },
  { id: "ars", name: "Ars Technica AI", type: "rss", url: "https://arstechnica.com/ai/feed/", cadence: "hourly", quality: 0.6, group: "press" },
  { id: "mit-tr", name: "MIT Technology Review AI", type: "rss", url: "https://www.technologyreview.com/topic/artificial-intelligence/feed", cadence: "daily", quality: 0.65, group: "press" },
  { id: "venturebeat", name: "VentureBeat AI", type: "rss", url: "https://venturebeat.com/category/ai/feed/", cadence: "hourly", quality: 0.5, group: "press", disabled: "feed returns 429 to non-browser clients" },
];

// How far back the first run looks when there is no previous run to compare against.
export const firstRunLookbackHours = 72;
// Hard cap per source so one noisy feed cannot dominate a run.
export const maxItemsPerSource = 60;
