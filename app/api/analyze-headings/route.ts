import { NextRequest } from "next/server";

export const maxDuration = 30;

export interface HeadingEntry {
  level: number;
  text: string;
  index: number;
}

export interface HeadingResult {
  url: string;
  fetchedAt: string;
  headings: HeadingEntry[];
  stats: { h1: number; h2: number; h3: number; h4: number; h5: number; h6: number; total: number };
}

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
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

  let html: string;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const res = await fetch(parsedUrl.toString(), {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; ToolNestAI/1.0; +https://toolnestai.net/bot)",
        "Accept": "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return Response.json({ error: `Server returned ${res.status} ${res.statusText}.` }, { status: 400 });
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("html")) return Response.json({ error: `URL does not return HTML (content-type: ${ct}).` }, { status: 400 });
    html = await res.text();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("abort")) return Response.json({ error: "Request timed out after 15 seconds." }, { status: 408 });
    return Response.json({ error: `Fetch failed: ${msg}` }, { status: 400 });
  }

  // Strip <script>, <style>, <noscript>, <head> blocks before extracting headings
  const cleaned = html
    .replace(/<head[\s\S]*?<\/head>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "");

  const headingRe = /<(h[1-6])[^>]*>([\s\S]*?)<\/\1>/gi;
  const headings: HeadingEntry[] = [];
  let match: RegExpExecArray | null;
  let idx = 0;
  while ((match = headingRe.exec(cleaned)) !== null) {
    const level = parseInt(match[1].slice(1), 10);
    const text  = stripTags(match[2]);
    headings.push({ level, text, index: idx++ });
  }

  const stats = { h1: 0, h2: 0, h3: 0, h4: 0, h5: 0, h6: 0, total: headings.length };
  for (const h of headings) stats[`h${h.level}` as keyof typeof stats]++;

  return Response.json({ url: parsedUrl.toString(), fetchedAt: new Date().toISOString(), headings, stats } satisfies HeadingResult);
}
