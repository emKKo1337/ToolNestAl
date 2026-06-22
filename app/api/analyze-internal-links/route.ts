import { NextRequest } from "next/server";

export const maxDuration = 60;

// ── Types ─────────────────────────────────────────────────────────────────────
export interface LinkEdge {
  from: string;
  to: string;
  anchorText: string;
  isNoFollow: boolean;
}

export interface PageData {
  url: string;
  depth: number;
  status: number;
  statusText: string;
  title: string;
  inLinks: number;
  outLinks: number;
  inLinkSources: string[];
  outLinkTargets: string[];
  isOrphan: boolean;
  isDeadEnd: boolean;
  isBroken: boolean;
  isRedirect: boolean;
  redirectTarget?: string;
}

export interface InternalLinkResult {
  seedUrl: string;
  analyzedAt: string;
  pagesCrawled: number;
  totalInternalLinks: number;
  avgLinksPerPage: number;
  maxDepth: number;
  orphanPages: number;
  deadEndPages: number;
  brokenInternalLinks: number;
  redirectedLinks: number;
  uniqueAnchors: number;
  duplicateAnchors: string[];
  pages: PageData[];
  edges: LinkEdge[];
  seoScore: number;
  recommendations: string[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function normalizeUrl(href: string, base: string): string | null {
  try {
    if (!href || href.startsWith("mailto:") || href.startsWith("tel:") ||
        href.startsWith("javascript:") || href.startsWith("#") || href.startsWith("data:")) return null;
    const u = new URL(href, base);
    u.hash = "";
    return u.toString();
  } catch { return null; }
}

function isSameDomain(url: string, baseHostname: string): boolean {
  try {
    const clean = (h: string) => h.replace(/^www\./, "");
    return clean(new URL(url).hostname) === clean(baseHostname);
  } catch { return false; }
}

function extractLinks(html: string, pageUrl: string, baseHostname: string): { url: string; anchorText: string; isNoFollow: boolean }[] {
  const links: { url: string; anchorText: string; isNoFollow: boolean }[] = [];
  const re = /<a\s([^>]+)>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const attrs = m[1] ?? "";
    const inner = (m[2] ?? "").replace(/<[^>]+>/g, "").trim().slice(0, 120);
    const hrefM = attrs.match(/href=["']([^"']+)["']/i);
    const relM  = attrs.match(/rel=["']([^"']+)["']/i);
    if (!hrefM?.[1]) continue;
    const normalized = normalizeUrl(hrefM[1], pageUrl);
    if (!normalized || !isSameDomain(normalized, baseHostname)) continue;
    const isNoFollow = (relM?.[1] ?? "").toLowerCase().includes("nofollow");
    links.push({ url: normalized, anchorText: inner || hrefM[1], isNoFollow });
  }
  return links;
}

function extractTitle(html: string): string {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? m[1].replace(/\s+/g, " ").trim().slice(0, 100) : "";
}

const STATUS_TEXT: Record<number, string> = {
  200: "OK", 301: "Moved Permanently", 302: "Found", 307: "Temporary Redirect", 308: "Permanent Redirect",
  400: "Bad Request", 401: "Unauthorized", 403: "Forbidden", 404: "Not Found", 410: "Gone",
  500: "Internal Server Error", 503: "Service Unavailable",
};
function getStatusText(code: number): string { return STATUS_TEXT[code] ?? `HTTP ${code}`; }

const UA_MAP: Record<string, string> = {
  bot:     "Mozilla/5.0 (compatible; ToolNestAI/1.0; +https://toolnestai.net/bot)",
  chrome:  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36",
  firefox: "Mozilla/5.0 (Windows NT 10.0; rv:125.0) Gecko/20100101 Firefox/125.0",
};

async function fetchPage(url: string, ua: string): Promise<{ html: string; status: number; redirectTarget?: string } | null> {
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "manual",
      headers: { "User-Agent": ua, "Accept": "text/html,*/*;q=0.8" },
      signal: AbortSignal.timeout(10000),
    });
    const isRedirect = res.status >= 300 && res.status < 400;
    if (isRedirect) {
      return { html: "", status: res.status, redirectTarget: res.headers.get("location") ?? undefined };
    }
    if (!res.ok) return { html: "", status: res.status };
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("html")) return { html: "", status: res.status };
    const html = await res.text();
    return { html, status: res.status };
  } catch { return null; }
}

function scoreAndRecommend(result: Omit<InternalLinkResult, "seoScore" | "recommendations">): { score: number; recommendations: string[] } {
  const recs: string[] = [];
  let score = 100;

  const orphanPct = result.pagesCrawled > 0 ? result.orphanPages / result.pagesCrawled : 0;
  if (result.orphanPages > 0) {
    score -= Math.min(25, result.orphanPages * 8);
    recs.push(`Fix ${result.orphanPages} orphan page${result.orphanPages > 1 ? "s" : ""} — they have no incoming internal links and may never be crawled or indexed.`);
  }
  if (result.orphanPages > 0 && orphanPct > 0.3) {
    recs.push("Over 30% of crawled pages are orphans — create internal links from relevant hub pages to fix this at scale.");
  }
  if (result.deadEndPages > 0) {
    score -= Math.min(15, result.deadEndPages * 5);
    recs.push(`Add outgoing links to ${result.deadEndPages} dead-end page${result.deadEndPages > 1 ? "s" : ""} — they trap link equity and block crawler flow.`);
  }
  if (result.brokenInternalLinks > 0) {
    score -= Math.min(20, result.brokenInternalLinks * 8);
    recs.push(`Fix ${result.brokenInternalLinks} broken internal link${result.brokenInternalLinks > 1 ? "s" : ""} — 404 errors waste crawl budget and hurt user experience.`);
  }
  if (result.redirectedLinks > 0) {
    score -= Math.min(10, result.redirectedLinks * 3);
    recs.push(`Update ${result.redirectedLinks} redirected internal link${result.redirectedLinks > 1 ? "s" : ""} to point directly to the final URL.`);
  }
  if (result.duplicateAnchors.length > 0) {
    score -= Math.min(10, result.duplicateAnchors.length * 2);
    recs.push(`Diversify anchor text — "${result.duplicateAnchors.slice(0, 3).join('", "')}" ${result.duplicateAnchors.length > 1 ? "are" : "is"} used excessively. Varied anchors signal richer context to crawlers.`);
  }
  if (result.maxDepth > 4) {
    score -= Math.min(10, (result.maxDepth - 4) * 3);
    recs.push(`Some pages are ${result.maxDepth} clicks deep — flatten your architecture so every page is reachable within 3–4 clicks from the homepage.`);
  }
  const weakPages = result.pages.filter(p => p.inLinks < 2 && !p.isOrphan);
  if (weakPages.length > 0) {
    score -= Math.min(10, weakPages.length * 2);
    recs.push(`${weakPages.length} page${weakPages.length > 1 ? "s" : ""} ${weakPages.length > 1 ? "have" : "has"} only 1 incoming internal link — add more links from relevant pages to pass more authority.`);
  }
  if (score >= 85 && recs.length === 0) {
    recs.push("Internal link structure looks strong — no critical issues detected.");
  }
  return { score: Math.max(0, Math.min(100, score)), recommendations: recs };
}

// ── Route ─────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  let body: { url?: string; maxPages?: number; userAgent?: string; includeNoFollow?: boolean };
  try { body = await req.json(); } catch { return Response.json({ error: "Invalid request body." }, { status: 400 }); }

  const { url: rawUrl, maxPages = 5, userAgent = "bot", includeNoFollow = true } = body;
  if (!rawUrl) return Response.json({ error: "Missing url parameter." }, { status: 400 });

  let seedUrl: URL;
  try { seedUrl = new URL(rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`); }
  catch { return Response.json({ error: "Invalid URL." }, { status: 400 }); }

  const ua = UA_MAP[userAgent] ?? UA_MAP.bot;
  const MAX = Math.min(Number(maxPages) || 5, 10);
  const baseHostname = seedUrl.hostname;

  // BFS crawl
  type QueueEntry = { url: string; depth: number; fromUrl: string; anchorText: string; isNoFollow: boolean };
  const queue: QueueEntry[]  = [{ url: seedUrl.toString(), depth: 0, fromUrl: "", anchorText: "", isNoFollow: false }];
  const visited  = new Map<string, { depth: number; status: number; title: string; redirectTarget?: string }>();
  const edges: LinkEdge[] = [];
  const inLinksMap  = new Map<string, Set<string>>();
  const outLinksMap = new Map<string, Set<string>>();

  while (queue.length > 0 && visited.size < MAX) {
    const { url, depth, fromUrl, anchorText, isNoFollow } = queue.shift()!;
    if (visited.has(url)) {
      // Still record the edge
      if (fromUrl) edges.push({ from: fromUrl, to: url, anchorText, isNoFollow });
      if (fromUrl) {
        if (!inLinksMap.has(url)) inLinksMap.set(url, new Set());
        inLinksMap.get(url)!.add(fromUrl);
        if (!outLinksMap.has(fromUrl)) outLinksMap.set(fromUrl, new Set());
        outLinksMap.get(fromUrl)!.add(url);
      }
      continue;
    }

    const fetched = await fetchPage(url, ua);
    const status = fetched?.status ?? 0;
    const title  = fetched?.html ? extractTitle(fetched.html) : "";
    visited.set(url, { depth, status, title, redirectTarget: fetched?.redirectTarget });

    if (fromUrl) {
      edges.push({ from: fromUrl, to: url, anchorText, isNoFollow });
      if (!inLinksMap.has(url)) inLinksMap.set(url, new Set());
      inLinksMap.get(url)!.add(fromUrl);
      if (!outLinksMap.has(fromUrl)) outLinksMap.set(fromUrl, new Set());
      outLinksMap.get(fromUrl)!.add(url);
    }

    if (fetched?.html && status === 200) {
      const pageLinks = extractLinks(fetched.html, url, baseHostname);
      for (const link of pageLinks) {
        if (!includeNoFollow && link.isNoFollow) continue;
        if (!outLinksMap.has(url)) outLinksMap.set(url, new Set());
        outLinksMap.get(url)!.add(link.url);
        if (!visited.has(link.url)) {
          queue.push({ url: link.url, depth: depth + 1, fromUrl: url, anchorText: link.anchorText, isNoFollow: link.isNoFollow });
        } else {
          edges.push({ from: url, to: link.url, anchorText: link.anchorText, isNoFollow: link.isNoFollow });
          if (!inLinksMap.has(link.url)) inLinksMap.set(link.url, new Set());
          inLinksMap.get(link.url)!.add(url);
        }
      }
    }
  }

  // Build page data
  const pages: PageData[] = [];
  let maxDepth = 0;
  let orphanCount = 0, deadEndCount = 0, brokenCount = 0, redirectCount = 0;

  for (const [url, data] of visited.entries()) {
    const inSources  = Array.from(inLinksMap.get(url) ?? []);
    const outTargets = Array.from(outLinksMap.get(url) ?? []);
    const isSeed     = url === seedUrl.toString();
    const isOrphan   = inSources.length === 0 && !isSeed;
    const isDeadEnd  = outTargets.length === 0;
    const isBroken   = data.status >= 400 || data.status === 0;
    const isRedirect = data.status >= 300 && data.status < 400;

    if (data.depth > maxDepth) maxDepth = data.depth;
    if (isOrphan) orphanCount++;
    if (isDeadEnd) deadEndCount++;
    if (isBroken) brokenCount++;
    if (isRedirect) redirectCount++;

    pages.push({
      url,
      depth: data.depth,
      status: data.status,
      statusText: getStatusText(data.status),
      title: data.title,
      inLinks: inSources.length,
      outLinks: outTargets.length,
      inLinkSources: inSources,
      outLinkTargets: outTargets,
      isOrphan,
      isDeadEnd,
      isBroken,
      isRedirect,
      redirectTarget: data.redirectTarget,
    });
  }

  // Duplicate anchor analysis
  const anchorCounts: Record<string, number> = {};
  for (const e of edges) {
    const a = e.anchorText.toLowerCase().trim();
    if (a) anchorCounts[a] = (anchorCounts[a] ?? 0) + 1;
  }
  const dupAnchors = Object.entries(anchorCounts)
    .filter(([, c]) => c >= 3)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([a]) => a);

  const totalLinks = edges.length;
  const avg = pages.length > 0 ? Math.round((totalLinks / pages.length) * 10) / 10 : 0;

  const partial = {
    seedUrl: seedUrl.toString(),
    analyzedAt: new Date().toISOString(),
    pagesCrawled: pages.length,
    totalInternalLinks: totalLinks,
    avgLinksPerPage: avg,
    maxDepth,
    orphanPages: orphanCount,
    deadEndPages: deadEndCount,
    brokenInternalLinks: brokenCount,
    redirectedLinks: redirectCount,
    uniqueAnchors: Object.keys(anchorCounts).length,
    duplicateAnchors: dupAnchors,
    pages,
    edges: edges.slice(0, 500),
  };

  const { score, recommendations } = scoreAndRecommend(partial);

  return Response.json({ ...partial, seoScore: score, recommendations } satisfies InternalLinkResult);
}
