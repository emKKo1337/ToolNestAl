"use client";

/**
 * Grayscale Converter
 *
 * Five conversion modes — all per-pixel, fully client-side:
 *
 *   Standard     — ITU-R BT.709  (0.2126R + 0.7152G + 0.0722B)  perceptual
 *   Luminosity   — ITU-R BT.601  (0.299R  + 0.587G  + 0.114B)   classic TV
 *   Average      — (R + G + B) / 3                               simplest
 *   Desaturation — (max(R,G,B) + min(R,G,B)) / 2                HSL lightness
 *   High Contrast— BT.709 lum → smoothstep S-curve              dramatic look
 *
 * Additional controls:
 *   Intensity  0–100  blend from colour (0%) to full grayscale (100%)
 *   Contrast  −100…+100  Reinhard around midpoint 128
 *   Brightness−100…+100  additive shift
 *
 * Uses the same two-tier RAF pattern as BrightnessContrastTool:
 *   recompute() — converts preview canvas → stores in processedPrevRef
 *   drawCanvas()— composites orig / processed with clip at splitPos (cheap)
 */

import { useState, useRef, useCallback, useEffect } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────
type GrayscaleMode = "standard" | "luminosity" | "average" | "desaturation" | "highcontrast";
type OutFormat     = "jpg" | "png" | "webp";

interface ImgState {
  file:   File;
  srcUrl: string;
  img:    HTMLImageElement;
  natW:   number;
  natH:   number;
}

// ── Mode definitions ──────────────────────────────────────────────────────────
const MODES: { id: GrayscaleMode; label: string; desc: string; icon: string }[] = [
  { id: "standard",     label: "Standard",      desc: "BT.709 · perceptual",  icon: "tonality"       },
  { id: "luminosity",   label: "Luminosity",    desc: "BT.601 · classic TV",  icon: "light_mode"     },
  { id: "average",      label: "Average",       desc: "Simple (R+G+B)÷3",     icon: "calculate"      },
  { id: "desaturation", label: "Desaturation",  desc: "HSL lightness",        icon: "invert_colors"  },
  { id: "highcontrast", label: "High Contrast", desc: "S-curve · dramatic",   icon: "contrast"       },
];

// ── Grayscale pixel computation ───────────────────────────────────────────────
function toGray(r: number, g: number, b: number, mode: GrayscaleMode): number {
  switch (mode) {
    case "standard":      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    case "luminosity":    return 0.299  * r + 0.587  * g + 0.114  * b;
    case "average":       return (r + g + b) / 3;
    case "desaturation":  return (Math.max(r, g, b) + Math.min(r, g, b)) / 2;
    case "highcontrast": {
      const t = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
      return 255 * t * t * (3 - 2 * t); // smoothstep: dark→darker, bright→brighter
    }
  }
}

function applyGrayscale(
  src:        CanvasImageSource,
  outW:       number,
  outH:       number,
  mode:       GrayscaleMode,
  intensity:  number,   // 0–100
  contrast:   number,   // −100…+100
  brightness: number,   // −100…+100
): HTMLCanvasElement {
  const canvas  = document.createElement("canvas");
  canvas.width  = outW;
  canvas.height = outH;
  const ctx     = canvas.getContext("2d")!;
  ctx.drawImage(src, 0, 0, outW, outH);

  const id    = ctx.getImageData(0, 0, outW, outH);
  const d     = id.data;
  const blend = intensity / 100;
  const cF    = (259 * (contrast + 255)) / (255 * (259 - contrast));

  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i + 1], b = d[i + 2];

    let gray = toGray(r, g, b, mode);
    gray    += brightness * 2.55;
    gray     = cF * (gray - 128) + 128;

    const gv = Math.max(0, Math.min(255, Math.round(gray)));

    d[i]   = Math.round(r * (1 - blend) + gv * blend);
    d[i+1] = Math.round(g * (1 - blend) + gv * blend);
    d[i+2] = Math.round(b * (1 - blend) + gv * blend);
    // d[i+3] alpha unchanged
  }

  ctx.putImageData(id, 0, 0);
  return canvas;
}

// ── Generic helpers ───────────────────────────────────────────────────────────
function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img    = new Image();
    img.onload   = () => res(img);
    img.onerror  = () => rej(new Error("Failed to load image"));
    img.src      = src;
  });
}

function fmtSize(b: number): string {
  if (b < 1024)       return `${b} B`;
  if (b < 1_048_576)  return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1_048_576).toFixed(2)} MB`;
}

function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement("a");
  a.href    = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

const ACCEPT      = "image/jpeg,image/png,image/webp,image/gif,image/bmp,image/tiff,image/avif";
const MAX_PREV_H  = 460;
const ACCENT      = "#4cd7f6";

// ── Component ─────────────────────────────────────────────────────────────────
export default function GrayscaleConverterTool() {
  const [imgState,    setImgState]    = useState<ImgState | null>(null);
  const [mode,        setMode]        = useState<GrayscaleMode>("standard");
  const [intensity,   setIntensity]   = useState(100);
  const [contrast,    setContrast]    = useState(0);
  const [brightness,  setBrightness]  = useState(0);
  const [outFormat,   setOutFormat]   = useState<OutFormat>("jpg");
  const [quality,     setQuality]     = useState(90);
  const [applying,    setApplying]    = useState(false);
  const [resultBlob,  setResultBlob]  = useState<Blob | null>(null);
  const [resultUrl,   setResultUrl]   = useState<string | null>(null);
  const [splitPos,    setSplitPos]    = useState(50);
  const [isDragging,  setIsDragging]  = useState(false);
  const [dropActive,  setDropActive]  = useState(false);
  const [error,       setError]       = useState<string | null>(null);

  const imgStateRef      = useRef<ImgState | null>(null);
  const splitPosRef      = useRef(50);
  const origPrevRef      = useRef<HTMLCanvasElement | null>(null);
  const processedPrevRef = useRef<HTMLCanvasElement | null>(null);

  imgStateRef.current = imgState;
  splitPosRef.current = splitPos;

  const previewCanvasRef    = useRef<HTMLCanvasElement>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef        = useRef<HTMLInputElement>(null);
  const rafComputeRef       = useRef<number>(0);
  const rafDrawRef          = useRef<number>(0);
  const roRef               = useRef<ResizeObserver | null>(null);

  // ── Cheap redraw ────────────────────────────────────────────────────────────
  const drawCanvas = useCallback(() => {
    const canvas    = previewCanvasRef.current;
    const orig      = origPrevRef.current;
    if (!canvas || !orig || !canvas.width || !canvas.height) return;

    const w      = canvas.width, h = canvas.height;
    const ctx    = canvas.getContext("2d")!;
    const splitX = Math.round(w * splitPosRef.current / 100);

    ctx.drawImage(orig, 0, 0);

    const processed = processedPrevRef.current;
    if (processed) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(splitX, 0, w - splitX, h);
      ctx.clip();
      ctx.drawImage(processed, 0, 0);
      ctx.restore();
    }

    ctx.strokeStyle = ACCENT;
    ctx.lineWidth   = 2;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(splitX, 0);
    ctx.lineTo(splitX, h);
    ctx.stroke();
  }, []);

  // ── Expensive recompute ─────────────────────────────────────────────────────
  const recompute = useCallback(() => {
    const st        = imgStateRef.current;
    const container = previewContainerRef.current;
    const canvas    = previewCanvasRef.current;
    if (!st || !container || !canvas) return;

    const { img, natW, natH } = st;
    const pW    = Math.max(1, container.clientWidth || 600);
    const scale = Math.min(pW / natW, MAX_PREV_H / natH, 1);
    const drawW = Math.max(1, Math.round(natW * scale));
    const drawH = Math.max(1, Math.round(natH * scale));
    const ox    = Math.round((pW - drawW) / 2);
    const oy    = Math.round((MAX_PREV_H - drawH) / 2);
    const pH    = MAX_PREV_H;

    canvas.width  = pW;
    canvas.height = pH;

    // Letterboxed original
    const origC  = document.createElement("canvas");
    origC.width  = pW;
    origC.height = pH;
    origC.getContext("2d")!.drawImage(img, ox, oy, drawW, drawH);
    origPrevRef.current = origC;

    // Letterboxed processed
    const subC  = document.createElement("canvas");
    subC.width  = drawW;
    subC.height = drawH;
    subC.getContext("2d")!.drawImage(img, 0, 0, drawW, drawH);

    const procSub = applyGrayscale(subC, drawW, drawH, mode, intensity, contrast, brightness);
    const procC  = document.createElement("canvas");
    procC.width  = pW;
    procC.height = pH;
    procC.getContext("2d")!.drawImage(procSub, ox, oy);
    processedPrevRef.current = procC;

    drawCanvas();
  }, [mode, intensity, contrast, brightness, drawCanvas]);

  // Trigger recompute when image or settings change
  useEffect(() => {
    cancelAnimationFrame(rafComputeRef.current);
    cancelAnimationFrame(rafDrawRef.current);
    rafComputeRef.current = requestAnimationFrame(recompute);
    return () => cancelAnimationFrame(rafComputeRef.current);
  }, [recompute, imgState]);

  // Trigger cheap redraw when only split position changes
  useEffect(() => {
    cancelAnimationFrame(rafDrawRef.current);
    rafDrawRef.current = requestAnimationFrame(drawCanvas);
    return () => cancelAnimationFrame(rafDrawRef.current);
  }, [splitPos, drawCanvas]);

  // ResizeObserver
  useEffect(() => {
    if (!previewContainerRef.current) return;
    roRef.current?.disconnect();
    roRef.current = new ResizeObserver(() => {
      cancelAnimationFrame(rafComputeRef.current);
      rafComputeRef.current = requestAnimationFrame(recompute);
    });
    roRef.current.observe(previewContainerRef.current);
    return () => roRef.current?.disconnect();
  }, [recompute]);

  // ── Drag split handle ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!isDragging) return;
    const onMove = (e: MouseEvent) => {
      const container = previewContainerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const pct  = Math.max(5, Math.min(95, ((e.clientX - rect.left) / rect.width) * 100));
      splitPosRef.current = pct;
      setSplitPos(pct);
      cancelAnimationFrame(rafDrawRef.current);
      rafDrawRef.current = requestAnimationFrame(drawCanvas);
    };
    const onUp = () => setIsDragging(false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup",   onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup",   onUp);
    };
  }, [isDragging, drawCanvas]);

  // ── Load file ──────────────────────────────────────────────────────────────
  const loadFile = useCallback(async (file: File) => {
    setError(null);
    setResultUrl(null);
    setResultBlob(null);
    processedPrevRef.current = null;
    origPrevRef.current      = null;
    if (!file.type.startsWith("image/")) {
      setError("Please upload an image file (JPG, PNG, WebP, GIF, BMP, TIFF, AVIF).");
      return;
    }
    const srcUrl = URL.createObjectURL(file);
    try {
      const img = await loadImg(srcUrl);
      setImgState(prev => {
        if (prev) URL.revokeObjectURL(prev.srcUrl);
        return { file, srcUrl, img, natW: img.naturalWidth, natH: img.naturalHeight };
      });
    } catch {
      URL.revokeObjectURL(srcUrl);
      setError("Could not read the image. Please try a different file.");
    }
  }, []);

  // ── Apply at full resolution ───────────────────────────────────────────────
  const applyConvert = useCallback(() => {
    if (!imgState || applying) return;
    setApplying(true);
    setError(null);
    try {
      const { img, natW, natH } = imgState;
      const out  = applyGrayscale(img, natW, natH, mode, intensity, contrast, brightness);
      const mime = outFormat === "jpg" ? "image/jpeg" : outFormat === "webp" ? "image/webp" : "image/png";
      const q    = outFormat === "png" ? undefined : quality / 100;
      out.toBlob(blob => {
        if (!blob) { setError("Failed to encode the image."); setApplying(false); return; }
        setResultBlob(blob);
        setResultUrl(prev => { if (prev) URL.revokeObjectURL(prev); return URL.createObjectURL(blob); });
        setApplying(false);
      }, mime, q);
    } catch {
      setError("Processing failed. Please try again.");
      setApplying(false);
    }
  }, [imgState, mode, intensity, contrast, brightness, outFormat, quality, applying]);

  // ── Download ───────────────────────────────────────────────────────────────
  const download = useCallback(() => {
    if (!resultBlob || !imgState) return;
    const base = imgState.file.name.replace(/\.[^.]+$/, "");
    downloadBlob(resultBlob, `${base}-grayscale.${outFormat === "jpg" ? "jpg" : outFormat}`);
  }, [resultBlob, imgState, outFormat]);

  // ── Reset / Clear ──────────────────────────────────────────────────────────
  const reset = useCallback(() => {
    setMode("standard");
    setIntensity(100);
    setContrast(0);
    setBrightness(0);
    setResultBlob(null);
    setResultUrl(prev => { if (prev) URL.revokeObjectURL(prev); return null; });
  }, []);

  const clear = useCallback(() => {
    reset();
    processedPrevRef.current = null;
    origPrevRef.current      = null;
    setImgState(prev => { if (prev) URL.revokeObjectURL(prev.srcUrl); return null; });
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [reset]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDropActive(false);
    const file = e.dataTransfer.files[0];
    if (file) loadFile(file);
  }, [loadFile]);

  const isDefault = mode === "standard" && intensity === 100 && contrast === 0 && brightness === 0;

  // ── Drop zone (no image) ───────────────────────────────────────────────────
  if (!imgState) {
    return (
      <div className="mb-12 flex flex-col gap-5">
        <div
          onDrop={onDrop}
          onDragOver={e => { e.preventDefault(); setDropActive(true); }}
          onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropActive(false); }}
          onClick={() => fileInputRef.current?.click()}
          role="button" tabIndex={0} aria-label="Upload image to convert to grayscale"
          onKeyDown={e => e.key === "Enter" && fileInputRef.current?.click()}
          className="glass-panel rounded-2xl flex flex-col items-center justify-center gap-4 cursor-pointer transition-all duration-200 select-none"
          style={{
            minHeight: 280,
            border:     `2px dashed ${dropActive ? ACCENT : "rgba(76,215,246,0.25)"}`,
            background: dropActive ? "rgba(76,215,246,0.04)" : undefined,
          }}>
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{ background: "rgba(76,215,246,0.1)" }}>
            <span className="material-symbols-outlined text-[32px]" style={{ color: ACCENT }}>filter_b_and_w</span>
          </div>
          <div className="text-center">
            <p className="font-bold text-[15px]" style={{ color: "#e8dff0" }}>
              {dropActive ? "Drop your image here" : "Drop an image or click to browse"}
            </p>
            <p className="text-[12px] mt-1" style={{ color: "#988d9f" }}>
              JPG · PNG · WebP · GIF · BMP · TIFF · AVIF
            </p>
          </div>
        </div>

        {error && (
          <div role="alert" className="flex items-center gap-3 p-4 rounded-2xl"
            style={{ background: "rgba(255,100,100,0.08)", border: "1px solid rgba(255,100,100,0.22)" }}>
            <span className="material-symbols-outlined text-[18px] text-red-400">error</span>
            <p className="text-[13px]" style={{ color: "#ff8080" }}>{error}</p>
          </div>
        )}

        <input ref={fileInputRef} type="file" accept={ACCEPT} className="sr-only"
          onChange={e => { const f = e.target.files?.[0]; if (f) loadFile(f); e.target.value = ""; }}
          aria-hidden tabIndex={-1} />
      </div>
    );
  }

  const { file, natW, natH } = imgState;

  return (
    <div className="mb-12 flex flex-col gap-5">

      {/* Stats bar */}
      <div className="glass-panel rounded-2xl px-5 py-3 flex flex-wrap items-center gap-4"
        style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
        <span className="material-symbols-outlined text-[16px]" style={{ color: ACCENT }}>image</span>
        <span className="text-[13px] font-semibold truncate max-w-xs" style={{ color: "#e8dff0" }}>{file.name}</span>
        <span className="text-[12px] tabular-nums" style={{ color: "#988d9f" }}>{natW} × {natH} px</span>
        <span className="text-[12px] tabular-nums" style={{ color: "#988d9f" }}>{fmtSize(file.size)}</span>
        <div className="flex-1" />
        <button onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold transition-all"
          style={{ background: "rgba(255,255,255,0.05)", color: "#988d9f", border: "1px solid rgba(255,255,255,0.08)" }}>
          <span className="material-symbols-outlined text-[13px]">upload</span>New Image
        </button>
        <button onClick={clear}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold transition-all"
          style={{ background: "rgba(255,255,255,0.05)", color: "#988d9f", border: "1px solid rgba(255,255,255,0.08)" }}>
          <span className="material-symbols-outlined text-[13px]">close</span>Clear
        </button>
      </div>

      {/* Split-view preview */}
      <div className="glass-panel rounded-2xl overflow-hidden"
        style={{ border: `1px solid rgba(76,215,246,0.18)` }}>
        <div className="px-4 py-2.5 flex items-center gap-3"
          style={{ borderBottom: "1px solid rgba(76,215,246,0.1)", background: "rgba(76,215,246,0.03)" }}>
          <span className="material-symbols-outlined text-[14px]" style={{ color: ACCENT }}>compare</span>
          <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: ACCENT }}>
            Before / After — drag the divider to compare
          </span>
          <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full font-semibold"
            style={{ background: "rgba(76,215,246,0.1)", color: ACCENT }}>Live</span>
        </div>

        <div ref={previewContainerRef} className="relative select-none"
          style={{
            backgroundImage: "linear-gradient(45deg,#1e1e2e 25%,transparent 25%),linear-gradient(-45deg,#1e1e2e 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#1e1e2e 75%),linear-gradient(-45deg,transparent 75%,#1e1e2e 75%)",
            backgroundSize: "16px 16px",
            backgroundPosition: "0 0,0 8px,8px -8px,-8px 0",
            backgroundColor: "#131320",
            cursor: isDragging ? "ew-resize" : "default",
          }}>
          <canvas ref={previewCanvasRef} className="block w-full"
            aria-label="Before / after grayscale comparison" />

          <div className="absolute bottom-2 left-3 px-2 py-0.5 rounded-md text-[10px] font-bold pointer-events-none"
            style={{ background: "rgba(0,0,0,0.55)", color: "#988d9f" }}>Color</div>
          <div className="absolute bottom-2 right-3 px-2 py-0.5 rounded-md text-[10px] font-bold pointer-events-none"
            style={{ background: "rgba(0,0,0,0.55)", color: ACCENT }}>Grayscale</div>

          <div className="absolute top-0 bottom-0 flex items-center justify-center z-10"
            style={{ left: `calc(${splitPos}% - 16px)`, width: 32, cursor: "ew-resize", touchAction: "none" }}
            onMouseDown={e => { e.preventDefault(); setIsDragging(true); }}
            role="slider" aria-label="Comparison divider"
            aria-valuenow={Math.round(splitPos)} aria-valuemin={5} aria-valuemax={95}>
            <div className="w-8 h-8 rounded-full shadow-xl flex items-center justify-center"
              style={{ background: ACCENT }}>
              <span className="material-symbols-outlined text-[14px] font-black" style={{ color: "#000" }}>swap_horiz</span>
            </div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="glass-panel rounded-2xl p-5 flex flex-col gap-5"
        style={{ border: "1px solid rgba(255,255,255,0.07)" }}>

        {/* Grayscale mode selector */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "#988d9f" }}>
              Conversion Mode
            </p>
            {!isDefault && (
              <button onClick={reset}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold"
                style={{ background: "rgba(255,255,255,0.05)", color: "#988d9f", border: "1px solid rgba(255,255,255,0.08)" }}>
                <span className="material-symbols-outlined text-[12px]">restart_alt</span>Reset All
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            {MODES.map(({ id, label, desc, icon }) => (
              <button key={id} onClick={() => { setMode(id); setResultBlob(null); setResultUrl(null); }}
                aria-pressed={mode === id}
                className="flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl transition-all text-center"
                style={{
                  background: mode === id ? "rgba(76,215,246,0.12)" : "rgba(255,255,255,0.03)",
                  border:     `1px solid ${mode === id ? "rgba(76,215,246,0.35)" : "rgba(255,255,255,0.07)"}`,
                  color:      mode === id ? ACCENT : "#988d9f",
                }}>
                <span className="material-symbols-outlined text-[20px]">{icon}</span>
                <p className="text-[11px] font-bold leading-tight">{label}</p>
                <p className="text-[9px] leading-tight" style={{ color: mode === id ? "rgba(76,215,246,0.6)" : "#2d2535" }}>{desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Adjustment sliders */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-8 gap-y-5 pt-1"
          style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>

          {/* Intensity */}
          {[
            {
              id: "intensity", label: "Intensity", value: intensity, min: 0, max: 100, step: 1,
              accent: ACCENT, defVal: 100,
              display: (v: number) => `${v}%`,
              set: (v: number) => { setIntensity(v); setResultBlob(null); setResultUrl(null); },
              minLabel: "Color", maxLabel: "Grayscale",
            },
            {
              id: "brightness", label: "Brightness", value: brightness, min: -100, max: 100, step: 1,
              accent: "#ffd580", defVal: 0,
              display: (v: number) => v === 0 ? "0" : v > 0 ? `+${v}` : `${v}`,
              set: (v: number) => { setBrightness(v); setResultBlob(null); setResultUrl(null); },
              minLabel: "−100", maxLabel: "+100",
            },
            {
              id: "contrast", label: "Contrast", value: contrast, min: -100, max: 100, step: 1,
              accent: "#a0c4ff", defVal: 0,
              display: (v: number) => v === 0 ? "0" : v > 0 ? `+${v}` : `${v}`,
              set: (v: number) => { setContrast(v); setResultBlob(null); setResultUrl(null); },
              minLabel: "−100", maxLabel: "+100",
            },
          ].map(({ id, label, value, min, max, step, accent, defVal, display, set, minLabel, maxLabel }) => {
            const isSliderDefault = Math.abs(value - defVal) < 0.001;
            const lo  = ((Math.min(value, defVal) - min) / (max - min)) * 100;
            const wid = (Math.abs(value - defVal) / (max - min)) * 100;
            return (
              <div key={id} className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <label htmlFor={`gs-${id}`} className="text-[12px] font-semibold" style={{ color: "#c8c0d0" }}>
                    {label}
                  </label>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[12px] font-bold tabular-nums w-10 text-right"
                      style={{ color: isSliderDefault ? "#4d4354" : accent }}>
                      {display(value)}
                    </span>
                    {!isSliderDefault && (
                      <button onClick={() => set(defVal)}
                        title={`Reset ${label}`}
                        aria-label={`Reset ${label}`}
                        className="w-5 h-5 rounded-full flex items-center justify-center opacity-60 hover:opacity-100 transition-opacity"
                        style={{ background: "rgba(255,255,255,0.08)" }}>
                        <span className="material-symbols-outlined text-[11px]" style={{ color: accent }}>close</span>
                      </button>
                    )}
                  </div>
                </div>
                <input
                  id={`gs-${id}`}
                  type="range" min={min} max={max} step={step} value={value}
                  onChange={e => set(Number(e.target.value))}
                  aria-label={label}
                  className="w-full h-1.5 rounded-full appearance-none outline-none cursor-pointer"
                  style={{
                    accentColor: accent,
                    background: `linear-gradient(to right,
                      rgba(255,255,255,0.07) ${lo}%,
                      ${accent} ${lo}%,
                      ${accent} ${lo + wid}%,
                      rgba(255,255,255,0.07) ${lo + wid}%)`,
                  }}
                />
                <div className="flex justify-between text-[9px] font-semibold" style={{ color: "#2d2535" }}>
                  <span>{minLabel}</span><span>{maxLabel}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Export format + quality */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2"
          style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "#988d9f" }}>
              Export Format
            </label>
            <div className="flex gap-2">
              {(["jpg", "png", "webp"] as OutFormat[]).map(f => (
                <button key={f} onClick={() => setOutFormat(f)} aria-pressed={outFormat === f}
                  className="flex-1 py-2 rounded-xl text-[12px] font-bold uppercase transition-all"
                  style={{
                    background: outFormat === f ? "rgba(76,215,246,0.12)" : "rgba(255,255,255,0.04)",
                    border:     `1px solid ${outFormat === f ? "rgba(76,215,246,0.35)" : "rgba(255,255,255,0.07)"}`,
                    color:      outFormat === f ? ACCENT : "#988d9f",
                  }}>{f}</button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "#988d9f" }}>
                Quality
              </label>
              {outFormat === "png"
                ? <span className="text-[11px] font-semibold" style={{ color: "#3d3345" }}>Lossless</span>
                : <span className="text-[13px] font-bold tabular-nums" style={{ color: "#e8dff0" }}>{quality}%</span>
              }
            </div>
            <input type="range" min={1} max={100} step={1} value={quality}
              disabled={outFormat === "png"}
              onChange={e => setQuality(Number(e.target.value))}
              aria-label="Export quality"
              className="w-full h-1.5 rounded-full appearance-none outline-none cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
              style={{
                accentColor: "#e8dff0",
                background: outFormat === "png"
                  ? "rgba(255,255,255,0.07)"
                  : `linear-gradient(to right, #e8dff0 ${quality}%, rgba(255,255,255,0.1) ${quality}%)`,
              }} />
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-3 pt-1"
          style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
          <button onClick={applyConvert} disabled={applying}
            className="btn-primary flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed">
            {applying ? (
              <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Converting…</>
            ) : (
              <><span className="material-symbols-outlined text-[16px]">filter_b_and_w</span>Convert to Grayscale</>
            )}
          </button>

          {resultBlob && (
            <button onClick={download}
              className="flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm transition-all"
              style={{ background: "rgba(76,215,246,0.1)", color: ACCENT, border: "1px solid rgba(76,215,246,0.25)" }}>
              <span className="material-symbols-outlined text-[16px]">download</span>
              Download {outFormat.toUpperCase()}
            </button>
          )}

          {!isDefault && (
            <button onClick={reset}
              className="flex items-center gap-2 px-4 py-3 rounded-xl font-semibold text-sm transition-all"
              style={{ background: "rgba(255,255,255,0.04)", color: "#988d9f", border: "1px solid rgba(255,255,255,0.07)" }}>
              <span className="material-symbols-outlined text-[15px]">restart_alt</span>Reset
            </button>
          )}
        </div>
      </div>

      {/* Success bar */}
      {resultBlob && (
        <div className="glass-panel rounded-2xl px-5 py-4 flex flex-wrap items-center gap-4"
          style={{ border: "1px solid rgba(100,220,150,0.22)", background: "rgba(100,220,150,0.05)" }}>
          <span className="material-symbols-outlined text-[18px] text-green-400">check_circle</span>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-bold" style={{ color: "#80e0a0" }}>Grayscale conversion complete</p>
            <p className="text-[11px]" style={{ color: "#40704a" }}>
              {outFormat.toUpperCase()} · {fmtSize(resultBlob.size)}
              {outFormat !== "png" ? ` · ${quality}% quality` : " · Lossless"}
              {" · "}{MODES.find(m => m.id === mode)?.label} mode
            </p>
          </div>
          <button onClick={download}
            className="btn-primary flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm">
            <span className="material-symbols-outlined text-[15px]">download</span>Download
          </button>
        </div>
      )}

      {/* Error */}
      {error && (
        <div role="alert" className="flex items-center gap-3 p-4 rounded-2xl"
          style={{ background: "rgba(255,100,100,0.08)", border: "1px solid rgba(255,100,100,0.22)" }}>
          <span className="material-symbols-outlined text-[18px] text-red-400">error</span>
          <p className="text-[13px] flex-1" style={{ color: "#ff8080" }}>{error}</p>
          <button onClick={() => setError(null)} aria-label="Dismiss error">
            <span className="material-symbols-outlined text-[15px]" style={{ color: "#ff8080" }}>close</span>
          </button>
        </div>
      )}

      <input ref={fileInputRef} type="file" accept={ACCEPT} className="sr-only"
        onChange={e => { const f = e.target.files?.[0]; if (f) loadFile(f); e.target.value = ""; }}
        aria-hidden tabIndex={-1} />
    </div>
  );
}
