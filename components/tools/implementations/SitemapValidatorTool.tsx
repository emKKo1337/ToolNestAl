"use client";

import { useState, useMemo, useCallback, useRef } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────
type SitemapType = "urlset" | "sitemapindex";
type IssueSeverity = "error" | "warning" | "info";

interface SitemapEntry {
  loc: string;
  lastmod?: string;
  changefreq?: string;
  priority?: string;
  // index entries
  isIndexEntry?: boolean;
}

interface Issue {
  severity: IssueSeverity;
  field?: string;
  message: string;
  fix?: string;
  count?: number;
}

interface FreqDist { [freq: string]: number }

interface ValidationResult {
  sitemapType: SitemapType;
  totalEntries: number;
  duplicateUrls: number;
  invalidUrls: number;
  missingLastmod: number;
  invalidLastmod: number;
  invalidPriority: number;
  invalidChangefreq: number;
  longUrls: number;
  httpsCount: number;
  httpCount: number;
  withLastmod: number;
  avgPriority: number | null;
  freqDist: FreqDist;
  entries: SitemapEntry[];
  issues: Issue[];
  score: number;
  recommendations: string[];
  hasHomepage: boolean;
  encoding: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────
const ACCENT = "#f97316";

const VALID_CHANGEFREQS = new Set(["always", "hourly", "daily", "weekly", "monthly", "yearly", "never"]);
const MAX_URL_LEN = 2048;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}(T[\d:.Z+\-]+)?$/;

// ── XML Parser (client-side using DOMParser) ──────────────────────────────────
function parseXml(xml: string): { doc: Document | null; error: string | null } {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, "application/xml");
    const parseError = doc.querySelector("parsererror");
    if (parseError) return { doc: null, error: parseError.textContent ?? "XML parse error" };
    return { doc, error: null };
  } catch (e) {
    return { doc: null, error: e instanceof Error ? e.message : "Unknown parse error" };
  }
}

function getText(el: Element, tag: string): string | undefined {
  return el.querySelector(tag)?.textContent?.trim() || undefined;
}

function validateSitemap(xml: string): ValidationResult {
  const issues: Issue[] = [];

  // Detect encoding declaration
  const encodingMatch = xml.match(/encoding=["']([^"']+)["']/i);
  const encoding = encodingMatch?.[1] ?? "UTF-8 (assumed)";

  const { doc, error: xmlError } = parseXml(xml);
  if (!doc || xmlError) {
    return {
      sitemapType: "urlset", totalEntries: 0, duplicateUrls: 0, invalidUrls: 0,
      missingLastmod: 0, invalidLastmod: 0, invalidPriority: 0, invalidChangefreq: 0,
      longUrls: 0, httpsCount: 0, httpCount: 0, withLastmod: 0, avgPriority: null,
      freqDist: {}, entries: [],
      issues: [{ severity: "error", message: `XML syntax error: ${xmlError}`, fix: "Fix the XML syntax — use a text editor or XML linter to identify the malformed element." }],
      score: 0, recommendations: ["Fix the XML syntax error before resubmitting."], hasHomepage: false, encoding,
    };
  }

  const root = doc.documentElement;
  const rootTag = root.tagName.toLowerCase().replace(/^[^:]+:/, "");
  const isSitemapIndex = rootTag === "sitemapindex";
  const sitemapType: SitemapType = isSitemapIndex ? "sitemapindex" : "urlset";

  // Check namespace
  const ns = root.getAttribute("xmlns") ?? "";
  if (!ns.includes("sitemaps.org")) {
    issues.push({ severity: "warning", field: "xmlns", message: 'Missing or incorrect namespace. Expected xmlns="http://www.sitemaps.org/schemas/sitemap/0.9".', fix: 'Add xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" to the root element.' });
  }

  const entryTag = isSitemapIndex ? "sitemap" : "url";
  const rawEntries = Array.from(doc.querySelectorAll(entryTag));

  if (rawEntries.length === 0) {
    issues.push({ severity: "error", message: `No <${entryTag}> entries found in the sitemap.`, fix: `Add at least one <${entryTag}> element with a <loc> child.` });
  }

  const entries: SitemapEntry[] = [];
  const locSet = new Set<string>();
  let dupCount = 0;
  let invalidUrlCount = 0;
  let missingLastmod = 0;
  let invalidLastmod = 0;
  let invalidPriority = 0;
  let invalidChangefreq = 0;
  let longUrls = 0;
  let httpsCount = 0;
  let httpCount = 0;
  let withLastmod = 0;
  let prioritySum = 0;
  let priorityCount = 0;
  const freqDist: FreqDist = {};
  let hasHomepage = false;

  for (const el of rawEntries) {
    const loc = getText(el, "loc") ?? "";
    const lastmod = getText(el, "lastmod");
    const changefreq = getText(el, "changefreq");
    const priority = getText(el, "priority");

    entries.push({ loc, lastmod, changefreq, priority, isIndexEntry: isSitemapIndex });

    // loc checks
    if (!loc) {
      issues.push({ severity: "error", field: "loc", message: "An entry is missing the required <loc> element.", fix: "Add a <loc> child element with a full absolute URL." });
      invalidUrlCount++;
      continue;
    }

    let parsedUrl: URL | null = null;
    try {
      parsedUrl = new URL(loc);
    } catch {
      issues.push({ severity: "error", field: "loc", message: `Invalid URL: "${loc.slice(0, 80)}".`, fix: "Ensure the URL is absolute (starts with http:// or https://) and properly encoded." });
      invalidUrlCount++;
      continue;
    }

    if (locSet.has(loc)) {
      dupCount++;
    } else {
      locSet.add(loc);
    }

    if (loc.length > MAX_URL_LEN) {
      longUrls++;
      issues.push({ severity: "warning", field: "loc", message: `URL exceeds ${MAX_URL_LEN} characters: "${loc.slice(0, 60)}…"`, fix: "Shorten the URL — Googlebot may ignore URLs over 2048 characters." });
    }

    if (parsedUrl.protocol === "https:") httpsCount++;
    else if (parsedUrl.protocol === "http:") httpCount++;

    // Homepage detection
    if (parsedUrl.pathname === "/" || parsedUrl.pathname === "") hasHomepage = true;

    // lastmod
    if (!lastmod) {
      missingLastmod++;
    } else {
      withLastmod++;
      if (!ISO_DATE_RE.test(lastmod)) {
        invalidLastmod++;
        issues.push({ severity: "error", field: "lastmod", message: `Invalid lastmod date "${lastmod}" — must be ISO 8601.`, fix: 'Use format "YYYY-MM-DD" or "YYYY-MM-DDTHH:MM:SSZ".' });
      }
    }

    // changefreq
    if (changefreq !== undefined) {
      if (!VALID_CHANGEFREQS.has(changefreq.toLowerCase())) {
        invalidChangefreq++;
        issues.push({ severity: "error", field: "changefreq", message: `Invalid changefreq "${changefreq}".`, fix: "Use one of: always, hourly, daily, weekly, monthly, yearly, never." });
      } else {
        freqDist[changefreq.toLowerCase()] = (freqDist[changefreq.toLowerCase()] ?? 0) + 1;
      }
    }

    // priority
    if (priority !== undefined) {
      const p = parseFloat(priority);
      if (isNaN(p) || p < 0 || p > 1) {
        invalidPriority++;
        issues.push({ severity: "error", field: "priority", message: `Invalid priority "${priority}" — must be a decimal between 0.0 and 1.0.`, fix: 'Set priority to a value like "0.5" (valid range: 0.0 to 1.0).' });
      } else {
        prioritySum += p;
        priorityCount++;
      }
    }
  }

  // Aggregate duplicate warning (one message for all)
  if (dupCount > 0) {
    issues.push({ severity: "error", field: "loc", message: `${dupCount} duplicate URL${dupCount > 1 ? "s" : ""} found.`, fix: "Remove duplicate <url> entries — search engines will only index one copy.", count: dupCount });
  }

  // HTTPS consistency
  if (httpCount > 0 && httpsCount > 0) {
    issues.push({ severity: "warning", message: `Mixed HTTP/HTTPS URLs: ${httpsCount} HTTPS and ${httpCount} HTTP.`, fix: "Use HTTPS for all URLs. HTTP URLs may be ignored by modern search engines." });
  } else if (httpCount > 0 && httpsCount === 0) {
    issues.push({ severity: "warning", message: `All ${httpCount} URLs use HTTP, not HTTPS.`, fix: "Migrate to HTTPS — it is a Google ranking factor and HTTP pages receive a demotion." });
  }

  // Missing lastmod (aggregate)
  if (missingLastmod > 0 && rawEntries.length > 0) {
    const pct = Math.round((missingLastmod / rawEntries.length) * 100);
    if (pct > 50) {
      issues.push({ severity: "warning", field: "lastmod", message: `${pct}% of entries (${missingLastmod}) are missing <lastmod>.`, fix: "Add <lastmod> to help search engines prioritise recently updated pages." });
    }
  }

  if (!hasHomepage && !isSitemapIndex && rawEntries.length > 0) {
    issues.push({ severity: "info", message: "The homepage (root URL /) does not appear in this sitemap.", fix: "Include your homepage in the sitemap — it is typically the most important page." });
  }

  if (rawEntries.length > 50000) {
    issues.push({ severity: "error", message: `Sitemap contains ${rawEntries.length.toLocaleString()} URLs — maximum is 50,000 per sitemap file.`, fix: "Split into multiple sitemaps and reference them from a Sitemap Index file." });
  }

  // Score
  const total = rawEntries.length || 1;
  let score = 100;
  if (xmlError) score = 0;
  score -= Math.min(30, dupCount * 5);
  score -= Math.min(30, invalidUrlCount * 10);
  score -= Math.min(20, invalidLastmod * 5);
  score -= Math.min(10, invalidPriority * 3);
  score -= Math.min(10, invalidChangefreq * 3);
  if (httpCount > 0 && httpsCount > 0) score -= 10;
  if (!ns.includes("sitemaps.org")) score -= 5;
  score = Math.max(0, Math.min(100, score));

  // Recommendations
  const recs: string[] = [];
  if (dupCount > 0)          recs.push(`Remove ${dupCount} duplicate URL${dupCount > 1 ? "s" : ""} to avoid wasting crawl budget.`);
  if (invalidUrlCount > 0)   recs.push(`Fix ${invalidUrlCount} invalid URL${invalidUrlCount > 1 ? "s" : ""} — crawlers cannot index malformed addresses.`);
  if (invalidLastmod > 0)    recs.push(`Correct ${invalidLastmod} lastmod date${invalidLastmod > 1 ? "s" : ""} to ISO 8601 format (YYYY-MM-DD).`);
  if (invalidPriority > 0)   recs.push(`Fix ${invalidPriority} priority value${invalidPriority > 1 ? "s" : ""} — must be a decimal between 0.0 and 1.0.`);
  if (invalidChangefreq > 0) recs.push(`Fix ${invalidChangefreq} changefreq value${invalidChangefreq > 1 ? "s" : ""} — only: always, hourly, daily, weekly, monthly, yearly, never.`);
  if (missingLastmod > total * 0.5) recs.push("Add <lastmod> to more entries so Googlebot can detect content freshness efficiently.");
  if (httpCount > 0)         recs.push("Migrate all HTTP URLs to HTTPS — it is a Google ranking signal.");
  if (!hasHomepage && !isSitemapIndex) recs.push("Add your homepage to the sitemap.");
  if (rawEntries.length > 50000) recs.push("Split this sitemap into multiple files (max 50,000 URLs each) and create a Sitemap Index.");
  if (recs.length === 0)     recs.push("Sitemap is valid — no issues detected. You are ready to submit to Google Search Console.");

  return {
    sitemapType,
    totalEntries: rawEntries.length,
    duplicateUrls: dupCount,
    invalidUrls: invalidUrlCount,
    missingLastmod,
    invalidLastmod,
    invalidPriority,
    invalidChangefreq,
    longUrls,
    httpsCount,
    httpCount,
    withLastmod,
    avgPriority: priorityCount > 0 ? Math.round((prioritySum / priorityCount) * 100) / 100 : null,
    freqDist,
    entries,
    issues,
    score,
    recommendations: recs,
    hasHomepage,
    encoding,
  };
}

// ── Sub-components ────────────────────────────────────────────────────────────
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

function StatCard({ icon, label, value, color }: { icon: string; label: string; value: string | number; color?: string }) {
  return (
    <div className="glass-panel rounded-2xl p-4 flex flex-col gap-1.5"
      style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
      <span className="material-symbols-outlined text-[20px]" style={{ color: color ?? ACCENT }}>{icon}</span>
      <p className="text-[22px] font-black tabular-nums leading-tight" style={{ color: "#e8dff0" }}>{value}</p>
      <p className="text-[11px] font-bold" style={{ color: "#988d9f" }}>{label}</p>
    </div>
  );
}

function IssueLine({ issue }: { issue: Issue }) {
  const c  = issue.severity === "error" ? "#ef4444" : issue.severity === "warning" ? "#f59e0b" : "#60a5fa";
  const ic = issue.severity === "error" ? "error" : issue.severity === "warning" ? "warning" : "info";
  return (
    <div className="flex items-start gap-2.5 py-2.5" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
      <span className="material-symbols-outlined text-[14px] mt-0.5 shrink-0" style={{ color: c }}>{ic}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          {issue.field && (
            <code className="text-[10px] px-1.5 py-0.5 rounded font-mono"
              style={{ background: "rgba(255,255,255,0.06)", color: "#e8dff0" }}>{`<${issue.field}>`}</code>
          )}
          <span className="text-[12px]" style={{ color: "#c8b89f" }}>{issue.message}</span>
        </div>
        {issue.fix && <p className="text-[11px] mt-1" style={{ color: "#60a5fa" }}>Fix: {issue.fix}</p>}
      </div>
      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md shrink-0 capitalize"
        style={{ background: `${c}18`, color: c }}>{issue.severity}</span>
    </div>
  );
}

type InputMode = "url" | "paste" | "upload";
type EntryFilter = "all" | "invalid" | "noLastmod" | "http";

// ── Main ──────────────────────────────────────────────────────────────────────
export default function SitemapValidatorTool() {
  const [mode,        setMode]        = useState<InputMode>("url");
  const [urlInput,    setUrlInput]    = useState("");
  const [xmlInput,    setXmlInput]    = useState("");
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState("");
  const [result,      setResult]      = useState<ValidationResult | null>(null);
  const [copied,      setCopied]      = useState(false);
  const [entryFilter, setEntryFilter] = useState<EntryFilter>("all");
  const [search,      setSearch]      = useState("");
  const [page,        setPage]        = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const PAGE_SIZE = 100;

  const scoreColor = result
    ? result.score >= 71 ? "#22c55e" : result.score >= 41 ? "#f59e0b" : "#ef4444"
    : "#988d9f";
  const scoreLabel = result
    ? result.score >= 71 ? "Valid" : result.score >= 41 ? "Needs work" : "Invalid"
    : "";

  const runValidation = useCallback((xml: string) => {
    const r = validateSitemap(xml);
    setResult(r);
    setEntryFilter("all");
    setSearch("");
    setPage(0);
  }, []);

  const validateUrl = useCallback(async () => {
    const trimmed = urlInput.trim();
    if (!trimmed) { setError("Please enter a sitemap URL."); return; }
    setError(""); setResult(null); setLoading(true);
    try {
      const encoded = encodeURIComponent(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
      const res = await fetch(`/api/fetch-sitemap?url=${encoded}`);
      const data = await res.json() as { xml?: string; error?: string };
      if (data.error) { setError(data.error); return; }
      if (!data.xml)  { setError("Empty response from server."); return; }
      runValidation(data.xml);
    } catch {
      setError("Network error — please try again.");
    } finally {
      setLoading(false);
    }
  }, [urlInput, runValidation]);

  const validatePaste = useCallback(() => {
    if (!xmlInput.trim()) { setError("Please paste XML content."); return; }
    setError(""); setResult(null);
    runValidation(xmlInput.trim());
  }, [xmlInput, runValidation]);

  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const xml = ev.target?.result as string;
      setError(""); setResult(null);
      runValidation(xml);
    };
    reader.readAsText(file);
    e.target.value = "";
  }, [runValidation]);

  const reset = useCallback(() => {
    setUrlInput(""); setXmlInput(""); setResult(null); setError(""); setEntryFilter("all"); setSearch(""); setPage(0);
  }, []);

  // Filtered entries
  const displayEntries = useMemo(() => {
    if (!result) return [];
    let entries = [...result.entries];
    if (entryFilter === "invalid") entries = entries.filter(e => {
      try { new URL(e.loc); return false; } catch { return true; }
    });
    if (entryFilter === "noLastmod") entries = entries.filter(e => !e.lastmod);
    if (entryFilter === "http") entries = entries.filter(e => e.loc.startsWith("http://"));
    if (search) {
      const q = search.toLowerCase();
      entries = entries.filter(e => e.loc.toLowerCase().includes(q));
    }
    return entries;
  }, [result, entryFilter, search]);

  const totalPages = Math.ceil(displayEntries.length / PAGE_SIZE);
  const pageEntries = displayEntries.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // ── Exports ───────────────────────────────────────────────────────────────
  const exportCsv = useCallback(() => {
    if (!result) return;
    const header = "URL,Last Modified,Change Frequency,Priority,Is HTTP";
    const rows = result.entries.map(e =>
      [e.loc, e.lastmod ?? "", e.changefreq ?? "", e.priority ?? "", e.loc.startsWith("http://") ? "yes" : "no"]
        .map(v => `"${v.replace(/"/g, '""')}"`)
        .join(",")
    ).join("\n");
    const blob = new Blob([`${header}\n${rows}`], { type: "text/csv" });
    const u = URL.createObjectURL(blob);
    Object.assign(document.createElement("a"), { href: u, download: "sitemap-validation.csv" }).click();
    URL.revokeObjectURL(u);
  }, [result]);

  const exportJson = useCallback(() => {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" });
    const u = URL.createObjectURL(blob);
    Object.assign(document.createElement("a"), { href: u, download: "sitemap-validation.json" }).click();
    URL.revokeObjectURL(u);
  }, [result]);

  const exportTxt = useCallback(() => {
    if (!result) return;
    const lines = [
      `Sitemap Validation Report`,
      `Type: ${result.sitemapType} | Score: ${result.score}/100 — ${scoreLabel}`,
      `Total URLs: ${result.totalEntries} | Duplicates: ${result.duplicateUrls} | Invalid: ${result.invalidUrls}`,
      `HTTPS: ${result.httpsCount} | HTTP: ${result.httpCount} | With lastmod: ${result.withLastmod}`,
      "",
      "=== ISSUES ===",
      ...result.issues.map(i => `[${i.severity.toUpperCase()}] ${i.field ? `<${i.field}>: ` : ""}${i.message}${i.fix ? ` — Fix: ${i.fix}` : ""}`),
      "",
      "=== RECOMMENDATIONS ===",
      ...result.recommendations,
      "",
      "=== ALL URLs ===",
      ...result.entries.map(e => `${e.loc}${e.lastmod ? ` | lastmod:${e.lastmod}` : ""}${e.priority ? ` | priority:${e.priority}` : ""}`),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const u = URL.createObjectURL(blob);
    Object.assign(document.createElement("a"), { href: u, download: "sitemap-validation.txt" }).click();
    URL.revokeObjectURL(u);
  }, [result, scoreLabel]);

  const exportPdf = useCallback(() => {
    if (!result) return;
    const issueRows = result.issues.map(i => {
      const c = i.severity === "error" ? "#dc2626" : i.severity === "warning" ? "#d97706" : "#2563eb";
      return `<tr><td style="color:${c};font-weight:700">${i.severity}</td><td>${i.field ? `&lt;${i.field}&gt;` : ""}</td><td>${i.message}</td><td style="font-size:11px;color:#555">${i.fix ?? ""}</td></tr>`;
    }).join("");
    const recHtml = result.recommendations.map(r => `<li>${r}</li>`).join("");
    const freqRows = Object.entries(result.freqDist).map(([f, c]) =>
      `<tr><td>${f}</td><td>${c}</td></tr>`
    ).join("");
    const urlRows = result.entries.slice(0, 500).map(e =>
      `<tr><td style="word-break:break-all;font-size:11px">${e.loc}</td><td>${e.lastmod ?? "—"}</td><td>${e.changefreq ?? "—"}</td><td>${e.priority ?? "—"}</td></tr>`
    ).join("");
    const html = `<!DOCTYPE html><html><head><title>Sitemap Validation</title>
<style>body{font-family:system-ui,sans-serif;max-width:960px;margin:2rem auto;color:#111;font-size:13px}
h1{font-size:18px}h2{font-size:14px;margin-top:20px;border-bottom:1px solid #ddd;padding-bottom:4px}
.score{font-size:34px;font-weight:900;color:${scoreColor}}
.chips{display:flex;gap:10px;flex-wrap:wrap;margin:8px 0}.chip{background:#f5f5f5;border-radius:6px;padding:4px 10px;font-size:12px}.chip b{display:block;font-size:16px}
table{width:100%;border-collapse:collapse;margin-top:8px}
th,td{text-align:left;padding:4px 6px;border-bottom:1px solid #eee;font-size:11px;vertical-align:top}
th{font-weight:700;color:#555;background:#fafafa}
</style></head><body>
<h1>Sitemap Validation Report</h1>
<div class="score">${result.score}<span style="font-size:15px;font-weight:400;color:#555"> / 100 — ${scoreLabel}</span></div>
<div class="chips">
<div class="chip"><b>${result.totalEntries.toLocaleString()}</b>Total URLs</div>
<div class="chip"><b style="color:${result.duplicateUrls > 0 ? "#dc2626" : "#16a34a"}">${result.duplicateUrls}</b>Duplicates</div>
<div class="chip"><b style="color:${result.invalidUrls > 0 ? "#dc2626" : "#16a34a"}">${result.invalidUrls}</b>Invalid</div>
<div class="chip"><b>${result.httpsCount}</b>HTTPS</div>
<div class="chip"><b style="color:${result.httpCount > 0 ? "#d97706" : "#16a34a"}">${result.httpCount}</b>HTTP</div>
<div class="chip"><b>${result.withLastmod}</b>With lastmod</div>
${result.avgPriority !== null ? `<div class="chip"><b>${result.avgPriority}</b>Avg Priority</div>` : ""}
</div>
${issueRows ? `<h2>Issues</h2><table><thead><tr><th>Level</th><th>Field</th><th>Message</th><th>Fix</th></tr></thead><tbody>${issueRows}</tbody></table>` : "<h2>Issues</h2><p style='color:#16a34a'>No issues — sitemap is valid.</p>"}
${freqRows ? `<h2>Change Frequency Distribution</h2><table><thead><tr><th>Frequency</th><th>Count</th></tr></thead><tbody>${freqRows}</tbody></table>` : ""}
<h2>Recommendations</h2><ul>${recHtml}</ul>
${urlRows ? `<h2>URLs (first 500)</h2><table><thead><tr><th>URL</th><th>lastmod</th><th>changefreq</th><th>priority</th></tr></thead><tbody>${urlRows}</tbody></table>` : ""}
</body></html>`;
    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); w.print(); }
  }, [result, scoreColor, scoreLabel]);

  const copyResults = useCallback(async () => {
    if (!result) return;
    const lines = [
      `Sitemap: ${result.sitemapType} | Score: ${result.score}/100`,
      `URLs: ${result.totalEntries} | Dupes: ${result.duplicateUrls} | Invalid: ${result.invalidUrls}`,
      ...result.recommendations,
    ];
    try { await navigator.clipboard.writeText(lines.join("\n")); } catch { /* blocked */ }
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  }, [result]);

  // ── Styles ────────────────────────────────────────────────────────────────
  const inputCls = "flex-1 rounded-xl px-3 py-2.5 text-[13px] outline-none transition-all bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] focus:border-[rgba(249,115,22,0.4)] text-[#e8dff0] placeholder-[#3d3345]";
  const tabActive   = { background: "rgba(249,115,22,0.12)", color: ACCENT, border: "1px solid rgba(249,115,22,0.3)" };
  const tabInactive = { background: "rgba(255,255,255,0.03)", color: "#988d9f", border: "1px solid rgba(255,255,255,0.07)" };

  return (
    <div className="mb-12 flex flex-col gap-6">

      {/* ── Input ─────────────────────────────────────────────────────── */}
      <div className="glass-panel rounded-2xl p-5 flex flex-col gap-4"
        style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
        <PanelHeader icon="checklist" title="Validate XML Sitemap" />

        {/* Mode tabs */}
        <div className="flex gap-2 flex-wrap">
          {([["url", "link", "Sitemap URL"], ["paste", "code", "Paste XML"], ["upload", "upload_file", "Upload File"]] as const).map(([m, icon, label]) => (
            <button key={m} onClick={() => { setMode(m); setError(""); }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-semibold transition-all"
              style={mode === m ? tabActive : tabInactive}>
              <span className="material-symbols-outlined text-[13px]">{icon}</span>{label}
            </button>
          ))}
        </div>

        {/* URL mode */}
        {mode === "url" && (
          <div className="flex gap-3 flex-wrap sm:flex-nowrap">
            <input type="url" value={urlInput} onChange={e => setUrlInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && validateUrl()}
              placeholder="https://example.com/sitemap.xml" aria-label="Sitemap URL"
              className={inputCls} />
            <button onClick={validateUrl} disabled={loading}
              className="btn-primary flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm shrink-0 disabled:opacity-60">
              <span className="material-symbols-outlined text-[15px]">{loading ? "hourglass_top" : "checklist"}</span>
              {loading ? "Fetching…" : "Validate"}
            </button>
          </div>
        )}

        {/* Paste mode */}
        {mode === "paste" && (
          <>
            <textarea value={xmlInput} onChange={e => setXmlInput(e.target.value)}
              placeholder={"<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">\n  <url>\n    <loc>https://example.com/</loc>\n    <lastmod>2024-01-01</lastmod>\n  </url>\n</urlset>"}
              rows={10} aria-label="Paste XML sitemap"
              className="w-full rounded-xl px-3 py-3 text-[12px] font-mono outline-none transition-all bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] focus:border-[rgba(249,115,22,0.4)] text-[#e8dff0] placeholder-[#3d3345] resize-y" />
            <div className="flex gap-3 justify-between flex-wrap">
              <button onClick={() => setXmlInput("")}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-semibold transition-all"
                style={tabInactive}>
                <span className="material-symbols-outlined text-[13px]">clear</span>Clear
              </button>
              <button onClick={validatePaste}
                className="btn-primary flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm">
                <span className="material-symbols-outlined text-[15px]">checklist</span>Validate Sitemap
              </button>
            </div>
          </>
        )}

        {/* Upload mode */}
        {mode === "upload" && (
          <>
            <input ref={fileRef} type="file" accept=".xml,.txt" onChange={handleFile} className="hidden" aria-label="Upload sitemap XML" />
            <button onClick={() => fileRef.current?.click()}
              className="w-full flex flex-col items-center gap-3 px-6 py-10 rounded-2xl transition-all cursor-pointer"
              style={{ border: "2px dashed rgba(249,115,22,0.3)", background: "rgba(249,115,22,0.04)" }}>
              <span className="material-symbols-outlined text-[48px]" style={{ color: ACCENT }}>upload_file</span>
              <div className="text-center">
                <p className="text-[13px] font-semibold" style={{ color: "#e8dff0" }}>Click to upload sitemap.xml</p>
                <p className="text-[11px] mt-1" style={{ color: "#3d3345" }}>Supports .xml and .txt — parsed entirely in your browser</p>
              </div>
            </button>
          </>
        )}

        {error && (
          <div className="flex items-start gap-2 px-4 py-3 rounded-xl"
            style={{ background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.2)" }}>
            <span className="material-symbols-outlined text-[15px] mt-0.5 shrink-0 text-red-400">error</span>
            <p className="text-[13px]" style={{ color: "#fca5a5" }}>{error}</p>
          </div>
        )}
      </div>

      {/* ── Results ──────────────────────────────────────────────────────── */}
      {result && (
        <>
          {/* Score + recommendations + actions */}
          <div className="glass-panel rounded-2xl p-5 flex flex-wrap items-start gap-6"
            style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
            {/* Gauge */}
            <div className="flex flex-col items-center gap-1.5 shrink-0">
              <div className="relative w-24 h-24">
                <svg width="96" height="96" viewBox="0 0 96 96" aria-label={`Score ${result.score}/100`}>
                  <circle cx="48" cy="48" r="40" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="7" />
                  <circle cx="48" cy="48" r="40" fill="none"
                    stroke={scoreColor} strokeWidth="7"
                    strokeDasharray={2 * Math.PI * 40}
                    strokeDashoffset={2 * Math.PI * 40 * (1 - result.score / 100)}
                    strokeLinecap="round" transform="rotate(-90 48 48)"
                    style={{ transition: "stroke-dashoffset 0.6s ease, stroke 0.4s ease" }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-[26px] font-black tabular-nums" style={{ color: scoreColor, lineHeight: 1 }}>{result.score}</span>
                  <span className="text-[9px] font-bold" style={{ color: scoreColor, opacity: 0.7 }}>/ 100</span>
                </div>
              </div>
              <span className="text-[11px] font-bold" style={{ color: scoreColor }}>{scoreLabel}</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold"
                style={{ background: "rgba(249,115,22,0.1)", color: ACCENT }}>
                {result.sitemapType === "sitemapindex" ? "Index" : "Urlset"}
              </span>
            </div>

            {/* Recommendations */}
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-bold mb-3" style={{ color: "#e8dff0" }}>Recommendations</p>
              <ul className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-1">
                {result.recommendations.map((rec, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="material-symbols-outlined text-[13px] mt-0.5 shrink-0" style={{ color: ACCENT }}>arrow_forward</span>
                    <span className="text-[12px] leading-relaxed" style={{ color: "#c8b89f" }}>{rec}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Buttons */}
            <div className="flex flex-wrap gap-2 w-full pt-4" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
              <button onClick={copyResults}
                className="btn-primary flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm">
                <span className="material-symbols-outlined text-[14px]">{copied ? "check" : "content_copy"}</span>
                {copied ? "Copied!" : "Copy Results"}
              </button>
              {[
                { label: "CSV", icon: "table_chart", fn: exportCsv, accent: true },
                { label: "JSON", icon: "data_object", fn: exportJson, accent: false },
                { label: "TXT",  icon: "description", fn: exportTxt,  accent: false },
                { label: "PDF",  icon: "print",       fn: exportPdf,  accent: false },
              ].map(({ label, icon, fn, accent }) => (
                <button key={label} onClick={fn}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all"
                  style={accent
                    ? { background: "rgba(249,115,22,0.09)", color: ACCENT, border: "1px solid rgba(249,115,22,0.22)" }
                    : { background: "rgba(255,255,255,0.04)", color: "#c8c0d0", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <span className="material-symbols-outlined text-[13px]">{icon}</span>{label}
                </button>
              ))}
              <button onClick={reset}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all ml-auto"
                style={{ background: "rgba(255,255,255,0.03)", color: "#988d9f", border: "1px solid rgba(255,255,255,0.07)" }}>
                <span className="material-symbols-outlined text-[13px]">restart_alt</span>Reset
              </button>
            </div>
          </div>

          {/* Stats cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard icon="link"        label="Total URLs"       value={result.totalEntries.toLocaleString()} color="#a78bfa" />
            <StatCard icon="content_copy" label="Duplicate URLs"  value={result.duplicateUrls} color={result.duplicateUrls > 0 ? "#ef4444" : "#22c55e"} />
            <StatCard icon="error"        label="Invalid URLs"    value={result.invalidUrls}    color={result.invalidUrls > 0 ? "#ef4444" : "#22c55e"} />
            <StatCard icon="https"        label="HTTPS URLs"      value={result.httpsCount}     color={result.httpCount === 0 ? "#22c55e" : "#f59e0b"} />
            <StatCard icon="calendar_today" label="With lastmod"  value={result.withLastmod}    color="#60a5fa" />
            <StatCard icon="schedule"     label="Missing lastmod" value={result.missingLastmod} color={result.missingLastmod > result.totalEntries * 0.5 ? "#f59e0b" : "#22c55e"} />
            {result.avgPriority !== null && <StatCard icon="star" label="Avg Priority" value={result.avgPriority} color="#f59e0b" />}
            <StatCard icon="code"         label="Encoding"        value={result.encoding}       color="#988d9f" />
          </div>

          {/* Issues panel */}
          <div className="glass-panel rounded-2xl p-5 flex flex-col gap-0"
            style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
            <div className="mb-3">
              <PanelHeader icon="report" title="Validation Issues"
                badge={`${result.issues.length} issue${result.issues.length !== 1 ? "s" : ""}`} />
            </div>
            {result.issues.length === 0
              ? (
                <div className="flex items-center gap-2 py-4">
                  <span className="material-symbols-outlined text-[20px]" style={{ color: "#22c55e" }}>check_circle</span>
                  <p className="text-[13px]" style={{ color: "#22c55e" }}>No issues found — this sitemap is valid.</p>
                </div>
              )
              : result.issues.map((iss, i) => <IssueLine key={i} issue={iss} />)
            }
          </div>

          {/* Change frequency distribution */}
          {Object.keys(result.freqDist).length > 0 && (
            <div className="glass-panel rounded-2xl p-5 flex flex-col gap-3"
              style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
              <PanelHeader icon="bar_chart" title="Change Frequency Distribution" />
              <div className="flex flex-wrap gap-2">
                {Object.entries(result.freqDist)
                  .sort(([, a], [, b]) => b - a)
                  .map(([freq, count]) => (
                    <div key={freq} className="flex flex-col items-center gap-1 px-4 py-3 rounded-xl"
                      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", minWidth: "80px" }}>
                      <span className="text-[18px] font-black tabular-nums" style={{ color: ACCENT }}>{count}</span>
                      <span className="text-[11px] font-semibold capitalize" style={{ color: "#988d9f" }}>{freq}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* URL table */}
          {result.entries.length > 0 && (
            <div className="glass-panel rounded-2xl overflow-hidden"
              style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
              <div className="px-5 py-4 flex flex-wrap gap-3 items-center"
                style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="flex-1">
                  <PanelHeader icon="table_view" title={result.sitemapType === "sitemapindex" ? "Sitemap Index Entries" : "URL Entries"}
                    badge={`${displayEntries.length} shown`} />
                </div>
              </div>
              <div className="px-5 py-3 flex flex-wrap gap-2 items-center"
                style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                {([
                  ["all", "All"],
                  ["invalid", "Invalid"],
                  ["noLastmod", "No lastmod"],
                  ["http", "HTTP only"],
                ] as [EntryFilter, string][]).map(([f, label]) => (
                  <button key={f} onClick={() => { setEntryFilter(f); setPage(0); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-semibold transition-all"
                    style={entryFilter === f ? tabActive : tabInactive}>
                    {label}
                  </button>
                ))}
                <input value={search} onChange={e => { setSearch(e.target.value); setPage(0); }}
                  placeholder="Search URLs…" aria-label="Search URLs"
                  className="ml-auto rounded-lg px-3 py-1.5 text-[12px] outline-none bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] focus:border-[rgba(249,115,22,0.4)] text-[#e8dff0] placeholder-[#3d3345] w-40" />
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[600px]">
                  <thead>
                    <tr style={{ background: "rgba(255,255,255,0.02)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                      {["URL", "lastmod", "changefreq", "priority"].map(h => (
                        <th key={h} className="text-left px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider" style={{ color: "#988d9f" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pageEntries.map((entry, i) => {
                      let isInvalid = false;
                      try { new URL(entry.loc); } catch { isInvalid = true; }
                      const isHttp = entry.loc.startsWith("http://");
                      return (
                        <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
                          className="hover:bg-[rgba(255,255,255,0.015)] transition-colors">
                          <td className="px-3 py-2.5 max-w-xs">
                            <a href={isInvalid ? undefined : entry.loc} target="_blank" rel="noopener noreferrer"
                              className={`text-[11px] font-mono truncate block ${!isInvalid ? "hover:underline" : ""}`}
                              style={{ color: isInvalid ? "#ef4444" : isHttp ? "#f59e0b" : "#e8dff0", maxWidth: "40ch" }}
                              title={entry.loc}>
                              {entry.loc.replace(/^https?:\/\//, "").slice(0, 55)}{entry.loc.length > 60 ? "…" : ""}
                            </a>
                          </td>
                          <td className="px-3 py-2.5">
                            <span className="text-[11px] font-mono" style={{ color: entry.lastmod ? "#e8dff0" : "#3d3345" }}>
                              {entry.lastmod ?? "—"}
                            </span>
                          </td>
                          <td className="px-3 py-2.5">
                            <span className="text-[11px] capitalize" style={{ color: entry.changefreq ? "#a78bfa" : "#3d3345" }}>
                              {entry.changefreq ?? "—"}
                            </span>
                          </td>
                          <td className="px-3 py-2.5">
                            <span className="text-[11px] tabular-nums" style={{ color: entry.priority ? ACCENT : "#3d3345" }}>
                              {entry.priority ?? "—"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-5 py-3"
                  style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                  <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all disabled:opacity-40"
                    style={tabInactive}>
                    <span className="material-symbols-outlined text-[14px]">chevron_left</span>Prev
                  </button>
                  <span className="text-[11px]" style={{ color: "#988d9f" }}>
                    Page {page + 1} of {totalPages} ({displayEntries.length.toLocaleString()} entries)
                  </span>
                  <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all disabled:opacity-40"
                    style={tabInactive}>
                    Next<span className="material-symbols-outlined text-[14px]">chevron_right</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ── Empty state ───────────────────────────────────────────────── */}
      {!result && !loading && (
        <div className="glass-panel rounded-2xl p-8 flex flex-col items-center gap-4 text-center"
          style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
          <span className="material-symbols-outlined text-[48px]" style={{ color: "#3d3345" }}>checklist</span>
          <p className="text-[14px] font-semibold" style={{ color: "#988d9f" }}>Enter a sitemap URL, paste XML or upload a file</p>
          <p className="text-[12px] max-w-md" style={{ color: "#3d3345" }}>
            Validates sitemap.xml files against the official Sitemap Protocol — detects XML errors, invalid URLs, date format issues, duplicates and HTTPS consistency.
          </p>
          <div className="flex flex-wrap justify-center gap-2 mt-1">
            {["XML Syntax", "URL Validation", "Duplicate URLs", "lastmod Dates", "Sitemap Index", "Score 0–100"].map(f => (
              <span key={f} className="text-[11px] font-semibold px-3 py-1 rounded-full"
                style={{ background: "rgba(249,115,22,0.07)", color: "#988d9f", border: "1px solid rgba(249,115,22,0.15)" }}>{f}</span>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
