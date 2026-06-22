"use client";

import { useState, useMemo, useCallback } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────
interface RedirectStep {
  url: string;
  status: number;
  statusText: string;
  location: string;
  responseTime: number;
  isRedirect: boolean;
}

interface RedirectResult {
  startUrl: string;
  finalUrl: string;
  steps: RedirectStep[];
  totalTime: number;
  hasLoop: boolean;
  checkedAt: string;
}

interface Recommendation { level: "error" | "warning" | "info"; text: string; }

// ── Constants ─────────────────────────────────────────────────────────────────
const ACCENT = "#f97316";

const STATUS_META: Record<number, { color: string; bg: string; label: string }> = {
  200: { color: "#22c55e", bg: "rgba(34,197,94,0.12)",   label: "OK" },
  301: { color: "#60a5fa", bg: "rgba(96,165,250,0.12)",  label: "Permanent" },
  302: { color: "#f59e0b", bg: "rgba(245,158,11,0.12)",  label: "Temporary" },
  303: { color: "#f59e0b", bg: "rgba(245,158,11,0.12)",  label: "See Other" },
  307: { color: "#a78bfa", bg: "rgba(167,139,250,0.12)", label: "Temp Redirect" },
  308: { color: "#60a5fa", bg: "rgba(96,165,250,0.12)",  label: "Perm Redirect" },
  400: { color: "#ef4444", bg: "rgba(239,68,68,0.12)",   label: "Bad Request" },
  401: { color: "#ef4444", bg: "rgba(239,68,68,0.12)",   label: "Unauthorized" },
  403: { color: "#ef4444", bg: "rgba(239,68,68,0.12)",   label: "Forbidden" },
  404: { color: "#ef4444", bg: "rgba(239,68,68,0.12)",   label: "Not Found" },
  410: { color: "#ef4444", bg: "rgba(239,68,68,0.12)",   label: "Gone" },
  500: { color: "#ef4444", bg: "rgba(239,68,68,0.12)",   label: "Server Error" },
  502: { color: "#ef4444", bg: "rgba(239,68,68,0.12)",   label: "Bad Gateway" },
  503: { color: "#ef4444", bg: "rgba(239,68,68,0.12)",   label: "Unavailable" },
  0:   { color: "#ef4444", bg: "rgba(239,68,68,0.12)",   label: "Error" },
};

function statusMeta(code: number) {
  return STATUS_META[code] ?? { color: "#988d9f", bg: "rgba(148,163,184,0.12)", label: "Unknown" };
}

// ── Analysis & scoring ────────────────────────────────────────────────────────
function analyze(result: RedirectResult): { score: number; recommendations: Recommendation[] } {
  const recs: Recommendation[] = [];
  let score = 100;

  const { steps, hasLoop } = result;
  const redirectSteps = steps.filter(s => s.isRedirect);
  const finalStep     = steps[steps.length - 1];
  const finalStatus   = finalStep?.status ?? 0;

  // Loop
  if (hasLoop) {
    recs.push({ level: "error", text: "Redirect loop detected — the URL redirects back to itself. This causes infinite loops for browsers and search engine crawlers." });
    score -= 50;
  }

  // Chain length
  if (redirectSteps.length === 0 && finalStatus === 200) {
    recs.push({ level: "info", text: "No redirects — URL resolves directly with a 200 OK. Ideal." });
    score += 0;
  } else if (redirectSteps.length === 1) {
    const s = redirectSteps[0];
    if (s.status === 301 || s.status === 308) {
      recs.push({ level: "info", text: "Single permanent redirect (301/308) — correct for SEO. Link equity is passed to the destination." });
    } else if (s.status === 302 || s.status === 307) {
      recs.push({ level: "warning", text: `Redirect uses ${s.status} (temporary). If this is a permanent move, change it to 301 to preserve link equity.` });
      score -= 10;
    }
  } else if (redirectSteps.length >= 2) {
    recs.push({ level: "warning", text: `Redirect chain of ${redirectSteps.length} hops detected. Each hop dilutes link equity and slows load time. Update the origin to redirect directly to the final URL.` });
    score -= Math.min(40, redirectSteps.length * 10);
  }

  if (redirectSteps.length > 5) {
    recs.push({ level: "error", text: `${redirectSteps.length} redirects — browsers and crawlers may give up before reaching the final destination (Chrome limit: 20, Googlebot: ~5).` });
    score -= 20;
  }

  // Broken final destination
  if (finalStatus === 404) {
    recs.push({ level: "error", text: "Final destination returns 404 Not Found — the redirect points to a broken page." });
    score -= 40;
  } else if (finalStatus === 410) {
    recs.push({ level: "error", text: "Final destination returns 410 Gone — the page no longer exists. Update or remove the redirect." });
    score -= 30;
  } else if (finalStatus >= 500) {
    recs.push({ level: "error", text: `Final destination returns ${finalStatus} server error — the destination is temporarily or permanently unavailable.` });
    score -= 30;
  } else if (finalStatus === 0) {
    recs.push({ level: "error", text: "Could not reach the destination — network error or timeout." });
    score -= 40;
  }

  // Mixed HTTP → HTTPS
  const hasHttpStart  = result.startUrl.startsWith("http://");
  const hasHttpsFinal = result.finalUrl.startsWith("https://");
  if (hasHttpStart && hasHttpsFinal) {
    recs.push({ level: "info", text: "HTTP correctly redirects to HTTPS — good for security and SEO." });
  }
  const hasHttpsMixed = steps.some(s => s.url.startsWith("https://") && s.location.startsWith("http://"));
  if (hasHttpsMixed) {
    recs.push({ level: "error", text: "HTTPS to HTTP downgrade detected in redirect chain — never redirect from HTTPS to HTTP." });
    score -= 20;
  }

  // Response time
  const slowSteps = steps.filter(s => s.responseTime > 1000);
  if (slowSteps.length > 0) {
    recs.push({ level: "warning", text: `${slowSteps.length} redirect hop${slowSteps.length > 1 ? "s" : ""} took over 1 second — slow redirects hurt Core Web Vitals.` });
    score -= 5;
  }

  return { score: Math.min(100, Math.max(0, score)), recommendations: recs };
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

function StatusBadge({ status }: { status: number }) {
  const m = statusMeta(status);
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-bold tabular-nums"
      style={{ background: m.bg, color: m.color, border: `1px solid ${m.color}33` }}>
      {status || "ERR"}
    </span>
  );
}

function TypeBadge({ status }: { status: number }) {
  const m = statusMeta(status);
  if (!m.label || m.label === "Unknown") return null;
  return (
    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md"
      style={{ background: m.bg, color: m.color }}>
      {m.label}
    </span>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function RedirectCheckerTool() {
  const [url,     setUrl]     = useState("");
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");
  const [result,  setResult]  = useState<RedirectResult | null>(null);
  const [copied,  setCopied]  = useState(false);

  const { score, recommendations } = useMemo(
    () => result ? analyze(result) : { score: 0, recommendations: [] },
    [result],
  );

  const scoreColor = score >= 71 ? "#22c55e" : score >= 41 ? "#f59e0b" : "#ef4444";
  const scoreLabel = score >= 71 ? "Good" : score >= 41 ? "Needs work" : "Poor";

  const check = useCallback(async () => {
    const trimmed = url.trim();
    if (!trimmed) { setError("Please enter a URL."); return; }
    setError(""); setLoading(true); setResult(null);
    try {
      const encoded = encodeURIComponent(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
      const res  = await fetch(`/api/check-redirects?url=${encoded}`);
      const data = await res.json() as RedirectResult & { error?: string };
      if (data.error) setError(data.error);
      else setResult(data);
    } catch {
      setError("Network error — please try again.");
    } finally {
      setLoading(false);
    }
  }, [url]);

  const handleKey = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") check();
  }, [check]);

  const reset = useCallback(() => {
    setUrl(""); setResult(null); setError(""); setCopied(false);
  }, []);

  // ── Exports ───────────────────────────────────────────────────────────────
  const exportCsv = useCallback(() => {
    if (!result) return;
    const header = "Step,URL,Status,Status Text,Type,Response Time (ms),Redirects To\n";
    const rows   = result.steps.map((s, i) =>
      `${i + 1},"${s.url}",${s.status},"${s.statusText}","${statusMeta(s.status).label}",${s.responseTime},"${s.location}"`
    ).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const u    = URL.createObjectURL(blob);
    Object.assign(document.createElement("a"), { href: u, download: "redirect-check.csv" }).click();
    URL.revokeObjectURL(u);
  }, [result]);

  const exportJson = useCallback(() => {
    if (!result) return;
    const data = { ...result, score, recommendations: recommendations.map(r => ({ level: r.level, text: r.text })) };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const u    = URL.createObjectURL(blob);
    Object.assign(document.createElement("a"), { href: u, download: "redirect-check.json" }).click();
    URL.revokeObjectURL(u);
  }, [result, score, recommendations]);

  const exportTxt = useCallback(() => {
    if (!result) return;
    const lines = [
      `Redirect Check — ${result.startUrl}`,
      `Checked: ${new Date(result.checkedAt).toLocaleString()}`,
      `Score: ${score}/100 (${scoreLabel})`,
      `Total time: ${result.totalTime}ms  |  Hops: ${result.steps.length}  |  Loop: ${result.hasLoop}`,
      `Final URL: ${result.finalUrl}`,
      "",
      "=== REDIRECT CHAIN ===",
      ...result.steps.map((s, i) =>
        `${i + 1}. [${s.status}] ${s.url}${s.location ? ` → ${s.location}` : ""} (${s.responseTime}ms)`
      ),
      "",
      "=== RECOMMENDATIONS ===",
      ...recommendations.map(r => `[${r.level.toUpperCase()}] ${r.text}`),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const u    = URL.createObjectURL(blob);
    Object.assign(document.createElement("a"), { href: u, download: "redirect-check.txt" }).click();
    URL.revokeObjectURL(u);
  }, [result, score, scoreLabel, recommendations]);

  const exportPdf = useCallback(() => {
    if (!result) return;
    const rows = result.steps.map((s, i) => {
      const m = statusMeta(s.status);
      return `<tr>
        <td style="text-align:center;font-weight:700;color:#555">${i + 1}</td>
        <td style="word-break:break-all;font-size:12px">${s.url}</td>
        <td style="text-align:center"><span style="color:${m.color};font-weight:700">${s.status || "ERR"}</span></td>
        <td style="text-align:center;font-size:11px;color:#555">${m.label}</td>
        <td style="text-align:center;font-size:11px;color:#555">${s.responseTime}ms</td>
        <td style="word-break:break-all;font-size:11px;color:#555">${s.location || "—"}</td>
      </tr>`;
    }).join("");
    const recHtml = recommendations.map(r =>
      `<div class="rec rec-${r.level}">[${r.level.toUpperCase()}] ${r.text}</div>`
    ).join("");
    const html = `<!DOCTYPE html><html><head><title>Redirect Check — ${result.startUrl}</title>
<style>body{font-family:system-ui,sans-serif;max-width:900px;margin:2rem auto;color:#111;font-size:14px}
h1{font-size:20px}h2{font-size:15px;margin-top:24px;border-bottom:1px solid #ddd;padding-bottom:4px}
.score{font-size:36px;font-weight:900;color:${scoreColor}}
table{width:100%;border-collapse:collapse;margin-top:8px}
th,td{text-align:left;padding:5px 8px;border-bottom:1px solid #eee;font-size:12px;vertical-align:top}
th{font-weight:700;color:#555;background:#fafafa}
.rec{padding:4px 8px;border-radius:4px;margin-bottom:4px;font-size:13px}
.rec-error{background:#fee2e2;color:#991b1b}.rec-warning{background:#fef9c3;color:#854d0e}.rec-info{background:#eff6ff;color:#1e40af}
.meta{display:flex;flex-wrap:wrap;gap:12px;margin:8px 0}
.chip{background:#f5f5f5;border-radius:6px;padding:6px 12px;font-size:12px}
.chip b{display:block;font-size:16px;margin-bottom:2px}
</style></head><body>
<h1>Redirect Check</h1>
<p style="color:#555;word-break:break-all">${result.startUrl}</p>
<p style="color:#555;font-size:12px">Checked: ${new Date(result.checkedAt).toLocaleString()}</p>
<div class="score">${score}<span style="font-size:16px;font-weight:400;color:#555"> / 100 ${scoreLabel}</span></div>
<div class="meta">
<div class="chip"><b>${result.steps.length}</b>Total Hops</div>
<div class="chip"><b>${result.steps.filter(s=>s.isRedirect).length}</b>Redirects</div>
<div class="chip"><b>${result.totalTime}ms</b>Total Time</div>
<div class="chip"><b style="color:${result.hasLoop?"#dc2626":"#16a34a"}">${result.hasLoop?"YES":"NO"}</b>Loop</div>
<div class="chip" style="max-width:400px"><b style="font-size:12px;word-break:break-all">${result.finalUrl}</b>Final URL</div>
</div>
<h2>Redirect Chain</h2>
<table><thead><tr><th>#</th><th>URL</th><th>Status</th><th>Type</th><th>Time</th><th>Redirects To</th></tr></thead>
<tbody>${rows}</tbody></table>
<h2>Recommendations</h2>${recHtml}
</body></html>`;
    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); w.print(); }
  }, [result, score, scoreLabel, scoreColor, recommendations]);

  const copyResults = useCallback(async () => {
    if (!result) return;
    const text = [
      `Score: ${score}/100 | Hops: ${result.steps.length} | Loop: ${result.hasLoop}`,
      `Start: ${result.startUrl}`,
      `Final: ${result.finalUrl}`,
      "",
      ...result.steps.map((s, i) => `${i + 1}. ${s.status} ${s.statusText} — ${s.url}`),
    ].join("\n");
    try { await navigator.clipboard.writeText(text); } catch { /* blocked */ }
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  }, [result, score]);

  const inputCls = "flex-1 rounded-xl px-3 py-2.5 text-[13px] outline-none transition-all bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] focus:border-[rgba(249,115,22,0.4)] text-[#e8dff0] placeholder-[#3d3345]";

  return (
    <div className="mb-12 flex flex-col gap-6">

      {/* ── Input ─────────────────────────────────────────── */}
      <div className="glass-panel rounded-2xl p-5 flex flex-col gap-4"
        style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
        <PanelHeader icon="swap_horiz" title="Check URL Redirects" />
        <div className="flex gap-3 flex-wrap sm:flex-nowrap">
          <input type="url" value={url} onChange={e => setUrl(e.target.value)} onKeyDown={handleKey}
            placeholder="https://example.com" aria-label="URL to check"
            className={inputCls} />
          <button onClick={check} disabled={loading}
            className="btn-primary flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm shrink-0 disabled:opacity-60">
            <span className="material-symbols-outlined text-[16px]">{loading ? "hourglass_top" : "search"}</span>
            {loading ? "Checking…" : "Check"}
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
            <p className="text-[13px]" style={{ color: ACCENT }}>Following redirect chain — this may take a few seconds…</p>
          </div>
        )}
      </div>

      {/* ── Results ───────────────────────────────────────── */}
      {result && (() => {
        const redirectCount = result.steps.filter(s => s.isRedirect).length;
        const finalStep     = result.steps[result.steps.length - 1];
        const finalMeta     = statusMeta(finalStep?.status ?? 0);

        return (
          <>
            {/* Score + summary */}
            <div className="glass-panel rounded-2xl p-5 flex flex-wrap items-start gap-6"
              style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
              {/* Gauge */}
              <div className="flex flex-col items-center gap-1.5 shrink-0">
                <div className="relative w-24 h-24">
                  <svg width="96" height="96" viewBox="0 0 96 96" aria-label={`Score ${score}/100`}>
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
                <span className="text-[10px]" style={{ color: "#3d3345" }}>Redirect Score</span>
              </div>

              {/* Recommendations */}
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-bold mb-3" style={{ color: "#e8dff0" }}>Analysis</p>
                <ul className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-1">
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

              {/* Actions */}
              <div className="flex flex-wrap gap-2 w-full pt-4"
                style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                <button onClick={copyResults}
                  className="btn-primary flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm">
                  <span className="material-symbols-outlined text-[15px]">{copied ? "check" : "content_copy"}</span>
                  {copied ? "Copied!" : "Copy"}
                </button>
                <button onClick={exportCsv} className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all"
                  style={{ background: "rgba(249,115,22,0.09)", color: ACCENT, border: "1px solid rgba(249,115,22,0.22)" }}>
                  <span className="material-symbols-outlined text-[14px]">table_chart</span>CSV
                </button>
                <button onClick={exportJson} className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all"
                  style={{ background: "rgba(255,255,255,0.04)", color: "#c8c0d0", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <span className="material-symbols-outlined text-[14px]">data_object</span>JSON
                </button>
                <button onClick={exportTxt} className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all"
                  style={{ background: "rgba(255,255,255,0.04)", color: "#c8c0d0", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <span className="material-symbols-outlined text-[14px]">description</span>TXT
                </button>
                <button onClick={exportPdf} className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all"
                  style={{ background: "rgba(255,255,255,0.04)", color: "#c8c0d0", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <span className="material-symbols-outlined text-[14px]">print</span>PDF
                </button>
                <button onClick={reset} className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all ml-auto"
                  style={{ background: "rgba(255,255,255,0.03)", color: "#988d9f", border: "1px solid rgba(255,255,255,0.07)" }}>
                  <span className="material-symbols-outlined text-[14px]">restart_alt</span>Reset
                </button>
              </div>
            </div>

            {/* Summary chips */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { icon: "route",         label: "Total Hops",    value: result.steps.length,   color: ACCENT },
                { icon: "swap_horiz",    label: "Redirects",     value: redirectCount,          color: "#60a5fa" },
                { icon: "schedule",      label: "Total Time",    value: `${result.totalTime}ms`, color: "#a78bfa" },
                { icon: result.hasLoop ? "loop" : "check_circle", label: result.hasLoop ? "Loop!" : "No Loop",
                  value: result.hasLoop ? "⚠ YES" : "✓",         color: result.hasLoop ? "#ef4444" : "#22c55e" },
              ].map(({ icon, label, value, color }) => (
                <div key={label} className="glass-panel rounded-2xl p-4 flex flex-col gap-1.5"
                  style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
                  <span className="material-symbols-outlined text-[20px]" style={{ color }}>{icon}</span>
                  <p className="text-[20px] font-black tabular-nums leading-tight" style={{ color: "#e8dff0" }}>{value}</p>
                  <p className="text-[11px] font-bold" style={{ color: "#988d9f" }}>{label}</p>
                </div>
              ))}
            </div>

            {/* Final destination */}
            <div className="glass-panel rounded-2xl p-5 flex flex-col gap-3"
              style={{ border: `1px solid ${finalMeta.color}33` }}>
              <PanelHeader icon="flag" title="Final Destination" />
              <div className="flex items-start gap-3 flex-wrap">
                <StatusBadge status={finalStep?.status ?? 0} />
                <TypeBadge   status={finalStep?.status ?? 0} />
                <p className="text-[13px] font-mono break-all flex-1" style={{ color: "#e8dff0" }}>
                  {result.finalUrl}
                </p>
              </div>
              {result.startUrl !== result.finalUrl && (
                <div className="text-[11px] flex items-center gap-2 flex-wrap">
                  <span style={{ color: "#3d3345" }}>Started at:</span>
                  <span className="font-mono break-all" style={{ color: "#988d9f" }}>{result.startUrl}</span>
                </div>
              )}
            </div>

            {/* Timeline */}
            <div className="glass-panel rounded-2xl overflow-hidden"
              style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
              <div className="px-5 py-4">
                <PanelHeader icon="timeline" title="Redirect Chain" badge={`${result.steps.length} step${result.steps.length !== 1 ? "s" : ""}`} />
              </div>
              <div className="px-4 pb-4 flex flex-col gap-0">
                {result.steps.map((step, i) => {
                  const m       = statusMeta(step.status);
                  const isLast  = i === result.steps.length - 1;
                  const isSlow  = step.responseTime > 1000;
                  return (
                    <div key={i} className="flex gap-3">
                      {/* Connector line + dot */}
                      <div className="flex flex-col items-center shrink-0" style={{ width: "20px" }}>
                        <div className="w-4 h-4 rounded-full flex items-center justify-center mt-3 shrink-0"
                          style={{ background: m.bg, border: `2px solid ${m.color}` }}>
                          <div className="w-1.5 h-1.5 rounded-full" style={{ background: m.color }} />
                        </div>
                        {!isLast && (
                          <div className="flex-1 w-px mt-1" style={{ background: "rgba(255,255,255,0.08)", minHeight: "20px" }} />
                        )}
                      </div>

                      {/* Card */}
                      <div className="flex-1 mb-3 rounded-xl p-3 flex flex-col gap-2"
                        style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] font-black tabular-nums w-5 shrink-0" style={{ color: "#3d3345" }}>#{i + 1}</span>
                          <StatusBadge status={step.status} />
                          <TypeBadge   status={step.status} />
                          {isSlow && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md"
                              style={{ background: "rgba(245,158,11,0.12)", color: "#f59e0b" }}>SLOW</span>
                          )}
                          <span className="ml-auto text-[11px] tabular-nums" style={{ color: "#3d3345" }}>
                            {step.responseTime}ms
                          </span>
                        </div>
                        <p className="text-[12px] font-mono break-all" style={{ color: "#e8dff0" }}>{step.url}</p>
                        {step.isRedirect && step.location && (
                          <div className="flex items-start gap-1.5 pt-1" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                            <span className="material-symbols-outlined text-[13px] mt-0.5 shrink-0" style={{ color: ACCENT }}>arrow_forward</span>
                            <p className="text-[11px] font-mono break-all" style={{ color: "#988d9f" }}>{step.location}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Status legend */}
            <div className="glass-panel rounded-2xl p-5 flex flex-col gap-3"
              style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
              <PanelHeader icon="info" title="Status Code Reference" />
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                {[
                  [200, "Direct — no redirect"],
                  [301, "Permanent redirect (SEO safe)"],
                  [302, "Temporary redirect"],
                  [307, "Temp — method preserved"],
                  [308, "Permanent — method preserved"],
                  [404, "Broken link"],
                  [410, "Gone permanently"],
                  [500, "Server error"],
                ].map(([code, desc]) => {
                  const m = statusMeta(Number(code));
                  return (
                    <div key={code} className="flex items-start gap-2 px-3 py-2 rounded-xl"
                      style={{ background: m.bg, border: `1px solid ${m.color}22` }}>
                      <span className="text-[11px] font-black tabular-nums shrink-0" style={{ color: m.color }}>{code}</span>
                      <span className="text-[10px] leading-snug" style={{ color: "#988d9f" }}>{desc}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <p className="text-center text-[11px]" style={{ color: "#3d3345" }}>
              Checked {new Date(result.checkedAt).toLocaleString()} &mdash; {result.startUrl}
            </p>
          </>
        );
      })()}

      {/* Empty state */}
      {!result && !loading && (
        <div className="glass-panel rounded-2xl p-8 flex flex-col items-center gap-4 text-center"
          style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
          <span className="material-symbols-outlined text-[48px]" style={{ color: "#3d3345" }}>swap_horiz</span>
          <p className="text-[14px] font-semibold" style={{ color: "#988d9f" }}>Enter a URL above and click Check</p>
          <p className="text-[12px] max-w-md" style={{ color: "#3d3345" }}>
            Traces every redirect hop server-side. Detects 301, 302, 307, 308 chains, loops, HTTP→HTTPS upgrades, broken destinations and slow hops.
          </p>
          <div className="flex flex-wrap justify-center gap-2 mt-1">
            {["301 / 302 Detection", "Chain Tracing", "Loop Detection", "HTTP→HTTPS", "Response Times", "SEO Score"].map(f => (
              <span key={f} className="text-[11px] font-semibold px-3 py-1 rounded-full"
                style={{ background: "rgba(249,115,22,0.07)", color: "#988d9f", border: "1px solid rgba(249,115,22,0.15)" }}>{f}</span>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
