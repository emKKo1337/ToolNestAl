"use client";

import { useState, useMemo, useCallback } from "react";
import type { SchemaExtractionResult, ExtractedSchema } from "@/app/api/extract-schema/route";

// ── Constants ─────────────────────────────────────────────────────────────────
const ACCENT = "#f97316";

const FORMAT_COLORS: Record<string, string> = {
  "JSON-LD":   "#60a5fa",
  "Microdata": "#a78bfa",
  "RDFa":      "#34d399",
};

const STATUS_COLORS: Record<string, string> = {
  valid:    "#22c55e",
  warnings: "#f59e0b",
  errors:   "#ef4444",
};

const STATUS_ICONS: Record<string, string> = {
  valid:    "check_circle",
  warnings: "warning",
  errors:   "error",
};

// ── Sub-components (defined outside main) ─────────────────────────────────────
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

// Syntax-highlighted JSON renderer
function JsonHighlight({ json }: { json: string }) {
  const lines = json.split("\n");
  return (
    <code className="text-[11px] font-mono leading-relaxed block">
      {lines.map((line, i) => {
        // Colorise: keys, strings, numbers, booleans, null
        const parts: { text: string; color: string }[] = [];
        let rest = line;
        // Leading whitespace
        const wsM = rest.match(/^(\s*)/);
        if (wsM?.[1]) { parts.push({ text: wsM[1], color: "transparent" }); rest = rest.slice(wsM[1].length); }

        // Key: "key":
        const keyM = rest.match(/^("(?:[^"\\]|\\.)*")(\s*:)/);
        if (keyM) {
          parts.push({ text: keyM[1], color: "#a78bfa" });
          parts.push({ text: keyM[2], color: "#988d9f" });
          rest = rest.slice((keyM[1] + keyM[2]).length);
          if (rest.startsWith(" ")) { parts.push({ text: " ", color: "#988d9f" }); rest = rest.slice(1); }
        }

        // Value
        const strM   = rest.match(/^("(?:[^"\\]|\\.)*")/);
        const numM   = rest.match(/^(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/);
        const boolM  = rest.match(/^(true|false)/);
        const nullM  = rest.match(/^(null)/);
        const punctM = rest.match(/^([{}\[\],])/);

        if (strM)   { parts.push({ text: strM[1],   color: "#f97316" }); rest = rest.slice(strM[1].length); }
        else if (numM)  { parts.push({ text: numM[1],  color: "#34d399" }); rest = rest.slice(numM[1].length); }
        else if (boolM) { parts.push({ text: boolM[1], color: "#60a5fa" }); rest = rest.slice(boolM[1].length); }
        else if (nullM) { parts.push({ text: nullM[1], color: "#ef4444" }); rest = rest.slice(nullM[1].length); }
        else if (punctM){ parts.push({ text: punctM[1],color: "#988d9f" }); rest = rest.slice(1); }

        if (rest) parts.push({ text: rest, color: "#c8b89f" });

        return (
          <span key={i} className="block">
            {parts.map((p, j) => <span key={j} style={{ color: p.color }}>{p.text}</span>)}
          </span>
        );
      })}
    </code>
  );
}

function SchemaCard({ schema, defaultOpen }: { schema: ExtractedSchema; defaultOpen: boolean }) {
  const [open,    setOpen]    = useState(defaultOpen);
  const [copied,  setCopied]  = useState(false);
  const statusColor = STATUS_COLORS[schema.validationStatus] ?? "#988d9f";
  const statusIcon  = STATUS_ICONS[schema.validationStatus]  ?? "help";
  const formatColor = FORMAT_COLORS[schema.format] ?? ACCENT;

  const copy = useCallback(async () => {
    try { await navigator.clipboard.writeText(schema.prettyJson); } catch { /* blocked */ }
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  }, [schema.prettyJson]);

  const download = useCallback(() => {
    const blob = new Blob([schema.prettyJson], { type: "application/json" });
    const u = URL.createObjectURL(blob);
    Object.assign(document.createElement("a"), { href: u, download: `schema-${schema.type}-${schema.id}.json` }).click();
    URL.revokeObjectURL(u);
  }, [schema.prettyJson, schema.type, schema.id]);

  return (
    <div className="glass-panel rounded-2xl overflow-hidden"
      style={{ border: `1px solid ${open ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.06)"}`, transition: "border-color 0.2s" }}>
      {/* Header */}
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-[rgba(255,255,255,0.02)] transition-colors"
        aria-expanded={open}>
        {/* Format badge */}
        <span className="text-[10px] font-black px-2 py-1 rounded-lg shrink-0"
          style={{ background: `${formatColor}18`, color: formatColor, border: `1px solid ${formatColor}30` }}>
          {schema.format}
        </span>
        {/* Type */}
        <div className="flex flex-col min-w-0">
          <span className="text-[14px] font-bold truncate" style={{ color: "#e8dff0" }}>
            {schema.types.join(" · ")}
          </span>
          <span className="text-[10px]" style={{ color: "#988d9f" }}>
            {schema.propertyCount} propert{schema.propertyCount === 1 ? "y" : "ies"}
          </span>
        </div>
        {/* Rich Results badge */}
        {schema.isRichResultsEligible && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 hidden sm:inline-flex items-center gap-1"
            style={{ background: "rgba(34,197,94,0.1)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.2)" }}>
            <span className="material-symbols-outlined text-[11px]">stars</span>
            Rich Results
          </span>
        )}
        {/* Validation */}
        <span className="ml-auto flex items-center gap-1 shrink-0">
          <span className="material-symbols-outlined text-[16px]" style={{ color: statusColor }}>{statusIcon}</span>
          <span className="text-[11px] font-semibold hidden sm:inline" style={{ color: statusColor }}>
            {schema.validationStatus.charAt(0).toUpperCase() + schema.validationStatus.slice(1)}
          </span>
        </span>
        <span className="material-symbols-outlined text-[18px] ml-2 shrink-0 transition-transform"
          style={{ color: "#3d3345", transform: open ? "rotate(180deg)" : "none" }}>expand_more</span>
      </button>

      {/* Body */}
      {open && (
        <div className="flex flex-col gap-4 px-5 pb-5">
          {/* Validation issues */}
          {schema.issues.length > 0 && (
            <div className="flex flex-col gap-1.5">
              {schema.issues.map((issue, i) => {
                const c = issue.level === "error" ? "#ef4444" : issue.level === "warning" ? "#f59e0b" : "#60a5fa";
                const ic = issue.level === "error" ? "error" : issue.level === "warning" ? "warning" : "info";
                return (
                  <div key={i} className="flex items-start gap-2 px-3 py-2 rounded-lg"
                    style={{ background: `${c}08`, border: `1px solid ${c}20` }}>
                    <span className="material-symbols-outlined text-[13px] mt-0.5 shrink-0" style={{ color: c }}>{ic}</span>
                    <p className="text-[11px] leading-relaxed" style={{ color: "#c8b89f" }}>{issue.message}</p>
                  </div>
                );
              })}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 flex-wrap">
            <button onClick={copy}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all"
              style={{ background: "rgba(249,115,22,0.09)", color: ACCENT, border: "1px solid rgba(249,115,22,0.22)" }}>
              <span className="material-symbols-outlined text-[13px]">{copied ? "check" : "content_copy"}</span>
              {copied ? "Copied!" : "Copy JSON"}
            </button>
            <button onClick={download}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all"
              style={{ background: "rgba(255,255,255,0.04)", color: "#c8c0d0", border: "1px solid rgba(255,255,255,0.08)" }}>
              <span className="material-symbols-outlined text-[13px]">download</span>
              Download JSON
            </button>
            {schema.richResultType && (
              <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold"
                style={{ background: "rgba(34,197,94,0.07)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.15)" }}>
                <span className="material-symbols-outlined text-[13px]">stars</span>
                {schema.richResultType} Rich Result
              </span>
            )}
          </div>

          {/* Pretty JSON */}
          <div className="rounded-xl overflow-x-auto overflow-y-auto max-h-96"
            style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="p-4">
              <JsonHighlight json={schema.prettyJson} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function SchemaExtractorTool() {
  const [url,       setUrl]       = useState("");
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState("");
  const [result,    setResult]    = useState<SchemaExtractionResult | null>(null);
  const [copied,    setCopied]    = useState(false);
  const [filter,    setFilter]    = useState<"all" | "JSON-LD" | "Microdata" | "RDFa" | "errors" | "warnings" | "rich">("all");

  const TAB_OFF = { background: "rgba(255,255,255,0.03)", color: "#988d9f", border: "1px solid rgba(255,255,255,0.07)" } as React.CSSProperties;
  const TAB_ON  = { background: "rgba(249,115,22,0.12)", color: ACCENT, border: "1px solid rgba(249,115,22,0.3)" } as React.CSSProperties;

  const scoreColor = result
    ? result.seoScore >= 71 ? "#22c55e" : result.seoScore >= 41 ? "#f59e0b" : "#ef4444"
    : "#988d9f";
  const scoreLabel = result
    ? result.seoScore >= 71 ? "Healthy" : result.seoScore >= 41 ? "Needs work" : "Poor"
    : "";

  const displaySchemas = useMemo(() => {
    if (!result) return [];
    if (filter === "all")      return result.schemas;
    if (filter === "JSON-LD")  return result.schemas.filter(s => s.format === "JSON-LD");
    if (filter === "Microdata") return result.schemas.filter(s => s.format === "Microdata");
    if (filter === "RDFa")     return result.schemas.filter(s => s.format === "RDFa");
    if (filter === "errors")   return result.schemas.filter(s => s.validationStatus === "errors");
    if (filter === "warnings")  return result.schemas.filter(s => s.validationStatus === "warnings");
    if (filter === "rich")     return result.schemas.filter(s => s.isRichResultsEligible);
    return result.schemas;
  }, [result, filter]);

  const extract = useCallback(async () => {
    const trimmed = url.trim();
    if (!trimmed) { setError("Please enter a URL."); return; }
    setError(""); setResult(null); setLoading(true); setFilter("all");
    try {
      const res = await fetch(`/api/extract-schema?url=${encodeURIComponent(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`)}`);
      const data = await res.json() as SchemaExtractionResult & { error?: string };
      if (data.error) { setError(data.error); return; }
      setResult(data);
    } catch {
      setError("Network error — please try again.");
    } finally {
      setLoading(false);
    }
  }, [url]);

  const reset = useCallback(() => {
    setUrl(""); setResult(null); setError(""); setFilter("all");
  }, []);

  // ── Exports ───────────────────────────────────────────────────────────────
  const exportJson = useCallback(() => {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" });
    const u = URL.createObjectURL(blob);
    Object.assign(document.createElement("a"), { href: u, download: "schemas.json" }).click();
    URL.revokeObjectURL(u);
  }, [result]);

  const exportTxt = useCallback(() => {
    if (!result) return;
    const lines = [
      `Schema Extractor — ${result.finalUrl}`,
      `Analyzed: ${new Date(result.analyzedAt).toLocaleString()}`,
      `Score: ${result.seoScore}/100 | Total: ${result.totalSchemas} | JSON-LD: ${result.jsonLdCount} | Microdata: ${result.microdataCount} | RDFa: ${result.rdfaCount}`,
      "",
      "=== RECOMMENDATIONS ===",
      ...result.recommendations,
      "",
      "=== SCHEMAS ===",
      ...result.schemas.map((s, i) =>
        `\n[${i + 1}] ${s.format} — ${s.types.join(", ")} (${s.propertyCount} properties, ${s.validationStatus})\n${s.prettyJson}`),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const u = URL.createObjectURL(blob);
    Object.assign(document.createElement("a"), { href: u, download: "schemas.txt" }).click();
    URL.revokeObjectURL(u);
  }, [result]);

  const exportPdf = useCallback(() => {
    if (!result) return;
    const cards = result.schemas.map((s, i) => {
      const sc = STATUS_COLORS[s.validationStatus] ?? "#888";
      const fc = FORMAT_COLORS[s.format] ?? "#888";
      const issuesHtml = s.issues.map(iss => {
        const c = iss.level === "error" ? "#dc2626" : "#d97706";
        return `<li style="color:${c};font-size:10px">${iss.message}</li>`;
      }).join("");
      return `
        <div style="margin-bottom:20px;padding:12px;border:1px solid #ddd;border-radius:8px;page-break-inside:avoid">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
            <span style="background:${fc}18;color:${fc};font-size:10px;font-weight:700;padding:2px 8px;border-radius:4px">${s.format}</span>
            <b style="font-size:13px">${s.types.join(" · ")}</b>
            <span style="margin-left:auto;color:${sc};font-size:11px;font-weight:700">${s.validationStatus}</span>
          </div>
          <p style="font-size:10px;color:#666;margin-bottom:6px">${s.propertyCount} properties${s.isRichResultsEligible ? ` · Rich Results eligible (${s.richResultType})` : ""}</p>
          ${issuesHtml ? `<ul style="margin:4px 0 8px">${issuesHtml}</ul>` : ""}
          <pre style="background:#f5f5f5;padding:8px;border-radius:4px;font-size:9px;overflow:auto;max-height:200px">${s.prettyJson.replace(/</g,"&lt;").replace(/>/g,"&gt;")}</pre>
        </div>`;
    }).join("");

    const html = `<!DOCTYPE html><html><head><title>Schemas — ${result.finalUrl}</title>
<style>body{font-family:system-ui,sans-serif;max-width:900px;margin:2rem auto;color:#111;font-size:12px}
h1{font-size:18px}h2{font-size:13px;margin-top:18px;border-bottom:1px solid #ddd;padding-bottom:3px}
.score{font-size:34px;font-weight:900}.chips{display:flex;flex-wrap:wrap;gap:10px;margin:8px 0}
.chip{background:#f5f5f5;border-radius:6px;padding:4px 10px;font-size:11px}.chip b{display:block;font-size:15px}
ul li{margin-bottom:4px;font-size:11px}
</style></head><body>
<h1>Schema Extractor</h1>
<p style="color:#666;word-break:break-all">${result.finalUrl} — ${new Date(result.analyzedAt).toLocaleString()}</p>
<div class="score" style="color:${scoreColor}">${result.seoScore}<span style="font-size:14px;font-weight:400;color:#555"> / 100 — ${scoreLabel}</span></div>
<div class="chips">
<div class="chip"><b>${result.totalSchemas}</b>Total</div>
<div class="chip"><b style="color:#3b82f6">${result.jsonLdCount}</b>JSON-LD</div>
<div class="chip"><b style="color:#7c3aed">${result.microdataCount}</b>Microdata</div>
<div class="chip"><b style="color:#059669">${result.rdfaCount}</b>RDFa</div>
<div class="chip"><b style="color:#16a34a">${result.richResultsEligible}</b>Rich Results</div>
</div>
<h2>Recommendations</h2><ul>${result.recommendations.map(r => `<li>${r}</li>`).join("")}</ul>
<h2>Schemas (${result.totalSchemas})</h2>
${cards}
</body></html>`;
    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); w.print(); }
  }, [result, scoreColor, scoreLabel]);

  const copyAll = useCallback(async () => {
    if (!result) return;
    const text = result.schemas.map(s => s.prettyJson).join("\n\n---\n\n");
    try { await navigator.clipboard.writeText(text); } catch { /* blocked */ }
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  }, [result]);

  const inputCls = "rounded-xl px-3 py-2.5 text-[13px] outline-none transition-all bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] focus:border-[rgba(249,115,22,0.4)] text-[#e8dff0] placeholder-[#3d3345]";

  return (
    <div className="mb-12 flex flex-col gap-6">

      {/* ── Input ─────────────────────────────────────────────────── */}
      <div className="glass-panel rounded-2xl p-5 flex flex-col gap-4"
        style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
        <PanelHeader icon="data_object" title="Extract Structured Data" />
        <div className="flex gap-3 flex-wrap sm:flex-nowrap">
          <input type="url" value={url} onChange={e => setUrl(e.target.value)}
            onKeyDown={e => e.key === "Enter" && extract()}
            placeholder="https://example.com" aria-label="Website URL"
            className={`${inputCls} flex-1`} />
          <button onClick={extract} disabled={loading}
            className="btn-primary flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm shrink-0 disabled:opacity-60">
            <span className="material-symbols-outlined text-[15px]">{loading ? "hourglass_top" : "data_object"}</span>
            {loading ? "Extracting…" : "Extract Schemas"}
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
                <svg width="96" height="96" viewBox="0 0 96 96" aria-label={`Score ${result.seoScore} out of 100`}>
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
              {result.schemaTypes.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {result.schemaTypes.map(t => (
                    <span key={t} className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={{ background: "rgba(167,139,250,0.1)", color: "#a78bfa", border: "1px solid rgba(167,139,250,0.2)" }}>{t}</span>
                  ))}
                </div>
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
              <button onClick={copyAll}
                className="btn-primary flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm">
                <span className="material-symbols-outlined text-[14px]">{copied ? "check" : "content_copy"}</span>
                {copied ? "Copied!" : "Copy All JSON"}
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

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <StatCard icon="data_object"   label="Total Schemas"    value={result.totalSchemas}          color="#e8dff0" />
            <StatCard icon="code"          label="JSON-LD"          value={result.jsonLdCount}           color="#60a5fa" />
            <StatCard icon="layers"        label="Microdata"        value={result.microdataCount}        color="#a78bfa" />
            <StatCard icon="schema"        label="RDFa"             value={result.rdfaCount}             color="#34d399" />
            <StatCard icon="stars"         label="Rich Results"     value={result.richResultsEligible}   color={result.richResultsEligible > 0 ? "#22c55e" : "#988d9f"} />
          </div>

          {/* Empty page notice */}
          {result.totalSchemas === 0 && (
            <div className="glass-panel rounded-2xl p-8 flex flex-col items-center gap-3 text-center"
              style={{ border: "1px solid rgba(239,68,68,0.15)" }}>
              <span className="material-symbols-outlined text-[40px]" style={{ color: "#ef4444" }}>search_off</span>
              <p className="text-[14px] font-bold" style={{ color: "#e8dff0" }}>No structured data found</p>
              <p className="text-[12px] max-w-md" style={{ color: "#988d9f" }}>
                This page has no JSON-LD, Microdata or RDFa markup. Add structured data to become eligible for Google Rich Results.
              </p>
            </div>
          )}

          {/* Filter tabs + schema cards */}
          {result.totalSchemas > 0 && (
            <>
              <div className="flex flex-wrap gap-2">
                {([
                  ["all",       "All",      result.totalSchemas],
                  ["JSON-LD",   "JSON-LD",  result.jsonLdCount],
                  ["Microdata", "Microdata",result.microdataCount],
                  ["RDFa",      "RDFa",     result.rdfaCount],
                  ["errors",    "Errors",   result.schemas.filter(s => s.validationStatus === "errors").length],
                  ["warnings",  "Warnings", result.schemas.filter(s => s.validationStatus === "warnings").length],
                  ["rich",      "Rich Results", result.richResultsEligible],
                ] as [typeof filter, string, number][])
                  .filter(([, , c]) => c > 0 || _ === "all")
                  .map(([f, label, count]) => (
                    <button key={f} onClick={() => setFilter(f)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-semibold transition-all"
                      style={filter === f ? TAB_ON : TAB_OFF}>
                      {label}
                      {count > 0 && <span className="text-[10px] opacity-70">({count})</span>}
                    </button>
                  ))}
              </div>

              <div className="flex flex-col gap-4">
                {displaySchemas.map((schema, i) => (
                  <SchemaCard key={schema.id} schema={schema} defaultOpen={i === 0} />
                ))}
                {displaySchemas.length === 0 && (
                  <p className="text-center text-[12px] py-4" style={{ color: "#3d3345" }}>No schemas match this filter.</p>
                )}
              </div>
            </>
          )}

          <p className="text-center text-[11px]" style={{ color: "#3d3345" }}>
            Extracted {new Date(result.analyzedAt).toLocaleString()} — {result.finalUrl}
          </p>
        </>
      )}

      {/* ── Empty state ───────────────────────────────────────── */}
      {!result && !loading && (
        <div className="glass-panel rounded-2xl p-8 flex flex-col items-center gap-4 text-center"
          style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
          <span className="material-symbols-outlined text-[48px]" style={{ color: "#3d3345" }}>data_object</span>
          <p className="text-[14px] font-semibold" style={{ color: "#988d9f" }}>Enter a URL to extract all structured data</p>
          <p className="text-[12px] max-w-md" style={{ color: "#3d3345" }}>
            Detects JSON-LD, Microdata and RDFa, validates each schema against Google Rich Results requirements and displays pretty-printed JSON with syntax highlighting.
          </p>
          <div className="flex flex-wrap justify-center gap-2 mt-1">
            {["JSON-LD", "Microdata", "RDFa", "Validation", "Rich Results", "SEO Score"].map(f => (
              <span key={f} className="text-[11px] font-semibold px-3 py-1 rounded-full"
                style={{ background: "rgba(249,115,22,0.07)", color: "#988d9f", border: "1px solid rgba(249,115,22,0.15)" }}>{f}</span>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}

// Silence unused variable lint warning from filter expression
const _ = "all";
