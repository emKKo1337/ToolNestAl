import type { AIErrorCode, AIErrorPayload } from "@/types/ai";

// ── Error class ───────────────────────────────────────────────────────────────

export class AIError extends Error {
  readonly code: AIErrorCode;
  readonly status: number;

  constructor(code: AIErrorCode, message: string, status = 500) {
    super(message);
    this.name = "AIError";
    this.code = code;
    this.status = status;
  }

  toPayload(): AIErrorPayload {
    return { code: this.code, message: this.message, status: this.status };
  }

  toResponse(): Response {
    return Response.json(this.toPayload(), { status: this.status });
  }
}

// ── Factory helpers ───────────────────────────────────────────────────────────

export const AIErrors = {
  missingApiKey: () =>
    new AIError(
      "MISSING_API_KEY",
      "AI service is not configured. Please contact support.",
      503
    ),

  rateLimited: () =>
    new AIError(
      "RATE_LIMITED",
      "Too many requests. Please wait a moment and try again.",
      429
    ),

  modelUnavailable: (model: string) =>
    new AIError(
      "MODEL_UNAVAILABLE",
      `The requested model (${model}) is currently unavailable.`,
      503
    ),

  invalidRequest: (detail: string) =>
    new AIError("INVALID_REQUEST", detail, 400),

  upstreamError: (detail?: string) =>
    new AIError(
      "UPSTREAM_ERROR",
      detail ?? "The AI provider returned an unexpected error. Please try again.",
      502
    ),

  unknown: (err?: unknown) => {
    const msg =
      err instanceof Error ? err.message : "An unexpected error occurred.";
    return new AIError("UNKNOWN", msg, 500);
  },
} as const;

// ── Normalise any thrown value into an AIError ────────────────────────────────

export function normalizeError(err: unknown): AIError {
  if (err instanceof AIError) return err;

  if (err instanceof Error) {
    // OpenRouter / OpenAI SDK surfaces HTTP errors with a `status` property
    const status = (err as { status?: number }).status;

    if (status === 429) return AIErrors.rateLimited();
    if (status === 401 || status === 403) return AIErrors.missingApiKey();
    if (status && status >= 500) return AIErrors.upstreamError(err.message);
    return AIErrors.unknown(err);
  }

  return AIErrors.unknown(err);
}

// ── Convenience: turn any error into an HTTP Response ─────────────────────────

export function errorResponse(err: unknown): Response {
  return normalizeError(err).toResponse();
}
