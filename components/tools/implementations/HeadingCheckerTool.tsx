"use client";

import { useState, useMemo, useCallback } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────
interface HeadingEntry { level: number; text: string; index: number; }
interface Stats { h1: number; h2: number; h3: number; h4: number; h5: number; h6: number; total: number; }
interface AnalysisResult { url: string; fetchedAt: string; headings: HeadingEntry[]; stats: Stats; }
interface Recommendation { level: "error" | "warning" | "info"; text: string; }

// ── Heading tag colors ────────────────────────────────────────────────────────
const H_COLOR: Record<number, string> = {
  1: "#f97316",
  2: "#60a5fa",
  3: "#a78bfa",
  4: "#34d399",
  5: "#f472b6",
  6: "#94a3b8",
};

const ACCENT = "#f97316";

// ── Scoring ───────────────────────────────────────────────────────────────────
function analyze(headings: HeadingEntry[], stats: Stats): { score: number; recommendations: Recommendation[]; issues: Set<number> } {
  const recs: Recommendation[] = [];
  const issues = new Set<number>(); // heading indices with issues
  let score = 100;

  // H1 presence and count
  if (stats.h1 === 0) {
    recs.push({ level: "error", text: "No H1 heading found — every page should have exactly one H1 as the primary topic." });
    score -= 30;
  } else if (stats.h1 > 1) {
    recs.push({ level: "warning", text: `${stats.h1} H1 headings found — use exactly one H1 per page for clear topic signaling.` });
    score -= 15;
    headings.filter(h => h.level === 1).forEach((h, i) => { if (i > 0) issues.add(h.index); });
  } else {
    recs.push({ level: "info", text: "Single H1 found — correct." });
  }

  // First heading should be H1
  if (headings.length > 0 && headings[0].level !== 1) {
    recs.push({ level: "warning", text: `Page starts with H${headings[0].level} instead of H1 — the first heading should always be H1.` });
    score -= 10;
    issues.add(headings[0].index);
  }

  // Skipped levels
  const skips: string[] = [];
  for (let i = 1; i < headings.length; i++) {
    const prev = headings[i - 1].level;
    const curr = headings[i].level;
    if (curr > prev + 1) {
      skips.push(`H${prev} → H${curr} at position ${i + 1}`);
      issues.add(headings[i].index);
    }
  }
  if (skips.length > 0) {
    recs.push({ level: "warning", text: `Heading level${skips.length > 1 ? "s" : ""} skipped: ${skips.slice(0, 3).join("; ")}${skips.length > 3 ? ` and ${skips.length - 3} more` : ""}. Avoid jumping from H2 to H4 — use sequential levels.` });
    score -= Math.min(20, skips.length * 5);
  }

  // Empty headings
  const empty = headings.filter(h => !h.text.trim());
  if (empty.length > 0) {
    recs.push({ level: "error", text: `${empty.length} empty heading${empty.length > 1 ? "s" : ""} found — empty headings confuse search engines and screen readers.` });
    empty.forEach(h => issues.add(h.index));
    score -= Math.min(20, empty.length * 7);
  }

  // Duplicate headings
  const seen = new Map<string, number[]>();
  headings.forEach(h => {
    const key = `h${h.level}:${h.text.toLowerCase().trim()}`;
    if (!seen.has(key)) seen.set(key, []);
    seen.get(key)!.push(h.index);
  });
  const dupes = [...seen.values()].filter(idxs => idxs.length > 1);
  if (dupes.length > 0) {
    recs.push({ level: "warning", text: `${dupes.length} duplicate heading${dupes.length > 1 ? "s" : ""} detected — duplicate headings at the same level dilute keyword signals.` });
    dupes.forEach(idxs => idxs.slice(1).forEach(i => issues.add(i)));
    score -= Math.min(15, dupes.length * 5);
  }

  // Total heading count extremes
  if (stats.total === 0) {
    recs.push({ level: "error", text: "No headings found on this page — add H1–H6 headings to structure your content." });
    score = 0;
  } else if (stats.total > 50) {
    recs.push({ level: "warning", text: `${stats.total} headings found — this may indicate over-use of headings. Reserve headings for genuine section breaks.` });
    score -= 5;
  }

  // H2 presence for long pages
  if (stats.h1 >= 1 && stats.total > 3 && stats.h2 === 0) {
    recs.push({ level: "info", text: "No H2 subheadings found — for multi-section pages, add H2s to improve structure and scannability." });
    score -= 5;
  }

  // Accessibility: logical order
  if (issues.size === 0 && stats.total > 0) {
    recs.push({ level: "info", text: "Heading hierarchy is logical and screen-reader friendly." });
  }

  return { score: Math.max(0, Math.min(100, score)), recommendations: recs, issues };
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

function StatBar({ label, count, max, color }: { label: string; count: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, (count / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-[11px] font-bold w-7 shrink-0" style={{ color }}>{label}</span>
      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-[12px] font-black tabular-nums w-6 text-right" style={{ color: "#e8dff0" }}>{count}</span>
    </div>
  );
}

function HeadingRow({ h, hasIssue, isDupe }: { h: HeadingEntry; hasIssue: boolean; isDupe: boolean }) {
  const color  = H_COLOR[h.level] ?? "#94a3b8";
  const indent = (h.level - 1) * 16;
  const empty  = !h.text.trim();
  return (
    <div
      className="flex items-start gap-2 py-2 px-3 rounded-xl transition-all"
      style={{
        marginLeft: indent,
        background: hasIssue ? "rgba(245,158,11,0.05)" : "rgba(255,255,255,0.02)",
        border: `1px solid ${hasIssue ? "rgba(245,158,11,0.18)" : "rgba(255,255,255,0.05)"}`,
      }}
    >
      {/* Level badge */}
      <span
        className="text-[10px] font-black px-1.5 py-0.5 rounded-md shrink-0 mt-0.5 tabular-nums"
        style={{ background: `${color}18`, color, border: `1px solid ${color}40` }}
      >
        H{h.level}
      </span>
      {/* Text */}
      <span className="flex-1 text-[12px] leading-relaxed break-all"
        style={{ color: empty ? "#3d3345" : hasIssue ? "#fcd34d" : "#e8dff0", fontStyle: empty ? "italic" : undefined }}>
        {empty ? "(empty)" : h.text}
      </span>
      {/* Badges */}
      <div className="flex items-center gap-1.5 shrink-0">
        <span className="text-[10px] tabular-nums" style={{ color: "#3d3345" }}>#{h.index + 1}</span>
        {empty && (
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md"
            style={{ background: "rgba(239,68,68,0.12)", color: "#ef4444" }}>EMPTY</span>
        )}
        {isDupe && !empty && (
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md"
            style={{ background: "rgba(245,158,11,0.12)", color: "#f59e0b" }}>DUPE</span>
        )}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function HeadingCheckerTool() {
  const [url,     setUrl]     = useState("");
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");
  const [result,  setResult]  = useState<AnalysisResult | null>(null);
  const [copied,  setCopied]  = useState(false);
  const [filter,  setFilter]  = useState<number | null>(null); // null = all

  const { score, recommendations, issues } = useMemo(
    () => result ? analyze(result.headings, result.stats) : { score: 0, recommendations: [], issues: new Set<number>() },
    [result],
  );

  // Duplicate index set for badge display
  const dupeIndices = useMemo(() => {
    if (!result) return new Set<number>();
    const seen = new Map<string, number[]>();
    result.headings.forEach(h => {
      const k = `h${h.level}:${h.text.toLowerCase().trim()}`;
      if (!seen.has(k)) seen.set(k, []);
      seen.get(k)!.push(h.index);
    });
    const s = new Set<number>();
    seen.forEach(idxs => { if (idxs.length > 1) idxs.slice(1).forEach(i => s.add(i)); });
    return s;
  }, [result]);

  const filtered = useMemo(
    () => filter === null ? (result?.headings ?? []) : (result?.headings ?? []).filter(h => h.level === filter),
    [result, filter],
  );

  const scoreColor = score >= 71 ? "#22c55e" : score >= 41 ? "#f59e0b" : "#ef4444";
  const scoreLabel = score >= 71 ? "Good" : score >= 41 ? "Needs work" : "Poor";

  const analyze_url = useCallback(async () => {
    const trimmed = url.trim();
    if (!trimmed) { setError("Please enter a URL."); return; }
    setError(""); setLoading(true); setResult(null); setFilter(null);
    try {
      const encoded = encodeURIComponent(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
      const res = await fetch(`/api/analyze-headings?url=${encoded}`);
      const data = await res.json() as AnalysisResult & { error?: string };
      if (data.error) setError(data.error);
      else setResult(data);
    } catch {
      setError("Network error — please try again.");
    } finally {
      setLoading(false);
    }
  }, [url]);

  const handleKey = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") analyze_url();
  }, [analyze_url]);

  const reset = useCallback(() => {
    setUrl(""); setResult(null); setError(""); setCopied(false); setFilter(null);
  }, []);

  const copyResults = useCallback(async () => {
    if (!result) return;
    const lines = [
      `Heading Analysis — ${result.url}`,
      `Score: ${score}/100`,
      "",
      ...result.headings.map(h => `${"  ".repeat(h.level - 1)}H${h.level}: ${h.text || "(empty)"}`),
    ];
    try { await navigator.clipboard.writeText(lines.join("\n")); } catch { /* blocked */ }
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  }, [result, score]);

  const exportJson = useCallback(() => {
    if (!result) return;
    const data = { ...result, score, recommendations: recommendations.map(r => ({ level: r.level, text: r.text })) };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const u = URL.createObjectURL(blob);
    Object.assign(document.createElement("a"), { href: u, download: "heading-analysis.json" }).click();
    URL.revokeObjectURL(u);
  }, [result, score, recommendations]);

  const exportTxt = useCallback(() => {
    if (!result) return;
    const lines = [
      `Heading Analysis — ${result.url}`,
      `Analyzed: ${new Date(result.fetchedAt).toLocaleString()}`,
      `Score: ${score}/100 (${scoreLabel})`,
      "",
      "=== STATISTICS ===",
      `Total: ${result.stats.total}`,
      ...([1,2,3,4,5,6] as const).map(n => `H${n}: ${result.stats[`h${n}` as keyof typeof result.stats]}`),
      "",
      "=== HEADINGS ===",
      ...result.headings.map(h => `[H${h.level}] ${"  ".repeat(h.level - 1)}${h.text || "(empty)"}`),
      "",
      "=== RECOMMENDATIONS ===",
      ...recommendations.map(r => `[${r.level.toUpperCase()}] ${r.text}`),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const u = URL.createObjectURL(blob);
    Object.assign(document.createElement("a"), { href: u, download: "heading-analysis.txt" }).click();
    URL.revokeObjectURL(u);
  }, [result, score, scoreLabel, recommendations]);

  const exportPdf = useCallback(() => {
    if (!result) return;
    const rows = result.headings.map(h => {
      const c = H_COLOR[h.level] ?? "#94a3b8";
      const indent = `padding-left:${(h.level - 1) * 16 + 8}px`;
      const flag = issues.has(h.index) ? ' <span style="color:#ca8a04;font-size:11px">[issue]</span>' : "";
      const dupe = dupeIndices.has(h.index) ? ' <span style="color:#ca8a04;font-size:11px">[dupe]</span>' : "";
      return `<tr><td style="${indent}"><span style="color:${c};font-weight:700">H${h.level}</span> ${h.text || "<em>(empty)</em>"}${flag}${dupe}</td><td style="color:#555;font-size:12px">#${h.index + 1}</td></tr>`;
    }).join("");
    const recRows = recommendations.map(r => `<div class="rec rec-${r.level}">[${r.level.toUpperCase()}] ${r.text}</div>`).join("");
    const html = `<!DOCTYPE html><html><head><title>Heading Analysis — ${result.url}</title>
<style>body{font-family:system-ui,sans-serif;max-width:800px;margin:2rem auto;color:#111;font-size:14px}
h1{font-size:20px}h2{font-size:15px;margin-top:24px;border-bottom:1px solid #ddd;padding-bottom:4px}
.score{font-size:36px;font-weight:900;color:${scoreColor}}
table{width:100%;border-collapse:collapse;margin-top:8px}td{padding:5px 8px;border-bottom:1px solid #eee;font-size:13px;vertical-align:top}
.rec{padding:4px 8px;border-radius:4px;margin-bottom:4px;font-size:13px}
.rec-error{background:#fee2e2;color:#991b1b}.rec-warning{background:#fef9c3;color:#854d0e}.rec-info{background:#eff6ff;color:#1e40af}
.stats{display:flex;flex-wrap:wrap;gap:12px;margin-top:8px}
.stat{background:#f5f5f5;border-radius:6px;padding:8px 12px;text-align:center}
.stat b{display:block;font-size:20px}.stat span{font-size:11px;color:#555}
</style></head><body>
<h1>Heading Analysis</h1>
<p style="color:#555">${result.url} &mdash; ${new Date(result.fetchedAt).toLocaleString()}</p>
<div class="score">${score}<span style="font-size:16px;font-weight:400;color:#555"> / 100 ${scoreLabel}</span></div>
<h2>Statistics</h2>
<div class="stats">
${([1,2,3,4,5,6] as const).map(n => `<div class="stat"><b style="color:${H_COLOR[n]}">${result.stats[`h${n}` as keyof typeof result.stats]}</b><span>H${n}</span></div>`).join("")}
<div class="stat"><b>${result.stats.total}</b><span>Total</span></div>
</div>
<h2>Headings</h2>
<table>${rows}</table>
<h2>Recommendations</h2>${recRows}
</body></html>`;
    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); w.print(); }
  }, [result, score, scoreLabel, scoreColor, recommendations, issues, dupeIndices]);

  return (
    <div className="mb-12 flex flex-col gap-6">

      {/* ── URL input ─────────────────────────────────────── */}
      <div className="glass-panel rounded-2xl p-5 flex flex-col gap-4" style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
        <PanelHeader icon="format_h1" title="Analyze Website Headings" />
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
            onClick={analyze_url}
            disabled={loading}
            className="btn-primary flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm shrink-0 disabled:opacity-60"
          >
            <span className="material-symbols-outlined text-[16px]">{loading ? "hourglass_top" : "search"}</span>
            {loading ? "Analyzing…" : "Analyze"}
          </button>
        </div>
        {error && (
          <div className="flex items-start gap-2 px-4 py-3 rounded-xl"
            style={{ background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.2)" }}>
            <span className="material-symbols-outlined text-[15px] mt-0.5 shrink-0 text-red-400">error</span>
            <p className="text-[13px]" style={{ color: "#fca5a5" }}>{error}</p>
          </div>
        )}
        {loading && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl"
            style={{ background: "rgba(249,115,22,0.06)", border: "1px solid rgba(249,115,22,0.15)" }}>
            <div className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin shrink-0"
              style={{ borderColor: `${ACCENT} transparent ${ACCENT} ${ACCENT}` }} />
            <p className="text-[13px]" style={{ color: ACCENT }}>Fetching and parsing headings — this may take a few seconds…</p>
          </div>
        )}
      </div>

      {/* ── Results ───────────────────────────────────────── */}
      {result && (() => {
        const stats = result.stats;
        const maxCount = Math.max(stats.h1, stats.h2, stats.h3, stats.h4, stats.h5, stats.h6, 1);

        return (
          <>
            {/* Score + Recommendations */}
            <div className="glass-panel rounded-2xl p-5 flex flex-wrap items-start gap-6"
              style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
              {/* Gauge */}
              <div className="flex flex-col items-center gap-1.5 shrink-0">
                <div className="relative w-24 h-24">
                  <svg width="96" height="96" viewBox="0 0 96 96" aria-label={`Score ${score} out of 100`}>
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
                <span className="text-[10px]" style={{ color: "#3d3345" }}>Heading Score</span>
              </div>

              {/* Recommendations */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                  <p className="text-[13px] font-bold" style={{ color: "#e8dff0" }}>Recommendations</p>
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                    style={{ background: "rgba(255,255,255,0.05)", color: "#988d9f" }}>
                    {stats.total} heading{stats.total !== 1 ? "s" : ""} · {issues.size} issue{issues.size !== 1 ? "s" : ""}
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

              {/* Action buttons */}
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

            {/* Stats + bar chart */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Count cards */}
              <div className="glass-panel rounded-2xl p-5 flex flex-col gap-3" style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
                <PanelHeader icon="bar_chart" title="Heading Counts" badge={`${stats.total} total`} />
                {([1,2,3,4,5,6] as const).map(n => (
                  <StatBar
                    key={n}
                    label={`H${n}`}
                    count={stats[`h${n}` as keyof typeof stats] as number}
                    max={maxCount}
                    color={H_COLOR[n]}
                  />
                ))}
              </div>

              {/* Issue summary */}
              <div className="glass-panel rounded-2xl p-5 flex flex-col gap-3" style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
                <PanelHeader icon="fact_check" title="SEO & Accessibility" />
                {[
                  { label: "H1 count",       ok: stats.h1 === 1,                   val: `${stats.h1} found`,                  warn: stats.h1 !== 1 },
                  { label: "Empty headings", ok: result.headings.filter(h => !h.text.trim()).length === 0, val: `${result.headings.filter(h => !h.text.trim()).length} empty`, warn: true },
                  { label: "Skipped levels", ok: issues.size === 0,                val: issues.size > 0 ? `${issues.size} detected` : "None", warn: true },
                  { label: "Duplicates",     ok: dupeIndices.size === 0,           val: dupeIndices.size > 0 ? `${dupeIndices.size} dupes` : "None", warn: true },
                  { label: "First heading",  ok: result.headings[0]?.level === 1,  val: result.headings[0] ? `H${result.headings[0].level}` : "—", warn: true },
                  { label: "H2 subheadings",ok: stats.h2 > 0,                     val: `${stats.h2} found`,                  warn: false },
                ].map(({ label, ok, val, warn }) => (
                  <div key={label} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[15px]" style={{ color: ok ? "#22c55e" : warn ? "#f59e0b" : "#988d9f" }}>
                        {ok ? "check_circle" : warn ? "warning" : "info"}
                      </span>
                      <span className="text-[12px]" style={{ color: "#988d9f" }}>{label}</span>
                    </div>
                    <span className="text-[12px] font-bold" style={{ color: ok ? "#22c55e" : warn ? "#f59e0b" : "#e8dff0" }}>{val}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Heading tree */}
            <div className="glass-panel rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
              <div className="px-5 py-4">
                <PanelHeader icon="account_tree" title="Heading Hierarchy" badge={`${filtered.length} shown`} />
              </div>

              {/* Filter tabs */}
              <div className="px-5 pb-3 flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => setFilter(null)}
                  className="px-3 py-1 rounded-xl text-[11px] font-bold transition-all"
                  style={filter === null
                    ? { background: "rgba(249,115,22,0.15)", color: ACCENT, border: "1px solid rgba(249,115,22,0.3)" }
                    : { background: "rgba(255,255,255,0.04)", color: "#988d9f", border: "1px solid rgba(255,255,255,0.08)" }}
                >
                  All ({stats.total})
                </button>
                {([1,2,3,4,5,6] as const).map(n => {
                  const c = stats[`h${n}` as keyof typeof stats] as number;
                  if (c === 0) return null;
                  return (
                    <button
                      key={n}
                      onClick={() => setFilter(n)}
                      className="px-3 py-1 rounded-xl text-[11px] font-bold transition-all"
                      style={filter === n
                        ? { background: `${H_COLOR[n]}22`, color: H_COLOR[n], border: `1px solid ${H_COLOR[n]}55` }
                        : { background: "rgba(255,255,255,0.04)", color: "#988d9f", border: "1px solid rgba(255,255,255,0.08)" }}
                    >
                      H{n} ({c})
                    </button>
                  );
                })}
              </div>

              <div className="px-4 pb-4 flex flex-col gap-1.5 max-h-[520px] overflow-y-auto">
                {filtered.length === 0 ? (
                  <p className="text-[13px] py-4 text-center" style={{ color: "#3d3345" }}>No headings at this level.</p>
                ) : (
                  filtered.map(h => (
                    <HeadingRow
                      key={h.index}
                      h={h}
                      hasIssue={issues.has(h.index)}
                      isDupe={dupeIndices.has(h.index)}
                    />
                  ))
                )}
              </div>
            </div>

            <p className="text-center text-[11px]" style={{ color: "#3d3345" }}>
              Analyzed {new Date(result.fetchedAt).toLocaleString()} &mdash; {result.url}
            </p>
          </>
        );
      })()}

      {/* Empty state */}
      {!result && !loading && (
        <div className="glass-panel rounded-2xl p-8 flex flex-col items-center gap-4 text-center"
          style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
          <span className="material-symbols-outlined text-[48px]" style={{ color: "#3d3345" }}>format_h1</span>
          <p className="text-[14px] font-semibold" style={{ color: "#988d9f" }}>Enter a URL above and click Analyze</p>
          <p className="text-[12px] max-w-md" style={{ color: "#3d3345" }}>
            The tool fetches your page server-side and extracts every H1–H6 heading, checks for missing H1, skipped levels, duplicates and empty tags, then scores your heading structure.
          </p>
          <div className="flex flex-wrap justify-center gap-2 mt-1">
            {["H1–H6 Extraction", "Hierarchy Tree", "Skipped Levels", "Duplicate Detection", "Empty Tags", "Accessibility"].map(f => (
              <span key={f} className="text-[11px] font-semibold px-3 py-1 rounded-full"
                style={{ background: "rgba(249,115,22,0.07)", color: "#988d9f", border: "1px solid rgba(249,115,22,0.15)" }}>
                {f}
              </span>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
