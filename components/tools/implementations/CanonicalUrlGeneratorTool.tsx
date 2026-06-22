"use client";

import { useState, useMemo, useCallback } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────
type PageType = "Homepage" | "Article" | "Product" | "Category" | "Landing Page" | "Custom";
type OutputTab = "html" | "preview";

interface Options {
  selfReferencing: boolean;
  crossDomain: boolean;
  httpsValidation: boolean;
  trailingSlash: "keep" | "add" | "remove";
  removeParams: boolean;
  normalizeUrl: boolean;
}

interface Issue { level: "error" | "warning" | "info"; text: string; }

// ── Constants ─────────────────────────────────────────────────────────────────
const ACCENT = "#f97316";
const PAGE_TYPES: PageType[] = ["Homepage", "Article", "Product", "Category", "Landing Page", "Custom"];

const inputCls =
  "w-full rounded-xl px-3 py-2.5 text-[13px] outline-none transition-all bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] focus:border-[rgba(249,115,22,0.4)] text-[#e8dff0] placeholder-[#3d3345]";
const selectCls =
  "w-full rounded-xl px-2.5 py-2 text-[13px] outline-none transition-all cursor-pointer bg-[#1a1525] border border-[rgba(255,255,255,0.08)] focus:border-[rgba(249,115,22,0.4)] text-[#e8dff0]";

// ── Utilities ─────────────────────────────────────────────────────────────────
const isValidUrl = (s: string) => {
  try { new URL(s); return true; } catch { return false; }
};

const isHttps = (s: string) => s.startsWith("https://");

function normalizeCanonical(url: string, opts: Options): string {
  if (!url) return "";
  let out = url.trim();
  if (opts.normalizeUrl) {
    try {
      const u = new URL(out);
      out = u.origin + u.pathname + u.search + u.hash;
    } catch { /* keep as-is */ }
  }
  if (opts.removeParams) {
    try {
      const u = new URL(out);
      out = u.origin + u.pathname;
    } catch { /* keep as-is */ }
  }
  if (opts.trailingSlash === "add") {
    try {
      const u = new URL(out);
      if (!u.pathname.endsWith("/")) u.pathname = u.pathname + "/";
      out = u.toString();
    } catch { /* keep as-is */ }
  } else if (opts.trailingSlash === "remove") {
    try {
      const u = new URL(out);
      if (u.pathname !== "/" && u.pathname.endsWith("/"))
        u.pathname = u.pathname.slice(0, -1);
      out = u.toString();
    } catch { /* keep as-is */ }
  }
  return out;
}

function escAttr(s: string) {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&#34;").replace(/</g, "&lt;");
}

function hlHtml(raw: string): string {
  const escDisplay = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  return raw.split("\n").map(line => {
    const trimmed = line.trim();
    if (!trimmed) return "";
    if (trimmed.startsWith("<!--"))
      return `<span style="color:#6a9955">${escDisplay(trimmed)}</span>`;
    const m = trimmed.match(/^<(link)\s+([\s\S]*?)\s*\/?>$/);
    if (!m) return escDisplay(trimmed);
    const tagName = m[1];
    const attrsRaw = m[2] ?? "";
    const coloredAttrs = attrsRaw.replace(
      /([\w:-]+)(=)("(?:[^"\\]|\\.)*")/g,
      (_full, name, eq, val) =>
        `<span style="color:#9cdcfe">${name}</span>${eq}<span style="color:#ce9178">${escDisplay(val)}</span>`,
    );
    return (
      `<span style="color:#569cd6">&lt;${tagName}</span>` +
      ` ${coloredAttrs}` +
      `<span style="color:#569cd6"> /&gt;</span>`
    );
  }).join("\n");
}

// ── Validation & scoring ──────────────────────────────────────────────────────
function validate(
  websiteUrl: string,
  canonicalUrl: string,
  alternateUrl: string,
  opts: Options,
): { score: number; issues: Issue[] } {
  const issues: Issue[] = [];
  let score = 0;

  if (!canonicalUrl) {
    issues.push({ level: "error", text: "Canonical URL is required." });
    return { score: 0, issues };
  }
  if (!isValidUrl(canonicalUrl)) {
    issues.push({ level: "error", text: "Canonical URL must be a valid absolute URL (https://…)." });
    return { score: 0, issues };
  }

  score += 40;

  if (opts.httpsValidation && !isHttps(canonicalUrl)) {
    issues.push({ level: "error", text: "Canonical URL should use HTTPS, not HTTP." });
    score -= 20;
  } else if (isHttps(canonicalUrl)) {
    score += 15;
  }

  if (websiteUrl && isValidUrl(websiteUrl)) {
    score += 10;
    const wOrigin = new URL(websiteUrl).origin;
    const cOrigin = new URL(canonicalUrl).origin;
    if (wOrigin !== cOrigin && !opts.crossDomain) {
      issues.push({ level: "warning", text: "Canonical URL is on a different domain than the website URL. Enable Cross-domain if intentional." });
    } else if (wOrigin !== cOrigin && opts.crossDomain) {
      issues.push({ level: "info", text: "Cross-domain canonical detected — make sure the target domain is authoritative." });
    }
    if (opts.httpsValidation && isValidUrl(websiteUrl) && !isHttps(websiteUrl) && isHttps(canonicalUrl)) {
      issues.push({ level: "warning", text: "Website URL uses HTTP but Canonical URL uses HTTPS — ensure redirects are in place." });
    }
  } else if (websiteUrl) {
    issues.push({ level: "warning", text: "Website URL is not a valid absolute URL." });
  }

  if (alternateUrl) {
    if (!isValidUrl(alternateUrl)) {
      issues.push({ level: "error", text: "Alternate Canonical URL must be a valid absolute URL." });
      score -= 10;
    } else {
      if (alternateUrl === canonicalUrl) {
        issues.push({ level: "warning", text: "Alternate Canonical URL is identical to the primary Canonical URL — this is redundant." });
      } else {
        score += 10;
      }
    }
  }

  if (opts.selfReferencing) {
    issues.push({ level: "info", text: "Self-referencing canonical is set — the canonical points to this page itself (recommended for primary pages)." });
    score += 10;
  }

  if (canonicalUrl.includes("?") && !opts.removeParams) {
    issues.push({ level: "warning", text: "Canonical URL contains query parameters. Consider enabling 'Remove URL Parameters' to avoid duplicate content." });
  }

  const remaining = 100 - score;
  if (remaining > 0 && issues.filter(i => i.level === "error").length === 0) {
    score += Math.min(remaining, 15);
  }

  if (issues.filter(i => i.level === "error").length === 0 && score >= 70) {
    issues.push({ level: "info", text: "Canonical tag is well-formed and ready to use." });
  }

  return { score: Math.min(100, Math.max(0, score)), issues };
}

// ── Sub-components (defined outside main to avoid remounting) ─────────────────
function PanelHeader({ icon, title, hint }: { icon: string; title: string; hint?: string }) {
  return (
    <div className="flex items-center gap-2 pb-1" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
      <span className="material-symbols-outlined text-[16px]" style={{ color: ACCENT }}>{icon}</span>
      <p className="text-[13px] font-bold" style={{ color: "#e8dff0" }}>{title}</p>
      {hint && <span className="text-[10px] ml-1" style={{ color: "#3d3345" }}>{hint}</span>}
    </div>
  );
}

function Toggle({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-start gap-3 cursor-pointer group">
      <div className="relative mt-0.5 shrink-0">
        <input type="checkbox" className="sr-only" checked={checked} onChange={e => onChange(e.target.checked)} />
        <div
          className="w-9 h-5 rounded-full transition-all"
          style={{ background: checked ? "rgba(249,115,22,0.25)" : "rgba(255,255,255,0.06)", border: `1px solid ${checked ? "rgba(249,115,22,0.5)" : "rgba(255,255,255,0.12)"}` }}
        />
        <div
          className="absolute top-0.5 w-4 h-4 rounded-full transition-all"
          style={{ left: checked ? "18px" : "2px", background: checked ? ACCENT : "rgba(255,255,255,0.3)" }}
        />
      </div>
      <div>
        <p className="text-[13px] font-semibold" style={{ color: "#e8dff0" }}>{label}</p>
        {hint && <p className="text-[11px] mt-0.5" style={{ color: "#988d9f" }}>{hint}</p>}
      </div>
    </label>
  );
}

// ── Default state ─────────────────────────────────────────────────────────────
const DEFAULT_OPTS: Options = {
  selfReferencing: true,
  crossDomain: false,
  httpsValidation: true,
  trailingSlash: "keep",
  removeParams: false,
  normalizeUrl: true,
};

// ── Main component ────────────────────────────────────────────────────────────
export default function CanonicalUrlGeneratorTool() {
  const [websiteUrl,   setWebsiteUrl]   = useState("");
  const [canonicalUrl, setCanonicalUrl] = useState("");
  const [alternateUrl, setAlternateUrl] = useState("");
  const [pageType,     setPageType]     = useState<PageType>("Homepage");
  const [opts,         setOpts]         = useState<Options>(DEFAULT_OPTS);
  const [outputTab,    setOutputTab]    = useState<OutputTab>("html");
  const [copied,       setCopied]       = useState<"html" | "preview" | null>(null);
  const [generated,    setGenerated]    = useState(false);

  const setOpt = useCallback(<K extends keyof Options>(k: K, v: Options[K]) =>
    setOpts(p => ({ ...p, [k]: v })), []);

  // Derived
  const processedCanonical = useMemo(
    () => normalizeCanonical(canonicalUrl, opts),
    [canonicalUrl, opts],
  );

  const { score, issues } = useMemo(
    () => validate(websiteUrl, canonicalUrl, alternateUrl, opts),
    [websiteUrl, canonicalUrl, alternateUrl, opts],
  );

  const scoreColor = score >= 71 ? "#22c55e" : score >= 41 ? "#f59e0b" : "#ef4444";
  const scoreLabel = score >= 71 ? "Good" : score >= 41 ? "Needs work" : "Incomplete";
  const circ = 2 * Math.PI * 34;

  const htmlOutput = useMemo(() => {
    const lines: string[] = [];
    lines.push(`<!-- Canonical URL (${pageType}) -->`);
    if (processedCanonical) {
      lines.push(`<link rel="canonical" href="${escAttr(processedCanonical)}" />`);
    } else {
      lines.push(`<link rel="canonical" href="" />`);
    }
    if (alternateUrl && isValidUrl(alternateUrl)) {
      lines.push(`<link rel="alternate" href="${escAttr(alternateUrl)}" />`);
    }
    return lines.join("\n");
  }, [processedCanonical, alternateUrl, pageType]);

  const generate = useCallback(() => setGenerated(true), []);

  const reset = useCallback(() => {
    setWebsiteUrl(""); setCanonicalUrl(""); setAlternateUrl("");
    setPageType("Homepage"); setOpts(DEFAULT_OPTS);
    setGenerated(false); setCopied(null);
  }, []);

  const copy = useCallback(async (what: "html" | "preview") => {
    const text = what === "html" ? htmlOutput : processedCanonical;
    try { await navigator.clipboard.writeText(text); } catch { /* blocked */ }
    setCopied(what); setTimeout(() => setCopied(null), 2000);
  }, [htmlOutput, processedCanonical]);

  const download = useCallback(() => {
    const blob = new Blob([htmlOutput], { type: "text/html" });
    const url  = URL.createObjectURL(blob);
    Object.assign(document.createElement("a"), { href: url, download: "canonical-tag.html" }).click();
    URL.revokeObjectURL(url);
  }, [htmlOutput]);

  const canonicalInvalid  = canonicalUrl  && !isValidUrl(canonicalUrl);
  const websiteInvalid    = websiteUrl    && !isValidUrl(websiteUrl);
  const alternateInvalid  = alternateUrl  && !isValidUrl(alternateUrl);

  return (
    <div className="mb-12 flex flex-col gap-6">

      {/* ── Website Info ──────────────────────────────────── */}
      <div className="glass-panel rounded-2xl p-5 flex flex-col gap-4" style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
        <PanelHeader icon="language" title="Website Information" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-[#988d9f]">Website URL</label>
            <input
              type="url"
              value={websiteUrl}
              onChange={e => setWebsiteUrl(e.target.value)}
              placeholder="https://example.com"
              className={inputCls}
              style={websiteInvalid ? { borderColor: "rgba(239,68,68,0.5)" } : undefined}
            />
            {websiteInvalid && <p className="text-[11px]" style={{ color: "#ef4444" }}>Enter a valid URL including https://</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-[#988d9f]">
              Canonical URL <span style={{ color: ACCENT }}>*</span>
            </label>
            <input
              type="url"
              value={canonicalUrl}
              onChange={e => setCanonicalUrl(e.target.value)}
              placeholder="https://example.com/page"
              className={inputCls}
              style={canonicalInvalid ? { borderColor: "rgba(239,68,68,0.5)" } : undefined}
            />
            {canonicalInvalid && <p className="text-[11px]" style={{ color: "#ef4444" }}>Enter a valid URL including https://</p>}
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <label className="text-[11px] font-semibold text-[#988d9f]">
              Alternate Canonical URL
              <span className="ml-2 font-normal" style={{ color: "#3d3345" }}>optional — e.g. AMP version</span>
            </label>
            <input
              type="url"
              value={alternateUrl}
              onChange={e => setAlternateUrl(e.target.value)}
              placeholder="https://amp.example.com/page"
              className={inputCls}
              style={alternateInvalid ? { borderColor: "rgba(239,68,68,0.5)" } : undefined}
            />
            {alternateInvalid && <p className="text-[11px]" style={{ color: "#ef4444" }}>Enter a valid URL including https://</p>}
          </div>
        </div>
      </div>

      {/* ── Page Type ─────────────────────────────────────── */}
      <div className="glass-panel rounded-2xl p-5 flex flex-col gap-4" style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
        <PanelHeader icon="pages" title="Page Type" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {PAGE_TYPES.map(pt => (
            <button
              key={pt}
              onClick={() => setPageType(pt)}
              aria-pressed={pageType === pt}
              className="px-3 py-2.5 rounded-xl text-[12px] font-bold transition-all"
              style={
                pageType === pt
                  ? { background: "rgba(249,115,22,0.10)", border: "1px solid rgba(249,115,22,0.32)", color: ACCENT }
                  : { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", color: "#e8dff0" }
              }
            >
              {pt}
            </button>
          ))}
        </div>
      </div>

      {/* ── Options ───────────────────────────────────────── */}
      <div className="glass-panel rounded-2xl p-5 flex flex-col gap-5" style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
        <PanelHeader icon="tune" title="Options" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <Toggle
            label="Self-referencing Canonical"
            hint="Canonical points to the page itself — recommended for primary content pages"
            checked={opts.selfReferencing}
            onChange={v => setOpt("selfReferencing", v)}
          />
          <Toggle
            label="Cross-domain Canonical"
            hint="Allow canonical to point to a different domain (syndicated content)"
            checked={opts.crossDomain}
            onChange={v => setOpt("crossDomain", v)}
          />
          <Toggle
            label="HTTPS Validation"
            hint="Flag canonical URLs that use HTTP instead of HTTPS"
            checked={opts.httpsValidation}
            onChange={v => setOpt("httpsValidation", v)}
          />
          <Toggle
            label="Remove URL Parameters"
            hint="Strip query strings (e.g. ?utm_source=…) from the canonical URL"
            checked={opts.removeParams}
            onChange={v => setOpt("removeParams", v)}
          />
          <Toggle
            label="Normalize URL"
            hint="Resolve the URL to its canonical form (remove fragments, clean path)"
            checked={opts.normalizeUrl}
            onChange={v => setOpt("normalizeUrl", v)}
          />
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-[#988d9f]">Trailing Slash Preference</label>
            <select
              value={opts.trailingSlash}
              onChange={e => setOpt("trailingSlash", e.target.value as Options["trailingSlash"])}
              className={selectCls}
            >
              <option value="keep">Keep as-is</option>
              <option value="add">Always add trailing slash</option>
              <option value="remove">Always remove trailing slash</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── Validation score ──────────────────────────────── */}
      <div className="glass-panel rounded-2xl p-5 flex flex-wrap items-start gap-6" style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
        <div className="flex flex-col items-center gap-1.5 shrink-0">
          <div className="relative w-20 h-20">
            <svg width="80" height="80" viewBox="0 0 80 80" aria-hidden="true">
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
              <span className="text-[20px] font-black tabular-nums" style={{ color: scoreColor, lineHeight: 1 }}>{score}</span>
              <span className="text-[9px] font-bold" style={{ color: scoreColor, opacity: 0.7 }}>/ 100</span>
            </div>
          </div>
          <span className="text-[10px] font-bold" style={{ color: scoreColor }}>{scoreLabel}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-bold mb-2" style={{ color: "#e8dff0" }}>SEO Best Practices</p>
          {issues.length === 0 ? (
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px] text-green-400">check_circle</span>
              <span className="text-[13px]" style={{ color: "#22c55e" }}>Fill in the Canonical URL to see validation.</span>
            </div>
          ) : (
            <ul className="flex flex-col gap-2 max-h-40 overflow-y-auto pr-1">
              {issues.map((iss, i) => {
                const ic = iss.level === "error" ? "#ef4444" : iss.level === "warning" ? "#f59e0b" : "#60a5fa";
                const ig = iss.level === "error" ? "error" : iss.level === "warning" ? "warning" : "info";
                return (
                  <li key={i} className="flex items-start gap-2">
                    <span className="material-symbols-outlined text-[14px] mt-0.5 shrink-0" style={{ color: ic }}>{ig}</span>
                    <span className="text-[12px]" style={{ color: "#c8b89f" }}>{iss.text}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* ── Processed URL preview ─────────────────────────── */}
      {processedCanonical && processedCanonical !== canonicalUrl && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl" style={{ background: "rgba(249,115,22,0.06)", border: "1px solid rgba(249,115,22,0.18)" }}>
          <span className="material-symbols-outlined text-[16px] mt-0.5 shrink-0" style={{ color: ACCENT }}>auto_fix_high</span>
          <div className="min-w-0">
            <p className="text-[11px] font-bold mb-1" style={{ color: ACCENT }}>URL Normalized</p>
            <p className="text-[12px] font-mono break-all" style={{ color: "#e8dff0" }}>{processedCanonical}</p>
          </div>
        </div>
      )}

      {/* ── Action buttons ────────────────────────────────── */}
      <div className="flex flex-wrap gap-3">
        <button onClick={generate} className="btn-primary flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm">
          <span className="material-symbols-outlined text-[16px]">auto_awesome</span>
          Generate Canonical Tag
        </button>
        <button onClick={() => copy("html")} className="flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm transition-all"
          style={{ background: "rgba(249,115,22,0.09)", color: ACCENT, border: "1px solid rgba(249,115,22,0.22)" }}>
          <span className="material-symbols-outlined text-[15px]">{copied === "html" ? "check" : "content_copy"}</span>
          {copied === "html" ? "Copied!" : "Copy HTML"}
        </button>
        <button onClick={() => copy("preview")} className="flex items-center gap-2 px-4 py-3 rounded-xl font-semibold text-sm transition-all"
          style={{ background: "rgba(255,255,255,0.04)", color: "#c8c0d0", border: "1px solid rgba(255,255,255,0.08)" }}>
          <span className="material-symbols-outlined text-[14px]">{copied === "preview" ? "check" : "link"}</span>
          {copied === "preview" ? "Copied!" : "Copy URL"}
        </button>
        <button onClick={download} className="flex items-center gap-2 px-4 py-3 rounded-xl font-semibold text-sm transition-all"
          style={{ background: "rgba(255,255,255,0.04)", color: "#c8c0d0", border: "1px solid rgba(255,255,255,0.08)" }}>
          <span className="material-symbols-outlined text-[14px]">download</span>
          Download HTML
        </button>
        <button onClick={reset} className="flex items-center gap-2 px-4 py-3 rounded-xl font-semibold text-sm transition-all ml-auto"
          style={{ background: "rgba(255,255,255,0.03)", color: "#988d9f", border: "1px solid rgba(255,255,255,0.07)" }}>
          <span className="material-symbols-outlined text-[14px]">restart_alt</span>
          Reset
        </button>
      </div>

      {/* ── Output panel ──────────────────────────────────── */}
      {(generated || canonicalUrl) && (
        <div className="glass-panel rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(249,115,22,0.18)" }}>
          <div
            className="px-5 py-3 flex items-center justify-between flex-wrap gap-3"
            style={{ borderBottom: "1px solid rgba(249,115,22,0.1)", background: "rgba(249,115,22,0.03)" }}
          >
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[14px]" style={{ color: ACCENT }}>code</span>
              <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: ACCENT }}>Generated Output</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ background: "rgba(249,115,22,0.1)", color: ACCENT }}>Live</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
                {(["html", "preview"] as OutputTab[]).map(t => (
                  <button key={t} onClick={() => setOutputTab(t)}
                    className="px-3 py-1 text-[11px] font-bold transition-all"
                    style={outputTab === t
                      ? { background: "rgba(249,115,22,0.15)", color: ACCENT }
                      : { background: "transparent", color: "#988d9f" }}>
                    {t === "html" ? "HTML Tag" : "Preview"}
                  </button>
                ))}
              </div>
              <button onClick={() => copy(outputTab)}
                className="flex items-center gap-1.5 px-3 py-1 rounded-xl text-[11px] font-bold"
                style={{ background: "rgba(249,115,22,0.1)", color: ACCENT }}>
                <span className="material-symbols-outlined text-[12px]">{copied === outputTab ? "check" : "content_copy"}</span>
                {copied === outputTab ? "Copied!" : "Copy"}
              </button>
            </div>
          </div>

          {outputTab === "html" ? (
            <pre
              className="p-5 overflow-x-auto text-[12px] leading-relaxed m-0"
              style={{ fontFamily: "'Cascadia Code','Fira Code','Courier New',monospace", background: "#0d0d14" }}
            >
              <code dangerouslySetInnerHTML={{ __html: hlHtml(htmlOutput) }} />
            </pre>
          ) : (
            <div className="p-5" style={{ background: "#0d0d14" }}>
              <p className="text-[11px] font-bold uppercase tracking-wider mb-4" style={{ color: "#988d9f" }}>Canonical Preview</p>
              {/* Canonical card */}
              <div className="rounded-xl p-4 flex flex-col gap-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[14px]" style={{ color: ACCENT }}>link</span>
                  <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: ACCENT }}>rel=&quot;canonical&quot;</span>
                </div>
                <div className="flex flex-col gap-1">
                  <p className="text-[11px]" style={{ color: "#988d9f" }}>Canonical URL</p>
                  <p className="text-[13px] font-mono break-all" style={{ color: "#e8dff0" }}>
                    {processedCanonical || <span style={{ color: "#3d3345" }}>— not set —</span>}
                  </p>
                </div>
                {alternateUrl && isValidUrl(alternateUrl) && (
                  <div className="flex flex-col gap-1 pt-2" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                    <p className="text-[11px]" style={{ color: "#988d9f" }}>Alternate URL</p>
                    <p className="text-[13px] font-mono break-all" style={{ color: "#c8b89f" }}>{alternateUrl}</p>
                  </div>
                )}
                {websiteUrl && isValidUrl(websiteUrl) && (
                  <div className="flex flex-col gap-1 pt-2" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                    <p className="text-[11px]" style={{ color: "#988d9f" }}>Website</p>
                    <p className="text-[13px] font-mono break-all" style={{ color: "#c8b89f" }}>{websiteUrl}</p>
                  </div>
                )}
                <div className="flex flex-wrap gap-2 pt-1">
                  <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg"
                    style={{ background: "rgba(249,115,22,0.08)", color: ACCENT, border: "1px solid rgba(249,115,22,0.2)" }}>
                    <span className="material-symbols-outlined text-[11px]">description</span>
                    {pageType}
                  </span>
                  {isHttps(processedCanonical) && (
                    <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg"
                      style={{ background: "rgba(34,197,94,0.08)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.2)" }}>
                      <span className="material-symbols-outlined text-[11px]">lock</span>
                      HTTPS
                    </span>
                  )}
                  {opts.selfReferencing && (
                    <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg"
                      style={{ background: "rgba(96,165,250,0.08)", color: "#60a5fa", border: "1px solid rgba(96,165,250,0.2)" }}>
                      <span className="material-symbols-outlined text-[11px]">refresh</span>
                      Self-referencing
                    </span>
                  )}
                  {opts.crossDomain && (
                    <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg"
                      style={{ background: "rgba(167,139,250,0.08)", color: "#a78bfa", border: "1px solid rgba(167,139,250,0.2)" }}>
                      <span className="material-symbols-outlined text-[11px]">public</span>
                      Cross-domain
                    </span>
                  )}
                </div>
              </div>

              {/* Validation status */}
              <div className="mt-4 flex flex-col gap-2">
                <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "#988d9f" }}>Validation Status</p>
                {issues.map((iss, i) => {
                  const ic = iss.level === "error" ? "#ef4444" : iss.level === "warning" ? "#f59e0b" : "#60a5fa";
                  const ig = iss.level === "error" ? "error" : iss.level === "warning" ? "warning" : "info";
                  return (
                    <div key={i} className="flex items-start gap-2 px-3 py-2 rounded-xl"
                      style={{ background: `rgba(${iss.level === "error" ? "239,68,68" : iss.level === "warning" ? "245,158,11" : "96,165,250"},0.05)`, border: `1px solid rgba(${iss.level === "error" ? "239,68,68" : iss.level === "warning" ? "245,158,11" : "96,165,250"},0.15)` }}>
                      <span className="material-symbols-outlined text-[14px] mt-0.5 shrink-0" style={{ color: ic }}>{ig}</span>
                      <span className="text-[12px]" style={{ color: "#c8b89f" }}>{iss.text}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
