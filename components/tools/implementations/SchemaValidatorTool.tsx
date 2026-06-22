"use client";

import { useState, useMemo, useCallback, useRef } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────
type IssueSeverity = "error" | "warning" | "info";
interface Issue { severity: IssueSeverity; field?: string; message: string; fix?: string; }
interface SchemaBlock {
  raw: string;
  parsed: Record<string, unknown> | null;
  parseError?: string;
  type: string;
  issues: Issue[];
  richResults: RichResult[];
  score: number;
}
interface RichResult { type: string; eligible: boolean; missing: string[]; }

// ── Constants ─────────────────────────────────────────────────────────────────
const ACCENT = "#f97316";

// Required fields per type for Google Rich Results
const RICH_RESULTS_REQUIREMENTS: Record<string, { label: string; required: string[] }> = {
  Article:       { label: "Article",      required: ["headline", "image", "author", "datePublished"] },
  BlogPosting:   { label: "Article",      required: ["headline", "image", "author", "datePublished"] },
  NewsArticle:   { label: "Article",      required: ["headline", "image", "author", "datePublished"] },
  FAQPage:       { label: "FAQ",          required: ["mainEntity"] },
  Product:       { label: "Product",      required: ["name", "image"] },
  Recipe:        { label: "Recipe",       required: ["name", "image", "recipeIngredient", "recipeInstructions"] },
  Event:         { label: "Event",        required: ["name", "startDate", "location"] },
  BreadcrumbList:{ label: "Breadcrumb",   required: ["itemListElement"] },
  VideoObject:   { label: "Video",        required: ["name", "description", "thumbnailUrl", "uploadDate"] },
  JobPosting:    { label: "Job Posting",  required: ["title", "description", "datePosted", "hiringOrganization"] },
  Review:        { label: "Review",       required: ["reviewRating", "author", "itemReviewed"] },
  SoftwareApplication: { label: "Software App", required: ["name", "operatingSystem", "applicationCategory"] },
  Course:        { label: "Course",       required: ["name", "description", "provider"] },
  Book:          { label: "Book",         required: ["name", "author"] },
};

// Required base fields per schema type
const BASE_REQUIRED: Record<string, string[]> = {
  Organization:        ["name"],
  LocalBusiness:       ["name", "address"],
  WebSite:             ["name", "url"],
  WebPage:             ["name", "url"],
  Article:             ["headline", "author", "datePublished", "image"],
  BlogPosting:         ["headline", "author", "datePublished", "image"],
  NewsArticle:         ["headline", "author", "datePublished", "image"],
  Product:             ["name"],
  FAQPage:             ["mainEntity"],
  BreadcrumbList:      ["itemListElement"],
  Event:               ["name", "startDate", "location"],
  Recipe:              ["name", "recipeIngredient", "recipeInstructions"],
  Course:              ["name", "description"],
  SoftwareApplication: ["name", "operatingSystem", "applicationCategory"],
  VideoObject:         ["name", "description", "thumbnailUrl", "uploadDate"],
  Review:              ["author", "reviewRating"],
  Book:                ["name", "author"],
  JobPosting:          ["title", "description", "datePosted", "hiringOrganization"],
  Person:              ["name"],
  Service:             ["name"],
};

// Recommended (warning level) fields per type
const RECOMMENDED: Record<string, string[]> = {
  Organization:  ["url", "logo", "sameAs", "contactPoint"],
  LocalBusiness: ["telephone", "openingHours", "geo", "url"],
  Article:       ["description", "image", "publisher", "url"],
  BlogPosting:   ["description", "image", "publisher", "url"],
  Product:       ["description", "offers", "aggregateRating"],
  Event:         ["description", "image", "offers", "organizer"],
  Recipe:        ["author", "description", "totalTime", "nutrition"],
  VideoObject:   ["contentUrl", "embedUrl", "duration"],
  JobPosting:    ["salary", "employmentType"],
  Person:        ["url", "image", "jobTitle", "email"],
};

// URL-type fields
const URL_FIELDS = new Set(["url", "image", "logo", "thumbnailUrl", "contentUrl", "embedUrl", "sameAs", "mainEntityOfPage"]);
// Date-type fields
const DATE_FIELDS = new Set(["datePublished", "dateModified", "startDate", "endDate", "datePosted", "dateCreated", "uploadDate"]);

const KNOWN_TYPES = new Set([
  "Organization", "LocalBusiness", "WebSite", "WebPage", "Article", "BlogPosting",
  "NewsArticle", "Product", "FAQPage", "BreadcrumbList", "Event", "Recipe",
  "Course", "SoftwareApplication", "VideoObject", "Review", "Book", "JobPosting",
  "Person", "Service",
]);

// ── Validation engine ─────────────────────────────────────────────────────────
function isValidUrl(v: string): boolean {
  try { new URL(v); return true; } catch { return false; }
}

function isValidDate(v: string): boolean {
  return /^\d{4}-\d{2}-\d{2}(T[\d:.Z+\-]+)?$/.test(v);
}

function validateSchemaObject(obj: Record<string, unknown>): Issue[] {
  const issues: Issue[] = [];
  const type = String(obj["@type"] ?? "");

  if (!obj["@context"]) {
    issues.push({ severity: "error", field: "@context", message: '@context is missing.', fix: 'Add "@context": "https://schema.org"' });
  } else if (!String(obj["@context"]).includes("schema.org")) {
    issues.push({ severity: "warning", field: "@context", message: '@context should reference schema.org.', fix: 'Use "@context": "https://schema.org"' });
  }

  if (!type) {
    issues.push({ severity: "error", field: "@type", message: "@type is missing — every schema block must declare its type." });
    return issues;
  }
  if (!KNOWN_TYPES.has(type)) {
    issues.push({ severity: "warning", field: "@type", message: `@type "${type}" is not a recognised Schema.org type in this validator.` });
  }

  // Required fields
  const required = BASE_REQUIRED[type] ?? [];
  for (const field of required) {
    if (!(field in obj) || obj[field] === "" || obj[field] === null) {
      issues.push({ severity: "error", field, message: `Required field "${field}" is missing for ${type}.`, fix: `Add the "${field}" property.` });
    }
  }

  // Recommended fields
  const recommended = RECOMMENDED[type] ?? [];
  for (const field of recommended) {
    if (!(field in obj)) {
      issues.push({ severity: "warning", field, message: `Recommended field "${field}" is missing for ${type}.`, fix: `Adding "${field}" improves Rich Results eligibility.` });
    }
  }

  // Duplicate property check (can't happen in parsed JSON, but check arrays of objects if @graph)
  const keys = Object.keys(obj);
  const seen = new Set<string>();
  for (const k of keys) {
    if (k !== "@context" && k !== "@type") {
      if (seen.has(k)) issues.push({ severity: "warning", field: k, message: `Duplicate property "${k}" detected.` });
      seen.add(k);
    }
  }

  // URL field validation
  for (const [k, v] of Object.entries(obj)) {
    if (!URL_FIELDS.has(k)) continue;
    const vals = Array.isArray(v) ? v : [v];
    for (const val of vals) {
      if (typeof val === "string" && val && !isValidUrl(val)) {
        issues.push({ severity: "error", field: k, message: `"${k}" contains an invalid URL: "${val}".`, fix: "Use a full URL starting with https://." });
      }
      if (typeof val === "object" && val !== null && "url" in (val as Record<string, unknown>)) {
        const inner = (val as Record<string, unknown>)["url"];
        if (typeof inner === "string" && inner && !isValidUrl(inner)) {
          issues.push({ severity: "error", field: `${k}.url`, message: `"${k}.url" contains an invalid URL: "${inner}".`, fix: "Use a full URL starting with https://." });
        }
      }
    }
  }

  // Date field validation
  for (const [k, v] of Object.entries(obj)) {
    if (!DATE_FIELDS.has(k)) continue;
    if (typeof v === "string" && v && !isValidDate(v)) {
      issues.push({ severity: "error", field: k, message: `"${k}" has an invalid date format: "${v}".`, fix: 'Use ISO 8601 format: "YYYY-MM-DD" or "YYYY-MM-DDTHH:MM:SSZ".' });
    }
  }

  // FAQPage: check mainEntity structure
  if (type === "FAQPage" && Array.isArray(obj["mainEntity"])) {
    const questions = obj["mainEntity"] as unknown[];
    if (questions.length === 0) {
      issues.push({ severity: "error", field: "mainEntity", message: "mainEntity array is empty — add at least one Question." });
    }
    questions.forEach((q, i) => {
      if (typeof q !== "object" || q === null) return;
      const qObj = q as Record<string, unknown>;
      if ((qObj["@type"]) !== "Question") {
        issues.push({ severity: "error", field: `mainEntity[${i}].@type`, message: `mainEntity[${i}] @type should be "Question".` });
      }
      if (!qObj["name"]) {
        issues.push({ severity: "error", field: `mainEntity[${i}].name`, message: `mainEntity[${i}] is missing the "name" (question text) property.` });
      }
      const answer = qObj["acceptedAnswer"];
      if (!answer || typeof answer !== "object") {
        issues.push({ severity: "error", field: `mainEntity[${i}].acceptedAnswer`, message: `mainEntity[${i}] is missing "acceptedAnswer".` });
      } else {
        const aObj = answer as Record<string, unknown>;
        if (aObj["@type"] !== "Answer") issues.push({ severity: "warning", field: `mainEntity[${i}].acceptedAnswer.@type`, message: 'acceptedAnswer @type should be "Answer".' });
        if (!aObj["text"]) issues.push({ severity: "error", field: `mainEntity[${i}].acceptedAnswer.text`, message: 'acceptedAnswer is missing the "text" property.' });
      }
    });
  }

  // BreadcrumbList: check itemListElement
  if (type === "BreadcrumbList" && Array.isArray(obj["itemListElement"])) {
    const items = obj["itemListElement"] as unknown[];
    items.forEach((item, i) => {
      if (typeof item !== "object" || item === null) return;
      const it = item as Record<string, unknown>;
      if (!it["position"]) issues.push({ severity: "error", field: `itemListElement[${i}].position`, message: `Breadcrumb item[${i}] is missing "position".` });
      if (!it["name"] && !it["item"]) issues.push({ severity: "warning", field: `itemListElement[${i}].name`, message: `Breadcrumb item[${i}] should have "name" or "item".` });
    });
  }

  return issues;
}

function computeRichResults(obj: Record<string, unknown>, issues: Issue[]): RichResult[] {
  const type = String(obj["@type"] ?? "");
  const req = RICH_RESULTS_REQUIREMENTS[type];
  if (!req) return [];
  const errors = issues.filter(i => i.severity === "error").map(i => i.field ?? "");
  const missing = req.required.filter(f => errors.includes(f) || !(f in obj));
  return [{ type: req.label, eligible: missing.length === 0, missing }];
}

function scoreBlock(issues: Issue[]): number {
  let pts = 100;
  for (const iss of issues) {
    if (iss.severity === "error")   pts -= 15;
    if (iss.severity === "warning") pts -= 5;
  }
  return Math.max(0, Math.min(100, pts));
}

function extractJsonLdFromHtml(html: string): string[] {
  const blocks: string[] = [];
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    if (m[1]?.trim()) blocks.push(m[1].trim());
  }
  return blocks;
}

function parseBlocks(rawBlocks: string[]): SchemaBlock[] {
  const all: SchemaBlock[] = [];
  for (const raw of rawBlocks) {
    let parsed: unknown;
    let parseError: string | undefined;
    try { parsed = JSON.parse(raw); } catch (e) {
      parseError = e instanceof Error ? e.message : String(e);
      all.push({ raw, parsed: null, parseError, type: "Unknown", issues: [{ severity: "error", message: `JSON syntax error: ${parseError}`, fix: "Fix the JSON syntax before validating." }], richResults: [], score: 0 });
      continue;
    }

    const items: Record<string, unknown>[] = [];
    if (Array.isArray(parsed)) {
      for (const item of parsed) {
        if (typeof item === "object" && item !== null) items.push(item as Record<string, unknown>);
      }
    } else if (typeof parsed === "object" && parsed !== null) {
      const obj = parsed as Record<string, unknown>;
      if (Array.isArray(obj["@graph"])) {
        for (const item of obj["@graph"] as unknown[]) {
          if (typeof item === "object" && item !== null) {
            const merged = { "@context": obj["@context"], ...(item as Record<string, unknown>) };
            items.push(merged);
          }
        }
      } else {
        items.push(obj);
      }
    }

    for (const item of items) {
      const issues = validateSchemaObject(item);
      const richResults = computeRichResults(item, issues);
      const score = scoreBlock(issues);
      all.push({ raw, parsed: item, type: String(item["@type"] ?? "Unknown"), issues, richResults, score });
    }
  }
  return all;
}

// ── Syntax highlighter ────────────────────────────────────────────────────────
function JsonHighlight({ json }: { json: string }) {
  const highlighted = json
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"((?:[^"\\]|\\.)*)"/g, (_m, inner) => {
      if (/^https?:\/\//.test(inner) || /^\//.test(inner)) return `<span style="color:#86efac">"${inner}"</span>`;
      return `<span style="color:#fde68a">"${inner}"</span>`;
    })
    .replace(/:\s*(-?\d+\.?\d*)/g, (_m, n) => `: <span style="color:#c4b5fd">${n}</span>`)
    .replace(/:\s*(true|false|null)/g, (_m, b) => `: <span style="color:#f9a8d4">${b}</span>`);
  return (
    <pre className="text-[11px] font-mono overflow-x-auto p-4 rounded-xl leading-relaxed"
      style={{ background: "rgba(0,0,0,0.35)", color: "#e2e8f0", whiteSpace: "pre-wrap", wordBreak: "break-all" }}
      dangerouslySetInnerHTML={{ __html: highlighted }} />
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────
function PanelHeader({ icon, title, badge }: { icon: string; title: string; badge?: string }) {
  return (
    <div className="flex items-center gap-2 pb-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
      <span className="material-symbols-outlined text-[16px]" style={{ color: ACCENT }}>{icon}</span>
      <p className="text-[13px] font-bold" style={{ color: "#e8dff0" }}>{title}</p>
      {badge && (
        <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full"
          style={{ background: "rgba(249,115,22,0.1)", color: ACCENT }}>{badge}</span>
      )}
    </div>
  );
}

function IssueLine({ issue }: { issue: Issue }) {
  const color = issue.severity === "error" ? "#ef4444" : issue.severity === "warning" ? "#f59e0b" : "#60a5fa";
  const icon  = issue.severity === "error" ? "error" : issue.severity === "warning" ? "warning" : "info";
  return (
    <div className="flex items-start gap-2.5 py-2.5" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
      <span className="material-symbols-outlined text-[14px] mt-0.5 shrink-0" style={{ color }}>{icon}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          {issue.field && (
            <code className="text-[10px] px-1.5 py-0.5 rounded font-mono"
              style={{ background: "rgba(255,255,255,0.06)", color: "#e8dff0" }}>{issue.field}</code>
          )}
          <span className="text-[12px]" style={{ color: "#c8b89f" }}>{issue.message}</span>
        </div>
        {issue.fix && (
          <p className="text-[11px] mt-1" style={{ color: "#60a5fa" }}>Fix: {issue.fix}</p>
        )}
      </div>
      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md shrink-0 capitalize"
        style={{ background: `${color}18`, color }}>
        {issue.severity}
      </span>
    </div>
  );
}

function RichResultBadge({ rr }: { rr: RichResult }) {
  const color = rr.eligible ? "#22c55e" : rr.missing.length <= 1 ? "#f59e0b" : "#ef4444";
  const icon  = rr.eligible ? "check_circle" : "cancel";
  return (
    <div className="flex items-start gap-2.5 py-2.5" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
      <span className="material-symbols-outlined text-[15px] mt-0.5 shrink-0" style={{ color }}>{icon}</span>
      <div className="flex-1">
        <p className="text-[12px] font-bold" style={{ color: "#e8dff0" }}>{rr.type} Rich Result</p>
        {rr.eligible
          ? <p className="text-[11px] mt-0.5" style={{ color: "#22c55e" }}>Eligible — all required properties are present.</p>
          : <p className="text-[11px] mt-0.5" style={{ color: "#988d9f" }}>Missing: {rr.missing.join(", ")}</p>
        }
      </div>
      <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg shrink-0"
        style={{ background: `${color}18`, color }}>
        {rr.eligible ? "ELIGIBLE" : "NOT ELIGIBLE"}
      </span>
    </div>
  );
}

type InputMode = "url" | "paste" | "upload";

// ── Main component ─────────────────────────────────────────────────────────────
export default function SchemaValidatorTool() {
  const [mode,      setMode]      = useState<InputMode>("paste");
  const [urlInput,  setUrlInput]  = useState("");
  const [jsonInput, setJsonInput] = useState("");
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState("");
  const [blocks,    setBlocks]    = useState<SchemaBlock[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [copied,    setCopied]    = useState(false);
  const [showRaw,   setShowRaw]   = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const totalScore = useMemo(() => {
    if (!blocks.length) return 0;
    return Math.round(blocks.reduce((s, b) => s + b.score, 0) / blocks.length);
  }, [blocks]);

  const totalErrors   = useMemo(() => blocks.reduce((s, b) => s + b.issues.filter(i => i.severity === "error").length, 0), [blocks]);
  const totalWarnings = useMemo(() => blocks.reduce((s, b) => s + b.issues.filter(i => i.severity === "warning").length, 0), [blocks]);
  const activeBlock   = blocks[activeIdx] ?? null;

  const scoreColor = totalScore >= 71 ? "#22c55e" : totalScore >= 41 ? "#f59e0b" : "#ef4444";
  const scoreLabel = totalScore >= 71 ? "Valid" : totalScore >= 41 ? "Needs work" : "Invalid";

  const validate = useCallback(async () => {
    setError(""); setBlocks([]); setActiveIdx(0); setLoading(true);
    try {
      if (mode === "paste") {
        if (!jsonInput.trim()) { setError("Please paste JSON-LD or HTML containing structured data."); setLoading(false); return; }
        let rawBlocks: string[];
        // Try as JSON first; fallback to HTML extraction
        try { JSON.parse(jsonInput); rawBlocks = [jsonInput.trim()]; }
        catch { rawBlocks = extractJsonLdFromHtml(jsonInput); }
        if (!rawBlocks.length) { setError("No JSON-LD found. Paste a raw JSON-LD block or full HTML containing <script type=\"application/ld+json\"> tags."); setLoading(false); return; }
        setBlocks(parseBlocks(rawBlocks));
      } else if (mode === "url") {
        const trimmed = urlInput.trim();
        if (!trimmed) { setError("Please enter a URL."); setLoading(false); return; }
        const encoded = encodeURIComponent(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
        const res = await fetch(`/api/validate-schema?url=${encoded}`);
        const data = await res.json() as { html?: string; error?: string };
        if (data.error) { setError(data.error); setLoading(false); return; }
        const rawBlocks = extractJsonLdFromHtml(data.html ?? "");
        if (!rawBlocks.length) { setError("No JSON-LD structured data found on this page."); setLoading(false); return; }
        setBlocks(parseBlocks(rawBlocks));
      }
    } catch {
      setError("Unexpected error — please try again.");
    } finally {
      setLoading(false);
    }
  }, [mode, jsonInput, urlInput]);

  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const html = ev.target?.result as string;
      const rawBlocks = extractJsonLdFromHtml(html);
      if (!rawBlocks.length) { setError("No JSON-LD found in the uploaded file."); return; }
      setError(""); setActiveIdx(0);
      setBlocks(parseBlocks(rawBlocks));
    };
    reader.readAsText(file);
    // Reset so the same file can be re-uploaded
    e.target.value = "";
  }, []);

  const handleKey = useCallback((e: React.KeyboardEvent) => { if (e.key === "Enter" && mode === "url") validate(); }, [validate, mode]);

  const reset = useCallback(() => { setUrlInput(""); setJsonInput(""); setBlocks([]); setError(""); setActiveIdx(0); setShowRaw(false); }, []);

  // ── Export helpers ──────────────────────────────────────────────────────────
  const exportJson = useCallback(() => {
    if (!blocks.length) return;
    const data = blocks.map(b => ({ type: b.type, score: b.score, issues: b.issues, richResults: b.richResults }));
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const u = URL.createObjectURL(blob);
    Object.assign(document.createElement("a"), { href: u, download: "schema-validation.json" }).click();
    URL.revokeObjectURL(u);
  }, [blocks]);

  const exportTxt = useCallback(() => {
    if (!blocks.length) return;
    const lines: string[] = [`Schema Validation Report`, `Overall Score: ${totalScore}/100 — ${scoreLabel}`, `Blocks: ${blocks.length} | Errors: ${totalErrors} | Warnings: ${totalWarnings}`, ""];
    for (const [i, b] of blocks.entries()) {
      lines.push(`=== Block ${i + 1}: ${b.type} (Score: ${b.score}/100) ===`);
      for (const iss of b.issues) lines.push(`[${iss.severity.toUpperCase()}] ${iss.field ? `${iss.field}: ` : ""}${iss.message}${iss.fix ? ` — Fix: ${iss.fix}` : ""}`);
      for (const rr of b.richResults) lines.push(`Rich Result — ${rr.type}: ${rr.eligible ? "ELIGIBLE" : `NOT ELIGIBLE (missing: ${rr.missing.join(", ")})`}`);
      lines.push("");
    }
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const u = URL.createObjectURL(blob);
    Object.assign(document.createElement("a"), { href: u, download: "schema-validation.txt" }).click();
    URL.revokeObjectURL(u);
  }, [blocks, totalScore, scoreLabel, totalErrors, totalWarnings]);

  const exportPdf = useCallback(() => {
    if (!blocks.length) return;
    const blockHtml = blocks.map((b, i) => {
      const issueRows = b.issues.map(iss => {
        const c = iss.severity === "error" ? "#dc2626" : iss.severity === "warning" ? "#d97706" : "#2563eb";
        return `<tr><td style="color:${c};font-weight:700">${iss.severity}</td><td><code>${iss.field ?? ""}</code></td><td>${iss.message}</td><td style="font-size:11px;color:#555">${iss.fix ?? ""}</td></tr>`;
      }).join("");
      const rrRows = b.richResults.map(rr => {
        const c = rr.eligible ? "#16a34a" : "#dc2626";
        return `<tr><td>${rr.type}</td><td style="color:${c};font-weight:700">${rr.eligible ? "ELIGIBLE" : "NOT ELIGIBLE"}</td><td style="font-size:11px">${rr.missing.join(", ") || "—"}</td></tr>`;
      }).join("");
      return `<h2>Block ${i + 1}: ${b.type} — Score ${b.score}/100</h2>
${issueRows ? `<table><thead><tr><th>Level</th><th>Field</th><th>Message</th><th>Fix</th></tr></thead><tbody>${issueRows}</tbody></table>` : "<p style='color:#16a34a'>No issues found.</p>"}
${rrRows ? `<h3>Rich Results</h3><table><thead><tr><th>Type</th><th>Status</th><th>Missing</th></tr></thead><tbody>${rrRows}</tbody></table>` : ""}`;
    }).join("<hr>");
    const html = `<!DOCTYPE html><html><head><title>Schema Validation</title>
<style>body{font-family:system-ui,sans-serif;max-width:900px;margin:2rem auto;color:#111;font-size:14px}
h1{font-size:20px}h2{font-size:15px;margin-top:24px;border-bottom:1px solid #ddd;padding-bottom:4px}h3{font-size:13px}
.score{font-size:36px;font-weight:900;color:${scoreColor}}
table{width:100%;border-collapse:collapse;margin-top:8px}
th,td{text-align:left;padding:5px 8px;border-bottom:1px solid #eee;font-size:12px;vertical-align:top}
th{font-weight:700;color:#555;background:#fafafa}code{background:#f3f4f6;padding:1px 4px;border-radius:3px;font-size:11px}hr{margin:24px 0}
</style></head><body>
<h1>Schema Validation Report</h1>
<p class="score">${totalScore}<span style="font-size:16px;font-weight:400;color:#555"> / 100 — ${scoreLabel}</span></p>
<p>${blocks.length} schema block${blocks.length !== 1 ? "s" : ""} &bull; ${totalErrors} error${totalErrors !== 1 ? "s" : ""} &bull; ${totalWarnings} warning${totalWarnings !== 1 ? "s" : ""}</p>
${blockHtml}</body></html>`;
    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); w.print(); }
  }, [blocks, totalScore, scoreLabel, scoreColor, totalErrors, totalWarnings]);

  const copyResults = useCallback(async () => {
    if (!blocks.length) return;
    const lines = [`Score: ${totalScore}/100 | ${totalErrors} errors | ${totalWarnings} warnings`];
    for (const b of blocks) {
      lines.push(`\n${b.type} (${b.score}/100)`);
      for (const iss of b.issues) lines.push(`  [${iss.severity.toUpperCase()}] ${iss.message}`);
    }
    try { await navigator.clipboard.writeText(lines.join("\n")); } catch { /* blocked */ }
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  }, [blocks, totalScore, totalErrors, totalWarnings]);

  // ── Input styles ────────────────────────────────────────────────────────────
  const inputCls = "flex-1 rounded-xl px-3 py-2.5 text-[13px] outline-none transition-all bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] focus:border-[rgba(249,115,22,0.4)] text-[#e8dff0] placeholder-[#3d3345]";
  const tabActive = { background: "rgba(249,115,22,0.12)", color: ACCENT, border: `1px solid rgba(249,115,22,0.3)` };
  const tabInactive = { background: "rgba(255,255,255,0.03)", color: "#988d9f", border: "1px solid rgba(255,255,255,0.07)" };

  return (
    <div className="mb-12 flex flex-col gap-6">

      {/* ── Input panel ──────────────────────────────────────────────────── */}
      <div className="glass-panel rounded-2xl p-5 flex flex-col gap-4"
        style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
        <PanelHeader icon="fact_check" title="Validate Structured Data" />

        {/* Mode tabs */}
        <div className="flex gap-2 flex-wrap">
          {([["paste", "code", "Paste JSON-LD"], ["url", "link", "Website URL"], ["upload", "upload_file", "Upload HTML"]] as const).map(([m, icon, label]) => (
            <button key={m} onClick={() => { setMode(m); setError(""); }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-semibold transition-all"
              style={mode === m ? tabActive : tabInactive}>
              <span className="material-symbols-outlined text-[14px]">{icon}</span>{label}
            </button>
          ))}
        </div>

        {/* URL mode */}
        {mode === "url" && (
          <div className="flex gap-3 flex-wrap sm:flex-nowrap">
            <input type="url" value={urlInput} onChange={e => setUrlInput(e.target.value)} onKeyDown={handleKey}
              placeholder="https://example.com" aria-label="URL to validate"
              className={inputCls} />
            <button onClick={validate} disabled={loading}
              className="btn-primary flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm shrink-0 disabled:opacity-60">
              <span className="material-symbols-outlined text-[15px]">{loading ? "hourglass_top" : "fact_check"}</span>
              {loading ? "Fetching…" : "Validate"}
            </button>
          </div>
        )}

        {/* Paste mode */}
        {mode === "paste" && (
          <>
            <textarea value={jsonInput} onChange={e => setJsonInput(e.target.value)}
              placeholder={'Paste JSON-LD block:\n{\n  "@context": "https://schema.org",\n  "@type": "Article",\n  "headline": "My Article"\n}\n\nOr paste full HTML containing <script type="application/ld+json"> tags.'}
              rows={10} aria-label="JSON-LD or HTML input"
              className="w-full rounded-xl px-3 py-3 text-[12px] font-mono outline-none transition-all bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] focus:border-[rgba(249,115,22,0.4)] text-[#e8dff0] placeholder-[#3d3345] resize-y" />
            <div className="flex gap-3 justify-between flex-wrap">
              <button onClick={() => setJsonInput("")}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-semibold transition-all"
                style={tabInactive}>
                <span className="material-symbols-outlined text-[13px]">clear</span>Clear
              </button>
              <button onClick={validate} disabled={loading}
                className="btn-primary flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm disabled:opacity-60">
                <span className="material-symbols-outlined text-[15px]">{loading ? "hourglass_top" : "fact_check"}</span>
                {loading ? "Validating…" : "Validate Schema"}
              </button>
            </div>
          </>
        )}

        {/* Upload mode */}
        {mode === "upload" && (
          <div className="flex flex-col items-center gap-4">
            <input ref={fileRef} type="file" accept=".html,.htm,.txt" onChange={handleFile} className="hidden" aria-label="Upload HTML file" />
            <button onClick={() => fileRef.current?.click()}
              className="w-full flex flex-col items-center gap-3 px-6 py-10 rounded-2xl transition-all cursor-pointer"
              style={{ border: "2px dashed rgba(249,115,22,0.3)", background: "rgba(249,115,22,0.04)" }}>
              <span className="material-symbols-outlined text-[48px]" style={{ color: ACCENT }}>upload_file</span>
              <div className="text-center">
                <p className="text-[13px] font-semibold" style={{ color: "#e8dff0" }}>Click to upload an HTML file</p>
                <p className="text-[11px] mt-1" style={{ color: "#3d3345" }}>Supports .html, .htm, .txt — extracts all JSON-LD blocks</p>
              </div>
            </button>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2 px-4 py-3 rounded-xl"
            style={{ background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.2)" }}>
            <span className="material-symbols-outlined text-[15px] mt-0.5 shrink-0 text-red-400">error</span>
            <p className="text-[13px]" style={{ color: "#fca5a5" }}>{error}</p>
          </div>
        )}
      </div>

      {/* ── Results ──────────────────────────────────────────────────────── */}
      {blocks.length > 0 && (
        <>
          {/* Score + summary */}
          <div className="glass-panel rounded-2xl p-5 flex flex-wrap items-start gap-6"
            style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
            <div className="flex flex-col items-center gap-1.5 shrink-0">
              <div className="relative w-24 h-24">
                <svg width="96" height="96" viewBox="0 0 96 96" aria-label={`Score ${totalScore}/100`}>
                  <circle cx="48" cy="48" r="40" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="7" />
                  <circle cx="48" cy="48" r="40" fill="none"
                    stroke={scoreColor} strokeWidth="7"
                    strokeDasharray={2 * Math.PI * 40}
                    strokeDashoffset={2 * Math.PI * 40 * (1 - totalScore / 100)}
                    strokeLinecap="round" transform="rotate(-90 48 48)"
                    style={{ transition: "stroke-dashoffset 0.6s ease, stroke 0.4s ease" }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-[26px] font-black tabular-nums" style={{ color: scoreColor, lineHeight: 1 }}>{totalScore}</span>
                  <span className="text-[9px] font-bold" style={{ color: scoreColor, opacity: 0.7 }}>/ 100</span>
                </div>
              </div>
              <span className="text-[11px] font-bold" style={{ color: scoreColor }}>{scoreLabel}</span>
            </div>

            <div className="flex-1 min-w-0 flex flex-col gap-3">
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Blocks",   value: blocks.length,   color: "#e8dff0" },
                  { label: "Errors",   value: totalErrors,     color: totalErrors   ? "#ef4444" : "#22c55e" },
                  { label: "Warnings", value: totalWarnings,   color: totalWarnings ? "#f59e0b" : "#22c55e" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="flex flex-col gap-0.5">
                    <span className="text-[22px] font-black tabular-nums" style={{ color }}>{value}</span>
                    <span className="text-[11px] font-bold" style={{ color: "#988d9f" }}>{label}</span>
                  </div>
                ))}
              </div>
              {/* Action buttons */}
              <div className="flex flex-wrap gap-2 pt-2" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                <button onClick={copyResults}
                  className="btn-primary flex items-center gap-1.5 px-4 py-2 rounded-xl font-bold text-sm">
                  <span className="material-symbols-outlined text-[14px]">{copied ? "check" : "content_copy"}</span>
                  {copied ? "Copied!" : "Copy"}
                </button>
                <button onClick={exportJson}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl font-semibold text-sm transition-all"
                  style={{ background: "rgba(249,115,22,0.09)", color: ACCENT, border: "1px solid rgba(249,115,22,0.22)" }}>
                  <span className="material-symbols-outlined text-[13px]">data_object</span>JSON
                </button>
                <button onClick={exportTxt}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl font-semibold text-sm transition-all"
                  style={{ background: "rgba(255,255,255,0.04)", color: "#c8c0d0", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <span className="material-symbols-outlined text-[13px]">description</span>TXT
                </button>
                <button onClick={exportPdf}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl font-semibold text-sm transition-all"
                  style={{ background: "rgba(255,255,255,0.04)", color: "#c8c0d0", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <span className="material-symbols-outlined text-[13px]">print</span>PDF
                </button>
                <button onClick={reset}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl font-semibold text-sm transition-all ml-auto"
                  style={{ background: "rgba(255,255,255,0.03)", color: "#988d9f", border: "1px solid rgba(255,255,255,0.07)" }}>
                  <span className="material-symbols-outlined text-[13px]">restart_alt</span>Reset
                </button>
              </div>
            </div>
          </div>

          {/* Block tabs (if multiple) */}
          {blocks.length > 1 && (
            <div className="flex gap-2 flex-wrap">
              {blocks.map((b, i) => {
                const hasError = b.issues.some(iss => iss.severity === "error");
                const c = hasError ? "#ef4444" : b.score >= 71 ? "#22c55e" : "#f59e0b";
                return (
                  <button key={i} onClick={() => setActiveIdx(i)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-semibold transition-all"
                    style={activeIdx === i
                      ? { background: "rgba(249,115,22,0.12)", color: ACCENT, border: "1px solid rgba(249,115,22,0.3)" }
                      : { background: "rgba(255,255,255,0.03)", color: "#988d9f", border: "1px solid rgba(255,255,255,0.07)" }}>
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: c }} />
                    {b.type} {i + 1}
                  </button>
                );
              })}
            </div>
          )}

          {/* Active block detail */}
          {activeBlock && (
            <>
              {/* Issues */}
              <div className="glass-panel rounded-2xl p-5 flex flex-col gap-0"
                style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
                <div className="mb-3">
                  <PanelHeader icon="report" title={`${activeBlock.type} — Issues`}
                    badge={`${activeBlock.issues.length} issue${activeBlock.issues.length !== 1 ? "s" : ""}`} />
                </div>
                {activeBlock.issues.length === 0
                  ? (
                    <div className="flex items-center gap-2 py-4">
                      <span className="material-symbols-outlined text-[20px]" style={{ color: "#22c55e" }}>check_circle</span>
                      <p className="text-[13px]" style={{ color: "#22c55e" }}>No issues found — this schema block is valid.</p>
                    </div>
                  )
                  : activeBlock.issues.map((iss, i) => <IssueLine key={i} issue={iss} />)
                }
              </div>

              {/* Rich Results */}
              {activeBlock.richResults.length > 0 && (
                <div className="glass-panel rounded-2xl p-5 flex flex-col gap-0"
                  style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
                  <div className="mb-3"><PanelHeader icon="star" title="Google Rich Results Eligibility" /></div>
                  {activeBlock.richResults.map((rr, i) => <RichResultBadge key={i} rr={rr} />)}
                </div>
              )}

              {/* Parsed JSON */}
              {activeBlock.parsed && (
                <div className="glass-panel rounded-2xl p-5 flex flex-col gap-3"
                  style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
                  <div className="flex items-center justify-between">
                    <PanelHeader icon="code" title="Parsed Schema" />
                    <button onClick={() => setShowRaw(v => !v)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all"
                      style={{ background: "rgba(255,255,255,0.04)", color: "#988d9f", border: "1px solid rgba(255,255,255,0.07)" }}>
                      {showRaw ? "Collapse" : "Expand"}
                    </button>
                  </div>
                  {showRaw && <JsonHighlight json={JSON.stringify(activeBlock.parsed, null, 2)} />}
                  {!showRaw && (
                    <button onClick={() => setShowRaw(true)}
                      className="text-[12px] py-3 rounded-xl transition-all"
                      style={{ background: "rgba(255,255,255,0.03)", color: "#988d9f", border: "1px solid rgba(255,255,255,0.06)" }}>
                      Click to view syntax-highlighted JSON
                    </button>
                  )}
                </div>
              )}

              {/* Parse error raw */}
              {activeBlock.parseError && (
                <div className="glass-panel rounded-2xl p-5 flex flex-col gap-3"
                  style={{ border: "1px solid rgba(239,68,68,0.2)" }}>
                  <PanelHeader icon="code_off" title="Raw Input (parse failed)" />
                  <pre className="text-[11px] font-mono overflow-x-auto p-4 rounded-xl"
                    style={{ background: "rgba(239,68,68,0.05)", color: "#fca5a5", whiteSpace: "pre-wrap" }}>
                    {activeBlock.raw}
                  </pre>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* ── Empty state ───────────────────────────────────────────────────── */}
      {!blocks.length && !loading && (
        <div className="glass-panel rounded-2xl p-8 flex flex-col items-center gap-4 text-center"
          style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
          <span className="material-symbols-outlined text-[48px]" style={{ color: "#3d3345" }}>fact_check</span>
          <p className="text-[14px] font-semibold" style={{ color: "#988d9f" }}>Paste JSON-LD, enter a URL or upload an HTML file</p>
          <p className="text-[12px] max-w-md" style={{ color: "#3d3345" }}>
            Validates JSON-LD structured data for Schema.org compliance and Google Rich Results eligibility.
          </p>
          <div className="flex flex-wrap justify-center gap-2 mt-1">
            {["JSON Syntax", "Required Fields", "Invalid URLs", "Invalid Dates", "Rich Results", "Score 0–100"].map(f => (
              <span key={f} className="text-[11px] font-semibold px-3 py-1 rounded-full"
                style={{ background: "rgba(249,115,22,0.07)", color: "#988d9f", border: "1px solid rgba(249,115,22,0.15)" }}>{f}</span>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
