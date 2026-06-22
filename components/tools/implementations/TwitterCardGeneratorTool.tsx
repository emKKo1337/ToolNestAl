"use client";

/**
 * Twitter Card Generator
 *
 * Architecture:
 *   State: form{} + copiedHtml + imgError
 *   Derived (useMemo): output HTML, validation score + issues
 *
 * Card types:
 *   summary             — small square thumbnail + title/desc
 *   summary_large_image — full-width image + title/desc
 *   app                 — App Store / Google Play links
 *   player              — embedded video/audio player
 *
 * Generation:
 *   All tags use name="twitter:…" (not property="og:…")
 *   @handle values are normalised — leading @ added if absent
 *   Attribute values are HTML-escaped (&→&amp;  "→&#34;)
 *
 * Syntax highlight:
 *   hlHtml() — parse <meta> before escaping; color
 *   tag name (blue), attr names (light-blue), values (orange), comments (green)
 *
 * Validation score 0–100:
 *   twitter:card (+15), title (+20), description (+15),
 *   image (+20), @site (+10), image:alt (+10), @creator (+10)
 *   App/Player types: adjusted weights for type-specific fields
 */

import { useState, useMemo, useCallback, type CSSProperties } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────
type CardType = "summary" | "summary_large_image" | "app" | "player";

interface FormState {
  cardType:      CardType;
  site:          string;
  creator:       string;
  title:         string;
  description:   string;
  image:         string;
  imageAlt:      string;
  // App card
  appNameIphone: string;
  appIdIphone:   string;
  appUrlIphone:  string;
  appNameGPlay:  string;
  appIdGPlay:    string;
  appUrlGPlay:   string;
  // Player card
  playerUrl:     string;
  playerWidth:   string;
  playerHeight:  string;
  playerStream:  string;
}

// ── Constants ─────────────────────────────────────────────────────────────────
const ACCENT = "#f97316";

const CARD_TYPES: {
  value: CardType;
  label: string;
  icon: string;
  desc: string;
}[] = [
  {
    value: "summary",
    label: "Summary",
    icon:  "article",
    desc:  "Small thumbnail + title + description. Best for articles and blog posts.",
  },
  {
    value: "summary_large_image",
    label: "Large Image",
    icon:  "image",
    desc:  "Full-width image card. Best for visual content (1200×628 px recommended).",
  },
  {
    value: "app",
    label: "App",
    icon:  "smartphone",
    desc:  "Links to iOS and Android apps on the App Store and Google Play.",
  },
  {
    value: "player",
    label: "Player",
    icon:  "play_circle",
    desc:  "Embeds a video or audio player directly in the post preview.",
  },
];

const DEFAULT_FORM: FormState = {
  cardType:      "summary_large_image",
  site:          "",
  creator:       "",
  title:         "",
  description:   "",
  image:         "",
  imageAlt:      "",
  appNameIphone: "",
  appIdIphone:   "",
  appUrlIphone:  "",
  appNameGPlay:  "",
  appIdGPlay:    "",
  appUrlGPlay:   "",
  playerUrl:     "",
  playerWidth:   "1280",
  playerHeight:  "720",
  playerStream:  "",
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function normHandle(s: string): string {
  const t = s.trim();
  if (!t) return "";
  return t.startsWith("@") ? t : `@${t}`;
}

function isValidUrl(s: string): boolean {
  try { new URL(s); return true; } catch { return false; }
}

function getDomain(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ""); }
  catch { return "example.com"; }
}

function escAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&#34;").replace(/</g, "&lt;");
}

// ── HTML generation ───────────────────────────────────────────────────────────
function generateTags(f: FormState): string {
  const lines: string[] = ["<!-- Twitter Card Meta Tags -->"];
  const add = (name: string, content: string) => {
    if (content.trim())
      lines.push(`<meta name="${name}" content="${escAttr(content.trim())}" />`);
  };

  add("twitter:card", f.cardType);
  if (f.site)    add("twitter:site",    normHandle(f.site));
  if (f.creator) add("twitter:creator", normHandle(f.creator));

  if (f.cardType === "summary" || f.cardType === "summary_large_image") {
    add("twitter:title",       f.title);
    add("twitter:description", f.description);
    add("twitter:image",       f.image);
    if (f.imageAlt) add("twitter:image:alt", f.imageAlt);
  }

  if (f.cardType === "app") {
    if (f.appNameIphone) add("twitter:app:name:iphone",     f.appNameIphone);
    if (f.appIdIphone)   add("twitter:app:id:iphone",       f.appIdIphone);
    if (f.appUrlIphone)  add("twitter:app:url:iphone",      f.appUrlIphone);
    if (f.appNameGPlay)  add("twitter:app:name:googleplay", f.appNameGPlay);
    if (f.appIdGPlay)    add("twitter:app:id:googleplay",   f.appIdGPlay);
    if (f.appUrlGPlay)   add("twitter:app:url:googleplay",  f.appUrlGPlay);
  }

  if (f.cardType === "player") {
    add("twitter:title",         f.title);
    add("twitter:description",   f.description);
    add("twitter:image",         f.image);
    if (f.imageAlt)    add("twitter:image:alt",      f.imageAlt);
    if (f.playerUrl)   add("twitter:player",         f.playerUrl);
    if (f.playerWidth) add("twitter:player:width",   f.playerWidth);
    if (f.playerHeight)add("twitter:player:height",  f.playerHeight);
    if (f.playerStream)add("twitter:player:stream",  f.playerStream);
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

    if (trimmed.startsWith("<!--"))
      return `<span style="color:#6a9955">${escDisplay(trimmed)}</span>`;

    const m = trimmed.match(/^<(meta)\s+([\s\S]*?)\s*\/?>$/);
    if (!m) return escDisplay(trimmed);

    const tagName   = m[1];
    const attrsRaw  = m[2] ?? "";

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

  // twitter:card always set (+15)
  score += 15;

  if (f.cardType === "app") {
    const hasIos   = f.appNameIphone && f.appIdIphone;
    const hasGPlay = f.appNameGPlay  && f.appIdGPlay;
    if (hasIos || hasGPlay) score += 55;
    else issues.push({ level: "error", text: "App card requires at least one app entry (iOS or Google Play)." });
    if (hasIos && hasGPlay) score += 15;
    if (f.site) score += 15;
    else issues.push({ level: "info", text: "Add twitter:site (@handle) for better attribution." });
    return { score: Math.min(100, score), issues };
  }

  if (f.cardType === "player") {
    if (f.playerUrl) {
      if (isValidUrl(f.playerUrl)) score += 25;
      else issues.push({ level: "error", text: "twitter:player must be an HTTPS URL — X requires a secure iframe source." });
    } else {
      issues.push({ level: "error", text: "twitter:player URL is required for Player cards." });
    }
    if (f.title)       score += 15;
    else issues.push({ level: "warning", text: "Add twitter:title so viewers know what they are watching." });
    if (f.image)       score += 15;
    else issues.push({ level: "warning", text: "Add a poster image (twitter:image) shown before the player loads." });
    if (f.playerWidth && f.playerHeight) score += 15;
    if (f.site) score += 15;
    else issues.push({ level: "info", text: "Add twitter:site (@handle) for better attribution." });
    return { score: Math.min(100, score), issues };
  }

  // summary / summary_large_image
  if (f.title) {
    score += 20;
    if (f.title.length > 70)
      issues.push({ level: "warning", text: "Title exceeds 70 characters — X may truncate it in the card." });
  } else {
    issues.push({ level: "error", text: "twitter:title is required — it is the card's headline." });
  }

  if (f.description) {
    score += 15;
    if (f.description.length > 200)
      issues.push({ level: "warning", text: "Description exceeds 200 characters and will be cut off." });
  } else {
    issues.push({ level: "error", text: "twitter:description is required — it appears below the title." });
  }

  if (f.image) {
    if (isValidUrl(f.image)) score += 20;
    else issues.push({ level: "error", text: "twitter:image must be an absolute URL (https://…)." });
  } else {
    issues.push({ level: "error", text: "twitter:image is strongly recommended — cards without images get far less engagement." });
  }

  if (f.site) score += 10;
  else issues.push({ level: "info", text: "Add twitter:site (@handle) to attribute the card to your account." });

  if (f.imageAlt) score += 10;
  else issues.push({ level: "info", text: "Add twitter:image:alt for better accessibility." });

  if (f.creator) score += 10;
  else issues.push({ level: "info", text: "Add twitter:creator to credit the content author." });

  return { score: Math.min(100, score), issues };
}

// ── Shared styles ─────────────────────────────────────────────────────────────
const inputCls = [
  "w-full rounded-xl px-3 py-2.5 text-[13px] outline-none transition-all",
  "bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)]",
  "focus:border-[rgba(249,115,22,0.4)] text-[#e8dff0] placeholder-[#3d3345]",
].join(" ");

const labelCls = "text-[11px] font-semibold text-[#988d9f]";

// ── Preview image ─────────────────────────────────────────────────────────────
function PreviewImg({
  src, hasError, onError, alt, className, style,
}: {
  src: string; hasError: boolean; onError: () => void;
  alt?: string; className?: string; style?: CSSProperties;
}) {
  if (src && !hasError) {
    return <img src={src} alt={alt ?? ""} className={className} style={style} onError={onError} />;
  }
  return (
    <div className={`flex items-center justify-center ${className ?? ""}`}
      style={{ background: "#1e2732", ...style }}>
      <span className="material-symbols-outlined text-[28px]" style={{ color: "#3d4a56" }}>image</span>
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
export default function TwitterCardGeneratorTool() {
  const [form,       setForm]       = useState<FormState>(DEFAULT_FORM);
  const [copiedHtml, setCopiedHtml] = useState(false);
  const [imgError,   setImgError]   = useState(false);

  const set = useCallback(<K extends keyof FormState>(key: K, val: FormState[K]) => {
    setForm(p => ({ ...p, [key]: val }));
    if (key === "image") setImgError(false);
  }, []);

  const output            = useMemo(() => generateTags(form), [form]);
  const { score, issues } = useMemo(() => validate(form),     [form]);
  const scoreColor = score >= 71 ? "#22c55e" : score >= 41 ? "#f59e0b" : "#ef4444";
  const scoreLabel = score >= 71 ? "Good"    : score >= 41 ? "Needs work" : "Poor";
  const circ = 2 * Math.PI * 34;

  const displayTitle  = form.title       || "Your Page Title";
  const displayDesc   = form.description || "Your page description will appear here.";
  const displayDomain = form.image && isValidUrl(form.image) ? getDomain(form.image) :
                        "example.com";
  const imgProps = {
    src:      form.image,
    hasError: imgError,
    onError:  () => setImgError(true),
    alt:      form.imageAlt || form.title || "Preview",
  };

  const copyHtml = useCallback(async () => {
    try { await navigator.clipboard.writeText(output); } catch { /* blocked */ }
    setCopiedHtml(true);
    setTimeout(() => setCopiedHtml(false), 2000);
  }, [output]);

  const download = useCallback(() => {
    const blob = new Blob([output], { type: "text/html" });
    const url  = URL.createObjectURL(blob);
    Object.assign(document.createElement("a"), { href: url, download: "twitter-card.html" }).click();
    URL.revokeObjectURL(url);
  }, [output]);

  const reset = useCallback(() => {
    setForm(DEFAULT_FORM);
    setCopiedHtml(false);
    setImgError(false);
  }, []);

  const showContentFields = form.cardType === "summary" ||
                            form.cardType === "summary_large_image" ||
                            form.cardType === "player";

  return (
    <div className="mb-12 flex flex-col gap-6">

      {/* ── Card Type ─────────────────────────────────────── */}
      <div className="glass-panel rounded-2xl p-5 flex flex-col gap-4"
        style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
        <PanelHeader icon="style" title="Card Type" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {CARD_TYPES.map(ct => (
            <button
              key={ct.value}
              onClick={() => set("cardType", ct.value)}
              aria-pressed={form.cardType === ct.value}
              className="flex items-start gap-3 px-4 py-3 rounded-xl text-left transition-all"
              style={form.cardType === ct.value ? {
                background: "rgba(249,115,22,0.10)", border: "1px solid rgba(249,115,22,0.32)",
              } : {
                background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
              }}>
              <span className="material-symbols-outlined text-[20px] mt-0.5 shrink-0"
                style={{ color: form.cardType === ct.value ? ACCENT : "#988d9f" }}>
                {ct.icon}
              </span>
              <div>
                <p className="text-[13px] font-bold"
                  style={{ color: form.cardType === ct.value ? ACCENT : "#e8dff0" }}>
                  {ct.label}
                </p>
                <p className="text-[11px] mt-0.5" style={{ color: "#988d9f" }}>{ct.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ── Account ───────────────────────────────────────── */}
      <div className="glass-panel rounded-2xl p-5 flex flex-col gap-4"
        style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
        <PanelHeader icon="alternate_email" title="Account Handles" hint="Optional — recommended" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="tc-site" className={labelCls}>
              @site <span className="font-normal" style={{ color: "#3d3345" }}>— website account</span>
            </label>
            <input
              id="tc-site" value={form.site}
              onChange={e => set("site", e.target.value)}
              placeholder="@toolnestai"
              className={inputCls}
              aria-label="Twitter site handle"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="tc-creator" className={labelCls}>
              @creator <span className="font-normal" style={{ color: "#3d3345" }}>— content author</span>
            </label>
            <input
              id="tc-creator" value={form.creator}
              onChange={e => set("creator", e.target.value)}
              placeholder="@author"
              className={inputCls}
              aria-label="Twitter creator handle"
            />
          </div>
        </div>
      </div>

      {/* ── Content fields (summary / summary_large_image / player) ── */}
      {showContentFields && (
        <div className="glass-panel rounded-2xl p-5 flex flex-col gap-4"
          style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
          <PanelHeader icon="text_fields" title="Content" />

          <div className="flex flex-col gap-1.5">
            <label htmlFor="tc-title" className={labelCls}>
              Title
              <span className="ml-2 font-normal tabular-nums"
                style={{ color: form.title.length > 70 ? "#ef4444" : form.title.length > 55 ? "#f59e0b" : "#3d3345" }}>
                {form.title.length}/70
              </span>
            </label>
            <input
              id="tc-title" value={form.title}
              onChange={e => set("title", e.target.value)}
              placeholder="Enter your page title"
              className={inputCls}
              aria-label="Card title"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="tc-desc" className={labelCls}>
              Description
              <span className="ml-2 font-normal tabular-nums"
                style={{ color: form.description.length > 200 ? "#ef4444" : form.description.length > 160 ? "#f59e0b" : "#3d3345" }}>
                {form.description.length}/200
              </span>
            </label>
            <textarea
              id="tc-desc" rows={3}
              value={form.description}
              onChange={e => set("description", e.target.value)}
              placeholder="A compelling description of your page content"
              className={`${inputCls} resize-none`}
              aria-label="Card description"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="tc-image" className={labelCls}>Image URL</label>
              <input
                id="tc-image" type="url" value={form.image}
                onChange={e => set("image", e.target.value)}
                placeholder="https://example.com/card-image.jpg"
                className={inputCls}
                style={form.image && !isValidUrl(form.image) ? { borderColor: "rgba(239,68,68,0.5)" } : undefined}
                aria-label="Image URL"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="tc-imgalt" className={labelCls}>Image Alt Text</label>
              <input
                id="tc-imgalt" value={form.imageAlt}
                onChange={e => set("imageAlt", e.target.value)}
                placeholder="Descriptive image text"
                className={inputCls}
                aria-label="Image alt text"
              />
            </div>
          </div>

          {/* Player-specific fields */}
          {form.cardType === "player" && (
            <div className="flex flex-col gap-4 pt-3"
              style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
              <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: ACCENT }}>
                Player Details
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5 sm:col-span-2">
                  <label htmlFor="tc-player-url" className={labelCls}>
                    Player URL <span className="font-normal" style={{ color: "#3d3345" }}>(HTTPS iframe)</span>
                  </label>
                  <input
                    id="tc-player-url" type="url" value={form.playerUrl}
                    onChange={e => set("playerUrl", e.target.value)}
                    placeholder="https://example.com/player.html"
                    className={inputCls}
                    style={form.playerUrl && !isValidUrl(form.playerUrl) ? { borderColor: "rgba(239,68,68,0.5)" } : undefined}
                    aria-label="Player iframe URL"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="tc-player-w" className={labelCls}>Player Width</label>
                  <input
                    id="tc-player-w" type="number" min="1" value={form.playerWidth}
                    onChange={e => set("playerWidth", e.target.value)}
                    placeholder="1280" className={inputCls} aria-label="Player width"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="tc-player-h" className={labelCls}>Player Height</label>
                  <input
                    id="tc-player-h" type="number" min="1" value={form.playerHeight}
                    onChange={e => set("playerHeight", e.target.value)}
                    placeholder="720" className={inputCls} aria-label="Player height"
                  />
                </div>
                <div className="flex flex-col gap-1.5 sm:col-span-2">
                  <label htmlFor="tc-stream" className={labelCls}>
                    Stream URL <span className="font-normal" style={{ color: "#3d3345" }}>(optional direct media)</span>
                  </label>
                  <input
                    id="tc-stream" type="url" value={form.playerStream}
                    onChange={e => set("playerStream", e.target.value)}
                    placeholder="https://example.com/video.mp4"
                    className={inputCls} aria-label="Stream URL"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── App fields ────────────────────────────────────── */}
      {form.cardType === "app" && (
        <div className="glass-panel rounded-2xl p-5 flex flex-col gap-5"
          style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
          <PanelHeader icon="smartphone" title="App Store Details" />

          {/* iOS */}
          <div className="flex flex-col gap-3">
            <p className="text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5"
              style={{ color: "#60a5fa" }}>
              <span className="material-symbols-outlined text-[14px]">phone_iphone</span>iOS (iPhone / iPad)
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="tc-app-name-ios" className={labelCls}>App Name</label>
                <input id="tc-app-name-ios" value={form.appNameIphone}
                  onChange={e => set("appNameIphone", e.target.value)}
                  placeholder="My App" className={inputCls} aria-label="iOS app name" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="tc-app-id-ios" className={labelCls}>App Store ID</label>
                <input id="tc-app-id-ios" value={form.appIdIphone}
                  onChange={e => set("appIdIphone", e.target.value)}
                  placeholder="123456789" className={inputCls} aria-label="iOS app ID" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="tc-app-url-ios" className={labelCls}>Custom URL Scheme</label>
                <input id="tc-app-url-ios" value={form.appUrlIphone}
                  onChange={e => set("appUrlIphone", e.target.value)}
                  placeholder="myapp://page" className={inputCls} aria-label="iOS app URL" />
              </div>
            </div>
          </div>

          {/* Google Play */}
          <div className="flex flex-col gap-3">
            <p className="text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5"
              style={{ color: "#4ade80" }}>
              <span className="material-symbols-outlined text-[14px]">android</span>Google Play
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="tc-app-name-gp" className={labelCls}>App Name</label>
                <input id="tc-app-name-gp" value={form.appNameGPlay}
                  onChange={e => set("appNameGPlay", e.target.value)}
                  placeholder="My App" className={inputCls} aria-label="Android app name" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="tc-app-id-gp" className={labelCls}>Package Name</label>
                <input id="tc-app-id-gp" value={form.appIdGPlay}
                  onChange={e => set("appIdGPlay", e.target.value)}
                  placeholder="com.example.myapp" className={inputCls} aria-label="Android package name" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="tc-app-url-gp" className={labelCls}>Custom URL Scheme</label>
                <input id="tc-app-url-gp" value={form.appUrlGPlay}
                  onChange={e => set("appUrlGPlay", e.target.value)}
                  placeholder="myapp://page" className={inputCls} aria-label="Android app URL" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Live Preview ──────────────────────────────────── */}
      <div className="glass-panel rounded-2xl overflow-hidden"
        style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
        <div className="px-5 py-3 flex items-center gap-2"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.01)" }}>
          <span className="material-symbols-outlined text-[15px]" style={{ color: ACCENT }}>visibility</span>
          <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: ACCENT }}>
            X / Twitter Card Preview
          </p>
          <span className="text-[10px] px-2 py-0.5 rounded-full ml-1 font-semibold"
            style={{ background: "rgba(249,115,22,0.1)", color: ACCENT }}>Live</span>
        </div>

        <div className="p-6 flex justify-center" style={{ background: "rgba(0,0,0,0.3)" }}>

          {/* Summary card */}
          {form.cardType === "summary" && (
            <div className="w-full max-w-[506px]">
              <div className="rounded-2xl overflow-hidden flex"
                style={{ border: "1px solid #2f3336", background: "#000", fontFamily: "system-ui,-apple-system,sans-serif" }}>
                <div className="shrink-0 w-[116px] h-[116px] overflow-hidden"
                  style={{ borderRight: "1px solid #2f3336" }}>
                  <PreviewImg
                    {...imgProps}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 px-3 py-3 flex flex-col justify-between min-w-0">
                  <div>
                    <p className="text-[13px] font-bold leading-tight mb-1 truncate"
                      style={{ color: "#e7e9ea" }}>{displayTitle}</p>
                    <p className="text-[12px] leading-snug line-clamp-2"
                      style={{ color: "#71767b" }}>{displayDesc}</p>
                  </div>
                  <div className="flex items-center gap-1 mt-1">
                    <span className="material-symbols-outlined text-[11px]" style={{ color: "#71767b" }}>public</span>
                    <p className="text-[12px]" style={{ color: "#71767b" }}>{displayDomain}</p>
                  </div>
                </div>
              </div>
              <p className="text-[10px] text-center mt-2" style={{ color: "#3d3345" }}>
                twitter:card = summary
              </p>
            </div>
          )}

          {/* Summary large image */}
          {form.cardType === "summary_large_image" && (
            <div className="w-full max-w-[506px]">
              <div className="rounded-2xl overflow-hidden"
                style={{ border: "1px solid #2f3336", background: "#000", fontFamily: "system-ui,-apple-system,sans-serif" }}>
                <PreviewImg
                  {...imgProps}
                  className="w-full block object-cover"
                  style={{ aspectRatio: "2/1", background: "#1e2732" }}
                />
                <div className="px-3 py-3">
                  <p className="text-[15px] font-bold leading-tight mb-1 line-clamp-2"
                    style={{ color: "#e7e9ea" }}>{displayTitle}</p>
                  <p className="text-[13px] leading-snug line-clamp-2 mb-2"
                    style={{ color: "#71767b" }}>{displayDesc}</p>
                  <div className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-[11px]" style={{ color: "#71767b" }}>public</span>
                    <p className="text-[12px]" style={{ color: "#71767b" }}>{displayDomain}</p>
                  </div>
                </div>
              </div>
              <p className="text-[10px] text-center mt-2" style={{ color: "#3d3345" }}>
                twitter:card = summary_large_image
              </p>
            </div>
          )}

          {/* App card */}
          {form.cardType === "app" && (
            <div className="w-full max-w-[506px]">
              <div className="rounded-2xl overflow-hidden"
                style={{ border: "1px solid #2f3336", background: "#000", fontFamily: "system-ui,-apple-system,sans-serif" }}>
                <div className="px-4 py-4 flex flex-col gap-3">
                  <p className="text-[11px] font-semibold uppercase" style={{ color: "#71767b" }}>
                    App Card Preview
                  </p>
                  {(form.appNameIphone || form.appNameGPlay) ? (
                    <div className="flex flex-col gap-2">
                      {form.appNameIphone && (
                        <div className="flex items-center justify-between px-3 py-2 rounded-xl"
                          style={{ background: "#16181c", border: "1px solid #2f3336" }}>
                          <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-[18px]" style={{ color: "#60a5fa" }}>phone_iphone</span>
                            <div>
                              <p className="text-[13px] font-semibold" style={{ color: "#e7e9ea" }}>{form.appNameIphone}</p>
                              {form.appIdIphone && <p className="text-[11px]" style={{ color: "#71767b" }}>ID: {form.appIdIphone}</p>}
                            </div>
                          </div>
                          <span className="text-[11px] px-2 py-0.5 rounded-full font-bold"
                            style={{ background: "#1d9bf0", color: "#fff" }}>Get</span>
                        </div>
                      )}
                      {form.appNameGPlay && (
                        <div className="flex items-center justify-between px-3 py-2 rounded-xl"
                          style={{ background: "#16181c", border: "1px solid #2f3336" }}>
                          <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-[18px]" style={{ color: "#4ade80" }}>android</span>
                            <div>
                              <p className="text-[13px] font-semibold" style={{ color: "#e7e9ea" }}>{form.appNameGPlay}</p>
                              {form.appIdGPlay && <p className="text-[11px]" style={{ color: "#71767b" }}>{form.appIdGPlay}</p>}
                            </div>
                          </div>
                          <span className="text-[11px] px-2 py-0.5 rounded-full font-bold"
                            style={{ background: "#1d9bf0", color: "#fff" }}>Get</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="py-4 flex flex-col items-center gap-2">
                      <span className="material-symbols-outlined text-[32px]" style={{ color: "#3d4a56" }}>smartphone</span>
                      <p className="text-[12px]" style={{ color: "#71767b" }}>Fill in app details above to see preview</p>
                    </div>
                  )}
                </div>
              </div>
              <p className="text-[10px] text-center mt-2" style={{ color: "#3d3345" }}>
                twitter:card = app
              </p>
            </div>
          )}

          {/* Player card */}
          {form.cardType === "player" && (
            <div className="w-full max-w-[506px]">
              <div className="rounded-2xl overflow-hidden"
                style={{ border: "1px solid #2f3336", background: "#000", fontFamily: "system-ui,-apple-system,sans-serif" }}>
                {/* Player area */}
                <div className="relative"
                  style={{ aspectRatio: form.playerWidth && form.playerHeight
                    ? `${form.playerWidth}/${form.playerHeight}`
                    : "16/9", background: "#000" }}>
                  <PreviewImg
                    {...imgProps}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-14 h-14 rounded-full flex items-center justify-center"
                      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}>
                      <span className="material-symbols-outlined text-[28px]" style={{ color: "#fff" }}>play_arrow</span>
                    </div>
                  </div>
                  {form.playerUrl && (
                    <div className="absolute bottom-2 left-2 right-2">
                      <div className="h-1 rounded-full" style={{ background: "rgba(255,255,255,0.2)" }}>
                        <div className="h-1 w-1/3 rounded-full" style={{ background: "#1d9bf0" }} />
                      </div>
                    </div>
                  )}
                </div>
                <div className="px-3 py-3">
                  <p className="text-[14px] font-bold line-clamp-1" style={{ color: "#e7e9ea" }}>{displayTitle}</p>
                  <p className="text-[12px] mt-0.5 line-clamp-1" style={{ color: "#71767b" }}>{displayDomain}</p>
                </div>
              </div>
              <p className="text-[10px] text-center mt-2" style={{ color: "#3d3345" }}>
                twitter:card = player
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Validation score ──────────────────────────────── */}
      <div className="glass-panel rounded-2xl p-5 flex flex-wrap items-start gap-6"
        style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
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
              <span className="text-[20px] font-black tabular-nums"
                style={{ color: scoreColor, lineHeight: 1 }}>{score}</span>
              <span className="text-[9px] font-bold"
                style={{ color: scoreColor, opacity: 0.7 }}>/ 100</span>
            </div>
          </div>
          <span className="text-[11px] font-bold" style={{ color: scoreColor }}>{scoreLabel}</span>
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-bold mb-2" style={{ color: "#e8dff0" }}>Validation</p>
          {issues.length === 0 ? (
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px] text-green-400">check_circle</span>
              <span className="text-[13px]" style={{ color: "#22c55e" }}>
                All checks passed — your Twitter Card is ready!
              </span>
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              {issues.map((iss, i) => {
                const ic = iss.level === "error" ? "#ef4444" : iss.level === "warning" ? "#f59e0b" : "#60a5fa";
                const ig = iss.level === "error" ? "error"   : iss.level === "warning" ? "warning"  : "info";
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
