// ── Task types ────────────────────────────────────────────────────────────────

export type AITaskType =
  | "chat"
  | "translate"
  | "summarize"
  | "generateEmail"
  | "generateResume"
  | "generateText"
  | "paraphrase"
  | "grammarCheck"
  | "humanize"
  | "coverLetter"
  | "generatePrompt"
  | "generateBusinessNames";

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

export interface GrammarCheckPayload {
  text: string;
  explainCorrections: boolean;
}

export interface GrammarCheckResult {
  corrected: string;
  explanation?: string;
}

export interface ChatPayload {
  messages: AIMessage[];
  systemPrompt?: string;
}

export type ParaphraseMode =
  | "standard"
  | "fluent"
  | "creative"
  | "academic"
  | "shorten"
  | "expand";

export interface ParaphrasePayload {
  text: string;
  mode: ParaphraseMode;
}

export type HumanizeStrength = "light" | "balanced" | "strong";

export interface HumanizePayload {
  text: string;
  strength: HumanizeStrength;
}

export type PromptCategory =
  | "writing"
  | "coding"
  | "marketing"
  | "seo"
  | "business"
  | "education"
  | "social-media"
  | "image-generation";

export type PromptAIModel =
  | "chatgpt"
  | "claude"
  | "gemini"
  | "grok"
  | "midjourney"
  | "stable-diffusion"
  | "any";

export type PromptTone =
  | "professional"
  | "casual"
  | "creative"
  | "technical"
  | "persuasive";

export type PromptLength = "short" | "medium" | "detailed";

export interface GeneratePromptPayload {
  goal: string;
  category: PromptCategory;
  model: PromptAIModel;
  tone: PromptTone;
  length: PromptLength;
  existingPrompt?: string;
}

export type BusinessNameStyle =
  | "modern"
  | "professional"
  | "luxury"
  | "creative"
  | "minimal";

export type BusinessNameLength = "short" | "medium" | "long";

export interface GenerateBusinessNamesPayload {
  description: string;
  industry: string;
  keywords?: string;
  style: BusinessNameStyle;
  length: BusinessNameLength;
  count?: number;
}

export type CoverLetterTone = "professional" | "friendly" | "confident";

export interface CoverLetterPayload {
  jobTitle: string;
  companyName: string;
  applicantName: string;
  yearsOfExperience: string;
  skills: string;
  tone: CoverLetterTone;
  additionalInfo?: string;
}
