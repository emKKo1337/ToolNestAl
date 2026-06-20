// ── Task types ────────────────────────────────────────────────────────────────

export type AITaskType =
  | "chat"
  | "translate"
  | "summarize"
  | "generateEmail"
  | "generateResume"
  | "generateText";

// ── Model identifiers (OpenRouter slugs) ──────────────────────────────────────

export type AIModelId =
  // DeepSeek
  | "deepseek/deepseek-chat"
  | "deepseek/deepseek-r1"
  // Anthropic Claude
  | "anthropic/claude-haiku-4-5"
  | "anthropic/claude-sonnet-4-5"
  | "anthropic/claude-opus-4"
  // OpenAI GPT
  | "openai/gpt-4o-mini"
  | "openai/gpt-4o"
  // Google Gemini
  | "google/gemini-flash-1.5"
  | "google/gemini-pro-1.5"
  // Mistral
  | "mistralai/mistral-small"
  | "mistralai/mistral-large"
  // Qwen
  | "qwen/qwen-2.5-72b-instruct"
  // Meta Llama
  | "meta-llama/llama-3.3-70b-instruct"
  // Allow any OpenRouter model string
  | (string & {});

// ── Request / response types ──────────────────────────────────────────────────

export interface AIMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface AIRequestOptions {
  model?: AIModelId;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  systemPrompt?: string;
}

export interface AIRequest {
  task: AITaskType;
  /** Flat string prompt — used for single-turn tasks (translate, summarize, etc.) */
  prompt?: string;
  /** Multi-turn conversation history — used for chat */
  messages?: AIMessage[];
  /** Task-specific structured payload (typed per task in services.ts) */
  payload?: Record<string, unknown>;
  options?: AIRequestOptions;
}

export interface AIUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface AIResponse {
  text: string;
  model: string;
  usage?: AIUsage;
}

// ── Streaming ─────────────────────────────────────────────────────────────────

export interface AIStreamChunk {
  delta: string;
  done: boolean;
}

// ── Error ─────────────────────────────────────────────────────────────────────

export interface AIErrorPayload {
  code: AIErrorCode;
  message: string;
  status: number;
}

export type AIErrorCode =
  | "MISSING_API_KEY"
  | "RATE_LIMITED"
  | "MODEL_UNAVAILABLE"
  | "INVALID_REQUEST"
  | "UPSTREAM_ERROR"
  | "UNKNOWN";

// ── Per-task payload types (used in services.ts) ──────────────────────────────

export interface TranslatePayload {
  text: string;
  targetLanguage: string;
  sourceLanguage?: string;
}

export interface SummarizePayload {
  text: string;
  style?: "bullet" | "paragraph" | "executive" | "key-takeaways";
  length?: "short" | "medium" | "long";
  language?: string;
}

export interface GenerateEmailPayload {
  recipient?: string;
  purpose: string;
  tone?: string;
  length?: "short" | "medium" | "long";
  language?: string;
  additionalInstructions?: string;
}

export interface GenerateResumePayload {
  name: string;
  jobTitle: string;
  experience: string;
  skills: string;
  education?: string;
  additionalInfo?: string;
}

export interface ChatPayload {
  messages: AIMessage[];
  systemPrompt?: string;
}
