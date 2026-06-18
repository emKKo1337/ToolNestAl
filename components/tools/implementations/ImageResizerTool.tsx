"use client";

import { useState, useRef, useCallback, useEffect, useId } from "react";

// ─── Constants ────────────────────────────────────────────────────────────────
const MAX_FILE_BYTES = 50 * 1024 * 1024;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];
const ACCEPTED_EXT   = ".jpg,.jpeg,.png,.webp,.avif";

// ─── Types ────────────────────────────────────────────────────────────────────
type Mode   = "dimensions" | "percentage";
type Format = "jpg" | "png" | "webp";
type NotifType = "success" | "error" | "info";

interface Preset { label: string; w: number; h: number }

const PRESETS: Preset[] = [
  { label: "Instagram Post",  w: 1080, h: 1080 },
  { label: "Instagram Story", w: 1080, h: 1920 },
  { label: "Facebook Post",   w: 1200, h: 630  },
  { label: "Facebook Cover",  w: 851,  h: 315  },
  { label: "YouTube Thumb",   w: 1280, h: 720  },
  { label: "TikTok",          w: 1080, h: 1920 },
  { label: "LinkedIn",        w: 1200, h: 627  },
  { label: "X (Twitter)",     w: 1200, h: 675  },
  { label: "HD",              w: 1280, h: 720  },
  { label: "Full HD",         w: 1920, h: 1080 },
  { label: "2K",              w: 2560, h: 1440 },
  { label: "4K",              w: 3840, h: 2160 },
];

const FORMAT_MIME: Record<Format, string> = {
  jpg:  "image/jpeg",
  png:  "image/png",
  webp: "image/webp",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatBytes(bytes: number): string {
  if (bytes < 1024)      return `${bytes} B`;
  if (bytes < 1_048_576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1_048_576).toFixed(2)} MB`;
}

function baseName(name: string): string { return name.replace(/\.[^.]+$/, ""); }

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function defaultFormat(mimeType: string): Format {
  if (mimeType === "image/png")  return "png";
  if (mimeType === "image/webp") return "webp";
  return "jpg";
}

async function resizeImage(
  src: string,
  targetW: number,
  targetH: number,
  format: Format,
  quality: number,
): Promise<Blob> {
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = src;
  });

  const canvas = document.createElement("canvas");
  canvas.width  = Math.round(targetW);
  canvas.height = Math.round(targetH);
  const ctx = canvas.getContext("2d")!;

  // White background for JPG (no transparency)
  if (format === "jpg") {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  return new Promise<Blob>((res, rej) => {
    canvas.toBlob(
      (blob) => blob ? res(blob) : rej(new Error("Export failed")),
      FORMAT_MIME[format],
      format === "png" ? undefined : quality / 100,
    );
  });
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function FormatChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
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
export default function ImageResizerTool() {
  const uid = useId();

  // Image state
  const [original, setOriginal] = useState<{ file: File; url: string; w: number; h: number } | null>(null);
  const [resultBlob,  setResultBlob]  = useState<Blob | null>(null);
  const [resultSize,  setResultSize]  = useState<number>(0);

  // Resize settings
  const [mode,       setMode]       = useState<Mode>("dimensions");
  const [targetW,    setTargetW]    = useState(0);
  const [targetH,    setTargetH]    = useState(0);
  const [pct,        setPct]        = useState(100);
  const [lockAR,     setLockAR]     = useState(true);
  const [format,     setFormat]     = useState<Format>("jpg");
  const [quality,    setQuality]    = useState(92);

  // UI state
  const [draggingOver, setDraggingOver] = useState(false);
  const [resizing,     setResizing]     = useState(false);
  const [notif,        setNotif]        = useState<{ type: NotifType; message: string } | null>(null);

  const dropRef  = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const notify = useCallback((type: NotifType, msg: string) => {
    setNotif({ type, message: msg });
    if (type !== "info") setTimeout(() => setNotif(null), 8000);
  }, []);

  // ── Derived dimensions ────────────────────────────────────────────────────
  const effectiveW = mode === "percentage"
    ? Math.round((original?.w ?? 0) * pct / 100)
    : targetW;
  const effectiveH = mode === "percentage"
    ? Math.round((original?.h ?? 0) * pct / 100)
    : targetH;

  // ── File loading ──────────────────────────────────────────────────────────
  const loadFile = useCallback(async (file: File) => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      notify("error", `"${file.name}" is not supported. Upload a JPG, PNG, WEBP, or AVIF image.`);
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      notify("error", `"${file.name}" exceeds the 50 MB limit.`);
      return;
    }

    if (original?.url) URL.revokeObjectURL(original.url);

    const url = URL.createObjectURL(file);

    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = url;
    }).catch(() => null);

    if (!img) { notify("error", "Could not read this image."); URL.revokeObjectURL(url); return; }

    const w = img.naturalWidth;
    const h = img.naturalHeight;
    setOriginal({ file, url, w, h });
    setTargetW(w);
    setTargetH(h);
    setPct(100);
    setFormat(defaultFormat(file.type));
    setResultBlob(null);
    setResultSize(0);
    setNotif(null);
  }, [original, notify]);

  // ── Drop zone ─────────────────────────────────────────────────────────────
  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDraggingOver(false);
    const f = e.dataTransfer.files[0]; if (f) loadFile(f);
  }, [loadFile]);

  const onDragOver  = useCallback((e: React.DragEvent) => { e.preventDefault(); setDraggingOver(true); }, []);
  const onDragLeave = useCallback((e: React.DragEvent) => {
    if (dropRef.current && !dropRef.current.contains(e.relatedTarget as Node)) setDraggingOver(false);
  }, []);

  // ── Width / height input handlers (with AR lock) ──────────────────────────
  const handleWidth = useCallback((raw: string) => {
    const v = parseInt(raw, 10);
    if (isNaN(v) || v < 1) { setTargetW(0); return; }
    const w = clamp(v, 1, 32000);
    setTargetW(w);
    if (lockAR && original && original.w > 0) {
      setTargetH(Math.round((original.h / original.w) * w));
    }
  }, [lockAR, original]);

  const handleHeight = useCallback((raw: string) => {
    const v = parseInt(raw, 10);
    if (isNaN(v) || v < 1) { setTargetH(0); return; }
    const h = clamp(v, 1, 32000);
    setTargetH(h);
    if (lockAR && original && original.h > 0) {
      setTargetW(Math.round((original.w / original.h) * h));
    }
  }, [lockAR, original]);

  const handlePct = useCallback((raw: string) => {
    const v = parseInt(raw, 10);
    if (!isNaN(v) && v >= 1) setPct(clamp(v, 1, 1000));
  }, []);

  // ── Preset apply ──────────────────────────────────────────────────────────
  const applyPreset = useCallback((preset: Preset) => {
    setMode("dimensions");
    setTargetW(preset.w);
    setTargetH(preset.h);
    setLockAR(false); // presets have fixed aspect ratios that may differ from source
  }, []);

  // ── Resize ────────────────────────────────────────────────────────────────
  const doResize = useCallback(async () => {
    if (!original) return;
    const w = effectiveW;
    const h = effectiveH;
    if (!w || !h || w < 1 || h < 1) { notify("error", "Enter valid width and height (≥ 1 px)."); return; }

    setResizing(true);
    setNotif(null);

    try {
      const blob = await resizeImage(original.url, w, h, format, quality);
      setResultBlob(blob);
      setResultSize(blob.size);
      notify("success", `Resized to ${w}×${h} px — ${formatBytes(blob.size)}.`);
    } catch (err) {
      notify("error", err instanceof Error ? err.message : "Resize failed.");
    } finally {
      setResizing(false);
    }
  }, [original, effectiveW, effectiveH, format, quality, notify]);

  // ── Download ──────────────────────────────────────────────────────────────
  const download = useCallback(() => {
    if (!resultBlob || !original) return;
    downloadBlob(resultBlob, `${baseName(original.file.name)}-${effectiveW}x${effectiveH}.${format}`);
  }, [resultBlob, original, effectiveW, effectiveH, format]);

  // ── Reset ─────────────────────────────────────────────────────────────────
  const reset = useCallback(() => {
    if (original?.url) URL.revokeObjectURL(original.url);
    setOriginal(null);
    setResultBlob(null);
    setResultSize(0);
    setResizing(false);
    setNotif(null);
    if (inputRef.current) inputRef.current.value = "";
  }, [original]);

  // Cleanup on unmount
  useEffect(() => {
    return () => { if (original?.url) URL.revokeObjectURL(original.url); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Render ───────────────────────────────────────────────────────────────
  const wId = `${uid}-w`;
  const hId = `${uid}-h`;
  const pId = `${uid}-p`;

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
            <span className="material-symbols-outlined text-[32px]" style={{ color: "#ddb7ff" }}>photo_size_select_large</span>
          </div>
          <div className="text-center">
            <p className="font-semibold text-base" style={{ color: "#e8dff0" }}>
              {draggingOver ? "Drop your image here" : "Drag & drop an image here"}
            </p>
            <p className="text-sm mt-1" style={{ color: "#988d9f" }}>or click to browse — JPG, PNG, WEBP, AVIF · max 50 MB</p>
          </div>
          <input ref={inputRef} type="file" accept={ACCEPTED_EXT} className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) loadFile(f); }} />
        </div>
      )}

      {/* Notification */}
      {notif && (
        <div
          className="flex items-start gap-3 p-4 rounded-2xl text-sm font-medium"
          style={{
            background: notif.type === "error" ? "rgba(255,100,100,0.1)" : notif.type === "success" ? "rgba(100,220,150,0.1)" : "rgba(221,183,255,0.1)",
            border: `1px solid ${notif.type === "error" ? "rgba(255,100,100,0.25)" : notif.type === "success" ? "rgba(100,220,150,0.25)" : "rgba(221,183,255,0.25)"}`,
            color: notif.type === "error" ? "#ff8080" : notif.type === "success" ? "#80e0a0" : "#ddb7ff",
          }}
        >
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
              {original.w} × {original.h} px · {formatBytes(original.file.size)}
            </p>
          </div>
          <button onClick={reset} disabled={resizing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold"
            style={{ background: "rgba(255,255,255,0.06)", color: "#988d9f", border: "1px solid rgba(255,255,255,0.08)" }}>
            <span className="material-symbols-outlined text-[14px]">close</span>
            Reset
          </button>
        </div>
      )}

      {/* Stats */}
      {original && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Original",       value: `${original.w} × ${original.h}`,      icon: "open_in_full" },
            { label: "New size",       value: effectiveW && effectiveH ? `${effectiveW} × ${effectiveH}` : "—", icon: "crop", accent: true },
            { label: "Original file",  value: formatBytes(original.file.size),         icon: "folder" },
            { label: "New file",       value: resultSize > 0 ? formatBytes(resultSize) : "—", icon: "download", accent: resultSize > 0 },
          ].map(({ label, value, icon, accent }) => (
            <div key={label} className="glass-panel rounded-2xl p-4 flex flex-col gap-1"
              style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
              <span className="material-symbols-outlined text-[16px]"
                style={{ color: accent ? "#ddb7ff" : "#988d9f" }}>{icon}</span>
              <p className="text-base font-bold tabular-nums leading-tight"
                style={{ color: accent ? "#ddb7ff" : "#e8dff0" }}>{value}</p>
              <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#988d9f" }}>{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Controls */}
      {original && (
        <div className="glass-panel rounded-2xl p-5 flex flex-col gap-6"
          style={{ border: "1px solid rgba(255,255,255,0.06)" }}>

          {/* Mode tabs */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "#988d9f" }}>Resize by</p>
            <div className="flex gap-2">
              {(["dimensions", "percentage"] as Mode[]).map((m) => (
                <FormatChip key={m} active={mode === m} onClick={() => setMode(m)}>
                  {m === "dimensions" ? "Dimensions (px)" : "Percentage"}
                </FormatChip>
              ))}
            </div>
          </div>

          {/* Dimension inputs */}
          {mode === "dimensions" && (
            <div className="flex items-end gap-3 flex-wrap">
              <div className="flex flex-col gap-1.5 flex-1 min-w-[100px]">
                <label htmlFor={wId} className="text-xs font-semibold" style={{ color: "#988d9f" }}>Width (px)</label>
                <input
                  id={wId}
                  type="number" min={1} max={32000}
                  value={targetW || ""}
                  onChange={(e) => handleWidth(e.target.value)}
                  placeholder="Width"
                  className="rounded-xl px-3 py-2.5 text-sm font-semibold tabular-nums w-full outline-none transition-all"
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    color: "#e8dff0",
                  }}
                />
              </div>

              {/* Lock AR button */}
              <button
                onClick={() => setLockAR((v) => !v)}
                title={lockAR ? "Unlock aspect ratio" : "Lock aspect ratio"}
                className="mb-0.5 w-10 h-10 rounded-xl flex items-center justify-center transition-all shrink-0"
                style={{
                  background: lockAR ? "rgba(221,183,255,0.15)" : "rgba(255,255,255,0.05)",
                  border: `1px solid ${lockAR ? "rgba(221,183,255,0.3)" : "rgba(255,255,255,0.08)"}`,
                  color: lockAR ? "#ddb7ff" : "#988d9f",
                }}
              >
                <span className="material-symbols-outlined text-[18px]">{lockAR ? "lock" : "lock_open"}</span>
              </button>

              <div className="flex flex-col gap-1.5 flex-1 min-w-[100px]">
                <label htmlFor={hId} className="text-xs font-semibold" style={{ color: "#988d9f" }}>Height (px)</label>
                <input
                  id={hId}
                  type="number" min={1} max={32000}
                  value={targetH || ""}
                  onChange={(e) => handleHeight(e.target.value)}
                  placeholder="Height"
                  className="rounded-xl px-3 py-2.5 text-sm font-semibold tabular-nums w-full outline-none transition-all"
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    color: "#e8dff0",
                  }}
                />
              </div>
            </div>
          )}

          {/* Percentage input */}
          {mode === "percentage" && (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5 max-w-xs">
                <label htmlFor={pId} className="text-xs font-semibold" style={{ color: "#988d9f" }}>Scale (%)</label>
                <div className="flex items-center gap-2">
                  <input
                    id={pId}
                    type="number" min={1} max={1000}
                    value={pct}
                    onChange={(e) => handlePct(e.target.value)}
                    className="rounded-xl px-3 py-2.5 text-sm font-semibold tabular-nums w-28 outline-none"
                    style={{
                      background: "rgba(255,255,255,0.06)",
                      border: "1px solid rgba(255,255,255,0.12)",
                      color: "#e8dff0",
                    }}
                  />
                  <span className="text-sm" style={{ color: "#988d9f" }}>
                    → {effectiveW} × {effectiveH} px
                  </span>
                </div>
              </div>
              <input
                type="range" min={1} max={200} value={Math.min(pct, 200)}
                onChange={(e) => setPct(Number(e.target.value))}
                className="w-full max-w-xs h-2 rounded-full appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, #ddb7ff ${Math.min(pct, 200) / 2}%, rgba(255,255,255,0.1) ${Math.min(pct, 200) / 2}%)`,
                  accentColor: "#ddb7ff",
                }}
              />
              <div className="flex justify-between max-w-xs">
                <span className="text-[11px]" style={{ color: "#4d4354" }}>1%</span>
                <span className="text-[11px]" style={{ color: "#4d4354" }}>200%</span>
              </div>
            </div>
          )}

          {/* Presets */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "#988d9f" }}>Presets</p>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((p) => {
                const active = mode === "dimensions" && targetW === p.w && targetH === p.h;
                return (
                  <button
                    key={p.label}
                    onClick={() => applyPreset(p)}
                    className="flex flex-col items-start px-3 py-2 rounded-xl text-[12px] font-semibold transition-all duration-200"
                    style={{
                      background: active ? "rgba(221,183,255,0.15)" : "rgba(255,255,255,0.04)",
                      color:      active ? "#ddb7ff"                 : "#988d9f",
                      border:     `1px solid ${active ? "rgba(221,183,255,0.35)" : "rgba(255,255,255,0.08)"}`,
                    }}
                  >
                    <span>{p.label}</span>
                    <span className="text-[10px] opacity-60 tabular-nums">{p.w}×{p.h}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Format + Quality */}
          <div className="flex flex-wrap gap-8">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "#988d9f" }}>Output format</p>
              <div className="flex gap-2">
                {(["jpg", "png", "webp"] as Format[]).map((f) => (
                  <FormatChip key={f} active={format === f} onClick={() => setFormat(f)}>
                    {f.toUpperCase()}
                  </FormatChip>
                ))}
              </div>
            </div>
            <div className="flex-1 min-w-[180px]">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#988d9f" }}>
                  Quality{format === "png" ? " (lossless)" : ""}
                </p>
                <span className="text-sm font-bold tabular-nums" style={{ color: "#ddb7ff" }}>
                  {format === "png" ? "—" : quality}
                </span>
              </div>
              <input
                type="range" min={1} max={100} value={quality}
                onChange={(e) => setQuality(Number(e.target.value))}
                disabled={format === "png"}
                className="w-full h-2 rounded-full appearance-none cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                style={{
                  background: format !== "png"
                    ? `linear-gradient(to right, #ddb7ff ${quality}%, rgba(255,255,255,0.1) ${quality}%)`
                    : "rgba(255,255,255,0.1)",
                  accentColor: "#ddb7ff",
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Resize button */}
      {original && (
        <button
          onClick={doResize}
          disabled={resizing || !effectiveW || !effectiveH}
          className="btn-primary flex items-center justify-center gap-2 py-4 rounded-2xl font-bold text-base transition-all"
          style={{ opacity: resizing || !effectiveW || !effectiveH ? 0.5 : 1, cursor: resizing ? "not-allowed" : "pointer" }}
        >
          {resizing ? (
            <><span className="w-5 h-5 border-2 border-[rgba(255,255,255,0.3)] border-t-white rounded-full animate-spin" />Resizing…</>
          ) : (
            <><span className="material-symbols-outlined text-[20px]">crop</span>
              {resultBlob ? "Resize again" : "Resize image"}</>
          )}
        </button>
      )}

      {/* Preview + download */}
      {resultBlob && original && (
        <div className="flex flex-col gap-3">
          <div className="glass-panel rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={URL.createObjectURL(resultBlob)}
              alt="Resized"
              className="w-full block"
              style={{ maxHeight: "480px", objectFit: "contain", background: "rgba(0,0,0,0.2)" }}
            />
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={download}
              className="btn-primary flex items-center gap-2 px-6 py-3 rounded-2xl font-bold text-sm flex-1 justify-center"
            >
              <span className="material-symbols-outlined text-[18px]">download</span>
              Download {format.toUpperCase()}
            </button>
            <button
              onClick={reset}
              className="flex items-center gap-2 px-5 py-3 rounded-2xl font-bold text-sm transition-all"
              style={{ background: "rgba(255,255,255,0.05)", color: "#988d9f", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              <span className="material-symbols-outlined text-[18px]">add_photo_alternate</span>
              New image
            </button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!original && !notif && (
        <p className="text-center text-sm" style={{ color: "#4d4354" }}>
          Upload an image to resize it — all processing happens in your browser
        </p>
      )}
    </div>
  );
}
