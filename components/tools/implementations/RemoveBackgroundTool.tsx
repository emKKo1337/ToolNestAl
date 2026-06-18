"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { activeProvider } from "@/lib/backgroundRemoval";

// ─── Constants ────────────────────────────────────────────────────────────────
const MAX_FILE_BYTES = 20 * 1024 * 1024;
const ACCEPTED = ["image/png", "image/jpeg", "image/webp"];

// ─── Types ────────────────────────────────────────────────────────────────────
type BgOption = "transparent" | "white" | "black" | "custom" | "gradient-brand" | "gradient-sunset" | "gradient-ocean";
type NotifType = "success" | "error" | "info";

interface GradientStop { offset: number; color: string }

const GRADIENTS: Record<string, GradientStop[]> = {
  "gradient-brand":  [{ offset: 0, color: "#2d1b69" }, { offset: 1, color: "#0b2341" }],
  "gradient-sunset": [{ offset: 0, color: "#c94b4b" }, { offset: 1, color: "#f7c59f" }],
  "gradient-ocean":  [{ offset: 0, color: "#134e5e" }, { offset: 1, color: "#4cd7f6" }],
};

const BG_LABEL: Record<BgOption, string> = {
  transparent:       "Transparent",
  white:             "White",
  black:             "Black",
  custom:            "Color",
  "gradient-brand":  "Purple Night",
  "gradient-sunset": "Sunset",
  "gradient-ocean":  "Ocean",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1_048_576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1_048_576).toFixed(2)} MB`;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

async function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function compositeToCanvas(
  resultUrl: string,
  bg: BgOption,
  customColor: string,
): Promise<HTMLCanvasElement> {
  const img = await loadImage(resultUrl);
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d")!;

  if (bg === "white") {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  } else if (bg === "black") {
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  } else if (bg === "custom") {
    ctx.fillStyle = customColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  } else if (bg in GRADIENTS) {
    const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    GRADIENTS[bg].forEach(({ offset, color }) => grad.addColorStop(offset, color));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  // transparent: leave canvas empty (default transparent)

  ctx.drawImage(img, 0, 0);
  return canvas;
}

async function canvasToBlob(canvas: HTMLCanvasElement, mimeType: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error("Export failed")),
      mimeType,
      quality,
    );
  });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function BgChip({ label, active, onClick, preview }: { label: string; active: boolean; onClick: () => void; preview?: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className="flex flex-col items-center gap-1.5 group select-none"
    >
      <div
        className="w-10 h-10 rounded-xl overflow-hidden transition-all duration-150"
        style={{
          border: `2px solid ${active ? "#ddb7ff" : "rgba(255,255,255,0.1)"}`,
          boxShadow: active ? "0 0 10px rgba(221,183,255,0.3)" : undefined,
        }}
      >
        {preview}
      </div>
      <span className="text-[11px] font-semibold transition-colors" style={{ color: active ? "#ddb7ff" : "#988d9f" }}>
        {label}
      </span>
    </button>
  );
}

function CheckerSwatch() {
  return (
    <div
      className="w-full h-full"
      style={{
        backgroundImage: "linear-gradient(45deg,#ccc 25%,transparent 25%),linear-gradient(-45deg,#ccc 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#ccc 75%),linear-gradient(-45deg,transparent 75%,#ccc 75%)",
        backgroundSize: "8px 8px",
        backgroundPosition: "0 0,0 4px,4px -4px,-4px 0",
        background: "#fff",
      }}
    />
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function RemoveBackgroundTool() {
  const [original, setOriginal] = useState<{ file: File; url: string } | null>(null);
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [compositeUrl, setCompositeUrl] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState<{ pct: number; stage: string } | null>(null);
  const [draggingOver, setDraggingOver] = useState(false);
  const [bg, setBg] = useState<BgOption>("transparent");
  const [customColor, setCustomColor] = useState("#a855f7");
  const [sliderX, setSliderX] = useState(50);
  const [draggingSlider, setDraggingSlider] = useState(false);
  const [notif, setNotif] = useState<{ type: NotifType; message: string } | null>(null);

  const dropRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const sliderContainerRef = useRef<HTMLDivElement>(null);
  const prevCompositeUrl = useRef<string | null>(null);

  const notify = useCallback((type: NotifType, message: string) => {
    setNotif({ type, message });
    if (type !== "info") setTimeout(() => setNotif(null), 8000);
  }, []);

  // ── Recompute composite whenever result or background changes ──────────────
  useEffect(() => {
    let cancelled = false;

    async function update() {
      if (!resultUrl) {
        if (!cancelled) setCompositeUrl(null);
        return;
      }
      try {
        const canvas = await compositeToCanvas(resultUrl, bg, customColor);
        if (cancelled) return;
        const dataUrl = canvas.toDataURL("image/png");
        setCompositeUrl(dataUrl);
        if (prevCompositeUrl.current?.startsWith("blob:")) {
          URL.revokeObjectURL(prevCompositeUrl.current);
        }
        prevCompositeUrl.current = dataUrl;
      } catch { /* ignore mid-flight cancellation */ }
    }

    update();
    return () => { cancelled = true; };
  }, [resultUrl, bg, customColor]);

  // ── Cleanup on unmount ────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (original?.url) URL.revokeObjectURL(original.url);
      if (resultUrl) URL.revokeObjectURL(resultUrl);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── File loading ──────────────────────────────────────────────────────────
  const loadFile = useCallback(async (file: File) => {
    if (!ACCEPTED.includes(file.type)) {
      notify("error", `"${file.name}" is not a supported image. Upload a PNG, JPG, or WEBP file.`);
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      notify("error", `"${file.name}" exceeds the 20 MB limit.`);
      return;
    }

    if (original?.url) URL.revokeObjectURL(original.url);
    if (resultUrl) URL.revokeObjectURL(resultUrl);

    const url = URL.createObjectURL(file);
    setOriginal({ file, url });
    setResultBlob(null);
    setResultUrl(null);
    setCompositeUrl(null);
    setSliderX(50);
    setNotif(null);
  }, [original, resultUrl, notify]);

  // ── Drop zone ─────────────────────────────────────────────────────────────
  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDraggingOver(false);
    const file = e.dataTransfer.files[0]; if (file) loadFile(file);
  }, [loadFile]);

  const onDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); setDraggingOver(true); }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    if (dropRef.current && !dropRef.current.contains(e.relatedTarget as Node)) setDraggingOver(false);
  }, []);

  // ── Process ───────────────────────────────────────────────────────────────
  const process = useCallback(async () => {
    if (!original) return;
    setProcessing(true);
    setProgress({ pct: 0, stage: "Starting…" });
    setNotif(null);

    try {
      const blob = await activeProvider.remove(original.file, (pct, stage) => {
        setProgress({ pct, stage });
      });

      const url = URL.createObjectURL(blob);
      setResultBlob(blob);
      setResultUrl(url);
      setSliderX(50);
      notify("success", "Background removed successfully!");
    } catch (err) {
      notify("error", err instanceof Error ? err.message : "Background removal failed. Please try again.");
    } finally {
      setProcessing(false);
      setProgress(null);
    }
  }, [original, notify]);

  // ── Slider drag ───────────────────────────────────────────────────────────
  const updateSlider = useCallback((clientX: number) => {
    const el = sliderContainerRef.current;
    if (!el) return;
    const { left, width } = el.getBoundingClientRect();
    const pct = Math.max(0, Math.min(100, ((clientX - left) / width) * 100));
    setSliderX(pct);
  }, []);

  useEffect(() => {
    if (!draggingSlider) return;
    const onMove = (e: MouseEvent | TouchEvent) => {
      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
      updateSlider(clientX);
    };
    const onUp = () => setDraggingSlider(false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchend", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchend", onUp);
    };
  }, [draggingSlider, updateSlider]);

  // ── Downloads ─────────────────────────────────────────────────────────────
  const downloadAs = useCallback(async (format: "png" | "webp" | "original") => {
    const base = original?.file.name.replace(/\.[^.]+$/, "") ?? "image";

    if (format === "original" && original) {
      downloadBlob(original.file, original.file.name);
      return;
    }

    if (!resultBlob) return;

    const canvas = await compositeToCanvas(resultUrl!, bg, customColor);

    if (format === "png") {
      const blob = await canvasToBlob(canvas, "image/png");
      downloadBlob(blob, `${base}-no-bg.png`);
    } else {
      const blob = await canvasToBlob(canvas, "image/webp", 0.92);
      downloadBlob(blob, `${base}-no-bg.webp`);
    }
  }, [original, resultBlob, resultUrl, bg, customColor]);

  // ── Reset ─────────────────────────────────────────────────────────────────
  const reset = useCallback(() => {
    if (original?.url) URL.revokeObjectURL(original.url);
    if (resultUrl) URL.revokeObjectURL(resultUrl);
    setOriginal(null);
    setResultBlob(null);
    setResultUrl(null);
    setCompositeUrl(null);
    setBg("transparent");
    setProcessing(false);
    setProgress(null);
    setNotif(null);
    if (inputRef.current) inputRef.current.value = "";
  }, [original, resultUrl]);

  // ─── Render ───────────────────────────────────────────────────────────────

  const bgOptions: BgOption[] = ["transparent", "white", "black", "custom", "gradient-brand", "gradient-sunset", "gradient-ocean"];

  return (
    <div className="mb-12 flex flex-col gap-6">

      {/* Drop zone */}
      {!original && (
        <div
          ref={dropRef}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onClick={() => inputRef.current?.click()}
          role="button"
          tabIndex={0}
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
            <span className="material-symbols-outlined text-[32px]" style={{ color: "#4cd7f6" }}>auto_fix_high</span>
          </div>
          <div className="text-center">
            <p className="font-semibold text-base" style={{ color: "#e8dff0" }}>
              {draggingOver ? "Drop your image here" : "Drag & drop an image here"}
            </p>
            <p className="text-sm mt-1" style={{ color: "#988d9f" }}>or click to browse — PNG, JPG, WEBP · max 20 MB</p>
          </div>
          <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) loadFile(f); }} />
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
            <p className="text-xs mt-0.5" style={{ color: "#988d9f" }}>{formatBytes(original.file.size)}</p>
          </div>
          <button onClick={reset} disabled={processing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
            style={{ background: "rgba(255,255,255,0.06)", color: "#988d9f", border: "1px solid rgba(255,255,255,0.08)" }}>
            <span className="material-symbols-outlined text-[14px]">close</span>
            Reset
          </button>
        </div>
      )}

      {/* Before / After slider (shown once we have a result) */}
      {original && resultUrl && compositeUrl && (
        <div className="glass-panel rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
          {/* Labels */}
          <div className="flex justify-between px-4 py-2 text-xs font-semibold" style={{ color: "#988d9f" }}>
            <span>BEFORE</span>
            <span>AFTER</span>
          </div>

          {/* Slider area */}
          <div
            ref={sliderContainerRef}
            className="relative select-none"
            style={{ cursor: "col-resize", aspectRatio: "auto" }}
            onMouseDown={(e) => { e.preventDefault(); setDraggingSlider(true); updateSlider(e.clientX); }}
            onTouchStart={(e) => { setDraggingSlider(true); updateSlider(e.touches[0].clientX); }}
          >
            {/* After / Result (base layer) */}
            <div
              className="w-full"
              style={{
                background: bg === "transparent"
                  ? "linear-gradient(45deg,#444 25%,transparent 25%),linear-gradient(-45deg,#444 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#444 75%),linear-gradient(-45deg,transparent 75%,#444 75%)"
                  : undefined,
                backgroundSize: bg === "transparent" ? "16px 16px" : undefined,
                backgroundPosition: bg === "transparent" ? "0 0,0 8px,8px -8px,-8px 0" : undefined,
                backgroundColor: bg === "transparent" ? "#666" : undefined,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={compositeUrl} alt="Result" className="w-full block" draggable={false} />
            </div>

            {/* Before / Original overlay — clipped to left portion */}
            <div
              className="absolute inset-0 overflow-hidden"
              style={{ clipPath: `inset(0 ${100 - sliderX}% 0 0)` }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={original.url} alt="Original" className="w-full h-full object-cover" draggable={false} />
            </div>

            {/* Handle line */}
            <div
              className="absolute top-0 bottom-0 flex items-center justify-center pointer-events-none"
              style={{ left: `${sliderX}%`, transform: "translateX(-50%)", width: "2px" }}
            >
              <div className="absolute inset-0" style={{ background: "rgba(255,255,255,0.85)" }} />
              <div
                className="relative z-10 w-9 h-9 rounded-full flex items-center justify-center shadow-lg"
                style={{ background: "#ffffff", boxShadow: "0 2px 12px rgba(0,0,0,0.4)" }}
              >
                <span className="material-symbols-outlined text-[18px]" style={{ color: "#131313" }}>swap_horiz</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Original-only preview (before processing) */}
      {original && !resultUrl && !processing && (
        <div className="glass-panel rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={original.url} alt="Original" className="w-full block" />
        </div>
      )}

      {/* Processing progress */}
      {processing && progress && (
        <div className="glass-panel rounded-2xl p-5 flex flex-col gap-3" style={{ border: "1px solid rgba(76,215,246,0.15)" }}>
          <div className="flex items-center gap-3">
            <span className="w-5 h-5 border-2 border-[rgba(76,215,246,0.3)] border-t-[#4cd7f6] rounded-full animate-spin shrink-0" />
            <span className="text-sm font-medium" style={{ color: "#4cd7f6" }}>{progress.stage}</span>
            <span className="ml-auto text-sm font-bold tabular-nums" style={{ color: "#ddb7ff" }}>{progress.pct}%</span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{ width: `${progress.pct}%`, background: "linear-gradient(90deg,#4cd7f6,#ddb7ff)" }}
            />
          </div>
          <p className="text-xs" style={{ color: "#988d9f" }}>
            {progress.stage.includes("Downloading") ? "AI model downloading — this only happens once." : "Running AI inference in your browser…"}
          </p>
        </div>
      )}

      {/* Background options (shown after result) */}
      {resultUrl && (
        <div className="glass-panel rounded-2xl p-5 flex flex-col gap-4" style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#988d9f" }}>Background</p>
          <div className="flex flex-wrap gap-4">
            {bgOptions.map((opt) => {
              let preview: React.ReactNode;
              if (opt === "transparent") {
                preview = <CheckerSwatch />;
              } else if (opt === "white") {
                preview = <div className="w-full h-full bg-white" />;
              } else if (opt === "black") {
                preview = <div className="w-full h-full bg-black" />;
              } else if (opt === "custom") {
                preview = <div className="w-full h-full" style={{ background: customColor }} />;
              } else {
                const stops = GRADIENTS[opt];
                preview = (
                  <div className="w-full h-full" style={{ background: `linear-gradient(135deg,${stops[0].color},${stops[1].color})` }} />
                );
              }
              return (
                <BgChip key={opt} label={BG_LABEL[opt]} active={bg === opt} onClick={() => setBg(opt)} preview={preview} />
              );
            })}
          </div>

          {/* Custom color picker */}
          {bg === "custom" && (
            <div className="flex items-center gap-3 mt-1">
              <label className="text-sm font-medium" style={{ color: "#988d9f" }}>Color</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={customColor}
                  onChange={(e) => setCustomColor(e.target.value)}
                  className="w-10 h-10 rounded-xl cursor-pointer border-0 p-0"
                  style={{ background: "none" }}
                />
                <span className="text-sm font-mono" style={{ color: "#ddb7ff" }}>{customColor.toUpperCase()}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Remove Background button */}
      {original && !resultUrl && (
        <button
          onClick={process}
          disabled={processing}
          className="btn-primary flex items-center justify-center gap-2 py-4 rounded-2xl font-bold text-base transition-all"
          style={{ opacity: processing ? 0.5 : 1, cursor: processing ? "not-allowed" : "pointer" }}
        >
          {processing ? (
            <><span className="w-5 h-5 border-2 border-[rgba(255,255,255,0.3)] border-t-white rounded-full animate-spin" />Processing…</>
          ) : (
            <><span className="material-symbols-outlined text-[20px]">auto_fix_high</span>Remove Background</>
          )}
        </button>
      )}

      {/* Download buttons */}
      {resultUrl && (
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => downloadAs("png")}
            className="btn-primary flex items-center gap-2 px-5 py-3 rounded-2xl font-bold text-sm flex-1 justify-center"
          >
            <span className="material-symbols-outlined text-[18px]">download</span>
            Download PNG
          </button>
          <button
            onClick={() => downloadAs("webp")}
            className="flex items-center gap-2 px-5 py-3 rounded-2xl font-bold text-sm flex-1 justify-center transition-all"
            style={{
              background: "rgba(76,215,246,0.12)",
              color: "#4cd7f6",
              border: "1px solid rgba(76,215,246,0.3)",
            }}
          >
            <span className="material-symbols-outlined text-[18px]">download</span>
            Download WEBP
          </button>
          <button
            onClick={() => downloadAs("original")}
            className="flex items-center gap-2 px-5 py-3 rounded-2xl font-bold text-sm transition-all"
            style={{
              background: "rgba(255,255,255,0.05)",
              color: "#988d9f",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <span className="material-symbols-outlined text-[18px]">photo</span>
            Original
          </button>
        </div>
      )}

      {/* New image button (after processing) */}
      {resultUrl && (
        <button
          onClick={reset}
          className="text-sm font-semibold flex items-center justify-center gap-1.5 transition-opacity hover:opacity-80"
          style={{ color: "#988d9f" }}
        >
          <span className="material-symbols-outlined text-[16px]">add_photo_alternate</span>
          Process another image
        </button>
      )}

      {/* Empty state hint */}
      {!original && !notif && (
        <p className="text-center text-sm" style={{ color: "#4d4354" }}>
          Upload an image to get started — AI runs entirely in your browser
        </p>
      )}
    </div>
  );
}
