import { NextRequest } from "next/server";

export const maxDuration = 20;

// ── Types ─────────────────────────────────────────────────────────────────────
export interface OgData {
  // Page
  url: string;
  finalUrl: string;
  analyzedAt: string;
  pageTitle: string;
  favicon: string;
  // Open Graph
  ogTitle: string;
  ogDescription: string;
  ogImage: string;
  ogImageWidth: string;
  ogImageHeight: string;
  ogImageAlt: string;
  ogUrl: string;
  ogType: string;
  ogSiteName: string;
  ogLocale: string;
  // Twitter Card
  twitterCard: string;
  twitterTitle: string;
  twitterDescription: string;
  twitterImage: string;
  twitterImageAlt: string;
  twitterCreator: string;
  twitterSite: string;
  // Computed display values (fallbacks resolved)
  displayTitle: string;
  displayDescription: string;
  displayImage: string;
  displayDomain: string;
  // Image probe
  imageStatus: "ok" | "missing" | "error" | "http" | "small";
  imageWidth: number;
  imageHeight: number;
  imageSize: number;
  // Score
  seoScore: number;
  recommendations: string[];
  issues: { level: "error" | "warning" | "info"; message: string }[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function meta(html: string, ...names: string[]): string {
  for (const name of names) {
    // property="…" or name="…"
    const re1 = new RegExp(`<meta[^>]+(?:property|name)=["']${name}["'][^>]+content=["']([^"']*)["'][^>]*>`, "i");
    const re2 = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${name}["'][^>]*>`, "i");
    const m = html.match(re1) ?? html.match(re2);
    if (m?.[1] !== undefined) return m[1].trim();
  }
  return "";
}

function extractFavicon(html: string, baseOrigin: string): string {
  const re = /<link[^>]+rel=["'](?:shortcut icon|icon)["'][^>]+href=["']([^"']+)["'][^>]*>/i;
  const m = html.match(re);
  if (m?.[1]) {
    try { return new URL(m[1], baseOrigin).toString(); } catch { /* noop */ }
  }
  return `${baseOrigin}/favicon.ico`;
}

async function probeImage(imageUrl: string): Promise<{ width: number; height: number; size: number; ok: boolean }> {
  if (!imageUrl) return { width: 0, height: 0, size: 0, ok: false };
  try {
    const res = await fetch(imageUrl, {
      method: "HEAD",
      signal: AbortSignal.timeout(6000),
      headers: { "User-Agent": "Mozilla/5.0 (compatible; ToolNestAI/1.0)" },
    });
    if (!res.ok) return { width: 0, height: 0, size: 0, ok: false };
    const size = Number(res.headers.get("content-length") ?? 0);
    // We can't get pixel dimensions from HEAD — we use the og:image:width/height declared tags
    return { width: 0, height: 0, size, ok: true };
  } catch { return { width: 0, height: 0, size: 0, ok: false }; }
}

function scoreAndRecommend(d: Omit<OgData, "seoScore" | "recommendations" | "issues">): {
  score: number;
  recommendations: string[];
  issues: OgData["issues"];
} {
  const recs: string[] = [];
  const issues: OgData["issues"] = [];
  let score = 100;

  // OG title
  if (!d.ogTitle) {
    score -= 20; issues.push({ level: "error", message: "Missing og:title — social platforms will fall back to the page <title> or show a blank title." });
    recs.push("Add <meta property=\"og:title\" content=\"Your Page Title\"> to control the title shown in social previews.");
  } else if (d.ogTitle.length > 95) {
    score -= 5; issues.push({ level: "warning", message: `og:title is ${d.ogTitle.length} characters — Facebook truncates at ~95 characters.` });
    recs.push("Shorten og:title to under 95 characters to prevent truncation in Facebook previews.");
  }

  // OG description
  if (!d.ogDescription) {
    score -= 15; issues.push({ level: "error", message: "Missing og:description — social platforms will scrape body text or show no description." });
    recs.push("Add <meta property=\"og:description\" content=\"…\"> (2–4 sentences) to improve click-through from social shares.");
  } else if (d.ogDescription.length > 200) {
    score -= 3; issues.push({ level: "warning", message: `og:description is ${d.ogDescription.length} characters — most platforms truncate at 150–200 characters.` });
  }

  // OG image
  if (!d.ogImage) {
    score -= 25; issues.push({ level: "error", message: "Missing og:image — no image will appear in the link preview, drastically reducing engagement." });
    recs.push("Add <meta property=\"og:image\" content=\"https://…/image.jpg\"> — use a 1200×630 px image for best results across all platforms.");
  } else {
    if (d.imageStatus === "error") {
      score -= 20; issues.push({ level: "error", message: "og:image URL returned an error — the image cannot be fetched by social crawlers." });
      recs.push("Fix the og:image URL — verify it is publicly accessible without authentication or referrer restrictions.");
    }
    if (d.imageStatus === "http") {
      score -= 10; issues.push({ level: "warning", message: "og:image uses HTTP instead of HTTPS — some platforms block mixed-content images." });
      recs.push("Use an HTTPS URL for og:image to ensure it loads correctly on all platforms.");
    }
    const declaredW = Number(d.ogImageWidth) || 0;
    const declaredH = Number(d.ogImageHeight) || 0;
    if (declaredW > 0 && declaredH > 0) {
      if (declaredW < 600 || declaredH < 315) {
        score -= 10; issues.push({ level: "warning", message: `og:image declared size is ${declaredW}×${declaredH} — minimum for large card is 600×315 px.` });
        recs.push("Use an image at least 600×315 px (ideally 1200×630 px) to qualify for large link preview cards.");
      }
    } else {
      issues.push({ level: "info", message: "og:image:width and og:image:height not declared — Facebook recommends adding these to avoid image size detection delays." });
      recs.push("Add <meta property=\"og:image:width\" content=\"1200\"> and <meta property=\"og:image:height\" content=\"630\"> alongside your og:image.");
    }
    if (!d.ogImageAlt) {
      issues.push({ level: "info", message: "og:image:alt not set — Twitter/X uses this for accessibility." });
    }
  }

  // OG URL
  if (!d.ogUrl) {
    score -= 5; issues.push({ level: "warning", message: "Missing og:url — without it some platforms use the current URL which may vary (www vs non-www, trailing slash, etc.)." });
    recs.push("Add <meta property=\"og:url\" content=\"https://…\"> with the canonical URL of the page.");
  }

  // OG type
  if (!d.ogType) {
    issues.push({ level: "info", message: "og:type not set — defaults to 'website' but it's best to be explicit." });
  }

  // OG site_name
  if (!d.ogSiteName) {
    issues.push({ level: "info", message: "og:site_name not set — Facebook and LinkedIn display this below the title." });
    recs.push("Add <meta property=\"og:site_name\" content=\"Your Brand Name\"> to display your site name in previews.");
  }

  // Twitter Card
  if (!d.twitterCard) {
    score -= 10; issues.push({ level: "warning", message: "Missing twitter:card — Twitter/X will not show a rich card without it." });
    recs.push("Add <meta name=\"twitter:card\" content=\"summary_large_image\"> to enable full-width image cards on Twitter/X.");
  } else if (d.twitterCard !== "summary_large_image" && d.twitterCard !== "summary") {
    issues.push({ level: "info", message: `twitter:card is set to "${d.twitterCard}" — for most content, "summary_large_image" gives the best visual impact.` });
  }
  if (!d.twitterTitle && !d.ogTitle) {
    score -= 5; issues.push({ level: "warning", message: "Neither twitter:title nor og:title is set — Twitter will show no title." });
  }
  if (!d.twitterImage && !d.ogImage) {
    score -= 5; issues.push({ level: "warning", message: "Neither twitter:image nor og:image is set — no image will appear in Twitter/X cards." });
  }

  if (score >= 85 && recs.length === 0) {
    recs.push("Social sharing tags look comprehensive — pages are well-optimised for link previews across all major platforms.");
  }
  return { score: Math.max(0, Math.min(100, score)), recommendations: recs, issues };
}

// ── Route ─────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("url") ?? "";
  if (!raw) return Response.json({ error: "Missing url parameter." }, { status: 400 });

  let targetUrl: URL;
  try { targetUrl = new URL(raw.startsWith("http") ? raw : `https://${raw}`); }
  catch { return Response.json({ error: "Invalid URL." }, { status: 400 }); }

  let html = "";
  let finalUrl = targetUrl.toString();
  try {
    const res = await fetch(targetUrl.toString(), {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; ToolNestAI/1.0; +https://toolnestai.net/bot)",
        "Accept": "text/html,*/*;q=0.8",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(12000),
    });
    finalUrl = res.url || finalUrl;
    if (!res.ok) return Response.json({ error: `Server returned ${res.status} ${res.statusText}.` }, { status: 400 });
    html = await res.text();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return Response.json({ error: `Failed to fetch page: ${msg}` }, { status: 400 });
  }

  let origin = "";
  try { origin = new URL(finalUrl).origin; } catch { /* noop */ }
  let domain = "";
  try { domain = new URL(finalUrl).hostname.replace(/^www\./, ""); } catch { /* noop */ }

  // Extract all fields
  const pageTitle   = (() => { const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i); return m ? m[1].replace(/\s+/g, " ").trim() : ""; })();
  const ogTitle       = meta(html, "og:title");
  const ogDescription = meta(html, "og:description");
  const ogImage       = meta(html, "og:image", "og:image:url");
  const ogImageWidth  = meta(html, "og:image:width");
  const ogImageHeight = meta(html, "og:image:height");
  const ogImageAlt    = meta(html, "og:image:alt");
  const ogUrl         = meta(html, "og:url");
  const ogType        = meta(html, "og:type");
  const ogSiteName    = meta(html, "og:site_name");
  const ogLocale      = meta(html, "og:locale");
  const twitterCard        = meta(html, "twitter:card");
  const twitterTitle       = meta(html, "twitter:title");
  const twitterDescription = meta(html, "twitter:description");
  const twitterImage       = meta(html, "twitter:image", "twitter:image:src");
  const twitterImageAlt    = meta(html, "twitter:image:alt");
  const twitterCreator     = meta(html, "twitter:creator");
  const twitterSite        = meta(html, "twitter:site");
  const favicon = extractFavicon(html, origin);

  // Resolve display values with fallbacks
  const displayTitle       = ogTitle || pageTitle;
  const displayDescription = ogDescription;
  const displayImage       = ogImage;

  // Probe the OG image
  let imageStatus: OgData["imageStatus"] = "missing";
  let imageWidth = Number(ogImageWidth) || 0;
  let imageHeight = Number(ogImageHeight) || 0;
  let imageSize = 0;

  if (ogImage) {
    if (!ogImage.startsWith("https://") && !ogImage.startsWith("http://")) {
      imageStatus = "error";
    } else {
      if (!ogImage.startsWith("https://")) imageStatus = "http";
      const probe = await probeImage(ogImage);
      if (probe.ok) {
        imageStatus = ogImage.startsWith("https://") ? "ok" : "http";
        imageSize = probe.size;
        // Only override if not declared in tags
        if (imageWidth === 0) imageWidth = probe.width;
        if (imageHeight === 0) imageHeight = probe.height;
        if (imageWidth > 0 && imageHeight > 0 && (imageWidth < 600 || imageHeight < 315)) {
          imageStatus = "small";
        }
      } else {
        imageStatus = "error";
      }
    }
  }

  const partial = {
    url: targetUrl.toString(), finalUrl, analyzedAt: new Date().toISOString(),
    pageTitle, favicon,
    ogTitle, ogDescription, ogImage, ogImageWidth, ogImageHeight, ogImageAlt,
    ogUrl, ogType, ogSiteName, ogLocale,
    twitterCard, twitterTitle, twitterDescription, twitterImage, twitterImageAlt, twitterCreator, twitterSite,
    displayTitle, displayDescription, displayImage, displayDomain: domain,
    imageStatus, imageWidth, imageHeight, imageSize,
  };

  const { score, recommendations, issues } = scoreAndRecommend(partial);

  return Response.json({ ...partial, seoScore: score, recommendations, issues } satisfies OgData);
}
