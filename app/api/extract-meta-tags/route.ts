import { NextRequest } from "next/server";

export const maxDuration = 20;

// ── Types ─────────────────────────────────────────────────────────────────────
export interface MetaTag {
  category: string;
  name: string;
  value: string;
  attribute: string;
  isEmpty: boolean;
  isDuplicate: boolean;
  rawHtml: string;
}

export interface MetaTagsResult {
  url: string;
  finalUrl: string;
  analyzedAt: string;
  pageTitle: string;
  totalTags: number;
  missingRecommended: number;
  duplicateTags: number;
  emptyTags: number;
  tags: MetaTag[];
  missingTags: { name: string; reason: string }[];
  seoScore: number;
  recommendations: string[];
}

// ── Parser ────────────────────────────────────────────────────────────────────
function attr(tag: string, ...names: string[]): string {
  for (const name of names) {
    const m = tag.match(new RegExp(`${name}=["']([^"']*)["']`, "i"));
    if (m?.[1] !== undefined) return m[1];
  }
  return "";
}

function parseMetaTags(html: string, pageUrl: string): MetaTag[] {
  const tags: MetaTag[] = [];
  const seen = new Map<string, number>(); // key → first index in tags

  const addTag = (category: string, name: string, value: string, attribute: string, raw: string) => {
    const key = `${category}::${name}`.toLowerCase();
    const isEmpty = value.trim() === "";
    const isDuplicate = seen.has(key);
    if (!isDuplicate) seen.set(key, tags.length);
    else {
      // Mark the first occurrence as duplicate too
      const firstIdx = seen.get(key)!;
      if (tags[firstIdx]) tags[firstIdx].isDuplicate = true;
    }
    tags.push({ category, name, value, attribute, isEmpty, isDuplicate, rawHtml: raw.trim() });
  };

  // Title
  const titleM = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (titleM) {
    const val = titleM[1].replace(/\s+/g, " ").trim();
    addTag("Basic", "title", val, "title", `<title>${val}</title>`);
  }

  // Charset (two forms)
  const charsetM1 = html.match(/<meta[^>]+charset=["']([^"']+)["'][^>]*>/i);
  const charsetM2 = html.match(/<meta[^>]+content=["'][^"']*charset=([^\s;'"]+)[^"']*["'][^>]*>/i);
  if (charsetM1) addTag("Basic", "charset", charsetM1[1], "charset", charsetM1[0]);
  else if (charsetM2) addTag("Basic", "charset", charsetM2[1], "charset (content-type)", charsetM2[0]);

  // All <meta> tags
  const metaRe = /<meta\s([^>]+)>/gi;
  let m: RegExpExecArray | null;
  while ((m = metaRe.exec(html)) !== null) {
    const raw = m[0];
    const attrs = m[1] ?? "";
    const nameVal    = attr(raw, "name");
    const propVal    = attr(raw, "property");
    const httpEquiv  = attr(raw, "http-equiv");
    const content    = attr(raw, "content");
    const charsetVal = attr(raw, "charset");

    if (charsetVal) continue; // already handled

    if (nameVal) {
      const n = nameVal.toLowerCase();
      let cat = "Other";
      if (["description","keywords","robots","author","viewport","theme-color","generator","rating","revisit-after","language","copyright","referrer"].includes(n)) cat = "Basic";
      else if (n.startsWith("twitter:")) cat = "Twitter Cards";
      else if (n.startsWith("google") || n === "msvalidate.01" || n.startsWith("yandex") || n === "p:domain_verify" || n === "facebook-domain-verification" || n === "pinterest-rich-pin") cat = "Verification";
      addTag(cat, nameVal, content, "name", raw);
    } else if (propVal) {
      const p = propVal.toLowerCase();
      let cat = "Other";
      if (p.startsWith("og:")) cat = "Open Graph";
      else if (p.startsWith("twitter:")) cat = "Twitter Cards";
      else if (p.startsWith("article:") || p.startsWith("book:") || p.startsWith("profile:")) cat = "Open Graph";
      addTag(cat, propVal, content, "property", raw);
    } else if (httpEquiv) {
      addTag("HTTP Equiv", httpEquiv, content, "http-equiv", raw);
    }
  }

  // Canonical and other link rels
  const linkRe = /<link\s([^>]+)>/gi;
  while ((m = linkRe.exec(html)) !== null) {
    const raw   = m[0];
    const relV  = attr(raw, "rel").toLowerCase();
    const href  = attr(raw, "href");
    const sizes = attr(raw, "sizes");
    if (!relV) continue;

    if (relV === "canonical") {
      addTag("Canonical", "canonical", href, "rel", raw);
    } else if (relV === "alternate") {
      const hreflang = attr(raw, "hreflang");
      if (hreflang) addTag("Alternate", `alternate[${hreflang}]`, href, "rel", raw);
    } else if (relV.includes("icon") || relV === "shortcut icon" || relV === "apple-touch-icon") {
      const label = sizes ? `${relV} (${sizes})` : relV;
      addTag("Icons", label, href || attr(raw, "href"), "rel", raw);
    } else if (relV === "manifest") {
      addTag("Icons", "manifest", href, "rel", raw);
    }
  }

  // Favicon fallback
  if (!tags.some(t => t.category === "Icons")) {
    try {
      const base = new URL(pageUrl);
      addTag("Icons", "favicon (default)", `${base.origin}/favicon.ico`, "inferred", "<!-- default favicon -->")
    } catch { /* noop */ }
  }

  return tags;
}

function missingAndScore(tags: MetaTag[]): {
  missingTags: { name: string; reason: string }[];
  seoScore: number;
  recommendations: string[];
} {
  const has = (cat: string, name: string) =>
    tags.some(t => t.category.toLowerCase() === cat.toLowerCase() &&
                   t.name.toLowerCase() === name.toLowerCase() &&
                   !t.isEmpty);

  const missing: { name: string; reason: string }[] = [];
  const recs: string[] = [];
  let score = 100;

  // Basic
  if (!has("Basic", "title")) { missing.push({ name: "title", reason: "Critical — the page title appears in search results and browser tabs." }); score -= 20; recs.push("Add a <title> tag (50–60 characters) — it is the single most important on-page SEO element."); }
  else {
    const t = tags.find(t => t.name === "title");
    if (t && (t.value.length < 10 || t.value.length > 70)) { recs.push(`Title length is ${t.value.length} chars — aim for 50–60 to avoid truncation in search results.`); score -= 5; }
  }
  if (!has("Basic", "description")) { missing.push({ name: "meta description", reason: "Used by search engines as the snippet shown under your title in results." }); score -= 15; recs.push("Add a meta description (120–160 characters) to improve click-through rates from search results."); }
  else {
    const d = tags.find(t => t.name === "description");
    if (d && (d.value.length < 50 || d.value.length > 170)) { recs.push(`Meta description length is ${d.value.length} chars — aim for 120–160 characters.`); score -= 5; }
  }
  if (!has("Basic", "viewport")) { missing.push({ name: "viewport", reason: "Required for proper mobile rendering and a Google ranking factor." }); score -= 10; recs.push("Add <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"> for mobile compatibility."); }
  if (!has("Canonical", "canonical")) { missing.push({ name: "canonical URL", reason: "Prevents duplicate content issues by specifying the preferred URL." }); score -= 10; recs.push("Add a canonical <link> tag to prevent duplicate content penalties."); }

  // OG
  const ogRequired = ["og:title", "og:description", "og:image", "og:url", "og:type"];
  const missingOg = ogRequired.filter(p => !has("Open Graph", p));
  if (missingOg.length === ogRequired.length) { missing.push({ name: "Open Graph tags", reason: "Open Graph controls how your page appears when shared on social platforms." }); score -= 10; recs.push("Add Open Graph tags (og:title, og:description, og:image, og:url, og:type) to control social media previews."); }
  else if (missingOg.length > 0) { score -= missingOg.length * 2; recs.push(`Add missing Open Graph properties: ${missingOg.join(", ")}.`); }

  // Twitter
  if (!has("Twitter Cards", "twitter:card")) { missing.push({ name: "Twitter Card", reason: "Controls how your page appears when shared on Twitter/X." }); score -= 5; recs.push("Add twitter:card, twitter:title and twitter:description for rich Twitter/X link previews."); }

  // Duplicates
  const dups = tags.filter(t => t.isDuplicate);
  if (dups.length > 0) { score -= Math.min(10, dups.length * 3); recs.push(`Remove ${dups.length} duplicate meta tag${dups.length > 1 ? "s" : ""} — duplicates can confuse crawlers and may cause the wrong value to be used.`); }

  // Empty
  const empty = tags.filter(t => t.isEmpty);
  if (empty.length > 0) { score -= Math.min(5, empty.length * 2); recs.push(`Fill or remove ${empty.length} empty meta tag${empty.length > 1 ? "s" : ""}.`); }

  if (score >= 85 && recs.length === 0) recs.push("Meta tag setup looks comprehensive — no critical issues detected.");

  return { missingTags: missing, seoScore: Math.max(0, Math.min(100, score)), recommendations: recs };
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

  const tags = parseMetaTags(html, finalUrl);
  const titleTag = tags.find(t => t.name === "title");

  const dups   = tags.filter(t => t.isDuplicate).length;
  const empties = tags.filter(t => t.isEmpty).length;

  const { missingTags, seoScore, recommendations } = missingAndScore(tags);

  const result: MetaTagsResult = {
    url: targetUrl.toString(),
    finalUrl,
    analyzedAt: new Date().toISOString(),
    pageTitle: titleTag?.value ?? "",
    totalTags: tags.length,
    missingRecommended: missingTags.length,
    duplicateTags: dups,
    emptyTags: empties,
    tags,
    missingTags,
    seoScore,
    recommendations,
  };

  return Response.json(result);
}
