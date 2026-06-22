"use client";

/**
 * Open Graph Generator
 *
 * Architecture:
 *   State: form{} (all OG fields), previewTab, copiedHtml, imgError
 *   Derived (useMemo): output HTML string, validation score + issues
 *
 * Generation:
 *   generateTags() → <!-- comment --> followed by <meta property="…" content="…" /> lines
 *   Attribute values are HTML-escaped (&→&amp; "→&#34;) to produce valid HTML
 *
 * Syntax highlight:
 *   hlHtml() — parse <meta> tags before escaping; color tag name (blue),
 *   attribute names (light blue), attribute values (orange), comments (green)
 *
 * Validation score 0–100:
 *   title (+20), description (+15), image (+20), url (+15),
 *   type (+10), image dimensions (+10), image alt (+10)
 *
 * Social previews:
 *   Facebook — white card, top image + gray footer
 *   LinkedIn  — white card, top image + title/domain
 *   Discord   — dark card, left blurple border, embed layout
 *   WhatsApp  — dark bubble with image top
 */

import { useState, useMemo, useCallback, type CSSProperties } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────
type OGType    = "website" | "article" | "product" | "profile" | "book" | "music.song" | "video.movie";
type PreviewTab = "facebook" | "linkedin" | "discord" | "whatsapp";

interface FormState {
  url:                   string;
  title:                 string;
  description:           string;
  image:                 string;
  imageWidth:            string;
  imageHeight:           string;
  imageAlt:              string;
  siteName:              string;
  locale:                string;
  type:                  OGType;
  articleAuthor:         string;
  articlePublishedTime:  string;
  articleModifiedTime:   string;
  articleSection:        string;
  articleTags:           string;
}

// ── Constants ─────────────────────────────────────────────────────────────────
const ACCENT = "#f97316";

const OG_TYPES: { value: OGType; label: string; icon: string }[] = [
  { value: "website",     label: "Website",   icon: "language"      },
  { value: "article",     label: "Article",   icon: "article"       },
  { value: "product",     label: "Product",   icon: "shopping_bag"  },
  { value: "profile",     label: "Profile",   icon: "person"        },
  { value: "book",        label: "Book",      icon: "menu_book"     },
  { value: "music.song",  label: "Music",     icon: "music_note"    },
  { value: "video.movie", label: "Video",     icon: "videocam"      },
];

const LOCALE_OPTS = [
  { value: "en_US", label: "en_US — English (US)"      },
  { value: "en_GB", label: "en_GB — English (UK)"      },
  { value: "fr_FR", label: "fr_FR — Français"          },
  { value: "de_DE", label: "de_DE — Deutsch"           },
  { value: "es_ES", label: "es_ES — Español"           },
  { value: "it_IT", label: "it_IT — Italiano"          },
  { value: "pt_BR", label: "pt_BR — Português (BR)"    },
  { value: "ja_JP", label: "ja_JP — 日本語"             },
  { value: "zh_CN", label: "zh_CN — 中文 (简体)"        },
  { value: "ko_KR", label: "ko_KR — 한국어"             },
  { value: "nl_NL", label: "nl_NL — Nederlands"        },
  { value: "ru_RU", label: "ru_RU — Русский"           },
];

const DEFAULT_FORM: FormState = {
  url: "", title: "", description: "", image: "",
  imageWidth: "1200", imageHeight: "630", imageAlt: "",
  siteName: "", locale: "en_US", type: "website",
  articleAuthor: "", articlePublishedTime: "",
  articleModifiedTime: "", articleSection: "", articleTags: "",
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function getDomain(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ""); }
  catch { return url || "example.com"; }
}

function isValidUrl(s: string): boolean {
  try { new URL(s); return true; } catch { return false; }
}

function escAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&#34;").replace(/</g, "&lt;");
}

// ── HTML generation ───────────────────────────────────────────────────────────
function generateTags(f: FormState): string {
  const lines: string[] = ["<!-- Open Graph Meta Tags -->"];

  const add = (prop: string, content: string) => {
    if (content.trim())
      lines.push(`<meta property="${prop}" content="${escAttr(content.trim())}" />`);
  };

  add("og:type",        f.type);
  add("og:url",         f.url);
  add("og:title",       f.title);
  add("og:description", f.description);
  add("og:image",       f.image);
  if (f.imageWidth)  add("og:image:width",  f.imageWidth);
  if (f.imageHeight) add("og:image:height", f.imageHeight);
  if (f.imageAlt)    add("og:image:alt",    f.imageAlt);
  if (f.siteName)    add("og:site_name",    f.siteName);
  if (f.locale)      add("og:locale",       f.locale);

  if (f.type === "article") {
    if (f.articleAuthor)        add("article:author",         f.articleAuthor);
    if (f.articlePublishedTime) add("article:published_time", f.articlePublishedTime);
    if (f.articleModifiedTime)  add("article:modified_time",  f.articleModifiedTime);
    if (f.articleSection)       add("article:section",        f.articleSection);
    f.articleTags.split(",").map(t => t.trim()).filter(Boolean)
      .forEach(tag => add("article:tag", tag));
  }

  return lines.join("\n");
}

// ── Syntax highlight ──────────────────────────────────────────────────────────
function hlHtml(raw: string): string {
  const escDisplay = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  return raw.split("\n").map(line => {
    const trimmed = line.trim();
    if (!trimmed) return "";

    // Comments
    if (trimmed.startsWith("<!--")) {
      return `<span style="color:#6a9955">${escDisplay(trimmed)}</span>`;
    }

    // Meta tags — parse before escaping to color each part accurately
    const m = trimmed.match(/^<(meta)\s+([\s\S]*?)\s*\/?>$/);
    if (!m) return escDisplay(trimmed);

    const tagName  = m[1];
    const attrsRaw = m[2] ?? "";

    // Color each attr="value" pair
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

// ── Validation ────────────────────────────────────────────────────────────────
interface Issue { level: "error" | "warning" | "info"; text: string; }

function validate(f: FormState): { score: number; issues: Issue[] } {
  const issues: Issue[] = [];
  let score = 0;

  // og:title (+20)
  if (f.title) {
    score += 20;
    if (f.title.length > 90)
      issues.push({ level: "warning", text: "Title exceeds 90 characters — some platforms may truncate it." });
  } else {
    issues.push({ level: "error", text: "og:title is required — it becomes the headline of your link card." });
  }

  // og:description (+15)
  if (f.description) {
    score += 15;
    if (f.description.length > 200)
      issues.push({ level: "warning", text: "Description exceeds 200 characters and may be cut short on some platforms." });
  } else {
    issues.push({ level: "error", text: "og:description is required — it appears as the card subtitle." });
  }

  // og:image (+20)
  if (f.image) {
    if (isValidUrl(f.image)) score += 20;
    else issues.push({ level: "error", text: "og:image must be an absolute URL (https://…) — relative URLs are not supported." });
  } else {
    issues.push({ level: "error", text: "og:image is required — cards without images get far lower engagement." });
  }

  // og:url (+15)
  if (f.url) {
    if (isValidUrl(f.url)) score += 15;
    else issues.push({ level: "error", text: "og:url must be a valid absolute URL (https://…)." });
  } else {
    issues.push({ level: "warning", text: "og:url is recommended — it sets the canonical URL for social sharing." });
  }

  // og:type (+10)
  if (f.type) score += 10;

  // Image dimensions (+10)
  if (f.imageWidth && f.imageHeight) {
    score += 10;
    const w = parseInt(f.imageWidth), h = parseInt(f.imageHeight);
    if (w < 200 || h < 200)
      issues.push({ level: "warning", text: "Image is very small — Facebook recommends a minimum of 1200×630 px." });
    else if (!(w === 1200 && h === 630))
      issues.push({ level: "info", text: "Optimal image size is 1200×630 px (1.91:1 ratio) for Facebook and LinkedIn." });
  } else {
    issues.push({ level: "info", text: "Add og:image:width and og:image:height for better cache handling across platforms." });
  }

  // Image alt (+10)
  if (f.imageAlt) score += 10;
  else issues.push({ level: "info", text: "Add og:image:alt for improved accessibility and screen reader support." });

  return { score: Math.min(100, score), issues };
}

// ── Shared styles ─────────────────────────────────────────────────────────────
const inputCls = [
  "w-full rounded-xl px-3 py-2.5 text-[13px] outline-none transition-all",
  "bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)]",
  "focus:border-[rgba(249,115,22,0.4)] text-[#e8dff0] placeholder-[#3d3345]",
].join(" ");

const selectCls = [
  "w-full rounded-xl px-2.5 py-2 text-[13px] outline-none transition-all cursor-pointer",
  "bg-[#1a1525] border border-[rgba(255,255,255,0.08)]",
  "focus:border-[rgba(249,115,22,0.4)] text-[#e8dff0]",
].join(" ");

const labelCls = "text-[11px] font-semibold text-[#988d9f]";

// ── Preview image helper ──────────────────────────────────────────────────────
function PreviewImg({
  src, hasError, onError, alt, className, style,
}: {
  src: string; hasError: boolean; onError: () => void;
  alt?: string; className?: string; style?: CSSProperties;
}) {
  if (src && !hasError) {
    return (
      <img
        src={src} alt={alt ?? ""}
        className={className} style={style}
        onError={onError}
      />
    );
  }
  return (
    <div
      className={`flex items-center justify-center ${className ?? ""}`}
      style={{ background: "#2a2535", ...style }}>
      <span className="material-symbols-outlined text-[28px]" style={{ color: "#3d3345" }}>image</span>
    </div>
  );
}

// ── Panel header ──────────────────────────────────────────────────────────────
function PanelHeader({ icon, title, hint }: { icon: string; title: string; hint?: string }) {
  return (
    <div className="flex items-center gap-2 pb-1"
      style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
      <span className="material-symbols-outlined text-[16px]" style={{ color: ACCENT }}>{icon}</span>
      <p className="text-[13px] font-bold" style={{ color: "#e8dff0" }}>{title}</p>
      {hint && <span className="text-[10px] ml-1" style={{ color: "#3d3345" }}>{hint}</span>}
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function OpenGraphGeneratorTool() {
  const [form,       setForm]       = useState<FormState>(DEFAULT_FORM);
  const [prevTab,    setPrevTab]    = useState<PreviewTab>("facebook");
  const [copiedHtml, setCopiedHtml] = useState(false);
  const [imgError,   setImgError]   = useState(false);

  const set = useCallback(<K extends keyof FormState>(key: K, val: FormState[K]) => {
    setForm(p => ({ ...p, [key]: val }));
    if (key === "image") setImgError(false);
  }, []);

  // Derived
  const output               = useMemo(() => generateTags(form), [form]);
  const { score, issues }    = useMemo(() => validate(form), [form]);
  const scoreColor = score >= 71 ? "#22c55e" : score >= 41 ? "#f59e0b" : "#ef4444";
  const scoreLabel = score >= 71 ? "Good" : score >= 41 ? "Needs work" : "Poor";
  const circ = 2 * Math.PI * 34;

  const displayTitle  = form.title       || "Your Page Title";
  const displayDesc   = form.description || "Your page description will appear here.";
  const displayDomain = form.url ? getDomain(form.url) : "example.com";
  const displaySite   = form.siteName    || displayDomain;
  const imgProps = {
    src: form.image, hasError: imgError,
    onError: () => setImgError(true),
    alt: form.imageAlt || form.title || "Preview",
  };

  // Actions
  const copyHtml = useCallback(async () => {
    try { await navigator.clipboard.writeText(output); } catch { /* blocked */ }
    setCopiedHtml(true);
    setTimeout(() => setCopiedHtml(false), 2000);
  }, [output]);

  const download = useCallback(() => {
    const blob = new Blob([output], { type: "text/html" });
    const url  = URL.createObjectURL(blob);
    Object.assign(document.createElement("a"), { href: url, download: "og-tags.html" }).click();
    URL.revokeObjectURL(url);
  }, [output]);

  const reset = useCallback(() => {
    setForm(DEFAULT_FORM);
    setCopiedHtml(false);
    setImgError(false);
  }, []);

  return (
    <div className="mb-12 flex flex-col gap-6">

      {/* ── Basic Information ────────────────────────────── */}
      <div className="glass-panel rounded-2xl p-5 flex flex-col gap-4"
        style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
        <PanelHeader icon="info" title="Basic Information" />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="og-url" className={labelCls}>Page URL</label>
            <input
              id="og-url" type="url" value={form.url}
              onChange={e => set("url", e.target.value)}
              placeholder="https://example.com/page"
              className={inputCls}
              style={form.url && !isValidUrl(form.url) ? { borderColor: "rgba(239,68,68,0.5)" } : undefined}
              aria-label="Page URL"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="og-sitename" className={labelCls}>Site Name</label>
            <input
              id="og-sitename" value={form.siteName}
              onChange={e => set("siteName", e.target.value)}
              placeholder="My Website"
              className={inputCls}
              aria-label="Site name"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="og-title" className={labelCls}>
            Title
            <span className="ml-2 font-normal tabular-nums"
              style={{ color: form.title.length > 90 ? "#ef4444" : form.title.length > 60 ? "#f59e0b" : "#3d3345" }}>
              {form.title.length}/90
            </span>
          </label>
          <input
            id="og-title" value={form.title}
            onChange={e => set("title", e.target.value)}
            placeholder="Enter your page title"
            className={inputCls}
            aria-label="Open Graph title"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="og-desc" className={labelCls}>
            Description
            <span className="ml-2 font-normal tabular-nums"
              style={{ color: form.description.length > 200 ? "#ef4444" : form.description.length > 160 ? "#f59e0b" : "#3d3345" }}>
              {form.description.length}/200
            </span>
          </label>
          <textarea
            id="og-desc" rows={3}
            value={form.description}
            onChange={e => set("description", e.target.value)}
            placeholder="A compelling description of your page content"
            className={`${inputCls} resize-none`}
            aria-label="Open Graph description"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="og-image" className={labelCls}>Image URL</label>
            <input
              id="og-image" type="url" value={form.image}
              onChange={e => set("image", e.target.value)}
              placeholder="https://example.com/og-image.jpg"
              className={inputCls}
              style={form.image && !isValidUrl(form.image) ? { borderColor: "rgba(239,68,68,0.5)" } : undefined}
              aria-label="Image URL"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="og-locale" className={labelCls}>Locale</label>
            <select
              id="og-locale" value={form.locale}
              onChange={e => set("locale", e.target.value)}
              className={selectCls}
              aria-label="Locale">
              {LOCALE_OPTS.map(l => (
                <option key={l.value} value={l.value}>{l.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ── Content Type ──────────────────────────────────── */}
      <div className="glass-panel rounded-2xl p-5 flex flex-col gap-4"
        style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
        <PanelHeader icon="category" title="Content Type" />

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
          {OG_TYPES.map(t => (
            <button
              key={t.value}
              onClick={() => set("type", t.value)}
              aria-pressed={form.type === t.value}
              className="flex flex-col items-center gap-1.5 px-3 py-2.5 rounded-xl transition-all"
              style={form.type === t.value ? {
                background: "rgba(249,115,22,0.12)", color: ACCENT,
                border: "1px solid rgba(249,115,22,0.32)",
              } : {
                background: "rgba(255,255,255,0.03)", color: "#988d9f",
                border: "1px solid rgba(255,255,255,0.07)",
              }}>
              <span className="material-symbols-outlined text-[18px]">{t.icon}</span>
              <span className="text-[11px] font-semibold">{t.label}</span>
            </button>
          ))}
        </div>

        {/* Article extra fields */}
        {form.type === "article" && (
          <div className="flex flex-col gap-4 pt-3"
            style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: ACCENT }}>
              Article Details
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="og-author" className={labelCls}>Author URL</label>
                <input
                  id="og-author" value={form.articleAuthor}
                  onChange={e => set("articleAuthor", e.target.value)}
                  placeholder="https://example.com/author/"
                  className={inputCls}
                  aria-label="Article author"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="og-section" className={labelCls}>Section</label>
                <input
                  id="og-section" value={form.articleSection}
                  onChange={e => set("articleSection", e.target.value)}
                  placeholder="Technology"
                  className={inputCls}
                  aria-label="Article section"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="og-pubtime" className={labelCls}>Published Time</label>
                <input
                  id="og-pubtime" type="datetime-local"
                  value={form.articlePublishedTime}
                  onChange={e => set("articlePublishedTime", e.target.value)}
                  className={inputCls}
                  style={{ colorScheme: "dark" }}
                  aria-label="Published time"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="og-modtime" className={labelCls}>Modified Time</label>
                <input
                  id="og-modtime" type="datetime-local"
                  value={form.articleModifiedTime}
                  onChange={e => set("articleModifiedTime", e.target.value)}
                  className={inputCls}
                  style={{ colorScheme: "dark" }}
                  aria-label="Modified time"
                />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="og-tags" className={labelCls}>
                Tags
                <span className="ml-2 font-normal" style={{ color: "#3d3345" }}>comma-separated</span>
              </label>
              <input
                id="og-tags" value={form.articleTags}
                onChange={e => set("articleTags", e.target.value)}
                placeholder="seo, marketing, open graph"
                className={inputCls}
                aria-label="Article tags"
              />
            </div>
          </div>
        )}
      </div>

      {/* ── Image Details ─────────────────────────────────── */}
      <div className="glass-panel rounded-2xl p-5 flex flex-col gap-4"
        style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
        <PanelHeader icon="image" title="Image Details" hint="Recommended: 1200 × 630 px" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="og-imgw" className={labelCls}>Width (px)</label>
            <input
              id="og-imgw" type="number" min="1" value={form.imageWidth}
              onChange={e => set("imageWidth", e.target.value)}
              placeholder="1200"
              className={inputCls}
              aria-label="Image width"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="og-imgh" className={labelCls}>Height (px)</label>
            <input
              id="og-imgh" type="number" min="1" value={form.imageHeight}
              onChange={e => set("imageHeight", e.target.value)}
              placeholder="630"
              className={inputCls}
              aria-label="Image height"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="og-imgalt" className={labelCls}>Alt Text</label>
            <input
              id="og-imgalt" value={form.imageAlt}
              onChange={e => set("imageAlt", e.target.value)}
              placeholder="Descriptive image text"
              className={inputCls}
              aria-label="Image alt text"
            />
          </div>
        </div>
      </div>

      {/* ── Social Previews ───────────────────────────────── */}
      <div className="glass-panel rounded-2xl overflow-hidden"
        style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
        {/* Tab bar */}
        <div className="flex items-center px-5 gap-1 flex-wrap"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.01)" }}>
          <span className="material-symbols-outlined text-[15px] mr-2 py-3" style={{ color: ACCENT }}>visibility</span>
          {(["facebook", "linkedin", "discord", "whatsapp"] as PreviewTab[]).map(tab => (
            <button
              key={tab}
              onClick={() => setPrevTab(tab)}
              className="px-4 py-3 text-[12px] font-bold transition-all"
              style={prevTab === tab ? {
                color: ACCENT,
                borderBottom: `2px solid ${ACCENT}`,
                marginBottom: "-1px",
              } : {
                color: "#988d9f",
                borderBottom: "2px solid transparent",
                marginBottom: "-1px",
              }}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Preview canvas */}
        <div className="p-6 flex justify-center items-start"
          style={{ background: "rgba(0,0,0,0.25)", minHeight: 200 }}>

          {/* Facebook */}
          {prevTab === "facebook" && (
            <div className="w-full max-w-[500px]">
              <div className="rounded-lg overflow-hidden"
                style={{ border: "1px solid #dddfe2", fontFamily: "Helvetica Neue,Arial,sans-serif" }}>
                <PreviewImg
                  {...imgProps}
                  className="w-full block object-cover"
                  style={{ aspectRatio: "1.91/1", background: "#e4e6eb" }}
                />
                <div className="px-3 py-2.5"
                  style={{ background: "#f2f3f5", borderTop: "1px solid #dddfe2" }}>
                  <p className="text-[11px] font-medium uppercase mb-0.5 truncate"
                    style={{ color: "#90949c" }}>{displayDomain}</p>
                  <p className="text-[16px] font-bold leading-tight mb-0.5 line-clamp-2"
                    style={{ color: "#1c1e21" }}>{displayTitle}</p>
                  <p className="text-[14px] leading-snug line-clamp-2"
                    style={{ color: "#606770" }}>{displayDesc}</p>
                </div>
              </div>
              <p className="text-[10px] text-center mt-2" style={{ color: "#3d3345" }}>
                Facebook / Instagram link preview
              </p>
            </div>
          )}

          {/* LinkedIn */}
          {prevTab === "linkedin" && (
            <div className="w-full max-w-[520px]">
              <div className="rounded-lg overflow-hidden"
                style={{ border: "1px solid #e8e8e8", fontFamily: "system-ui,-apple-system,sans-serif" }}>
                <PreviewImg
                  {...imgProps}
                  className="w-full block object-cover"
                  style={{ aspectRatio: "1.91/1", background: "#e9e9e9" }}
                />
                <div className="px-4 py-3" style={{ background: "#fff" }}>
                  <p className="text-[14px] font-semibold leading-tight mb-1 line-clamp-2"
                    style={{ color: "#000000e6" }}>{displayTitle}</p>
                  <p className="text-[12px]" style={{ color: "#00000099" }}>{displayDomain}</p>
                </div>
              </div>
              <p className="text-[10px] text-center mt-2" style={{ color: "#3d3345" }}>
                LinkedIn link preview
              </p>
            </div>
          )}

          {/* Discord */}
          {prevTab === "discord" && (
            <div className="w-full max-w-[460px]">
              <div className="rounded-lg overflow-hidden"
                style={{
                  background: "#2f3136",
                  borderLeft: "4px solid #5865f2",
                  fontFamily: "Whitney,Helvetica Neue,Helvetica,Arial,sans-serif",
                }}>
                <div className="px-3 py-3 flex flex-col gap-1">
                  <p className="text-[12px] font-semibold" style={{ color: "#00aff4" }}>{displaySite}</p>
                  <p className="text-[15px] font-semibold leading-tight" style={{ color: "#00b0f4" }}>
                    {displayTitle}
                  </p>
                  <p className="text-[13px] leading-snug line-clamp-3" style={{ color: "#dcddde" }}>
                    {displayDesc}
                  </p>
                  {(form.image && !imgError) && (
                    <PreviewImg
                      {...imgProps}
                      className="block rounded-md mt-2 max-h-[200px] w-full object-cover"
                      style={{ aspectRatio: "1.91/1" }}
                    />
                  )}
                  {!(form.image && !imgError) && (
                    <div className="rounded-md mt-2 flex items-center justify-center"
                      style={{ aspectRatio: "1.91/1", background: "#1a1d21" }}>
                      <span className="material-symbols-outlined text-[24px]"
                        style={{ color: "#3d3345" }}>image</span>
                    </div>
                  )}
                </div>
              </div>
              <p className="text-[10px] text-center mt-2" style={{ color: "#3d3345" }}>
                Discord embed preview
              </p>
            </div>
          )}

          {/* WhatsApp */}
          {prevTab === "whatsapp" && (
            <div className="w-full max-w-[340px]">
              <div className="rounded-xl p-3" style={{ background: "#0b141a" }}>
                <div className="rounded-lg overflow-hidden"
                  style={{ background: "#202c33", fontFamily: "Segoe UI,Helvetica Neue,Helvetica,sans-serif", maxWidth: "90%", marginLeft: "auto" }}>
                  <PreviewImg
                    {...imgProps}
                    className="w-full block object-cover"
                    style={{ aspectRatio: "1.91/1", background: "#1a252c" }}
                  />
                  <div className="px-3 py-2.5">
                    <p className="text-[13px] font-semibold leading-tight line-clamp-2"
                      style={{ color: "#e9edef" }}>{displayTitle}</p>
                    <p className="text-[12px] mt-0.5 line-clamp-2" style={{ color: "#8696a0" }}>
                      {displayDesc}
                    </p>
                    <p className="text-[11px] mt-1" style={{ color: "#00a884" }}>{displayDomain}</p>
                  </div>
                </div>
              </div>
              <p className="text-[10px] text-center mt-2" style={{ color: "#3d3345" }}>
                WhatsApp link preview
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Validation score ──────────────────────────────── */}
      <div className="glass-panel rounded-2xl p-5 flex flex-wrap items-start gap-6"
        style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
        {/* Gauge */}
        <div className="flex flex-col items-center gap-1.5 shrink-0">
          <div className="relative w-20 h-20">
            <svg width="80" height="80" viewBox="0 0 80 80" aria-hidden="true">
              <circle cx="40" cy="40" r="34" fill="none"
                stroke="rgba(255,255,255,0.07)" strokeWidth="6" />
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
              <span className="text-[20px] font-black tabular-nums"
                style={{ color: scoreColor, lineHeight: 1 }}>{score}</span>
              <span className="text-[9px] font-bold"
                style={{ color: scoreColor, opacity: 0.7 }}>/ 100</span>
            </div>
          </div>
          <span className="text-[11px] font-bold" style={{ color: scoreColor }}>{scoreLabel}</span>
        </div>

        {/* Issues */}
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-bold mb-2" style={{ color: "#e8dff0" }}>Validation</p>
          {issues.length === 0 ? (
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px] text-green-400">check_circle</span>
              <span className="text-[13px]" style={{ color: "#22c55e" }}>
                All checks passed — your Open Graph tags are ready!
              </span>
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              {issues.map((iss, i) => {
                const ic = iss.level === "error" ? "#ef4444" : iss.level === "warning" ? "#f59e0b" : "#60a5fa";
                const ig = iss.level === "error" ? "error" : iss.level === "warning" ? "warning" : "info";
                return (
                  <li key={i} className="flex items-start gap-2">
                    <span className="material-symbols-outlined text-[14px] mt-0.5 shrink-0"
                      style={{ color: ic }}>{ig}</span>
                    <span className="text-[12px]" style={{ color: "#c8b89f" }}>{iss.text}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* ── Actions ───────────────────────────────────────── */}
      <div className="flex flex-wrap gap-3">
        <button onClick={copyHtml}
          className="btn-primary flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm">
          <span className="material-symbols-outlined text-[16px]">
            {copiedHtml ? "check" : "content_copy"}
          </span>
          {copiedHtml ? "Copied!" : "Copy HTML"}
        </button>
        <button onClick={download}
          className="flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm transition-all"
          style={{ background: "rgba(249,115,22,0.09)", color: ACCENT, border: "1px solid rgba(249,115,22,0.22)" }}>
          <span className="material-symbols-outlined text-[15px]">download</span>
          Download HTML
        </button>
        <button onClick={reset}
          className="flex items-center gap-2 px-4 py-3 rounded-xl font-semibold text-sm transition-all ml-auto"
          style={{ background: "rgba(255,255,255,0.03)", color: "#988d9f", border: "1px solid rgba(255,255,255,0.07)" }}>
          <span className="material-symbols-outlined text-[14px]">restart_alt</span>Reset
        </button>
      </div>

      {/* ── HTML Output ───────────────────────────────────── */}
      <div className="glass-panel rounded-2xl overflow-hidden"
        style={{ border: "1px solid rgba(249,115,22,0.18)" }}>
        <div className="px-5 py-3 flex items-center justify-between"
          style={{ borderBottom: "1px solid rgba(249,115,22,0.1)", background: "rgba(249,115,22,0.03)" }}>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[14px]" style={{ color: ACCENT }}>code</span>
            <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: ACCENT }}>
              Generated HTML
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
              style={{ background: "rgba(249,115,22,0.1)", color: ACCENT }}>Live</span>
          </div>
          <button onClick={copyHtml}
            className="flex items-center gap-1.5 px-3 py-1 rounded-xl text-[11px] font-bold"
            style={{ background: "rgba(249,115,22,0.1)", color: ACCENT }}>
            <span className="material-symbols-outlined text-[12px]">
              {copiedHtml ? "check" : "content_copy"}
            </span>
            {copiedHtml ? "Copied!" : "Copy"}
          </button>
        </div>

        <pre
          className="p-5 overflow-x-auto text-[12px] leading-relaxed m-0"
          style={{ fontFamily: "'Cascadia Code','Fira Code','Courier New',monospace", background: "#0d0d14" }}>
          <code dangerouslySetInnerHTML={{ __html: hlHtml(output) }} />
        </pre>
      </div>

    </div>
  );
}
