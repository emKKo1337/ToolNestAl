import { createOpenAI } from "@ai-sdk/openai";
import { AI_CONFIG } from "./config";
import { AIErrors } from "./errors";
import type { AIModelId } from "@/types/ai";

// ── OpenRouter client (singleton) ─────────────────────────────────────────────
// OpenRouter is OpenAI-compatible — we point the OpenAI provider at their base URL.

let _client: ReturnType<typeof createOpenAI> | null = null;

function getClient() {
  if (!_client) {
    _client = createOpenAI({
      apiKey: AI_CONFIG.apiKey,
      baseURL: AI_CONFIG.baseURL,
      // OpenRouter requires these headers for attribution and rate-limiting
      headers: {
        "HTTP-Referer": AI_CONFIG.siteURL,
        "X-Title": AI_CONFIG.siteName,
      },
    });
  }
  return _client;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Returns a Vercel AI SDK model instance for the given OpenRouter model ID.
 * All service functions go through this so the provider is never scattered
 * across the codebase.
 */
export function getAIModel(modelId: AIModelId) {
  if (!AI_CONFIG.apiKey) {
    throw AIErrors.missingApiKey();
  }
  return getClient()(modelId);
}
