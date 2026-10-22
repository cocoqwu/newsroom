import type { SourceType } from "@/config/sources";
import type { Adapter } from "./types";
import { rssAdapter } from "./rss";
import { arxivAdapter } from "./arxiv";
import { hfPapersAdapter } from "./hf";
import { githubAdapter } from "./github";
import { hnAdapter } from "./hn";

export const adapters: Record<SourceType, Adapter> = {
  rss: rssAdapter,
  arxiv: arxivAdapter,
  hf_papers: hfPapersAdapter,
  github: githubAdapter,
  hn: hnAdapter,
};
export * from "./types";
