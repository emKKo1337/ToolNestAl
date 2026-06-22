import { NextRequest } from "next/server";

export const maxDuration = 20;

// ── Types ─────────────────────────────────────────────────────────────────────
export type SchemaFormat = "JSON-LD" | "Microdata" | "RDFa";
export type ValidationStatus = "valid" | "warnings" | "errors";

export interface SchemaValidationIssue {
  level: "error" | "warning" | "info";
  message: string;
  property?: string;
}

export interface ExtractedSchema {
  id: number;
  format: SchemaFormat;
  type: string;
  types: string[];
  data: Record<string, unknown>;
  prettyJson: string;
  propertyCount: number;
  validationStatus: ValidationStatus;
  issues: SchemaValidationIssue[];
  isRichResultsEligible: boolean;
  richResultType?: string;
}

export interface SchemaExtractionResult {
  url: string;
  finalUrl: string;
  analyzedAt: string;
  totalSchemas: number;
  jsonLdCount: number;
  microdataCount: number;
  rdfaCount: number;
  schemaTypes: string[];
  hasErrors: boolean;
  hasWarnings: boolean;
  richResultsEligible: number;
  schemas: ExtractedSchema[];
  seoScore: number;
  recommendations: string[];
}

// ── Rich Results eligibility map ──────────────────────────────────────────────
const RICH_RESULTS_TYPES: Record<string, { label: string; required: string[] }> = {
  Article:             { label: "Article",          required: ["headline", "author", "datePublished"] },
  NewsArticle:         { label: "News Article",     required: ["headline", "author", "datePublished"] },
  BlogPosting:         { label: "Blog Post",        required: ["headline", "author", "datePublished"] },
  BreadcrumbList:      { label: "Breadcrumb",       required: ["itemListElement"] },
  Event:               { label: "Event",            required: ["name", "startDate", "location"] },
  FAQPage:             { label: "FAQ",              required: ["mainEntity"] },
  HowTo:               { label: "How-To",           required: ["name", "step"] },
  JobPosting:          { label: "Job Posting",      required: ["title", "hiringOrganization", "jobLocation"] },
  LocalBusiness:       { label: "Local Business",   required: ["name", "address"] },
  Movie:               { label: "Movie",            required: ["name"] },
  Organization:        { label: "Organization",     required: ["name"] },
  Person:              { label: "Person",           required: ["name"] },
  Product:             { label: "Product",          required: ["name"] },
  Recipe:              { label: "Recipe",           required: ["name", "recipeIngredient", "recipeInstructions"] },
  Review:              { label: "Review",           required: ["itemReviewed", "reviewRating", "author"] },
  SoftwareApplication: { label: "Software App",     required: ["name", "operatingSystem", "applicationCategory"] },
  VideoObject:         { label: "Video",            required: ["name", "description", "thumbnailUrl", "uploadDate"] },
  WebSite:             { label: "Sitelinks Search", required: ["name", "url"] },
  WebPage:             { label: "Web Page",         required: ["name"] },
};

// ── Validation ────────────────────────────────────────────────────────────────
function validateSchema(data: Record<string, unknown>, type: string): SchemaValidationIssue[] {
  const issues: SchemaValidationIssue[] = [];
  const richDef = RICH_RESULTS_TYPES[type];

  if (richDef) {
    for (const req of richDef.required) {
      if (!(req in data) || data[req] === "" || data[req] === null || data[req] === undefined) {
        issues.push({ level: "error", message: `Missing required property "${req}" for ${type} rich result`, property: req });
      }
    }
  }

  // Common checks
  if ("url" in data && typeof data.url === "string" && data.url && !data.url.startsWith("http")) {
    issues.push({ level: "warning", message: `"url" should be an absolute URL starting with https://`, property: "url" });
  }
  if ("image" in data) {
    const img = data.image;
    if (typeof img === "string" && img && !img.startsWith("http")) {
      issues.push({ level: "warning", message: `"image" should be an absolute URL`, property: "image" });
    }
  }
  if ("datePublished" in data && typeof data.datePublished === "string") {
    const d = new Date(data.datePublished as string);
    if (isNaN(d.getTime())) issues.push({ level: "error", message: `"datePublished" is not a valid date`, property: "datePublished" });
  }
  if ("dateModified" in data && typeof data.dateModified === "string") {
    const d = new Date(data.dateModified as string);
    if (isNaN(d.getTime())) issues.push({ level: "error", message: `"dateModified" is not a valid date`, property: "dateModified" });
  }
  if (("reviewRating" in data) && data.reviewRating && typeof data.reviewRating === "object") {
    const rr = data.reviewRating as Record<string, unknown>;
    if ("ratingValue" in rr) {
      const rv = Number(rr.ratingValue);
      const max = Number(rr.bestRating ?? 5);
      if (rv < 1 || rv > max) issues.push({ level: "warning", message: `ratingValue (${rv}) is outside expected range 1–${max}`, property: "reviewRating.ratingValue" });
    }
  }
  if (!("@context" in data)) {
    issues.push({ level: "warning", message: `Missing "@context" (should be "https://schema.org")` });
  } else if (typeof data["@context"] === "string" && !String(data["@context"]).includes("schema.org")) {
    issues.push({ level: "warning", message: `"@context" should reference schema.org` });
  }

  // Empty value check
  for (const [key, val] of Object.entries(data)) {
    if (key.startsWith("@")) continue;
    if (val === "" || val === null) {
      issues.push({ level: "warning", message: `Property "${key}" is empty or null`, property: key });
    }
  }

  return issues;
}

function deriveStatus(issues: SchemaValidationIssue[]): ValidationStatus {
  if (issues.some(i => i.level === "error")) return "errors";
  if (issues.some(i => i.level === "warning")) return "warnings";
  return "valid";
}

function extractType(data: Record<string, unknown>): string[] {
  const t = data["@type"];
  if (!t) return ["Thing"];
  if (Array.isArray(t)) return (t as unknown[]).map(String);
  return [String(t)];
}

function countProperties(data: Record<string, unknown>): number {
  return Object.keys(data).filter(k => !k.startsWith("@")).length;
}

// ── JSON-LD extractor ─────────────────────────────────────────────────────────
function extractJsonLd(html: string): Record<string, unknown>[] {
  const results: Record<string, unknown>[] = [];
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const raw = m[1]?.trim() ?? "";
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (item && typeof item === "object") results.push(item as Record<string, unknown>);
        }
      } else if (parsed && typeof parsed === "object") {
        const obj = parsed as Record<string, unknown>;
        // Handle @graph
        if (Array.isArray(obj["@graph"])) {
          for (const node of obj["@graph"] as unknown[]) {
            if (node && typeof node === "object") {
              const n = node as Record<string, unknown>;
              if (!n["@context"]) n["@context"] = obj["@context"];
              results.push(n);
            }
          }
        } else {
          results.push(obj);
        }
      }
    } catch { /* malformed JSON-LD — skip */ }
  }
  return results;
}

// ── Microdata extractor ───────────────────────────────────────────────────────
function extractMicrodata(html: string): Record<string, unknown>[] {
  const results: Record<string, unknown>[] = [];
  // Find itemscope+itemtype blocks
  const scopeRe = /<[a-z][^>]+itemscope[^>]*itemtype=["']([^"']+)["'][^>]*>([\s\S]*?)(?=<[a-z][^>]+itemscope|$)/gi;
  let m: RegExpExecArray | null;
  while ((m = scopeRe.exec(html)) !== null) {
    const typeUrl = m[1] ?? "";
    const inner   = m[2] ?? "";
    const typeName = typeUrl.split("/").pop() ?? typeUrl;
    const obj: Record<string, unknown> = {
      "@context": "https://schema.org",
      "@type": typeName,
    };
    // Extract itemprop values
    const propRe = /itemprop=["']([^"']+)["'][^>]*(?:content|value|href|src)=["']([^"']*)["']/gi;
    let pm: RegExpExecArray | null;
    while ((pm = propRe.exec(inner)) !== null) {
      obj[pm[1] ?? ""] = pm[2] ?? "";
    }
    // Also grab text content of itemprop elements
    const textRe = /itemprop=["']([^"']+)["'][^>]*>([^<]{1,200})</gi;
    while ((pm = textRe.exec(inner)) !== null) {
      const key = pm[1] ?? "";
      if (!(key in obj) && (pm[2] ?? "").trim()) obj[key] = (pm[2] ?? "").trim();
    }
    if (Object.keys(obj).length > 2) results.push(obj);
  }
  return results;
}

// ── RDFa extractor ────────────────────────────────────────────────────────────
function extractRdfa(html: string): Record<string, unknown>[] {
  const results: Record<string, unknown>[] = [];
  const scopeRe = /<[a-z][^>]+typeof=["']([^"']+)["'][^>]*>([\s\S]*?)(?=<[a-z][^>]+typeof=|$)/gi;
  let m: RegExpExecArray | null;
  while ((m = scopeRe.exec(html)) !== null) {
    const typeRaw = (m[1] ?? "").trim();
    const inner   = m[2] ?? "";
    const typeName = typeRaw.includes(":") ? typeRaw.split(":").pop() ?? typeRaw : typeRaw.split("/").pop() ?? typeRaw;
    const obj: Record<string, unknown> = {
      "@context": "https://schema.org",
      "@type": typeName,
    };
    const propRe = /property=["']([^"']+)["'][^>]*(?:content|href|src)=["']([^"']*)["']/gi;
    let pm: RegExpExecArray | null;
    while ((pm = propRe.exec(inner)) !== null) {
      const key = (pm[1] ?? "").split(":").pop() ?? "";
      if (key) obj[key] = pm[2] ?? "";
    }
    const textRe = /property=["']([^"']+)["'][^>]*>([^<]{1,200})</gi;
    while ((pm = textRe.exec(inner)) !== null) {
      const key = (pm[1] ?? "").split(":").pop() ?? "";
      if (key && !(key in obj) && (pm[2] ?? "").trim()) obj[key] = (pm[2] ?? "").trim();
    }
    if (Object.keys(obj).length > 2) results.push(obj);
  }
  return results;
}

// ── Scoring ───────────────────────────────────────────────────────────────────
function scoreAndRecommend(schemas: ExtractedSchema[]): { score: number; recommendations: string[] } {
  const recs: string[] = [];
  let score = 100;

  if (schemas.length === 0) {
    return { score: 20, recommendations: ["No structured data found — add JSON-LD markup to enable Google Rich Results and improve search appearance."] };
  }

  const errors   = schemas.filter(s => s.validationStatus === "errors").length;
  const warnings = schemas.filter(s => s.validationStatus === "warnings").length;
  const eligible = schemas.filter(s => s.isRichResultsEligible).length;

  if (errors > 0) {
    score -= Math.min(40, errors * 15);
    recs.push(`Fix validation errors in ${errors} schema${errors > 1 ? "s" : ""} — missing required properties prevent Google from generating Rich Results.`);
  }
  if (warnings > 0) {
    score -= Math.min(20, warnings * 5);
    recs.push(`Address ${warnings} schema${warnings > 1 ? "s" : ""} with warnings — empty values and relative URLs reduce rich result quality.`);
  }
  if (eligible === 0) {
    score -= 15;
    recs.push("None of your schemas are eligible for Google Rich Results — check required properties for your schema types.");
  }
  const hasOrg = schemas.some(s => s.types.includes("Organization"));
  if (!hasOrg) { recs.push("Add an Organization or WebSite schema to your homepage to help Google identify your brand."); score -= 5; }
  const hasBreadcrumb = schemas.some(s => s.types.includes("BreadcrumbList"));
  if (!hasBreadcrumb && schemas.length > 0) { recs.push("Add BreadcrumbList schema to enable breadcrumb rich results in Google Search."); }

  const jsonLdCount = schemas.filter(s => s.format === "JSON-LD").length;
  const microdataCount = schemas.filter(s => s.format === "Microdata").length;
  if (microdataCount > 0 && jsonLdCount === 0) {
    recs.push("Consider migrating from Microdata to JSON-LD — Google recommends JSON-LD as it is easier to maintain and less error-prone.");
  }

  if (score >= 85 && recs.length === 0) recs.push("Structured data looks healthy — schemas are valid and eligible for Rich Results.");
  return { score: Math.max(0, Math.min(100, score)), recommendations: recs };
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

  const rawJsonLd    = extractJsonLd(html);
  const rawMicrodata = extractMicrodata(html);
  const rawRdfa      = extractRdfa(html);

  let id = 0;
  const schemas: ExtractedSchema[] = [];

  const buildSchema = (data: Record<string, unknown>, format: SchemaFormat): ExtractedSchema => {
    const types   = extractType(data);
    const primary = types[0] ?? "Thing";
    const issues  = validateSchema(data, primary);
    const status  = deriveStatus(issues);
    const richDef = RICH_RESULTS_TYPES[primary];
    const isEligible = !!richDef && status !== "errors";
    return {
      id: id++,
      format,
      type: primary,
      types,
      data,
      prettyJson: JSON.stringify(data, null, 2),
      propertyCount: countProperties(data),
      validationStatus: status,
      issues,
      isRichResultsEligible: isEligible,
      richResultType: richDef?.label,
    };
  };

  for (const d of rawJsonLd)    schemas.push(buildSchema(d, "JSON-LD"));
  for (const d of rawMicrodata) schemas.push(buildSchema(d, "Microdata"));
  for (const d of rawRdfa)      schemas.push(buildSchema(d, "RDFa"));

  const { score, recommendations } = scoreAndRecommend(schemas);
  const allTypes = [...new Set(schemas.flatMap(s => s.types))];

  const result: SchemaExtractionResult = {
    url: targetUrl.toString(),
    finalUrl,
    analyzedAt: new Date().toISOString(),
    totalSchemas: schemas.length,
    jsonLdCount: rawJsonLd.length,
    microdataCount: rawMicrodata.length,
    rdfaCount: rawRdfa.length,
    schemaTypes: allTypes,
    hasErrors: schemas.some(s => s.validationStatus === "errors"),
    hasWarnings: schemas.some(s => s.validationStatus === "warnings"),
    richResultsEligible: schemas.filter(s => s.isRichResultsEligible).length,
    schemas,
    seoScore: score,
    recommendations,
  };

  return Response.json(result);
}
