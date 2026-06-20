// ── Task types ────────────────────────────────────────────────────────────────

export type AITaskType =
  | "chat"
  | "translate"
  | "summarize"
  | "generateEmail"
  | "generateResume"
  | "generateText";

// ── Model identifiers ─────────────────────────────────────────────────────────
// Gemini direct-API IDs have no "/" — all OpenRouter IDs contain "/".

export type AIModelId =
  // Google Gemini (direct Gemini API)
  | "gemini-2.5-flash"
  | "gemini-2.5-pro"
  | "gemini-2.0-flash"
  | "gemini-1.5-flash"
  | "gemini-1.5-pro"
  // DeepSeek (OpenRouter)
  | "deepseek/deepseek-chat"
  | "deepseek/deepseek-r1"
  // Anthropic Claude (OpenRouter)
  | "anthropic/claude-haiku-4-5"
  | "anthropic/claude-sonnet-4-5"
  | "anthropic/claude-opus-4"
  // OpenAI GPT (OpenRouter)
  | "openai/gpt-4o-mini"
  | "openai/gpt-4o"
  // Google Gemini (OpenRouter — legacy)
  | "google/gemini-flash-1.5"
  | "google/gemini-pro-1.5"
  // Mistral (OpenRouter)
  | "mistralai/mistral-small"
  | "mistralai/mistral-large"
  // Qwen (OpenRouter)
  | "qwen/qwen-2.5-72b-instruct"
  // Meta Llama (OpenRouter)
  | "meta-llama/llama-3.3-70b-instruct"
  // Allow any model string
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

export type TranslationStyle =
  | "standard"
  | "professional"
  | "formal"
  | "casual"
  | "natural"
  | "academic";

export interface TranslatePayload {
  text: string;
  targetLanguage: string;
  sourceLanguage?: string;
  style?: TranslationStyle;
  preserveFormatting?: boolean;
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

export interface WorkExperience {
  jobTitle: string;
  company: string;
  location?: string;
  startDate: string;
  endDate?: string;
  current: boolean;
  responsibilities: string;
}

export interface EducationEntry {
  degree: string;
  fieldOfStudy?: string;
  school: string;
  location?: string;
  year?: string;
}

export interface GenerateResumePayload {
  // Personal information
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  linkedin?: string;
  portfolio?: string;
  // Professional summary (user-written or AI-generated)
  summary?: string;
  // Structured experience / education
  experience: WorkExperience[];
  education: EducationEntry[];
  // Skills
  technicalSkills?: string;
  softSkills?: string;
  languages?: string;
  certificates?: string;
  // Optional job description for ATS optimisation
  jobDescription?: string;
}

export interface ChatPayload {
  messages: AIMessage[];
  systemPrompt?: string;
}
