"use client";

import { useState, useCallback } from "react";
import type { OgData } from "@/app/api/fetch-og/route";

// ── Constants ─────────────────────────────────────────────────────────────────
const ACCENT = "#f97316";

// ── Sub-components (defined outside main to avoid remounting) ─────────────────
function PanelHeader({ icon, title, badge }: { icon: string; title: string; badge?: string | number }) {
  return (
    <div className="flex items-center gap-2 pb-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
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

// ── Platform Preview Cards ─────────────────────────────────────────────────────

function ImagePlaceholder({ text }: { text: string }) {
  return (
    <div className="w-full h-full flex items-center justify-center"
      style={{ background: "rgba(255,255,255,0.06)" }}>
      <div className="flex flex-col items-center gap-1">
        <span className="material-symbols-outlined text-[28px]" style={{ color: "#3d3345" }}>image_not_supported</span>
        <p className="text-[10px]" style={{ color: "#3d3345" }}>{text}</p>
      </div>
    </div>
  );
}

function CardWrapper({ label, icon, color, children, note }: {
  label: string; icon: string; color: string; children: React.ReactNode; note?: string;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className="text-[13px] font-black" style={{ color }}>{label}</span>
        <span className="material-symbols-outlined text-[14px]" style={{ color }}>{icon}</span>
        {note && <span className="text-[10px] ml-auto" style={{ color: "#3d3345" }}>{note}</span>}
      </div>
      {children}
    </div>
  );
}

// Facebook card
function FacebookCard({ d }: { d: OgData }) {
  const title = d.ogTitle || d.pageTitle || "Untitled";
  const desc  = d.ogDescription;
  const img   = d.displayImage;
  const domain = d.displayDomain || d.ogUrl || d.finalUrl;
  return (
    <CardWrapper label="Facebook" icon="thumb_up" color="#1877f2" note="~1200×630 image">
      <div className="rounded-lg overflow-hidden" style={{ background: "#fff", maxWidth: 500, boxShadow: "0 2px 12px rgba(0,0,0,0.35)" }}>
        {/* Image area */}
        <div style={{ aspectRatio: "1.91/1", background: "#e4e6eb", overflow: "hidden", maxHeight: 262 }}>
          {img
            ? <img src={img} alt={d.ogImageAlt || title} className="w-full h-full object-cover" loading="lazy" />
            : <ImagePlaceholder text="No og:image" />}
        </div>
        {/* Text */}
        <div className="px-3 py-2.5" style={{ background: "#f0f2f5", borderTop: "1px solid #dddfe2" }}>
          <p className="text-[11px] uppercase tracking-wider mb-0.5 truncate" style={{ color: "#606770" }}>
            {typeof domain === "string" ? domain.replace(/^https?:\/\//, "").split("/")[0] : domain}
          </p>
          <p className="text-[14px] font-bold leading-tight line-clamp-2" style={{ color: "#1c1e21" }}>{title}</p>
          {desc && <p className="text-[12px] mt-0.5 line-clamp-2" style={{ color: "#606770" }}>{desc}</p>}
        </div>
      </div>
    </CardWrapper>
  );
}

// X / Twitter card
function TwitterCard({ d }: { d: OgData }) {
  const cardType = d.twitterCard || "summary_large_image";
  const title    = d.twitterTitle || d.ogTitle || d.pageTitle || "Untitled";
  const desc     = d.twitterDescription || d.ogDescription;
  const img      = d.twitterImage || d.displayImage;
  const domain   = d.displayDomain;
  const isLarge  = cardType === "summary_large_image" || cardType === "app";
  return (
    <CardWrapper label="X (Twitter)" icon="close" color="#000" note={`Card: ${cardType || "not set"}`}>
      <div className="rounded-2xl overflow-hidden" style={{ background: "#000", maxWidth: 500, border: "1px solid #2f3336", boxShadow: "0 2px 12px rgba(0,0,0,0.5)" }}>
        {isLarge ? (
          <>
            <div style={{ aspectRatio: "1.91/1", background: "#16181c", overflow: "hidden", maxHeight: 262 }}>
              {img
                ? <img src={img} alt={d.twitterImageAlt || title} className="w-full h-full object-cover" loading="lazy" />
                : <ImagePlaceholder text="No image" />}
            </div>
            <div className="px-3 py-2.5">
              <p className="text-[13px] font-bold leading-tight line-clamp-1" style={{ color: "#e7e9ea" }}>{title}</p>
              {desc && <p className="text-[12px] mt-0.5 line-clamp-2" style={{ color: "#71767b" }}>{desc}</p>}
              <p className="text-[11px] mt-1" style={{ color: "#71767b" }}>{domain}</p>
            </div>
          </>
        ) : (
          <div className="flex overflow-hidden" style={{ minHeight: 130 }}>
            <div style={{ width: 130, minWidth: 130, background: "#16181c", overflow: "hidden" }}>
              {img
                ? <img src={img} alt={title} className="w-full h-full object-cover" loading="lazy" />
                : <ImagePlaceholder text="No image" />}
            </div>
            <div className="flex flex-col justify-center px-3 py-2 min-w-0">
              <p className="text-[13px] font-bold leading-tight line-clamp-1" style={{ color: "#e7e9ea" }}>{title}</p>
              {desc && <p className="text-[12px] mt-0.5 line-clamp-2" style={{ color: "#71767b" }}>{desc}</p>}
              <p className="text-[11px] mt-1" style={{ color: "#71767b" }}>{domain}</p>
            </div>
          </div>
        )}
      </div>
    </CardWrapper>
  );
}

// LinkedIn card
function LinkedInCard({ d }: { d: OgData }) {
  const title = d.ogTitle || d.pageTitle || "Untitled";
  const desc  = d.ogDescription;
  const img   = d.displayImage;
  const site  = d.ogSiteName || d.displayDomain;
  return (
    <CardWrapper label="LinkedIn" icon="work" color="#0a66c2" note="~1200×627 image">
      <div className="rounded-lg overflow-hidden" style={{ background: "#fff", maxWidth: 500, boxShadow: "0 2px 12px rgba(0,0,0,0.35)" }}>
        <div style={{ aspectRatio: "1.91/1", background: "#eef3f8", overflow: "hidden", maxHeight: 262 }}>
          {img
            ? <img src={img} alt={title} className="w-full h-full object-cover" loading="lazy" />
            : <ImagePlaceholder text="No og:image" />}
        </div>
        <div className="px-3 py-2.5" style={{ borderTop: "1px solid #e0e0e0" }}>
          <p className="text-[14px] font-bold leading-tight line-clamp-2" style={{ color: "#000000e6" }}>{title}</p>
          {site && <p className="text-[11px] mt-1" style={{ color: "#00000099" }}>{site}</p>}
          {desc && <p className="text-[12px] mt-1 line-clamp-2" style={{ color: "#00000099" }}>{desc}</p>}
        </div>
      </div>
    </CardWrapper>
  );
}

// Discord embed
function DiscordCard({ d }: { d: OgData }) {
  const title = d.ogTitle || d.pageTitle || "Untitled";
  const desc  = d.ogDescription;
  const img   = d.displayImage;
  const site  = d.ogSiteName || d.displayDomain;
  const isLarge = !!(img);
  return (
    <CardWrapper label="Discord" icon="chat" color="#5865f2">
      <div className="rounded-lg overflow-hidden pl-3" style={{ background: "#313338", maxWidth: 500, boxShadow: "0 2px 12px rgba(0,0,0,0.5)", borderLeft: "4px solid #5865f2" }}>
        <div className="py-3 pr-3 flex gap-3">
          <div className="flex-1 min-w-0 flex flex-col gap-1">
            {site && <p className="text-[11px] font-semibold truncate" style={{ color: "#00aff4" }}>{site}</p>}
            <p className="text-[13px] font-bold leading-tight line-clamp-1" style={{ color: "#ffffff" }}>{title}</p>
            {desc && <p className="text-[12px] line-clamp-3 leading-relaxed" style={{ color: "#dbdee1" }}>{desc}</p>}
            {isLarge && (
              <div className="mt-2 rounded-lg overflow-hidden" style={{ maxHeight: 200 }}>
                <img src={img} alt={title} className="w-full object-cover rounded-lg" loading="lazy" />
              </div>
            )}
          </div>
          {!isLarge && (
            <div style={{ width: 80, height: 80, background: "#1e1f22", borderRadius: 4, overflow: "hidden", flexShrink: 0 }}>
              <ImagePlaceholder text="" />
            </div>
          )}
        </div>
      </div>
    </CardWrapper>
  );
}

// Slack unfurl
function SlackCard({ d }: { d: OgData }) {
  const title = d.ogTitle || d.pageTitle || "Untitled";
  const desc  = d.ogDescription;
  const img   = d.displayImage;
  const site  = d.ogSiteName || d.displayDomain;
  return (
    <CardWrapper label="Slack" icon="tag" color="#4a154b">
      <div className="rounded-lg overflow-hidden pl-2.5" style={{ background: "#1a1d21", maxWidth: 500, boxShadow: "0 2px 12px rgba(0,0,0,0.5)", borderLeft: "3px solid #36c5f0" }}>
        <div className="py-2.5 pr-3 flex gap-3 items-start">
          <div className="flex-1 min-w-0">
            {site && <p className="text-[11px] font-bold truncate" style={{ color: "#1d9bd1" }}>{site}</p>}
            <p className="text-[13px] font-bold mt-0.5 leading-snug" style={{ color: "#d1d2d3" }}>{title}</p>
            {desc && <p className="text-[12px] mt-1 line-clamp-3 leading-relaxed" style={{ color: "#868789" }}>{desc}</p>}
          </div>
          {img && (
            <div style={{ width: 72, height: 72, borderRadius: 6, overflow: "hidden", flexShrink: 0 }}>
              <img src={img} alt={title} className="w-full h-full object-cover" loading="lazy" />
            </div>
          )}
          {!img && (
            <div style={{ width: 72, height: 72, borderRadius: 6, background: "#222529", flexShrink: 0, overflow: "hidden" }}>
              <ImagePlaceholder text="" />
            </div>
          )}
        </div>
      </div>
    </CardWrapper>
  );
}

// ── Tag row in the raw data table ─────────────────────────────────────────────
function TagRow({ label, value, missing }: { label: string; value: string; missing?: boolean }) {
  const isEmpty = !value;
  return (
    <div className="flex items-start gap-3 py-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
      <span className="text-[11px] font-mono font-semibold shrink-0 w-40" style={{ color: "#a78bfa" }}>{label}</span>
      {isEmpty ? (
        <span className="text-[11px] px-2 py-0.5 rounded-full"
          style={{ background: missing ? "rgba(239,68,68,0.1)" : "rgba(255,255,255,0.04)", color: missing ? "#ef4444" : "#3d3345" }}>
          {missing ? "Missing" : "Not set"}
        </span>
      ) : (
        <span className="text-[12px] break-all leading-relaxed" style={{ color: "#c8b89f" }}>{value}</span>
      )}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function OgImagePreviewTool() {
  const [url,       setUrl]       = useState("");
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState("");
  const [data,      setData]      = useState<OgData | null>(null);
  const [copied,    setCopied]    = useState(false);
  const [activeTab, setActiveTab] = useState<"previews" | "data" | "issues">("previews");

  const TAB_OFF = { background: "rgba(255,255,255,0.03)", color: "#988d9f", border: "1px solid rgba(255,255,255,0.07)" } as React.CSSProperties;
  const TAB_ON  = { background: "rgba(249,115,22,0.12)", color: ACCENT, border: "1px solid rgba(249,115,22,0.3)" } as React.CSSProperties;

  const scoreColor = data
    ? data.seoScore >= 71 ? "#22c55e" : data.seoScore >= 41 ? "#f59e0b" : "#ef4444"
    : "#988d9f";
  const scoreLabel = data
    ? data.seoScore >= 71 ? "Healthy" : data.seoScore >= 41 ? "Needs work" : "Poor"
    : "";

  const fetch_ = useCallback(async () => {
    const trimmed = url.trim();
    if (!trimmed) { setError("Please enter a URL."); return; }
    setError(""); setData(null); setLoading(true); setActiveTab("previews");
    try {
      const res = await fetch(`/api/fetch-og?url=${encodeURIComponent(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`)}`);
      const json = await res.json() as OgData & { error?: string };
      if (json.error) { setError(json.error); return; }
      setData(json);
    } catch {
      setError("Network error — please try again.");
    } finally {
      setLoading(false);
    }
  }, [url]);

  const reset = useCallback(() => { setUrl(""); setData(null); setError(""); }, []);

  // ── Exports ────────────────────────────────────────────────────────────────
  const exportJson = useCallback(() => {
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const u = URL.createObjectURL(blob);
    Object.assign(document.createElement("a"), { href: u, download: "og-preview.json" }).click();
    URL.revokeObjectURL(u);
  }, [data]);

  const exportTxt = useCallback(() => {
    if (!data) return;
    const lines = [
      `OG Image Preview — ${data.finalUrl}`,
      `Analyzed: ${new Date(data.analyzedAt).toLocaleString()}`,
      `Score: ${data.seoScore}/100`,
      "",
      "=== OPEN GRAPH ===",
      `og:title:       ${data.ogTitle || "(missing)"}`,
      `og:description: ${data.ogDescription || "(missing)"}`,
      `og:image:       ${data.ogImage || "(missing)"}`,
      `og:url:         ${data.ogUrl || "(missing)"}`,
      `og:type:        ${data.ogType || "(missing)"}`,
      `og:site_name:   ${data.ogSiteName || "(missing)"}`,
      `og:locale:      ${data.ogLocale || "(missing)"}`,
      "",
      "=== TWITTER CARD ===",
      `twitter:card:        ${data.twitterCard || "(missing)"}`,
      `twitter:title:       ${data.twitterTitle || "(missing)"}`,
      `twitter:description: ${data.twitterDescription || "(missing)"}`,
      `twitter:image:       ${data.twitterImage || "(missing)"}`,
      `twitter:creator:     ${data.twitterCreator || "(missing)"}`,
      `twitter:site:        ${data.twitterSite || "(missing)"}`,
      "",
      "=== RECOMMENDATIONS ===",
      ...data.recommendations,
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const u = URL.createObjectURL(blob);
    Object.assign(document.createElement("a"), { href: u, download: "og-preview.txt" }).click();
    URL.revokeObjectURL(u);
  }, [data]);

  const exportPdf = useCallback(() => {
    if (!data) return;
    const issueRows = data.issues.map(iss => {
      const c = iss.level === "error" ? "#dc2626" : iss.level === "warning" ? "#d97706" : "#2563eb";
      const ic = iss.level === "error" ? "✗" : iss.level === "warning" ? "⚠" : "ℹ";
      return `<li style="color:${c};font-size:11px;margin-bottom:4px">${ic} ${iss.message}</li>`;
    }).join("");
    const recRows = data.recommendations.map(r => `<li style="font-size:11px;margin-bottom:4px">${r}</li>`).join("");
    const imgSection = data.ogImage
      ? `<img src="${data.ogImage}" style="max-width:400px;max-height:210px;object-fit:cover;border-radius:6px;margin-top:8px" alt="" />`
      : `<p style="color:#999;font-size:11px">No og:image</p>`;
    const html = `<!DOCTYPE html><html><head><title>OG Preview — ${data.finalUrl}</title>
<style>body{font-family:system-ui,sans-serif;max-width:800px;margin:2rem auto;color:#111;font-size:12px}
h1{font-size:18px}h2{font-size:13px;margin-top:18px;border-bottom:1px solid #ddd;padding-bottom:3px}
.score{font-size:34px;font-weight:900}.chips{display:flex;flex-wrap:wrap;gap:10px;margin:8px 0}
.chip{background:#f5f5f5;border-radius:6px;padding:4px 10px;font-size:11px}.chip b{display:block;font-size:15px}
table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:4px 6px;border-bottom:1px solid #eee;font-size:11px;vertical-align:top}
th{font-weight:700;color:#555;background:#fafafa}ul li{margin-bottom:4px}
</style></head><body>
<h1>OG Image Preview</h1>
<p style="color:#666;word-break:break-all">${data.finalUrl} — ${new Date(data.analyzedAt).toLocaleString()}</p>
<div class="score" style="color:${scoreColor}">${data.seoScore}<span style="font-size:14px;font-weight:400;color:#555"> / 100 — ${scoreLabel}</span></div>
<h2>OG Image</h2>${imgSection}
<h2>Open Graph</h2>
<table><tbody>
<tr><th>og:title</th><td>${data.ogTitle || "<span style='color:#dc2626'>Missing</span>"}</td></tr>
<tr><th>og:description</th><td>${data.ogDescription || "<span style='color:#dc2626'>Missing</span>"}</td></tr>
<tr><th>og:image</th><td style="word-break:break-all">${data.ogImage || "<span style='color:#dc2626'>Missing</span>"}</td></tr>
<tr><th>og:url</th><td>${data.ogUrl || "(not set)"}</td></tr>
<tr><th>og:type</th><td>${data.ogType || "(not set)"}</td></tr>
<tr><th>og:site_name</th><td>${data.ogSiteName || "(not set)"}</td></tr>
<tr><th>og:locale</th><td>${data.ogLocale || "(not set)"}</td></tr>
</tbody></table>
<h2>Twitter Card</h2>
<table><tbody>
<tr><th>twitter:card</th><td>${data.twitterCard || "<span style='color:#d97706'>Missing</span>"}</td></tr>
<tr><th>twitter:title</th><td>${data.twitterTitle || "(not set)"}</td></tr>
<tr><th>twitter:description</th><td>${data.twitterDescription || "(not set)"}</td></tr>
<tr><th>twitter:image</th><td style="word-break:break-all">${data.twitterImage || "(not set)"}</td></tr>
<tr><th>twitter:creator</th><td>${data.twitterCreator || "(not set)"}</td></tr>
<tr><th>twitter:site</th><td>${data.twitterSite || "(not set)"}</td></tr>
</tbody></table>
${issueRows ? `<h2>Issues</h2><ul>${issueRows}</ul>` : ""}
${recRows ? `<h2>Recommendations</h2><ul>${recRows}</ul>` : ""}
</body></html>`;
    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); w.print(); }
  }, [data, scoreColor, scoreLabel]);

  const copyResults = useCallback(async () => {
    if (!data) return;
    const lines = [
      `OG Preview — ${data.finalUrl}`,
      `Score: ${data.seoScore}/100`,
      `og:title: ${data.ogTitle}`,
      `og:description: ${data.ogDescription}`,
      `og:image: ${data.ogImage}`,
      ...data.recommendations,
    ];
    try { await navigator.clipboard.writeText(lines.join("\n")); } catch { /* blocked */ }
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  }, [data]);

  const inputCls = "rounded-xl px-3 py-2.5 text-[13px] outline-none transition-all bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] focus:border-[rgba(249,115,22,0.4)] text-[#e8dff0] placeholder-[#3d3345]";
  const errorCount   = data?.issues.filter(i => i.level === "error").length ?? 0;
  const warningCount = data?.issues.filter(i => i.level === "warning").length ?? 0;

  return (
    <div className="mb-12 flex flex-col gap-6">

      {/* ── Input ─────────────────────────────────────────────────── */}
      <div className="glass-panel rounded-2xl p-5 flex flex-col gap-4"
        style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
        <PanelHeader icon="open_graph" title="Preview Social Media Cards" />
        <div className="flex gap-3 flex-wrap sm:flex-nowrap">
          <input type="url" value={url} onChange={e => setUrl(e.target.value)}
            onKeyDown={e => e.key === "Enter" && fetch_()}
            placeholder="https://example.com" aria-label="Website URL"
            className={`${inputCls} flex-1`} />
          <button onClick={fetch_} disabled={loading}
            className="btn-primary flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm shrink-0 disabled:opacity-60">
            <span className="material-symbols-outlined text-[15px]">{loading ? "hourglass_top" : "preview"}</span>
            {loading ? "Fetching…" : "Preview"}
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
      {data && (
        <>
          {/* Score + recs + actions */}
          <div className="glass-panel rounded-2xl p-5 flex flex-wrap items-start gap-6"
            style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
            <div className="flex flex-col items-center gap-1.5 shrink-0">
              <div className="relative w-24 h-24">
                <svg width="96" height="96" viewBox="0 0 96 96" aria-label={`Score ${data.seoScore} out of 100`}>
                  <circle cx="48" cy="48" r="40" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="7" />
                  <circle cx="48" cy="48" r="40" fill="none"
                    stroke={scoreColor} strokeWidth="7"
                    strokeDasharray={2 * Math.PI * 40}
                    strokeDashoffset={2 * Math.PI * 40 * (1 - data.seoScore / 100)}
                    strokeLinecap="round" transform="rotate(-90 48 48)"
                    style={{ transition: "stroke-dashoffset 0.6s ease" }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-[26px] font-black tabular-nums" style={{ color: scoreColor, lineHeight: 1 }}>{data.seoScore}</span>
                  <span className="text-[9px] font-bold" style={{ color: scoreColor, opacity: 0.7 }}>/ 100</span>
                </div>
              </div>
              <span className="text-[11px] font-bold" style={{ color: scoreColor }}>{scoreLabel}</span>
            </div>

            <div className="flex-1 min-w-0">
              {data.pageTitle && (
                <p className="text-[11px] font-mono mb-2 truncate" style={{ color: "#3d3345" }}>{data.pageTitle}</p>
              )}
              <p className="text-[13px] font-bold mb-3" style={{ color: "#e8dff0" }}>Recommendations</p>
              <ul className="flex flex-col gap-2 max-h-44 overflow-y-auto pr-1">
                {data.recommendations.map((rec, i) => (
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

          {/* Quick stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard icon="image" label="OG Image"
              value={data.ogImage ? (data.imageStatus === "ok" ? "OK" : data.imageStatus === "error" ? "Error" : data.imageStatus === "small" ? "Too small" : "HTTP") : "Missing"}
              color={data.ogImage && data.imageStatus === "ok" ? "#22c55e" : "#ef4444"} />
            <StatCard icon="share" label="OG Tags"
              value={[data.ogTitle, data.ogDescription, data.ogImage, data.ogUrl].filter(Boolean).length + " / 4"}
              color={[data.ogTitle, data.ogDescription, data.ogImage, data.ogUrl].every(Boolean) ? "#22c55e" : "#f59e0b"} />
            <StatCard icon="tag" label="Twitter Card"
              value={data.twitterCard || "Missing"}
              color={data.twitterCard ? "#22c55e" : "#f59e0b"} />
            <StatCard icon="error" label="Issues"
              value={`${errorCount}E · ${warningCount}W`}
              color={errorCount > 0 ? "#ef4444" : warningCount > 0 ? "#f59e0b" : "#22c55e"} />
          </div>

          {/* Tabs */}
          <div className="flex gap-2 flex-wrap">
            {([
              ["previews", "preview", "Platform Previews"],
              ["data",     "code",    "Raw OG Data"],
              ["issues",   "warning", `Issues (${data.issues.length})`],
            ] as const).map(([t, icon, label]) => (
              <button key={t} onClick={() => setActiveTab(t)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12px] font-semibold transition-all"
                style={activeTab === t ? TAB_ON : TAB_OFF}>
                <span className="material-symbols-outlined text-[14px]">{icon}</span>{label}
              </button>
            ))}
          </div>

          {/* Platform previews */}
          {activeTab === "previews" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <FacebookCard d={data} />
              <TwitterCard  d={data} />
              <LinkedInCard d={data} />
              <DiscordCard  d={data} />
              <SlackCard    d={data} />
            </div>
          )}

          {/* Raw OG data table */}
          {activeTab === "data" && (
            <div className="glass-panel rounded-2xl p-5 flex flex-col gap-0"
              style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
              <PanelHeader icon="code" title="Open Graph & Twitter Card Data" />
              <div className="mt-3">
                <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: "#3d3345" }}>Open Graph</p>
                <TagRow label="og:title"       value={data.ogTitle}       missing={!data.ogTitle} />
                <TagRow label="og:description" value={data.ogDescription} missing={!data.ogDescription} />
                <TagRow label="og:image"       value={data.ogImage}       missing={!data.ogImage} />
                <TagRow label="og:image:width"  value={data.ogImageWidth}  />
                <TagRow label="og:image:height" value={data.ogImageHeight} />
                <TagRow label="og:image:alt"    value={data.ogImageAlt}   />
                <TagRow label="og:url"         value={data.ogUrl}         />
                <TagRow label="og:type"        value={data.ogType}        />
                <TagRow label="og:site_name"   value={data.ogSiteName}    />
                <TagRow label="og:locale"      value={data.ogLocale}      />

                <p className="text-[10px] font-bold uppercase tracking-wider mt-5 mb-2" style={{ color: "#3d3345" }}>Twitter Card</p>
                <TagRow label="twitter:card"        value={data.twitterCard}        missing={!data.twitterCard} />
                <TagRow label="twitter:title"       value={data.twitterTitle}       />
                <TagRow label="twitter:description" value={data.twitterDescription} />
                <TagRow label="twitter:image"       value={data.twitterImage}       />
                <TagRow label="twitter:image:alt"   value={data.twitterImageAlt}   />
                <TagRow label="twitter:creator"     value={data.twitterCreator}     />
                <TagRow label="twitter:site"        value={data.twitterSite}        />

                <p className="text-[10px] font-bold uppercase tracking-wider mt-5 mb-2" style={{ color: "#3d3345" }}>Page</p>
                <TagRow label="page title"  value={data.pageTitle}  />
                <TagRow label="final URL"   value={data.finalUrl}   />
              </div>
            </div>
          )}

          {/* Issues */}
          {activeTab === "issues" && (
            <div className="glass-panel rounded-2xl p-5 flex flex-col gap-3"
              style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
              <PanelHeader icon="warning" title="Detected Issues" badge={data.issues.length} />
              {data.issues.length === 0 ? (
                <p className="text-[13px] text-center py-4" style={{ color: "#988d9f" }}>No issues — social sharing tags are complete.</p>
              ) : (
                data.issues.map((iss, i) => {
                  const c  = iss.level === "error" ? "#ef4444" : iss.level === "warning" ? "#f59e0b" : "#60a5fa";
                  const ic = iss.level === "error" ? "error" : iss.level === "warning" ? "warning" : "info";
                  return (
                    <div key={i} className="flex items-start gap-3 px-3 py-2.5 rounded-xl"
                      style={{ background: `${c}08`, border: `1px solid ${c}20` }}>
                      <span className="material-symbols-outlined text-[14px] mt-0.5 shrink-0" style={{ color: c }}>{ic}</span>
                      <p className="text-[12px] leading-relaxed" style={{ color: "#c8b89f" }}>{iss.message}</p>
                    </div>
                  );
                })
              )}
            </div>
          )}

          <p className="text-center text-[11px]" style={{ color: "#3d3345" }}>
            Fetched {new Date(data.analyzedAt).toLocaleString()} — {data.finalUrl}
          </p>
        </>
      )}

      {/* ── Empty state ───────────────────────────────────────── */}
      {!data && !loading && (
        <div className="glass-panel rounded-2xl p-8 flex flex-col items-center gap-4 text-center"
          style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
          <span className="material-symbols-outlined text-[48px]" style={{ color: "#3d3345" }}>preview</span>
          <p className="text-[14px] font-semibold" style={{ color: "#988d9f" }}>Enter a URL to preview social media cards</p>
          <p className="text-[12px] max-w-md" style={{ color: "#3d3345" }}>
            Fetches the live Open Graph and Twitter Card metadata and renders pixel-accurate preview cards for Facebook, X, LinkedIn, Discord and Slack.
          </p>
          <div className="flex flex-wrap justify-center gap-2 mt-1">
            {["Facebook", "X (Twitter)", "LinkedIn", "Discord", "Slack", "OG Score"].map(f => (
              <span key={f} className="text-[11px] font-semibold px-3 py-1 rounded-full"
                style={{ background: "rgba(249,115,22,0.07)", color: "#988d9f", border: "1px solid rgba(249,115,22,0.15)" }}>{f}</span>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
