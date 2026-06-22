"use client";

import { useState, useMemo, useCallback } from "react";
import type { MetaTagsResult, MetaTag } from "@/app/api/extract-meta-tags/route";

// ── Constants ─────────────────────────────────────────────────────────────────
const ACCENT = "#f97316";

const CATEGORY_ORDER = ["Basic", "Canonical", "Open Graph", "Twitter Cards", "Icons", "Verification", "Alternate", "HTTP Equiv", "Other"];

const CATEGORY_ICONS: Record<string, string> = {
  "Basic": "sell",
  "Canonical": "link",
  "Open Graph": "share",
  "Twitter Cards": "tag",
  "Icons": "favorite",
  "Verification": "verified",
  "Alternate": "language",
  "HTTP Equiv": "http",
  "Other": "more_horiz",
};

// ── Sub-components ─────────────────────────────────────────────────────────────
function PanelHeader({ icon, title, badge }: { icon: string; title: string; badge?: string | number }) {
  return (
    <div className="flex items-center gap-2 pb-3 mb-1" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
      <span className="material-symbols-outlined text-[16px]" style={{ color: ACCENT }}>{icon}</span>
      <p className="text-[13px] font-bold" style={{ color: "#e8dff0" }}>{title}</p>
      {badge !== undefined && (
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

// Syntax-highlighted raw HTML
function HtmlChip({ html }: { html: string }) {
  // Simple tokeniser: attrs, values, tag name, brackets
  const parts: { text: string; color: string }[] = [];
  const tagNameM = html.match(/^<(\/?[\w:-]+)/);
  if (!tagNameM) return <span className="text-[10px] font-mono" style={{ color: "#e8dff0" }}>{html}</span>;

  let rest = html;
  // Opening bracket + tag name
  parts.push({ text: "<", color: "#988d9f" });
  parts.push({ text: tagNameM[1], color: "#60a5fa" });
  rest = rest.slice(tagNameM[0].length);

  // Attribute pattern
  const attrRe = /\s+([\w:-]+)(?:=["']([^"']*)["'])?/g;
  let lastIdx = 0;
  let am: RegExpExecArray | null;
  while ((am = attrRe.exec(rest)) !== null) {
    if (am.index > lastIdx) parts.push({ text: rest.slice(lastIdx, am.index), color: "#988d9f" });
    parts.push({ text: " " + am[1], color: "#a78bfa" });
    if (am[2] !== undefined) {
      parts.push({ text: `="`, color: "#988d9f" });
      parts.push({ text: am[2].slice(0, 60) + (am[2].length > 60 ? "…" : ""), color: "#f97316" });
      parts.push({ text: `"`, color: "#988d9f" });
    }
    lastIdx = am.index + am[0].length;
  }
  parts.push({ text: rest.slice(lastIdx), color: "#988d9f" });

  return (
    <code className="text-[10px] font-mono break-all">
      {parts.map((p, i) => <span key={i} style={{ color: p.color }}>{p.text}</span>)}
    </code>
  );
}

function TagRow({ tag, expanded, onToggle }: { tag: MetaTag; expanded: boolean; onToggle: () => void }) {
  const hasIssue = tag.isEmpty || tag.isDuplicate;
  const issueColor = tag.isEmpty ? "#ef4444" : "#f59e0b";
  const issueLabel = tag.isEmpty ? "Empty" : "Duplicate";

  return (
    <div className="flex flex-col" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
      <button
        onClick={onToggle}
        className="flex items-center gap-3 px-4 py-2.5 text-left w-full hover:bg-[rgba(255,255,255,0.02)] transition-colors"
        aria-expanded={expanded}>
        <span className="material-symbols-outlined text-[14px] shrink-0 transition-transform"
          style={{ color: "#3d3345", transform: expanded ? "rotate(90deg)" : "none" }}>chevron_right</span>
        <span className="text-[12px] font-mono font-semibold shrink-0 w-40 truncate" style={{ color: "#a78bfa" }} title={tag.name}>{tag.name}</span>
        <span className="text-[12px] flex-1 truncate" style={{ color: hasIssue ? issueColor : "#c8b89f" }}>
          {tag.isEmpty ? "(empty)" : tag.value.slice(0, 80) + (tag.value.length > 80 ? "…" : "")}
        </span>
        {hasIssue && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0"
            style={{ background: `${issueColor}18`, color: issueColor }}>{issueLabel}</span>
        )}
      </button>
      {expanded && (
        <div className="px-4 pb-3 flex flex-col gap-2 ml-8">
          <div className="flex flex-wrap gap-4 text-[11px]" style={{ color: "#988d9f" }}>
            <span>Attribute: <b style={{ color: "#e8dff0" }}>{tag.attribute}</b></span>
            {tag.value && <span>Length: <b style={{ color: "#e8dff0" }}>{tag.value.length}</b></span>}
          </div>
          {tag.value && (
            <div className="flex flex-col gap-1">
              <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "#3d3345" }}>Value</p>
              <p className="text-[12px] break-all leading-relaxed" style={{ color: "#e8dff0" }}>{tag.value}</p>
            </div>
          )}
          <div className="flex flex-col gap-1">
            <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "#3d3345" }}>Raw HTML</p>
            <div className="px-3 py-2 rounded-lg overflow-x-auto" style={{ background: "rgba(0,0,0,0.25)" }}>
              <HtmlChip html={tag.rawHtml} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function MetaTagsExtractorTool() {
  const [url,       setUrl]       = useState("");
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState("");
  const [result,    setResult]    = useState<MetaTagsResult | null>(null);
  const [copied,    setCopied]    = useState(false);
  const [expanded,  setExpanded]  = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<string>("all");
  const [search,    setSearch]    = useState("");

  const TAB_OFF = { background: "rgba(255,255,255,0.03)", color: "#988d9f", border: "1px solid rgba(255,255,255,0.07)" } as React.CSSProperties;
  const TAB_ON  = { background: "rgba(249,115,22,0.12)", color: ACCENT, border: "1px solid rgba(249,115,22,0.3)" } as React.CSSProperties;

  // Grouped by category
  const grouped = useMemo(() => {
    if (!result) return new Map<string, MetaTag[]>();
    const map = new Map<string, MetaTag[]>();
    for (const tag of result.tags) {
      const group = map.get(tag.category) ?? [];
      group.push(tag);
      map.set(tag.category, group);
    }
    return map;
  }, [result]);

  const categories = useMemo(() => {
    const cats = Array.from(grouped.keys());
    return CATEGORY_ORDER.filter(c => cats.includes(c)).concat(cats.filter(c => !CATEGORY_ORDER.includes(c)));
  }, [grouped]);

  const displayTags = useMemo(() => {
    if (!result) return [];
    let tags = activeTab === "all" ? result.tags
      : activeTab === "issues" ? result.tags.filter(t => t.isEmpty || t.isDuplicate)
      : result.tags.filter(t => t.category === activeTab);
    if (search) {
      const q = search.toLowerCase();
      tags = tags.filter(t => t.name.toLowerCase().includes(q) || t.value.toLowerCase().includes(q));
    }
    return tags;
  }, [result, activeTab, search]);

  const toggleExpand = useCallback((key: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    if (!result) return;
    setExpanded(new Set(result.tags.map((_, i) => `${i}`)));
  }, [result]);

  const collapseAll = useCallback(() => setExpanded(new Set()), []);

  const extract = useCallback(async () => {
    const trimmed = url.trim();
    if (!trimmed) { setError("Please enter a URL."); return; }
    setError(""); setResult(null); setLoading(true); setExpanded(new Set()); setSearch(""); setActiveTab("all");
    try {
      const res = await fetch(`/api/extract-meta-tags?url=${encodeURIComponent(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`)}`);
      const data = await res.json() as MetaTagsResult & { error?: string };
      if (data.error) { setError(data.error); return; }
      setResult(data);
    } catch {
      setError("Network error — please try again.");
    } finally {
      setLoading(false);
    }
  }, [url]);

  const reset = useCallback(() => {
    setUrl(""); setResult(null); setError(""); setExpanded(new Set()); setSearch("");
  }, []);

  const scoreColor = result
    ? result.seoScore >= 71 ? "#22c55e" : result.seoScore >= 41 ? "#f59e0b" : "#ef4444"
    : "#988d9f";
  const scoreLabel = result
    ? result.seoScore >= 71 ? "Healthy" : result.seoScore >= 41 ? "Needs work" : "Poor"
    : "";

  // ── Exports ───────────────────────────────────────────────────────────────
  const exportHtml = useCallback(() => {
    if (!result) return;
    const lines = result.tags.map(t => t.rawHtml).join("\n");
    const blob = new Blob([lines], { type: "text/html" });
    const u = URL.createObjectURL(blob);
    Object.assign(document.createElement("a"), { href: u, download: "meta-tags.html" }).click();
    URL.revokeObjectURL(u);
  }, [result]);

  const exportJson = useCallback(() => {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" });
    const u = URL.createObjectURL(blob);
    Object.assign(document.createElement("a"), { href: u, download: "meta-tags.json" }).click();
    URL.revokeObjectURL(u);
  }, [result]);

  const exportCsv = useCallback(() => {
    if (!result) return;
    const header = "Category,Name,Value,Attribute,Empty,Duplicate";
    const rows = result.tags.map(t =>
      [t.category, t.name, t.value, t.attribute, t.isEmpty, t.isDuplicate]
        .map(v => `"${String(v).replace(/"/g, '""')}"`)
        .join(",")
    ).join("\n");
    const blob = new Blob([`${header}\n${rows}`], { type: "text/csv" });
    const u = URL.createObjectURL(blob);
    Object.assign(document.createElement("a"), { href: u, download: "meta-tags.csv" }).click();
    URL.revokeObjectURL(u);
  }, [result]);

  const exportTxt = useCallback(() => {
    if (!result) return;
    const lines = [
      `Meta Tags Extractor — ${result.finalUrl}`,
      `Analyzed: ${new Date(result.analyzedAt).toLocaleString()}`,
      `Score: ${result.seoScore}/100 | Total: ${result.totalTags} | Missing: ${result.missingRecommended} | Dupes: ${result.duplicateTags} | Empty: ${result.emptyTags}`,
      "",
      "=== RECOMMENDATIONS ===",
      ...result.recommendations,
      "",
      ...CATEGORY_ORDER.flatMap(cat => {
        const tags = result.tags.filter(t => t.category === cat);
        if (!tags.length) return [];
        return [`\n=== ${cat.toUpperCase()} ===`, ...tags.map(t => `${t.name}: ${t.value || "(empty)"}`)];
      }),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const u = URL.createObjectURL(blob);
    Object.assign(document.createElement("a"), { href: u, download: "meta-tags.txt" }).click();
    URL.revokeObjectURL(u);
  }, [result]);

  const exportPdf = useCallback(() => {
    if (!result) return;
    const rows = result.tags.map(t => {
      const flag = t.isEmpty ? `<span style="color:#dc2626">Empty</span>` : t.isDuplicate ? `<span style="color:#d97706">Duplicate</span>` : `<span style="color:#16a34a">OK</span>`;
      return `<tr><td style="color:#6d28d9;font-size:10px">${t.category}</td><td style="font-family:monospace;font-size:10px">${t.name}</td><td style="font-size:10px;max-width:300px;word-break:break-all">${t.value || "(empty)"}</td><td>${flag}</td></tr>`;
    }).join("");
    const html = `<!DOCTYPE html><html><head><title>Meta Tags — ${result.finalUrl}</title>
<style>body{font-family:system-ui,sans-serif;max-width:1000px;margin:2rem auto;color:#111;font-size:12px}
h1{font-size:18px}h2{font-size:13px;margin-top:18px;border-bottom:1px solid #ddd;padding-bottom:3px}
.score{font-size:34px;font-weight:900}.chips{display:flex;flex-wrap:wrap;gap:10px;margin:8px 0}
.chip{background:#f5f5f5;border-radius:6px;padding:4px 10px;font-size:11px}.chip b{display:block;font-size:15px}
table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:3px 6px;border-bottom:1px solid #eee;vertical-align:top}
th{font-weight:700;color:#555;background:#fafafa;font-size:10px}ul li{margin-bottom:4px;font-size:11px}
</style></head><body>
<h1>Meta Tags Extractor</h1>
<p style="color:#666;word-break:break-all">${result.finalUrl} — ${new Date(result.analyzedAt).toLocaleString()}</p>
<div class="score" style="color:${scoreColor}">${result.seoScore}<span style="font-size:14px;font-weight:400;color:#555"> / 100 — ${scoreLabel}</span></div>
<div class="chips">
<div class="chip"><b>${result.totalTags}</b>Total Tags</div>
<div class="chip"><b style="color:${result.missingRecommended > 0 ? "#dc2626" : "#16a34a"}">${result.missingRecommended}</b>Missing</div>
<div class="chip"><b style="color:${result.duplicateTags > 0 ? "#d97706" : "#16a34a"}">${result.duplicateTags}</b>Duplicates</div>
<div class="chip"><b style="color:${result.emptyTags > 0 ? "#dc2626" : "#16a34a"}">${result.emptyTags}</b>Empty</div>
</div>
<h2>Recommendations</h2><ul>${result.recommendations.map(r => `<li>${r}</li>`).join("")}</ul>
${result.missingTags.length > 0 ? `<h2>Missing Tags</h2><ul>${result.missingTags.map(m => `<li><b>${m.name}</b> — ${m.reason}</li>`).join("")}</ul>` : ""}
<h2>All Meta Tags (${result.totalTags})</h2>
<table><thead><tr><th>Category</th><th>Name</th><th>Value</th><th>Status</th></tr></thead>
<tbody>${rows}</tbody></table>
</body></html>`;
    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); w.print(); }
  }, [result, scoreColor, scoreLabel]);

  const copyResults = useCallback(async () => {
    if (!result) return;
    const lines = [
      `Meta Tags — ${result.finalUrl}`,
      `Score: ${result.seoScore}/100 | Total: ${result.totalTags} tags | Missing: ${result.missingRecommended}`,
      ...result.recommendations,
    ];
    try { await navigator.clipboard.writeText(lines.join("\n")); } catch { /* blocked */ }
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  }, [result]);

  const inputCls = "rounded-xl px-3 py-2.5 text-[13px] outline-none transition-all bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] focus:border-[rgba(249,115,22,0.4)] text-[#e8dff0] placeholder-[#3d3345]";
  const issueCount = result ? result.tags.filter(t => t.isEmpty || t.isDuplicate).length : 0;

  return (
    <div className="mb-12 flex flex-col gap-6">

      {/* ── Input ─────────────────────────────────────────────────── */}
      <div className="glass-panel rounded-2xl p-5 flex flex-col gap-4"
        style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
        <PanelHeader icon="code" title="Extract Meta Tags" />
        <div className="flex gap-3 flex-wrap sm:flex-nowrap">
          <input type="url" value={url} onChange={e => setUrl(e.target.value)}
            onKeyDown={e => e.key === "Enter" && extract()}
            placeholder="https://example.com" aria-label="Website URL"
            className={`${inputCls} flex-1`} />
          <button onClick={extract} disabled={loading}
            className="btn-primary flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm shrink-0 disabled:opacity-60">
            <span className="material-symbols-outlined text-[15px]">{loading ? "hourglass_top" : "code"}</span>
            {loading ? "Extracting…" : "Extract Meta Tags"}
          </button>
        </div>
        {error && (
          <div className="flex items-start gap-2 px-4 py-3 rounded-xl"
            style={{ background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.2)" }}>
            <span className="material-symbols-outlined text-[15px] mt-0.5 shrink-0 text-red-400">error</span>
            <p className="text-[13px]" style={{ color: "#fca5a5" }}>{error}</p>
          </div>
        )}
      </div>

      {/* ── Results ───────────────────────────────────────────────── */}
      {result && (
        <>
          {/* Score + recs + actions */}
          <div className="glass-panel rounded-2xl p-5 flex flex-wrap items-start gap-6"
            style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
            <div className="flex flex-col items-center gap-1.5 shrink-0">
              <div className="relative w-24 h-24">
                <svg width="96" height="96" viewBox="0 0 96 96" aria-label={`SEO Score ${result.seoScore} out of 100`}>
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
              {result.pageTitle && (
                <p className="text-[11px] font-mono mb-2 truncate" style={{ color: "#3d3345" }} title={result.pageTitle}>
                  {result.pageTitle}
                </p>
              )}
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
                { label: "HTML", icon: "code",        fn: exportHtml },
                { label: "JSON", icon: "data_object", fn: exportJson },
                { label: "CSV",  icon: "table_chart", fn: exportCsv },
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

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard icon="tag"           label="Total Meta Tags"     value={result.totalTags}           color="#60a5fa" />
            <StatCard icon="warning"       label="Missing Recommended" value={result.missingRecommended}  color={result.missingRecommended > 0 ? "#ef4444" : "#22c55e"} />
            <StatCard icon="content_copy"  label="Duplicate Tags"      value={result.duplicateTags}       color={result.duplicateTags > 0 ? "#f59e0b" : "#22c55e"} />
            <StatCard icon="block"         label="Empty Tags"           value={result.emptyTags}           color={result.emptyTags > 0 ? "#ef4444" : "#22c55e"} />
          </div>

          {/* Missing tags */}
          {result.missingTags.length > 0 && (
            <div className="glass-panel rounded-2xl p-5 flex flex-col gap-3"
              style={{ border: "1px solid rgba(239,68,68,0.15)" }}>
              <PanelHeader icon="warning" title="Missing Recommended Tags" badge={result.missingTags.length} />
              <div className="flex flex-col gap-2">
                {result.missingTags.map((m, i) => (
                  <div key={i} className="flex items-start gap-3 px-3 py-2.5 rounded-xl"
                    style={{ background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.1)" }}>
                    <span className="material-symbols-outlined text-[14px] mt-0.5 shrink-0" style={{ color: "#ef4444" }}>error_outline</span>
                    <div>
                      <p className="text-[12px] font-bold font-mono" style={{ color: "#fca5a5" }}>{m.name}</p>
                      <p className="text-[11px]" style={{ color: "#988d9f" }}>{m.reason}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tag browser */}
          <div className="glass-panel rounded-2xl overflow-hidden"
            style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
            {/* Tab bar */}
            <div className="px-4 py-3 flex flex-wrap gap-2 items-center"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
              <button onClick={() => setActiveTab("all")}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-semibold transition-all"
                style={activeTab === "all" ? TAB_ON : TAB_OFF}>
                All <span className="text-[10px] opacity-70">({result.totalTags})</span>
              </button>
              {categories.map(cat => {
                const count = grouped.get(cat)?.length ?? 0;
                const icon = CATEGORY_ICONS[cat] ?? "more_horiz";
                return (
                  <button key={cat} onClick={() => setActiveTab(cat)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-semibold transition-all"
                    style={activeTab === cat ? TAB_ON : TAB_OFF}>
                    <span className="material-symbols-outlined text-[13px]">{icon}</span>
                    {cat} <span className="text-[10px] opacity-70">({count})</span>
                  </button>
                );
              })}
              {issueCount > 0 && (
                <button onClick={() => setActiveTab("issues")}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-semibold transition-all"
                  style={activeTab === "issues" ? TAB_ON : TAB_OFF}>
                  <span className="material-symbols-outlined text-[13px]">error_outline</span>
                  Issues <span className="text-[10px]" style={{ color: "#ef4444" }}>({issueCount})</span>
                </button>
              )}
            </div>

            {/* Controls */}
            <div className="px-4 py-2 flex items-center gap-2"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search tags…" aria-label="Search meta tags"
                className="rounded-lg px-3 py-1.5 text-[12px] outline-none bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] focus:border-[rgba(249,115,22,0.4)] text-[#e8dff0] placeholder-[#3d3345] w-44" />
              <span className="text-[11px] ml-auto" style={{ color: "#3d3345" }}>{displayTags.length} tag{displayTags.length !== 1 ? "s" : ""}</span>
              <button onClick={expandAll} className="text-[11px] font-semibold transition-all px-2 py-1 rounded-lg"
                style={{ color: "#988d9f", background: "rgba(255,255,255,0.03)" }}>Expand All</button>
              <button onClick={collapseAll} className="text-[11px] font-semibold transition-all px-2 py-1 rounded-lg"
                style={{ color: "#988d9f", background: "rgba(255,255,255,0.03)" }}>Collapse</button>
            </div>

            {/* Tag rows */}
            <div className="divide-y divide-[rgba(255,255,255,0.04)]">
              {displayTags.length === 0 ? (
                <p className="text-center text-[12px] py-8" style={{ color: "#3d3345" }}>No tags found for this filter.</p>
              ) : (
                displayTags.map((tag, i) => {
                  const key = `${tag.category}:${tag.name}:${i}`;
                  return (
                    <TagRow key={key} tag={tag} expanded={expanded.has(String(i))} onToggle={() => toggleExpand(String(i))} />
                  );
                })
              )}
            </div>
          </div>

          <p className="text-center text-[11px]" style={{ color: "#3d3345" }}>
            Extracted {new Date(result.analyzedAt).toLocaleString()} — {result.finalUrl}
          </p>
        </>
      )}

      {/* ── Empty state ───────────────────────────────────────── */}
      {!result && !loading && (
        <div className="glass-panel rounded-2xl p-8 flex flex-col items-center gap-4 text-center"
          style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
          <span className="material-symbols-outlined text-[48px]" style={{ color: "#3d3345" }}>code</span>
          <p className="text-[14px] font-semibold" style={{ color: "#988d9f" }}>Enter a URL to extract all meta tags</p>
          <p className="text-[12px] max-w-md" style={{ color: "#3d3345" }}>
            Fetches the page server-side and extracts every meta tag — basic SEO, Open Graph, Twitter Cards, canonical, icons and verification tags — grouped and syntax-highlighted.
          </p>
          <div className="flex flex-wrap justify-center gap-2 mt-1">
            {["Open Graph", "Twitter Cards", "Canonical", "Favicons", "Verification", "SEO Score"].map(f => (
              <span key={f} className="text-[11px] font-semibold px-3 py-1 rounded-full"
                style={{ background: "rgba(249,115,22,0.07)", color: "#988d9f", border: "1px solid rgba(249,115,22,0.15)" }}>{f}</span>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
