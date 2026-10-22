// Editorial profile: who we write for, what we care about, and how we sound.
// The ranking judge reads this; the drafting prompts read the style notes and formats.
// Placeholders are sensible guesses from blog.agihouse.org and agihouse.org/events; edit freely.

export type ThemeId = "self-improving" | "ai-for-science" | "physical-ai" | "agents" | "world-models" | "voice" | "infra" | "security" | "other";

export const editorialProfile = {
  publication: "AGI House Research Blog",
  audience: [
    "founders building AI products",
    "engineers shipping agents, voice and robotics systems",
    "researchers at frontier and academic labs",
  ],
  // Focus themes with weights. Theme fit is judged against these; weights scale the signal.
  themes: [
    { id: "self-improving", name: "Self-improving systems and autoresearch", weight: 1.0, keywords: ["self-improv", "autoresearch", "auto-research", "RL", "reinforcement", "scaling", "test-time", "recursive", "evals"] },
    { id: "ai-for-science", name: "AI for science", weight: 0.95, keywords: ["science", "biology", "genomics", "protein", "chemistry", "materials", "drug", "lab"] },
    { id: "physical-ai", name: "Physical AI and robotics", weight: 0.9, keywords: ["robot", "humanoid", "embodied", "manipulation", "physical", "edge", "hardware"] },
    { id: "agents", name: "Agents and long-horizon autonomy", weight: 0.9, keywords: ["agent", "agentic", "tool use", "computer use", "long-horizon", "MCP", "orchestration", "coding agent"] },
    { id: "world-models", name: "World models and simulation", weight: 0.8, keywords: ["world model", "simulation", "video model", "generative environment", "planning"] },
    { id: "voice", name: "Voice and realtime multimodal", weight: 0.75, keywords: ["voice", "speech", "realtime", "full-duplex", "TTS", "ASR", "audio"] },
    { id: "infra", name: "Inference infrastructure and data", weight: 0.6, keywords: ["inference", "GPU", "serving", "kernel", "training infra", "dataset", "open weights", "open-source model"] },
    { id: "security", name: "Security and identity for agents", weight: 0.5, keywords: ["security", "identity", "auth", "prompt injection", "jailbreak", "safety"] },
  ] as const,
  // Post formats and what each one is for.
  formats: {
    "technical-primer": {
      name: "Technical primer",
      when: "A technique or system the audience should understand before building with it. Long, layered, 1,800 to 2,500 words.",
      sections: ["Why this matters now", "The core idea", "How it works", "What changed recently", "Open problems", "What to build"],
    },
    "research-brief": {
      name: "Research brief",
      when: "A fast-moving research thread: what the papers claim, what holds up, what is next. 1,200 to 1,800 words.",
      sections: ["The claim", "Evidence so far", "Who is working on it", "What would change our mind", "For builders"],
    },
    "event-recap": {
      name: "Event recap",
      when: "Tied to an AGI House event: what happened, who built what, what we learned. 900 to 1,400 words.",
      sections: ["Setting", "What was built", "What we learned", "What is next"],
    },
  },
  // Upcoming events and sponsors: stories that tie in get an event boost and an event-recap suggestion.
  upcomingEvents: [
    { name: "Google Gemma Hardware Hackathon", date: "2026-10-24", keywords: ["gemma", "edge", "on-device", "hardware", "physical ai", "nvidia", "jetson"] },
    { name: "Long-Horizon Agents Build Day", date: "2026-10-31", keywords: ["long-horizon", "long horizon", "agentic", "coding agent", "autonomy", "reliability", "harness"] },
    { name: "Auto-Research Summit (follow-up)", date: "2026-11-14", keywords: ["autoresearch", "self-improv", "automated research", "ai scientist"] },
  ],
  sponsors: ["Coframs", "Inworld", "Tenstorrent", "Google"],
  houseStyle: [
    "Written for builders: concrete, technical, no hype.",
    "Open with why this matters now, in one or two sentences.",
    "Name the labs, papers and people. Link primary sources inline.",
    "Short paragraphs. Section headings in plain words. Bulleted lists for comparisons.",
    "Quotes stay under 15 words and are attributed.",
    "Close with what the reader should build, read or watch next.",
    "Tie back to the AGI House community (events, builders) when it is honest to do so.",
  ],
};

export type FormatId = keyof typeof editorialProfile.formats;
