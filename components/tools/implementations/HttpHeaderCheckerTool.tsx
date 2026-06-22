"use client";

import { useState, useMemo, useCallback } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────
interface CookieInfo { name: string; secure: boolean; httpOnly: boolean; sameSite: string; raw: string; }
interface HeaderResult {
  url: string; checkedAt: string; status: number; statusText: string;
  httpVersion: string; responseTime: number; ttfb: number;
  headers: Record<string, string>; cookies: CookieInfo[];
}
interface Recommendation { level: "error" | "warning" | "info"; text: string; }

// ── Constants ─────────────────────────────────────────────────────────────────
const ACCENT = "#f97316";

// Security headers: [key, display label, why it matters]
const SECURITY_HEADERS: [string, string, string][] = [
  ["strict-transport-security",   "Strict-Transport-Security (HSTS)",     "Forces HTTPS and prevents downgrade attacks."],
  ["content-security-policy",     "Content-Security-Policy",              "Prevents XSS and data injection attacks."],
  ["x-frame-options",             "X-Frame-Options",                      "Prevents clickjacking by controlling iframe embedding."],
  ["x-content-type-options",      "X-Content-Type-Options",               "Prevents MIME-type sniffing attacks."],
  ["referrer-policy",             "Referrer-Policy",                      "Controls how much referrer info is sent with requests."],
  ["permissions-policy",          "Permissions-Policy",                   "Controls access to browser features (camera, mic, etc.)."],
  ["cross-origin-resource-policy","Cross-Origin-Resource-Policy",         "Restricts which origins can load this resource."],
  ["cross-origin-embedder-policy","Cross-Origin-Embedder-Policy",         "Required to enable powerful cross-origin isolation features."],
];

const CACHE_HEADERS: [string, string][] = [
  ["cache-control",  "Cache-Control"],
  ["expires",        "Expires"],
  ["etag",           "ETag"],
  ["last-modified",  "Last-Modified"],
  ["age",            "Age"],
  ["pragma",         "Pragma"],
];

const SEO_HEADERS: [string, string][] = [
  ["x-robots-tag",      "X-Robots-Tag"],
  ["link",              "Link"],
  ["vary",              "Vary"],
  ["content-language",  "Content-Language"],
];

const RESPONSE_HEADERS: [string, string][] = [
  ["content-type",      "Content-Type"],
  ["content-length",    "Content-Length"],
  ["content-encoding",  "Content-Encoding"],
  ["server",            "Server"],
  ["x-powered-by",      "X-Powered-By"],
  ["transfer-encoding", "Transfer-Encoding"],
  ["connection",        "Connection"],
];

// ── Scoring ───────────────────────────────────────────────────────────────────
function score(result: HeaderResult): { score: number; recommendations: Recommendation[] } {
  const h   = result.headers;
  const recs: Recommendation[] = [];
  let pts = 0;

  // Status
  if (result.status === 200) {
    pts += 10;
  } else if (result.status >= 400) {
    recs.push({ level: "error", text: `Server returned ${result.status} ${result.statusText} — the URL is not reachable.` });
    pts -= 20;
  }

  // HTTPS
  if (result.url.startsWith("https://")) {
    pts += 5;
  } else {
    recs.push({ level: "error", text: "Page is served over HTTP — migrate to HTTPS immediately." });
    pts -= 10;
  }

  // Security headers (10 pts each, up to 60)
  const secScores: Record<string, number> = {
    "strict-transport-security": 12,
    "content-security-policy":   12,
    "x-frame-options":            8,
    "x-content-type-options":     8,
    "referrer-policy":            6,
    "permissions-policy":         4,
  };
  for (const [key, disp, why] of SECURITY_HEADERS) {
    if (h[key]) {
      pts += secScores[key] ?? 3;
      recs.push({ level: "info", text: `${disp} is set.` });
    } else {
      recs.push({ level: (secScores[key] ?? 0) >= 8 ? "error" : "warning", text: `${disp} is missing. ${why}` });
    }
  }

  // Caching (10 pts)
  if (h["cache-control"]) {
    pts += 7;
    if (/no-store|no-cache/i.test(h["cache-control"])) {
      recs.push({ level: "info", text: "Cache-Control disables caching — acceptable for dynamic pages, but consider caching static assets." });
    } else {
      recs.push({ level: "info", text: `Cache-Control: ${h["cache-control"]}.` });
    }
  } else {
    recs.push({ level: "warning", text: "Cache-Control header is missing — add it to control caching behavior for browsers and CDNs." });
  }
  if (h["etag"] || h["last-modified"]) pts += 3;

  // Compression (5 pts)
  const enc = (h["content-encoding"] ?? "").toLowerCase();
  if (enc.includes("br")) {
    pts += 5;
    recs.push({ level: "info", text: "Brotli compression enabled — best compression ratio for text assets." });
  } else if (enc.includes("gzip")) {
    pts += 4;
    recs.push({ level: "info", text: "Gzip compression enabled." });
  } else if (enc.includes("deflate")) {
    pts += 3;
  } else {
    recs.push({ level: "warning", text: "No compression detected (no Content-Encoding: br/gzip). Enable Brotli or Gzip to reduce transfer size." });
  }

  // Performance
  if (result.responseTime < 500) {
    pts += 3;
  } else if (result.responseTime > 2000) {
    recs.push({ level: "warning", text: `Slow response time (${result.responseTime}ms) — TTFB over 600ms may hurt Core Web Vitals.` });
  }

  // Cookie security
  const insecureCookies = result.cookies.filter(c => !c.secure || !c.httpOnly);
  if (result.cookies.length > 0 && insecureCookies.length > 0) {
    recs.push({ level: "warning", text: `${insecureCookies.length} cookie${insecureCookies.length > 1 ? "s" : ""} missing Secure or HttpOnly flags.` });
  }

  return { score: Math.min(100, Math.max(0, pts)), recommendations: recs };
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

function HeaderRow({ label, value, mono = true }: { label: string; value?: string; mono?: boolean }) {
  const has = !!value;
  return (
    <div className="flex flex-col gap-0.5 py-2.5" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
      <span className="text-[11px] font-bold" style={{ color: "#988d9f" }}>{label}</span>
      <span className={`text-[12px] break-all leading-relaxed ${mono ? "font-mono" : ""}`}
        style={{ color: has ? "#e8dff0" : "#3d3345" }}>
        {value || "— not set —"}
      </span>
    </div>
  );
}

function SecurityRow({ label, value, description }: { label: string; value?: string; description: string }) {
  const present = !!value;
  const color   = present ? "#22c55e" : "#ef4444";
  const icon    = present ? "check_circle" : "cancel";
  return (
    <div className="flex items-start gap-3 py-2.5" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
      <span className="material-symbols-outlined text-[16px] mt-0.5 shrink-0" style={{ color }}>{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-bold" style={{ color: "#e8dff0" }}>{label}</p>
        {value
          ? <p className="text-[11px] font-mono break-all mt-0.5" style={{ color: "#988d9f" }}>{value}</p>
          : <p className="text-[11px] mt-0.5" style={{ color: "#3d3345" }}>{description}</p>
        }
      </div>
      <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg shrink-0"
        style={{ background: present ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)", color }}>
        {present ? "SET" : "MISSING"}
      </span>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function HttpHeaderCheckerTool() {
  const [url,     setUrl]     = useState("");
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");
  const [result,  setResult]  = useState<HeaderResult | null>(null);
  const [copied,  setCopied]  = useState(false);

  const { score: seoScore, recommendations } = useMemo(
    () => result ? score(result) : { score: 0, recommendations: [] },
    [result],
  );

  const scoreColor = seoScore >= 71 ? "#22c55e" : seoScore >= 41 ? "#f59e0b" : "#ef4444";
  const scoreLabel = seoScore >= 71 ? "Good" : seoScore >= 41 ? "Needs work" : "Poor";

  const check = useCallback(async () => {
    const trimmed = url.trim();
    if (!trimmed) { setError("Please enter a URL."); return; }
    setError(""); setLoading(true); setResult(null);
    try {
      const encoded = encodeURIComponent(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
      const res  = await fetch(`/api/check-headers?url=${encoded}`);
      const data = await res.json() as HeaderResult & { error?: string };
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
    const rows = Object.entries(result.headers)
      .map(([k, v]) => `"${k}","${v.replace(/"/g, '""')}"`)
      .join("\n");
    const blob = new Blob([`Header,Value\n${rows}`, ], { type: "text/csv" });
    const u = URL.createObjectURL(blob);
    Object.assign(document.createElement("a"), { href: u, download: "http-headers.csv" }).click();
    URL.revokeObjectURL(u);
  }, [result]);

  const exportJson = useCallback(() => {
    if (!result) return;
    const data = { ...result, seoScore, recommendations: recommendations.map(r => ({ level: r.level, text: r.text })) };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const u = URL.createObjectURL(blob);
    Object.assign(document.createElement("a"), { href: u, download: "http-headers.json" }).click();
    URL.revokeObjectURL(u);
  }, [result, seoScore, recommendations]);

  const exportTxt = useCallback(() => {
    if (!result) return;
    const lines = [
      `HTTP Header Analysis — ${result.url}`,
      `Checked: ${new Date(result.checkedAt).toLocaleString()}`,
      `Status: ${result.status} ${result.statusText}`,
      `Response Time: ${result.responseTime}ms`,
      `Score: ${seoScore}/100`,
      "",
      "=== ALL HEADERS ===",
      ...Object.entries(result.headers).map(([k, v]) => `${k}: ${v}`),
      "",
      "=== COOKIES ===",
      ...result.cookies.map(c => `${c.name} | Secure:${c.secure} HttpOnly:${c.httpOnly} SameSite:${c.sameSite}`),
      "",
      "=== RECOMMENDATIONS ===",
      ...recommendations.map(r => `[${r.level.toUpperCase()}] ${r.text}`),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const u = URL.createObjectURL(blob);
    Object.assign(document.createElement("a"), { href: u, download: "http-headers.txt" }).click();
    URL.revokeObjectURL(u);
  }, [result, seoScore, recommendations]);

  const exportPdf = useCallback(() => {
    if (!result) return;
    const headerRows = Object.entries(result.headers)
      .map(([k, v]) => `<tr><td style="font-weight:600;color:#555;white-space:nowrap">${k}</td><td style="word-break:break-all;font-size:11px">${v}</td></tr>`)
      .join("");
    const secRows = SECURITY_HEADERS.map(([key, label]) => {
      const val = result.headers[key];
      const color = val ? "#16a34a" : "#dc2626";
      return `<tr><td>${label}</td><td style="color:${color};font-weight:700">${val ? "SET" : "MISSING"}</td><td style="font-size:11px;color:#555;word-break:break-all">${val || "—"}</td></tr>`;
    }).join("");
    const recHtml = recommendations.map(r =>
      `<div class="rec rec-${r.level}">[${r.level.toUpperCase()}] ${r.text}</div>`
    ).join("");
    const html = `<!DOCTYPE html><html><head><title>HTTP Headers — ${result.url}</title>
<style>body{font-family:system-ui,sans-serif;max-width:900px;margin:2rem auto;color:#111;font-size:14px}
h1{font-size:20px}h2{font-size:15px;margin-top:24px;border-bottom:1px solid #ddd;padding-bottom:4px}
.score{font-size:36px;font-weight:900;color:${scoreColor}}
table{width:100%;border-collapse:collapse;margin-top:8px}
th,td{text-align:left;padding:5px 8px;border-bottom:1px solid #eee;font-size:12px;vertical-align:top}
th{font-weight:700;color:#555;background:#fafafa}
.meta{display:flex;flex-wrap:wrap;gap:12px;margin:8px 0}
.chip{background:#f5f5f5;border-radius:6px;padding:6px 12px;font-size:12px}
.chip b{display:block;font-size:16px;margin-bottom:2px}
.rec{padding:4px 8px;border-radius:4px;margin-bottom:4px;font-size:13px}
.rec-error{background:#fee2e2;color:#991b1b}.rec-warning{background:#fef9c3;color:#854d0e}.rec-info{background:#eff6ff;color:#1e40af}
</style></head><body>
<h1>HTTP Header Analysis</h1>
<p style="color:#555;word-break:break-all">${result.url} &mdash; ${new Date(result.checkedAt).toLocaleString()}</p>
<div class="score">${seoScore}<span style="font-size:16px;font-weight:400;color:#555"> / 100 ${scoreLabel}</span></div>
<div class="meta">
<div class="chip"><b>${result.status} ${result.statusText}</b>Status</div>
<div class="chip"><b>${result.responseTime}ms</b>Response Time</div>
<div class="chip"><b>${Object.keys(result.headers).length}</b>Headers</div>
<div class="chip"><b>${result.cookies.length}</b>Cookies</div>
</div>
<h2>Security Headers</h2>
<table><thead><tr><th>Header</th><th>Status</th><th>Value</th></tr></thead><tbody>${secRows}</tbody></table>
<h2>All Response Headers</h2>
<table><thead><tr><th>Header</th><th>Value</th></tr></thead><tbody>${headerRows}</tbody></table>
<h2>Recommendations</h2>${recHtml}
</body></html>`;
    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); w.print(); }
  }, [result, seoScore, scoreLabel, scoreColor, recommendations]);

  const copyResults = useCallback(async () => {
    if (!result) return;
    const text = [
      `HTTP Headers — ${result.url}`,
      `Score: ${seoScore}/100 | Status: ${result.status} | Time: ${result.responseTime}ms`,
      "",
      ...Object.entries(result.headers).slice(0, 30).map(([k, v]) => `${k}: ${v}`),
    ].join("\n");
    try { await navigator.clipboard.writeText(text); } catch { /* blocked */ }
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  }, [result, seoScore]);

  // ── Derived display values ────────────────────────────────────────────────
  const compression = useMemo(() => {
    if (!result) return null;
    const enc = (result.headers["content-encoding"] ?? "").toLowerCase();
    if (enc.includes("br"))      return { label: "Brotli", color: "#22c55e",  icon: "compress" };
    if (enc.includes("gzip"))    return { label: "Gzip",   color: "#60a5fa",  icon: "compress" };
    if (enc.includes("deflate")) return { label: "Deflate",color: "#a78bfa",  icon: "compress" };
    return { label: "None", color: "#ef4444", icon: "do_not_disturb_on" };
  }, [result]);

  const statusColor = useMemo(() => {
    if (!result) return "#988d9f";
    if (result.status < 300) return "#22c55e";
    if (result.status < 400) return "#f59e0b";
    return "#ef4444";
  }, [result]);

  const inputCls = "flex-1 rounded-xl px-3 py-2.5 text-[13px] outline-none transition-all bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] focus:border-[rgba(249,115,22,0.4)] text-[#e8dff0] placeholder-[#3d3345]";

  return (
    <div className="mb-12 flex flex-col gap-6">

      {/* ── Input ─────────────────────────────────────────── */}
      <div className="glass-panel rounded-2xl p-5 flex flex-col gap-4"
        style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
        <PanelHeader icon="http" title="Analyze HTTP Headers" />
        <div className="flex gap-3 flex-wrap sm:flex-nowrap">
          <input type="url" value={url} onChange={e => setUrl(e.target.value)} onKeyDown={handleKey}
            placeholder="https://example.com" aria-label="URL to analyze"
            className={inputCls} />
          <button onClick={check} disabled={loading}
            className="btn-primary flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm shrink-0 disabled:opacity-60">
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
            <p className="text-[13px]" style={{ color: ACCENT }}>Fetching headers — this may take a few seconds…</p>
          </div>
        )}
      </div>

      {/* ── Results ───────────────────────────────────────── */}
      {result && (() => {
        const totalHeaders  = Object.keys(result.headers).length;
        const secPresent    = SECURITY_HEADERS.filter(([k]) => result.headers[k]).length;

        return (
          <>
            {/* Score + recommendations + actions */}
            <div className="glass-panel rounded-2xl p-5 flex flex-wrap items-start gap-6"
              style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
              <div className="flex flex-col items-center gap-1.5 shrink-0">
                <div className="relative w-24 h-24">
                  <svg width="96" height="96" viewBox="0 0 96 96" aria-label={`Score ${seoScore}/100`}>
                    <circle cx="48" cy="48" r="40" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="7" />
                    <circle cx="48" cy="48" r="40" fill="none"
                      stroke={scoreColor} strokeWidth="7"
                      strokeDasharray={2 * Math.PI * 40}
                      strokeDashoffset={2 * Math.PI * 40 * (1 - seoScore / 100)}
                      strokeLinecap="round" transform="rotate(-90 48 48)"
                      style={{ transition: "stroke-dashoffset 0.6s ease, stroke 0.4s ease" }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-[26px] font-black tabular-nums" style={{ color: scoreColor, lineHeight: 1 }}>{seoScore}</span>
                    <span className="text-[9px] font-bold" style={{ color: scoreColor, opacity: 0.7 }}>/ 100</span>
                  </div>
                </div>
                <span className="text-[11px] font-bold" style={{ color: scoreColor }}>{scoreLabel}</span>
                <span className="text-[10px]" style={{ color: "#3d3345" }}>Header Score</span>
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-bold mb-3" style={{ color: "#e8dff0" }}>Recommendations</p>
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

              <div className="flex flex-wrap gap-2 w-full pt-4" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                <button onClick={copyResults} className="btn-primary flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm">
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

            {/* Stat cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { icon: "check_circle",  label: "Status",            value: `${result.status}`,         color: statusColor },
                { icon: "timer",         label: "Response Time",     value: `${result.responseTime}ms`, color: result.responseTime < 600 ? "#22c55e" : result.responseTime < 1500 ? "#f59e0b" : "#ef4444" },
                { icon: "shield",        label: "Security Headers",  value: `${secPresent}/${SECURITY_HEADERS.length}`, color: secPresent >= 6 ? "#22c55e" : secPresent >= 3 ? "#f59e0b" : "#ef4444" },
                { icon: "compress",      label: "Compression",       value: compression?.label ?? "—",  color: compression?.color ?? "#988d9f" },
              ].map(({ icon, label, value, color }) => (
                <div key={label} className="glass-panel rounded-2xl p-4 flex flex-col gap-1.5"
                  style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
                  <span className="material-symbols-outlined text-[20px]" style={{ color }}>{icon}</span>
                  <p className="text-[20px] font-black tabular-nums leading-tight" style={{ color: "#e8dff0" }}>{value}</p>
                  <p className="text-[11px] font-bold" style={{ color: "#988d9f" }}>{label}</p>
                </div>
              ))}
            </div>

            {/* Response overview */}
            <div className="glass-panel rounded-2xl p-5 flex flex-col gap-0"
              style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
              <div className="mb-3"><PanelHeader icon="info" title="Response Overview" badge={`${totalHeaders} headers`} /></div>
              {RESPONSE_HEADERS.map(([key, label]) => (
                <HeaderRow key={key} label={label} value={result.headers[key]} />
              ))}
              <HeaderRow label="HTTP Version"    value={result.httpVersion} />
              <HeaderRow label="Status"          value={`${result.status} ${result.statusText}`} />
              <HeaderRow label="Response Time"   value={`${result.responseTime}ms`} mono={false} />
            </div>

            {/* Security headers */}
            <div className="glass-panel rounded-2xl p-5 flex flex-col gap-0"
              style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
              <div className="mb-3">
                <PanelHeader icon="security" title="Security Headers"
                  badge={`${secPresent}/${SECURITY_HEADERS.length} present`} />
              </div>
              {SECURITY_HEADERS.map(([key, label, desc]) => (
                <SecurityRow key={key} label={label} value={result.headers[key]} description={desc} />
              ))}
            </div>

            {/* Caching */}
            <div className="glass-panel rounded-2xl p-5 flex flex-col gap-0"
              style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
              <div className="mb-3"><PanelHeader icon="cached" title="Caching Headers" /></div>
              {CACHE_HEADERS.map(([key, label]) => (
                <HeaderRow key={key} label={label} value={result.headers[key]} />
              ))}
            </div>

            {/* SEO headers */}
            <div className="glass-panel rounded-2xl p-5 flex flex-col gap-0"
              style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
              <div className="mb-3"><PanelHeader icon="travel_explore" title="SEO Headers" /></div>
              {SEO_HEADERS.map(([key, label]) => (
                <HeaderRow key={key} label={label} value={result.headers[key]} />
              ))}
            </div>

            {/* Cookies */}
            {(result.cookies.length > 0 || result.headers["set-cookie"]) && (
              <div className="glass-panel rounded-2xl p-5 flex flex-col gap-3"
                style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
                <PanelHeader icon="cookie" title="Cookies" badge={`${result.cookies.length} cookie${result.cookies.length !== 1 ? "s" : ""}`} />
                <div className="flex flex-col gap-2">
                  {result.cookies.map((c, i) => (
                    <div key={i} className="flex flex-wrap items-center gap-2 px-3 py-2.5 rounded-xl"
                      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                      <span className="text-[12px] font-bold font-mono" style={{ color: "#e8dff0" }}>{c.name || "(unnamed)"}</span>
                      {[
                        { label: "Secure",   ok: c.secure },
                        { label: "HttpOnly", ok: c.httpOnly },
                      ].map(({ label, ok }) => (
                        <span key={label} className="text-[10px] font-bold px-2 py-0.5 rounded-md"
                          style={{ background: ok ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)", color: ok ? "#22c55e" : "#ef4444" }}>
                          {label}
                        </span>
                      ))}
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md"
                        style={{ background: "rgba(96,165,250,0.1)", color: "#60a5fa" }}>
                        SameSite: {c.sameSite}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* All raw headers */}
            <div className="glass-panel rounded-2xl overflow-hidden"
              style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
              <div className="px-5 py-4">
                <PanelHeader icon="code" title="All Response Headers" badge={`${totalHeaders}`} />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[500px]">
                  <thead>
                    <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}>
                      <th className="text-left px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider w-56" style={{ color: "#988d9f" }}>Header</th>
                      <th className="text-left px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider" style={{ color: "#988d9f" }}>Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(result.headers).map(([k, v]) => (
                      <tr key={k} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
                        className="hover:bg-[rgba(255,255,255,0.015)] transition-colors">
                        <td className="px-4 py-2.5 text-[12px] font-mono font-bold align-top" style={{ color: ACCENT }}>{k}</td>
                        <td className="px-3 py-2.5 text-[12px] font-mono break-all" style={{ color: "#e8dff0" }}>{v}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <p className="text-center text-[11px]" style={{ color: "#3d3345" }}>
              Analyzed {new Date(result.checkedAt).toLocaleString()} &mdash; {result.url}
            </p>
          </>
        );
      })()}

      {/* Empty state */}
      {!result && !loading && (
        <div className="glass-panel rounded-2xl p-8 flex flex-col items-center gap-4 text-center"
          style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
          <span className="material-symbols-outlined text-[48px]" style={{ color: "#3d3345" }}>http</span>
          <p className="text-[14px] font-semibold" style={{ color: "#988d9f" }}>Enter a URL above and click Analyze</p>
          <p className="text-[12px] max-w-md" style={{ color: "#3d3345" }}>
            Fetches all HTTP response headers server-side and checks security headers, caching, compression, SEO headers and cookies.
          </p>
          <div className="flex flex-wrap justify-center gap-2 mt-1">
            {["Security Headers", "Cache-Control", "Brotli / Gzip", "X-Robots-Tag", "Cookies", "SEO Score"].map(f => (
              <span key={f} className="text-[11px] font-semibold px-3 py-1 rounded-full"
                style={{ background: "rgba(249,115,22,0.07)", color: "#988d9f", border: "1px solid rgba(249,115,22,0.15)" }}>{f}</span>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
