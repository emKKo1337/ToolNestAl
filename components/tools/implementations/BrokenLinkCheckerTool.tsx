"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import type { CrawlResult, LinkResult, LinkType } from "@/app/api/check-links/route";

// ── Constants ─────────────────────────────────────────────────────────────────
const ACCENT = "#f97316";

const STATUS_COLOR: Record<string, string> = {
  ok:       "#22c55e",
  redirect: "#f59e0b",
  broken:   "#ef4444",
  timeout:  "#a855f7",
};

function statusColor(r: LinkResult): string {
  if (r.status === 0)   return STATUS_COLOR.timeout;
  if (r.isBroken)       return STATUS_COLOR.broken;
  if (r.isRedirect)     return STATUS_COLOR.redirect;
  return STATUS_COLOR.ok;
}
function statusBg(r: LinkResult): string {
  const c = statusColor(r);
  return `${c}18`;
}

const LINK_TYPE_ICON: Record<LinkType, string> = {
  internal: "link",
  external: "open_in_new",
  image:    "image",
  css:      "palette",
  script:   "code",
};

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

function StatusBadge({ result }: { result: LinkResult }) {
  const c = statusColor(result);
  const label = result.status === 0 ? "Timeout" : String(result.status);
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold tabular-nums"
      style={{ background: statusBg(result), color: c }}>
      {label}
    </span>
  );
}

type SortKey = "status" | "responseTime" | "url" | "sourcePage" | "linkType";
type FilterMode = "all" | "broken" | "redirect" | "ok";

// ── Main ───────────────────────────────────────────────────────────────────────
export default function BrokenLinkCheckerTool() {
  const [url,            setUrl]            = useState("");
  const [maxPages,       setMaxPages]       = useState<number>(1);
  const [includeExt,     setIncludeExt]     = useState(true);
  const [userAgent,      setUserAgent]      = useState("bot");
  const [loading,        setLoading]        = useState(false);
  const [progress,       setProgress]       = useState(0);
  const [error,          setError]          = useState("");
  const [result,         setResult]         = useState<CrawlResult | null>(null);
  const [copied,         setCopied]         = useState(false);
  const [sortKey,        setSortKey]        = useState<SortKey>("status");
  const [sortAsc,        setSortAsc]        = useState(true);
  const [filter,         setFilter]         = useState<FilterMode>("all");
  const [linkTypeFilter, setLinkTypeFilter] = useState<LinkType | "all">("all");
  const [search,         setSearch]         = useState("");
  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fake progress bar during long scan
  useEffect(() => {
    if (loading) {
      setProgress(5);
      let p = 5;
      progressRef.current = setInterval(() => {
        p = Math.min(p + (100 - p) * 0.06, 92);
        setProgress(p);
      }, 800);
    } else {
      if (progressRef.current) clearInterval(progressRef.current);
      setProgress(result ? 100 : 0);
    }
    return () => { if (progressRef.current) clearInterval(progressRef.current); };
  }, [loading, result]);

  const scoreColor = useMemo(() => {
    const s = result?.seoScore ?? 0;
    return s >= 71 ? "#22c55e" : s >= 41 ? "#f59e0b" : "#ef4444";
  }, [result]);

  const scoreLabel = useMemo(() => {
    const s = result?.seoScore ?? 0;
    return s >= 71 ? "Healthy" : s >= 41 ? "Needs work" : "Poor";
  }, [result]);

  // Filtered + sorted links
  const displayLinks = useMemo(() => {
    if (!result) return [];
    let links = [...result.links];
    if (filter === "broken")   links = links.filter(l => l.isBroken);
    if (filter === "redirect") links = links.filter(l => l.isRedirect);
    if (filter === "ok")       links = links.filter(l => l.isOk);
    if (linkTypeFilter !== "all") links = links.filter(l => l.linkType === linkTypeFilter);
    if (search) {
      const q = search.toLowerCase();
      links = links.filter(l => l.url.toLowerCase().includes(q) || l.sourcePage.toLowerCase().includes(q) || l.anchorText.toLowerCase().includes(q));
    }
    links.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "status")       cmp = a.status - b.status;
      if (sortKey === "responseTime") cmp = a.responseTime - b.responseTime;
      if (sortKey === "url")          cmp = a.url.localeCompare(b.url);
      if (sortKey === "sourcePage")   cmp = a.sourcePage.localeCompare(b.sourcePage);
      if (sortKey === "linkType")     cmp = a.linkType.localeCompare(b.linkType);
      return sortAsc ? cmp : -cmp;
    });
    return links;
  }, [result, filter, linkTypeFilter, search, sortKey, sortAsc]);

  const handleSort = useCallback((key: SortKey) => {
    setSortKey(prev => { if (prev === key) { setSortAsc(a => !a); return prev; } setSortAsc(true); return key; });
  }, []);

  const scan = useCallback(async () => {
    const trimmed = url.trim();
    if (!trimmed) { setError("Please enter a URL."); return; }
    setError(""); setResult(null); setLoading(true); setSearch(""); setFilter("all"); setLinkTypeFilter("all");
    try {
      const res = await fetch("/api/check-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmed.startsWith("http") ? trimmed : `https://${trimmed}`, maxPages, includeExternal: includeExt, userAgent }),
      });
      const data = await res.json() as CrawlResult & { error?: string };
      if (data.error) { setError(data.error); return; }
      setResult(data);
    } catch {
      setError("Network error — please try again.");
    } finally {
      setLoading(false);
    }
  }, [url, maxPages, includeExt, userAgent]);

  const reset = useCallback(() => {
    setUrl(""); setResult(null); setError(""); setProgress(0); setSearch(""); setFilter("all"); setLinkTypeFilter("all");
  }, []);

  // ── Exports ───────────────────────────────────────────────────────────────
  const exportCsv = useCallback(() => {
    if (!result) return;
    const header = "URL,Source Page,Anchor Text,Link Type,Status,Status Text,Redirect To,Response Time (ms)";
    const rows = result.links.map(l =>
      [l.url, l.sourcePage, l.anchorText, l.linkType, l.status, l.statusText, l.redirectUrl ?? "", l.responseTime]
        .map(v => `"${String(v).replace(/"/g, '""')}"`)
        .join(",")
    ).join("\n");
    const blob = new Blob([`${header}\n${rows}`], { type: "text/csv" });
    const u = URL.createObjectURL(blob);
    Object.assign(document.createElement("a"), { href: u, download: "broken-links.csv" }).click();
    URL.revokeObjectURL(u);
  }, [result]);

  const exportJson = useCallback(() => {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" });
    const u = URL.createObjectURL(blob);
    Object.assign(document.createElement("a"), { href: u, download: "broken-links.json" }).click();
    URL.revokeObjectURL(u);
  }, [result]);

  const exportTxt = useCallback(() => {
    if (!result) return;
    const lines = [
      `Broken Link Check — ${result.seedUrl}`,
      `Scanned: ${new Date(result.crawledAt).toLocaleString()}`,
      `Score: ${result.seoScore}/100 | Pages: ${result.pagesCrawled} | Links: ${result.totalLinksChecked} | Broken: ${result.brokenLinks} | Redirects: ${result.redirects}`,
      "",
      "=== BROKEN LINKS ===",
      ...result.links.filter(l => l.isBroken).map(l =>
        `[${l.status || "TIMEOUT"}] ${l.url}\n  Source: ${l.sourcePage}\n  Anchor: ${l.anchorText}\n  Type: ${l.linkType}\n  Time: ${l.responseTime}ms`),
      "",
      "=== REDIRECTS ===",
      ...result.links.filter(l => l.isRedirect).map(l =>
        `[${l.status}] ${l.url} → ${l.redirectUrl ?? "?"}\n  Source: ${l.sourcePage}`),
      "",
      "=== RECOMMENDATIONS ===",
      ...result.recommendations,
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const u = URL.createObjectURL(blob);
    Object.assign(document.createElement("a"), { href: u, download: "broken-links.txt" }).click();
    URL.revokeObjectURL(u);
  }, [result]);

  const exportPdf = useCallback(() => {
    if (!result) return;
    const brokenRows = result.links.filter(l => l.isBroken).map(l =>
      `<tr><td style="color:#ef4444;font-weight:700">${l.status || "T/O"}</td><td style="word-break:break-all;font-size:11px">${l.url}</td><td style="font-size:11px;word-break:break-all">${l.sourcePage}</td><td>${l.anchorText}</td><td>${l.linkType}</td><td>${l.responseTime}ms</td></tr>`
    ).join("");
    const redRows = result.links.filter(l => l.isRedirect).map(l =>
      `<tr><td style="color:#f59e0b;font-weight:700">${l.status}</td><td style="word-break:break-all;font-size:11px">${l.url}</td><td style="font-size:11px;word-break:break-all">${l.redirectUrl ?? "—"}</td><td style="font-size:11px;word-break:break-all">${l.sourcePage}</td></tr>`
    ).join("");
    const recHtml = result.recommendations.map(r => `<li>${r}</li>`).join("");
    const html = `<!DOCTYPE html><html><head><title>Broken Links — ${result.seedUrl}</title>
<style>body{font-family:system-ui,sans-serif;max-width:950px;margin:2rem auto;color:#111;font-size:13px}
h1{font-size:18px}h2{font-size:14px;margin-top:20px;border-bottom:1px solid #ddd;padding-bottom:4px}
.score{font-size:34px;font-weight:900;color:${scoreColor}}
.chips{display:flex;gap:12px;flex-wrap:wrap;margin:8px 0}
.chip{background:#f5f5f5;border-radius:6px;padding:5px 10px;font-size:12px}
.chip b{display:block;font-size:18px;margin-bottom:1px}
table{width:100%;border-collapse:collapse;margin-top:8px}
th,td{text-align:left;padding:4px 6px;border-bottom:1px solid #eee;font-size:11px;vertical-align:top}
th{font-weight:700;color:#555;background:#fafafa}
</style></head><body>
<h1>Broken Link Checker Report</h1>
<p style="color:#666;word-break:break-all">${result.seedUrl} — ${new Date(result.crawledAt).toLocaleString()}</p>
<div class="score">${result.seoScore}<span style="font-size:15px;font-weight:400;color:#555"> / 100 — ${scoreLabel}</span></div>
<div class="chips">
<div class="chip"><b>${result.pagesCrawled}</b>Pages Crawled</div>
<div class="chip"><b>${result.totalLinksChecked}</b>Links Checked</div>
<div class="chip"><b style="color:#ef4444">${result.brokenLinks}</b>Broken</div>
<div class="chip"><b style="color:#f59e0b">${result.redirects}</b>Redirects</div>
<div class="chip"><b>${result.avgResponseTime}ms</b>Avg Response</div>
</div>
${brokenRows ? `<h2>Broken Links (${result.brokenLinks})</h2><table><thead><tr><th>Status</th><th>URL</th><th>Source</th><th>Anchor</th><th>Type</th><th>Time</th></tr></thead><tbody>${brokenRows}</tbody></table>` : "<h2>Broken Links</h2><p style='color:#16a34a'>No broken links found.</p>"}
${redRows ? `<h2>Redirects (${result.redirects})</h2><table><thead><tr><th>Status</th><th>From</th><th>To</th><th>Source</th></tr></thead><tbody>${redRows}</tbody></table>` : ""}
<h2>Recommendations</h2><ul>${recHtml}</ul>
</body></html>`;
    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); w.print(); }
  }, [result, scoreColor, scoreLabel]);

  const copyResults = useCallback(async () => {
    if (!result) return;
    const lines = [
      `Broken Link Check — ${result.seedUrl}`,
      `Score: ${result.seoScore}/100 | Broken: ${result.brokenLinks} | Redirects: ${result.redirects}`,
      "",
      ...result.links.filter(l => l.isBroken).slice(0, 20).map(l => `[${l.status || "T/O"}] ${l.url}`),
    ];
    try { await navigator.clipboard.writeText(lines.join("\n")); } catch { /* blocked */ }
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  }, [result]);

  // ── Styles ────────────────────────────────────────────────────────────────
  const inputCls = "rounded-xl px-3 py-2.5 text-[13px] outline-none transition-all bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] focus:border-[rgba(249,115,22,0.4)] text-[#e8dff0] placeholder-[#3d3345]";
  const selectCls = `${inputCls} cursor-pointer`;
  const tabBase = "flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-semibold transition-all";
  const tabOff = { background: "rgba(255,255,255,0.03)", color: "#988d9f", border: "1px solid rgba(255,255,255,0.07)" };
  const tabOn  = { background: "rgba(249,115,22,0.12)", color: ACCENT, border: "1px solid rgba(249,115,22,0.3)" };

  return (
    <div className="mb-12 flex flex-col gap-6">

      {/* ── Input ─────────────────────────────────────────── */}
      <div className="glass-panel rounded-2xl p-5 flex flex-col gap-4"
        style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
        <PanelHeader icon="link_off" title="Scan Website for Broken Links" />

        <div className="flex gap-3 flex-wrap sm:flex-nowrap">
          <input type="url" value={url} onChange={e => setUrl(e.target.value)}
            onKeyDown={e => e.key === "Enter" && scan()}
            placeholder="https://example.com" aria-label="Website URL to scan"
            className={`${inputCls} flex-1`} />
          <button onClick={scan} disabled={loading}
            className="btn-primary flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm shrink-0 disabled:opacity-60">
            <span className="material-symbols-outlined text-[15px]">{loading ? "hourglass_top" : "search"}</span>
            {loading ? "Scanning…" : "Scan Website"}
          </button>
        </div>

        {/* Options row */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "#988d9f" }}>Max Pages</label>
            <select value={maxPages} onChange={e => setMaxPages(Number(e.target.value))} aria-label="Maximum pages to crawl" className={selectCls}>
              <option value={1}>1 page</option>
              <option value={3}>3 pages</option>
              <option value={5}>5 pages</option>
              <option value={10}>10 pages</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "#988d9f" }}>User Agent</label>
            <select value={userAgent} onChange={e => setUserAgent(e.target.value)} aria-label="User agent" className={selectCls}>
              <option value="bot">ToolNest Bot</option>
              <option value="chrome">Chrome 124</option>
              <option value="firefox">Firefox 125</option>
              <option value="mobile">Mobile (iPhone)</option>
            </select>
          </div>
          <div className="flex items-center gap-2 mt-4">
            <input type="checkbox" id="includeExt" checked={includeExt} onChange={e => setIncludeExt(e.target.checked)}
              className="w-4 h-4 accent-orange-500 cursor-pointer" />
            <label htmlFor="includeExt" className="text-[12px] font-semibold cursor-pointer" style={{ color: "#c8b89f" }}>Include External Links</label>
          </div>
        </div>

        {/* Progress bar */}
        {(loading || progress > 0) && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <p className="text-[12px]" style={{ color: ACCENT }}>
                {loading ? "Crawling pages and checking link statuses…" : "Scan complete"}
              </p>
              <span className="text-[11px] font-bold tabular-nums" style={{ color: ACCENT }}>{Math.round(progress)}%</span>
            </div>
            <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
              <div className="h-full rounded-full transition-all duration-500"
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

      {/* ── Results ───────────────────────────────────────── */}
      {result && (() => {
        return (
          <>
            {/* Score + stats */}
            <div className="glass-panel rounded-2xl p-5 flex flex-wrap items-start gap-6"
              style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
              {/* Gauge */}
              <div className="flex flex-col items-center gap-1.5 shrink-0">
                <div className="relative w-24 h-24">
                  <svg width="96" height="96" viewBox="0 0 96 96" aria-label={`Score ${result.seoScore}/100`}>
                    <circle cx="48" cy="48" r="40" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="7" />
                    <circle cx="48" cy="48" r="40" fill="none"
                      stroke={scoreColor} strokeWidth="7"
                      strokeDasharray={2 * Math.PI * 40}
                      strokeDashoffset={2 * Math.PI * 40 * (1 - result.seoScore / 100)}
                      strokeLinecap="round" transform="rotate(-90 48 48)"
                      style={{ transition: "stroke-dashoffset 0.6s ease, stroke 0.4s ease" }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-[26px] font-black tabular-nums" style={{ color: scoreColor, lineHeight: 1 }}>{result.seoScore}</span>
                    <span className="text-[9px] font-bold" style={{ color: scoreColor, opacity: 0.7 }}>/ 100</span>
                  </div>
                </div>
                <span className="text-[11px] font-bold" style={{ color: scoreColor }}>{scoreLabel}</span>
                <span className="text-[10px]" style={{ color: "#3d3345" }}>SEO Health</span>
              </div>

              {/* Recommendations */}
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-bold mb-3" style={{ color: "#e8dff0" }}>Recommendations</p>
                <ul className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-1">
                  {result.recommendations.map((rec, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="material-symbols-outlined text-[13px] mt-0.5 shrink-0" style={{ color: ACCENT }}>arrow_forward</span>
                      <span className="text-[12px] leading-relaxed" style={{ color: "#c8b89f" }}>{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Action buttons */}
              <div className="flex flex-wrap gap-2 w-full pt-4" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                <button onClick={copyResults}
                  className="btn-primary flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm">
                  <span className="material-symbols-outlined text-[14px]">{copied ? "check" : "content_copy"}</span>
                  {copied ? "Copied!" : "Copy Results"}
                </button>
                <button onClick={exportCsv}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all"
                  style={{ background: "rgba(249,115,22,0.09)", color: ACCENT, border: "1px solid rgba(249,115,22,0.22)" }}>
                  <span className="material-symbols-outlined text-[13px]">table_chart</span>CSV
                </button>
                <button onClick={exportJson}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all"
                  style={{ background: "rgba(255,255,255,0.04)", color: "#c8c0d0", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <span className="material-symbols-outlined text-[13px]">data_object</span>JSON
                </button>
                <button onClick={exportTxt}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all"
                  style={{ background: "rgba(255,255,255,0.04)", color: "#c8c0d0", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <span className="material-symbols-outlined text-[13px]">description</span>TXT
                </button>
                <button onClick={exportPdf}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all"
                  style={{ background: "rgba(255,255,255,0.04)", color: "#c8c0d0", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <span className="material-symbols-outlined text-[13px]">print</span>PDF
                </button>
                <button onClick={reset}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all ml-auto"
                  style={{ background: "rgba(255,255,255,0.03)", color: "#988d9f", border: "1px solid rgba(255,255,255,0.07)" }}>
                  <span className="material-symbols-outlined text-[13px]">restart_alt</span>Reset
                </button>
              </div>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard icon="web"         label="Pages Crawled"      value={result.pagesCrawled}      color="#60a5fa" />
              <StatCard icon="link"        label="Links Checked"      value={result.totalLinksChecked} color="#a78bfa" />
              <StatCard icon="link_off"    label="Broken Links"       value={result.brokenLinks}       color={result.brokenLinks > 0 ? "#ef4444" : "#22c55e"} />
              <StatCard icon="swap_horiz"  label="Redirects"          value={result.redirects}         color={result.redirects > 0 ? "#f59e0b" : "#22c55e"} />
              <StatCard icon="arrow_inward" label="Internal Links"   value={result.internalLinks}     color="#34d399" />
              <StatCard icon="open_in_new"  label="External Links"   value={result.externalLinks}     color="#60a5fa" />
              <StatCard icon="timer"        label="Avg Response"      value={`${result.avgResponseTime}ms`} color={result.avgResponseTime < 600 ? "#22c55e" : result.avgResponseTime < 2000 ? "#f59e0b" : "#ef4444"} />
              <StatCard icon="schedule"     label="Scanned At"        value={new Date(result.crawledAt).toLocaleTimeString()} color="#988d9f" />
            </div>

            {/* Link table */}
            <div className="glass-panel rounded-2xl overflow-hidden"
              style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
              {/* Table header + filters */}
              <div className="px-5 py-4 flex flex-wrap gap-3 items-center"
                style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <PanelHeader icon="table_view" title="Link Results" badge={`${displayLinks.length} shown`} />
              </div>
              <div className="px-5 py-3 flex flex-wrap gap-2 items-center"
                style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                {/* Status filter */}
                {(["all", "broken", "redirect", "ok"] as FilterMode[]).map(f => (
                  <button key={f} onClick={() => setFilter(f)}
                    className={`${tabBase} capitalize`}
                    style={filter === f ? tabOn : tabBase as unknown as React.CSSProperties}>
                    {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
                    {f === "broken" && result.brokenLinks > 0 && (
                      <span className="ml-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                        style={{ background: "#ef444420", color: "#ef4444" }}>{result.brokenLinks}</span>
                    )}
                    {f === "redirect" && result.redirects > 0 && (
                      <span className="ml-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                        style={{ background: "#f59e0b20", color: "#f59e0b" }}>{result.redirects}</span>
                    )}
                  </button>
                ))}
                <div className="ml-auto flex items-center gap-2">
                  <select value={linkTypeFilter} onChange={e => setLinkTypeFilter(e.target.value as LinkType | "all")}
                    aria-label="Filter by link type"
                    className="rounded-lg px-2 py-1.5 text-[12px] outline-none bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] text-[#988d9f]">
                    <option value="all">All types</option>
                    <option value="internal">Internal</option>
                    <option value="external">External</option>
                    <option value="image">Images</option>
                    <option value="css">CSS</option>
                    <option value="script">Script</option>
                  </select>
                  <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…" aria-label="Search links"
                    className="rounded-lg px-3 py-1.5 text-[12px] outline-none bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] focus:border-[rgba(249,115,22,0.4)] text-[#e8dff0] placeholder-[#3d3345] w-36" />
                </div>
              </div>

              {displayLinks.length === 0 ? (
                <div className="flex items-center justify-center gap-2 py-10">
                  <span className="material-symbols-outlined text-[24px]" style={{ color: "#22c55e" }}>check_circle</span>
                  <p className="text-[13px]" style={{ color: "#22c55e" }}>No links match the current filter.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[700px]">
                    <thead>
                      <tr style={{ background: "rgba(255,255,255,0.02)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                        {([
                          ["status",       "Status",      "w-24"],
                          ["linkType",     "Type",        "w-24"],
                          ["url",          "URL",         ""],
                          ["anchorText",   "Anchor",      "w-32"],
                          ["sourcePage",   "Source",      "w-36"],
                          ["responseTime", "Time",        "w-20"],
                        ] as const).map(([key, label, w]) => (
                          <th key={key}
                            className={`text-left px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider cursor-pointer select-none ${w}`}
                            style={{ color: sortKey === key ? ACCENT : "#988d9f" }}
                            onClick={() => handleSort(key as SortKey)}>
                            <span className="flex items-center gap-1">
                              {label}
                              {sortKey === key && (
                                <span className="material-symbols-outlined text-[12px]">{sortAsc ? "arrow_upward" : "arrow_downward"}</span>
                              )}
                            </span>
                          </th>
                        ))}
                        <th className="px-3 py-2.5 w-24 text-left text-[11px] font-bold uppercase tracking-wider" style={{ color: "#988d9f" }}>Redirect To</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayLinks.slice(0, 200).map((link, i) => (
                        <tr key={i}
                          style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
                          className="hover:bg-[rgba(255,255,255,0.015)] transition-colors">
                          <td className="px-3 py-2.5"><StatusBadge result={link} /></td>
                          <td className="px-3 py-2.5">
                            <span className="flex items-center gap-1 text-[11px]" style={{ color: "#988d9f" }}>
                              <span className="material-symbols-outlined text-[13px]">{LINK_TYPE_ICON[link.linkType]}</span>
                              {link.linkType}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 max-w-xs">
                            <a href={link.url} target="_blank" rel="noopener noreferrer"
                              className="text-[11px] font-mono truncate block hover:underline"
                              style={{ color: link.isBroken ? "#ef4444" : "#e8dff0", maxWidth: "28ch" }}
                              title={link.url}>
                              {link.url.replace(/^https?:\/\//, "").slice(0, 45)}{link.url.length > 50 ? "…" : ""}
                            </a>
                          </td>
                          <td className="px-3 py-2.5">
                            <span className="text-[11px] truncate block" style={{ color: "#988d9f", maxWidth: "16ch" }}
                              title={link.anchorText}>{link.anchorText || "—"}</span>
                          </td>
                          <td className="px-3 py-2.5">
                            <span className="text-[11px] font-mono truncate block" style={{ color: "#3d3345", maxWidth: "18ch" }}
                              title={link.sourcePage}>{link.sourcePage.replace(/^https?:\/\/[^/]+/, "") || "/"}</span>
                          </td>
                          <td className="px-3 py-2.5">
                            <span className="text-[11px] tabular-nums"
                              style={{ color: link.responseTime > 3000 ? "#f59e0b" : "#988d9f" }}>
                              {link.status === 0 ? "—" : `${link.responseTime}ms`}
                            </span>
                          </td>
                          <td className="px-3 py-2.5">
                            {link.redirectUrl ? (
                              <a href={link.redirectUrl} target="_blank" rel="noopener noreferrer"
                                className="text-[11px] font-mono truncate block hover:underline"
                                style={{ color: "#60a5fa", maxWidth: "16ch" }} title={link.redirectUrl}>
                                {link.redirectUrl.replace(/^https?:\/\//, "").slice(0, 22)}…
                              </a>
                            ) : <span style={{ color: "#3d3345" }}>—</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {displayLinks.length > 200 && (
                    <p className="text-center text-[12px] py-3" style={{ color: "#3d3345" }}>
                      Showing 200 of {displayLinks.length} links — use Export CSV to download all.
                    </p>
                  )}
                </div>
              )}
            </div>

            <p className="text-center text-[11px]" style={{ color: "#3d3345" }}>
              Scanned {new Date(result.crawledAt).toLocaleString()} — {result.seedUrl}
            </p>
          </>
        );
      })()}

      {/* ── Empty state ───────────────────────────────────── */}
      {!result && !loading && (
        <div className="glass-panel rounded-2xl p-8 flex flex-col items-center gap-4 text-center"
          style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
          <span className="material-symbols-outlined text-[48px]" style={{ color: "#3d3345" }}>link_off</span>
          <p className="text-[14px] font-semibold" style={{ color: "#988d9f" }}>Enter a URL above and click Scan Website</p>
          <p className="text-[12px] max-w-md" style={{ color: "#3d3345" }}>
            Crawls your pages server-side and checks every link — internal, external, images, CSS and JavaScript — for broken status codes, redirects and slow responses.
          </p>
          <div className="flex flex-wrap justify-center gap-2 mt-1">
            {["404 Detection", "Redirects", "Images", "CSS & JS", "Response Times", "SEO Score"].map(f => (
              <span key={f} className="text-[11px] font-semibold px-3 py-1 rounded-full"
                style={{ background: "rgba(249,115,22,0.07)", color: "#988d9f", border: "1px solid rgba(249,115,22,0.15)" }}>{f}</span>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
