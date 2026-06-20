// ── In-memory rate limiter ────────────────────────────────────────────────────
// Simple sliding-window counter keyed by IP.
// Replace with Redis / Upstash for multi-instance production deployments.

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

const store = new Map<string, RateLimitEntry>();

export interface RateLimitOptions {
  /** Max requests per window */
  limit: number;
  /** Window length in milliseconds */
  windowMs: number;
}

const DEFAULTS: RateLimitOptions = {
  limit: 20,
  windowMs: 60_000, // 20 req / minute per IP
};

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

export function checkRateLimit(
  key: string,
  opts: RateLimitOptions = DEFAULTS
): RateLimitResult {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now - entry.windowStart > opts.windowMs) {
    // New window
    store.set(key, { count: 1, windowStart: now });
    return { allowed: true, remaining: opts.limit - 1, resetAt: now + opts.windowMs };
  }

  entry.count += 1;
  const remaining = Math.max(0, opts.limit - entry.count);
  return {
    allowed: entry.count <= opts.limit,
    remaining,
    resetAt: entry.windowStart + opts.windowMs,
  };
}

/** Extract a usable key from a Next.js Request (IP or fallback). */
export function getRateLimitKey(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    req.headers.get("x-real-ip") ??
    "anonymous"
  );
}
