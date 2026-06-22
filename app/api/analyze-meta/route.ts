import { NextRequest } from "next/server";

export const maxDuration = 30;

// ── Regex helpers ─────────────────────────────────────────────────────────────
function attr(tag: string, name: string): string {
  // Matches name="value" or name='value'
  const re = new RegExp(`${name}=["']([^"']*)["']`, "i");
  return tag.match(re)?.[1]?.trim() ?? "";
}

function metaContent(html: string, nameOrProp: string): string {
  // <meta name="X" content="Y"> or <meta property="X" content="Y">
  const re = new RegExp(
    `<meta[^>]+(?:name|property)=["']${nameOrProp}["'][^>]*content=["']([^"']*)["'][^>]*>|<meta[^>]+content=["']([^"']*)["'][^>]*(?:name|property)=["']${nameOrProp}["'][^>]*>`,
    "i",
  );
  const m = html.match(re);
  return (m?.[1] ?? m?.[2] ?? "").trim();
}

function countTag(html: string, tag: string): number {
  return (html.match(new RegExp(`<${tag}[\\s>]`, "gi")) ?? []).length;
}

function imagesWithoutAlt(html: string): number {
  const imgs = html.match(/<img[^>]*>/gi) ?? [];
  return imgs.filter(img => !/alt=["'][^"']*["']/i.test(img) || /alt=["']\s*["']/i.test(img)).length;
}

function countLinks(html: string, baseHost: string): { internal: number; external: number } {
  const hrefs = html.match(/href=["']([^"']+)["']/gi) ?? [];
  let internal = 0, external = 0;
  for (const raw of hrefs) {
    const href = raw.replace(/href=["']/i, "").replace(/["']$/, "").trim();
    if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("javascript:")) continue;
    try {
      const u = new URL(href, `https://${baseHost}`);
      if (u.hostname === baseHost) internal++;
      else external++;
    } catch { /* ignore malformed */ }
  }
  return { internal, external };
}

// ── Main handler ──────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const rawUrl = req.nextUrl.searchParams.get("url") ?? "";
  if (!rawUrl) {
    return Response.json({ error: "Missing url parameter." }, { status: 400 });
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`);
  } catch {
    return Response.json({ error: "Invalid URL." }, { status: 400 });
  }

  const targetUrl = parsedUrl.toString();
  const baseHost  = parsedUrl.hostname;

  let html: string;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const res = await fetch(targetUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; ToolNestAI/1.0; +https://toolnestai.net/bot)",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) {
      return Response.json({ error: `Server returned ${res.status} ${res.statusText}.` }, { status: 400 });
    }
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("html")) {
      return Response.json({ error: `URL does not return HTML (content-type: ${ct}).` }, { status: 400 });
    }
    html = await res.text();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("abort")) {
      return Response.json({ error: "Request timed out after 15 seconds." }, { status: 408 });
    }
    return Response.json({ error: `Fetch failed: ${msg}` }, { status: 400 });
  }

  // ── Extract <head> only for faster parsing ─────────────────────────────────
  const headMatch = html.match(/<head[\s\S]*?<\/head>/i);
  const head = headMatch ? headMatch[0] : html.slice(0, 10000);

  // ── Basic SEO ──────────────────────────────────────────────────────────────
  const titleMatch  = head.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title       = (titleMatch?.[1] ?? "").replace(/<[^>]+>/g, "").trim();
  const description = metaContent(head, "description");
  const robots      = metaContent(head, "robots");
  const viewport    = metaContent(head, "viewport");

  const charsetMatch = head.match(/<meta[^>]+charset=["']?([^"'>\s]+)/i);
  const charset      = charsetMatch?.[1]?.trim() ?? "";

  const canonicalMatch = head.match(/<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']*)["'][^>]*>|<link[^>]+href=["']([^"']*)["'][^>]*rel=["']canonical["'][^>]*>/i);
  const canonical       = (canonicalMatch?.[1] ?? canonicalMatch?.[2] ?? "").trim();

  // ── Open Graph ─────────────────────────────────────────────────────────────
  const og = {
    title:       metaContent(head, "og:title"),
    description: metaContent(head, "og:description"),
    image:       metaContent(head, "og:image"),
    url:         metaContent(head, "og:url"),
    type:        metaContent(head, "og:type"),
    siteName:    metaContent(head, "og:site_name"),
    locale:      metaContent(head, "og:locale"),
  };

  // ── Twitter Cards ──────────────────────────────────────────────────────────
  const twitter = {
    card:        metaContent(head, "twitter:card"),
    title:       metaContent(head, "twitter:title"),
    description: metaContent(head, "twitter:description"),
    image:       metaContent(head, "twitter:image"),
    site:        metaContent(head, "twitter:site"),
    creator:     metaContent(head, "twitter:creator"),
  };

  // ── Headings (full HTML) ───────────────────────────────────────────────────
  const h1Count = countTag(html, "h1");
  const h2Count = countTag(html, "h2");
  const h3Count = countTag(html, "h3");

  // ── Images ────────────────────────────────────────────────────────────────
  const totalImages   = countTag(html, "img");
  const missingAlt    = imagesWithoutAlt(html);

  // ── Links ─────────────────────────────────────────────────────────────────
  const { internal: internalLinks, external: externalLinks } = countLinks(html, baseHost);

  // ── Indexing checks ────────────────────────────────────────────────────────
  let robotsTxtFound = false;
  let sitemapFound   = false;
  try {
    const r = await fetch(`${parsedUrl.origin}/robots.txt`, { method: "HEAD", signal: AbortSignal.timeout(5000) });
    robotsTxtFound = r.ok;
  } catch { /* ignore */ }
  try {
    const s = await fetch(`${parsedUrl.origin}/sitemap.xml`, { method: "HEAD", signal: AbortSignal.timeout(5000) });
    sitemapFound = s.ok;
  } catch { /* ignore */ }

  return Response.json({
    url: targetUrl,
    fetchedAt: new Date().toISOString(),
    basic: { title, description, canonical, robots, charset, viewport },
    og,
    twitter,
    headings: { h1: h1Count, h2: h2Count, h3: h3Count },
    images:   { total: totalImages, missingAlt },
    links:    { internal: internalLinks, external: externalLinks },
    indexing: { canonicalFound: !!canonical, robotsTxtFound, sitemapFound },
  });
}
