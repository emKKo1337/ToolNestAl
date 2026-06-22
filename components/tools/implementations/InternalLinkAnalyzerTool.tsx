"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import type { InternalLinkResult, PageData, LinkEdge } from "@/app/api/analyze-internal-links/route";

// ── Constants ─────────────────────────────────────────────────────────────────
const ACCENT = "#f97316";

function statusColor(p: PageData): string {
  if (p.isBroken)   return "#ef4444";
  if (p.isRedirect) return "#f59e0b";
  if (p.isOrphan)   return "#a855f7";
  if (p.isDeadEnd)  return "#60a5fa";
  return "#22c55e";
}

// ── Link Graph (SVG radial layout) ────────────────────────────────────────────
const GW = 700, GH = 420, CX = GW / 2, CY = GH / 2;
const RING_R = [0, 120, 210, 290, 360];

function buildLayout(pages: PageData[]): Record<string, { x: number; y: number }> {
  const pos: Record<string, { x: number; y: number }> = {};
  const byDepth: Record<number, PageData[]> = {};
  for (const p of pages) {
    if (!byDepth[p.depth]) byDepth[p.depth] = [];
    byDepth[p.depth].push(p);
  }
  for (const [d, group] of Object.entries(byDepth)) {
    const depth = Number(d);
    const r = RING_R[Math.min(depth, RING_R.length - 1)];
    if (depth === 0) {
      if (group[0]) pos[group[0].url] = { x: CX, y: CY };
    } else {
      group.forEach((page, i) => {
        const angle = (2 * Math.PI * i) / group.length - Math.PI / 2;
        pos[page.url] = { x: CX + r * Math.cos(angle), y: CY + r * Math.sin(angle) };
      });
    }
  }
  return pos;
}

function LinkGraph({ pages, edges, selectedUrl, onSelect }: {
  pages: PageData[];
  edges: LinkEdge[];
  selectedUrl: string | null;
  onSelect: (url: string | null) => void;
}) {
  const pos = useMemo(() => buildLayout(pages), [pages]);

  const activeEdges = useMemo(() => {
    if (!selectedUrl) return new Set<string>();
    const s = new Set<string>();
    edges.forEach(e => { if (e.from === selectedUrl || e.to === selectedUrl) s.add(`${e.from}→${e.to}`); });
    return s;
  }, [selectedUrl, edges]);

  const shortUrl = (url: string) => {
    try {
      const u = new URL(url);
      const p = u.pathname === "/" ? "/" : u.pathname.replace(/\/$/, "").split("/").pop() ?? "/";
      return p.slice(0, 14) + (p.length > 14 ? "…" : "");
    } catch { return url.slice(0, 12); }
  };

  return (
    <svg width="100%" viewBox={`0 0 ${GW} ${GH}`} style={{ background: "rgba(0,0,0,0.2)", borderRadius: "12px" }}
      aria-label="Internal link graph">
      {/* Depth rings (guide circles) */}
      {RING_R.slice(1).map(r => (
        <circle key={r} cx={CX} cy={CY} r={r} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
      ))}

      {/* Edges */}
      {edges.slice(0, 300).map((e, i) => {
        const from = pos[e.from];
        const to   = pos[e.to];
        if (!from || !to) return null;
        const key = `${e.from}→${e.to}`;
        const isActive = activeEdges.has(key);
        const isSelected = !selectedUrl || isActive;
        return (
          <line key={i}
            x1={from.x} y1={from.y} x2={to.x} y2={to.y}
            stroke={isActive ? ACCENT : "rgba(255,255,255,0.08)"}
            strokeWidth={isActive ? 1.5 : 0.8}
            opacity={isSelected ? 1 : 0.15}
            style={{ transition: "opacity 0.2s, stroke 0.2s" }}
          />
        );
      })}

      {/* Nodes */}
      {pages.map(p => {
        const pos2 = pos[p.url];
        if (!pos2) return null;
        const c    = statusColor(p);
        const isSel = p.url === selectedUrl;
        const r = p.depth === 0 ? 14 : Math.max(6, 12 - p.depth * 2);
        return (
          <g key={p.url} onClick={() => onSelect(isSel ? null : p.url)}
            style={{ cursor: "pointer" }}
            aria-label={p.url}>
            <circle cx={pos2.x} cy={pos2.y} r={r + (isSel ? 4 : 0)}
              fill={isSel ? c : `${c}30`}
              stroke={c}
              strokeWidth={isSel ? 2.5 : 1.5}
              opacity={!selectedUrl || isSel || activeEdges.has(`${selectedUrl}→${p.url}`) || activeEdges.has(`${p.url}→${selectedUrl}`) ? 1 : 0.25}
              style={{ transition: "all 0.2s" }}
            />
            {(p.depth <= 1 || isSel) && (
              <text x={pos2.x} y={pos2.y + r + 11}
                textAnchor="middle" fontSize="9" fill="rgba(255,255,255,0.6)" style={{ pointerEvents: "none" }}>
                {shortUrl(p.url)}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────
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

type SortKey = "depth" | "inLinks" | "outLinks" | "status" | "url";
type PageFilter = "all" | "orphan" | "deadEnd" | "broken" | "redirect";

// ── Main ──────────────────────────────────────────────────────────────────────
export default function InternalLinkAnalyzerTool() {
  const [url,          setUrl]          = useState("");
  const [maxPages,     setMaxPages]     = useState(5);
  const [userAgent,    setUserAgent]    = useState("bot");
  const [includeNoFol, setIncludeNoFol] = useState(true);
  const [loading,      setLoading]      = useState(false);
  const [progress,     setProgress]     = useState(0);
  const [error,        setError]        = useState("");
  const [result,       setResult]       = useState<InternalLinkResult | null>(null);
  const [copied,       setCopied]       = useState(false);
  const [sortKey,      setSortKey]      = useState<SortKey>("depth");
  const [sortAsc,      setSortAsc]      = useState(true);
  const [filter,       setFilter]       = useState<PageFilter>("all");
  const [search,       setSearch]       = useState("");
  const [selectedUrl,  setSelectedUrl]  = useState<string | null>(null);
  const [activeTab,    setActiveTab]    = useState<"table" | "graph" | "anchors">("table");
  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (loading) {
      setProgress(5);
      let p = 5;
      progressRef.current = setInterval(() => {
        p = Math.min(p + (100 - p) * 0.05, 90);
        setProgress(p);
      }, 1000);
    } else {
      if (progressRef.current) clearInterval(progressRef.current);
      setProgress(result ? 100 : 0);
    }
    return () => { if (progressRef.current) clearInterval(progressRef.current); };
  }, [loading, result]);

  const scoreColor = result
    ? result.seoScore >= 71 ? "#22c55e" : result.seoScore >= 41 ? "#f59e0b" : "#ef4444"
    : "#988d9f";
  const scoreLabel = result
    ? result.seoScore >= 71 ? "Healthy" : result.seoScore >= 41 ? "Needs work" : "Poor"
    : "";

  const displayPages = useMemo(() => {
    if (!result) return [];
    let pages = [...result.pages];
    if (filter === "orphan")   pages = pages.filter(p => p.isOrphan);
    if (filter === "deadEnd")  pages = pages.filter(p => p.isDeadEnd);
    if (filter === "broken")   pages = pages.filter(p => p.isBroken);
    if (filter === "redirect") pages = pages.filter(p => p.isRedirect);
    if (search) {
      const q = search.toLowerCase();
      pages = pages.filter(p => p.url.toLowerCase().includes(q) || p.title.toLowerCase().includes(q));
    }
    pages.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "depth")    cmp = a.depth - b.depth;
      if (sortKey === "inLinks")  cmp = a.inLinks - b.inLinks;
      if (sortKey === "outLinks") cmp = a.outLinks - b.outLinks;
      if (sortKey === "status")   cmp = a.status - b.status;
      if (sortKey === "url")      cmp = a.url.localeCompare(b.url);
      return sortAsc ? cmp : -cmp;
    });
    return pages;
  }, [result, filter, search, sortKey, sortAsc]);

  const handleSort = useCallback((key: SortKey) => {
    setSortKey(prev => {
      if (prev === key) { setSortAsc(a => !a); return prev; }
      setSortAsc(true);
      return key;
    });
  }, []);

  // Anchor text analysis
  const anchorData = useMemo(() => {
    if (!result) return [];
    const map: Record<string, number> = {};
    for (const e of result.edges) {
      const a = e.anchorText.trim().toLowerCase();
      if (a && a !== "[image]") map[a] = (map[a] ?? 0) + 1;
    }
    return Object.entries(map).sort(([, a], [, b]) => b - a).slice(0, 50);
  }, [result]);

  const analyze = useCallback(async () => {
    const trimmed = url.trim();
    if (!trimmed) { setError("Please enter a URL."); return; }
    setError(""); setResult(null); setLoading(true); setSelectedUrl(null); setFilter("all"); setSearch("");
    try {
      const res = await fetch("/api/analyze-internal-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: trimmed.startsWith("http") ? trimmed : `https://${trimmed}`,
          maxPages, userAgent, includeNoFollow: includeNoFol,
        }),
      });
      const data = await res.json() as InternalLinkResult & { error?: string };
      if (data.error) { setError(data.error); return; }
      setResult(data);
      setActiveTab("table");
    } catch {
      setError("Network error — please try again.");
    } finally {
      setLoading(false);
    }
  }, [url, maxPages, userAgent, includeNoFol]);

  const reset = useCallback(() => {
    setUrl(""); setResult(null); setError(""); setProgress(0); setSelectedUrl(null);
    setFilter("all"); setSearch("");
  }, []);

  // Selected page details
  const selectedPage = useMemo(() => result?.pages.find(p => p.url === selectedUrl) ?? null, [result, selectedUrl]);

  // ── Exports ───────────────────────────────────────────────────────────────
  const exportCsv = useCallback(() => {
    if (!result) return;
    const header = "URL,Title,Depth,Status,In Links,Out Links,Orphan,Dead End,Broken,Redirect";
    const rows = result.pages.map(p =>
      [p.url, p.title, p.depth, p.status, p.inLinks, p.outLinks, p.isOrphan, p.isDeadEnd, p.isBroken, p.isRedirect]
        .map(v => `"${String(v).replace(/"/g, '""')}"`)
        .join(",")
    ).join("\n");
    const blob = new Blob([`${header}\n${rows}`], { type: "text/csv" });
    const u = URL.createObjectURL(blob);
    Object.assign(document.createElement("a"), { href: u, download: "internal-links.csv" }).click();
    URL.revokeObjectURL(u);
  }, [result]);

  const exportJson = useCallback(() => {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" });
    const u = URL.createObjectURL(blob);
    Object.assign(document.createElement("a"), { href: u, download: "internal-links.json" }).click();
    URL.revokeObjectURL(u);
  }, [result]);

  const exportTxt = useCallback(() => {
    if (!result) return;
    const lines = [
      `Internal Link Analysis — ${result.seedUrl}`,
      `Analyzed: ${new Date(result.analyzedAt).toLocaleString()}`,
      `Score: ${result.seoScore}/100 | Pages: ${result.pagesCrawled} | Links: ${result.totalInternalLinks}`,
      `Orphans: ${result.orphanPages} | Dead-ends: ${result.deadEndPages} | Broken: ${result.brokenInternalLinks}`,
      "",
      "=== RECOMMENDATIONS ===",
      ...result.recommendations,
      "",
      "=== PAGES ===",
      ...result.pages.map(p =>
        `[D${p.depth}] ${p.url}\n  Status:${p.status} In:${p.inLinks} Out:${p.outLinks}${p.isOrphan ? " ORPHAN" : ""}${p.isDeadEnd ? " DEAD-END" : ""}${p.isBroken ? " BROKEN" : ""}`),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const u = URL.createObjectURL(blob);
    Object.assign(document.createElement("a"), { href: u, download: "internal-links.txt" }).click();
    URL.revokeObjectURL(u);
  }, [result]);

  const exportPdf = useCallback(() => {
    if (!result) return;
    const pageRows = result.pages.map(p => {
      const flags = [p.isOrphan && "Orphan", p.isDeadEnd && "Dead-end", p.isBroken && "Broken", p.isRedirect && "Redirect"].filter(Boolean).join(", ");
      const sc = p.isBroken ? "#dc2626" : p.isOrphan ? "#7c3aed" : "#16a34a";
      return `<tr><td style="font-size:11px;word-break:break-all">${p.url}</td><td>${p.depth}</td><td>${p.status}</td><td>${p.inLinks}</td><td>${p.outLinks}</td><td style="color:${sc};font-size:11px">${flags || "OK"}</td></tr>`;
    }).join("");
    const html = `<!DOCTYPE html><html><head><title>Internal Links — ${result.seedUrl}</title>
<style>body{font-family:system-ui,sans-serif;max-width:960px;margin:2rem auto;color:#111;font-size:13px}
h1{font-size:18px}h2{font-size:14px;margin-top:20px;border-bottom:1px solid #ddd;padding-bottom:4px}
.score{font-size:34px;font-weight:900}
.chips{display:flex;flex-wrap:wrap;gap:10px;margin:8px 0}.chip{background:#f5f5f5;border-radius:6px;padding:4px 10px;font-size:12px}.chip b{display:block;font-size:16px}
table{width:100%;border-collapse:collapse;margin-top:8px}
th,td{text-align:left;padding:4px 6px;border-bottom:1px solid #eee;font-size:11px;vertical-align:top}
th{font-weight:700;color:#555;background:#fafafa}
ul li{margin-bottom:4px;font-size:12px}
</style></head><body>
<h1>Internal Link Analysis</h1>
<p style="color:#666;word-break:break-all">${result.seedUrl} — ${new Date(result.analyzedAt).toLocaleString()}</p>
<div class="score" style="color:${scoreColor}">${result.seoScore}<span style="font-size:15px;font-weight:400;color:#555"> / 100 — ${scoreLabel}</span></div>
<div class="chips">
<div class="chip"><b>${result.pagesCrawled}</b>Pages</div>
<div class="chip"><b>${result.totalInternalLinks}</b>Links</div>
<div class="chip"><b style="color:${result.orphanPages > 0 ? "#7c3aed" : "#16a34a"}">${result.orphanPages}</b>Orphans</div>
<div class="chip"><b style="color:${result.deadEndPages > 0 ? "#2563eb" : "#16a34a"}">${result.deadEndPages}</b>Dead-ends</div>
<div class="chip"><b style="color:${result.brokenInternalLinks > 0 ? "#dc2626" : "#16a34a"}">${result.brokenInternalLinks}</b>Broken</div>
<div class="chip"><b>${result.maxDepth}</b>Max Depth</div>
</div>
<h2>Recommendations</h2><ul>${result.recommendations.map(r => `<li>${r}</li>`).join("")}</ul>
<h2>Pages (${result.pagesCrawled})</h2>
<table><thead><tr><th>URL</th><th>Depth</th><th>Status</th><th>In Links</th><th>Out Links</th><th>Flags</th></tr></thead>
<tbody>${pageRows}</tbody></table>
</body></html>`;
    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); w.print(); }
  }, [result, scoreColor, scoreLabel]);

  const copyResults = useCallback(async () => {
    if (!result) return;
    const lines = [
      `Internal Link Analysis — ${result.seedUrl}`,
      `Score: ${result.seoScore}/100 | Pages: ${result.pagesCrawled} | Orphans: ${result.orphanPages}`,
      ...result.recommendations,
    ];
    try { await navigator.clipboard.writeText(lines.join("\n")); } catch { /* blocked */ }
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  }, [result]);

  const inputCls = "rounded-xl px-3 py-2.5 text-[13px] outline-none transition-all bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] focus:border-[rgba(249,115,22,0.4)] text-[#e8dff0] placeholder-[#3d3345]";
  const tabOff = { background: "rgba(255,255,255,0.03)", color: "#988d9f", border: "1px solid rgba(255,255,255,0.07)" };
  const tabOn  = { background: "rgba(249,115,22,0.12)", color: ACCENT, border: "1px solid rgba(249,115,22,0.3)" };

  return (
    <div className="mb-12 flex flex-col gap-6">

      {/* ── Input ────────────────────────────────────────────────────── */}
      <div className="glass-panel rounded-2xl p-5 flex flex-col gap-4"
        style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
        <PanelHeader icon="account_tree" title="Analyze Internal Links" />

        <div className="flex gap-3 flex-wrap sm:flex-nowrap">
          <input type="url" value={url} onChange={e => setUrl(e.target.value)}
            onKeyDown={e => e.key === "Enter" && analyze()}
            placeholder="https://example.com" aria-label="Website URL"
            className={`${inputCls} flex-1`} />
          <button onClick={analyze} disabled={loading}
            className="btn-primary flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm shrink-0 disabled:opacity-60">
            <span className="material-symbols-outlined text-[15px]">{loading ? "hourglass_top" : "manage_search"}</span>
            {loading ? "Crawling…" : "Analyze Website"}
          </button>
        </div>

        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "#988d9f" }}>Max Pages</label>
            <select value={maxPages} onChange={e => setMaxPages(Number(e.target.value))} aria-label="Max pages" className={`${inputCls} cursor-pointer`}>
              <option value={3}>3 pages</option>
              <option value={5}>5 pages</option>
              <option value={7}>7 pages</option>
              <option value={10}>10 pages</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "#988d9f" }}>User Agent</label>
            <select value={userAgent} onChange={e => setUserAgent(e.target.value)} aria-label="User agent" className={`${inputCls} cursor-pointer`}>
              <option value="bot">ToolNest Bot</option>
              <option value="chrome">Chrome 124</option>
              <option value="firefox">Firefox 125</option>
            </select>
          </div>
          <div className="flex items-center gap-2 mt-4">
            <input type="checkbox" id="nofollow" checked={includeNoFol} onChange={e => setIncludeNoFol(e.target.checked)}
              className="w-4 h-4 accent-orange-500 cursor-pointer" />
            <label htmlFor="nofollow" className="text-[12px] font-semibold cursor-pointer" style={{ color: "#c8b89f" }}>Include NoFollow Links</label>
          </div>
        </div>

        {(loading || progress > 0) && (
          <div className="flex flex-col gap-2">
            <div className="flex justify-between">
              <p className="text-[12px]" style={{ color: ACCENT }}>
                {loading ? "Crawling pages and mapping link graph…" : "Analysis complete"}
              </p>
              <span className="text-[11px] font-bold tabular-nums" style={{ color: ACCENT }}>{Math.round(progress)}%</span>
            </div>
            <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
              <div className="h-full rounded-full transition-all duration-700"
                style={{ width: `${progress}%`, background: `linear-gradient(90deg, ${ACCENT}, #fb923c)` }} />
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 px-4 py-3 rounded-xl"
            style={{ background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.2)" }}>
            <span className="material-symbols-outlined text-[15px] mt-0.5 shrink-0 text-red-400">error</span>
            <p className="text-[13px]" style={{ color: "#fca5a5" }}>{error}</p>
          </div>
        )}
      </div>

      {/* ── Results ──────────────────────────────────────────────────── */}
      {result && (
        <>
          {/* Score + recs + actions */}
          <div className="glass-panel rounded-2xl p-5 flex flex-wrap items-start gap-6"
            style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
            <div className="flex flex-col items-center gap-1.5 shrink-0">
              <div className="relative w-24 h-24">
                <svg width="96" height="96" viewBox="0 0 96 96" aria-label={`Score ${result.seoScore}/100`}>
                  <circle cx="48" cy="48" r="40" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="7" />
                  <circle cx="48" cy="48" r="40" fill="none"
                    stroke={scoreColor} strokeWidth="7"
                    strokeDasharray={2 * Math.PI * 40}
                    strokeDashoffset={2 * Math.PI * 40 * (1 - result.seoScore / 100)}
                    strokeLinecap="round" transform="rotate(-90 48 48)"
                    style={{ transition: "stroke-dashoffset 0.6s ease" }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-[26px] font-black tabular-nums" style={{ color: scoreColor, lineHeight: 1 }}>{result.seoScore}</span>
                  <span className="text-[9px] font-bold" style={{ color: scoreColor, opacity: 0.7 }}>/ 100</span>
                </div>
              </div>
              <span className="text-[11px] font-bold" style={{ color: scoreColor }}>{scoreLabel}</span>
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-bold mb-3" style={{ color: "#e8dff0" }}>Recommendations</p>
              <ul className="flex flex-col gap-2 max-h-44 overflow-y-auto pr-1">
                {result.recommendations.map((rec, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="material-symbols-outlined text-[13px] mt-0.5 shrink-0" style={{ color: ACCENT }}>arrow_forward</span>
                    <span className="text-[12px] leading-relaxed" style={{ color: "#c8b89f" }}>{rec}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex flex-wrap gap-2 w-full pt-4" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
              <button onClick={copyResults}
                className="btn-primary flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm">
                <span className="material-symbols-outlined text-[14px]">{copied ? "check" : "content_copy"}</span>
                {copied ? "Copied!" : "Copy Results"}
              </button>
              {[
                { label: "CSV",  icon: "table_chart", fn: exportCsv,  accent: true },
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

          {/* Stats grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard icon="web"           label="Pages Crawled"    value={result.pagesCrawled}         color="#60a5fa" />
            <StatCard icon="link"          label="Internal Links"   value={result.totalInternalLinks}   color="#a78bfa" />
            <StatCard icon="link_off"      label="Orphan Pages"     value={result.orphanPages}          color={result.orphanPages > 0 ? "#a855f7" : "#22c55e"} />
            <StatCard icon="do_not_disturb_on" label="Dead-end Pages" value={result.deadEndPages}      color={result.deadEndPages > 0 ? "#60a5fa" : "#22c55e"} />
            <StatCard icon="error"         label="Broken Links"     value={result.brokenInternalLinks}  color={result.brokenInternalLinks > 0 ? "#ef4444" : "#22c55e"} />
            <StatCard icon="swap_horiz"    label="Redirected Links" value={result.redirectedLinks}      color={result.redirectedLinks > 0 ? "#f59e0b" : "#22c55e"} />
            <StatCard icon="stacked_line_chart" label="Avg Links/Page" value={result.avgLinksPerPage}   color={ACCENT} />
            <StatCard icon="layers"        label="Max Crawl Depth"  value={result.maxDepth}             color={result.maxDepth > 4 ? "#f59e0b" : "#22c55e"} />
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-3">
            {[
              { color: "#22c55e", label: "OK" },
              { color: "#a855f7", label: "Orphan" },
              { color: "#60a5fa", label: "Dead-end" },
              { color: "#ef4444", label: "Broken" },
              { color: "#f59e0b", label: "Redirect" },
            ].map(({ color, label }) => (
              <span key={label} className="flex items-center gap-1.5 text-[11px] font-semibold" style={{ color: "#988d9f" }}>
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
                {label}
              </span>
            ))}
          </div>

          {/* Tabs: Table / Graph / Anchors */}
          <div className="flex gap-2 flex-wrap">
            {([["table", "table_view", "Page Table"], ["graph", "account_tree", "Link Graph"], ["anchors", "text_fields", "Anchor Text"]] as const).map(([t, icon, label]) => (
              <button key={t} onClick={() => setActiveTab(t)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12px] font-semibold transition-all"
                style={activeTab === t ? tabOn : tabBase as unknown as React.CSSProperties}>
                <span className="material-symbols-outlined text-[14px]">{icon}</span>{label}
              </button>
            ))}
          </div>

          {/* Page Table */}
          {activeTab === "table" && (
            <div className="glass-panel rounded-2xl overflow-hidden"
              style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
              <div className="px-5 py-3 flex flex-wrap gap-2 items-center"
                style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                {([
                  ["all", "All"],
                  ["orphan",   "Orphan"],
                  ["deadEnd",  "Dead-end"],
                  ["broken",   "Broken"],
                  ["redirect", "Redirect"],
                ] as [PageFilter, string][]).map(([f, label]) => (
                  <button key={f} onClick={() => setFilter(f)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-[12px] font-semibold transition-all"
                    style={filter === f ? tabOn : tabOff}>
                    {label}
                  </button>
                ))}
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…" aria-label="Search pages"
                  className="ml-auto rounded-lg px-3 py-1.5 text-[12px] outline-none bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] focus:border-[rgba(249,115,22,0.4)] text-[#e8dff0] placeholder-[#3d3345] w-36" />
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px]">
                  <thead>
                    <tr style={{ background: "rgba(255,255,255,0.02)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                      {([
                        ["status",   "Status",   "w-20"],
                        ["depth",    "Depth",    "w-16"],
                        ["url",      "URL",      ""],
                        ["inLinks",  "Links In", "w-20"],
                        ["outLinks", "Links Out","w-20"],
                      ] as const).map(([key, label, w]) => (
                        <th key={key} onClick={() => handleSort(key as SortKey)}
                          className={`text-left px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider cursor-pointer select-none ${w}`}
                          style={{ color: sortKey === key ? ACCENT : "#988d9f" }}>
                          <span className="flex items-center gap-1">
                            {label}
                            {sortKey === key && <span className="material-symbols-outlined text-[12px]">{sortAsc ? "arrow_upward" : "arrow_downward"}</span>}
                          </span>
                        </th>
                      ))}
                      <th className="px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider" style={{ color: "#988d9f" }}>Flags</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayPages.map((p, i) => {
                      const c = statusColor(p);
                      return (
                        <tr key={i}
                          onClick={() => { setSelectedUrl(p.url === selectedUrl ? null : p.url); setActiveTab("graph"); }}
                          style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", cursor: "pointer" }}
                          className="hover:bg-[rgba(255,255,255,0.02)] transition-colors">
                          <td className="px-3 py-2.5">
                            <span className="text-[11px] font-bold tabular-nums px-2 py-0.5 rounded-md"
                              style={{ background: `${c}18`, color: c }}>{p.status || "T/O"}</span>
                          </td>
                          <td className="px-3 py-2.5">
                            <span className="text-[12px] font-bold tabular-nums" style={{ color: "#988d9f" }}>{p.depth}</span>
                          </td>
                          <td className="px-3 py-2.5 max-w-xs">
                            <p className="text-[11px] font-mono truncate" style={{ color: "#e8dff0", maxWidth: "30ch" }} title={p.url}>
                              {p.url.replace(/^https?:\/\//, "").slice(0, 45)}{p.url.length > 50 ? "…" : ""}
                            </p>
                            {p.title && <p className="text-[10px] truncate mt-0.5" style={{ color: "#3d3345" }}>{p.title}</p>}
                          </td>
                          <td className="px-3 py-2.5">
                            <span className="text-[12px] tabular-nums font-bold" style={{ color: p.inLinks === 0 ? "#a855f7" : "#e8dff0" }}>{p.inLinks}</span>
                          </td>
                          <td className="px-3 py-2.5">
                            <span className="text-[12px] tabular-nums font-bold" style={{ color: p.outLinks === 0 ? "#60a5fa" : "#e8dff0" }}>{p.outLinks}</span>
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="flex gap-1 flex-wrap">
                              {p.isOrphan   && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: "#a855f718", color: "#a855f7" }}>Orphan</span>}
                              {p.isDeadEnd  && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: "#60a5fa18", color: "#60a5fa" }}>Dead-end</span>}
                              {p.isBroken   && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: "#ef444418", color: "#ef4444" }}>Broken</span>}
                              {p.isRedirect && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: "#f59e0b18", color: "#f59e0b" }}>Redirect</span>}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="text-center text-[11px] py-2" style={{ color: "#3d3345" }}>
                Click any row to highlight it in the Link Graph.
              </p>
            </div>
          )}

          {/* Link Graph */}
          {activeTab === "graph" && (
            <div className="glass-panel rounded-2xl p-5 flex flex-col gap-4"
              style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
              <PanelHeader icon="account_tree" title="Link Graph" badge={`${result.pagesCrawled} nodes · ${result.edges.length} edges`} />
              <LinkGraph pages={result.pages} edges={result.edges} selectedUrl={selectedUrl} onSelect={setSelectedUrl} />
              {selectedPage && (
                <div className="rounded-xl p-4 flex flex-col gap-2"
                  style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                  <p className="text-[12px] font-bold font-mono break-all" style={{ color: ACCENT }}>{selectedPage.url}</p>
                  <div className="flex flex-wrap gap-3 text-[11px]" style={{ color: "#988d9f" }}>
                    <span>Depth: <b style={{ color: "#e8dff0" }}>{selectedPage.depth}</b></span>
                    <span>Status: <b style={{ color: "#e8dff0" }}>{selectedPage.status}</b></span>
                    <span>In links: <b style={{ color: "#e8dff0" }}>{selectedPage.inLinks}</b></span>
                    <span>Out links: <b style={{ color: "#e8dff0" }}>{selectedPage.outLinks}</b></span>
                    {selectedPage.isOrphan   && <span style={{ color: "#a855f7" }}>Orphan</span>}
                    {selectedPage.isDeadEnd  && <span style={{ color: "#60a5fa" }}>Dead-end</span>}
                    {selectedPage.isBroken   && <span style={{ color: "#ef4444" }}>Broken</span>}
                    {selectedPage.isRedirect && <span style={{ color: "#f59e0b" }}>Redirect → {selectedPage.redirectTarget}</span>}
                  </div>
                  {selectedPage.inLinkSources.length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: "#988d9f" }}>Linked from</p>
                      {selectedPage.inLinkSources.slice(0, 5).map((s, i) => (
                        <p key={i} className="text-[11px] font-mono truncate" style={{ color: "#60a5fa" }}>{s}</p>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {!selectedPage && (
                <p className="text-center text-[12px]" style={{ color: "#3d3345" }}>Click a node to see page details</p>
              )}
            </div>
          )}

          {/* Anchor Text */}
          {activeTab === "anchors" && (
            <div className="glass-panel rounded-2xl overflow-hidden"
              style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
              <div className="px-5 py-4">
                <PanelHeader icon="text_fields" title="Anchor Text Distribution" badge={`${result.uniqueAnchors} unique`} />
              </div>
              {result.duplicateAnchors.length > 0 && (
                <div className="mx-5 mb-4 flex items-start gap-2 px-4 py-3 rounded-xl"
                  style={{ background: "rgba(249,115,22,0.06)", border: "1px solid rgba(249,115,22,0.2)" }}>
                  <span className="material-symbols-outlined text-[14px] mt-0.5 shrink-0" style={{ color: ACCENT }}>warning</span>
                  <p className="text-[12px]" style={{ color: "#c8b89f" }}>
                    Over-used anchors: <strong style={{ color: ACCENT }}>{result.duplicateAnchors.slice(0, 5).map(a => `"${a}"`).join(", ")}</strong>
                  </p>
                </div>
              )}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr style={{ background: "rgba(255,255,255,0.02)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                      <th className="text-left px-5 py-2.5 text-[11px] font-bold uppercase tracking-wider" style={{ color: "#988d9f" }}>Anchor Text</th>
                      <th className="text-right px-5 py-2.5 text-[11px] font-bold uppercase tracking-wider" style={{ color: "#988d9f" }}>Uses</th>
                      <th className="px-5 py-2.5" style={{ color: "#988d9f" }} />
                    </tr>
                  </thead>
                  <tbody>
                    {anchorData.map(([anchor, count], i) => {
                      const maxCount = anchorData[0]?.[1] ?? 1;
                      const pct = (count / maxCount) * 100;
                      const isDup = result.duplicateAnchors.includes(anchor);
                      return (
                        <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                          <td className="px-5 py-2.5">
                            <span className="text-[12px]" style={{ color: isDup ? ACCENT : "#e8dff0" }}>{anchor}</span>
                          </td>
                          <td className="px-5 py-2.5 text-right">
                            <span className="text-[12px] font-bold tabular-nums" style={{ color: isDup ? ACCENT : "#988d9f" }}>{count}</span>
                          </td>
                          <td className="px-5 py-2.5 w-32">
                            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: isDup ? ACCENT : "#60a5fa" }} />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <p className="text-center text-[11px]" style={{ color: "#3d3345" }}>
            Analyzed {new Date(result.analyzedAt).toLocaleString()} — {result.seedUrl}
          </p>
        </>
      )}

      {/* ── Empty state ───────────────────────────────────────────── */}
      {!result && !loading && (
        <div className="glass-panel rounded-2xl p-8 flex flex-col items-center gap-4 text-center"
          style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
          <span className="material-symbols-outlined text-[48px]" style={{ color: "#3d3345" }}>account_tree</span>
          <p className="text-[14px] font-semibold" style={{ color: "#988d9f" }}>Enter a URL to analyze your internal link structure</p>
          <p className="text-[12px] max-w-md" style={{ color: "#3d3345" }}>
            Crawls your pages server-side, maps every internal link, detects orphan pages, dead-ends and broken links, and visualizes the full link graph.
          </p>
          <div className="flex flex-wrap justify-center gap-2 mt-1">
            {["Orphan Pages", "Crawl Depth", "Link Graph", "Anchor Text", "Dead-ends", "SEO Score"].map(f => (
              <span key={f} className="text-[11px] font-semibold px-3 py-1 rounded-full"
                style={{ background: "rgba(249,115,22,0.07)", color: "#988d9f", border: "1px solid rgba(249,115,22,0.15)" }}>{f}</span>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}

// Keep a ref outside to avoid re-renders needing tabBase
const tabBase = { background: "rgba(255,255,255,0.03)", color: "#988d9f", border: "1px solid rgba(255,255,255,0.07)" };
