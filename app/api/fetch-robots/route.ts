import { NextRequest } from "next/server";

export const maxDuration = 20;

export async function GET(req: NextRequest) {
  const rawUrl = req.nextUrl.searchParams.get("url") ?? "";
  if (!rawUrl) return Response.json({ error: "Missing url parameter." }, { status: 400 });

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`);
  } catch {
    return Response.json({ error: "Invalid URL." }, { status: 400 });
  }

  // Normalise to robots.txt path
  const robotsUrl = `${parsedUrl.protocol}//${parsedUrl.host}/robots.txt`;

  let res: Response;
  try {
    res = await fetch(robotsUrl, {
      method: "GET",
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; ToolNestAI/1.0; +https://toolnestai.net/bot)",
        "Accept": "text/plain,*/*;q=0.8",
      },
      signal: AbortSignal.timeout(12000),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return Response.json(
      { error: msg.includes("timeout") ? "Request timed out." : `Fetch failed: ${msg}` },
      { status: 400 },
    );
  }

  if (res.status === 404) {
    return Response.json({ error: "No robots.txt found at this domain (404)." }, { status: 404 });
  }
  if (!res.ok) {
    return Response.json({ error: `Server returned ${res.status} ${res.statusText}.` }, { status: 400 });
  }

  const text = await res.text();
  return Response.json({ text, url: robotsUrl });
}
