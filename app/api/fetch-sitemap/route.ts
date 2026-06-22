import { NextRequest } from "next/server";

export const maxDuration = 30;

export async function GET(req: NextRequest) {
  const rawUrl = req.nextUrl.searchParams.get("url") ?? "";
  if (!rawUrl) return Response.json({ error: "Missing url parameter." }, { status: 400 });

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`);
  } catch {
    return Response.json({ error: "Invalid URL." }, { status: 400 });
  }

  let res: Response;
  try {
    res = await fetch(parsedUrl.toString(), {
      method: "GET",
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; ToolNestAI/1.0; +https://toolnestai.net/bot)",
        "Accept": "application/xml,text/xml,*/*;q=0.8",
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

  if (!res.ok) {
    return Response.json({ error: `Server returned ${res.status} ${res.statusText}.` }, { status: 400 });
  }

  const xml = await res.text();
  return Response.json({ xml, url: parsedUrl.toString() });
}
