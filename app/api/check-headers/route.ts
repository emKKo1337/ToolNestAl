import { NextRequest } from "next/server";

export const maxDuration = 30;

export interface CookieInfo {
  name: string;
  secure: boolean;
  httpOnly: boolean;
  sameSite: string;
  raw: string;
}

export interface HeaderResult {
  url: string;
  checkedAt: string;
  status: number;
  statusText: string;
  httpVersion: string;
  responseTime: number;
  ttfb: number;
  // grouped header values
  headers: Record<string, string>;
  cookies: CookieInfo[];
}

function parseCookies(setCookieLines: string[]): CookieInfo[] {
  return setCookieLines.map(raw => {
    const parts = raw.split(";").map(p => p.trim());
    const nameVal = parts[0] ?? "";
    const name = nameVal.split("=")[0]?.trim() ?? "";
    const lower = raw.toLowerCase();
    const sameSiteMatch = lower.match(/samesite=([^;]+)/);
    return {
      name,
      secure:   lower.includes("secure"),
      httpOnly: lower.includes("httponly"),
      sameSite: sameSiteMatch?.[1]?.trim() ?? "not set",
      raw,
    };
  });
}

export async function GET(req: NextRequest) {
  const rawUrl = req.nextUrl.searchParams.get("url") ?? "";
  if (!rawUrl) return Response.json({ error: "Missing url parameter." }, { status: 400 });

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`);
  } catch {
    return Response.json({ error: "Invalid URL." }, { status: 400 });
  }

  const start = Date.now();
  let res: Response;
  try {
    res = await fetch(parsedUrl.toString(), {
      method: "GET",
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; ToolNestAI/1.0; +https://toolnestai.net/bot)",
        "Accept": "text/html,application/xhtml+xml,*/*;q=0.8",
        "Accept-Encoding": "br, gzip, deflate",
      },
      signal: AbortSignal.timeout(15000),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return Response.json(
      { error: msg.includes("timeout") ? "Request timed out after 15 seconds." : `Fetch failed: ${msg}` },
      { status: 400 },
    );
  }

  const responseTime = Date.now() - start;

  // Collect all headers into a plain object (lowercased keys)
  const headers: Record<string, string> = {};
  const setCookieRaw: string[] = [];
  res.headers.forEach((value, key) => {
    const k = key.toLowerCase();
    if (k === "set-cookie") {
      setCookieRaw.push(value);
    } else {
      headers[k] = value;
    }
  });
  if (setCookieRaw.length) headers["set-cookie"] = setCookieRaw.join("\n---\n");

  const cookies = parseCookies(setCookieRaw);

  return Response.json({
    url: parsedUrl.toString(),
    checkedAt: new Date().toISOString(),
    status: res.status,
    statusText: res.statusText || statusText(res.status),
    httpVersion: "HTTP/1.1",
    responseTime,
    ttfb: responseTime,
    headers,
    cookies,
  } satisfies HeaderResult);
}

function statusText(code: number): string {
  const m: Record<number, string> = {
    200: "OK", 301: "Moved Permanently", 302: "Found", 304: "Not Modified",
    400: "Bad Request", 401: "Unauthorized", 403: "Forbidden", 404: "Not Found",
    500: "Internal Server Error", 503: "Service Unavailable",
  };
  return m[code] ?? "Unknown";
}
