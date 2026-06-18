"use client";

import { useState, useRef, useCallback, useEffect, useId } from "react";

// ─── Constants ────────────────────────────────────────────────────────────────
const MAX_FILE_BYTES = 50 * 1024 * 1024;
const ACCEPTED_TYPES = ["image/jpeg", "image/png"];
const ACCEPTED_EXT   = ".jpg,.jpeg,.png";

// ─── Types ────────────────────────────────────────────────────────────────────
type BgOption  = "white" | "black" | "custom";
type NotifType = "success" | "error" | "info";

const BG_COLOR: Record<BgOption, string | null> = {
  white:  "#ffffff",
  black:  "#000000",
  custom: null, // resolved at render time
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

function detectDirection(mimeType: string): "jpg-to-png" | "png-to-jpg" {
  return mimeType === "image/png" ? "png-to-jpg" : "jpg-to-png";
}

async function convertImage(
  srcUrl: string,
  direction: "jpg-to-png" | "png-to-jpg",
  quality: number,
  bgColor: string,       // only used for png-to-jpg
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

  if (direction === "png-to-jpg") {
    // JPG has no alpha channel: fill background first
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  ctx.drawImage(img, 0, 0);

  const mimeOut = direction === "jpg-to-png" ? "image/png" : "image/jpeg";
  const qualOut = direction === "jpg-to-png" ? undefined   : quality / 100;

  return new Promise<Blob>((res, rej) => {
    canvas.toBlob(
      (blob) => blob ? res(blob) : rej(new Error("Conversion failed")),
      mimeOut,
      qualOut,
    );
  });
}

// ─── Sub-component: Chip ──────────────────────────────────────────────────────
function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} aria-pressed={active}
      className="px-3.5 py-2 rounded-xl text-[13px] font-semibold transition-all duration-200"
      style={{
        background: active ? "rgba(221,183,255,0.15)" : "rgba(255,255,255,0.04)",
        color:      active ? "#ddb7ff"                : "#988d9f",
        border:     `1px solid ${active ? "rgba(221,183,255,0.35)" : "rgba(255,255,255,0.08)"}`,
      }}>
      {children}
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function JpgPngConverterTool() {
  const uid = useId();

  const [original,   setOriginal]   = useState<{ file: File; url: string; w: number; h: number } | null>(null);
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);
  const [resultUrl,  setResultUrl]  = useState<string | null>(null);

  // Settings
  const [direction,    setDirection]    = useState<"jpg-to-png" | "png-to-jpg">("jpg-to-png");
  const [quality,      setQuality]      = useState(92);
  const [bgOption,     setBgOption]     = useState<BgOption>("white");
  const [customColor,  setCustomColor]  = useState("#a855f7");

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
      notify("error", `"${file.name}" is not supported. Upload a JPG or PNG image.`);
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

    const dir = detectDirection(file.type);
    setOriginal({ file, url, w: img.naturalWidth, h: img.naturalHeight });
    setDirection(dir);
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
      const bg = bgOption === "custom" ? customColor : (BG_COLOR[bgOption] ?? "#ffffff");
      const blob = await convertImage(original.url, direction, quality, bg);
      const url  = URL.createObjectURL(blob);
      setResultBlob(blob);
      setResultUrl(url);

      const outFmt = direction === "jpg-to-png" ? "PNG" : "JPG";
      notify("success", `Converted to ${outFmt} — ${formatBytes(blob.size)}.`);
    } catch (err) {
      notify("error", err instanceof Error ? err.message : "Conversion failed.");
    } finally {
      setConverting(false);
    }
  }, [original, direction, quality, bgOption, customColor, resultUrl, notify]);

  // Auto-convert on load
  useEffect(() => {
    if (!original || resultBlob || converting) return;
    async function autoConvert() { await convert(); }
    autoConvert();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [original]);

  // ── Download ──────────────────────────────────────────────────────────────
  const download = useCallback(() => {
    if (!resultBlob || !original) return;
    const ext = direction === "jpg-to-png" ? "png" : "jpg";
    downloadBlob(resultBlob, `${baseName(original.file.name)}.${ext}`);
  }, [resultBlob, original, direction]);

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

  // Cleanup on unmount
  useEffect(() => () => {
    if (original?.url) URL.revokeObjectURL(original.url);
    if (resultUrl)     URL.revokeObjectURL(resultUrl);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Derived ──────────────────────────────────────────────────────────────
  const isPngToJpg  = direction === "png-to-jpg";
  const srcLabel    = isPngToJpg ? "PNG" : "JPG";
  const dstLabel    = isPngToJpg ? "JPG" : "PNG";
  const colorId     = `${uid}-color`;

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
            border: `2px dashed ${draggingOver ? "#ddb7ff" : "rgba(255,255,255,0.12)"}`,
            background: draggingOver ? "rgba(221,183,255,0.05)" : undefined,
            minHeight: "240px",
          }}
        >
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center transition-transform duration-200"
            style={{ background: "rgba(221,183,255,0.1)", transform: draggingOver ? "scale(1.1)" : "scale(1)" }}
          >
            <span className="material-symbols-outlined text-[32px]" style={{ color: "#ddb7ff" }}>image</span>
          </div>
          <div className="text-center">
            <p className="font-semibold text-base" style={{ color: "#e8dff0" }}>
              {draggingOver ? "Drop your image here" : "Drag & drop a JPG or PNG here"}
            </p>
            <p className="text-sm mt-1" style={{ color: "#988d9f" }}>or click to browse — JPG or PNG · max 50 MB</p>
          </div>
          <input ref={inputRef} type="file" accept={ACCEPTED_EXT} className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) loadFile(f); }} />
        </div>
      )}

      {/* Notification */}
      {notif && (
        <div className="flex items-start gap-3 p-4 rounded-2xl text-sm font-medium"
          style={{
            background: notif.type === "error" ? "rgba(255,100,100,0.1)" : notif.type === "success" ? "rgba(100,220,150,0.1)" : "rgba(221,183,255,0.1)",
            border: `1px solid ${notif.type === "error" ? "rgba(255,100,100,0.25)" : notif.type === "success" ? "rgba(100,220,150,0.25)" : "rgba(221,183,255,0.25)"}`,
            color: notif.type === "error" ? "#ff8080" : notif.type === "success" ? "#80e0a0" : "#ddb7ff",
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
          style={{ border: "1px solid rgba(221,183,255,0.2)" }}>
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

      {/* Conversion direction badge */}
      {original && (
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm"
            style={{ background: "rgba(221,183,255,0.1)", border: "1px solid rgba(221,183,255,0.25)", color: "#ddb7ff" }}>
            <span className="material-symbols-outlined text-[16px]">image</span>
            {srcLabel}
          </div>
          <span className="material-symbols-outlined text-[24px]" style={{ color: "#988d9f" }}>arrow_forward</span>
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm"
            style={{ background: "rgba(76,215,246,0.1)", border: "1px solid rgba(76,215,246,0.25)", color: "#4cd7f6" }}>
            <span className="material-symbols-outlined text-[16px]">image</span>
            {dstLabel}
          </div>
          <button
            onClick={() => {
              const flipped: "jpg-to-png" | "png-to-jpg" = isPngToJpg ? "jpg-to-png" : "png-to-jpg";
              setDirection(flipped);
              setResultBlob(null);
              setResultUrl(null);
              setNotif(null);
            }}
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
            style={{ background: "rgba(255,255,255,0.06)", color: "#988d9f", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <span className="material-symbols-outlined text-[14px]">swap_horiz</span>
            Flip
          </button>
        </div>
      )}

      {/* Stats */}
      {original && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Source format",  value: srcLabel,                       icon: "image",       accent: false },
            { label: "Output format",  value: dstLabel,                       icon: "image",       accent: true  },
            { label: "Original size",  value: formatBytes(original.file.size), icon: "folder",      accent: false },
            { label: "Converted size", value: resultBlob ? formatBytes(resultBlob.size) : "—", icon: "download", accent: !!resultBlob },
          ].map(({ label, value, icon, accent }) => (
            <div key={label} className="glass-panel rounded-2xl p-4 flex flex-col gap-1"
              style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
              <span className="material-symbols-outlined text-[16px]"
                style={{ color: accent ? "#ddb7ff" : "#988d9f" }}>{icon}</span>
              <p className="text-lg font-bold tabular-nums leading-tight"
                style={{ color: accent ? "#ddb7ff" : "#e8dff0" }}>{value}</p>
              <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#988d9f" }}>{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Settings (shown only when relevant) */}
      {original && (
        <div className="glass-panel rounded-2xl p-5 flex flex-col gap-5"
          style={{ border: "1px solid rgba(255,255,255,0.06)" }}>

          {/* PNG → JPG: background fill */}
          {isPngToJpg && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "#988d9f" }}>
                Transparent areas fill
              </p>
              <div className="flex flex-wrap gap-2 mb-3">
                {(["white", "black", "custom"] as BgOption[]).map((opt) => (
                  <Chip key={opt} active={bgOption === opt} onClick={() => setBgOption(opt)}>
                    {opt.charAt(0).toUpperCase() + opt.slice(1)}
                  </Chip>
                ))}
              </div>
              {bgOption === "custom" && (
                <div className="flex items-center gap-3">
                  <label htmlFor={colorId} className="text-sm font-medium" style={{ color: "#988d9f" }}>Color</label>
                  <input
                    id={colorId}
                    type="color"
                    value={customColor}
                    onChange={(e) => setCustomColor(e.target.value)}
                    className="w-10 h-10 rounded-xl cursor-pointer border-0 p-0"
                    style={{ background: "none" }}
                  />
                  <span className="text-sm font-mono" style={{ color: "#ddb7ff" }}>{customColor.toUpperCase()}</span>
                </div>
              )}
            </div>
          )}

          {/* PNG → JPG: quality */}
          {isPngToJpg && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#988d9f" }}>JPG quality</p>
                <span className="text-sm font-bold tabular-nums" style={{ color: "#ddb7ff" }}>{quality}</span>
              </div>
              <input
                type="range" min={1} max={100} value={quality}
                onChange={(e) => setQuality(Number(e.target.value))}
                className="w-full h-2 rounded-full appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, #ddb7ff ${quality}%, rgba(255,255,255,0.1) ${quality}%)`,
                  accentColor: "#ddb7ff",
                }}
              />
              <div className="flex justify-between mt-1.5">
                <span className="text-[11px]" style={{ color: "#4d4354" }}>Smaller file</span>
                <span className="text-[11px]" style={{ color: "#4d4354" }}>Higher quality</span>
              </div>
            </div>
          )}

          {/* JPG → PNG: informational note */}
          {!isPngToJpg && (
            <div className="flex items-start gap-2.5 p-3 rounded-xl"
              style={{ background: "rgba(221,183,255,0.08)", border: "1px solid rgba(221,183,255,0.15)" }}>
              <span className="material-symbols-outlined text-[16px] mt-0.5 shrink-0" style={{ color: "#ddb7ff" }}>info</span>
              <p className="text-xs leading-relaxed" style={{ color: "#988d9f" }}>
                PNG uses lossless compression — the converted file may be larger than the original JPG.
                Transparency is preserved if the source contains an alpha channel.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Converting progress */}
      {converting && (
        <div className="glass-panel rounded-2xl p-4 flex items-center gap-3"
          style={{ border: "1px solid rgba(221,183,255,0.15)" }}>
          <span className="w-5 h-5 border-2 border-[rgba(221,183,255,0.3)] border-t-[#ddb7ff] rounded-full animate-spin shrink-0" />
          <span className="text-sm font-medium" style={{ color: "#ddb7ff" }}>Converting…</span>
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
            <><span className="w-5 h-5 border-2 border-[rgba(255,255,255,0.3)] border-t-white rounded-full animate-spin" />Converting…</>
          ) : (
            <><span className="material-symbols-outlined text-[20px]">swap_horiz</span>
              {resultBlob ? `Re-convert to ${dstLabel}` : `Convert to ${dstLabel}`}</>
          )}
        </button>
      )}

      {/* Preview + download */}
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
                background: direction === "jpg-to-png"
                  ? "linear-gradient(45deg,#444 25%,transparent 25%),linear-gradient(-45deg,#444 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#444 75%),linear-gradient(-45deg,transparent 75%,#444 75%)"
                  : "rgba(0,0,0,0.2)",
                backgroundSize: direction === "jpg-to-png" ? "16px 16px" : undefined,
                backgroundPosition: direction === "jpg-to-png" ? "0 0,0 8px,8px -8px,-8px 0" : undefined,
                backgroundColor: direction === "jpg-to-png" ? "#555" : undefined,
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
          Upload a JPG or PNG — conversion happens instantly in your browser
        </p>
      )}
    </div>
  );
}
