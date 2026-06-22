import { NextRequest } from "next/server";

export const maxDuration = 30;

export interface RedirectStep {
  url: string;
  status: number;
  statusText: string;
  location: string;
  responseTime: number;
  isRedirect: boolean;
}

export interface RedirectResult {
  startUrl: string;
  finalUrl: string;
  steps: RedirectStep[];
  totalTime: number;
  hasLoop: boolean;
  checkedAt: string;
}

const REDIRECT_CODES = new Set([301, 302, 303, 307, 308]);
const MAX_HOPS = 12;

function statusLabel(code: number): string {
  const map: Record<number, string> = {
    200: "OK", 301: "Moved Permanently", 302: "Found",
    303: "See Other", 307: "Temporary Redirect", 308: "Permanent Redirect",
    400: "Bad Request", 401: "Unauthorized", 403: "Forbidden",
    404: "Not Found", 410: "Gone", 500: "Internal Server Error",
    502: "Bad Gateway", 503: "Service Unavailable", 504: "Gateway Timeout",
  };
  return map[code] ?? "Unknown";
}

export async function GET(req: NextRequest) {
  const rawUrl = req.nextUrl.searchParams.get("url") ?? "";
  if (!rawUrl) return Response.json({ error: "Missing url parameter." }, { status: 400 });

  let currentUrl: string;
  try {
    const u = new URL(rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`);
    currentUrl = u.toString();
  } catch {
    return Response.json({ error: "Invalid URL." }, { status: 400 });
  }

  const startUrl = currentUrl;
  const steps: RedirectStep[] = [];
  const visited = new Set<string>();
  let hasLoop = false;
  const globalStart = Date.now();

  for (let hop = 0; hop < MAX_HOPS; hop++) {
    if (visited.has(currentUrl)) {
      hasLoop = true;
      break;
    }
    visited.add(currentUrl);

    const hopStart = Date.now();
    let res: Response;
    try {
      res = await fetch(currentUrl, {
        method: "HEAD",
        redirect: "manual",
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; ToolNestAI/1.0; +https://toolnestai.net/bot)",
        },
        signal: AbortSignal.timeout(8000),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      steps.push({
        url: currentUrl,
        status: 0,
        statusText: msg.includes("timeout") ? "Request Timeout" : `Network Error: ${msg}`,
        location: "",
        responseTime: Date.now() - hopStart,
        isRedirect: false,
      });
      break;
    }

    const responseTime = Date.now() - hopStart;
    const location = res.headers.get("location") ?? "";
    const isRedirect = REDIRECT_CODES.has(res.status);

    steps.push({
      url: currentUrl,
      status: res.status,
      statusText: statusLabel(res.status),
      location,
      responseTime,
      isRedirect,
    });

    if (!isRedirect) break;
    if (!location) break;

    // Resolve relative Location headers
    try {
      currentUrl = new URL(location, currentUrl).toString();
    } catch {
      break;
    }
  }

  const finalStep = steps[steps.length - 1];
  const finalUrl = finalStep?.location
    ? (REDIRECT_CODES.has(finalStep.status) ? currentUrl : finalStep.url)
    : finalStep?.url ?? startUrl;

  return Response.json({
    startUrl,
    finalUrl: steps[steps.length - 1]?.isRedirect ? currentUrl : (steps[steps.length - 1]?.url ?? startUrl),
    steps,
    totalTime: Date.now() - globalStart,
    hasLoop,
    checkedAt: new Date().toISOString(),
  } satisfies RedirectResult);
}
