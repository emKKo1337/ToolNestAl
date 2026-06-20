import type { AIModelId } from "@/types/ai";

// ── Environment ───────────────────────────────────────────────────────────────

export const AI_CONFIG = {
  // Google Gemini (primary provider)
  geminiApiKey: process.env.GEMINI_API_KEY ?? "",
  // OpenRouter (fallback for non-Gemini models)
  apiKey: process.env.OPENROUTER_API_KEY ?? "",
  baseURL:
    process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1",
  siteURL: process.env.SITE_URL ?? "https://www.toolnestai.net",
  siteName: process.env.SITE_NAME ?? "ToolNest AI",
  defaultModel: (process.env.DEFAULT_AI_MODEL ??
    "gemini-2.5-flash") as AIModelId,
} as const;

// ── Model registry ────────────────────────────────────────────────────────────
// Add or remove models here — UI components never reference model IDs directly.

export interface ModelInfo {
  id: AIModelId;
  label: string;
  provider: string;
  contextWindow: number;
  /** Approximate cost tier: 1 = cheapest, 5 = most expensive */
  costTier: 1 | 2 | 3 | 4 | 5;
  supportsStreaming: boolean;
}

export const MODEL_REGISTRY: ModelInfo[] = [
  // ── Google Gemini (direct API) ────────────────────────────────────────────
  {
    id: "gemini-2.5-flash",
    label: "Gemini 2.5 Flash",
    provider: "Google",
    contextWindow: 1_000_000,
    costTier: 1,
    supportsStreaming: true,
  },
  {
    id: "gemini-2.5-pro",
    label: "Gemini 2.5 Pro",
    provider: "Google",
    contextWindow: 1_000_000,
    costTier: 3,
    supportsStreaming: true,
  },
  {
    id: "gemini-2.0-flash",
    label: "Gemini 2.0 Flash",
    provider: "Google",
    contextWindow: 1_000_000,
    costTier: 1,
    supportsStreaming: true,
  },
  {
    id: "gemini-1.5-flash",
    label: "Gemini 1.5 Flash",
    provider: "Google",
    contextWindow: 1_000_000,
    costTier: 1,
    supportsStreaming: true,
  },
  {
    id: "gemini-1.5-pro",
    label: "Gemini 1.5 Pro",
    provider: "Google",
    contextWindow: 2_000_000,
    costTier: 3,
    supportsStreaming: true,
  },
  // ── OpenRouter models (fallback) ──────────────────────────────────────────
  {
    id: "deepseek/deepseek-chat",
    label: "DeepSeek Chat",
    provider: "DeepSeek",
    contextWindow: 64_000,
    costTier: 1,
    supportsStreaming: true,
  },
  {
    id: "deepseek/deepseek-r1",
    label: "DeepSeek R1",
    provider: "DeepSeek",
    contextWindow: 64_000,
    costTier: 2,
    supportsStreaming: true,
  },
  {
    id: "anthropic/claude-haiku-4-5",
    label: "Claude Haiku 4.5",
    provider: "Anthropic",
    contextWindow: 200_000,
    costTier: 2,
    supportsStreaming: true,
  },
  {
    id: "anthropic/claude-sonnet-4-5",
    label: "Claude Sonnet 4.5",
    provider: "Anthropic",
    contextWindow: 200_000,
    costTier: 3,
    supportsStreaming: true,
  },
  {
    id: "anthropic/claude-opus-4",
    label: "Claude Opus 4",
    provider: "Anthropic",
    contextWindow: 200_000,
    costTier: 5,
    supportsStreaming: true,
  },
  {
    id: "openai/gpt-4o-mini",
    label: "GPT-4o Mini",
    provider: "OpenAI",
    contextWindow: 128_000,
    costTier: 1,
    supportsStreaming: true,
  },
  {
    id: "openai/gpt-4o",
    label: "GPT-4o",
    provider: "OpenAI",
    contextWindow: 128_000,
    costTier: 3,
    supportsStreaming: true,
  },
  {
    id: "mistralai/mistral-small",
    label: "Mistral Small",
    provider: "Mistral",
    contextWindow: 32_000,
    costTier: 1,
    supportsStreaming: true,
  },
  {
    id: "mistralai/mistral-large",
    label: "Mistral Large",
    provider: "Mistral",
    contextWindow: 128_000,
    costTier: 3,
    supportsStreaming: true,
  },
  {
    id: "qwen/qwen-2.5-72b-instruct",
    label: "Qwen 2.5 72B",
    provider: "Qwen",
    contextWindow: 131_072,
    costTier: 1,
    supportsStreaming: true,
  },
  {
    id: "meta-llama/llama-3.3-70b-instruct",
    label: "Llama 3.3 70B",
    provider: "Meta",
    contextWindow: 128_000,
    costTier: 1,
    supportsStreaming: true,
  },
];

export function getModelInfo(id: AIModelId): ModelInfo | undefined {
  return MODEL_REGISTRY.find((m) => m.id === id);
}

// ── Per-task model overrides ──────────────────────────────────────────────────
// Override which model is used per task type. Falls back to defaultModel.

export const TASK_MODELS: Partial<Record<string, AIModelId>> = {
  chat: "gemini-2.5-flash",
  translate: "gemini-2.5-flash",
  summarize: "gemini-2.5-flash",
  generateEmail: "gemini-2.5-flash",
  generateResume: "gemini-2.5-flash",
  generateText: "gemini-2.5-flash",
};

export function getModelForTask(task: string): AIModelId {
  return TASK_MODELS[task] ?? AI_CONFIG.defaultModel;
}
