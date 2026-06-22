import { NextRequest } from "next/server";

export const maxDuration = 60;

// ── Types ─────────────────────────────────────────────────────────────────────
export interface RedirectHop {
  url: string;
  status: number;
}

export interface ExternalLink {
  sourceUrl: string;
  destinationUrl: string;
  anchorText: string;
  status: number;
  statusText: string;
  responseTime: number;
  finalUrl: string;
  redirectCount: number;
  redirectChain: RedirectHop[];
  isNoFollow: boolean;
  isTargetBlank: boolean;
  relAttributes: string[];
  isBroken: boolean;
  isRedirect: boolean;
  isHttps: boolean;
  isMissingNoOpener: boolean;
  isSlowResponse: boolean;
}

export interface ExternalLinkResult {
  seedUrl: string;
  analyzedAt: string;
  pagesCrawled: number;
  externalLinksFound: number;
  uniqueExternalDomains: number;
  brokenLinks: number;
  redirectLinks: number;
  nofollowLinks: number;
  followLinks: number;
  avgResponseTime: number;
  unsafeHttpLinks: number;
  missingNoOpenerLinks: number;
  duplicateLinks: number;
  links: ExternalLink[];
  seoScore: number;
  recommendations: string[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const STATUS_TEXT: Record<number, string> = {
  200: "OK", 201: "Created", 204: "No Content",
  301: "Moved Permanently", 302: "Found", 307: "Temporary Redirect", 308: "Permanent Redirect",
  400: "Bad Request", 401: "Unauthorized", 403: "Forbidden", 404: "Not Found", 410: "Gone",
  429: "Too Many Requests", 500: "Internal Server Error", 502: "Bad Gateway", 503: "Service Unavailable",
};
function getStatusText(code: number): string { return STATUS_TEXT[code] ?? `HTTP ${code}`; }

const UA_MAP: Record<string, string> = {
  bot:     "Mozilla/5.0 (compatible; ToolNestAI/1.0; +https://toolnestai.net/bot)",
  chrome:  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36",
  firefox: "Mozilla/5.0 (Windows NT 10.0; rv:125.0) Gecko/20100101 Firefox/125.0",
};

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

interface RawLink { href: string; anchorText: string; isNoFollow: boolean; isTargetBlank: boolean; relAttributes: string[] }

function extractLinks(html: string, pageUrl: string): RawLink[] {
  const links: RawLink[] = [];
  const re = /<a\s([^>]+)>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const attrs = m[1] ?? "";
    const inner = (m[2] ?? "").replace(/<[^>]+>/g, "").trim().slice(0, 120);
    const hrefM   = attrs.match(/href=["']([^"']+)["']/i);
    const relM    = attrs.match(/rel=["']([^"']+)["']/i);
    const targetM = attrs.match(/target=["']([^"']+)["']/i);
    if (!hrefM?.[1]) continue;
    const normalized = normalizeUrl(hrefM[1], pageUrl);
    if (!normalized) continue;
    const relVal   = (relM?.[1] ?? "").toLowerCase();
    const relAttrs = relVal ? relVal.split(/\s+/).filter(Boolean) : [];
    links.push({
      href: normalized,
      anchorText: inner || hrefM[1],
      isNoFollow: relAttrs.includes("nofollow"),
      isTargetBlank: (targetM?.[1] ?? "").toLowerCase() === "_blank",
      relAttributes: relAttrs,
    });
  }
  return links;
}

async function fetchHtml(url: string, ua: string, timeout = 10000): Promise<{ html: string; status: number } | null> {
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { "User-Agent": ua, "Accept": "text/html,*/*;q=0.8" },
      signal: AbortSignal.timeout(timeout),
    });
    if (!res.ok) return { html: "", status: res.status };
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("html")) return { html: "", status: res.status };
    return { html: await res.text(), status: res.status };
  } catch { return null; }
}

async function checkExternalLink(
  href: string, ua: string, followRedirects: boolean, checkStatus: boolean
): Promise<{ status: number; responseTime: number; finalUrl: string; redirectChain: RedirectHop[] }> {
  if (!checkStatus) return { status: 0, responseTime: 0, finalUrl: href, redirectChain: [] };

  const chain: RedirectHop[] = [];
  let current = href;
  const start = Date.now();

  try {
    if (followRedirects) {
      const res = await fetch(current, {
        method: "HEAD",
        redirect: "follow",
        headers: { "User-Agent": ua },
        signal: AbortSignal.timeout(8000),
      });
      const responseTime = Date.now() - start;
      return { status: res.status, responseTime, finalUrl: res.url || current, redirectChain: chain };
    } else {
      // Manual redirect following for chain tracking
      let hops = 0;
      while (hops < 8) {
        const res = await fetch(current, {
          method: "HEAD",
          redirect: "manual",
          headers: { "User-Agent": ua },
          signal: AbortSignal.timeout(5000),
        });
        chain.push({ url: current, status: res.status });
        if (res.status >= 300 && res.status < 400) {
          const loc = res.headers.get("location");
          if (!loc) break;
          try { current = new URL(loc, current).toString(); } catch { break; }
          hops++;
        } else {
          const responseTime = Date.now() - start;
          return { status: res.status, responseTime, finalUrl: current, redirectChain: chain };
        }
      }
      const responseTime = Date.now() - start;
      return { status: chain[chain.length - 1]?.status ?? 0, responseTime, finalUrl: current, redirectChain: chain };
    }
  } catch {
    return { status: 0, responseTime: Date.now() - start, finalUrl: current, redirectChain: chain };
  }
}

async function runBatch<T, R>(items: T[], fn: (item: T) => Promise<R>, concurrency = 15): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    results.push(...await Promise.all(batch.map(fn)));
  }
  return results;
}

function scoreAndRecommend(data: Omit<ExternalLinkResult, "seoScore" | "recommendations">): { score: number; recommendations: string[] } {
  const recs: string[] = [];
  let score = 100;

  if (data.brokenLinks > 0) {
    score -= Math.min(30, data.brokenLinks * 10);
    recs.push(`Fix or remove ${data.brokenLinks} broken external link${data.brokenLinks > 1 ? "s" : ""} — they return 4xx/5xx errors and damage user experience.`);
  }
  const redirectLinkPct = data.externalLinksFound > 0 ? data.redirectLinks / data.externalLinksFound : 0;
  if (data.redirectLinks > 0 && redirectLinkPct > 0.3) {
    score -= Math.min(15, data.redirectLinks * 3);
    recs.push(`Update ${data.redirectLinks} redirected external link${data.redirectLinks > 1 ? "s" : ""} to point directly to the final URL — redirect chains add latency.`);
  }
  if (data.unsafeHttpLinks > 0) {
    score -= Math.min(15, data.unsafeHttpLinks * 5);
    recs.push(`Replace ${data.unsafeHttpLinks} unsafe HTTP external link${data.unsafeHttpLinks > 1 ? "s" : ""} with HTTPS equivalents — mixed content harms security and SEO.`);
  }
  if (data.missingNoOpenerLinks > 0) {
    score -= Math.min(10, data.missingNoOpenerLinks * 2);
    recs.push(`Add rel="noopener noreferrer" to ${data.missingNoOpenerLinks} link${data.missingNoOpenerLinks > 1 ? "s" : ""} with target="_blank" — missing noopener is a security vulnerability.`);
  }
  if (data.avgResponseTime > 3000) {
    score -= 10;
    recs.push(`Average external link response time is ${(data.avgResponseTime / 1000).toFixed(1)}s — consider linking to faster alternatives where possible.`);
  }
  if (data.duplicateLinks > 0) {
    score -= Math.min(5, data.duplicateLinks * 2);
    recs.push(`${data.duplicateLinks} duplicate external link${data.duplicateLinks > 1 ? "s" : ""} found — consolidate or vary anchor text for the same destinations.`);
  }
  if (score >= 85 && recs.length === 0) {
    recs.push("External link profile looks healthy — no critical issues detected.");
  }
  return { score: Math.max(0, Math.min(100, score)), recommendations: recs };
}

// ── Route ─────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  let body: {
    url?: string; maxPages?: number; followRedirects?: boolean;
    checkStatus?: boolean; ignoreNoFollow?: boolean; userAgent?: string;
  };
  try { body = await req.json(); } catch { return Response.json({ error: "Invalid request body." }, { status: 400 }); }

  const {
    url: rawUrl, maxPages = 10, followRedirects = true,
    checkStatus = true, ignoreNoFollow = false, userAgent = "bot",
  } = body;

  if (!rawUrl) return Response.json({ error: "Missing url parameter." }, { status: 400 });

  let seedUrl: URL;
  try { seedUrl = new URL(rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`); }
  catch { return Response.json({ error: "Invalid URL." }, { status: 400 }); }

  const ua = UA_MAP[userAgent] ?? UA_MAP.bot;
  // Cap crawl pages for Vercel timeout safety
  const MAX_CRAWL = Math.min(Number(maxPages) || 10, 25);
  const baseHostname = seedUrl.hostname;

  // BFS crawl internal pages, collect external links
  const visited   = new Set<string>();
  const queue     = [seedUrl.toString()];
  const rawLinks  = new Map<string, RawLink & { sourceUrl: string }>(); // keyed by href to deduplicate

  while (queue.length > 0 && visited.size < MAX_CRAWL) {
    const pageUrl = queue.shift()!;
    if (visited.has(pageUrl)) continue;
    visited.add(pageUrl);

    const fetched = await fetchHtml(pageUrl, ua, 10000);
    if (!fetched?.html) continue;

    const found = extractLinks(fetched.html, pageUrl);
    for (const link of found) {
      if (ignoreNoFollow && link.isNoFollow) continue;
      if (isSameDomain(link.href, baseHostname)) {
        // Internal — add to crawl queue
        if (!visited.has(link.href)) queue.push(link.href);
      } else {
        // External — collect for checking
        if (!rawLinks.has(link.href)) {
          rawLinks.set(link.href, { ...link, sourceUrl: pageUrl });
        }
      }
    }
  }

  // Check each external link
  const linkEntries = Array.from(rawLinks.values());
  const checked = await runBatch(linkEntries, async (raw) => {
    const { status, responseTime, finalUrl, redirectChain } = await checkExternalLink(
      raw.href, ua, followRedirects, checkStatus
    );
    const isBroken   = checkStatus && (status >= 400 || status === 0);
    const isRedirect  = checkStatus && status >= 300 && status < 400 && finalUrl !== raw.href;
    const isHttps     = raw.href.startsWith("https://");
    const isMissingNoOpener = raw.isTargetBlank && !raw.relAttributes.includes("noopener");
    const isSlowResponse = responseTime > 3000;

    return {
      sourceUrl: raw.sourceUrl,
      destinationUrl: raw.href,
      anchorText: raw.anchorText,
      status,
      statusText: getStatusText(status),
      responseTime,
      finalUrl,
      redirectCount: redirectChain.length > 0 ? redirectChain.length - 1 : (isRedirect ? 1 : 0),
      redirectChain,
      isNoFollow: raw.isNoFollow,
      isTargetBlank: raw.isTargetBlank,
      relAttributes: raw.relAttributes,
      isBroken,
      isRedirect,
      isHttps,
      isMissingNoOpener,
      isSlowResponse,
    } satisfies ExternalLink;
  }, 15);

  // Stats
  const brokenLinks         = checked.filter(l => l.isBroken).length;
  const redirectLinks       = checked.filter(l => l.isRedirect).length;
  const nofollowLinks       = checked.filter(l => l.isNoFollow).length;
  const followLinks         = checked.filter(l => !l.isNoFollow).length;
  const unsafeHttpLinks     = checked.filter(l => !l.isHttps).length;
  const missingNoOpenerLinks = checked.filter(l => l.isMissingNoOpener).length;
  const dupeMap = new Map<string, number>();
  for (const l of checked) dupeMap.set(l.destinationUrl, (dupeMap.get(l.destinationUrl) ?? 0) + 1);
  const duplicateLinks = Array.from(dupeMap.values()).filter(c => c > 1).length;

  const responseTimes = checked.filter(l => l.responseTime > 0).map(l => l.responseTime);
  const avgResponseTime = responseTimes.length > 0
    ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
    : 0;

  const uniqueDomains = new Set(checked.map(l => { try { return new URL(l.destinationUrl).hostname; } catch { return l.destinationUrl; } })).size;

  const partial = {
    seedUrl: seedUrl.toString(),
    analyzedAt: new Date().toISOString(),
    pagesCrawled: visited.size,
    externalLinksFound: checked.length,
    uniqueExternalDomains: uniqueDomains,
    brokenLinks,
    redirectLinks,
    nofollowLinks,
    followLinks,
    avgResponseTime,
    unsafeHttpLinks,
    missingNoOpenerLinks,
    duplicateLinks,
    links: checked,
  };

  const { score, recommendations } = scoreAndRecommend(partial);
  return Response.json({ ...partial, seoScore: score, recommendations } satisfies ExternalLinkResult);
}
