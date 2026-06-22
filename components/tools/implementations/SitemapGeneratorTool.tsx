"use client";

/**
 * XML Sitemap Generator
 *
 * Architecture:
 *   State: websiteUrl, entries[], inputMode ("manual" | "bulk"), bulkText, outputTab
 *   Derived (useMemo): prettyXml, rawXml, validation score + issues, byte size
 *
 * Generation:
 *   buildXml() → standards-compliant <?xml …?><urlset …>…</urlset>
 *   Each entry emits <loc>, optional <lastmod>, <changefreq>, <priority>
 *   URL values are XML-escaped (& → &amp; etc.)
 *
 * Modes:
 *   Manual — editable table (URL, lastmod, changefreq, priority) + per-row remove
 *   Bulk   — textarea paste (one URL per line); "Apply" imports into manual mode
 *
 * Validation score 0–100:
 *   Has ≥1 URL (+20), all URLs valid format (+25), no duplicates (+15),
 *   has lastmod on ≥1 (+15), ≤50k URLs (+15), no URLs >2048 chars (+10)
 *
 * Syntax highlight: line-by-line tag detection, HTML-escaped before coloring (XSS safe)
 */

import { useState, useMemo, useCallback } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────
type ChangeFreq  = "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
type InputMode   = "manual" | "bulk";
type OutputTab   = "pretty" | "raw";

interface SitemapEntry {
  id:         string;
  url:        string;
  lastmod:    string;
  changefreq: ChangeFreq | "";
  priority:   string;
}

// ── Constants ─────────────────────────────────────────────────────────────────
const ACCENT     = "#f97316";
const FREQS: (ChangeFreq | "")[] = [
  "", "always", "hourly", "daily", "weekly", "monthly", "yearly", "never",
];
const PRIORITIES = Array.from({ length: 11 }, (_, i) => (i / 10).toFixed(1));

// ── Helpers ───────────────────────────────────────────────────────────────────
function uid() { return Math.random().toString(36).slice(2, 9); }

function mkEntry(url = ""): SitemapEntry {
  return { id: uid(), url, lastmod: "", changefreq: "weekly", priority: "0.8" };
}

const DEFAULT_ENTRIES: SitemapEntry[] = [mkEntry()];

function escXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ── XML generation ────────────────────────────────────────────────────────────
function buildXml(entries: SitemapEntry[], pretty: boolean): string {
  const filled = entries.filter(e => e.url.trim());
  if (filled.length === 0) return "";

  const nl = pretty ? "\n" : "";
  const i1 = pretty ? "  " : "";
  const i2 = pretty ? "    " : "";

  const blocks = filled.map(e => {
    const lines: string[] = [`${i1}<url>`];
    lines.push(`${i2}<loc>${escXml(e.url.trim())}</loc>`);
    if (e.lastmod)    lines.push(`${i2}<lastmod>${e.lastmod}</lastmod>`);
    if (e.changefreq) lines.push(`${i2}<changefreq>${e.changefreq}</changefreq>`);
    if (e.priority)   lines.push(`${i2}<priority>${e.priority}</priority>`);
    lines.push(`${i1}</url>`);
    return lines.join(nl);
  });

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
    ...blocks,
    `</urlset>`,
  ].join(nl);
}

// ── Syntax highlight ──────────────────────────────────────────────────────────
function hlXml(raw: string): string {
  return raw
    .split("\n")
    .map(line => {
      // HTML-escape first — safe against any user-entered content in URLs
      const s = line
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
      const t = s.trim();
      if (!t) return "";

      if (t.startsWith("&lt;?"))
        return `<span style="color:#6b7280">${s}</span>`;

      if (t.startsWith("&lt;urlset") || t === "&lt;/urlset&gt;")
        return `<span style="color:#f97316">${s}</span>`;

      if (t === "&lt;url&gt;" || t === "&lt;/url&gt;")
        return `<span style="color:#a78bfa">${s}</span>`;

      if (t.startsWith("&lt;loc&gt;"))
        return s.replace(
          /^(\s*)(&lt;loc&gt;)(.+?)(&lt;\/loc&gt;)$/,
          '$1<span style="color:#4ade80">$2</span><span style="color:#86efac">$3</span><span style="color:#4ade80">$4</span>',
        );

      if (t.startsWith("&lt;lastmod&gt;"))
        return s.replace(
          /^(\s*)(&lt;lastmod&gt;)(.+?)(&lt;\/lastmod&gt;)$/,
          '$1<span style="color:#60a5fa">$2</span><span style="color:#93c5fd">$3</span><span style="color:#60a5fa">$4</span>',
        );

      if (t.startsWith("&lt;changefreq&gt;"))
        return s.replace(
          /^(\s*)(&lt;changefreq&gt;)(.+?)(&lt;\/changefreq&gt;)$/,
          '$1<span style="color:#fbbf24">$2</span><span style="color:#fde68a">$3</span><span style="color:#fbbf24">$4</span>',
        );

      if (t.startsWith("&lt;priority&gt;"))
        return s.replace(
          /^(\s*)(&lt;priority&gt;)(.+?)(&lt;\/priority&gt;)$/,
          '$1<span style="color:#f97316">$2</span><span style="color:#fbd5b5">$3</span><span style="color:#f97316">$4</span>',
        );

      return `<span style="color:#e8dff0">${s}</span>`;
    })
    .join("\n");
}

// ── Validation ────────────────────────────────────────────────────────────────
interface Issue { level: "error" | "warning" | "info"; text: string; }

function runValidation(entries: SitemapEntry[]): { score: number; issues: Issue[] } {
  const issues: Issue[] = [];
  let score  = 0;
  const filled = entries.filter(e => e.url.trim());

  // 1. Has ≥1 URL (+20)
  if (filled.length > 0) {
    score += 20;
  } else {
    issues.push({ level: "warning", text: "Add at least one URL to generate a valid sitemap." });
    return { score, issues };
  }

  // 2. All URLs valid (+25)
  const invalid = filled.filter(e => {
    try { new URL(e.url.trim()); return false; }
    catch { return true; }
  });
  if (invalid.length === 0) score += 25;
  else issues.push({ level: "error", text: `${invalid.length} URL(s) are invalid — each URL must include the full scheme (https://).` });

  // 3. No duplicates (+15)
  const seen  = new Set<string>();
  let dupCount = 0;
  filled.forEach(e => {
    const k = e.url.trim().toLowerCase();
    if (seen.has(k)) dupCount++;
    else seen.add(k);
  });
  if (dupCount === 0) score += 15;
  else issues.push({ level: "error", text: `${dupCount} duplicate URL(s) found — remove them to pass sitemap validation.` });

  // 4. Has lastmod on at least one URL (+15)
  if (filled.some(e => e.lastmod)) score += 15;
  else issues.push({ level: "info", text: "Add Last Modified dates to help crawlers prioritise recently updated pages." });

  // 5. Within protocol limit of 50,000 URLs (+15)
  if (filled.length <= 50000) score += 15;
  else issues.push({ level: "warning", text: "Sitemaps are limited to 50,000 URLs — split into multiple files and use a Sitemap Index." });

  // 6. No overly long URLs (+10)
  const longUrls = filled.filter(e => e.url.length > 2048);
  if (longUrls.length === 0) score += 10;
  else issues.push({ level: "warning", text: `${longUrls.length} URL(s) exceed 2,048 characters — some crawlers may ignore these.` });

  return { score: Math.min(100, score), issues };
}

// ── Shared styles ─────────────────────────────────────────────────────────────
const inputCls = [
  "w-full rounded-xl px-3 py-2.5 text-[13px] outline-none transition-all",
  "bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)]",
  "focus:border-[rgba(249,115,22,0.4)] text-[#e8dff0] placeholder-[#3d3345]",
].join(" ");

const selectCls = [
  "w-full rounded-xl px-2.5 py-2 text-[12px] outline-none transition-all cursor-pointer",
  "bg-[#1a1525] border border-[rgba(255,255,255,0.08)]",
  "focus:border-[rgba(249,115,22,0.4)] text-[#e8dff0]",
].join(" ");

// ── Component ─────────────────────────────────────────────────────────────────
export default function SitemapGeneratorTool() {
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [entries,    setEntries]    = useState<SitemapEntry[]>(DEFAULT_ENTRIES);
  const [mode,       setMode]       = useState<InputMode>("manual");
  const [bulkText,   setBulkText]   = useState("");
  const [outputTab,  setOutputTab]  = useState<OutputTab>("pretty");
  const [copiedXml,  setCopiedXml]  = useState(false);
  const [copiedList, setCopiedList] = useState(false);

  // ── Derived ────────────────────────────────────────────────────────────────
  const prettyXml = useMemo(() => buildXml(entries, true),  [entries]);
  const rawXml    = useMemo(() => buildXml(entries, false), [entries]);
  const shownXml  = outputTab === "pretty" ? prettyXml : rawXml;
  const filledCount = useMemo(() => entries.filter(e => e.url.trim()).length, [entries]);
  const sizeKb = useMemo(() => {
    if (!prettyXml) return "0.0";
    return (new TextEncoder().encode(prettyXml).byteLength / 1024).toFixed(1);
  }, [prettyXml]);

  const { score, issues } = useMemo(() => runValidation(entries), [entries]);
  const scoreColor = score >= 71 ? "#22c55e" : score >= 41 ? "#f59e0b" : "#ef4444";
  const scoreLabel = score >= 71 ? "Good" : score >= 41 ? "Needs work" : "Poor";
  const circ = 2 * Math.PI * 34;

  // ── Entry CRUD ─────────────────────────────────────────────────────────────
  const addEntry = useCallback(() => {
    setEntries(p => [...p, mkEntry()]);
  }, []);

  const removeEntry = useCallback((id: string) => {
    setEntries(p => (p.length > 1 ? p.filter(e => e.id !== id) : p));
  }, []);

  const patchEntry = useCallback((id: string, patch: Partial<SitemapEntry>) => {
    setEntries(p => p.map(e => (e.id === id ? { ...e, ...patch } : e)));
  }, []);

  // ── Mode switch ────────────────────────────────────────────────────────────
  const switchMode = useCallback((next: InputMode) => {
    if (next === "bulk") {
      setBulkText(entries.map(e => e.url).filter(Boolean).join("\n"));
    }
    setMode(next);
  }, [entries]);

  const applyBulk = useCallback(() => {
    const urls = bulkText.split("\n").map(l => l.trim()).filter(Boolean);
    if (urls.length > 0) {
      setEntries(urls.map(u => mkEntry(u)));
      setMode("manual");
    }
  }, [bulkText]);

  // ── Actions ────────────────────────────────────────────────────────────────
  const copyXml = useCallback(async () => {
    try { await navigator.clipboard.writeText(prettyXml); } catch { /* blocked */ }
    setCopiedXml(true);
    setTimeout(() => setCopiedXml(false), 2000);
  }, [prettyXml]);

  const copyUrlList = useCallback(async () => {
    const list = entries.filter(e => e.url.trim()).map(e => e.url.trim()).join("\n");
    try { await navigator.clipboard.writeText(list); } catch { /* blocked */ }
    setCopiedList(true);
    setTimeout(() => setCopiedList(false), 2000);
  }, [entries]);

  const download = useCallback(() => {
    const blob = new Blob([prettyXml], { type: "application/xml" });
    const url  = URL.createObjectURL(blob);
    Object.assign(document.createElement("a"), { href: url, download: "sitemap.xml" }).click();
    URL.revokeObjectURL(url);
  }, [prettyXml]);

  const clearEntries = useCallback(() => {
    setEntries([mkEntry()]);
  }, []);

  const reset = useCallback(() => {
    setWebsiteUrl("");
    setEntries(DEFAULT_ENTRIES);
    setMode("manual");
    setBulkText("");
    setCopiedXml(false);
    setCopiedList(false);
  }, []);

  // ── JSX ────────────────────────────────────────────────────────────────────
  return (
    <div className="mb-12 flex flex-col gap-6">

      {/* ── Website settings ────────────────────────────────────── */}
      <div className="glass-panel rounded-2xl p-5 flex flex-col gap-4"
        style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
        <div className="flex items-center gap-2 pb-1"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
          <span className="material-symbols-outlined text-[16px]" style={{ color: ACCENT }}>language</span>
          <p className="text-[13px] font-bold" style={{ color: "#e8dff0" }}>Website</p>
        </div>
        <div className="flex flex-col gap-1.5 max-w-lg">
          <label htmlFor="sm-website" className="text-[11px] font-semibold text-[#988d9f]">
            Website URL <span className="font-normal text-[#3d3345]">(optional — used to prefix relative URLs)</span>
          </label>
          <input
            id="sm-website" type="url" value={websiteUrl}
            onChange={e => setWebsiteUrl(e.target.value)}
            placeholder="https://example.com"
            className={inputCls}
            aria-label="Website URL"
          />
        </div>
      </div>

      {/* ── Mode selector ──────────────────────────────────────── */}
      <div className="flex items-center gap-2">
        <p className="text-[12px] font-semibold mr-2" style={{ color: "#988d9f" }}>Input mode:</p>
        {(["manual", "bulk"] as InputMode[]).map(m => (
          <button key={m} onClick={() => switchMode(m)}
            className="px-4 py-1.5 rounded-xl text-[12px] font-bold transition-all capitalize"
            style={mode === m ? {
              background: "rgba(249,115,22,0.12)", color: ACCENT,
              border: "1px solid rgba(249,115,22,0.32)",
            } : {
              background: "rgba(255,255,255,0.03)", color: "#988d9f",
              border: "1px solid rgba(255,255,255,0.07)",
            }}>
            {m === "manual" ? "Table editor" : "Paste URL list"}
          </button>
        ))}
        {filledCount > 0 && (
          <span className="ml-auto text-[11px] px-2.5 py-1 rounded-full font-semibold"
            style={{ background: "rgba(249,115,22,0.08)", color: ACCENT }}>
            {filledCount} URL{filledCount !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* ── Manual table ───────────────────────────────────────── */}
      {mode === "manual" && (
        <div className="glass-panel rounded-2xl overflow-hidden"
          style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
          {/* Table header */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px]" aria-label="URL entries">
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}>
                  <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider"
                    style={{ color: "#988d9f", width: "40%" }}>URL</th>
                  <th className="text-left px-3 py-3 text-[11px] font-bold uppercase tracking-wider"
                    style={{ color: "#988d9f", width: "140px" }}>Last Modified</th>
                  <th className="text-left px-3 py-3 text-[11px] font-bold uppercase tracking-wider"
                    style={{ color: "#988d9f", width: "130px" }}>Change Freq</th>
                  <th className="text-left px-3 py-3 text-[11px] font-bold uppercase tracking-wider"
                    style={{ color: "#988d9f", width: "90px" }}>Priority</th>
                  <th className="px-3 py-3" style={{ width: "44px" }} aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {entries.map((entry, idx) => {
                  const isInvalidUrl = entry.url.trim() !== "" && (() => {
                    try { new URL(entry.url.trim()); return false; }
                    catch { return true; }
                  })();

                  return (
                    <tr key={entry.id}
                      style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
                      className="transition-colors hover:bg-[rgba(255,255,255,0.015)]">
                      {/* URL */}
                      <td className="px-4 py-2.5">
                        <input
                          type="url"
                          value={entry.url}
                          onChange={e => patchEntry(entry.id, { url: e.target.value })}
                          placeholder={`https://example.com/${idx === 0 ? "" : "page/"}`}
                          className={inputCls}
                          style={isInvalidUrl ? { borderColor: "rgba(239,68,68,0.5)" } : undefined}
                          aria-label={`URL for row ${idx + 1}`}
                        />
                      </td>
                      {/* Last Modified */}
                      <td className="px-3 py-2.5">
                        <input
                          type="date"
                          value={entry.lastmod}
                          onChange={e => patchEntry(entry.id, { lastmod: e.target.value })}
                          className={inputCls}
                          aria-label="Last modified date"
                          style={{ colorScheme: "dark" }}
                        />
                      </td>
                      {/* Change Freq */}
                      <td className="px-3 py-2.5">
                        <select
                          value={entry.changefreq}
                          onChange={e => patchEntry(entry.id, { changefreq: e.target.value as ChangeFreq | "" })}
                          className={selectCls}
                          aria-label="Change frequency">
                          {FREQS.map(f => (
                            <option key={f} value={f}>{f || "— not set —"}</option>
                          ))}
                        </select>
                      </td>
                      {/* Priority */}
                      <td className="px-3 py-2.5">
                        <select
                          value={entry.priority}
                          onChange={e => patchEntry(entry.id, { priority: e.target.value })}
                          className={selectCls}
                          aria-label="Priority">
                          <option value="">—</option>
                          {PRIORITIES.map(p => (
                            <option key={p} value={p}>{p}</option>
                          ))}
                        </select>
                      </td>
                      {/* Remove */}
                      <td className="px-3 py-2.5">
                        <button
                          onClick={() => removeEntry(entry.id)}
                          disabled={entries.length <= 1}
                          aria-label={`Remove row ${idx + 1}`}
                          className="w-7 h-7 flex items-center justify-center rounded-lg transition-all disabled:opacity-20 disabled:cursor-not-allowed"
                          style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)" }}>
                          <span className="material-symbols-outlined text-[13px] text-red-400">close</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Table footer */}
          <div className="px-4 py-3 flex items-center gap-3 flex-wrap"
            style={{ borderTop: "1px solid rgba(255,255,255,0.05)", background: "rgba(255,255,255,0.01)" }}>
            <button onClick={addEntry}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12px] font-bold transition-all"
              style={{ background: "rgba(249,115,22,0.09)", color: ACCENT, border: "1px solid rgba(249,115,22,0.22)" }}>
              <span className="material-symbols-outlined text-[15px]">add</span>Add URL
            </button>
            {entries.length > 1 && (
              <button onClick={clearEntries}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-semibold transition-all"
                style={{ background: "rgba(255,255,255,0.03)", color: "#988d9f", border: "1px solid rgba(255,255,255,0.07)" }}>
                <span className="material-symbols-outlined text-[13px]">clear_all</span>Clear all
              </button>
            )}
            <span className="ml-auto text-[11px]" style={{ color: "#3d3345" }}>
              {entries.length} row{entries.length !== 1 ? "s" : ""} total
            </span>
          </div>
        </div>
      )}

      {/* ── Bulk paste mode ─────────────────────────────────────── */}
      {mode === "bulk" && (
        <div className="glass-panel rounded-2xl p-5 flex flex-col gap-4"
          style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[13px] font-bold" style={{ color: "#e8dff0" }}>Paste URL List</p>
              <p className="text-[11px] mt-0.5" style={{ color: "#988d9f" }}>
                One URL per line — all will use default changefreq (weekly) and priority (0.8)
              </p>
            </div>
            <button onClick={applyBulk}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12px] font-bold transition-all shrink-0"
              style={{ background: "rgba(249,115,22,0.1)", color: ACCENT, border: "1px solid rgba(249,115,22,0.25)" }}>
              <span className="material-symbols-outlined text-[14px]">import_export</span>
              Import to table
            </button>
          </div>
          <textarea
            value={bulkText}
            onChange={e => setBulkText(e.target.value)}
            placeholder={"https://example.com/\nhttps://example.com/about/\nhttps://example.com/blog/\nhttps://example.com/contact/"}
            rows={10}
            className={`${inputCls} resize-y font-mono`}
            style={{ lineHeight: "1.6" }}
            aria-label="Bulk URL list"
            spellCheck={false}
          />
          <p className="text-[11px]" style={{ color: "#3d3345" }}>
            {bulkText.split("\n").filter(l => l.trim()).length} URL{bulkText.split("\n").filter(l => l.trim()).length !== 1 ? "s" : ""} detected
          </p>
        </div>
      )}

      {/* ── Validation score ─────────────────────────────────────── */}
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

        {/* Issues list */}
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-bold mb-2" style={{ color: "#e8dff0" }}>Validation</p>
          {issues.length === 0 && filledCount > 0 ? (
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px] text-green-400">check_circle</span>
              <span className="text-[13px]" style={{ color: "#22c55e" }}>
                All checks passed — your sitemap looks great!
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

      {/* ── Action buttons ────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-3">
        <button onClick={copyXml} disabled={!prettyXml}
          className="btn-primary flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm disabled:opacity-40 disabled:cursor-not-allowed">
          <span className="material-symbols-outlined text-[16px]">
            {copiedXml ? "check" : "content_copy"}
          </span>
          {copiedXml ? "Copied!" : "Copy XML"}
        </button>

        <button onClick={download} disabled={!prettyXml}
          className="flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ background: "rgba(249,115,22,0.09)", color: ACCENT, border: "1px solid rgba(249,115,22,0.22)" }}>
          <span className="material-symbols-outlined text-[15px]">download</span>
          Download sitemap.xml
        </button>

        <button onClick={copyUrlList} disabled={filledCount === 0}
          className="flex items-center gap-2 px-4 py-3 rounded-xl font-semibold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ background: "rgba(255,255,255,0.04)", color: "#c8c0d0", border: "1px solid rgba(255,255,255,0.08)" }}>
          <span className="material-symbols-outlined text-[14px]">
            {copiedList ? "check" : "list"}
          </span>
          {copiedList ? "Copied!" : "Copy URL List"}
        </button>

        <button onClick={reset}
          className="flex items-center gap-2 px-4 py-3 rounded-xl font-semibold text-sm transition-all ml-auto"
          style={{ background: "rgba(255,255,255,0.03)", color: "#988d9f", border: "1px solid rgba(255,255,255,0.07)" }}>
          <span className="material-symbols-outlined text-[14px]">restart_alt</span>Reset
        </button>
      </div>

      {/* ── XML output ────────────────────────────────────────────── */}
      <div className="glass-panel rounded-2xl overflow-hidden"
        style={{ border: "1px solid rgba(249,115,22,0.18)" }}>
        {/* Panel header */}
        <div className="px-5 py-3 flex items-center justify-between flex-wrap gap-3"
          style={{ borderBottom: "1px solid rgba(249,115,22,0.1)", background: "rgba(249,115,22,0.03)" }}>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[14px]" style={{ color: ACCENT }}>account_tree</span>
            <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: ACCENT }}>
              sitemap.xml — Live Preview
            </span>
            {filledCount > 0 && (
              <span className="text-[10px] ml-1" style={{ color: "#988d9f" }}>
                {filledCount} URL{filledCount !== 1 ? "s" : ""} · {sizeKb} KB
              </span>
            )}
          </div>

          {/* Output tab + copy */}
          <div className="flex items-center gap-2">
            <div className="flex rounded-xl overflow-hidden"
              style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
              {(["pretty", "raw"] as OutputTab[]).map(t => (
                <button key={t} onClick={() => setOutputTab(t)}
                  className="px-3 py-1 text-[11px] font-bold transition-all"
                  style={outputTab === t ? {
                    background: "rgba(249,115,22,0.15)", color: ACCENT,
                  } : {
                    background: "transparent", color: "#988d9f",
                  }}>
                  {t === "pretty" ? "Pretty" : "Raw"}
                </button>
              ))}
            </div>
            <button onClick={copyXml} disabled={!prettyXml}
              className="flex items-center gap-1.5 px-3 py-1 rounded-xl text-[11px] font-bold transition-all disabled:opacity-40"
              style={{ background: "rgba(249,115,22,0.1)", color: ACCENT }}>
              <span className="material-symbols-outlined text-[12px]">
                {copiedXml ? "check" : "content_copy"}
              </span>
              {copiedXml ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>

        {/* Legend */}
        <div className="px-5 py-2 flex flex-wrap gap-x-4 gap-y-1"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", background: "#0d0d14" }}>
          {[
            { label: "urlset",      color: "#f97316" },
            { label: "url",         color: "#a78bfa" },
            { label: "loc",         color: "#4ade80" },
            { label: "lastmod",     color: "#60a5fa" },
            { label: "changefreq",  color: "#fbbf24" },
            { label: "priority",    color: "#f97316" },
          ].map(({ label, color }) => (
            <span key={label} className="flex items-center gap-1.5 text-[10px] font-semibold">
              <span className="w-2 h-2 rounded-full" style={{ background: color }} />
              <span style={{ color: "#988d9f" }}>{label}</span>
            </span>
          ))}
        </div>

        {/* Code block */}
        {prettyXml ? (
          <pre className="p-5 overflow-x-auto text-[12px] leading-relaxed m-0 max-h-[480px] overflow-y-auto"
            style={{ fontFamily: "'Cascadia Code','Fira Code','Courier New',monospace", background: "#0d0d14" }}>
            <code dangerouslySetInnerHTML={{ __html: hlXml(shownXml) }} />
          </pre>
        ) : (
          <div className="p-8 flex flex-col items-center gap-3"
            style={{ background: "#0d0d14" }}>
            <span className="material-symbols-outlined text-[32px]" style={{ color: "#3d3345" }}>account_tree</span>
            <p className="text-[13px]" style={{ color: "#3d3345" }}>Add URLs above to generate your sitemap</p>
          </div>
        )}
      </div>
    </div>
  );
}
