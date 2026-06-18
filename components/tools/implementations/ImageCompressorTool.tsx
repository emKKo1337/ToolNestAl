"use client";

import { useState, useRef, useCallback, useEffect } from "react";

// ─── Constants ────────────────────────────────────────────────────────────────
const MAX_FILE_BYTES = 50 * 1024 * 1024;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];
const ACCEPTED_EXT = ".jpg,.jpeg,.png,.webp,.avif";

// ─── Types ────────────────────────────────────────────────────────────────────
type NotifType = "success" | "error" | "info";

interface Preset { label: string; quality: number }
const PRESETS: Preset[] = [
  { label: "Best Quality", quality: 85 },
  { label: "Balanced",     quality: 70 },
  { label: "Smallest",     quality: 40 },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1_048_576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1_048_576).toFixed(2)} MB`;
}

function outputMime(inputType: string): string {
  // AVIF encoding is not universally supported in canvas; fall back to WebP
  if (inputType === "image/avif") return "image/webp";
  return inputType;
}

function outputExt(mime: string): string {
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png":  "png",
    "image/webp": "webp",
    "image/avif": "avif",
  };
  return map[mime] ?? "jpg";
}

function baseName(filename: string): string {
  return filename.replace(/\.[^.]+$/, "");
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

async function runCompression(
  file: File,
  quality: number,
  preserveExif: boolean,
  onProgress: (n: number) => void,
): Promise<File> {
  const imageCompression = (await import("browser-image-compression")).default;
  const mime = outputMime(file.type);
  return imageCompression(file, {
    maxSizeMB: 1000,          // no size target; rely solely on quality
    maxIteration: 1,          // single-pass — don't search for target size
    alwaysKeepResolution: true,
    initialQuality: quality / 100,
    fileType: mime,
    useWebWorker: false,
    preserveExif,
    onProgress,
  });
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function ImageCompressorTool() {
  const [original,    setOriginal]    = useState<{ file: File; url: string } | null>(null);
  const [compressed,  setCompressed]  = useState<{ file: File; url: string } | null>(null);
  const [compressing, setCompressing] = useState(false);
  const [progress,    setProgress]    = useState(0);
  const [quality,     setQuality]     = useState(70);
  const [preserveExif,setPreserveExif]= useState(false);
  const [settingsDirty, setSettingsDirty] = useState(false);
  const [draggingOver,  setDraggingOver]  = useState(false);
  const [sliderX,       setSliderX]       = useState(50);
  const [draggingSlider,setDraggingSlider]= useState(false);
  const [notif,         setNotif]         = useState<{ type: NotifType; message: string } | null>(null);

  const dropRef    = useRef<HTMLDivElement>(null);
  const inputRef   = useRef<HTMLInputElement>(null);
  const sliderRef  = useRef<HTMLDivElement>(null);
  const abortRef   = useRef<AbortController | null>(null);

  const notify = useCallback((type: NotifType, msg: string) => {
    setNotif({ type, message: msg });
    if (type !== "info") setTimeout(() => setNotif(null), 8000);
  }, []);

  // ── File loading ──────────────────────────────────────────────────────────
  const loadFile = useCallback(async (file: File) => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      notify("error", `"${file.name}" is not supported. Upload a JPG, PNG, WEBP, or AVIF file.`);
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      notify("error", `"${file.name}" exceeds the 50 MB limit.`);
      return;
    }
    if (original?.url)    URL.revokeObjectURL(original.url);
    if (compressed?.url)  URL.revokeObjectURL(compressed.url);

    const url = URL.createObjectURL(file);
    setOriginal({ file, url });
    setCompressed(null);
    setSettingsDirty(false);
    setSliderX(50);
    setNotif(null);
  }, [original, compressed, notify]); // notify is stable (no deps), safe to include

  // ── Drop zone ─────────────────────────────────────────────────────────────
  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDraggingOver(false);
    const f = e.dataTransfer.files[0]; if (f) loadFile(f);
  }, [loadFile]);

  const onDragOver  = useCallback((e: React.DragEvent) => { e.preventDefault(); setDraggingOver(true); }, []);
  const onDragLeave = useCallback((e: React.DragEvent) => {
    if (dropRef.current && !dropRef.current.contains(e.relatedTarget as Node)) setDraggingOver(false);
  }, []);

  // ── Compress ──────────────────────────────────────────────────────────────
  const compress = useCallback(async () => {
    if (!original) return;

    // Cancel any running compression
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    setCompressing(true);
    setProgress(0);
    setNotif(null);

    try {
      const result = await runCompression(original.file, quality, preserveExif, setProgress);

      if (compressed?.url) URL.revokeObjectURL(compressed.url);
      const url = URL.createObjectURL(result);
      setCompressed({ file: result, url });
      setSettingsDirty(false);
      setSliderX(50);

      const saved = original.file.size - result.size;
      const pct   = Math.round((saved / original.file.size) * 100);
      if (saved > 0) {
        notify("success", `Compressed by ${pct}% — saved ${formatBytes(saved)}.`);
      } else {
        notify("info", "The compressed file is the same size or larger (already optimised).");
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      notify("error", err instanceof Error ? err.message : "Compression failed. Try a different image.");
    } finally {
      setCompressing(false);
      setProgress(0);
    }
  }, [original, quality, preserveExif, compressed, notify]);

  // Auto-compress on first load (wrapped in async to avoid synchronous setState in effect body)
  useEffect(() => {
    if (!original || compressed || compressing) return;
    async function autoCompress() { await compress(); }
    autoCompress();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [original]);

  // ── Slider drag ───────────────────────────────────────────────────────────
  const updateSlider = useCallback((clientX: number) => {
    const el = sliderRef.current;
    if (!el) return;
    const { left, width } = el.getBoundingClientRect();
    setSliderX(Math.max(0, Math.min(100, ((clientX - left) / width) * 100)));
  }, []);

  useEffect(() => {
    if (!draggingSlider) return;
    const onMove = (e: MouseEvent | TouchEvent) => {
      const x = "touches" in e ? e.touches[0].clientX : e.clientX;
      updateSlider(x);
    };
    const onUp = () => setDraggingSlider(false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("mouseup",   onUp);
    window.addEventListener("touchend",  onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("mouseup",   onUp);
      window.removeEventListener("touchend",  onUp);
    };
  }, [draggingSlider, updateSlider]);

  // ── Download ──────────────────────────────────────────────────────────────
  const download = useCallback(() => {
    if (!compressed || !original) return;
    const mime = outputMime(original.file.type);
    const ext  = outputExt(mime);
    downloadBlob(compressed.file, `${baseName(original.file.name)}-compressed.${ext}`);
  }, [compressed, original]);

  // ── Reset ─────────────────────────────────────────────────────────────────
  const reset = useCallback(() => {
    abortRef.current?.abort();
    if (original?.url)   URL.revokeObjectURL(original.url);
    if (compressed?.url) URL.revokeObjectURL(compressed.url);
    setOriginal(null);
    setCompressed(null);
    setCompressing(false);
    setProgress(0);
    setSettingsDirty(false);
    setNotif(null);
    if (inputRef.current) inputRef.current.value = "";
  }, [original, compressed]);

  // ── Derived ───────────────────────────────────────────────────────────────
  const savedBytes   = original && compressed ? Math.max(0, original.file.size - compressed.file.size) : 0;
  const savedPct     = original && compressed ? Math.round((savedBytes / original.file.size) * 100) : 0;
  const isLarger     = original && compressed ? compressed.file.size > original.file.size : false;
  const isPng        = original?.file.type === "image/png";

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
            <span className="material-symbols-outlined text-[32px]" style={{ color: "#4cd7f6" }}>photo_size_select_large</span>
          </div>
          <div className="text-center">
            <p className="font-semibold text-base" style={{ color: "#e8dff0" }}>
              {draggingOver ? "Drop your image here" : "Drag & drop an image here"}
            </p>
            <p className="text-sm mt-1" style={{ color: "#988d9f" }}>
              or click to browse — JPG, PNG, WEBP, AVIF · max 50 MB
            </p>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED_EXT}
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) loadFile(f); }}
          />
        </div>
      )}

      {/* Notification */}
      {notif && (
        <div
          className="flex items-start gap-3 p-4 rounded-2xl text-sm font-medium"
          style={{
            background: notif.type === "error" ? "rgba(255,100,100,0.1)" : notif.type === "success" ? "rgba(100,220,150,0.1)" : "rgba(76,215,246,0.1)",
            border: `1px solid ${notif.type === "error" ? "rgba(255,100,100,0.25)" : notif.type === "success" ? "rgba(100,220,150,0.25)" : "rgba(76,215,246,0.25)"}`,
            color: notif.type === "error" ? "#ff8080" : notif.type === "success" ? "#80e0a0" : "#4cd7f6",
          }}
        >
          <span className="material-symbols-outlined text-[18px] mt-0.5 shrink-0">
            {notif.type === "error" ? "error" : notif.type === "success" ? "check_circle" : "info"}
          </span>
          <span>{notif.message}</span>
          <button onClick={() => setNotif(null)} className="ml-auto shrink-0 opacity-60 hover:opacity-100 transition-opacity">
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
              {original.file.type.replace("image/", "").toUpperCase()} · {formatBytes(original.file.size)}
            </p>
          </div>
          <button onClick={reset} disabled={compressing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
            style={{ background: "rgba(255,255,255,0.06)", color: "#988d9f", border: "1px solid rgba(255,255,255,0.08)" }}>
            <span className="material-symbols-outlined text-[14px]">close</span>
            Reset
          </button>
        </div>
      )}

      {/* Before / After slider */}
      {original && compressed && (
        <div className="glass-panel rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="flex justify-between px-4 py-2.5 text-xs font-semibold" style={{ color: "#988d9f" }}>
            <span>ORIGINAL</span>
            <span>COMPRESSED</span>
          </div>
          <div
            ref={sliderRef}
            className="relative select-none"
            style={{ cursor: "col-resize" }}
            onMouseDown={(e) => { e.preventDefault(); setDraggingSlider(true); updateSlider(e.clientX); }}
            onTouchStart={(e) => { setDraggingSlider(true); updateSlider(e.touches[0].clientX); }}
          >
            {/* Compressed (base layer) */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={compressed.url} alt="Compressed" className="w-full block" draggable={false} />

            {/* Original overlay — shows LEFT side */}
            <div
              className="absolute inset-0 overflow-hidden"
              style={{ clipPath: `inset(0 ${100 - sliderX}% 0 0)` }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={original.url} alt="Original" className="w-full h-full object-cover" draggable={false} />
            </div>

            {/* Handle */}
            <div
              className="absolute top-0 bottom-0 flex items-center justify-center pointer-events-none"
              style={{ left: `${sliderX}%`, transform: "translateX(-50%)", width: "2px" }}
            >
              <div className="absolute inset-0" style={{ background: "rgba(255,255,255,0.85)" }} />
              <div className="relative z-10 w-9 h-9 rounded-full flex items-center justify-center shadow-lg"
                style={{ background: "#ffffff", boxShadow: "0 2px 12px rgba(0,0,0,0.4)" }}>
                <span className="material-symbols-outlined text-[18px]" style={{ color: "#131313" }}>swap_horiz</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Original-only preview (before compression completes) */}
      {original && !compressed && !compressing && (
        <div className="glass-panel rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={original.url} alt="Original" className="w-full block" />
        </div>
      )}

      {/* Compression progress */}
      {compressing && (
        <div className="glass-panel rounded-2xl p-5 flex flex-col gap-3"
          style={{ border: "1px solid rgba(76,215,246,0.15)" }}>
          <div className="flex items-center gap-3">
            <span className="w-5 h-5 border-2 border-[rgba(76,215,246,0.3)] border-t-[#4cd7f6] rounded-full animate-spin shrink-0" />
            <span className="text-sm font-medium" style={{ color: "#4cd7f6" }}>Compressing image…</span>
            <span className="ml-auto text-sm font-bold tabular-nums" style={{ color: "#ddb7ff" }}>{progress}%</span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
            <div className="h-full rounded-full transition-all duration-200"
              style={{ width: `${progress}%`, background: "linear-gradient(90deg,#4cd7f6,#ddb7ff)" }} />
          </div>
        </div>
      )}

      {/* Stats */}
      {original && compressed && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Original",   value: formatBytes(original.file.size),   icon: "photo_library" },
            { label: "Compressed", value: formatBytes(compressed.file.size),  icon: "compress" },
            { label: "Saved",
              value: isLarger ? "—" : `${savedPct}%`,
              icon: "trending_down",
              accent: !isLarger && savedPct > 0 },
            { label: "Space saved",
              value: isLarger ? "Larger" : formatBytes(savedBytes),
              icon: "data_saver_on",
              accent: !isLarger && savedBytes > 0 },
          ].map(({ label, value, icon, accent }) => (
            <div key={label} className="glass-panel rounded-2xl p-4 flex flex-col gap-1"
              style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
              <span className="material-symbols-outlined text-[16px]"
                style={{ color: accent ? "#4cd7f6" : "#988d9f" }}>{icon}</span>
              <p className="text-lg font-bold tabular-nums leading-tight"
                style={{ color: accent ? "#4cd7f6" : "#e8dff0" }}>{value}</p>
              <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#988d9f" }}>{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Settings */}
      {original && (
        <div className="glass-panel rounded-2xl p-5 flex flex-col gap-5"
          style={{ border: "1px solid rgba(255,255,255,0.06)" }}>

          {/* Presets */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "#988d9f" }}>Preset</p>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((p) => {
                const active = quality === p.quality;
                return (
                  <button key={p.label} onClick={() => { setQuality(p.quality); setSettingsDirty(true); }}
                    aria-pressed={active}
                    className="px-3.5 py-2 rounded-xl text-[13px] font-semibold transition-all duration-200"
                    style={{
                      background: active ? "rgba(76,215,246,0.15)" : "rgba(255,255,255,0.04)",
                      color: active ? "#4cd7f6" : "#988d9f",
                      border: `1px solid ${active ? "rgba(76,215,246,0.35)" : "rgba(255,255,255,0.08)"}`,
                    }}>
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quality slider */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#988d9f" }}>
                Quality{isPng ? " (PNG is lossless)" : ""}
              </p>
              <span className="text-sm font-bold tabular-nums" style={{ color: "#ddb7ff" }}>{quality}</span>
            </div>
            <input
              type="range" min={1} max={100} value={quality}
              onChange={(e) => { setQuality(Number(e.target.value)); setSettingsDirty(true); }}
              className="w-full h-2 rounded-full appearance-none cursor-pointer"
              style={{
                background: `linear-gradient(to right, #ddb7ff ${quality}%, rgba(255,255,255,0.1) ${quality}%)`,
                accentColor: "#ddb7ff",
              }}
              disabled={isPng}
            />
            <div className="flex justify-between mt-1.5">
              <span className="text-[11px]" style={{ color: "#4d4354" }}>Smaller file</span>
              <span className="text-[11px]" style={{ color: "#4d4354" }}>Higher quality</span>
            </div>
          </div>

          {/* EXIF toggle */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold" style={{ color: "#e8dff0" }}>Preserve EXIF metadata</p>
              <p className="text-xs mt-0.5" style={{ color: "#988d9f" }}>Keep camera settings, GPS, and other metadata</p>
            </div>
            <button
              onClick={() => { setPreserveExif((v) => !v); setSettingsDirty(true); }}
              role="switch"
              aria-checked={preserveExif}
              className="relative w-11 h-6 rounded-full transition-all duration-200 shrink-0"
              style={{ background: preserveExif ? "#ddb7ff" : "rgba(255,255,255,0.12)" }}
            >
              <span
                className="absolute top-0.5 w-5 h-5 rounded-full shadow-md transition-all duration-200"
                style={{
                  left: preserveExif ? "calc(100% - 22px)" : "2px",
                  background: preserveExif ? "#1a0d2e" : "#988d9f",
                }}
              />
            </button>
          </div>
        </div>
      )}

      {/* Compress / Re-compress button */}
      {original && (
        <button
          onClick={compress}
          disabled={compressing}
          className="btn-primary flex items-center justify-center gap-2 py-4 rounded-2xl font-bold text-base transition-all"
          style={{
            opacity: compressing ? 0.5 : 1,
            cursor: compressing ? "not-allowed" : "pointer",
            boxShadow: settingsDirty && !compressing ? "0 0 20px rgba(221,183,255,0.35)" : undefined,
          }}
        >
          {compressing ? (
            <><span className="w-5 h-5 border-2 border-[rgba(255,255,255,0.3)] border-t-white rounded-full animate-spin" />
              Compressing…</>
          ) : (
            <><span className="material-symbols-outlined text-[20px]">compress</span>
              {compressed && settingsDirty ? "Re-compress" : compressed ? "Compress again" : "Compress"}</>
          )}
        </button>
      )}

      {/* Download */}
      {compressed && (
        <div className="flex flex-wrap gap-3">
          <button
            onClick={download}
            className="btn-primary flex items-center gap-2 px-6 py-3 rounded-2xl font-bold text-sm flex-1 justify-center"
          >
            <span className="material-symbols-outlined text-[18px]">download</span>
            Download compressed
          </button>
          <button
            onClick={reset}
            className="flex items-center gap-2 px-5 py-3 rounded-2xl font-bold text-sm transition-all"
            style={{
              background: "rgba(255,255,255,0.05)",
              color: "#988d9f",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <span className="material-symbols-outlined text-[18px]">add_photo_alternate</span>
            New image
          </button>
        </div>
      )}

      {/* Empty state */}
      {!original && !notif && (
        <p className="text-center text-sm" style={{ color: "#4d4354" }}>
          Upload an image to compress it — all processing happens in your browser
        </p>
      )}
    </div>
  );
}
