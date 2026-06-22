"use client";

/**
 * Meta Tag Generator
 *
 * Four form sections (Basic SEO, Open Graph, Twitter Cards, Technical) →
 * generates a complete HTML meta-tag block.
 *
 * Live previews update as the user types:
 *   • Google Search — title (blue), URL (green), description (gray)
 *   • Facebook OG  — image placeholder, title, description, domain
 *   • Twitter Card — image placeholder, title, description
 *
 * SEO Score (0–100) calculated from completeness of key fields.
 *
 * "Generate" writes the final code block. Copy / Download available after.
 * Syntax highlighting uses safe HTML-escaping then regex-span injection.
 * No external libraries — fully client-side.
 */

import { useState, useCallback, useMemo } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────
interface FormData {
  // Basic
  title: string;
  description: string;
  canonicalUrl: string;
  websiteUrl: string;
  author: string;
  keywords: string;
  language: string;
  robots: string;
  // Open Graph
  ogTitle: string;
  ogDescription: string;
  ogImage: string;
  ogUrl: string;
  ogType: string;
  siteName: string;
  locale: string;
  // Twitter
  twitterCard: string;
  twitterTitle: string;
  twitterDescription: string;
  twitterImage: string;
  twitterCreator: string;
  // Technical
  charset: string;
  viewport: string;
  themeColor: string;
  favicon: string;
}

const DEFAULT: FormData = {
  title: "", description: "", canonicalUrl: "", websiteUrl: "",
  author: "", keywords: "", language: "en", robots: "index, follow",
  ogTitle: "", ogDescription: "", ogImage: "", ogUrl: "",
  ogType: "website", siteName: "", locale: "en_US",
  twitterCard: "summary_large_image", twitterTitle: "", twitterDescription: "",
  twitterImage: "", twitterCreator: "",
  charset: "UTF-8", viewport: "width=device-width, initial-scale=1",
  themeColor: "#ffffff", favicon: "",
};

// ── HTML generator ─────────────────────────────────────────────────────────────
function generateMetaTags(f: FormData): string {
  const lines: string[] = ["<!-- Primary Meta Tags -->"];
  if (f.charset)   lines.push(`<meta charset="${f.charset}">`);
  if (f.viewport)  lines.push(`<meta name="viewport" content="${f.viewport}">`);
  if (f.title)     lines.push(`<title>${f.title}</title>`);
  if (f.description) lines.push(`<meta name="description" content="${f.description}">`);
  if (f.author)    lines.push(`<meta name="author" content="${f.author}">`);
  if (f.keywords)  lines.push(`<meta name="keywords" content="${f.keywords}">`);
  if (f.language)  lines.push(`<meta http-equiv="content-language" content="${f.language}">`);
  if (f.robots)    lines.push(`<meta name="robots" content="${f.robots}">`);
  if (f.themeColor) lines.push(`<meta name="theme-color" content="${f.themeColor}">`);
  if (f.canonicalUrl) lines.push(`<link rel="canonical" href="${f.canonicalUrl}">`);
  if (f.favicon)   lines.push(`<link rel="icon" href="${f.favicon}">`);

  const hasOG = f.ogTitle || f.ogDescription || f.ogImage || f.title || f.description;
  if (hasOG) {
    lines.push("", "<!-- Open Graph / Facebook -->");
    lines.push(`<meta property="og:type" content="${f.ogType || "website"}">`);
    const ogUrl = f.ogUrl || f.websiteUrl;
    if (ogUrl) lines.push(`<meta property="og:url" content="${ogUrl}">`);
    const ogTitle = f.ogTitle || f.title;
    if (ogTitle) lines.push(`<meta property="og:title" content="${ogTitle}">`);
    const ogDesc = f.ogDescription || f.description;
    if (ogDesc) lines.push(`<meta property="og:description" content="${ogDesc}">`);
    if (f.ogImage)   lines.push(`<meta property="og:image" content="${f.ogImage}">`);
    if (f.siteName)  lines.push(`<meta property="og:site_name" content="${f.siteName}">`);
    if (f.locale)    lines.push(`<meta property="og:locale" content="${f.locale}">`);
  }

  const hasTwitter = f.twitterTitle || f.title || f.twitterDescription || f.description;
  if (hasTwitter) {
    lines.push("", "<!-- Twitter -->");
    lines.push(`<meta property="twitter:card" content="${f.twitterCard || "summary_large_image"}">`);
    const twTitle = f.twitterTitle || f.title;
    if (twTitle) lines.push(`<meta property="twitter:title" content="${twTitle}">`);
    const twDesc = f.twitterDescription || f.description;
    if (twDesc) lines.push(`<meta property="twitter:description" content="${twDesc}">`);
    const twImg = f.twitterImage || f.ogImage;
    if (twImg) lines.push(`<meta property="twitter:image" content="${twImg}">`);
    if (f.twitterCreator) lines.push(`<meta property="twitter:creator" content="${f.twitterCreator}">`);
  }

  return lines.join("\n");
}

// ── SEO Score ─────────────────────────────────────────────────────────────────
function calcScore(f: FormData): { score: number; issues: string[] } {
  let s = 0;
  const issues: string[] = [];

  if (f.title) { s += 10; } else { issues.push("Add a page title"); }
  if (f.title.length > 0 && f.title.length <= 60) { s += 10; }
  else if (f.title.length > 60) { issues.push(`Title is ${f.title.length} chars — keep under 60`); }

  if (f.description) { s += 10; } else { issues.push("Add a meta description"); }
  if (f.description.length > 0 && f.description.length <= 160) { s += 10; }
  else if (f.description.length > 160) { issues.push(`Description is ${f.description.length} chars — keep under 160`); }

  if (f.canonicalUrl) { s += 10; } else { issues.push("Add a canonical URL"); }
  if (f.keywords)  s += 5;
  if (f.author)    s += 5;
  if (f.ogImage)   { s += 10; } else { issues.push("Add an Open Graph image for social sharing"); }
  if (f.siteName)  s += 5;
  if (f.ogTitle || f.title) s += 5;
  if (f.twitterCard && (f.twitterTitle || f.title)) s += 10;
  if (f.twitterImage || f.ogImage) s += 10;

  return { score: Math.min(100, s), issues };
}

// ── Syntax highlighting ───────────────────────────────────────────────────────
function highlightHtml(raw: string): string {
  // 1. Escape HTML entities to prevent XSS
  const safe = raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

  // 2. Stash comment lines before other replacements
  const comments: string[] = [];
  let h = safe.replace(/([ \t]*&lt;!--[^\n]*--&gt;)/g, (m) => {
    comments.push(`<span style="color:#6a9955">${m}</span>`);
    return `\x00${comments.length - 1}\x00`;
  });

  // 3. Attribute name=value pairs  attr=&quot;value&quot;
  h = h.replace(
    /\b([a-zA-Z][\w:-]*)=(&quot;[^<\n]*?&quot;)/g,
    '<span style="color:#9cdcfe">$1</span>=<span style="color:#ce9178">$2</span>',
  );

  // 4. Tag names  &lt;tagname  or  &lt;/tagname
  h = h.replace(
    /(&lt;\/?)(meta|link|title|html|head|body|script|style)/gi,
    '<span style="color:#569cd6">$1$2</span>',
  );

  // 5. Closing angle brackets
  h = h.replace(/(&gt;)/g, '<span style="color:#808080">$1</span>');

  // 6. Restore comment stash
  h = h.replace(/\x00(\d+)\x00/g, (_, i) => comments[Number(i)]);

  return h;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDomain(url: string): string {
  try { return new URL(url.startsWith("http") ? url : `https://${url}`).hostname; }
  catch { return url || "example.com"; }
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n) + "…" : s;
}

const ACCENT = "#f97316";

// ── Shared input styles ───────────────────────────────────────────────────────
const inputCls =
  "w-full rounded-xl px-3 py-2.5 text-[13px] outline-none transition-all bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] focus:border-[rgba(249,115,22,0.4)] text-[#e8dff0] placeholder-[#3d3345]";
const selectCls =
  "w-full rounded-xl px-3 py-2.5 text-[13px] outline-none transition-all bg-[#1a1525] border border-[rgba(255,255,255,0.08)] focus:border-[rgba(249,115,22,0.4)] text-[#e8dff0]";
const labelCls = "text-[11px] font-semibold text-[#988d9f]";
const sectionCls = "glass-panel rounded-2xl p-5 flex flex-col gap-4";
const sectionBorder = "1px solid rgba(255,255,255,0.07)";

// ── Form field helpers ────────────────────────────────────────────────────────
function FieldText({
  id, label, value, onChange, placeholder, maxLen, hint,
}: {
  id: string; label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; maxLen?: number; hint?: string;
}) {
  const over = maxLen !== undefined && value.length > maxLen;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className={labelCls}>{label}</label>
        {hint && <span className="text-[10px] text-[#4d4354]">{hint}</span>}
        {maxLen !== undefined && (
          <span className={`text-[10px] font-semibold tabular-nums ml-auto ${over ? "text-red-400" : "text-[#3d3345]"}`}>
            {value.length}/{maxLen}
          </span>
        )}
      </div>
      <input
        id={id} type="text" value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className={inputCls}
        style={over ? { borderColor: "rgba(248,113,113,0.5)" } : undefined}
        aria-label={label}
      />
    </div>
  );
}

function FieldTextarea({
  id, label, value, onChange, placeholder, maxLen,
}: {
  id: string; label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; maxLen?: number;
}) {
  const over = maxLen !== undefined && value.length > maxLen;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <label htmlFor={id} className={labelCls}>{label}</label>
        {maxLen !== undefined && (
          <span className={`text-[10px] font-semibold tabular-nums ${over ? "text-red-400" : "text-[#3d3345]"}`}>
            {value.length}/{maxLen}
          </span>
        )}
      </div>
      <textarea
        id={id} rows={2} value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className={`${inputCls} resize-none`}
        style={over ? { borderColor: "rgba(248,113,113,0.5)" } : undefined}
        aria-label={label}
      />
    </div>
  );
}

function FieldSelect({
  id, label, value, onChange, options,
}: {
  id: string; label: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className={labelCls}>{label}</label>
      <select id={id} value={value} onChange={e => onChange(e.target.value)}
        className={selectCls} aria-label={label}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function MetaTagGeneratorTool() {
  const [form, setForm] = useState<FormData>(DEFAULT);
  const set = useCallback(<K extends keyof FormData>(k: K, v: FormData[K]) =>
    setForm(prev => ({ ...prev, [k]: v })), []);

  const [generatedCode, setGeneratedCode] = useState("");
  const [copied,        setCopied]        = useState(false);
  const [activeTab,     setActiveTab]     = useState<"google" | "facebook" | "twitter">("google");

  const { score, issues } = useMemo(() => calcScore(form), [form]);

  const scoreColor = score >= 71 ? "#22c55e" : score >= 41 ? "#f59e0b" : "#ef4444";
  const scoreLabel = score >= 71 ? "Good" : score >= 41 ? "Needs work" : "Poor";
  const circ = 2 * Math.PI * 34;

  // Live preview values
  const prevTitle   = truncate(form.ogTitle || form.title || "Page Title", 65);
  const prevDesc    = truncate(form.ogDescription || form.description || "Your page description will appear here in search results.", 160);
  const prevUrl     = form.canonicalUrl || form.websiteUrl || "https://example.com";
  const domain      = fmtDomain(prevUrl);
  const twTitle     = truncate(form.twitterTitle || form.title || "Page Title", 70);
  const twDesc      = truncate(form.twitterDescription || form.description || "Your page description.", 200);
  const hasImg      = !!(form.ogImage || form.twitterImage);
  const imgSrc      = form.ogImage || form.twitterImage || "";

  const generate = useCallback(() => {
    setGeneratedCode(generateMetaTags(form));
  }, [form]);

  const copy = useCallback(async () => {
    if (!generatedCode) return;
    try {
      await navigator.clipboard.writeText(generatedCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard blocked */ }
  }, [generatedCode]);

  const downloadHTML = useCallback(() => {
    if (!generatedCode) return;
    const blob = new Blob([generatedCode], { type: "text/html" });
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement("a"), { href: url, download: "meta-tags.html" });
    a.click();
    URL.revokeObjectURL(url);
  }, [generatedCode]);

  const reset = useCallback(() => {
    setForm(DEFAULT);
    setGeneratedCode("");
    setCopied(false);
  }, []);

  return (
    <div className="mb-12 flex flex-col gap-6">

      {/* ── SEO Score ─────────────────────────────────────────────────── */}
      <div className="glass-panel rounded-2xl p-5 flex flex-wrap items-start gap-6"
        style={{ border: sectionBorder }}>
        {/* Circular gauge */}
        <div className="flex flex-col items-center gap-2 shrink-0">
          <div className="relative w-20 h-20">
            <svg width="80" height="80" viewBox="0 0 80 80" aria-hidden>
              <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="6" />
              <circle cx="40" cy="40" r="34" fill="none"
                stroke={scoreColor} strokeWidth="6"
                strokeDasharray={circ}
                strokeDashoffset={circ * (1 - score / 100)}
                strokeLinecap="round"
                transform="rotate(-90 40 40)"
                style={{ transition: "stroke-dashoffset 0.4s ease, stroke 0.4s ease" }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[18px] font-black tabular-nums" style={{ color: scoreColor, lineHeight: 1 }}>
                {score}
              </span>
              <span className="text-[9px] font-bold" style={{ color: scoreColor, opacity: 0.7 }}>/ 100</span>
            </div>
          </div>
          <span className="text-[11px] font-bold" style={{ color: scoreColor }}>{scoreLabel}</span>
        </div>

        {/* Issues list */}
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-bold mb-2" style={{ color: "#e8dff0" }}>SEO Score</p>
          {issues.length === 0 ? (
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px] text-green-400">check_circle</span>
              <span className="text-[12px]" style={{ color: "#22c55e" }}>All key SEO fields are complete.</span>
            </div>
          ) : (
            <ul className="flex flex-col gap-1">
              {issues.map((issue, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="material-symbols-outlined text-[13px] mt-0.5 shrink-0" style={{ color: "#f59e0b" }}>warning</span>
                  <span className="text-[12px]" style={{ color: "#c8b89f" }}>{issue}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Live preview tabs */}
        <div className="flex gap-2 shrink-0 self-start">
          {(["google", "facebook", "twitter"] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              aria-pressed={activeTab === tab}
              className="px-3 py-1.5 rounded-xl text-[11px] font-bold capitalize transition-all"
              style={{
                background: activeTab === tab ? "rgba(249,115,22,0.12)" : "rgba(255,255,255,0.04)",
                border:     `1px solid ${activeTab === tab ? "rgba(249,115,22,0.35)" : "rgba(255,255,255,0.07)"}`,
                color:      activeTab === tab ? ACCENT : "#988d9f",
              }}>{tab}</button>
          ))}
        </div>
      </div>

      {/* ── Live Previews ─────────────────────────────────────────────── */}
      {activeTab === "google" && (
        <div className="glass-panel rounded-2xl p-5 flex flex-col gap-3"
          style={{ border: sectionBorder }}>
          <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "#988d9f" }}>
            Google Search Preview
          </p>
          <div className="rounded-xl p-4 max-w-xl" style={{ background: "#fff" }}>
            <div className="text-[12px] mb-1" style={{ color: "#4d5156" }}>{domain}</div>
            <div className="text-[18px] font-normal mb-0.5 leading-snug"
              style={{ color: "#1a0dab", fontFamily: "arial, sans-serif" }}>
              {prevTitle}
            </div>
            <div className="text-[13px] leading-relaxed"
              style={{ color: "#4d5156", fontFamily: "arial, sans-serif" }}>
              {prevDesc}
            </div>
          </div>
          {!form.title && !form.description && (
            <p className="text-[11px]" style={{ color: "#3d3345" }}>Fill in Title and Description to see your Google preview.</p>
          )}
        </div>
      )}

      {activeTab === "facebook" && (
        <div className="glass-panel rounded-2xl p-5 flex flex-col gap-3"
          style={{ border: sectionBorder }}>
          <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "#988d9f" }}>
            Facebook / Open Graph Preview
          </p>
          <div className="rounded-xl overflow-hidden max-w-md" style={{ background: "#f0f2f5" }}>
            {/* Image */}
            <div className="w-full flex items-center justify-center"
              style={{ height: 210, background: hasImg ? "#000" : "#e4e6eb" }}>
              {hasImg && imgSrc ? (
                <img src={imgSrc} alt="OG preview" className="w-full h-full object-cover"
                  onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
              ) : (
                <span className="material-symbols-outlined text-[48px]" style={{ color: "#bcc0c4" }}>image</span>
              )}
            </div>
            {/* Card body */}
            <div className="px-3 py-2.5" style={{ borderTop: "1px solid #ccd0d5" }}>
              <div className="text-[11px] uppercase mb-0.5" style={{ color: "#606770", fontFamily: "Helvetica, Arial, sans-serif" }}>
                {domain}
              </div>
              <div className="text-[14px] font-semibold leading-snug mb-0.5"
                style={{ color: "#050505", fontFamily: "Helvetica, Arial, sans-serif" }}>
                {prevTitle}
              </div>
              <div className="text-[12px]"
                style={{ color: "#606770", fontFamily: "Helvetica, Arial, sans-serif" }}>
                {truncate(prevDesc, 100)}
              </div>
            </div>
          </div>
          {!form.ogImage && (
            <p className="text-[11px]" style={{ color: "#3d3345" }}>Add an OG Image URL to see a rich image preview.</p>
          )}
        </div>
      )}

      {activeTab === "twitter" && (
        <div className="glass-panel rounded-2xl p-5 flex flex-col gap-3"
          style={{ border: sectionBorder }}>
          <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "#988d9f" }}>
            Twitter / X Card Preview
          </p>
          <div className="rounded-2xl overflow-hidden max-w-md"
            style={{ background: "#fff", border: "1px solid #e1e8ed" }}>
            {form.twitterCard === "summary_large_image" ? (
              <>
                <div className="w-full flex items-center justify-center"
                  style={{ height: 200, background: hasImg ? "#000" : "#e1e8ed" }}>
                  {hasImg && imgSrc ? (
                    <img src={imgSrc} alt="Twitter preview" className="w-full h-full object-cover"
                      onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                  ) : (
                    <span className="material-symbols-outlined text-[40px]" style={{ color: "#b0bec5" }}>image</span>
                  )}
                </div>
                <div className="px-3 py-2.5">
                  <div className="text-[15px] font-bold leading-snug mb-0.5"
                    style={{ color: "#14171a", fontFamily: "system-ui, sans-serif" }}>
                    {twTitle}
                  </div>
                  <div className="text-[14px] leading-snug mb-1"
                    style={{ color: "#657786", fontFamily: "system-ui, sans-serif" }}>
                    {truncate(twDesc, 90)}
                  </div>
                  <div className="flex items-center gap-1 text-[13px]"
                    style={{ color: "#657786" }}>
                    <span className="material-symbols-outlined text-[13px]">link</span>
                    {domain}
                  </div>
                </div>
              </>
            ) : (
              <div className="flex gap-3 p-3">
                <div className="flex-shrink-0 w-[100px] h-[100px] rounded-xl flex items-center justify-center"
                  style={{ background: hasImg ? "#000" : "#e1e8ed" }}>
                  {hasImg && imgSrc ? (
                    <img src={imgSrc} alt="Twitter preview" className="w-full h-full object-cover rounded-xl"
                      onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                  ) : (
                    <span className="material-symbols-outlined text-[28px]" style={{ color: "#b0bec5" }}>image</span>
                  )}
                </div>
                <div className="flex flex-col gap-0.5 min-w-0">
                  <div className="text-[14px] font-bold truncate" style={{ color: "#14171a" }}>{twTitle}</div>
                  <div className="text-[13px] leading-snug" style={{ color: "#657786" }}>{truncate(twDesc, 60)}</div>
                  <div className="text-[12px] flex items-center gap-1" style={{ color: "#657786" }}>
                    <span className="material-symbols-outlined text-[12px]">link</span>{domain}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Basic SEO ──────────────────────────────────────────────────── */}
      <div className={sectionCls} style={{ border: sectionBorder }}>
        <div className="flex items-center gap-2 pb-1" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
          <span className="material-symbols-outlined text-[16px]" style={{ color: ACCENT }}>search</span>
          <p className="text-[13px] font-bold" style={{ color: "#e8dff0" }}>Basic SEO</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <FieldText id="title" label="Page Title" value={form.title}
              onChange={v => set("title", v)} maxLen={60}
              placeholder="My Awesome Website — Main Keyword" />
          </div>
          <div className="sm:col-span-2">
            <FieldTextarea id="description" label="Meta Description" value={form.description}
              onChange={v => set("description", v)} maxLen={160}
              placeholder="A concise description of this page for search engines and social sharing." />
          </div>
          <FieldText id="canonicalUrl" label="Canonical URL" value={form.canonicalUrl}
            onChange={v => set("canonicalUrl", v)} placeholder="https://example.com/page"
            hint="Recommended" />
          <FieldText id="websiteUrl" label="Website URL" value={form.websiteUrl}
            onChange={v => set("websiteUrl", v)} placeholder="https://example.com" />
          <FieldText id="author" label="Author" value={form.author}
            onChange={v => set("author", v)} placeholder="John Smith" />
          <FieldText id="keywords" label="Keywords" value={form.keywords}
            onChange={v => set("keywords", v)} placeholder="keyword1, keyword2, keyword3" />
          <FieldSelect id="language" label="Language" value={form.language}
            onChange={v => set("language", v)}
            options={[
              { value: "en", label: "English (en)" },
              { value: "en-US", label: "English US (en-US)" },
              { value: "en-GB", label: "English GB (en-GB)" },
              { value: "de", label: "German (de)" },
              { value: "fr", label: "French (fr)" },
              { value: "es", label: "Spanish (es)" },
              { value: "it", label: "Italian (it)" },
              { value: "pt", label: "Portuguese (pt)" },
              { value: "nl", label: "Dutch (nl)" },
              { value: "ja", label: "Japanese (ja)" },
              { value: "zh", label: "Chinese (zh)" },
              { value: "ar", label: "Arabic (ar)" },
            ]} />
          <FieldSelect id="robots" label="Robots Directive" value={form.robots}
            onChange={v => set("robots", v)}
            options={[
              { value: "index, follow",         label: "index, follow (default)" },
              { value: "noindex, follow",        label: "noindex, follow" },
              { value: "index, nofollow",        label: "index, nofollow" },
              { value: "noindex, nofollow",      label: "noindex, nofollow" },
              { value: "noarchive",              label: "noarchive" },
              { value: "nosnippet",              label: "nosnippet" },
              { value: "noimageindex",           label: "noimageindex" },
            ]} />
        </div>
      </div>

      {/* ── Open Graph ─────────────────────────────────────────────────── */}
      <div className={sectionCls} style={{ border: sectionBorder }}>
        <div className="flex items-center gap-2 pb-1" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
          <span className="material-symbols-outlined text-[16px]" style={{ color: ACCENT }}>share</span>
          <p className="text-[13px] font-bold" style={{ color: "#e8dff0" }}>Open Graph</p>
          <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: "rgba(249,115,22,0.1)", color: ACCENT }}>Facebook · LinkedIn</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <FieldText id="ogTitle" label="OG Title" value={form.ogTitle}
              onChange={v => set("ogTitle", v)} maxLen={60}
              placeholder="Leave blank to inherit Page Title" />
          </div>
          <div className="sm:col-span-2">
            <FieldTextarea id="ogDescription" label="OG Description" value={form.ogDescription}
              onChange={v => set("ogDescription", v)} maxLen={160}
              placeholder="Leave blank to inherit Meta Description" />
          </div>
          <div className="sm:col-span-2">
            <FieldText id="ogImage" label="OG Image URL" value={form.ogImage}
              onChange={v => set("ogImage", v)} hint="1200×630 px recommended"
              placeholder="https://example.com/og-image.jpg" />
          </div>
          <FieldText id="ogUrl" label="OG URL" value={form.ogUrl}
            onChange={v => set("ogUrl", v)} placeholder="https://example.com/page" />
          <FieldSelect id="ogType" label="OG Type" value={form.ogType}
            onChange={v => set("ogType", v)}
            options={[
              { value: "website",    label: "website" },
              { value: "article",    label: "article" },
              { value: "product",    label: "product" },
              { value: "video.movie", label: "video.movie" },
              { value: "music.song", label: "music.song" },
              { value: "book",       label: "book" },
              { value: "profile",    label: "profile" },
            ]} />
          <FieldText id="siteName" label="Site Name" value={form.siteName}
            onChange={v => set("siteName", v)} placeholder="My Website" />
          <FieldSelect id="locale" label="Locale" value={form.locale}
            onChange={v => set("locale", v)}
            options={[
              { value: "en_US", label: "en_US" },
              { value: "en_GB", label: "en_GB" },
              { value: "de_DE", label: "de_DE" },
              { value: "fr_FR", label: "fr_FR" },
              { value: "es_ES", label: "es_ES" },
              { value: "it_IT", label: "it_IT" },
              { value: "pt_BR", label: "pt_BR" },
              { value: "ja_JP", label: "ja_JP" },
              { value: "zh_CN", label: "zh_CN" },
              { value: "ar_SA", label: "ar_SA" },
            ]} />
        </div>
      </div>

      {/* ── Twitter Cards ──────────────────────────────────────────────── */}
      <div className={sectionCls} style={{ border: sectionBorder }}>
        <div className="flex items-center gap-2 pb-1" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
          <span className="material-symbols-outlined text-[16px]" style={{ color: ACCENT }}>alternate_email</span>
          <p className="text-[13px] font-bold" style={{ color: "#e8dff0" }}>Twitter Cards</p>
          <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: "rgba(249,115,22,0.1)", color: ACCENT }}>Twitter · X</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FieldSelect id="twitterCard" label="Card Type" value={form.twitterCard}
            onChange={v => set("twitterCard", v)}
            options={[
              { value: "summary_large_image", label: "Summary with Large Image" },
              { value: "summary",             label: "Summary" },
              { value: "app",                 label: "App" },
              { value: "player",              label: "Player" },
            ]} />
          <FieldText id="twitterCreator" label="Creator Handle" value={form.twitterCreator}
            onChange={v => set("twitterCreator", v)} placeholder="@username" />
          <div className="sm:col-span-2">
            <FieldText id="twitterTitle" label="Twitter Title" value={form.twitterTitle}
              onChange={v => set("twitterTitle", v)} maxLen={70}
              placeholder="Leave blank to inherit Page Title" />
          </div>
          <div className="sm:col-span-2">
            <FieldTextarea id="twitterDescription" label="Twitter Description" value={form.twitterDescription}
              onChange={v => set("twitterDescription", v)} maxLen={200}
              placeholder="Leave blank to inherit Meta Description" />
          </div>
          <div className="sm:col-span-2">
            <FieldText id="twitterImage" label="Twitter Image URL" value={form.twitterImage}
              onChange={v => set("twitterImage", v)} hint="800×418 px recommended"
              placeholder="https://example.com/twitter-card.jpg" />
          </div>
        </div>
      </div>

      {/* ── Technical ──────────────────────────────────────────────────── */}
      <div className={sectionCls} style={{ border: sectionBorder }}>
        <div className="flex items-center gap-2 pb-1" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
          <span className="material-symbols-outlined text-[16px]" style={{ color: ACCENT }}>settings</span>
          <p className="text-[13px] font-bold" style={{ color: "#e8dff0" }}>Technical</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FieldSelect id="charset" label="Charset" value={form.charset}
            onChange={v => set("charset", v)}
            options={[
              { value: "UTF-8",   label: "UTF-8 (recommended)" },
              { value: "UTF-16",  label: "UTF-16" },
              { value: "ISO-8859-1", label: "ISO-8859-1" },
            ]} />
          <FieldText id="viewport" label="Viewport" value={form.viewport}
            onChange={v => set("viewport", v)}
            placeholder="width=device-width, initial-scale=1" />
          <div className="flex flex-col gap-1.5">
            <label htmlFor="themeColor" className={labelCls}>Theme Color</label>
            <div className="flex gap-2 items-center">
              <input id="themeColor" type="color" value={form.themeColor}
                onChange={e => set("themeColor", e.target.value)}
                className="w-10 h-9 rounded-lg cursor-pointer border border-[rgba(255,255,255,0.08)] bg-transparent"
                aria-label="Theme Color picker" />
              <input type="text" value={form.themeColor}
                onChange={e => set("themeColor", e.target.value)}
                placeholder="#ffffff" className={`${inputCls} flex-1`}
                aria-label="Theme Color hex value" />
            </div>
          </div>
          <FieldText id="favicon" label="Favicon URL" value={form.favicon}
            onChange={v => set("favicon", v)} placeholder="/favicon.ico" />
        </div>
      </div>

      {/* ── Action buttons ─────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-3">
        <button onClick={generate}
          className="btn-primary flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm">
          <span className="material-symbols-outlined text-[16px]">code</span>
          Generate Meta Tags
        </button>
        {generatedCode && (
          <>
            <button onClick={copy}
              className="flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm transition-all"
              style={{ background: "rgba(249,115,22,0.1)", color: ACCENT, border: "1px solid rgba(249,115,22,0.25)" }}>
              <span className="material-symbols-outlined text-[16px]">
                {copied ? "check" : "content_copy"}
              </span>
              {copied ? "Copied!" : "Copy Code"}
            </button>
            <button onClick={downloadHTML}
              className="flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm transition-all"
              style={{ background: "rgba(255,255,255,0.05)", color: "#988d9f", border: "1px solid rgba(255,255,255,0.08)" }}>
              <span className="material-symbols-outlined text-[16px]">download</span>
              Download HTML
            </button>
          </>
        )}
        <button onClick={reset}
          className="flex items-center gap-2 px-4 py-3 rounded-xl font-semibold text-sm transition-all"
          style={{ background: "rgba(255,255,255,0.04)", color: "#988d9f", border: "1px solid rgba(255,255,255,0.07)" }}>
          <span className="material-symbols-outlined text-[15px]">restart_alt</span>Reset
        </button>
      </div>

      {/* ── Generated code output ───────────────────────────────────────── */}
      {generatedCode && (
        <div className="glass-panel rounded-2xl overflow-hidden"
          style={{ border: "1px solid rgba(249,115,22,0.18)" }}>
          <div className="px-5 py-3 flex items-center justify-between"
            style={{ borderBottom: "1px solid rgba(249,115,22,0.1)", background: "rgba(249,115,22,0.03)" }}>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[14px]" style={{ color: ACCENT }}>code</span>
              <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: ACCENT }}>Generated HTML</span>
            </div>
            <button onClick={copy}
              className="flex items-center gap-1.5 px-3 py-1 rounded-xl text-[11px] font-bold transition-all"
              style={{ background: "rgba(249,115,22,0.1)", color: ACCENT }}>
              <span className="material-symbols-outlined text-[12px]">
                {copied ? "check" : "content_copy"}
              </span>
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
          <pre className="p-5 overflow-x-auto text-[12px] leading-relaxed m-0"
            style={{ fontFamily: "'Cascadia Code', 'Fira Code', 'Courier New', monospace", background: "#0d0d14" }}>
            <code
              dangerouslySetInnerHTML={{ __html: highlightHtml(generatedCode) }}
            />
          </pre>
        </div>
      )}
    </div>
  );
}
