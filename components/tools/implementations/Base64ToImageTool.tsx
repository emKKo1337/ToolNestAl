"use client";

/**
 * Base64 to Image
 *
 * Accepts:
 *   - Raw Base64 string (pasted or from .txt file)
 *   - Full Data URI  (data:{mime};base64,{b64})
 *   - .txt file drag & drop or upload
 *
 * Decodes via atob() → Uint8Array → Blob → Object URL.
 * Auto-detects image format from the Data URI prefix or Base64 magic bytes.
 * All processing is client-side.
 */

import { useState, useRef, useCallback } from "react";

// ── MIME detection from Base64 magic bytes ────────────────────────────────────
const MAGIC: [string, string][] = [
  ["/9j/",        "image/jpeg"    ],
  ["iVBORw0",     "image/png"     ],
  ["R0lGOD",      "image/gif"     ],
  ["UklGR",       "image/webp"    ],
  ["Qk",          "image/bmp"     ],
  ["AAABAA",      "image/x-icon"  ],
  ["PHN2Zy",      "image/svg+xml" ],  // <svg
  ["PD94bWwg",    "image/svg+xml" ],  // <?xml
  ["AAAAF",       "image/avif"    ],
];

function detectMime(b64: string): string {
  for (const [prefix, mime] of MAGIC) {
    if (b64.startsWith(prefix)) return mime;
  }
  return "image/png"; // safe fallback
}

// ── Parse any pasted string into {mime, base64} ───────────────────────────────
interface ParsedB64 { mime: string; base64: string }

function parseInput(raw: string): ParsedB64 | null {
  // Strip all whitespace (newlines, spaces) to get a clean string
  const clean = raw.trim().replace(/[\s\r\n]+/g, "");
  if (!clean) return null;

  // Data URI format: data:{mime};base64,{b64}
  const uriMatch = clean.match(/^data:([^;,]+);base64,([A-Za-z0-9+/]+=*)$/i);
  if (uriMatch) return { mime: uriMatch[1].toLowerCase(), base64: uriMatch[2] };

  // Raw Base64 (strip any "base64," prefix a user might paste)
  const stripped = clean.replace(/^base64,/i, "");
  if (/^[A-Za-z0-9+/]+=*$/.test(stripped) && stripped.length > 4) {
    return { mime: detectMime(stripped), base64: stripped };
  }

  return null;
}

// ── Decode Base64 → Blob ──────────────────────────────────────────────────────
function b64ToBlob(base64: string, mime: string): Blob {
  const bin   = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

// ── Get image dimensions from a URL ──────────────────────────────────────────
function getImgDims(url: string): Promise<{ w: number; h: number }> {
  return new Promise(res => {
    const img = new Image();
    img.onload  = () => res({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => res({ w: 0, h: 0 });
    img.src = url;
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtSize(b: number): string {
  if (b < 1024)        return `${b} B`;
  if (b < 1_048_576)   return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1_048_576).toFixed(2)} MB`;
}

function extForMime(mime: string): string {
  const map: Record<string, string> = {
    "image/jpeg":   "jpg",
    "image/png":    "png",
    "image/gif":    "gif",
    "image/webp":   "webp",
    "image/bmp":    "bmp",
    "image/avif":   "avif",
    "image/svg+xml":"svg",
    "image/x-icon": "ico",
    "image/vnd.microsoft.icon": "ico",
  };
  return map[mime] ?? "bin";
}

function labelForMime(mime: string): string {
  const map: Record<string, string> = {
    "image/jpeg":   "JPEG",
    "image/png":    "PNG",
    "image/gif":    "GIF",
    "image/webp":   "WebP",
    "image/bmp":    "BMP",
    "image/avif":   "AVIF",
    "image/svg+xml":"SVG",
    "image/x-icon": "ICO",
    "image/vnd.microsoft.icon": "ICO",
  };
  return map[mime] ?? mime;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ── Result state ──────────────────────────────────────────────────────────────
interface DecodeResult {
  previewUrl: string;
  blob:       Blob;
  mime:       string;
  base64:     string;
  width:      number;
  height:     number;
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function Base64ToImageTool() {
  const [inputText,  setInputText]  = useState("");
  const [result,     setResult]     = useState<DecodeResult | null>(null);
  const [error,      setError]      = useState<string | null>(null);
  const [converting, setConverting] = useState(false);
  const [copied,     setCopied]     = useState(false);
  const [dropActive, setDropActive] = useState(false);

  const fileInputRef    = useRef<HTMLInputElement>(null);
  const textareaRef     = useRef<HTMLTextAreaElement>(null);
  const prevPreviewUrl  = useRef("");

  // ── Convert ────────────────────────────────────────────────────────────────
  const convert = useCallback(async (raw?: string) => {
    const src = raw ?? inputText;
    if (!src.trim()) { setError("Please paste a Base64 string or Data URI first."); return; }

    setConverting(true);
    setError(null);

    // Revoke previous preview URL
    if (prevPreviewUrl.current) { URL.revokeObjectURL(prevPreviewUrl.current); prevPreviewUrl.current = ""; }

    try {
      const parsed = parseInput(src);
      if (!parsed) throw new Error("Could not recognise the input. Make sure it is a valid Base64 string or Data URI (data:image/…;base64,…).");

      let blob: Blob;
      try {
        blob = b64ToBlob(parsed.base64, parsed.mime);
      } catch {
        throw new Error("Decoding failed — the Base64 string appears to be corrupted or incomplete.");
      }

      if (blob.size === 0) throw new Error("Decoded image is empty. Check that the Base64 string is complete.");

      const url          = URL.createObjectURL(blob);
      prevPreviewUrl.current = url;
      const { w, h }     = await getImgDims(url);

      setResult({ previewUrl: url, blob, mime: parsed.mime, base64: parsed.base64, width: w, height: h });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Decoding failed.");
      setResult(null);
    } finally {
      setConverting(false);
    }
  }, [inputText]);

  // ── Load TXT file ──────────────────────────────────────────────────────────
  const loadTxtFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = e => {
      const text = e.target?.result as string;
      setInputText(text);
      convert(text);
    };
    reader.readAsText(file);
  }, [convert]);

  // ── Paste from clipboard ───────────────────────────────────────────────────
  const pasteClipboard = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      setInputText(text);
      await convert(text);
    } catch {
      textareaRef.current?.focus();
    }
  }, [convert]);

  // ── Copy Base64 ────────────────────────────────────────────────────────────
  const copyBase64 = useCallback(async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.base64);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch { /* ignore */ }
  }, [result]);

  // ── Download image ─────────────────────────────────────────────────────────
  const downloadImage = useCallback(() => {
    if (!result) return;
    const ext = extForMime(result.mime);
    downloadBlob(result.blob, `decoded-image.${ext}`);
  }, [result]);

  // ── Clear ─────────────────────────────────────────────────────────────────
  const clear = useCallback(() => {
    if (prevPreviewUrl.current) { URL.revokeObjectURL(prevPreviewUrl.current); prevPreviewUrl.current = ""; }
    setInputText("");
    setResult(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  // ── Drop handler (TXT file or raw text) ───────────────────────────────────
  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDropActive(false);
    const file = e.dataTransfer.files[0];
    if (file && (file.type === "text/plain" || file.name.endsWith(".txt"))) {
      loadTxtFile(file);
      return;
    }
    // Maybe they dropped text directly
    const text = e.dataTransfer.getData("text");
    if (text) { setInputText(text); convert(text); }
  }, [loadTxtFile, convert]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="mb-12 flex flex-col gap-5">

      {/* ── Input panel ──────────────────────────────────────────────────────── */}
      <div
        onDrop={onDrop}
        onDragOver={e => { e.preventDefault(); setDropActive(true); }}
        onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropActive(false); }}
        className="glass-panel rounded-2xl overflow-hidden transition-all duration-200"
        style={{
          border: `2px solid ${dropActive ? "#4cd7f6" : "rgba(255,255,255,0.08)"}`,
          background: dropActive ? "rgba(76,215,246,0.03)" : undefined,
        }}>

        {/* Textarea header */}
        <div className="flex items-center gap-2 px-4 py-3"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}>
          <span className="material-symbols-outlined text-[16px]" style={{ color: "#4cd7f6" }}>data_object</span>
          <span className="text-[12px] font-bold flex-1" style={{ color: "#e8dff0" }}>
            Base64 String or Data URI
          </span>
          {/* Action buttons */}
          <div className="flex gap-2">
            <button onClick={pasteClipboard}
              aria-label="Paste from clipboard"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold transition-all"
              style={{ background: "rgba(76,215,246,0.08)", color: "#4cd7f6", border: "1px solid rgba(76,215,246,0.2)" }}>
              <span className="material-symbols-outlined text-[13px]">content_paste</span>
              Paste
            </button>
            <button onClick={() => fileInputRef.current?.click()}
              aria-label="Upload a .txt file containing Base64"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold transition-all"
              style={{ background: "rgba(255,255,255,0.05)", color: "#988d9f", border: "1px solid rgba(255,255,255,0.08)" }}>
              <span className="material-symbols-outlined text-[13px]">upload_file</span>
              Upload TXT
            </button>
            {inputText && (
              <button onClick={clear}
                aria-label="Clear input"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold transition-all"
                style={{ background: "rgba(255,80,80,0.08)", color: "#ff8080", border: "1px solid rgba(255,80,80,0.15)" }}>
                <span className="material-symbols-outlined text-[13px]">close</span>
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={inputText}
          onChange={e => { setInputText(e.target.value); setError(null); }}
          onKeyDown={e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) convert(); }}
          placeholder={
            dropActive
              ? "Drop your .txt file here…"
              : "Paste a Base64 string or Data URI here\n\nExamples:\n  /9j/4AAQSkZJRgAB…  (raw JPEG)\n  data:image/png;base64,iVBORw0KGgo…  (Data URI)\n\nCtrl+Enter to convert · Or drag & drop a .txt file"
          }
          aria-label="Base64 input"
          className="w-full resize-none font-mono text-[12px] leading-relaxed outline-none"
          style={{
            minHeight: 200,
            padding: "16px 20px",
            background: "transparent",
            color: "#c8d3f5",
            border: "none",
            lineHeight: 1.6,
          }}
          spellCheck={false}
          autoComplete="off"
          autoCorrect="off"
        />

        {/* Footer: char count + convert */}
        <div className="flex items-center gap-3 px-4 py-3"
          style={{ borderTop: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.01)" }}>
          <span className="text-[11px] tabular-nums" style={{ color: "#4d4354" }}>
            {inputText.replace(/\s/g, "").length.toLocaleString()} chars
          </span>
          <div className="flex-1" />
          <button onClick={() => convert()} disabled={converting || !inputText.trim()}
            className="btn-primary flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Decode Base64 to image">
            {converting ? (
              <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Decoding…</>
            ) : (
              <><span className="material-symbols-outlined text-[16px]">image_search</span>Convert to Image</>
            )}
          </button>
        </div>
      </div>

      {/* ── Error message ─────────────────────────────────────────────────────── */}
      {error && (
        <div role="alert" className="flex items-start gap-3 p-4 rounded-2xl"
          style={{ background: "rgba(255,100,100,0.08)", border: "1px solid rgba(255,100,100,0.22)" }}>
          <span className="material-symbols-outlined text-[18px] text-red-400 mt-0.5 shrink-0">error</span>
          <div className="flex-1">
            <p className="text-[13px] font-semibold" style={{ color: "#ff8080" }}>Invalid input</p>
            <p className="text-[12px] mt-0.5 leading-relaxed" style={{ color: "#7a3838" }}>{error}</p>
          </div>
          <button onClick={() => setError(null)} aria-label="Dismiss error"
            className="opacity-60 hover:opacity-100 transition-opacity">
            <span className="material-symbols-outlined text-[15px]" style={{ color: "#ff8080" }}>close</span>
          </button>
        </div>
      )}

      {/* ── Result ───────────────────────────────────────────────────────────── */}
      {result && (
        <>
          {/* Stats bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "File Type",  value: labelForMime(result.mime),     icon: "image",        accent: true  },
              { label: "Dimensions", value: result.width ? `${result.width} × ${result.height} px` : "—", icon: "aspect_ratio", accent: false },
              { label: "File Size",  value: fmtSize(result.blob.size),     icon: "data_usage",   accent: false },
              { label: "Base64 Length", value: result.base64.length.toLocaleString() + " chars", icon: "data_object", accent: false },
            ].map(({ label, value, icon, accent }) => (
              <div key={label} className="glass-panel rounded-2xl p-4 flex flex-col gap-1.5"
                style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
                <span className="material-symbols-outlined text-[16px]" style={{ color: accent ? "#4cd7f6" : "#988d9f" }}>
                  {icon}
                </span>
                <p className="text-[15px] font-bold leading-tight" style={{ color: accent ? "#4cd7f6" : "#e8dff0" }}>
                  {value}
                </p>
                <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "#988d9f" }}>{label}</p>
              </div>
            ))}
          </div>

          {/* Preview + actions */}
          <div className="flex flex-col lg:flex-row gap-4">

            {/* Image preview */}
            <div className="flex-1 glass-panel rounded-2xl overflow-hidden min-w-0"
              style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
              <div className="px-4 py-2.5 flex items-center gap-2"
                style={{ borderBottom: "1px solid rgba(255,255,255,0.05)", background: "rgba(255,255,255,0.02)" }}>
                <span className="material-symbols-outlined text-[15px] text-green-400">check_circle</span>
                <span className="text-[12px] font-semibold" style={{ color: "#80e0a0" }}>
                  Decoded successfully — {labelForMime(result.mime)}
                  {result.width ? ` · ${result.width}×${result.height}` : ""}
                </span>
              </div>
              {/* Checkerboard for transparency */}
              <div className="p-4 flex items-center justify-center"
                style={{
                  minHeight: 200,
                  backgroundImage: "linear-gradient(45deg,#2a2a3a 25%,transparent 25%),linear-gradient(-45deg,#2a2a3a 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#2a2a3a 75%),linear-gradient(-45deg,transparent 75%,#2a2a3a 75%)",
                  backgroundSize: "16px 16px",
                  backgroundPosition: "0 0,0 8px,8px -8px,-8px 0",
                  backgroundColor: "#1a1a2e",
                }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={result.previewUrl} alt="Decoded image"
                  className="max-w-full max-h-96 object-contain rounded-lg shadow-2xl"
                  draggable={false} />
              </div>
            </div>

            {/* Action panel */}
            <div className="lg:w-60 shrink-0 flex flex-col gap-3">

              {/* Download */}
              <button onClick={downloadImage}
                className="btn-primary flex items-center justify-center gap-2 py-4 rounded-2xl font-bold text-sm">
                <span className="material-symbols-outlined text-[18px]">download</span>
                Download {labelForMime(result.mime)}
              </button>

              {/* Copy Base64 */}
              <button onClick={copyBase64}
                className="flex items-center justify-center gap-2 py-3.5 rounded-2xl font-semibold text-sm transition-all"
                style={{
                  background: copied ? "rgba(100,220,150,0.12)" : "rgba(76,215,246,0.08)",
                  color:      copied ? "#80e0a0"               : "#4cd7f6",
                  border:     `1px solid ${copied ? "rgba(100,220,150,0.3)" : "rgba(76,215,246,0.2)"}`,
                }}>
                <span className="material-symbols-outlined text-[16px]">
                  {copied ? "check" : "content_copy"}
                </span>
                {copied ? "Copied!" : "Copy Base64"}
              </button>

              {/* Try another */}
              <button onClick={clear}
                className="flex items-center justify-center gap-2 py-3.5 rounded-2xl font-semibold text-sm transition-all"
                style={{ background: "rgba(255,255,255,0.04)", color: "#988d9f", border: "1px solid rgba(255,255,255,0.08)" }}>
                <span className="material-symbols-outlined text-[16px]">restart_alt</span>
                Try Another
              </button>

              {/* Info card */}
              <div className="glass-panel rounded-2xl p-4 flex flex-col gap-2 mt-1"
                style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
                <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "#988d9f" }}>Details</p>
                {[
                  { label: "MIME",  value: result.mime },
                  { label: "Ext",   value: `.${extForMime(result.mime)}` },
                  { label: "Size",  value: fmtSize(result.blob.size) },
                  ...(result.width ? [{ label: "W × H", value: `${result.width} × ${result.height}` }] : []),
                ].map(({ label, value }) => (
                  <div key={label} className="flex items-start gap-2 py-1"
                    style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                    <span className="text-[10px] font-bold uppercase tracking-wide w-10 shrink-0 pt-0.5"
                      style={{ color: "#3d3345" }}>{label}</span>
                    <span className="text-[11px] font-mono font-semibold break-all" style={{ color: "#e8dff0" }}>{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── How it works (empty state) ───────────────────────────────────────── */}
      {!result && !error && !inputText && (
        <div className="glass-panel rounded-2xl p-6 flex flex-col gap-4"
          style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
          <p className="text-[12px] font-semibold text-[#988d9f] uppercase tracking-[0.08em]">Accepted input formats</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              {
                icon: "data_object",
                label: "Raw Base64",
                desc: "/9j/4AAQSkZJRgAB…  (auto-detects JPG, PNG, WebP, GIF, BMP, AVIF, SVG, ICO)",
              },
              {
                icon: "link",
                label: "Data URI",
                desc: "data:image/png;base64,iVBORw0KGgo…  (MIME type read from prefix)",
              },
              {
                icon: "upload_file",
                label: ".txt File",
                desc: "Drag & drop or upload any .txt file containing a Base64 string or Data URI",
              },
            ].map(({ icon, label, desc }) => (
              <div key={label} className="flex flex-col gap-2 p-4 rounded-xl"
                style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
                <span className="material-symbols-outlined text-[20px]" style={{ color: "#4cd7f6" }}>{icon}</span>
                <p className="text-[13px] font-bold" style={{ color: "#e2e2e2" }}>{label}</p>
                <p className="text-[11px] leading-relaxed font-mono" style={{ color: "#5a4d63" }}>{desc}</p>
              </div>
            ))}
          </div>
          <p className="text-[11px] font-medium text-center" style={{ color: "#3d3345" }}>
            Press <kbd className="px-1.5 py-0.5 rounded text-[10px] font-mono"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#988d9f" }}>
              Ctrl+Enter
            </kbd> to convert after pasting
          </p>
        </div>
      )}

      {/* Hidden TXT file input */}
      <input ref={fileInputRef} type="file" accept=".txt,text/plain" className="sr-only"
        onChange={e => { const f = e.target.files?.[0]; if (f) loadTxtFile(f); e.target.value = ""; }}
        aria-hidden tabIndex={-1} />
    </div>
  );
}
