"use client";

/**
 * SERP Preview Tool
 *
 * Live Google-style desktop and mobile SERP previews with:
 *   - Pixel-accurate title truncation detection via Canvas measureText
 *   - SEO score (0–100) across title / description / URL
 *   - Metric bars showing optimal, warning and over-limit zones
 *   - Actionable recommendations
 *   - Copy HTML meta tags
 *   - Download .txt report
 *
 * No external libraries — fully client-side.
 */

import { useState, useMemo, useCallback, useEffect, useRef } from "react";

// ── Constants ─────────────────────────────────────────────────────────────────
const ACCENT = "#f97316";

// Google desktop title truncation ≈ 600px at 20px/600wt Arial
const TITLE_PX_LIMIT_DESKTOP = 600;
// Google mobile title ≈ slightly narrower
const TITLE_PX_LIMIT_MOBILE  = 480;

const TITLE_OPT_MIN  = 30;
const TITLE_OPT_MAX  = 60;
const TITLE_WARN_MAX = 70;

const DESC_OPT_MIN   = 120;
const DESC_OPT_MAX   = 160;
const DESC_WARN_MAX  = 200;

const URL_OPT_MAX    = 75;
const URL_WARN_MAX   = 100;

// ── Pixel measurement ─────────────────────────────────────────────────────────
// We measure once per title string using Canvas 2D measureText.
// Font approximates Google's SERP title rendering.
const TITLE_FONT = "600 20px Arial, sans-serif";
const measurePxRef: { canvas: HTMLCanvasElement | null } = { canvas: null };

function measureTitlePx(text: string): number {
  if (typeof window === "undefined" || !text) return 0;
  try {
    if (!measurePxRef.canvas) {
      measurePxRef.canvas = document.createElement("canvas");
    }
    const ctx = measurePxRef.canvas.getContext("2d")!;
    ctx.font = TITLE_FONT;
    return Math.round(ctx.measureText(text).width);
  } catch {
    return 0;
  }
}

function truncateToPixel(text: string, maxPx: number): string {
  if (typeof window === "undefined") return text;
  try {
    if (!measurePxRef.canvas) measurePxRef.canvas = document.createElement("canvas");
    const ctx = measurePxRef.canvas.getContext("2d")!;
    ctx.font = TITLE_FONT;
    if (ctx.measureText(text).width <= maxPx) return text;
    let s = text;
    while (s.length > 0 && ctx.measureText(s + "…").width > maxPx) {
      s = s.slice(0, -1);
    }
    return s.trimEnd() + "…";
  } catch {
    return text;
  }
}

// ── URL parsing for breadcrumb display ────────────────────────────────────────
function parseBreadcrumb(url: string): { domain: string; path: string } {
  if (!url) return { domain: "example.com", path: "" };
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    const parts = u.pathname.split("/").filter(Boolean);
    return {
      domain: u.hostname,
      path: parts.length > 0 ? " › " + parts.join(" › ") : "",
    };
  } catch {
    return { domain: url, path: "" };
  }
}

// ── SEO Score ─────────────────────────────────────────────────────────────────
interface Analysis {
  score: number;
  titleStatus: "missing" | "short" | "good" | "warn" | "long";
  descStatus:  "missing" | "short" | "ok" | "good" | "warn" | "long";
  urlStatus:   "missing" | "good" | "warn" | "long";
  titlePx: number;
  recs: string[];
}

function analyse(
  title: string,
  desc: string,
  url: string,
): Analysis {
  let score = 0;
  const recs: string[] = [];

  // Title (40 pts)
  let titleStatus: Analysis["titleStatus"];
  if (!title) {
    titleStatus = "missing";
    recs.push("Add a page title — it is the most important on-page SEO element.");
  } else if (title.length < TITLE_OPT_MIN) {
    titleStatus = "short";
    score += 10;
    recs.push(`Title is too short (${title.length} chars). Aim for ${TITLE_OPT_MIN}–${TITLE_OPT_MAX} characters.`);
  } else if (title.length <= TITLE_OPT_MAX) {
    titleStatus = "good";
    score += 40;
  } else if (title.length <= TITLE_WARN_MAX) {
    titleStatus = "warn";
    score += 22;
    recs.push(`Title is slightly long (${title.length} chars). Google may truncate above ${TITLE_OPT_MAX} chars.`);
  } else {
    titleStatus = "long";
    score += 5;
    recs.push(`Title is too long (${title.length} chars) — Google will truncate it. Keep it under ${TITLE_OPT_MAX} chars.`);
  }

  // Description (40 pts)
  let descStatus: Analysis["descStatus"];
  if (!desc) {
    descStatus = "missing";
    recs.push("Add a meta description — it directly affects click-through rate in search results.");
  } else if (desc.length < 50) {
    descStatus = "short";
    score += 5;
    recs.push(`Description is very short (${desc.length} chars). Aim for ${DESC_OPT_MIN}–${DESC_OPT_MAX} characters.`);
  } else if (desc.length < DESC_OPT_MIN) {
    descStatus = "ok";
    score += 20;
    recs.push(`Description could be longer (${desc.length} chars). Aim for ${DESC_OPT_MIN}–${DESC_OPT_MAX} characters.`);
  } else if (desc.length <= DESC_OPT_MAX) {
    descStatus = "good";
    score += 40;
  } else if (desc.length <= DESC_WARN_MAX) {
    descStatus = "warn";
    score += 22;
    recs.push(`Description is slightly long (${desc.length} chars). Google may truncate above ${DESC_OPT_MAX} chars.`);
  } else {
    descStatus = "long";
    score += 5;
    recs.push(`Description is too long (${desc.length} chars). Google typically shows up to ${DESC_OPT_MAX} chars.`);
  }

  // URL (20 pts)
  let urlStatus: Analysis["urlStatus"];
  if (!url) {
    urlStatus = "missing";
    recs.push("Enter a URL to complete the SERP preview.");
  } else if (url.length <= URL_OPT_MAX) {
    urlStatus = "good";
    score += 20;
  } else if (url.length <= URL_WARN_MAX) {
    urlStatus = "warn";
    score += 12;
    recs.push(`URL is long (${url.length} chars). Shorter URLs are easier to read in SERPs.`);
  } else {
    urlStatus = "long";
    score += 5;
    recs.push(`URL is very long (${url.length} chars). Consider using shorter, descriptive slugs.`);
  }

  const titlePx = measureTitlePx(title);

  return { score: Math.min(100, score), titleStatus, descStatus, urlStatus, titlePx, recs };
}

// ── Status helpers ────────────────────────────────────────────────────────────
function statusColor(s: string): string {
  if (s === "good")    return "#22c55e";
  if (s === "ok")      return "#60a5fa";
  if (s === "warn")    return "#f59e0b";
  if (s === "long" || s === "short" || s === "missing") return "#ef4444";
  return "#988d9f";
}
function statusLabel(s: string): string {
  if (s === "good")    return "Optimal";
  if (s === "ok")      return "Could be longer";
  if (s === "warn")    return "Slightly long";
  if (s === "long")    return "Too long";
  if (s === "short")   return "Too short";
  if (s === "missing") return "Missing";
  return "";
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }
function downloadText(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/plain" });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement("a"), { href: url, download: filename });
  a.click();
  URL.revokeObjectURL(url);
}

// ── Input / textarea shared styles ───────────────────────────────────────────
const inputCls =
  "w-full rounded-xl px-3 py-2.5 text-[13px] outline-none transition-all bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] focus:border-[rgba(249,115,22,0.4)] text-[#e8dff0] placeholder-[#3d3345]";

// ── Metric bar ────────────────────────────────────────────────────────────────
function MetricBar({
  label, value, max, optMin, optMax, warnMax, unit = "chars",
  status,
}: {
  label: string; value: number; max: number;
  optMin: number; optMax: number; warnMax: number;
  unit?: string; status: string;
}) {
  const pct   = clamp((value / max) * 100, 0, 100);
  const color = statusColor(status);
  const safeOptMin  = clamp((optMin  / max) * 100, 0, 100);
  const safeOptMax  = clamp((optMax  / max) * 100, 0, 100);
  const safeWarnMax = clamp((warnMax / max) * 100, 0, 100);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[12px] font-semibold" style={{ color: "#c8c0d0" }}>{label}</span>
        <div className="flex items-center gap-2">
          <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold"
            style={{ background: `${color}18`, color }}>{statusLabel(status)}</span>
          <span className="text-[12px] font-bold tabular-nums" style={{ color }}>{value} {unit}</span>
        </div>
      </div>
      {/* Track with zone shading */}
      <div className="relative h-2 rounded-full overflow-hidden"
        style={{ background: "rgba(255,255,255,0.07)" }}>
        {/* Green zone */}
        <div className="absolute top-0 bottom-0 rounded-full opacity-20"
          style={{ left: `${safeOptMin}%`, width: `${safeOptMax - safeOptMin}%`, background: "#22c55e" }} />
        {/* Progress fill */}
        <div className="absolute top-0 left-0 h-full rounded-full"
          style={{ width: `${pct}%`, background: color, transition: "width 0.25s ease, background 0.25s ease" }} />
      </div>
      {/* Zone labels */}
      <div className="flex text-[9px] font-semibold" style={{ color: "#2d2535" }}>
        <span style={{ flex: safeOptMin }}>0</span>
        <span style={{ flex: safeOptMax - safeOptMin, textAlign: "center", color: "#3d5c3d" }}>
          {optMin}–{optMax}
        </span>
        <span style={{ flex: 100 - safeWarnMax, textAlign: "right" }}>{max}</span>
      </div>
    </div>
  );
}

// ── Google favicon placeholder ────────────────────────────────────────────────
function FaviconEl({ src, domain }: { src: string; domain: string }) {
  const [errored, setErrored] = useState(false);
  const letter = (domain[0] ?? "G").toUpperCase();
  if (!src || errored) {
    return (
      <div className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0"
        style={{ background: "#4285f4", color: "#fff" }}>
        {letter}
      </div>
    );
  }
  return (
    <img src={src} alt="" width={16} height={16}
      className="w-4 h-4 rounded-sm shrink-0 object-contain"
      onError={() => setErrored(true)} />
  );
}

// ── Desktop SERP card ─────────────────────────────────────────────────────────
function DesktopResult({
  title, desc, url, favicon, titlePx,
}: {
  title: string; desc: string; url: string; favicon: string; titlePx: number;
}) {
  const { domain, path } = parseBreadcrumb(url);
  const [displayTitle, setDisplayTitle] = useState(title);
  const [truncated,    setTruncated]    = useState(false);

  useEffect(() => {
    const t = truncateToPixel(title || "Untitled page", TITLE_PX_LIMIT_DESKTOP);
    setDisplayTitle(t);
    setTruncated(t !== (title || "Untitled page") && !!title);
  }, [title]);

  const displayDesc = desc
    ? (desc.length > 200 ? desc.slice(0, 197) + "…" : desc)
    : "No meta description provided. Google will extract content from the page to use as a snippet.";

  return (
    <div className="rounded-xl p-5" style={{ background: "#fff", maxWidth: 620, fontFamily: "arial, sans-serif" }}>
      {/* Breadcrumb row */}
      <div className="flex items-center gap-1.5 mb-1">
        <FaviconEl src={favicon} domain={domain} />
        <div className="flex flex-col" style={{ lineHeight: 1 }}>
          <span className="text-[12px]" style={{ color: "#202124" }}>{domain}</span>
          <span className="text-[12px]" style={{ color: "#4d5156" }}>{domain}{path}</span>
        </div>
        <span className="ml-auto text-[20px] leading-none cursor-pointer" style={{ color: "#70757a" }}>⋮</span>
      </div>
      {/* Title */}
      <div className="text-[20px] font-normal mb-1 leading-snug"
        style={{ color: "#1a0dab", cursor: "pointer" }}>
        {displayTitle || <span style={{ color: "#bbb" }}>Page Title</span>}
        {truncated && (
          <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded"
            style={{ background: "#fff3cd", color: "#856404", verticalAlign: "middle" }}>
            TRUNCATED
          </span>
        )}
      </div>
      {/* Description */}
      <div className="text-[14px] leading-[1.58]"
        style={{ color: "#4d5156" }}>
        {displayDesc}
      </div>
    </div>
  );
}

// ── Mobile SERP card ──────────────────────────────────────────────────────────
function MobileResult({
  title, desc, url, favicon,
}: {
  title: string; desc: string; url: string; favicon: string;
}) {
  const { domain, path } = parseBreadcrumb(url);
  const [displayTitle, setDisplayTitle] = useState(title);
  const [truncated,    setTruncated]    = useState(false);

  useEffect(() => {
    const t = truncateToPixel(title || "Untitled page", TITLE_PX_LIMIT_MOBILE);
    setDisplayTitle(t);
    setTruncated(t !== (title || "Untitled page") && !!title);
  }, [title]);

  const displayDesc = desc
    ? (desc.length > 140 ? desc.slice(0, 137) + "…" : desc)
    : "No meta description — Google will extract a snippet from the page.";

  return (
    // Phone frame
    <div className="flex justify-center">
      <div className="relative rounded-[2.5rem] overflow-hidden border-[6px]"
        style={{ borderColor: "#2d2535", width: 320, background: "#fff" }}>
        {/* Status bar */}
        <div className="h-6 flex items-center px-5 justify-between"
          style={{ background: "#f8f9fa" }}>
          <span className="text-[10px]" style={{ color: "#202124" }}>9:41</span>
          <div className="flex gap-1">
            {["wifi", "signal_cellular_alt", "battery_5_bar"].map(i => (
              <span key={i} className="material-symbols-outlined text-[12px]" style={{ color: "#202124" }}>{i}</span>
            ))}
          </div>
        </div>
        {/* Search bar */}
        <div className="mx-3 my-2 px-3 py-2 rounded-full flex items-center gap-2"
          style={{ background: "#f1f3f4" }}>
          <span className="material-symbols-outlined text-[16px]" style={{ color: "#5f6368" }}>search</span>
          <span className="text-[12px]" style={{ color: "#5f6368", flex: 1 }}>search query…</span>
          <span className="text-[14px]" style={{ color: "#4285f4" }}>G</span>
        </div>
        {/* Result */}
        <div className="px-4 pb-4" style={{ fontFamily: "arial, sans-serif" }}>
          <div className="flex items-center gap-1.5 mb-0.5">
            <FaviconEl src={favicon} domain={domain} />
            <div>
              <div className="text-[11px]" style={{ color: "#202124" }}>{domain}</div>
              <div className="text-[10px]" style={{ color: "#70757a" }}>{domain}{path}</div>
            </div>
          </div>
          <div className="text-[16px] font-normal mb-1 leading-snug"
            style={{ color: "#1558d6" }}>
            {displayTitle || <span style={{ color: "#bbb" }}>Page Title</span>}
            {truncated && (
              <span className="ml-1.5 text-[9px] font-bold px-1 py-0.5 rounded"
                style={{ background: "#fff3cd", color: "#856404", verticalAlign: "middle" }}>
                TRUNCATED
              </span>
            )}
          </div>
          <div className="text-[12px] leading-relaxed" style={{ color: "#4d5156" }}>
            {displayDesc}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function SerpPreviewTool() {
  const [title,   setTitle]   = useState("");
  const [desc,    setDesc]    = useState("");
  const [url,     setUrl]     = useState("");
  const [favicon, setFavicon] = useState("");
  const [tab,     setTab]     = useState<"desktop" | "mobile">("desktop");
  const [copied,  setCopied]  = useState<"tags" | null>(null);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const analysis = useMemo(() => analyse(title, desc, url), [title, desc, url]);
  const { score, titleStatus, descStatus, urlStatus, titlePx, recs } = analysis;

  const scoreColor = score >= 71 ? "#22c55e" : score >= 41 ? "#f59e0b" : "#ef4444";
  const scoreLabel = score >= 71 ? "Good" : score >= 41 ? "Needs work" : "Poor";
  const circ = 2 * Math.PI * 34;

  const metaTags = useMemo(() => {
    const lines: string[] = [];
    if (title)   lines.push(`<title>${title}</title>`);
    if (desc)    lines.push(`<meta name="description" content="${desc}">`);
    if (url)     lines.push(`<link rel="canonical" href="${url}">`);
    if (favicon) lines.push(`<link rel="icon" href="${favicon}">`);
    return lines.join("\n");
  }, [title, desc, url, favicon]);

  const copyTags = useCallback(async () => {
    if (!metaTags) return;
    try { await navigator.clipboard.writeText(metaTags); } catch { /* blocked */ }
    if (copiedTimer.current) clearTimeout(copiedTimer.current);
    setCopied("tags");
    copiedTimer.current = setTimeout(() => setCopied(null), 2000);
  }, [metaTags]);

  const downloadReport = useCallback(() => {
    const lines = [
      "SERP Preview Report — ToolNest AI",
      "=".repeat(40),
      "",
      `Page Title:        ${title || "(not set)"}`,
      `Title Length:      ${title.length} chars | ~${titlePx}px (limit: ~600px desktop)`,
      `Title Status:      ${statusLabel(titleStatus)}`,
      "",
      `Meta Description:  ${desc || "(not set)"}`,
      `Description Length: ${desc.length} chars`,
      `Description Status: ${statusLabel(descStatus)}`,
      "",
      `URL:               ${url || "(not set)"}`,
      `URL Length:        ${url.length} chars`,
      `URL Status:        ${statusLabel(urlStatus)}`,
      "",
      `SEO Score:         ${score}/100 (${scoreLabel})`,
      "",
      "Recommendations",
      "-".repeat(40),
      ...(recs.length > 0 ? recs.map(r => `• ${r}`) : ["• All checks passed."]),
      "",
      "Generated HTML Meta Tags",
      "-".repeat(40),
      metaTags || "(fill in the fields above to generate meta tags)",
    ];
    downloadText(lines.join("\n"), "serp-report.txt");
  }, [title, desc, url, titlePx, titleStatus, descStatus, urlStatus, score, scoreLabel, recs, metaTags]);

  const reset = useCallback(() => {
    setTitle(""); setDesc(""); setUrl(""); setFavicon("");
    setCopied(null);
  }, []);

  return (
    <div className="mb-12 flex flex-col gap-6">

      {/* ── Input form ────────────────────────────────────────────── */}
      <div className="glass-panel rounded-2xl p-5 flex flex-col gap-4"
        style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
        <div className="flex items-center gap-2 pb-1"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
          <span className="material-symbols-outlined text-[16px]" style={{ color: ACCENT }}>edit</span>
          <p className="text-[13px] font-bold" style={{ color: "#e8dff0" }}>Page Details</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Title */}
          <div className="sm:col-span-2 flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="sp-title" className="text-[11px] font-semibold text-[#988d9f]">
                Page Title
              </label>
              <span className={`text-[10px] font-semibold tabular-nums ${title.length > TITLE_OPT_MAX ? "text-red-400" : "text-[#3d3345]"}`}>
                {title.length} / {TITLE_OPT_MAX}
              </span>
            </div>
            <input id="sp-title" type="text" value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="My Awesome Page — Best Tool Online"
              className={inputCls}
              aria-label="Page title"
              style={title.length > TITLE_WARN_MAX ? { borderColor: "rgba(239,68,68,0.5)" } : undefined}
            />
          </div>

          {/* Description */}
          <div className="sm:col-span-2 flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="sp-desc" className="text-[11px] font-semibold text-[#988d9f]">
                Meta Description
              </label>
              <span className={`text-[10px] font-semibold tabular-nums ${desc.length > DESC_OPT_MAX ? "text-red-400" : "text-[#3d3345]"}`}>
                {desc.length} / {DESC_OPT_MAX}
              </span>
            </div>
            <textarea id="sp-desc" rows={3} value={desc}
              onChange={e => setDesc(e.target.value)}
              placeholder="A clear, compelling description of this page (120–160 characters recommended)."
              className={`${inputCls} resize-none`}
              aria-label="Meta description"
              style={desc.length > DESC_WARN_MAX ? { borderColor: "rgba(239,68,68,0.5)" } : undefined}
            />
          </div>

          {/* URL */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="sp-url" className="text-[11px] font-semibold text-[#988d9f]">
                Page URL
              </label>
              {url && (
                <span className={`text-[10px] font-semibold tabular-nums ${url.length > URL_OPT_MAX ? "text-amber-400" : "text-[#3d3345]"}`}>
                  {url.length} chars
                </span>
              )}
            </div>
            <input id="sp-url" type="url" value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="https://example.com/page"
              className={inputCls}
              aria-label="Page URL"
            />
          </div>

          {/* Favicon */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="sp-favicon" className="text-[11px] font-semibold text-[#988d9f]">
              Favicon URL <span className="font-normal text-[#3d3345]">(optional)</span>
            </label>
            <input id="sp-favicon" type="url" value={favicon}
              onChange={e => setFavicon(e.target.value)}
              placeholder="https://example.com/favicon.ico"
              className={inputCls}
              aria-label="Favicon URL"
            />
          </div>
        </div>

        {/* Buttons */}
        <div className="flex flex-wrap gap-3 pt-1"
          style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
          <button onClick={copyTags} disabled={!metaTags}
            className="btn-primary flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm disabled:opacity-40 disabled:cursor-not-allowed">
            <span className="material-symbols-outlined text-[15px]">
              {copied === "tags" ? "check" : "content_copy"}
            </span>
            {copied === "tags" ? "Copied!" : "Copy Meta Tags"}
          </button>
          <button onClick={downloadReport}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all"
            style={{ background: "rgba(249,115,22,0.09)", color: ACCENT, border: "1px solid rgba(249,115,22,0.22)" }}>
            <span className="material-symbols-outlined text-[15px]">download</span>
            Download Report
          </button>
          <button onClick={reset}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm"
            style={{ background: "rgba(255,255,255,0.04)", color: "#988d9f", border: "1px solid rgba(255,255,255,0.07)" }}>
            <span className="material-symbols-outlined text-[14px]">restart_alt</span>Reset
          </button>
        </div>
      </div>

      {/* ── SERP Preview ──────────────────────────────────────────── */}
      <div className="glass-panel rounded-2xl overflow-hidden"
        style={{ border: "1px solid rgba(249,115,22,0.18)" }}>
        {/* Tab bar */}
        <div className="px-5 py-3 flex items-center gap-3"
          style={{ borderBottom: "1px solid rgba(249,115,22,0.1)", background: "rgba(249,115,22,0.03)" }}>
          <span className="material-symbols-outlined text-[14px]" style={{ color: ACCENT }}>preview</span>
          <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: ACCENT }}>Live SERP Preview</span>
          <div className="ml-auto flex gap-2">
            {(["desktop", "mobile"] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                aria-pressed={tab === t}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold capitalize transition-all"
                style={{
                  background: tab === t ? "rgba(249,115,22,0.12)" : "rgba(255,255,255,0.04)",
                  border:     `1px solid ${tab === t ? "rgba(249,115,22,0.35)" : "rgba(255,255,255,0.07)"}`,
                  color:      tab === t ? ACCENT : "#988d9f",
                }}>
                <span className="material-symbols-outlined text-[13px]">
                  {t === "desktop" ? "desktop_windows" : "smartphone"}
                </span>
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Preview area */}
        <div className="p-5" style={{ background: "#f8f9fa", minHeight: 200 }}>
          {tab === "desktop" ? (
            <DesktopResult title={title} desc={desc} url={url} favicon={favicon} titlePx={titlePx} />
          ) : (
            <MobileResult title={title} desc={desc} url={url} favicon={favicon} />
          )}
        </div>

        {/* Pixel width info (desktop only) */}
        {tab === "desktop" && title && (
          <div className="px-5 py-2.5 flex items-center gap-3"
            style={{ borderTop: "1px solid rgba(249,115,22,0.08)", background: "rgba(0,0,0,0.15)" }}>
            <span className="text-[11px]" style={{ color: "#988d9f" }}>
              Estimated title width:
            </span>
            <span className="text-[11px] font-bold tabular-nums"
              style={{ color: titlePx > TITLE_PX_LIMIT_DESKTOP ? "#ef4444" : titlePx > TITLE_PX_LIMIT_DESKTOP * 0.9 ? "#f59e0b" : "#22c55e" }}>
              ~{titlePx}px
            </span>
            <span className="text-[10px]" style={{ color: "#3d3345" }}>/ {TITLE_PX_LIMIT_DESKTOP}px limit</span>
            <div className="flex-1 h-1.5 rounded-full overflow-hidden"
              style={{ background: "rgba(255,255,255,0.07)" }}>
              <div className="h-full rounded-full"
                style={{
                  width: `${clamp((titlePx / TITLE_PX_LIMIT_DESKTOP) * 100, 0, 100)}%`,
                  background: titlePx > TITLE_PX_LIMIT_DESKTOP ? "#ef4444" : titlePx > TITLE_PX_LIMIT_DESKTOP * 0.9 ? "#f59e0b" : "#22c55e",
                  transition: "width 0.25s",
                }} />
            </div>
          </div>
        )}
      </div>

      {/* ── SEO Analysis ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Score */}
        <div className="glass-panel rounded-2xl p-5 flex items-center gap-5"
          style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
          <div className="relative w-20 h-20 shrink-0">
            <svg width="80" height="80" viewBox="0 0 80 80" aria-hidden>
              <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="6" />
              <circle cx="40" cy="40" r="34" fill="none"
                stroke={scoreColor} strokeWidth="6"
                strokeDasharray={circ}
                strokeDashoffset={circ * (1 - score / 100)}
                strokeLinecap="round" transform="rotate(-90 40 40)"
                style={{ transition: "stroke-dashoffset 0.4s ease, stroke 0.4s ease" }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[20px] font-black tabular-nums" style={{ color: scoreColor, lineHeight: 1 }}>
                {score}
              </span>
              <span className="text-[9px] font-bold" style={{ color: scoreColor, opacity: 0.7 }}>/ 100</span>
            </div>
          </div>
          <div>
            <p className="text-[15px] font-bold mb-0.5" style={{ color: "#e8dff0" }}>SEO Score</p>
            <p className="text-[13px] font-semibold mb-2" style={{ color: scoreColor }}>{scoreLabel}</p>
            <p className="text-[12px]" style={{ color: "#988d9f" }}>
              {score === 100
                ? "All SEO elements are perfectly optimised."
                : `${recs.length} issue${recs.length !== 1 ? "s" : ""} found — see recommendations below.`}
            </p>
          </div>
        </div>

        {/* Quick stats */}
        <div className="glass-panel rounded-2xl p-5 grid grid-cols-3 gap-4"
          style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
          {[
            { label: "Title",  value: title.length, unit: "chars", max: TITLE_OPT_MAX, status: titleStatus },
            { label: "Desc",   value: desc.length,  unit: "chars", max: DESC_OPT_MAX,  status: descStatus },
            { label: "URL",    value: url.length,   unit: "chars", max: URL_OPT_MAX,   status: urlStatus },
          ].map(({ label, value, unit, max, status }) => {
            const c = statusColor(status);
            return (
              <div key={label} className="flex flex-col items-center gap-1">
                <div className="relative w-12 h-12">
                  <svg width="48" height="48" viewBox="0 0 48 48" aria-hidden>
                    <circle cx="24" cy="24" r="20" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="4" />
                    <circle cx="24" cy="24" r="20" fill="none"
                      stroke={c} strokeWidth="4"
                      strokeDasharray={2 * Math.PI * 20}
                      strokeDashoffset={2 * Math.PI * 20 * (1 - clamp(value / (max * 1.2), 0, 1))}
                      strokeLinecap="round" transform="rotate(-90 24 24)"
                      style={{ transition: "stroke-dashoffset 0.3s, stroke 0.3s" }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-[11px] font-bold tabular-nums" style={{ color: c }}>{value}</span>
                  </div>
                </div>
                <span className="text-[10px] font-semibold" style={{ color: "#988d9f" }}>{label}</span>
                <span className="text-[9px]" style={{ color: c }}>{statusLabel(status)}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Metric bars ──────────────────────────────────────────── */}
      <div className="glass-panel rounded-2xl p-5 flex flex-col gap-5"
        style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
        <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "#988d9f" }}>
          Length Analysis
        </p>
        <MetricBar label="Title Length" value={title.length}
          max={80} optMin={TITLE_OPT_MIN} optMax={TITLE_OPT_MAX} warnMax={TITLE_WARN_MAX}
          status={title ? titleStatus : "missing"} />
        <MetricBar label="Description Length" value={desc.length}
          max={220} optMin={DESC_OPT_MIN} optMax={DESC_OPT_MAX} warnMax={DESC_WARN_MAX}
          status={desc ? descStatus : "missing"} />
        <MetricBar label="URL Length" value={url.length}
          max={130} optMin={0} optMax={URL_OPT_MAX} warnMax={URL_WARN_MAX}
          status={url ? urlStatus : "missing"} />
        {/* Pixel bar */}
        {title && (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[12px] font-semibold" style={{ color: "#c8c0d0" }}>Title Pixel Width (desktop)</span>
              <div className="flex items-center gap-2">
                <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold"
                  style={{
                    background: titlePx > TITLE_PX_LIMIT_DESKTOP ? "#ef444418" : titlePx > TITLE_PX_LIMIT_DESKTOP * 0.9 ? "#f59e0b18" : "#22c55e18",
                    color:      titlePx > TITLE_PX_LIMIT_DESKTOP ? "#ef4444"   : titlePx > TITLE_PX_LIMIT_DESKTOP * 0.9 ? "#f59e0b"   : "#22c55e",
                  }}>
                  {titlePx > TITLE_PX_LIMIT_DESKTOP ? "Truncated" : titlePx > TITLE_PX_LIMIT_DESKTOP * 0.9 ? "Near limit" : "Fits"}
                </span>
                <span className="text-[12px] font-bold tabular-nums"
                  style={{ color: titlePx > TITLE_PX_LIMIT_DESKTOP ? "#ef4444" : "#22c55e" }}>
                  ~{titlePx}px
                </span>
              </div>
            </div>
            <div className="relative h-2 rounded-full overflow-hidden"
              style={{ background: "rgba(255,255,255,0.07)" }}>
              <div className="absolute top-0 bottom-0 rounded-full opacity-20"
                style={{ left: 0, width: `${(TITLE_PX_LIMIT_DESKTOP / 750) * 100}%`, background: "#22c55e" }} />
              <div className="absolute top-0 left-0 h-full rounded-full"
                style={{
                  width: `${clamp((titlePx / 750) * 100, 0, 100)}%`,
                  background: titlePx > TITLE_PX_LIMIT_DESKTOP ? "#ef4444" : titlePx > TITLE_PX_LIMIT_DESKTOP * 0.9 ? "#f59e0b" : "#22c55e",
                  transition: "width 0.25s ease",
                }} />
            </div>
            <div className="flex justify-between text-[9px] font-semibold" style={{ color: "#2d2535" }}>
              <span>0px</span>
              <span style={{ color: "#3d5c3d" }}>{TITLE_PX_LIMIT_DESKTOP}px limit</span>
              <span>750px</span>
            </div>
          </div>
        )}
      </div>

      {/* ── Recommendations ───────────────────────────────────────── */}
      <div className="glass-panel rounded-2xl p-5 flex flex-col gap-3"
        style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
        <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "#988d9f" }}>
          Recommendations
        </p>
        {recs.length === 0 ? (
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-green-400">check_circle</span>
            <span className="text-[13px]" style={{ color: "#22c55e" }}>
              All checks passed — your SERP snippet is well-optimised.
            </span>
          </div>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {recs.map((r, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <span className="material-symbols-outlined text-[15px] mt-0.5 shrink-0"
                  style={{ color: "#f59e0b" }}>warning</span>
                <span className="text-[13px]" style={{ color: "#c8b89f" }}>{r}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ── Generated meta tags ─────────────────────────────────── */}
      {metaTags && (
        <div className="glass-panel rounded-2xl overflow-hidden"
          style={{ border: "1px solid rgba(249,115,22,0.18)" }}>
          <div className="px-5 py-3 flex items-center justify-between"
            style={{ borderBottom: "1px solid rgba(249,115,22,0.1)", background: "rgba(249,115,22,0.03)" }}>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[14px]" style={{ color: ACCENT }}>code</span>
              <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: ACCENT }}>HTML Meta Tags</span>
            </div>
            <button onClick={copyTags}
              className="flex items-center gap-1.5 px-3 py-1 rounded-xl text-[11px] font-bold"
              style={{ background: "rgba(249,115,22,0.1)", color: ACCENT }}>
              <span className="material-symbols-outlined text-[12px]">
                {copied === "tags" ? "check" : "content_copy"}
              </span>
              {copied === "tags" ? "Copied!" : "Copy"}
            </button>
          </div>
          <pre className="p-5 overflow-x-auto text-[12px] leading-relaxed m-0"
            style={{ fontFamily: "'Cascadia Code','Fira Code','Courier New',monospace", background: "#0d0d14", color: "#ce9178" }}>
            {metaTags}
          </pre>
        </div>
      )}
    </div>
  );
}
