"use client";

import { useState, useRef, useCallback, useEffect, useId } from "react";

// ─── Constants ────────────────────────────────────────────────────────────────
const MAX_FILE_BYTES = 50 * 1024 * 1024;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];
const ACCEPTED_EXT   = ".jpg,.jpeg,.png,.webp,.avif";

// ─── Types ────────────────────────────────────────────────────────────────────
type OutputFormat = "webp" | "jpg" | "png";
type NotifType    = "success" | "error" | "info";

const FORMAT_MIME: Record<OutputFormat, string> = {
  webp: "image/webp",
  jpg:  "image/jpeg",
  png:  "image/png",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatBytes(bytes: number): string {
  if (bytes < 1024)      return `${bytes} B`;
  if (bytes < 1_048_576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1_048_576).toFixed(2)} MB`;
}

function baseName(name: string): string { return name.replace(/\.[^.]+$/, ""); }

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function mimeLabel(mime: string): string {
  const map: Record<string, string> = {
    "image/jpeg": "JPG",
    "image/png":  "PNG",
    "image/webp": "WebP",
    "image/avif": "AVIF",
  };
  return map[mime] ?? mime.split("/")[1].toUpperCase();
}

/** Returns the natural output format for the given input. */
function defaultOutput(inputMime: string): OutputFormat {
  // Non-WebP → WebP is the primary use-case
  // WebP → JPG is the sensible default when converting away from WebP
  return inputMime === "image/webp" ? "jpg" : "webp";
}

/** Available target formats for an input type. */
function availableOutputs(inputMime: string): OutputFormat[] {
  if (inputMime === "image/webp") return ["jpg", "png"];
  return ["webp"]; // JPG / PNG / AVIF all go to WebP
}

async function convertImage(
  srcUrl:   string,
  output:   OutputFormat,
  quality:  number,
  lossless: boolean,
): Promise<Blob> {
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const i  = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = srcUrl;
  });

  const canvas = document.createElement("canvas");
  canvas.width  = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx     = canvas.getContext("2d")!;

  // JPG has no alpha — fill white background to avoid transparency artefacts
  if (output === "jpg") {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  ctx.drawImage(img, 0, 0);

  const mime = FORMAT_MIME[output];
  // PNG is always lossless; for WebP lossless we still use quality=1.0
  const q = (output === "png" || lossless) ? undefined : quality / 100;

  return new Promise<Blob>((res, rej) => {
    canvas.toBlob(
      (blob) => blob ? res(blob) : rej(new Error("Conversion failed")),
      mime,
      q,
    );
  });
}

// ─── Sub-component: Chip ──────────────────────────────────────────────────────
function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} aria-pressed={active}
      className="px-3.5 py-2 rounded-xl text-[13px] font-semibold transition-all duration-200"
      style={{
        background: active ? "rgba(76,215,246,0.15)"  : "rgba(255,255,255,0.04)",
        color:      active ? "#4cd7f6"                : "#988d9f",
        border:     `1px solid ${active ? "rgba(76,215,246,0.35)" : "rgba(255,255,255,0.08)"}`,
      }}>
      {children}
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function WebpConverterTool() {
  const uid = useId();

  const [original,    setOriginal]    = useState<{ file: File; url: string; w: number; h: number } | null>(null);
  const [resultBlob,  setResultBlob]  = useState<Blob | null>(null);
  const [resultUrl,   setResultUrl]   = useState<string | null>(null);

  // Settings
  const [output,    setOutput]    = useState<OutputFormat>("webp");
  const [quality,   setQuality]   = useState(85);
  const [lossless,  setLossless]  = useState(false);

  // UI
  const [draggingOver, setDraggingOver] = useState(false);
  const [converting,   setConverting]   = useState(false);
  const [notif,        setNotif]        = useState<{ type: NotifType; message: string } | null>(null);

  const dropRef  = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const notify = useCallback((type: NotifType, msg: string) => {
    setNotif({ type, message: msg });
    if (type !== "info") setTimeout(() => setNotif(null), 8000);
  }, []);

  // ── File loading ──────────────────────────────────────────────────────────
  const loadFile = useCallback(async (file: File) => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      notify("error", `"${file.name}" is not supported. Upload a JPG, PNG, WebP, or AVIF image.`);
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      notify("error", `"${file.name}" exceeds the 50 MB limit.`);
      return;
    }

    if (original?.url) URL.revokeObjectURL(original.url);
    if (resultUrl)     URL.revokeObjectURL(resultUrl);

    const url = URL.createObjectURL(file);
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i  = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = url;
    }).catch(() => null);

    if (!img) { notify("error", "Could not read this image."); URL.revokeObjectURL(url); return; }

    const def = defaultOutput(file.type);
    setOriginal({ file, url, w: img.naturalWidth, h: img.naturalHeight });
    setOutput(def);
    setResultBlob(null);
    setResultUrl(null);
    setNotif(null);
  }, [original, resultUrl, notify]);

  // ── Drop zone ─────────────────────────────────────────────────────────────
  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDraggingOver(false);
    const f = e.dataTransfer.files[0]; if (f) loadFile(f);
  }, [loadFile]);

  const onDragOver  = useCallback((e: React.DragEvent) => { e.preventDefault(); setDraggingOver(true); }, []);
  const onDragLeave = useCallback((e: React.DragEvent) => {
    if (dropRef.current && !dropRef.current.contains(e.relatedTarget as Node)) setDraggingOver(false);
  }, []);

  // ── Convert ───────────────────────────────────────────────────────────────
  const convert = useCallback(async () => {
    if (!original) return;
    setConverting(true);
    setNotif(null);
    if (resultUrl) URL.revokeObjectURL(resultUrl);
    setResultBlob(null);
    setResultUrl(null);

    try {
      const blob = await convertImage(original.url, output, quality, lossless);
      const url  = URL.createObjectURL(blob);
      setResultBlob(blob);
      setResultUrl(url);

      const saved    = Math.max(0, original.file.size - blob.size);
      const savedPct = Math.round((saved / original.file.size) * 100);
      const outLabel = output.toUpperCase();
      if (saved > 0) {
        notify("success", `Converted to ${outLabel} — saved ${savedPct}% (${formatBytes(saved)}).`);
      } else {
        notify("success", `Converted to ${outLabel} — ${formatBytes(blob.size)}.`);
      }
    } catch (err) {
      notify("error", err instanceof Error ? err.message : "Conversion failed.");
    } finally {
      setConverting(false);
    }
  }, [original, output, quality, lossless, resultUrl, notify]);

  // Auto-convert when file loads
  useEffect(() => {
    if (!original || resultBlob || converting) return;
    async function run() { await convert(); }
    run();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [original]);

  // ── Download ──────────────────────────────────────────────────────────────
  const download = useCallback(() => {
    if (!resultBlob || !original) return;
    downloadBlob(resultBlob, `${baseName(original.file.name)}.${output}`);
  }, [resultBlob, original, output]);

  // ── Reset ─────────────────────────────────────────────────────────────────
  const reset = useCallback(() => {
    if (original?.url) URL.revokeObjectURL(original.url);
    if (resultUrl)     URL.revokeObjectURL(resultUrl);
    setOriginal(null);
    setResultBlob(null);
    setResultUrl(null);
    setConverting(false);
    setNotif(null);
    if (inputRef.current) inputRef.current.value = "";
  }, [original, resultUrl]);

  useEffect(() => () => {
    if (original?.url) URL.revokeObjectURL(original.url);
    if (resultUrl)     URL.revokeObjectURL(resultUrl);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Derived ──────────────────────────────────────────────────────────────
  const srcLabel     = original ? mimeLabel(original.file.type) : "";
  const dstLabel     = output.toUpperCase();
  const outputs      = original ? availableOutputs(original.file.type) : (["webp"] as OutputFormat[]);
  const savedBytes   = original && resultBlob ? Math.max(0, original.file.size - resultBlob.size) : 0;
  const savedPct     = original && resultBlob ? Math.round((savedBytes / original.file.size) * 100) : 0;
  const isLarger     = original && resultBlob ? resultBlob.size > original.file.size : false;
  const showLossless = output === "webp"; // only WebP supports lossless mode in canvas
  const showQuality  = output !== "png" && !(output === "webp" && lossless);
  const isWebPOutput = output === "webp";
  const colorId      = `${uid}-qual`;

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="mb-12 flex flex-col gap-6">

      {/* Drop zone */}
      {!original && (
        <div
          ref={dropRef}
          onDrop={onDrop} onDragOver={onDragOver} onDragLeave={onDragLeave}
          onClick={() => inputRef.current?.click()}
          role="button" tabIndex={0}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") inputRef.current?.click(); }}
          className="glass-panel rounded-2xl flex flex-col items-center justify-center gap-4 p-12 cursor-pointer transition-all duration-200"
          style={{
            border: `2px dashed ${draggingOver ? "#4cd7f6" : "rgba(255,255,255,0.12)"}`,
            background: draggingOver ? "rgba(76,215,246,0.05)" : undefined,
            minHeight: "240px",
          }}
        >
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center transition-transform duration-200"
            style={{ background: "rgba(76,215,246,0.1)", transform: draggingOver ? "scale(1.1)" : "scale(1)" }}
          >
            <span className="material-symbols-outlined text-[32px]" style={{ color: "#4cd7f6" }}>swap_horiz</span>
          </div>
          <div className="text-center">
            <p className="font-semibold text-base" style={{ color: "#e8dff0" }}>
              {draggingOver ? "Drop your image here" : "Drag & drop an image here"}
            </p>
            <p className="text-sm mt-1" style={{ color: "#988d9f" }}>
              or click to browse — JPG, PNG, WebP, AVIF · max 50 MB
            </p>
          </div>
          <input ref={inputRef} type="file" accept={ACCEPTED_EXT} className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) loadFile(f); }} />
        </div>
      )}

      {/* Notification */}
      {notif && (
        <div className="flex items-start gap-3 p-4 rounded-2xl text-sm font-medium"
          style={{
            background: notif.type === "error" ? "rgba(255,100,100,0.1)" : notif.type === "success" ? "rgba(100,220,150,0.1)" : "rgba(76,215,246,0.1)",
            border:     `1px solid ${notif.type === "error" ? "rgba(255,100,100,0.25)" : notif.type === "success" ? "rgba(100,220,150,0.25)" : "rgba(76,215,246,0.25)"}`,
            color:      notif.type === "error" ? "#ff8080" : notif.type === "success" ? "#80e0a0" : "#4cd7f6",
          }}>
          <span className="material-symbols-outlined text-[18px] mt-0.5 shrink-0">
            {notif.type === "error" ? "error" : notif.type === "success" ? "check_circle" : "info"}
          </span>
          <span>{notif.message}</span>
          <button onClick={() => setNotif(null)} className="ml-auto shrink-0 opacity-60 hover:opacity-100">
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>
      )}

      {/* File header */}
      {original && (
        <div className="glass-panel rounded-2xl p-4 flex items-center gap-4"
          style={{ border: "1px solid rgba(76,215,246,0.2)" }}>
          <div className="w-10 h-10 rounded-xl overflow-hidden shrink-0 border border-white/10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={original.url} alt="preview" className="w-full h-full object-cover" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm truncate" style={{ color: "#e8dff0" }}>{original.file.name}</p>
            <p className="text-xs mt-0.5" style={{ color: "#988d9f" }}>
              {srcLabel} · {original.w} × {original.h} px · {formatBytes(original.file.size)}
            </p>
          </div>
          <button onClick={reset} disabled={converting}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold"
            style={{ background: "rgba(255,255,255,0.06)", color: "#988d9f", border: "1px solid rgba(255,255,255,0.08)" }}>
            <span className="material-symbols-outlined text-[14px]">close</span>
            Reset
          </button>
        </div>
      )}

      {/* Direction badge */}
      {original && (
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#e8dff0" }}>
            <span className="material-symbols-outlined text-[16px]" style={{ color: "#988d9f" }}>image</span>
            {srcLabel}
          </div>
          <span className="material-symbols-outlined text-[24px]" style={{ color: "#988d9f" }}>arrow_forward</span>
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm"
            style={{ background: "rgba(76,215,246,0.1)", border: "1px solid rgba(76,215,246,0.25)", color: "#4cd7f6" }}>
            <span className="material-symbols-outlined text-[16px]">image</span>
            {dstLabel}
          </div>
        </div>
      )}

      {/* Stats */}
      {original && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {[
            { label: "Source",         value: srcLabel,                           accent: false },
            { label: "Output",         value: dstLabel,                           accent: true  },
            { label: "Original size",  value: formatBytes(original.file.size),    accent: false },
            { label: "Converted size", value: resultBlob ? formatBytes(resultBlob.size) : "—", accent: !!resultBlob },
            { label: "Saved",          value: resultBlob ? (isLarger ? "Larger" : `${savedPct}%`) : "—", accent: !isLarger && savedPct > 0 },
            { label: "Space saved",    value: resultBlob ? (isLarger ? "—" : formatBytes(savedBytes)) : "—", accent: !isLarger && savedBytes > 0 },
          ].map(({ label, value, accent }) => (
            <div key={label} className="glass-panel rounded-2xl p-3 flex flex-col gap-0.5"
              style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
              <p className="text-sm font-bold tabular-nums leading-tight"
                style={{ color: accent ? "#4cd7f6" : "#e8dff0" }}>{value}</p>
              <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "#988d9f" }}>{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Settings */}
      {original && (
        <div className="glass-panel rounded-2xl p-5 flex flex-col gap-5"
          style={{ border: "1px solid rgba(255,255,255,0.06)" }}>

          {/* Output format (only shown when WebP input gives a choice) */}
          {outputs.length > 1 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "#988d9f" }}>Output format</p>
              <div className="flex gap-2">
                {outputs.map((fmt) => (
                  <Chip key={fmt} active={output === fmt} onClick={() => {
                    setOutput(fmt);
                    setResultBlob(null);
                    setResultUrl(null);
                    setNotif(null);
                  }}>
                    {fmt.toUpperCase()}
                  </Chip>
                ))}
              </div>
            </div>
          )}

          {/* Lossless toggle (WebP output only) */}
          {showLossless && (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold" style={{ color: "#e8dff0" }}>Lossless mode</p>
                <p className="text-xs mt-0.5" style={{ color: "#988d9f" }}>
                  Larger file, pixel-perfect quality — great for graphics with sharp edges
                </p>
              </div>
              <button
                onClick={() => setLossless((v) => !v)}
                role="switch" aria-checked={lossless}
                className="relative w-11 h-6 rounded-full transition-all duration-200 shrink-0"
                style={{ background: lossless ? "#4cd7f6" : "rgba(255,255,255,0.12)" }}
              >
                <span className="absolute top-0.5 w-5 h-5 rounded-full shadow-md transition-all duration-200"
                  style={{ left: lossless ? "calc(100% - 22px)" : "2px", background: lossless ? "#0d1a2e" : "#988d9f" }} />
              </button>
            </div>
          )}

          {/* Quality slider */}
          {showQuality && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#988d9f" }}>Quality</p>
                <span className="text-sm font-bold tabular-nums" style={{ color: "#4cd7f6" }}>{quality}</span>
              </div>
              <input
                id={colorId}
                type="range" min={1} max={100} value={quality}
                onChange={(e) => setQuality(Number(e.target.value))}
                className="w-full h-2 rounded-full appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, #4cd7f6 ${quality}%, rgba(255,255,255,0.1) ${quality}%)`,
                  accentColor: "#4cd7f6",
                }}
              />
              <div className="flex justify-between mt-1.5">
                <span className="text-[11px]" style={{ color: "#4d4354" }}>Smaller file</span>
                <span className="text-[11px]" style={{ color: "#4d4354" }}>Higher quality</span>
              </div>
            </div>
          )}

          {/* Info notes */}
          {output === "png" && (
            <div className="flex items-start gap-2.5 p-3 rounded-xl"
              style={{ background: "rgba(76,215,246,0.06)", border: "1px solid rgba(76,215,246,0.12)" }}>
              <span className="material-symbols-outlined text-[16px] mt-0.5 shrink-0" style={{ color: "#4cd7f6" }}>info</span>
              <p className="text-xs leading-relaxed" style={{ color: "#988d9f" }}>
                PNG is lossless — the converted file may be larger than the original WebP.
                Transparency is fully preserved.
              </p>
            </div>
          )}
          {isWebPOutput && (
            <div className="flex items-start gap-2.5 p-3 rounded-xl"
              style={{ background: "rgba(76,215,246,0.06)", border: "1px solid rgba(76,215,246,0.12)" }}>
              <span className="material-symbols-outlined text-[16px] mt-0.5 shrink-0" style={{ color: "#4cd7f6" }}>info</span>
              <p className="text-xs leading-relaxed" style={{ color: "#988d9f" }}>
                WebP supports transparency. PNG sources with an alpha channel will keep their
                transparent areas in the converted WebP.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Converting indicator */}
      {converting && (
        <div className="glass-panel rounded-2xl p-4 flex items-center gap-3"
          style={{ border: "1px solid rgba(76,215,246,0.15)" }}>
          <span className="w-5 h-5 border-2 border-[rgba(76,215,246,0.3)] border-t-[#4cd7f6] rounded-full animate-spin shrink-0" />
          <span className="text-sm font-medium" style={{ color: "#4cd7f6" }}>Converting…</span>
        </div>
      )}

      {/* Convert button */}
      {original && (
        <button
          onClick={convert}
          disabled={converting}
          className="btn-primary flex items-center justify-center gap-2 py-4 rounded-2xl font-bold text-base transition-all"
          style={{ opacity: converting ? 0.5 : 1, cursor: converting ? "not-allowed" : "pointer" }}
        >
          {converting ? (
            <><span className="w-5 h-5 border-2 border-[rgba(255,255,255,0.3)] border-t-white rounded-full animate-spin" />
              Converting…</>
          ) : (
            <><span className="material-symbols-outlined text-[20px]">swap_horiz</span>
              {resultBlob ? `Re-convert to ${dstLabel}` : `Convert to ${dstLabel}`}</>
          )}
        </button>
      )}

      {/* Result preview + download */}
      {resultBlob && resultUrl && original && (
        <div className="flex flex-col gap-3">
          <div className="glass-panel rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={resultUrl}
              alt="Converted"
              className="w-full block"
              style={{
                maxHeight: "480px",
                objectFit: "contain",
                // Checkerboard for formats that preserve transparency
                background: output !== "jpg"
                  ? "linear-gradient(45deg,#444 25%,transparent 25%),linear-gradient(-45deg,#444 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#444 75%),linear-gradient(-45deg,transparent 75%,#444 75%)"
                  : "rgba(0,0,0,0.2)",
                backgroundSize: output !== "jpg" ? "16px 16px" : undefined,
                backgroundPosition: output !== "jpg" ? "0 0,0 8px,8px -8px,-8px 0" : undefined,
                backgroundColor: output !== "jpg" ? "#555" : undefined,
              }}
            />
          </div>
          <div className="flex flex-wrap gap-3">
            <button onClick={download}
              className="btn-primary flex items-center gap-2 px-6 py-3 rounded-2xl font-bold text-sm flex-1 justify-center">
              <span className="material-symbols-outlined text-[18px]">download</span>
              Download {dstLabel}
            </button>
            <button onClick={reset}
              className="flex items-center gap-2 px-5 py-3 rounded-2xl font-bold text-sm transition-all"
              style={{ background: "rgba(255,255,255,0.05)", color: "#988d9f", border: "1px solid rgba(255,255,255,0.08)" }}>
              <span className="material-symbols-outlined text-[18px]">add_photo_alternate</span>
              New image
            </button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!original && !notif && (
        <p className="text-center text-sm" style={{ color: "#4d4354" }}>
          Upload an image to convert it — all processing happens in your browser
        </p>
      )}
    </div>
  );
}
