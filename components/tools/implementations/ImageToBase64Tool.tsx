"use client";

/**
 * Image to Base64
 *
 * Encodes any image to Base64 using the browser's FileReader API.
 * No canvas, no server — pure FileReader.readAsDataURL().
 *
 * Outputs:
 *   1. Raw Base64 string
 *   2. Data URI  (data:{mime};base64,{b64})
 *   3. HTML <img> tag
 *   4. CSS background-image declaration
 *   5. Markdown image syntax
 *
 * Large-image strategy: full strings stored in state but only a
 * configurable PREVIEW_CHARS slice is rendered in the DOM to keep
 * the browser responsive. Copy / Download always uses the full value.
 */

import { useState, useRef, useCallback, useMemo } from "react";

// ── Constants ─────────────────────────────────────────────────────────────────
const PREVIEW_CHARS = 512; // chars shown in the code box
const ACCEPTED_EXT  = ".jpg,.jpeg,.png,.webp,.gif,.bmp,.tiff,.tif,.avif,.svg";

// ── Types ─────────────────────────────────────────────────────────────────────
interface B64Result {
  dataUri:      string;
  base64:       string;
  mime:         string;
  fileName:     string;
  originalSize: number;
  base64Len:    number;
  sizeIncrease: number; // percent
  width:        number;
  height:       number;
}

interface OutputDef {
  key:         string;
  label:       string;
  icon:        string;
  getValue:    (r: B64Result) => string;
  syntax:      string; // language hint for visual styling
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtSize(b: number): string {
  if (b < 1024)        return `${b} B`;
  if (b < 1_048_576)   return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1_048_576).toFixed(2)} MB`;
}

function baseName(name: string) { return name.replace(/\.[^.]+$/, ""); }

function loadImgDimensions(dataUri: string): Promise<{ w: number; h: number }> {
  return new Promise(res => {
    const img = new Image();
    img.onload  = () => res({ w: img.naturalWidth,  h: img.naturalHeight });
    img.onerror = () => res({ w: 0, h: 0 });
    img.src = dataUri;
  });
}

function downloadText(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/plain" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ── Encode ────────────────────────────────────────────────────────────────────
function encodeFile(file: File): Promise<B64Result> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async e => {
      try {
        const dataUri = e.target?.result as string;
        const comma   = dataUri.indexOf(",");
        const header  = dataUri.slice(0, comma);
        const base64  = dataUri.slice(comma + 1);
        const mime    = header.match(/:(.*?);/)?.[1] ?? file.type;

        const { w, h } = await loadImgDimensions(dataUri);

        resolve({
          dataUri,
          base64,
          mime,
          fileName:     file.name,
          originalSize: file.size,
          base64Len:    base64.length,
          sizeIncrease: Math.round(((base64.length / file.size) - 1) * 100),
          width:  w,
          height: h,
        });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

// ── Output definitions ────────────────────────────────────────────────────────
const OUTPUTS: OutputDef[] = [
  {
    key:      "base64",
    label:    "Base64 String",
    icon:     "data_object",
    syntax:   "text",
    getValue: r => r.base64,
  },
  {
    key:      "datauri",
    label:    "Data URI",
    icon:     "link",
    syntax:   "text",
    getValue: r => r.dataUri,
  },
  {
    key:      "html",
    label:    "HTML <img> Tag",
    icon:     "code",
    syntax:   "html",
    getValue: r => {
      const dim = r.width ? ` width="${r.width}" height="${r.height}"` : "";
      return `<img src="${r.dataUri}" alt="${baseName(r.fileName)}"${dim} />`;
    },
  },
  {
    key:      "css",
    label:    "CSS background-image",
    icon:     "palette",
    syntax:   "css",
    getValue: r =>
      `.element {\n  background-image: url('${r.dataUri}');\n  background-size: cover;\n}`,
  },
  {
    key:      "markdown",
    label:    "Markdown Image",
    icon:     "article",
    syntax:   "markdown",
    getValue: r => `![${baseName(r.fileName)}](${r.dataUri})`,
  },
];

// ── Component ─────────────────────────────────────────────────────────────────
export default function ImageToBase64Tool() {
  const [result,      setResult]      = useState<B64Result | null>(null);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [dropActive,  setDropActive]  = useState(false);
  const [copied,      setCopied]      = useState<string | null>(null);
  const [expanded,    setExpanded]    = useState<Set<string>>(new Set());

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Load file ─────────────────────────────────────────────────────────────
  const loadFile = useCallback(async (file: File) => {
    setLoading(true);
    setError(null);
    setResult(null);
    setExpanded(new Set());
    try {
      const r = await encodeFile(file);
      setResult(r);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Encoding failed.");
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Copy ──────────────────────────────────────────────────────────────────
  const copyValue = useCallback(async (value: string, key: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      setTimeout(() => setCopied(null), 2200);
    } catch { /* ignore */ }
  }, []);

  // ── Download TXT ──────────────────────────────────────────────────────────
  const downloadAll = useCallback(() => {
    if (!result) return;
    const lines = OUTPUTS.map(o =>
      `=== ${o.label} ===\n${o.getValue(result)}`,
    ).join("\n\n");
    downloadText(lines, `${baseName(result.fileName)}-base64.txt`);
  }, [result]);

  // ── Clear ─────────────────────────────────────────────────────────────────
  const clear = useCallback(() => {
    setResult(null);
    setError(null);
    setExpanded(new Set());
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  // ── Toggle expanded ───────────────────────────────────────────────────────
  const toggleExpanded = useCallback((key: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }, []);

  // ── Computed output values (memoised) ─────────────────────────────────────
  const outputValues = useMemo(() => {
    if (!result) return {};
    return Object.fromEntries(OUTPUTS.map(o => [o.key, o.getValue(result)]));
  }, [result]);

  // ── Render: drop zone ─────────────────────────────────────────────────────
  if (!result && !loading) {
    return (
      <div className="mb-12 flex flex-col gap-6">
        {/* Drop zone */}
        <div
          onDrop={e => { e.preventDefault(); setDropActive(false); const f = e.dataTransfer.files[0]; if (f) loadFile(f); }}
          onDragOver={e => { e.preventDefault(); setDropActive(true); }}
          onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropActive(false); }}
          onClick={() => fileInputRef.current?.click()}
          role="button" tabIndex={0} aria-label="Upload image to encode as Base64"
          onKeyDown={e => { if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click(); }}
          className="glass-panel rounded-2xl flex flex-col items-center justify-center gap-4 cursor-pointer transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-[#4cd7f6]"
          style={{
            padding: "60px 40px",
            border: `2px dashed ${dropActive ? "#4cd7f6" : "rgba(255,255,255,0.12)"}`,
            background: dropActive ? "rgba(76,215,246,0.04)" : undefined,
          }}>
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 transition-transform duration-200"
            style={{ background: "rgba(76,215,246,0.1)", transform: dropActive ? "scale(1.08)" : "scale(1)" }}>
            <span className="material-symbols-outlined text-[32px]" style={{ color: "#4cd7f6" }}>
              {dropActive ? "file_download" : "code"}
            </span>
          </div>
          <div className="text-center">
            <p className="font-semibold text-base" style={{ color: "#e8dff0" }}>
              {dropActive ? "Drop image here" : "Drag & drop an image here"}
            </p>
            <p className="text-sm mt-1" style={{ color: "#988d9f" }}>
              or <span style={{ color: "#4cd7f6" }}>click to browse</span>
              {" "}— JPG, PNG, WebP, GIF, BMP, AVIF, SVG · any size
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-2 mt-1">
            {["Base64","Data URI","HTML img","CSS bg","Markdown","Browser-local"].map(tag => (
              <span key={tag} className="px-2.5 py-1 rounded-lg text-[11px] font-semibold"
                style={{ background: "rgba(76,215,246,0.08)", color: "#4cd7f6", border: "1px solid rgba(76,215,246,0.15)" }}>
                {tag}
              </span>
            ))}
          </div>
          <input ref={fileInputRef} type="file" accept={ACCEPTED_EXT} className="sr-only"
            onChange={e => { const f = e.target.files?.[0]; if (f) loadFile(f); e.target.value = ""; }}
            aria-hidden tabIndex={-1} />
        </div>

        {/* Use-cases */}
        <div className="glass-panel rounded-2xl p-6 flex flex-col gap-4"
          style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
          <p className="text-[12px] font-semibold text-[#988d9f] uppercase tracking-[0.08em]">Common use cases</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { icon: "code",        label: "Inline HTML / CSS", desc: "Embed images without extra HTTP requests" },
              { icon: "api",         label: "API payloads",      desc: "Send images inside JSON without a CDN" },
              { icon: "email",       label: "Email templates",   desc: "Portable images that travel with the email" },
            ].map(({ icon, label, desc }) => (
              <div key={label} className="flex flex-col gap-1.5 p-4 rounded-xl"
                style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
                <span className="material-symbols-outlined text-[20px]" style={{ color: "#4cd7f6" }}>{icon}</span>
                <p className="text-[13px] font-bold" style={{ color: "#e2e2e2" }}>{label}</p>
                <p className="text-[12px] leading-relaxed" style={{ color: "#5a4d63" }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── Render: loading ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="mb-12 flex items-center justify-center py-32">
        <div className="flex flex-col items-center gap-4">
          <span className="w-10 h-10 border-2 border-[#4cd7f6]/30 border-t-[#4cd7f6] rounded-full animate-spin" />
          <p className="text-[13px] font-semibold" style={{ color: "#988d9f" }}>Encoding image…</p>
        </div>
      </div>
    );
  }

  // ── Render: error ─────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="mb-12 flex flex-col gap-4">
        <div className="glass-panel rounded-2xl p-6 flex flex-col items-center gap-3 text-center"
          style={{ border: "1px solid rgba(255,100,100,0.2)" }}>
          <span className="material-symbols-outlined text-[28px] text-red-400">error</span>
          <p className="font-semibold" style={{ color: "#ff8080" }}>Encoding failed</p>
          <p className="text-[12px]" style={{ color: "#5a4d63" }}>{error}</p>
          <button onClick={clear} className="btn-primary px-6 py-2.5 rounded-xl font-semibold text-sm mt-2">
            Try Another File
          </button>
        </div>
      </div>
    );
  }

  if (!result) return null;

  // ── Render: results ───────────────────────────────────────────────────────
  return (
    <div className="mb-12 flex flex-col gap-5">

      {/* ── Top bar ──────────────────────────────────────────────────────────── */}
      <div className="glass-panel rounded-2xl px-4 py-3 flex items-center gap-3 flex-wrap"
        style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
        {/* Thumbnail */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={result.dataUri} alt={result.fileName}
          className="w-10 h-10 rounded-xl object-cover border border-white/10 shrink-0"
          draggable={false} />
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold truncate" style={{ color: "#e8dff0" }}>{result.fileName}</p>
          <p className="text-[11px]" style={{ color: "#5a4d63" }}>
            {result.mime} · {result.width > 0 ? `${result.width}×${result.height} px · ` : ""}
            {fmtSize(result.originalSize)} original
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <button onClick={downloadAll}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold transition-all"
            style={{ background: "rgba(76,215,246,0.08)", color: "#4cd7f6", border: "1px solid rgba(76,215,246,0.2)" }}>
            <span className="material-symbols-outlined text-[14px]">download</span>
            Download TXT
          </button>
          <button onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold transition-all"
            style={{ background: "rgba(255,255,255,0.05)", color: "#988d9f", border: "1px solid rgba(255,255,255,0.08)" }}>
            <span className="material-symbols-outlined text-[14px]">upload_file</span>
            New Image
          </button>
          <button onClick={clear}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold transition-all"
            style={{ background: "rgba(255,80,80,0.08)", color: "#ff8080", border: "1px solid rgba(255,80,80,0.15)" }}>
            <span className="material-symbols-outlined text-[14px]">close</span>
            Clear
          </button>
        </div>
      </div>

      {/* ── Stats cards ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Original Size",   value: fmtSize(result.originalSize),                icon: "image",        accent: false },
          { label: "Base64 Length",   value: result.base64Len.toLocaleString() + " chars", icon: "data_object",  accent: false },
          { label: "Encoded Size",    value: fmtSize(result.base64Len),                    icon: "expand",       accent: false },
          { label: "Size Increase",   value: `+${result.sizeIncrease}%`,                   icon: "trending_up",  accent: true  },
        ].map(({ label, value, icon, accent }) => (
          <div key={label} className="glass-panel rounded-2xl p-4 flex flex-col gap-1.5"
            style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
            <span className="material-symbols-outlined text-[16px]" style={{ color: accent ? "#ffaa60" : "#4cd7f6" }}>
              {icon}
            </span>
            <p className="text-[15px] font-bold tabular-nums leading-tight" style={{ color: accent ? "#ffaa60" : "#e8dff0" }}>
              {value}
            </p>
            <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "#988d9f" }}>{label}</p>
          </div>
        ))}
      </div>

      {/* ── Output sections ───────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3">
        {OUTPUTS.map(output => {
          const fullValue   = outputValues[output.key] ?? "";
          const isLong      = fullValue.length > PREVIEW_CHARS;
          const isExpanded  = expanded.has(output.key);
          const displayText = isLong && !isExpanded
            ? fullValue.slice(0, PREVIEW_CHARS) + "…"
            : fullValue;
          const isCopied    = copied === output.key;

          return (
            <div key={output.key} className="glass-panel rounded-2xl overflow-hidden"
              style={{ border: "1px solid rgba(255,255,255,0.06)" }}>

              {/* Section header */}
              <div className="flex items-center gap-2.5 px-5 py-3.5"
                style={{ borderBottom: "1px solid rgba(255,255,255,0.05)", background: "rgba(255,255,255,0.02)" }}>
                <span className="material-symbols-outlined text-[17px]" style={{ color: "#4cd7f6" }}>
                  {output.icon}
                </span>
                <span className="text-[13px] font-bold flex-1" style={{ color: "#e8dff0" }}>{output.label}</span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-lg mr-2"
                  style={{ background: "rgba(76,215,246,0.08)", color: "#4cd7f6", border: "1px solid rgba(76,215,246,0.15)" }}>
                  {fullValue.length.toLocaleString()} chars
                </span>

                {/* Copy button */}
                <button onClick={() => copyValue(fullValue, output.key)}
                  aria-label={`Copy ${output.label}`}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold transition-all"
                  style={{
                    background: isCopied ? "rgba(100,220,150,0.12)" : "rgba(76,215,246,0.08)",
                    color:      isCopied ? "#80e0a0"               : "#4cd7f6",
                    border:     `1px solid ${isCopied ? "rgba(100,220,150,0.3)" : "rgba(76,215,246,0.2)"}`,
                  }}>
                  <span className="material-symbols-outlined text-[13px]">
                    {isCopied ? "check" : "content_copy"}
                  </span>
                  {isCopied ? "Copied!" : "Copy"}
                </button>
              </div>

              {/* Code area */}
              <div className="relative">
                <pre
                  className="px-5 py-4 text-[11.5px] font-mono leading-relaxed overflow-x-auto select-all"
                  style={{
                    color:           "#c8d3f5",
                    background:      "rgba(0,0,0,0.25)",
                    maxHeight:       isExpanded ? "none" : "140px",
                    overflowY:       isExpanded ? "visible" : "hidden",
                    wordBreak:       "break-all",
                    whiteSpace:      "pre-wrap",
                    userSelect:      "text",
                  }}
                  aria-label={`${output.label} output`}>
                  {displayText}
                </pre>

                {/* Expand / collapse */}
                {isLong && (
                  <div className="flex justify-center py-2"
                    style={{
                      background: isExpanded
                        ? undefined
                        : "linear-gradient(to bottom, transparent, rgba(13,13,19,0.97))",
                      marginTop: isExpanded ? 0 : "-48px",
                      position:  isExpanded ? "static" : "relative",
                    }}>
                    <button onClick={() => toggleExpanded(output.key)}
                      className="flex items-center gap-1 px-4 py-1.5 rounded-full text-[11px] font-semibold transition-all"
                      style={{
                        background: "rgba(76,215,246,0.1)",
                        color: "#4cd7f6",
                        border: "1px solid rgba(76,215,246,0.2)",
                      }}>
                      <span className="material-symbols-outlined text-[13px]">
                        {isExpanded ? "expand_less" : "expand_more"}
                      </span>
                      {isExpanded
                        ? "Collapse"
                        : `Show all ${fullValue.length.toLocaleString()} characters`}
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Quick copy grid ───────────────────────────────────────────────────── */}
      <div className="glass-panel rounded-2xl p-5 flex flex-col gap-3"
        style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
        <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "#988d9f" }}>
          Quick Copy
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {OUTPUTS.map(output => {
            const key      = `qc-${output.key}`;
            const isCopied = copied === key;
            return (
              <button key={key}
                onClick={() => copyValue(outputValues[output.key] ?? "", key)}
                aria-label={`Copy ${output.label}`}
                className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[11px] font-bold transition-all"
                style={{
                  background: isCopied ? "rgba(100,220,150,0.12)" : "rgba(255,255,255,0.04)",
                  color:      isCopied ? "#80e0a0"               : "#988d9f",
                  border:     `1px solid ${isCopied ? "rgba(100,220,150,0.3)" : "rgba(255,255,255,0.08)"}`,
                }}>
                <span className="material-symbols-outlined text-[13px]">
                  {isCopied ? "check" : output.icon}
                </span>
                {isCopied ? "Copied!" : output.label.split(" ")[0]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Hidden file input */}
      <input ref={fileInputRef} type="file" accept={ACCEPTED_EXT} className="sr-only"
        onChange={e => { const f = e.target.files?.[0]; if (f) loadFile(f); e.target.value = ""; }}
        aria-hidden tabIndex={-1} />
    </div>
  );
}
