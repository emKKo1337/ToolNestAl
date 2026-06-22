"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import type { ExternalLinkResult, ExternalLink } from "@/app/api/check-external-links/route";

// ── Constants ─────────────────────────────────────────────────────────────────
const ACCENT = "#f97316";

function statusColor(link: ExternalLink): string {
  if (link.isBroken)   return "#ef4444";
  if (link.isRedirect) return "#f59e0b";
  return "#22c55e";
}

function statusLabel(link: ExternalLink): string {
  if (link.isBroken)   return "Broken";
  if (link.isRedirect) return "Redirect";
  return "OK";
}

// ── Sub-components (defined outside main to prevent remounting) ───────────────
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

type SortKey = "status" | "responseTime" | "destinationUrl" | "anchorText" | "redirectCount" | "sourceUrl";
type LinkFilter = "all" | "broken" | "redirect" | "ok" | "nofollow" | "http" | "missingNoOpener";

const TAB_OFF = { background: "rgba(255,255,255,0.03)", color: "#988d9f", border: "1px solid rgba(255,255,255,0.07)" } as React.CSSProperties;
const TAB_ON  = { background: "rgba(249,115,22,0.12)", color: ACCENT, border: "1px solid rgba(249,115,22,0.3)" } as React.CSSProperties;

// ── Domain chart ──────────────────────────────────────────────────────────────
function DomainChart({ links }: { links: ExternalLink[] }) {
  const data = useMemo(() => {
    const map: Record<string, number> = {};
    for (const l of links) {
      try { const h = new URL(l.destinationUrl).hostname; map[h] = (map[h] ?? 0) + 1; } catch { /* noop */ }
    }
    return Object.entries(map).sort(([, a], [, b]) => b - a).slice(0, 12);
  }, [links]);

  if (data.length === 0) return null;
  const max = data[0]?.[1] ?? 1;

  return (
    <div className="flex flex-col gap-2 max-h-56 overflow-y-auto pr-1">
      {data.map(([domain, count]) => (
        <div key={domain} className="flex items-center gap-2">
          <span className="text-[11px] font-mono w-44 truncate shrink-0" style={{ color: "#c8b89f" }}>{domain}</span>
          <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
            <div className="h-full rounded-full" style={{ width: `${(count / max) * 100}%`, background: ACCENT }} />
          </div>
          <span className="text-[11px] font-bold tabular-nums w-5 text-right" style={{ color: "#988d9f" }}>{count}</span>
        </div>
      ))}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function ExternalLinkCheckerTool() {
  const [url,           setUrl]           = useState("");
  const [maxPages,      setMaxPages]      = useState(10);
  const [followRedir,   setFollowRedir]   = useState(true);
  const [checkStatus,   setCheckStatus]   = useState(true);
  const [ignoreNoFol,   setIgnoreNoFol]   = useState(false);
  const [userAgent,     setUserAgent]     = useState("bot");
  const [loading,       setLoading]       = useState(false);
  const [progress,      setProgress]      = useState(0);
  const [error,         setError]         = useState("");
  const [result,        setResult]        = useState<ExternalLinkResult | null>(null);
  const [copied,        setCopied]        = useState(false);
  const [sortKey,       setSortKey]       = useState<SortKey>("status");
  const [sortAsc,       setSortAsc]       = useState(true);
  const [filter,        setFilter]        = useState<LinkFilter>("all");
  const [search,        setSearch]        = useState("");
  const [activeTab,     setActiveTab]     = useState<"table" | "domains" | "issues">("table");
  const [expandedIdx,   setExpandedIdx]   = useState<number | null>(null);
  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (loading) {
      setProgress(5);
      let p = 5;
      progressRef.current = setInterval(() => {
        p = Math.min(p + (100 - p) * 0.04, 88);
        setProgress(p);
      }, 1200);
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

  const displayLinks = useMemo(() => {
    if (!result) return [];
    let links = [...result.links];
    if (filter === "broken")          links = links.filter(l => l.isBroken);
    if (filter === "redirect")        links = links.filter(l => l.isRedirect);
    if (filter === "ok")              links = links.filter(l => !l.isBroken && !l.isRedirect);
    if (filter === "nofollow")        links = links.filter(l => l.isNoFollow);
    if (filter === "http")            links = links.filter(l => !l.isHttps);
    if (filter === "missingNoOpener") links = links.filter(l => l.isMissingNoOpener);
    if (search) {
      const q = search.toLowerCase();
      links = links.filter(l =>
        l.destinationUrl.toLowerCase().includes(q) ||
        l.anchorText.toLowerCase().includes(q) ||
        l.sourceUrl.toLowerCase().includes(q)
      );
    }
    links.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "status")        cmp = a.status - b.status;
      if (sortKey === "responseTime")  cmp = a.responseTime - b.responseTime;
      if (sortKey === "redirectCount") cmp = a.redirectCount - b.redirectCount;
      if (sortKey === "destinationUrl") cmp = a.destinationUrl.localeCompare(b.destinationUrl);
      if (sortKey === "anchorText")    cmp = a.anchorText.localeCompare(b.anchorText);
      if (sortKey === "sourceUrl")     cmp = a.sourceUrl.localeCompare(b.sourceUrl);
      return sortAsc ? cmp : -cmp;
    });
    return links;
  }, [result, filter, search, sortKey, sortAsc]);

  // Issues list
  const issues = useMemo(() => {
    if (!result) return [];
    const list: { icon: string; color: string; text: string; links: ExternalLink[] }[] = [];
    const broken = result.links.filter(l => l.isBroken);
    if (broken.length > 0) list.push({ icon: "link_off", color: "#ef4444", text: `${broken.length} broken external link${broken.length > 1 ? "s" : ""}`, links: broken });
    const redir = result.links.filter(l => l.isRedirect);
    if (redir.length > 0) list.push({ icon: "swap_horiz", color: "#f59e0b", text: `${redir.length} redirected link${redir.length > 1 ? "s" : ""}`, links: redir });
    const http = result.links.filter(l => !l.isHttps);
    if (http.length > 0) list.push({ icon: "lock_open", color: "#f59e0b", text: `${http.length} unsafe HTTP link${http.length > 1 ? "s" : ""}`, links: http });
    const noOpener = result.links.filter(l => l.isMissingNoOpener);
    if (noOpener.length > 0) list.push({ icon: "security", color: "#a855f7", text: `${noOpener.length} link${noOpener.length > 1 ? "s" : ""} missing rel="noopener"`, links: noOpener });
    const slow = result.links.filter(l => l.isSlowResponse);
    if (slow.length > 0) list.push({ icon: "timer", color: "#60a5fa", text: `${slow.length} slow response link${slow.length > 1 ? "s" : ""} (>3s)`, links: slow });
    return list;
  }, [result]);

  const handleSort = useCallback((key: SortKey) => {
    setSortKey(prev => {
      if (prev === key) { setSortAsc(a => !a); return prev; }
      setSortAsc(true);
      return key;
    });
  }, []);

  const analyze = useCallback(async () => {
    const trimmed = url.trim();
    if (!trimmed) { setError("Please enter a URL."); return; }
    setError(""); setResult(null); setLoading(true); setFilter("all"); setSearch(""); setExpandedIdx(null);
    try {
      const res = await fetch("/api/check-external-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: trimmed.startsWith("http") ? trimmed : `https://${trimmed}`,
          maxPages, followRedirects: followRedir, checkStatus, ignoreNoFollow: ignoreNoFol, userAgent,
        }),
      });
      const data = await res.json() as ExternalLinkResult & { error?: string };
      if (data.error) { setError(data.error); return; }
      setResult(data);
      setActiveTab("table");
    } catch {
      setError("Network error — please try again.");
    } finally {
      setLoading(false);
    }
  }, [url, maxPages, followRedir, checkStatus, ignoreNoFol, userAgent]);

  const reset = useCallback(() => {
    setUrl(""); setResult(null); setError(""); setProgress(0);
    setFilter("all"); setSearch(""); setExpandedIdx(null);
  }, []);

  // ── Exports ───────────────────────────────────────────────────────────────
  const exportCsv = useCallback(() => {
    if (!result) return;
    const header = "Source URL,Destination URL,Anchor Text,Status,Response Time (ms),Redirect Count,Final URL,NoFollow,Target Blank,HTTPS,Missing NoOpener";
    const rows = result.links.map(l =>
      [l.sourceUrl, l.destinationUrl, l.anchorText, l.status, l.responseTime,
       l.redirectCount, l.finalUrl, l.isNoFollow, l.isTargetBlank, l.isHttps, l.isMissingNoOpener]
        .map(v => `"${String(v).replace(/"/g, '""')}"`)
        .join(",")
    ).join("\n");
    const blob = new Blob([`${header}\n${rows}`], { type: "text/csv" });
    const u = URL.createObjectURL(blob);
    Object.assign(document.createElement("a"), { href: u, download: "external-links.csv" }).click();
    URL.revokeObjectURL(u);
  }, [result]);

  const exportJson = useCallback(() => {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" });
    const u = URL.createObjectURL(blob);
    Object.assign(document.createElement("a"), { href: u, download: "external-links.json" }).click();
    URL.revokeObjectURL(u);
  }, [result]);

  const exportTxt = useCallback(() => {
    if (!result) return;
    const lines = [
      `External Link Report — ${result.seedUrl}`,
      `Analyzed: ${new Date(result.analyzedAt).toLocaleString()}`,
      `Score: ${result.seoScore}/100 | Pages: ${result.pagesCrawled} | External Links: ${result.externalLinksFound}`,
      `Broken: ${result.brokenLinks} | Redirects: ${result.redirectLinks} | Avg Response: ${result.avgResponseTime}ms`,
      "",
      "=== RECOMMENDATIONS ===",
      ...result.recommendations,
      "",
      "=== EXTERNAL LINKS ===",
      ...result.links.map(l =>
        `[${l.status || "T/O"}] ${l.destinationUrl}\n  Source: ${l.sourceUrl}\n  Anchor: ${l.anchorText}\n  Time: ${l.responseTime}ms | Redirects: ${l.redirectCount}${l.isNoFollow ? " | NOFOLLOW" : ""}${l.isBroken ? " | BROKEN" : ""}${!l.isHttps ? " | HTTP" : ""}`),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const u = URL.createObjectURL(blob);
    Object.assign(document.createElement("a"), { href: u, download: "external-links.txt" }).click();
    URL.revokeObjectURL(u);
  }, [result]);

  const exportPdf = useCallback(() => {
    if (!result) return;
    const rows = result.links.map(l => {
      const c = l.isBroken ? "#dc2626" : l.isRedirect ? "#d97706" : "#16a34a";
      return `<tr>
        <td style="font-size:10px;word-break:break-all;max-width:120px">${l.destinationUrl}</td>
        <td style="font-size:10px;word-break:break-all">${l.sourceUrl.replace(/^https?:\/\/[^/]+/, "")}</td>
        <td style="font-size:10px">${l.anchorText.slice(0, 30)}</td>
        <td style="color:${c};font-weight:700">${l.status || "T/O"}</td>
        <td>${l.responseTime > 0 ? `${l.responseTime}ms` : "—"}</td>
        <td>${l.redirectCount}</td>
        <td style="font-size:10px">${[!l.isHttps && "HTTP", l.isNoFollow && "nofollow", l.isMissingNoOpener && "no-opener"].filter(Boolean).join(", ") || "OK"}</td>
      </tr>`;
    }).join("");
    const html = `<!DOCTYPE html><html><head><title>External Links — ${result.seedUrl}</title>
<style>body{font-family:system-ui,sans-serif;max-width:1100px;margin:2rem auto;color:#111;font-size:12px}
h1{font-size:18px}h2{font-size:13px;margin-top:18px;border-bottom:1px solid #ddd;padding-bottom:3px}
.score{font-size:34px;font-weight:900}.chips{display:flex;flex-wrap:wrap;gap:10px;margin:8px 0}
.chip{background:#f5f5f5;border-radius:6px;padding:4px 10px;font-size:11px}.chip b{display:block;font-size:15px}
table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:3px 5px;border-bottom:1px solid #eee;vertical-align:top}
th{font-weight:700;color:#555;background:#fafafa;font-size:10px}ul li{margin-bottom:4px;font-size:11px}
</style></head><body>
<h1>External Link Report</h1>
<p style="color:#666;word-break:break-all">${result.seedUrl} — ${new Date(result.analyzedAt).toLocaleString()}</p>
<div class="score" style="color:${scoreColor}">${result.seoScore}<span style="font-size:14px;font-weight:400;color:#555"> / 100 — ${scoreLabel}</span></div>
<div class="chips">
<div class="chip"><b>${result.pagesCrawled}</b>Pages</div>
<div class="chip"><b>${result.externalLinksFound}</b>Ext. Links</div>
<div class="chip"><b>${result.uniqueExternalDomains}</b>Domains</div>
<div class="chip"><b style="color:${result.brokenLinks > 0 ? "#dc2626" : "#16a34a"}">${result.brokenLinks}</b>Broken</div>
<div class="chip"><b style="color:${result.redirectLinks > 0 ? "#d97706" : "#16a34a"}">${result.redirectLinks}</b>Redirects</div>
<div class="chip"><b>${result.avgResponseTime}ms</b>Avg Response</div>
</div>
<h2>Recommendations</h2><ul>${result.recommendations.map(r => `<li>${r}</li>`).join("")}</ul>
<h2>External Links (${result.externalLinksFound})</h2>
<table><thead><tr><th>Destination URL</th><th>Source Path</th><th>Anchor Text</th><th>Status</th><th>Response</th><th>Redirects</th><th>Flags</th></tr></thead>
<tbody>${rows}</tbody></table>
</body></html>`;
    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); w.print(); }
  }, [result, scoreColor, scoreLabel]);

  const copyResults = useCallback(async () => {
    if (!result) return;
    const lines = [
      `External Link Report — ${result.seedUrl}`,
      `Score: ${result.seoScore}/100 | External Links: ${result.externalLinksFound} | Broken: ${result.brokenLinks}`,
      ...result.recommendations,
    ];
    try { await navigator.clipboard.writeText(lines.join("\n")); } catch { /* blocked */ }
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  }, [result]);

  const inputCls = "rounded-xl px-3 py-2.5 text-[13px] outline-none transition-all bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] focus:border-[rgba(249,115,22,0.4)] text-[#e8dff0] placeholder-[#3d3345]";

  return (
    <div className="mb-12 flex flex-col gap-6">

      {/* ── Input ─────────────────────────────────────────────────────── */}
      <div className="glass-panel rounded-2xl p-5 flex flex-col gap-4"
        style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
        <PanelHeader icon="open_in_new" title="Check External Links" />

        <div className="flex gap-3 flex-wrap sm:flex-nowrap">
          <input type="url" value={url} onChange={e => setUrl(e.target.value)}
            onKeyDown={e => e.key === "Enter" && analyze()}
            placeholder="https://example.com" aria-label="Website URL"
            className={`${inputCls} flex-1`} />
          <button onClick={analyze} disabled={loading}
            className="btn-primary flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm shrink-0 disabled:opacity-60">
            <span className="material-symbols-outlined text-[15px]">{loading ? "hourglass_top" : "travel_explore"}</span>
            {loading ? "Crawling…" : "Analyze Website"}
          </button>
        </div>

        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "#988d9f" }}>Max Pages</label>
            <select value={maxPages} onChange={e => setMaxPages(Number(e.target.value))} aria-label="Max pages" className={`${inputCls} cursor-pointer`}>
              <option value={10}>10 pages</option>
              <option value={50}>50 pages</option>
              <option value={100}>100 pages</option>
              <option value={500}>500 pages</option>
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
          <div className="flex flex-wrap gap-x-5 gap-y-2 mt-1">
            {[
              { id: "followRedir",  state: followRedir,  set: setFollowRedir,  label: "Follow Redirects" },
              { id: "checkStatus",  state: checkStatus,  set: setCheckStatus,  label: "Check HTTP Status" },
              { id: "ignoreNoFol",  state: ignoreNoFol,  set: setIgnoreNoFol,  label: "Ignore NoFollow" },
            ].map(({ id, state, set, label }) => (
              <div key={id} className="flex items-center gap-2">
                <input type="checkbox" id={id} checked={state} onChange={e => set(e.target.checked)}
                  className="w-4 h-4 accent-orange-500 cursor-pointer" />
                <label htmlFor={id} className="text-[12px] font-semibold cursor-pointer" style={{ color: "#c8b89f" }}>{label}</label>
              </div>
            ))}
          </div>
        </div>

        {(loading || progress > 0) && (
          <div className="flex flex-col gap-2">
            <div className="flex justify-between">
              <p className="text-[12px]" style={{ color: ACCENT }}>
                {loading ? "Crawling pages and checking external links…" : "Analysis complete"}
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

      {/* ── Results ───────────────────────────────────────────────────── */}
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
                { label: "CSV",  icon: "table_chart", fn: exportCsv },
                { label: "JSON", icon: "data_object", fn: exportJson },
                { label: "TXT",  icon: "description", fn: exportTxt },
                { label: "PDF",  icon: "print",       fn: exportPdf },
              ].map(({ label, icon, fn }) => (
                <button key={label} onClick={fn}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all"
                  style={{ background: "rgba(255,255,255,0.04)", color: "#c8c0d0", border: "1px solid rgba(255,255,255,0.08)" }}>
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
            <StatCard icon="web"           label="Pages Crawled"       value={result.pagesCrawled}          color="#60a5fa" />
            <StatCard icon="open_in_new"   label="External Links"      value={result.externalLinksFound}    color="#a78bfa" />
            <StatCard icon="public"        label="Unique Domains"       value={result.uniqueExternalDomains} color={ACCENT} />
            <StatCard icon="link_off"      label="Broken Links"         value={result.brokenLinks}           color={result.brokenLinks > 0 ? "#ef4444" : "#22c55e"} />
            <StatCard icon="swap_horiz"    label="Redirected Links"     value={result.redirectLinks}         color={result.redirectLinks > 0 ? "#f59e0b" : "#22c55e"} />
            <StatCard icon="timer"         label="Avg Response Time"    value={result.avgResponseTime > 0 ? `${result.avgResponseTime}ms` : "—"} color={result.avgResponseTime > 3000 ? "#f59e0b" : "#22c55e"} />
            <StatCard icon="do_not_disturb_on" label="NoFollow Links"  value={result.nofollowLinks}         color="#988d9f" />
            <StatCard icon="lock_open"     label="Unsafe HTTP Links"    value={result.unsafeHttpLinks}       color={result.unsafeHttpLinks > 0 ? "#f59e0b" : "#22c55e"} />
          </div>

          {/* Tabs */}
          <div className="flex gap-2 flex-wrap">
            {([["table", "table_view", "Links Table"], ["domains", "bar_chart", "By Domain"], ["issues", "warning", "Issues"]] as const).map(([t, icon, label]) => (
              <button key={t} onClick={() => setActiveTab(t)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12px] font-semibold transition-all"
                style={activeTab === t ? TAB_ON : TAB_OFF}>
                <span className="material-symbols-outlined text-[14px]">{icon}</span>{label}
                {t === "issues" && issues.length > 0 && (
                  <span className="ml-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                    style={{ background: "rgba(239,68,68,0.15)", color: "#ef4444" }}>{issues.length}</span>
                )}
              </button>
            ))}
          </div>

          {/* Links Table */}
          {activeTab === "table" && (
            <div className="glass-panel rounded-2xl overflow-hidden"
              style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
              <div className="px-5 py-3 flex flex-wrap gap-2 items-center"
                style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                {([
                  ["all",              "All"],
                  ["broken",           "Broken"],
                  ["redirect",         "Redirect"],
                  ["ok",               "OK"],
                  ["nofollow",         "NoFollow"],
                  ["http",             "HTTP"],
                  ["missingNoOpener",  "No-Opener"],
                ] as [LinkFilter, string][]).map(([f, label]) => (
                  <button key={f} onClick={() => setFilter(f)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-[12px] font-semibold transition-all"
                    style={filter === f ? TAB_ON : TAB_OFF}>
                    {label}
                  </button>
                ))}
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search…" aria-label="Search links"
                  className="ml-auto rounded-lg px-3 py-1.5 text-[12px] outline-none bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] focus:border-[rgba(249,115,22,0.4)] text-[#e8dff0] placeholder-[#3d3345] w-36" />
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px]">
                  <thead>
                    <tr style={{ background: "rgba(255,255,255,0.02)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                      {([
                        ["status",        "Status",    "w-20"],
                        ["destinationUrl","Destination",""],
                        ["anchorText",    "Anchor",    "w-28"],
                        ["sourceUrl",     "Source",    "w-32"],
                        ["responseTime",  "Time",      "w-20"],
                        ["redirectCount", "Redirects", "w-20"],
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
                      <th className="px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider text-left" style={{ color: "#988d9f" }}>Rel</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayLinks.map((link, i) => {
                      const c  = statusColor(link);
                      const isOpen = expandedIdx === i;
                      return (
                        <>
                          <tr key={i}
                            onClick={() => setExpandedIdx(isOpen ? null : i)}
                            style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", cursor: "pointer" }}
                            className="hover:bg-[rgba(255,255,255,0.02)] transition-colors">
                            <td className="px-3 py-2.5">
                              <span className="text-[11px] font-bold px-2 py-0.5 rounded-md"
                                style={{ background: `${c}18`, color: c }}>{link.status || "T/O"}</span>
                            </td>
                            <td className="px-3 py-2.5 max-w-xs">
                              <p className="text-[11px] font-mono truncate" style={{ color: "#e8dff0", maxWidth: "28ch" }} title={link.destinationUrl}>
                                {link.destinationUrl.replace(/^https?:\/\//, "").slice(0, 42)}{link.destinationUrl.length > 48 ? "…" : ""}
                              </p>
                              <span className="text-[10px] font-bold" style={{ color: link.isHttps ? "#22c55e" : "#f59e0b" }}>{link.isHttps ? "HTTPS" : "HTTP"}</span>
                            </td>
                            <td className="px-3 py-2.5">
                              <span className="text-[11px] truncate block" style={{ color: "#988d9f", maxWidth: "12ch" }}>{link.anchorText || "—"}</span>
                            </td>
                            <td className="px-3 py-2.5">
                              <span className="text-[11px] font-mono truncate block" style={{ color: "#60a5fa", maxWidth: "14ch" }} title={link.sourceUrl}>
                                {link.sourceUrl.replace(/^https?:\/\/[^/]+/, "") || "/"}
                              </span>
                            </td>
                            <td className="px-3 py-2.5">
                              <span className="text-[12px] tabular-nums font-bold"
                                style={{ color: link.responseTime > 3000 ? "#f59e0b" : "#988d9f" }}>
                                {link.responseTime > 0 ? `${link.responseTime}ms` : "—"}
                              </span>
                            </td>
                            <td className="px-3 py-2.5">
                              <span className="text-[12px] tabular-nums font-bold"
                                style={{ color: link.redirectCount > 1 ? "#f59e0b" : "#988d9f" }}>
                                {link.redirectCount}
                              </span>
                            </td>
                            <td className="px-3 py-2.5">
                              <div className="flex gap-1 flex-wrap">
                                {link.isNoFollow   && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: "#988d9f18", color: "#988d9f" }}>nofollow</span>}
                                {link.isTargetBlank && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: "#60a5fa18", color: "#60a5fa" }}>_blank</span>}
                                {link.isMissingNoOpener && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: "#a855f718", color: "#a855f7" }}>no-opener!</span>}
                              </div>
                            </td>
                          </tr>
                          {isOpen && (
                            <tr key={`${i}-detail`} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                              <td colSpan={7} className="px-5 py-3">
                                <div className="flex flex-col gap-2 text-[12px]">
                                  <div className="flex flex-wrap gap-4">
                                    <span style={{ color: "#988d9f" }}>Final URL: <span className="font-mono" style={{ color: "#e8dff0" }}>{link.finalUrl}</span></span>
                                    <span style={{ color: "#988d9f" }}>Status: <b style={{ color: c }}>{link.status} {link.statusText}</b></span>
                                    {link.relAttributes.length > 0 && (
                                      <span style={{ color: "#988d9f" }}>Rel: <b style={{ color: ACCENT }}>{link.relAttributes.join(" ")}</b></span>
                                    )}
                                  </div>
                                  {link.redirectChain.length > 1 && (
                                    <div>
                                      <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: "#988d9f" }}>Redirect Chain</p>
                                      <div className="flex flex-wrap gap-1 items-center">
                                        {link.redirectChain.map((hop, hi) => (
                                          <span key={hi} className="flex items-center gap-1">
                                            <span className="text-[10px] font-mono px-2 py-0.5 rounded" style={{ background: "rgba(255,255,255,0.04)", color: "#c8b89f", maxWidth: "20ch", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "inline-block" }}>{hop.url.replace(/^https?:\/\//, "")}</span>
                                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: `${hop.status >= 300 && hop.status < 400 ? "#f59e0b" : "#22c55e"}18`, color: hop.status >= 300 && hop.status < 400 ? "#f59e0b" : "#22c55e" }}>{hop.status}</span>
                                            {hi < link.redirectChain.length - 1 && <span style={{ color: "#3d3345" }}>→</span>}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="text-center text-[11px] py-2" style={{ color: "#3d3345" }}>
                {displayLinks.length} link{displayLinks.length !== 1 ? "s" : ""} shown — click any row to expand details
              </p>
            </div>
          )}

          {/* Domain Chart */}
          {activeTab === "domains" && (
            <div className="glass-panel rounded-2xl p-5 flex flex-col gap-4"
              style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
              <PanelHeader icon="bar_chart" title="External Links by Domain" badge={`${result.uniqueExternalDomains} unique domains`} />
              <DomainChart links={result.links} />
            </div>
          )}

          {/* Issues */}
          {activeTab === "issues" && (
            <div className="glass-panel rounded-2xl p-5 flex flex-col gap-4"
              style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
              <PanelHeader icon="warning" title="Detected Issues" badge={`${issues.length} categories`} />
              {issues.length === 0 ? (
                <p className="text-[13px] text-center py-4" style={{ color: "#988d9f" }}>No issues detected — external link profile is healthy.</p>
              ) : (
                issues.map((issue, i) => (
                  <div key={i} className="flex flex-col gap-3 p-4 rounded-xl"
                    style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[16px]" style={{ color: issue.color }}>{issue.icon}</span>
                      <p className="text-[13px] font-bold" style={{ color: "#e8dff0" }}>{issue.text}</p>
                    </div>
                    <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto">
                      {issue.links.slice(0, 10).map((l, j) => (
                        <div key={j} className="flex items-center gap-2">
                          <span className="text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded"
                            style={{ background: `${statusColor(l)}18`, color: statusColor(l), minWidth: "2.5rem", textAlign: "center" }}>
                            {l.status || "T/O"}
                          </span>
                          <span className="text-[11px] font-mono truncate flex-1" style={{ color: "#c8b89f" }}>{l.destinationUrl.replace(/^https?:\/\//, "")}</span>
                          <span className="text-[10px] truncate shrink-0" style={{ color: "#3d3345", maxWidth: "14ch" }}>{l.sourceUrl.replace(/^https?:\/\/[^/]+/, "") || "/"}</span>
                        </div>
                      ))}
                      {issue.links.length > 10 && (
                        <p className="text-[10px]" style={{ color: "#3d3345" }}>+ {issue.links.length - 10} more — see Links Table for full list</p>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          <p className="text-center text-[11px]" style={{ color: "#3d3345" }}>
            Analyzed {new Date(result.analyzedAt).toLocaleString()} — {result.seedUrl}
          </p>
        </>
      )}

      {/* ── Empty state ────────────────────────────────────────────── */}
      {!result && !loading && (
        <div className="glass-panel rounded-2xl p-8 flex flex-col items-center gap-4 text-center"
          style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
          <span className="material-symbols-outlined text-[48px]" style={{ color: "#3d3345" }}>travel_explore</span>
          <p className="text-[14px] font-semibold" style={{ color: "#988d9f" }}>Enter a URL to audit all external links</p>
          <p className="text-[12px] max-w-md" style={{ color: "#3d3345" }}>
            Crawls your website, checks every outbound link for HTTP status, redirects and security issues, and delivers an overall SEO score with recommendations.
          </p>
          <div className="flex flex-wrap justify-center gap-2 mt-1">
            {["Broken Links", "Redirect Chains", "HTTPS Check", "NoOpener Audit", "Domain Chart", "SEO Score"].map(f => (
              <span key={f} className="text-[11px] font-semibold px-3 py-1 rounded-full"
                style={{ background: "rgba(249,115,22,0.07)", color: "#988d9f", border: "1px solid rgba(249,115,22,0.15)" }}>{f}</span>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
