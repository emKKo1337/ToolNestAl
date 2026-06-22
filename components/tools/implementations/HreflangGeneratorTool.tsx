"use client";

import { useState, useMemo, useCallback } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Variant {
  id: string;
  lang: string;
  country: string;
  url: string;
}

interface Options {
  includeXDefault: boolean;
  xDefaultUrl: string;
  selfReferencing: boolean;
  includeCanonical: boolean;
  canonicalUrl: string;
  autoValidate: boolean;
}

interface Issue { level: "error" | "warning" | "info"; text: string; }

// ── Language / country data ───────────────────────────────────────────────────
const COMMON_LANGS = [
  "en", "de", "fr", "es", "it", "pt", "nl", "pl", "ru", "ja",
  "zh", "ko", "ar", "sv", "da", "fi", "nb", "cs", "sk", "hu",
  "ro", "bg", "hr", "bs", "sr", "sl", "uk", "tr", "el", "he",
  "id", "ms", "th", "vi",
];

const COMMON_COUNTRIES = [
  "US", "GB", "AU", "CA", "IE", "NZ", "ZA", "IN",
  "DE", "AT", "CH", "FR", "BE", "LU", "ES", "MX", "AR", "CO",
  "IT", "PT", "BR", "NL", "PL", "RU", "JP", "CN", "TW", "HK",
  "KR", "SE", "DK", "FI", "NO", "CZ", "SK", "HU", "RO", "BG",
  "HR", "BA", "RS", "SI", "UA", "TR", "GR", "IL", "ID", "MY",
  "TH", "VN", "SG", "PH",
];

// BCP 47 language subtag: 2-3 lowercase letters
const LANG_RE    = /^[a-z]{2,3}$/;
// ISO 3166-1 alpha-2 country code: 2 uppercase letters
const COUNTRY_RE = /^[A-Z]{2}$/;

const isValidUrl = (s: string) => { try { new URL(s); return true; } catch { return false; } };
const uid = () => Math.random().toString(36).slice(2, 9);
const escAttr = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&#34;").replace(/</g, "&lt;");

// ── HTML highlighter (same pattern as other SEO tools) ────────────────────────
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
      (_f, name, eq, val) =>
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
function validate(variants: Variant[], opts: Options): { score: number; issues: Issue[] } {
  const issues: Issue[] = [];
  let score = 0;

  const filled = variants.filter(v => v.lang.trim() && v.url.trim());
  if (filled.length === 0) {
    issues.push({ level: "error", text: "Add at least one language variant with a language code and URL." });
    return { score: 0, issues };
  }

  score += Math.min(50, filled.length * 12);

  // Duplicate locale codes
  const locales = filled.map(v => v.country ? `${v.lang}-${v.country}` : v.lang);
  const seen = new Set<string>();
  locales.forEach(loc => {
    if (seen.has(loc)) issues.push({ level: "error", text: `Duplicate hreflang locale "${loc}" detected — each locale must appear only once.` });
    seen.add(loc);
  });

  // Duplicate URLs
  const urls = filled.map(v => v.url);
  const urlSeen = new Set<string>();
  urls.forEach(u => {
    if (urlSeen.has(u)) issues.push({ level: "warning", text: `Duplicate URL "${u}" — different locales should generally point to different URLs.` });
    urlSeen.add(u);
  });

  // Invalid lang codes
  filled.forEach(v => {
    if (!LANG_RE.test(v.lang)) {
      issues.push({ level: "error", text: `"${v.lang}" is not a valid BCP 47 language subtag (e.g. en, de, fr).` });
    }
    if (v.country && !COUNTRY_RE.test(v.country)) {
      issues.push({ level: "error", text: `"${v.country}" is not a valid ISO 3166-1 country code (e.g. US, GB, DE).` });
    }
    if (opts.autoValidate && v.url && !isValidUrl(v.url)) {
      issues.push({ level: "error", text: `URL "${v.url}" is not a valid absolute URL.` });
    }
  });

  if (issues.filter(i => i.level === "error").length === 0) {
    score += 20;
  }

  // x-default
  if (!opts.includeXDefault) {
    issues.push({ level: "warning", text: "x-default is not set — Google recommends x-default to handle unmatched languages." });
  } else if (opts.xDefaultUrl && !isValidUrl(opts.xDefaultUrl)) {
    issues.push({ level: "error", text: "x-default URL must be a valid absolute URL." });
    score -= 10;
  } else {
    score += 15;
  }

  if (filled.length >= 2) score += 10;
  if (filled.length >= 5) score += 5;

  if (issues.filter(i => i.level === "error").length === 0 && score >= 70) {
    issues.push({ level: "info", text: `${locales.length} hreflang tag${locales.length !== 1 ? "s" : ""} generated successfully — ready to paste into your <head>.` });
  }

  return { score: Math.min(100, Math.max(0, score)), issues };
}

// ── Output builder ────────────────────────────────────────────────────────────
function buildOutput(variants: Variant[], opts: Options): string {
  const lines: string[] = ["<!-- Hreflang Tags (generated by ToolNest AI) -->"];

  if (opts.includeCanonical && opts.canonicalUrl && isValidUrl(opts.canonicalUrl)) {
    lines.push(`<link rel="canonical" href="${escAttr(opts.canonicalUrl)}" />`);
  }

  if (opts.includeXDefault) {
    const xUrl = opts.xDefaultUrl || (variants[0]?.url ?? "");
    if (xUrl) lines.push(`<link rel="alternate" hreflang="x-default" href="${escAttr(xUrl)}" />`);
  }

  variants
    .filter(v => v.lang.trim() && v.url.trim())
    .forEach(v => {
      const locale = v.country.trim() ? `${v.lang.trim()}-${v.country.trim()}` : v.lang.trim();
      lines.push(`<link rel="alternate" hreflang="${escAttr(locale)}" href="${escAttr(v.url.trim())}" />`);
    });

  return lines.join("\n");
}

// ── Constants ─────────────────────────────────────────────────────────────────
const ACCENT = "#f97316";
const inputCls = "w-full rounded-xl px-3 py-2.5 text-[13px] outline-none transition-all bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] focus:border-[rgba(249,115,22,0.4)] text-[#e8dff0] placeholder-[#3d3345]";
const selectCls = "w-full rounded-xl px-2.5 py-2 text-[13px] outline-none transition-all cursor-pointer bg-[#1a1525] border border-[rgba(255,255,255,0.08)] focus:border-[rgba(249,115,22,0.4)] text-[#e8dff0]";

// ── Sub-components (outside main to prevent remounting) ───────────────────────
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
    <label className="flex items-start gap-3 cursor-pointer">
      <div className="relative mt-0.5 shrink-0">
        <input type="checkbox" className="sr-only" checked={checked} onChange={e => onChange(e.target.checked)} />
        <div className="w-9 h-5 rounded-full transition-all"
          style={{ background: checked ? "rgba(249,115,22,0.25)" : "rgba(255,255,255,0.06)", border: `1px solid ${checked ? "rgba(249,115,22,0.5)" : "rgba(255,255,255,0.12)"}` }} />
        <div className="absolute top-0.5 w-4 h-4 rounded-full transition-all"
          style={{ left: checked ? "18px" : "2px", background: checked ? ACCENT : "rgba(255,255,255,0.3)" }} />
      </div>
      <div>
        <p className="text-[13px] font-semibold" style={{ color: "#e8dff0" }}>{label}</p>
        {hint && <p className="text-[11px] mt-0.5" style={{ color: "#988d9f" }}>{hint}</p>}
      </div>
    </label>
  );
}

// ── Default state ─────────────────────────────────────────────────────────────
const makeVariant = (lang = "", country = "", url = ""): Variant => ({ id: uid(), lang, country, url });

const DEFAULT_VARIANTS: Variant[] = [
  makeVariant("en", "US", ""),
  makeVariant("en", "GB", ""),
];

const DEFAULT_OPTS: Options = {
  includeXDefault: true,
  xDefaultUrl: "",
  selfReferencing: false,
  includeCanonical: false,
  canonicalUrl: "",
  autoValidate: true,
};

// ── Main component ────────────────────────────────────────────────────────────
export default function HreflangGeneratorTool() {
  const [variants, setVariants] = useState<Variant[]>(DEFAULT_VARIANTS);
  const [opts,     setOpts]     = useState<Options>(DEFAULT_OPTS);
  const [copied,   setCopied]   = useState(false);

  const setOpt = useCallback(<K extends keyof Options>(k: K, v: Options[K]) =>
    setOpts(p => ({ ...p, [k]: v })), []);

  // Variant mutators
  const setField = useCallback((id: string, field: keyof Omit<Variant, "id">, value: string) =>
    setVariants(p => p.map(v => v.id === id ? { ...v, [field]: value } : v)), []);

  const addVariant = useCallback(() =>
    setVariants(p => [...p, makeVariant()]), []);

  const removeVariant = useCallback((id: string) =>
    setVariants(p => p.length > 1 ? p.filter(v => v.id !== id) : p), []);

  // Derived
  const htmlOutput = useMemo(() => buildOutput(variants, opts), [variants, opts]);
  const { score, issues } = useMemo(() => validate(variants, opts), [variants, opts]);
  const scoreColor = score >= 71 ? "#22c55e" : score >= 41 ? "#f59e0b" : "#ef4444";
  const scoreLabel = score >= 71 ? "Good" : score >= 41 ? "Needs work" : "Incomplete";
  const circ = 2 * Math.PI * 34;

  const copy = useCallback(async () => {
    try { await navigator.clipboard.writeText(htmlOutput); } catch { /* blocked */ }
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  }, [htmlOutput]);

  const download = useCallback(() => {
    const blob = new Blob([htmlOutput], { type: "text/html" });
    const url  = URL.createObjectURL(blob);
    Object.assign(document.createElement("a"), { href: url, download: "hreflang-tags.html" }).click();
    URL.revokeObjectURL(url);
  }, [htmlOutput]);

  const reset = useCallback(() => {
    setVariants(DEFAULT_VARIANTS); setOpts(DEFAULT_OPTS); setCopied(false);
  }, []);

  return (
    <div className="mb-12 flex flex-col gap-6">

      {/* ── Language Variants Table ───────────────────────── */}
      <div className="glass-panel rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
        <div className="px-5 py-4">
          <PanelHeader icon="translate" title="Language Variants" hint={`${variants.length} entr${variants.length !== 1 ? "ies" : "y"}`} />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px]">
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}>
                <th className="text-left px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider" style={{ color: "#988d9f", width: "36px" }}>#</th>
                <th className="text-left px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider" style={{ color: "#988d9f", minWidth: "160px" }}>
                  Language <span style={{ color: ACCENT }}>*</span>
                </th>
                <th className="text-left px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider" style={{ color: "#988d9f", minWidth: "140px" }}>Country</th>
                <th className="text-left px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider" style={{ color: "#988d9f" }}>
                  URL <span style={{ color: ACCENT }}>*</span>
                </th>
                <th className="px-3 py-2.5" style={{ width: "44px" }} />
              </tr>
            </thead>
            <tbody>
              {variants.map((v, i) => {
                const locale = v.country ? `${v.lang}-${v.country}` : v.lang;
                const langInvalid  = v.lang    && !LANG_RE.test(v.lang);
                const countryInvalid = v.country && !COUNTRY_RE.test(v.country);
                const urlInvalid   = opts.autoValidate && v.url && !isValidUrl(v.url);
                return (
                  <tr key={v.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }} className="hover:bg-[rgba(255,255,255,0.015)] transition-colors">
                    <td className="px-4 py-2.5 text-[12px] font-bold tabular-nums" style={{ color: "#988d9f" }}>{i + 1}</td>
                    <td className="px-3 py-2">
                      <select
                        value={COMMON_LANGS.includes(v.lang) ? v.lang : "__custom__"}
                        onChange={e => {
                          if (e.target.value !== "__custom__") setField(v.id, "lang", e.target.value);
                          else setField(v.id, "lang", "");
                        }}
                        className={selectCls}
                        style={langInvalid ? { borderColor: "rgba(239,68,68,0.5)" } : undefined}
                      >
                        <option value="">— select —</option>
                        {COMMON_LANGS.map(l => <option key={l} value={l}>{l}</option>)}
                        <option value="__custom__">Custom…</option>
                      </select>
                      {(!COMMON_LANGS.includes(v.lang) || v.lang === "") && (
                        <input
                          value={v.lang}
                          onChange={e => setField(v.id, "lang", e.target.value.toLowerCase().replace(/[^a-z]/g, ""))}
                          placeholder="en"
                          className={`${inputCls} mt-1.5`}
                          maxLength={3}
                          style={langInvalid ? { borderColor: "rgba(239,68,68,0.5)" } : undefined}
                        />
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={COMMON_COUNTRIES.includes(v.country) ? v.country : v.country ? "__custom__" : ""}
                        onChange={e => {
                          if (e.target.value !== "__custom__") setField(v.id, "country", e.target.value);
                          else setField(v.id, "country", "");
                        }}
                        className={selectCls}
                        style={countryInvalid ? { borderColor: "rgba(239,68,68,0.5)" } : undefined}
                      >
                        <option value="">— none —</option>
                        {COMMON_COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                        <option value="__custom__">Custom…</option>
                      </select>
                      {v.country && !COMMON_COUNTRIES.includes(v.country) && (
                        <input
                          value={v.country}
                          onChange={e => setField(v.id, "country", e.target.value.toUpperCase().replace(/[^A-Z]/g, ""))}
                          placeholder="US"
                          className={`${inputCls} mt-1.5`}
                          maxLength={2}
                          style={countryInvalid ? { borderColor: "rgba(239,68,68,0.5)" } : undefined}
                        />
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="url"
                        value={v.url}
                        onChange={e => setField(v.id, "url", e.target.value)}
                        placeholder="https://example.com/en/"
                        className={inputCls}
                        style={urlInvalid ? { borderColor: "rgba(239,68,68,0.5)" } : undefined}
                      />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <button
                        onClick={() => removeVariant(v.id)}
                        disabled={variants.length <= 1}
                        aria-label={`Remove ${locale} variant`}
                        className="w-7 h-7 flex items-center justify-center rounded-lg disabled:opacity-20 transition-all mx-auto"
                        style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)" }}
                      >
                        <span className="material-symbols-outlined text-[13px] text-red-400">close</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 flex items-center gap-3" style={{ borderTop: "1px solid rgba(255,255,255,0.05)", background: "rgba(255,255,255,0.01)" }}>
          <button
            onClick={addVariant}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12px] font-bold transition-all"
            style={{ background: "rgba(249,115,22,0.09)", color: ACCENT, border: "1px solid rgba(249,115,22,0.22)" }}
          >
            <span className="material-symbols-outlined text-[14px]">add</span>Add Language
          </button>
          <span className="text-[11px]" style={{ color: "#3d3345" }}>
            {variants.filter(v => v.lang && v.url).length} of {variants.length} filled
          </span>
        </div>
      </div>

      {/* ── Options ───────────────────────────────────────── */}
      <div className="glass-panel rounded-2xl p-5 flex flex-col gap-5" style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
        <PanelHeader icon="tune" title="Options" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div className="flex flex-col gap-3">
            <Toggle
              label="Include x-default"
              hint="Fallback page for unmatched languages — recommended by Google"
              checked={opts.includeXDefault}
              onChange={v => setOpt("includeXDefault", v)}
            />
            {opts.includeXDefault && (
              <div className="ml-12 flex flex-col gap-1.5">
                <label className="text-[11px] font-semibold" style={{ color: "#988d9f" }}>x-default URL</label>
                <input
                  type="url"
                  value={opts.xDefaultUrl}
                  onChange={e => setOpt("xDefaultUrl", e.target.value)}
                  placeholder="https://example.com/"
                  className={inputCls}
                  style={opts.xDefaultUrl && !isValidUrl(opts.xDefaultUrl) ? { borderColor: "rgba(239,68,68,0.5)" } : undefined}
                />
              </div>
            )}
          </div>
          <Toggle
            label="Auto-validate URLs"
            hint="Flag entries whose URL is not a valid absolute URL"
            checked={opts.autoValidate}
            onChange={v => setOpt("autoValidate", v)}
          />
          <div className="flex flex-col gap-3">
            <Toggle
              label="Include Canonical URL"
              hint={'Add a <link rel="canonical"> above the hreflang block'}
              checked={opts.includeCanonical}
              onChange={v => setOpt("includeCanonical", v)}
            />
            {opts.includeCanonical && (
              <div className="ml-12 flex flex-col gap-1.5">
                <label className="text-[11px] font-semibold" style={{ color: "#988d9f" }}>Canonical URL</label>
                <input
                  type="url"
                  value={opts.canonicalUrl}
                  onChange={e => setOpt("canonicalUrl", e.target.value)}
                  placeholder="https://example.com/page"
                  className={inputCls}
                  style={opts.canonicalUrl && !isValidUrl(opts.canonicalUrl) ? { borderColor: "rgba(239,68,68,0.5)" } : undefined}
                />
              </div>
            )}
          </div>
          <Toggle
            label="Self-referencing hreflang"
            hint="Each page includes its own locale in the hreflang set (standard practice)"
            checked={opts.selfReferencing}
            onChange={v => setOpt("selfReferencing", v)}
          />
        </div>
        {opts.selfReferencing && (
          <div className="flex items-start gap-2 px-4 py-3 rounded-xl" style={{ background: "rgba(96,165,250,0.06)", border: "1px solid rgba(96,165,250,0.18)" }}>
            <span className="material-symbols-outlined text-[14px] mt-0.5 shrink-0" style={{ color: "#60a5fa" }}>info</span>
            <p className="text-[12px]" style={{ color: "#c8b89f" }}>
              Self-referencing is already achieved when you include every page&apos;s own locale in the variants list above — the generated tags below already cover this. No extra tag is added.
            </p>
          </div>
        )}
      </div>

      {/* ── SEO score ─────────────────────────────────────── */}
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
          <p className="text-[12px] font-bold mb-2" style={{ color: "#e8dff0" }}>Hreflang Validation</p>
          {issues.length === 0 ? (
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px] text-green-400">check_circle</span>
              <span className="text-[13px]" style={{ color: "#22c55e" }}>All good!</span>
            </div>
          ) : (
            <ul className="flex flex-col gap-2 max-h-44 overflow-y-auto pr-1">
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

      {/* ── Actions ───────────────────────────────────────── */}
      <div className="flex flex-wrap gap-3">
        <button onClick={copy} className="btn-primary flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm">
          <span className="material-symbols-outlined text-[16px]">{copied ? "check" : "content_copy"}</span>
          {copied ? "Copied!" : "Copy HTML"}
        </button>
        <button
          onClick={download}
          className="flex items-center gap-2 px-4 py-3 rounded-xl font-semibold text-sm transition-all"
          style={{ background: "rgba(249,115,22,0.09)", color: ACCENT, border: "1px solid rgba(249,115,22,0.22)" }}
        >
          <span className="material-symbols-outlined text-[14px]">download</span>Download HTML
        </button>
        <button
          onClick={reset}
          className="flex items-center gap-2 px-4 py-3 rounded-xl font-semibold text-sm transition-all ml-auto"
          style={{ background: "rgba(255,255,255,0.03)", color: "#988d9f", border: "1px solid rgba(255,255,255,0.07)" }}
        >
          <span className="material-symbols-outlined text-[14px]">restart_alt</span>Reset
        </button>
      </div>

      {/* ── Output ────────────────────────────────────────── */}
      <div className="glass-panel rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(249,115,22,0.18)" }}>
        <div
          className="px-5 py-3 flex items-center justify-between flex-wrap gap-3"
          style={{ borderBottom: "1px solid rgba(249,115,22,0.1)", background: "rgba(249,115,22,0.03)" }}
        >
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[14px]" style={{ color: ACCENT }}>code</span>
            <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: ACCENT }}>Generated Hreflang Tags</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ background: "rgba(249,115,22,0.1)", color: ACCENT }}>Live</span>
          </div>
          <button
            onClick={copy}
            className="flex items-center gap-1.5 px-3 py-1 rounded-xl text-[11px] font-bold"
            style={{ background: "rgba(249,115,22,0.1)", color: ACCENT }}
          >
            <span className="material-symbols-outlined text-[12px]">{copied ? "check" : "content_copy"}</span>
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
        <pre
          className="p-5 overflow-x-auto text-[12px] leading-relaxed m-0 max-h-[480px] overflow-y-auto"
          style={{ fontFamily: "'Cascadia Code','Fira Code','Courier New',monospace", background: "#0d0d14" }}
        >
          <code dangerouslySetInnerHTML={{ __html: hlHtml(htmlOutput) }} />
        </pre>
      </div>

      {/* ── Locale summary chips ──────────────────────────── */}
      {variants.filter(v => v.lang && v.url).length > 0 && (
        <div className="glass-panel rounded-2xl p-5 flex flex-col gap-3" style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
          <PanelHeader icon="public" title="Locale Summary" hint="Configured hreflang values" />
          <div className="flex flex-wrap gap-2">
            {opts.includeXDefault && (
              <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold"
                style={{ background: "rgba(249,115,22,0.08)", color: ACCENT, border: "1px solid rgba(249,115,22,0.2)" }}>
                <span className="material-symbols-outlined text-[12px]">public</span>x-default
              </span>
            )}
            {variants
              .filter(v => v.lang.trim() && v.url.trim())
              .map(v => {
                const locale = v.country ? `${v.lang}-${v.country}` : v.lang;
                const valid  = LANG_RE.test(v.lang) && (!v.country || COUNTRY_RE.test(v.country));
                return (
                  <span key={v.id} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold"
                    style={
                      valid
                        ? { background: "rgba(34,197,94,0.08)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.2)" }
                        : { background: "rgba(239,68,68,0.08)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)" }
                    }>
                    <span className="material-symbols-outlined text-[12px]">{valid ? "check" : "error"}</span>
                    {locale}
                  </span>
                );
              })}
          </div>
        </div>
      )}

    </div>
  );
}
