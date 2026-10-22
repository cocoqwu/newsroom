// The one model interface everything else talks to. Swapping providers means adding a file
// here, not touching the pipeline or the screens.

export type Role = "triage" | "draft";

export type JsonSchema = Record<string, unknown>;

export type GenerateOpts = {
  role: Role;                 // picks the model: triage = fast/cheap, draft = stronger
  task: string;               // short label for logs and the replay cache: judge, outline, draft, ...
  prompt: string;
  system?: string;
  schema?: JsonSchema;        // when set, the model must return JSON matching this schema
  temperature?: number;
  maxOutputTokens?: number;
  runId?: number | null;
  draftId?: number | null;
};

export type GenerateResult = {
  text: string;
  model: string;
  provider: "gemini" | "replay" | "mock";
  tokensIn: number;
  tokensOut: number;
  durationMs: number;
};

export interface LLMProvider {
  readonly name: string;
  generate(opts: GenerateOpts, model: string): Promise<GenerateResult>;
}

export class ProviderError extends Error {
  constructor(message: string, public readonly status?: number, public readonly retryable = false) {
    super(message);
  }
}
