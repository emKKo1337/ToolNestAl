import { NextRequest } from "next/server";

export const maxDuration = 60;

// ── Types ─────────────────────────────────────────────────────────────────────
export type LinkType = "internal" | "external" | "image" | "css" | "script";

export interface LinkResult {
  url: string;
  sourcePage: string;
  anchorText: string;
  linkType: LinkType;
  status: number;
  statusText: string;
  redirectUrl?: string;
  responseTime: number;
  isOk: boolean;
  isBroken: boolean;
  isRedirect: boolean;
}

export interface CrawlResult {
  seedUrl: string;
  crawledAt: string;
  pagesCrawled: number;
  totalLinksChecked: number;
  internalLinks: number;
  externalLinks: number;
  brokenLinks: number;
  redirects: number;
  avgResponseTime: number;
  links: LinkResult[];
  seoScore: number;
  recommendations: string[];
}

interface LinkToCheck {
  url: string;
  sourcePage: string;
  anchorText: string;
  linkType: LinkType;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const STATUS_TEXT: Record<number, string> = {
  200: "OK", 201: "Created", 204: "No Content",
  301: "Moved Permanently", 302: "Found", 307: "Temporary Redirect", 308: "Permanent Redirect",
  400: "Bad Request", 401: "Unauthorized", 403: "Forbidden", 404: "Not Found", 410: "Gone",
  429: "Too Many Requests", 500: "Internal Server Error", 502: "Bad Gateway", 503: "Service Unavailable",
};
function getStatusText(code: number): string {
  return STATUS_TEXT[code] ?? `HTTP ${code}`;
}

function normalizeUrl(href: string, base: string): string | null {
  try {
    if (!href || href.startsWith("mailto:") || href.startsWith("tel:") ||
        href.startsWith("javascript:") || href.startsWith("#") || href.startsWith("data:")) return null;
    const url = new URL(href, base);
    // Strip fragment
    url.hash = "";
    return url.toString();
  } catch { return null; }
}

function isSameDomain(url: string, baseHostname: string): boolean {
  try {
    const u = new URL(url);
    // www.example.com == example.com
    const clean = (h: string) => h.replace(/^www\./, "");
    return clean(u.hostname) === clean(baseHostname);
  } catch { return false; }
}

function extractLinks(html: string, pageUrl: string, baseHostname: string, includeExternal: boolean): LinkToCheck[] {
  const links: LinkToCheck[] = [];
  const seen = new Set<string>();

  const add = (url: string, anchorText: string, linkType: LinkType) => {
    const normalized = normalizeUrl(url, pageUrl);
    if (!normalized) return;
    if (seen.has(normalized)) return;
    const isInternal = isSameDomain(normalized, baseHostname);
    if (!isInternal && !includeExternal) return;
    seen.add(normalized);
    links.push({ url: normalized, sourcePage: pageUrl, anchorText: anchorText.trim().slice(0, 120), linkType });
  };

  // <a href>
  const aRe = /<a\s[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = aRe.exec(html)) !== null) {
    const href = m[1] ?? "";
    const text = (m[2] ?? "").replace(/<[^>]+>/g, "").trim();
    const normalized = normalizeUrl(href, pageUrl);
    if (!normalized) continue;
    add(href, text || href, isSameDomain(normalized, baseHostname) ? "internal" : "external");
  }

  // <img src>
  const imgRe = /<img\s[^>]*src=["']([^"']+)["'][^>]*/gi;
  while ((m = imgRe.exec(html)) !== null) {
    if (m[1]) add(m[1], "[image]", "image");
  }

  // <link href> (CSS)
  const linkRe = /<link\s[^>]*href=["']([^"']+)["'][^>]*/gi;
  while ((m = linkRe.exec(html)) !== null) {
    if (m[1]) add(m[1], "[css]", "css");
  }

  // <script src>
  const scriptRe = /<script\s[^>]*src=["']([^"']+)["'][^>]*/gi;
  while ((m = scriptRe.exec(html)) !== null) {
    if (m[1]) add(m[1], "[script]", "script");
  }

  return links;
}

async function fetchPage(url: string, ua: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      headers: {
        "User-Agent": ua,
        "Accept": "text/html,*/*;q=0.8",
      },
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("html")) return null;
    return await res.text();
  } catch { return null; }
}

async function checkLink(link: LinkToCheck, ua: string): Promise<LinkResult> {
  const start = Date.now();
  try {
    const res = await fetch(link.url, {
      method: "HEAD",
      redirect: "manual",
      headers: { "User-Agent": ua, "Accept": "*/*" },
      signal: AbortSignal.timeout(8000),
    });
    const responseTime = Date.now() - start;
    const isRedirect = res.status >= 300 && res.status < 400;
    const redirectUrl = isRedirect ? (res.headers.get("location") ?? undefined) : undefined;
    const isOk = res.status >= 200 && res.status < 300;
    const isBroken = res.status >= 400 || res.status === 0;
    return { ...link, status: res.status, statusText: getStatusText(res.status), redirectUrl, responseTime, isOk, isBroken, isRedirect };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    const isTimeout = msg.includes("timeout") || msg.includes("abort") || msg.includes("TimeoutError");
    return { ...link, status: 0, statusText: isTimeout ? "Timeout" : "Error", responseTime: Date.now() - start, isOk: false, isBroken: true, isRedirect: false };
  }
}

async function runBatch<T, R>(items: T[], fn: (item: T) => Promise<R>, concurrency = 20): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch.map(fn));
    results.push(...batchResults);
  }
  return results;
}

function buildScore(links: LinkResult[]): { score: number; recommendations: string[] } {
  const recs: string[] = [];
  const total = links.length;
  if (total === 0) return { score: 100, recommendations: [] };

  const broken  = links.filter(l => l.isBroken);
  const redirects = links.filter(l => l.isRedirect);
  const brokenInternal = broken.filter(l => l.linkType === "internal" || l.linkType === "external");
  const brokenImages = broken.filter(l => l.linkType === "image");
  const brokenCss = broken.filter(l => l.linkType === "css");
  const brokenJs  = broken.filter(l => l.linkType === "script");

  let score = 100;

  if (broken.length > 0) {
    score -= Math.min(40, broken.length * 8);
    recs.push(`Fix ${broken.length} broken link${broken.length > 1 ? "s" : ""}: return 404/5xx errors block crawlers and lose link equity.`);
  }
  if (redirects.length > 0) {
    score -= Math.min(20, redirects.length * 2);
    recs.push(`Update ${redirects.length} redirect${redirects.length > 1 ? "s" : ""} to point directly to the final URL — each redirect hop adds latency and slightly dilutes link equity.`);
  }
  if (brokenImages.length > 0) {
    score -= Math.min(15, brokenImages.length * 5);
    recs.push(`Replace or remove ${brokenImages.length} broken image${brokenImages.length > 1 ? "s" : ""}: missing images hurt CLS, user experience and perceived quality.`);
  }
  if (brokenCss.length > 0) {
    score -= Math.min(10, brokenCss.length * 5);
    recs.push(`Fix ${brokenCss.length} broken CSS file${brokenCss.length > 1 ? "s" : ""}: broken stylesheets cause layout issues and fail Google's mobile-friendliness checks.`);
  }
  if (brokenJs.length > 0) {
    score -= Math.min(10, brokenJs.length * 3);
    recs.push(`Fix ${brokenJs.length} broken script file${brokenJs.length > 1 ? "s" : ""}: missing JS can break interactive features and hurt Core Web Vitals.`);
  }
  if (brokenInternal.length === 0 && broken.length === 0) {
    recs.push("No broken links detected — great job maintaining your site's link health.");
  }
  if (redirects.length === 0 && broken.length === 0) {
    recs.push("All links resolve cleanly with no redirects — excellent.");
  }
  const slowLinks = links.filter(l => l.responseTime > 3000 && l.isOk);
  if (slowLinks.length > 0) {
    recs.push(`${slowLinks.length} link${slowLinks.length > 1 ? "s" : ""} responded in over 3 seconds — slow resources can hurt Core Web Vitals.`);
  }

  return { score: Math.max(0, score), recommendations: recs };
}

// ── Route ─────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  let body: {
    url?: string;
    maxPages?: number;
    includeExternal?: boolean;
    followRedirects?: boolean;
    userAgent?: string;
  };
  try { body = await req.json(); } catch { return Response.json({ error: "Invalid request body." }, { status: 400 }); }

  const { url: rawUrl, maxPages = 1, includeExternal = true, userAgent = "bot" } = body;
  if (!rawUrl) return Response.json({ error: "Missing url parameter." }, { status: 400 });

  let seedUrl: URL;
  try {
    seedUrl = new URL(rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`);
  } catch {
    return Response.json({ error: "Invalid URL." }, { status: 400 });
  }

  const UA_MAP: Record<string, string> = {
    bot:     "Mozilla/5.0 (compatible; ToolNestAI/1.0; +https://toolnestai.net/bot)",
    chrome:  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    firefox: "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0",
    mobile:  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  };
  const ua = UA_MAP[userAgent] ?? UA_MAP.bot;

  const baseHostname = seedUrl.hostname;
  const MAX_PAGES    = Math.min(Number(maxPages) || 1, 10); // cap at 10 pages to stay within 60s
  const MAX_LINKS    = 300;

  // BFS page crawl
  const pageQueue: string[]  = [seedUrl.toString()];
  const visitedPages         = new Set<string>();
  const allLinks: LinkToCheck[] = [];
  const seenLinkUrls         = new Set<string>();

  while (pageQueue.length > 0 && visitedPages.size < MAX_PAGES) {
    const pageUrl = pageQueue.shift()!;
    if (visitedPages.has(pageUrl)) continue;
    visitedPages.add(pageUrl);

    const html = await fetchPage(pageUrl, ua);
    if (!html) continue;

    const pageLinks = extractLinks(html, pageUrl, baseHostname, includeExternal);
    for (const link of pageLinks) {
      if (!seenLinkUrls.has(link.url)) {
        seenLinkUrls.add(link.url);
        allLinks.push(link);
      }
      // Queue internal a-links for crawling
      if (link.linkType === "internal" && !visitedPages.has(link.url) && !pageQueue.includes(link.url)) {
        pageQueue.push(link.url);
      }
    }
    if (allLinks.length >= MAX_LINKS) break;
  }

  // Check link statuses in parallel batches
  const linksToCheck = allLinks.slice(0, MAX_LINKS);
  const results = await runBatch(linksToCheck, (l) => checkLink(l, ua), 20);

  const broken    = results.filter(l => l.isBroken).length;
  const redirects = results.filter(l => l.isRedirect).length;
  const internal  = results.filter(l => l.linkType === "internal").length;
  const external  = results.filter(l => l.linkType === "external").length;
  const avgResponseTime = results.length > 0
    ? Math.round(results.reduce((s, l) => s + l.responseTime, 0) / results.length)
    : 0;

  const { score, recommendations } = buildScore(results);

  return Response.json({
    seedUrl: seedUrl.toString(),
    crawledAt: new Date().toISOString(),
    pagesCrawled: visitedPages.size,
    totalLinksChecked: results.length,
    internalLinks: internal,
    externalLinks: external,
    brokenLinks: broken,
    redirects,
    avgResponseTime,
    links: results,
    seoScore: score,
    recommendations,
  } satisfies CrawlResult);
}
