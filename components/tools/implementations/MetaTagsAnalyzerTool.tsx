"use client";

import { useState, useMemo, useCallback } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────
interface AnalysisResult {
  url: string;
  fetchedAt: string;
  basic: {
    title: string;
    description: string;
    canonical: string;
    robots: string;
    charset: string;
    viewport: string;
  };
  og: {
    title: string;
    description: string;
    image: string;
    url: string;
    type: string;
    siteName: string;
    locale: string;
  };
  twitter: {
    card: string;
    title: string;
    description: string;
    image: string;
    site: string;
    creator: string;
  };
  headings: { h1: number; h2: number; h3: number };
  images: { total: number; missingAlt: number };
  links: { internal: number; external: number };
  indexing: { canonicalFound: boolean; robotsTxtFound: boolean; sitemapFound: boolean };
}

interface Recommendation { level: "error" | "warning" | "info"; text: string; }

// ── Score calculation ─────────────────────────────────────────────────────────
function calcScore(r: AnalysisResult): { score: number; recommendations: Recommendation[] } {
  const recs: Recommendation[] = [];
  let score = 0;

  // Title (20pts)
  if (!r.basic.title) {
    recs.push({ level: "error",   text: "Page is missing a <title> tag — critical for SEO and SERP click-through rate." });
  } else if (r.basic.title.length < 10) {
    score += 8;
    recs.push({ level: "warning", text: `Title is too short (${r.basic.title.length} chars). Aim for 30–60 characters.` });
  } else if (r.basic.title.length > 60) {
    score += 14;
    recs.push({ level: "warning", text: `Title is too long (${r.basic.title.length} chars). Google truncates titles above ~60 characters.` });
  } else {
    score += 20;
    recs.push({ level: "info",    text: `Title length is good (${r.basic.title.length} chars).` });
  }

  // Description (20pts)
  if (!r.basic.description) {
    recs.push({ level: "error",   text: "Meta description is missing — add one to improve click-through rate from search results." });
  } else if (r.basic.description.length < 50) {
    score += 8;
    recs.push({ level: "warning", text: `Description is too short (${r.basic.description.length} chars). Aim for 120–160 characters.` });
  } else if (r.basic.description.length > 160) {
    score += 14;
    recs.push({ level: "warning", text: `Description is too long (${r.basic.description.length} chars). Google truncates descriptions above ~160 characters.` });
  } else {
    score += 20;
    recs.push({ level: "info",    text: `Description length is good (${r.basic.description.length} chars).` });
  }

  // Canonical (10pts)
  if (!r.basic.canonical) {
    recs.push({ level: "warning", text: "No canonical URL found — add one to prevent duplicate-content issues." });
  } else {
    score += 10;
  }

  // Open Graph (15pts)
  const ogCount = [r.og.title, r.og.description, r.og.image, r.og.url].filter(Boolean).length;
  if (ogCount === 0) {
    recs.push({ level: "warning", text: "Open Graph tags are missing — add og:title, og:description and og:image for better social sharing." });
  } else if (ogCount < 3) {
    score += 7;
    recs.push({ level: "warning", text: `Incomplete Open Graph tags (${ogCount}/4 core properties). Add og:title, og:description, og:image and og:url.` });
  } else {
    score += 15;
    recs.push({ level: "info",    text: "Open Graph tags are complete." });
  }

  // Twitter Cards (10pts)
  if (!r.twitter.card) {
    recs.push({ level: "info",    text: "Twitter Card tags are missing — add twitter:card, twitter:title, twitter:description and twitter:image." });
  } else {
    score += 10;
    recs.push({ level: "info",    text: `Twitter Card type: ${r.twitter.card}.` });
  }

  // Robots (5pts)
  if (!r.basic.robots) {
    score += 3;
    recs.push({ level: "info",    text: "No robots meta tag found — search engines default to index, follow." });
  } else if (/noindex/i.test(r.basic.robots)) {
    recs.push({ level: "error",   text: `Robots meta is set to "${r.basic.robots}" — this page will not be indexed.` });
  } else {
    score += 5;
  }

  // Viewport (5pts)
  if (!r.basic.viewport) {
    recs.push({ level: "warning", text: "Viewport meta tag is missing — add it for mobile-friendliness." });
  } else {
    score += 5;
  }

  // Charset (5pts)
  if (!r.basic.charset) {
    recs.push({ level: "info",    text: "Charset declaration not found in <head>." });
  } else {
    score += 5;
  }

  // H1 (5pts)
  if (r.headings.h1 === 0) {
    recs.push({ level: "warning", text: "No H1 heading found — every page should have exactly one H1." });
  } else if (r.headings.h1 > 1) {
    score += 2;
    recs.push({ level: "warning", text: `${r.headings.h1} H1 headings found — use exactly one H1 per page.` });
  } else {
    score += 5;
  }

  // Images alt (5pts)
  if (r.images.total > 0 && r.images.missingAlt > 0) {
    const ratio = r.images.missingAlt / r.images.total;
    score += Math.round(5 * (1 - ratio));
    recs.push({ level: "warning", text: `${r.images.missingAlt} of ${r.images.total} images are missing alt attributes.` });
  } else if (r.images.total > 0) {
    score += 5;
    recs.push({ level: "info",    text: `All ${r.images.total} images have alt attributes.` });
  }

  return { score: Math.min(100, Math.max(0, score)), recommendations: recs };
}

// ── Constants ─────────────────────────────────────────────────────────────────
const ACCENT = "#f97316";

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

function StatusIcon({ ok, warn }: { ok: boolean; warn?: boolean }) {
  const color = ok ? "#22c55e" : warn ? "#f59e0b" : "#ef4444";
  const icon  = ok ? "check_circle" : warn ? "warning" : "cancel";
  return <span className="material-symbols-outlined text-[16px] shrink-0" style={{ color }}>{icon}</span>;
}

function MetaRow({ label, value, hint, status }: { label: string; value?: string; hint?: string; status?: "ok" | "warn" | "error" }) {
  const hasValue = !!value;
  return (
    <div className="flex flex-col gap-0.5 py-2.5" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
      <div className="flex items-start gap-2">
        <span className="text-[11px] font-bold shrink-0 w-36" style={{ color: "#988d9f" }}>{label}</span>
        {status && (
          <StatusIcon
            ok={status === "ok"}
            warn={status === "warn"}
          />
        )}
        <p className="text-[12px] font-mono break-all flex-1 leading-relaxed"
          style={{ color: hasValue ? "#e8dff0" : "#3d3345" }}>
          {value || "— not found —"}
        </p>
      </div>
      {hint && <p className="text-[11px] ml-38 pl-6" style={{ color: "#3d3345" }}>{hint}</p>}
    </div>
  );
}

function StatCard({ icon, label, value, color, sub }: { icon: string; label: string; value: number | string; color: string; sub?: string }) {
  return (
    <div className="flex flex-col gap-1.5 p-4 rounded-xl" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
      <span className="material-symbols-outlined text-[20px]" style={{ color }}>{icon}</span>
      <p className="text-[22px] font-black tabular-nums" style={{ color: "#e8dff0" }}>{value}</p>
      <p className="text-[11px] font-bold" style={{ color: "#988d9f" }}>{label}</p>
      {sub && <p className="text-[10px]" style={{ color: "#3d3345" }}>{sub}</p>}
    </div>
  );
}

function IndexingBadge({ found, label }: { found: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 px-4 py-3 rounded-xl flex-1 min-w-[140px]"
      style={{ background: found ? "rgba(34,197,94,0.07)" : "rgba(239,68,68,0.06)", border: `1px solid ${found ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.18)"}` }}>
      <span className="material-symbols-outlined text-[15px]" style={{ color: found ? "#22c55e" : "#ef4444" }}>
        {found ? "check_circle" : "cancel"}
      </span>
      <span className="text-[12px] font-bold" style={{ color: found ? "#22c55e" : "#ef4444" }}>{label}</span>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function MetaTagsAnalyzerTool() {
  const [url,     setUrl]     = useState("");
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");
  const [result,  setResult]  = useState<AnalysisResult | null>(null);
  const [copied,  setCopied]  = useState(false);

  const { score, recommendations } = useMemo(
    () => result ? calcScore(result) : { score: 0, recommendations: [] },
    [result],
  );

  const scoreColor = score >= 71 ? "#22c55e" : score >= 41 ? "#f59e0b" : "#ef4444";
  const scoreLabel = score >= 71 ? "Good" : score >= 41 ? "Needs work" : "Poor";
  const circ = 2 * Math.PI * 34;

  const analyze = useCallback(async () => {
    const trimmed = url.trim();
    if (!trimmed) { setError("Please enter a URL."); return; }
    setError(""); setLoading(true); setResult(null);
    try {
      const encoded = encodeURIComponent(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
      const res = await fetch(`/api/analyze-meta?url=${encoded}`);
      const data = await res.json() as AnalysisResult & { error?: string };
      if (data.error) { setError(data.error); }
      else { setResult(data); }
    } catch {
      setError("Network error — please try again.");
    } finally {
      setLoading(false);
    }
  }, [url]);

  const handleKey = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") analyze();
  }, [analyze]);

  const reset = useCallback(() => {
    setUrl(""); setResult(null); setError(""); setCopied(false);
  }, []);

  // ── Export helpers ──────────────────────────────────────────────────────────
  const exportJson = useCallback(() => {
    if (!result) return;
    const blob = new Blob([JSON.stringify({ ...result, score, recommendations }, null, 2)], { type: "application/json" });
    const u = URL.createObjectURL(blob);
    Object.assign(document.createElement("a"), { href: u, download: "seo-analysis.json" }).click();
    URL.revokeObjectURL(u);
  }, [result, score, recommendations]);

  const exportTxt = useCallback(() => {
    if (!result) return;
    const lines: string[] = [
      `SEO Meta Tag Analysis — ${result.url}`,
      `Analyzed: ${new Date(result.fetchedAt).toLocaleString()}`,
      `Overall Score: ${score}/100 (${scoreLabel})`,
      "",
      "=== BASIC SEO ===",
      `Title: ${result.basic.title || "missing"}`,
      `Title Length: ${result.basic.title.length}`,
      `Description: ${result.basic.description || "missing"}`,
      `Description Length: ${result.basic.description.length}`,
      `Canonical: ${result.basic.canonical || "missing"}`,
      `Robots: ${result.basic.robots || "not set"}`,
      `Charset: ${result.basic.charset || "not found"}`,
      `Viewport: ${result.basic.viewport || "missing"}`,
      "",
      "=== OPEN GRAPH ===",
      `og:title: ${result.og.title || "missing"}`,
      `og:description: ${result.og.description || "missing"}`,
      `og:image: ${result.og.image || "missing"}`,
      `og:url: ${result.og.url || "missing"}`,
      `og:type: ${result.og.type || "missing"}`,
      `og:site_name: ${result.og.siteName || "missing"}`,
      "",
      "=== TWITTER CARDS ===",
      `twitter:card: ${result.twitter.card || "missing"}`,
      `twitter:title: ${result.twitter.title || "missing"}`,
      `twitter:description: ${result.twitter.description || "missing"}`,
      `twitter:image: ${result.twitter.image || "missing"}`,
      "",
      "=== HEADINGS ===",
      `H1: ${result.headings.h1}`,
      `H2: ${result.headings.h2}`,
      `H3: ${result.headings.h3}`,
      "",
      "=== IMAGES ===",
      `Total: ${result.images.total}`,
      `Missing ALT: ${result.images.missingAlt}`,
      "",
      "=== LINKS ===",
      `Internal: ${result.links.internal}`,
      `External: ${result.links.external}`,
      "",
      "=== INDEXING ===",
      `Canonical Found: ${result.indexing.canonicalFound}`,
      `Robots.txt Found: ${result.indexing.robotsTxtFound}`,
      `Sitemap Found: ${result.indexing.sitemapFound}`,
      "",
      "=== RECOMMENDATIONS ===",
      ...recommendations.map(r => `[${r.level.toUpperCase()}] ${r.text}`),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const u = URL.createObjectURL(blob);
    Object.assign(document.createElement("a"), { href: u, download: "seo-analysis.txt" }).click();
    URL.revokeObjectURL(u);
  }, [result, score, scoreLabel, recommendations]);

  const copyResults = useCallback(async () => {
    if (!result) return;
    const text = [
      `SEO Score: ${score}/100`,
      `Title: ${result.basic.title || "missing"}`,
      `Description: ${result.basic.description || "missing"}`,
      `Canonical: ${result.basic.canonical || "missing"}`,
      `OG Tags: ${[result.og.title, result.og.description, result.og.image].filter(Boolean).length}/3`,
      `Twitter Card: ${result.twitter.card || "missing"}`,
      `H1s: ${result.headings.h1}`,
      `Images missing alt: ${result.images.missingAlt}/${result.images.total}`,
    ].join("\n");
    try { await navigator.clipboard.writeText(text); } catch { /* blocked */ }
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  }, [result, score]);

  const exportPdf = useCallback(() => {
    if (!result) return;
    const html = `<!DOCTYPE html><html><head><title>SEO Report — ${result.url}</title>
<style>body{font-family:system-ui,sans-serif;max-width:800px;margin:2rem auto;color:#111;font-size:14px}
h1{font-size:20px;margin-bottom:4px}h2{font-size:15px;margin-top:24px;border-bottom:1px solid #ddd;padding-bottom:4px}
.score{font-size:36px;font-weight:900;color:${scoreColor}}
table{width:100%;border-collapse:collapse;margin-top:8px}
td,th{text-align:left;padding:5px 8px;border-bottom:1px solid #eee;font-size:13px}
th{font-weight:600;color:#555;width:180px}
.ok{color:#16a34a}.warn{color:#ca8a04}.err{color:#dc2626}
.rec{padding:4px 8px;border-radius:4px;margin-bottom:4px;font-size:13px}
.rec-error{background:#fee2e2;color:#991b1b}.rec-warning{background:#fef9c3;color:#854d0e}.rec-info{background:#eff6ff;color:#1e40af}
</style></head><body>
<h1>SEO Meta Tag Analysis</h1>
<p style="color:#555">${result.url} &mdash; ${new Date(result.fetchedAt).toLocaleString()}</p>
<div class="score">${score}<span style="font-size:16px;font-weight:400;color:#555">/100 ${scoreLabel}</span></div>
<h2>Basic SEO</h2><table>
<tr><th>Title</th><td>${result.basic.title || "<em>missing</em>"}</td></tr>
<tr><th>Title Length</th><td>${result.basic.title.length} chars</td></tr>
<tr><th>Description</th><td>${result.basic.description || "<em>missing</em>"}</td></tr>
<tr><th>Description Length</th><td>${result.basic.description.length} chars</td></tr>
<tr><th>Canonical</th><td>${result.basic.canonical || "<em>missing</em>"}</td></tr>
<tr><th>Robots</th><td>${result.basic.robots || "not set"}</td></tr>
<tr><th>Charset</th><td>${result.basic.charset || "not found"}</td></tr>
<tr><th>Viewport</th><td>${result.basic.viewport || "<em>missing</em>"}</td></tr>
</table>
<h2>Open Graph</h2><table>
<tr><th>og:title</th><td>${result.og.title || "<em>missing</em>"}</td></tr>
<tr><th>og:description</th><td>${result.og.description || "<em>missing</em>"}</td></tr>
<tr><th>og:image</th><td>${result.og.image || "<em>missing</em>"}</td></tr>
<tr><th>og:url</th><td>${result.og.url || "<em>missing</em>"}</td></tr>
<tr><th>og:type</th><td>${result.og.type || "<em>missing</em>"}</td></tr>
<tr><th>og:site_name</th><td>${result.og.siteName || "<em>missing</em>"}</td></tr>
</table>
<h2>Twitter Cards</h2><table>
<tr><th>twitter:card</th><td>${result.twitter.card || "<em>missing</em>"}</td></tr>
<tr><th>twitter:title</th><td>${result.twitter.title || "<em>missing</em>"}</td></tr>
<tr><th>twitter:description</th><td>${result.twitter.description || "<em>missing</em>"}</td></tr>
<tr><th>twitter:image</th><td>${result.twitter.image || "<em>missing</em>"}</td></tr>
</table>
<h2>Page Structure</h2><table>
<tr><th>H1</th><td>${result.headings.h1}</td></tr>
<tr><th>H2</th><td>${result.headings.h2}</td></tr>
<tr><th>H3</th><td>${result.headings.h3}</td></tr>
<tr><th>Total Images</th><td>${result.images.total}</td></tr>
<tr><th>Missing ALT</th><td>${result.images.missingAlt}</td></tr>
<tr><th>Internal Links</th><td>${result.links.internal}</td></tr>
<tr><th>External Links</th><td>${result.links.external}</td></tr>
</table>
<h2>Recommendations</h2>
${recommendations.map(r => `<div class="rec rec-${r.level}">${r.text}</div>`).join("")}
</body></html>`;
    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); w.print(); }
  }, [result, score, scoreLabel, scoreColor, recommendations]);

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="mb-12 flex flex-col gap-6">

      {/* ── URL Input ─────────────────────────────────────── */}
      <div className="glass-panel rounded-2xl p-5 flex flex-col gap-4" style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
        <PanelHeader icon="manage_search" title="Analyze Website" />
        <div className="flex gap-3 flex-wrap sm:flex-nowrap">
          <input
            type="url"
            value={url}
            onChange={e => setUrl(e.target.value)}
            onKeyDown={handleKey}
            placeholder="https://example.com"
            aria-label="Website URL to analyze"
            className="flex-1 rounded-xl px-3 py-2.5 text-[13px] outline-none transition-all bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] focus:border-[rgba(249,115,22,0.4)] text-[#e8dff0] placeholder-[#3d3345]"
          />
          <button
            onClick={analyze}
            disabled={loading}
            aria-busy={loading}
            className="btn-primary flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm shrink-0 disabled:opacity-60"
          >
            <span className="material-symbols-outlined text-[16px]">{loading ? "hourglass_top" : "search"}</span>
            {loading ? "Analyzing…" : "Analyze"}
          </button>
        </div>
        {error && (
          <div className="flex items-start gap-2 px-4 py-3 rounded-xl" style={{ background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.2)" }}>
            <span className="material-symbols-outlined text-[15px] mt-0.5 shrink-0 text-red-400">error</span>
            <p className="text-[13px]" style={{ color: "#fca5a5" }}>{error}</p>
          </div>
        )}
        {loading && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: "rgba(249,115,22,0.06)", border: "1px solid rgba(249,115,22,0.15)" }}>
            <div className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin shrink-0" style={{ borderColor: `${ACCENT} transparent ${ACCENT} ${ACCENT}` }} />
            <p className="text-[13px]" style={{ color: ACCENT }}>Fetching and analyzing page — this may take a few seconds…</p>
          </div>
        )}
      </div>

      {/* ── Results ───────────────────────────────────────── */}
      {result && (() => {
        const titleLen = result.basic.title.length;
        const descLen  = result.basic.description.length;

        return (
          <>
            {/* Score + actions */}
            <div className="glass-panel rounded-2xl p-5 flex flex-wrap items-start gap-6" style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
              {/* Gauge */}
              <div className="flex flex-col items-center gap-1.5 shrink-0">
                <div className="relative w-24 h-24">
                  <svg width="96" height="96" viewBox="0 0 96 96" aria-label={`SEO score ${score} out of 100`}>
                    <circle cx="48" cy="48" r="40" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="7" />
                    <circle cx="48" cy="48" r="40" fill="none"
                      stroke={scoreColor} strokeWidth="7"
                      strokeDasharray={2 * Math.PI * 40}
                      strokeDashoffset={2 * Math.PI * 40 * (1 - score / 100)}
                      strokeLinecap="round" transform="rotate(-90 48 48)"
                      style={{ transition: "stroke-dashoffset 0.6s ease, stroke 0.4s ease" }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-[26px] font-black tabular-nums" style={{ color: scoreColor, lineHeight: 1 }}>{score}</span>
                    <span className="text-[9px] font-bold" style={{ color: scoreColor, opacity: 0.7 }}>/ 100</span>
                  </div>
                </div>
                <span className="text-[11px] font-bold" style={{ color: scoreColor }}>{scoreLabel}</span>
                <span className="text-[10px]" style={{ color: "#3d3345" }}>Overall Score</span>
              </div>

              {/* Recommendations */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                  <p className="text-[13px] font-bold" style={{ color: "#e8dff0" }}>Recommendations</p>
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ background: "rgba(255,255,255,0.05)", color: "#988d9f" }}>
                    {result.url}
                  </span>
                </div>
                <ul className="flex flex-col gap-2 max-h-52 overflow-y-auto pr-1">
                  {recommendations.map((rec, i) => {
                    const ic = rec.level === "error" ? "#ef4444" : rec.level === "warning" ? "#f59e0b" : "#60a5fa";
                    const ig = rec.level === "error" ? "error" : rec.level === "warning" ? "warning" : "info";
                    return (
                      <li key={i} className="flex items-start gap-2">
                        <span className="material-symbols-outlined text-[14px] mt-0.5 shrink-0" style={{ color: ic }}>{ig}</span>
                        <span className="text-[12px] leading-relaxed" style={{ color: "#c8b89f" }}>{rec.text}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>

              {/* Export actions */}
              <div className="flex flex-wrap gap-2 w-full pt-4" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                <button onClick={copyResults} className="btn-primary flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm">
                  <span className="material-symbols-outlined text-[15px]">{copied ? "check" : "content_copy"}</span>
                  {copied ? "Copied!" : "Copy Results"}
                </button>
                <button onClick={exportJson} className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all"
                  style={{ background: "rgba(249,115,22,0.09)", color: ACCENT, border: "1px solid rgba(249,115,22,0.22)" }}>
                  <span className="material-symbols-outlined text-[14px]">data_object</span>JSON
                </button>
                <button onClick={exportTxt} className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all"
                  style={{ background: "rgba(255,255,255,0.04)", color: "#c8c0d0", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <span className="material-symbols-outlined text-[14px]">description</span>TXT
                </button>
                <button onClick={exportPdf} className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all"
                  style={{ background: "rgba(255,255,255,0.04)", color: "#c8c0d0", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <span className="material-symbols-outlined text-[14px]">print</span>PDF Report
                </button>
                <button onClick={reset} className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all ml-auto"
                  style={{ background: "rgba(255,255,255,0.03)", color: "#988d9f", border: "1px solid rgba(255,255,255,0.07)" }}>
                  <span className="material-symbols-outlined text-[14px]">restart_alt</span>Reset
                </button>
              </div>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <StatCard icon="title"           label="Title Length"    value={`${titleLen}c`} color={titleLen >= 10 && titleLen <= 60 ? "#22c55e" : "#f59e0b"} sub={titleLen <= 60 ? "Optimal ≤60" : "Too long"} />
              <StatCard icon="description"     label="Desc Length"     value={`${descLen}c`}  color={descLen >= 120 && descLen <= 160 ? "#22c55e" : descLen > 0 ? "#f59e0b" : "#ef4444"} sub={descLen >= 120 && descLen <= 160 ? "Optimal" : "120–160 ideal"} />
              <StatCard icon="format_h1"       label="H1 Headings"     value={result.headings.h1} color={result.headings.h1 === 1 ? "#22c55e" : "#f59e0b"} sub="Ideal: exactly 1" />
              <StatCard icon="image"           label="Images"          value={result.images.total} color={ACCENT} sub={result.images.missingAlt > 0 ? `${result.images.missingAlt} missing alt` : "All have alt"} />
              <StatCard icon="link"            label="Internal Links"  value={result.links.internal} color="#60a5fa" />
              <StatCard icon="open_in_new"     label="External Links"  value={result.links.external} color="#a78bfa" />
            </div>

            {/* Indexing */}
            <div className="glass-panel rounded-2xl p-5 flex flex-col gap-4" style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
              <PanelHeader icon="find_in_page" title="Indexing Signals" />
              <div className="flex flex-wrap gap-3">
                <IndexingBadge found={result.indexing.canonicalFound}  label="Canonical Tag"  />
                <IndexingBadge found={result.indexing.robotsTxtFound}  label="robots.txt"     />
                <IndexingBadge found={result.indexing.sitemapFound}    label="sitemap.xml"    />
              </div>
            </div>

            {/* Basic SEO */}
            <div className="glass-panel rounded-2xl p-5 flex flex-col gap-0" style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
              <div className="mb-3">
                <PanelHeader icon="text_fields" title="Basic SEO" />
              </div>
              <MetaRow label="Title"       value={result.basic.title}       status={result.basic.title ? (titleLen <= 60 ? "ok" : "warn") : "error"} />
              <MetaRow label="Title Length" value={`${titleLen} characters`} status={titleLen >= 10 && titleLen <= 60 ? "ok" : "warn"} hint="Optimal: 30–60 characters" />
              <MetaRow label="Description" value={result.basic.description} status={result.basic.description ? (descLen <= 160 ? "ok" : "warn") : "error"} />
              <MetaRow label="Desc Length" value={result.basic.description ? `${descLen} characters` : undefined} status={descLen >= 120 && descLen <= 160 ? "ok" : "warn"} hint="Optimal: 120–160 characters" />
              <MetaRow label="Canonical"   value={result.basic.canonical}   status={result.basic.canonical ? "ok" : "warn"} />
              <MetaRow label="Robots"      value={result.basic.robots}      status={result.basic.robots ? (/noindex/i.test(result.basic.robots) ? "error" : "ok") : undefined} />
              <MetaRow label="Charset"     value={result.basic.charset}     status={result.basic.charset ? "ok" : "warn"} />
              <MetaRow label="Viewport"    value={result.basic.viewport}    status={result.basic.viewport ? "ok" : "warn"} />
            </div>

            {/* Open Graph */}
            <div className="glass-panel rounded-2xl p-5 flex flex-col gap-0" style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
              <div className="mb-3">
                <PanelHeader icon="share" title="Open Graph" badge={`${[result.og.title,result.og.description,result.og.image,result.og.url].filter(Boolean).length}/4 core`} />
              </div>
              <MetaRow label="og:title"       value={result.og.title}       status={result.og.title ? "ok" : "warn"} />
              <MetaRow label="og:description" value={result.og.description} status={result.og.description ? "ok" : "warn"} />
              <MetaRow label="og:image"       value={result.og.image}       status={result.og.image ? "ok" : "warn"} />
              <MetaRow label="og:url"         value={result.og.url}         status={result.og.url ? "ok" : "warn"} />
              <MetaRow label="og:type"        value={result.og.type} />
              <MetaRow label="og:site_name"   value={result.og.siteName} />
              <MetaRow label="og:locale"      value={result.og.locale} />
            </div>

            {/* Twitter Cards */}
            <div className="glass-panel rounded-2xl p-5 flex flex-col gap-0" style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
              <div className="mb-3">
                <PanelHeader icon="tag" title="Twitter / X Cards" badge={result.twitter.card ? "Found" : "Missing"} />
              </div>
              <MetaRow label="twitter:card"        value={result.twitter.card}        status={result.twitter.card ? "ok" : "warn"} />
              <MetaRow label="twitter:title"       value={result.twitter.title}       status={result.twitter.title ? "ok" : "warn"} />
              <MetaRow label="twitter:description" value={result.twitter.description} status={result.twitter.description ? "ok" : "warn"} />
              <MetaRow label="twitter:image"       value={result.twitter.image}       status={result.twitter.image ? "ok" : "warn"} />
              <MetaRow label="twitter:site"        value={result.twitter.site} />
              <MetaRow label="twitter:creator"     value={result.twitter.creator} />
            </div>

            {/* Headings + Images + Links */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="glass-panel rounded-2xl p-5 flex flex-col gap-3" style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
                <PanelHeader icon="format_list_bulleted" title="Headings" />
                {[["H1", result.headings.h1, result.headings.h1 === 1 ? "#22c55e" : "#f59e0b"],
                  ["H2", result.headings.h2, "#60a5fa"],
                  ["H3", result.headings.h3, "#a78bfa"]].map(([label, count, color]) => (
                  <div key={String(label)} className="flex items-center gap-3">
                    <span className="text-[11px] font-bold w-6 shrink-0" style={{ color: String(color) }}>{label}</span>
                    <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                      <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, (Number(count) / Math.max(1, result.headings.h1 + result.headings.h2 + result.headings.h3)) * 100)}%`, background: String(color) }} />
                    </div>
                    <span className="text-[13px] font-black tabular-nums w-6 text-right" style={{ color: "#e8dff0" }}>{count}</span>
                  </div>
                ))}
              </div>
              <div className="glass-panel rounded-2xl p-5 flex flex-col gap-3" style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
                <PanelHeader icon="image" title="Images" />
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[12px]" style={{ color: "#988d9f" }}>Total images</span>
                    <span className="text-[16px] font-black" style={{ color: "#e8dff0" }}>{result.images.total}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[12px]" style={{ color: "#988d9f" }}>Missing alt</span>
                    <span className="text-[16px] font-black" style={{ color: result.images.missingAlt > 0 ? "#f59e0b" : "#22c55e" }}>{result.images.missingAlt}</span>
                  </div>
                  {result.images.total > 0 && (
                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="text-[10px]" style={{ color: "#3d3345" }}>Alt coverage</span>
                        <span className="text-[10px]" style={{ color: "#988d9f" }}>{Math.round(((result.images.total - result.images.missingAlt) / result.images.total) * 100)}%</span>
                      </div>
                      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                        <div className="h-full rounded-full" style={{ width: `${((result.images.total - result.images.missingAlt) / result.images.total) * 100}%`, background: result.images.missingAlt === 0 ? "#22c55e" : "#f59e0b" }} />
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="glass-panel rounded-2xl p-5 flex flex-col gap-3" style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
                <PanelHeader icon="link" title="Links" />
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[12px]" style={{ color: "#988d9f" }}>Internal</span>
                    <span className="text-[16px] font-black" style={{ color: "#60a5fa" }}>{result.links.internal}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[12px]" style={{ color: "#988d9f" }}>External</span>
                    <span className="text-[16px] font-black" style={{ color: "#a78bfa" }}>{result.links.external}</span>
                  </div>
                  {(result.links.internal + result.links.external) > 0 && (
                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="text-[10px]" style={{ color: "#3d3345" }}>Internal ratio</span>
                        <span className="text-[10px]" style={{ color: "#988d9f" }}>{Math.round((result.links.internal / (result.links.internal + result.links.external)) * 100)}%</span>
                      </div>
                      <div className="h-1.5 rounded-full overflow-hidden flex" style={{ background: "rgba(255,255,255,0.06)" }}>
                        <div style={{ width: `${(result.links.internal / (result.links.internal + result.links.external)) * 100}%`, background: "#60a5fa" }} className="h-full rounded-l-full" />
                        <div style={{ flex: 1, background: "#a78bfa" }} className="h-full rounded-r-full" />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Analyzed timestamp */}
            <p className="text-center text-[11px]" style={{ color: "#3d3345" }}>
              Analyzed {new Date(result.fetchedAt).toLocaleString()} &mdash; {result.url}
            </p>
          </>
        );
      })()}

      {/* Empty state */}
      {!result && !loading && (
        <div className="glass-panel rounded-2xl p-8 flex flex-col items-center gap-4 text-center" style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
          <span className="material-symbols-outlined text-[48px]" style={{ color: "#3d3345" }}>manage_search</span>
          <p className="text-[14px] font-semibold" style={{ color: "#988d9f" }}>Enter a URL above and click Analyze</p>
          <p className="text-[12px] max-w-md" style={{ color: "#3d3345" }}>
            The analyzer fetches your page server-side and extracts every meta tag, Open Graph property, Twitter Card, heading, image and link — then scores your SEO health.
          </p>
          <div className="flex flex-wrap justify-center gap-2 mt-1">
            {["Title & Description", "Open Graph", "Twitter Cards", "Canonical", "Headings", "Images & Links"].map(f => (
              <span key={f} className="text-[11px] font-semibold px-3 py-1 rounded-full"
                style={{ background: "rgba(249,115,22,0.07)", color: "#988d9f", border: "1px solid rgba(249,115,22,0.15)" }}>{f}</span>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
