// Signal weights for the 0-100 story score. Each signal is scored 0-1; total = sum(weight * value).
// Starting weights from the spec. The roadmap item "weights that learn from the editor's picks"
// would adjust these from the editor_actions table.

export const rankingWeights = {
  theme_fit: 25,
  significance: 20,
  novelty: 15,
  momentum: 15,
  event_tie_in: 10,
  source_quality: 10,
  freshness: 5,
} as const;

export type SignalId = keyof typeof rankingWeights;

export const signalDescriptions: Record<SignalId, string> = {
  theme_fit: "How well the story matches the focus themes in the editorial profile (LLM judge with rubric).",
  significance: "How much this changes what builders should do or believe (LLM judge with rubric).",
  novelty: "Distance from what the blog has already covered (embedding similarity to past posts).",
  momentum: "Cross-source pickup plus public signals: Hacker News points, GitHub stars, paper upvotes.",
  event_tie_in: "Keyword overlap with upcoming AGI House events and sponsors.",
  source_quality: "Best source in the cluster: lab blog or paper beats press beats aggregator.",
  freshness: "Hours since the newest item in the cluster; decays over about two days.",
};

// Clustering thresholds on cosine similarity of title+summary embeddings.
export const clustering = {
  mergeAbove: 0.82,      // definitely the same story
  borderlineAbove: 0.66, // ask the triage model
};

// Past-post similarity above this sets the "covered before" flag.
export const coveredBeforeThreshold = 0.72;

// Top list shape
export const digest = { topN: 10, wildcardFromRank: 11, wildcardToRank: 30 };
