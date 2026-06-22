"use client";

/**
 * Brightness & Contrast Tool
 *
 * Six independent adjustments, all combined into a single 256-entry lookup
 * table (LUT) before any pixels are touched:
 *
 *   1. Brightness  −100…+100  additive shift per channel (+/−255)
 *   2. Contrast    −100…+100  linear scale around midpoint 128
 *   3. Exposure    −100…+100  multiplicative (2^(v/100*2), range 0.25×–4×)
 *   4. Gamma        0.1…3.0   power curve  pixel → 255×(pixel/255)^(1/γ)
 *   5. Highlights  −100…+100  additive, weighted by brightness²
 *   6. Shadows     −100…+100  additive, weighted by (1−brightness)²
 *
 * Building the LUT takes ~μs; applying it is a single array-scan (O(w×h)).
 * Preview is redrawn via RAF whenever any value changes, so the split-view
 * stays live without ever hitting a server.
 *
 * The split-view canvas is the same two-tier pattern used in ImageSharpenTool:
 *  • recompute() — rebuilds LUT + applies to preview canvas → stores in ref
 *  • drawCanvas() — composites original / processed with clip at splitPos
 * Dragging the divider only calls drawCanvas(), skipping the pixel loop.
 */

import { useState, useRef, useCallback, useEffect } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────
type OutFormat = "jpg" | "png" | "webp";

interface ImgState {
  file:   File;
  srcUrl: string;
  img:    HTMLImageElement;
  natW:   number;
  natH:   number;
}

interface Adjustments {
  brightness: number;   // −100…+100, default 0
  contrast:   number;   // −100…+100, default 0
  exposure:   number;   // −100…+100, default 0
  gamma:      number;   //  0.1…3.0,  default 1.0
  highlights: number;   // −100…+100, default 0
  shadows:    number;   // −100…+100, default 0
}

const DEFAULT_ADJ: Adjustments = {
  brightness: 0, contrast: 0, exposure: 0,
  gamma: 1.0, highlights: 0, shadows: 0,
};

// ── Adjustment algorithms ─────────────────────────────────────────────────────

function buildLUT(a: Adjustments): Uint8ClampedArray {
  const lut            = new Uint8ClampedArray(256);
  const contrastFactor = (259 * (a.contrast + 255)) / (255 * (259 - a.contrast));
  const exposureMult   = Math.pow(2, (a.exposure / 100) * 2);

  for (let i = 0; i < 256; i++) {
    let v = i;

    // 1. Brightness — additive
    v += a.brightness * 2.55;

    // 2. Contrast — scale around midpoint
    v = contrastFactor * (v - 128) + 128;

    // 3. Exposure — multiplicative
    v = Math.max(0, v) * exposureMult;

    // 4. Gamma — power curve
    v = Math.max(0, Math.min(255, v));
    if (Math.abs(a.gamma - 1) > 0.001) v = 255 * Math.pow(v / 255, 1 / a.gamma);

    // 5. Highlights — affect bright pixels (quadratic weight)
    {
      const norm = Math.max(0, Math.min(255, v)) / 255;
      v += a.highlights * 2.55 * norm * norm;
    }

    // 6. Shadows — affect dark pixels (quadratic weight)
    {
      const norm = Math.max(0, Math.min(255, v)) / 255;
      v += a.shadows * 2.55 * (1 - norm) * (1 - norm);
    }

    lut[i] = Math.max(0, Math.min(255, Math.round(v)));
  }
  return lut;
}

function applyLUT(
  src:  CanvasImageSource,
  outW: number,
  outH: number,
  lut:  Uint8ClampedArray,
): HTMLCanvasElement {
  const c   = document.createElement("canvas");
  c.width   = outW;
  c.height  = outH;
  const ctx = c.getContext("2d")!;
  ctx.drawImage(src, 0, 0, outW, outH);
  const id  = ctx.getImageData(0, 0, outW, outH);
  const d   = id.data;
  for (let i = 0; i < d.length; i += 4) {
    d[i]   = lut[d[i]];
    d[i+1] = lut[d[i+1]];
    d[i+2] = lut[d[i+2]];
    // alpha (d[i+3]) unchanged
  }
  ctx.putImageData(id, 0, 0);
  return c;
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

/** CSS gradient for a range track that fills from the default-value position
 *  to the current-value position, supporting both ±100 and arbitrary ranges. */
function trackGradient(value: number, min: number, max: number, accent: string): string {
  const range      = max - min;
  const defPct     = ((DEFAULT_ADJ[Object.keys(DEFAULT_ADJ).find(
    k => DEFAULT_ADJ[k as keyof Adjustments] >= min &&
         DEFAULT_ADJ[k as keyof Adjustments] <= max
  ) as keyof Adjustments] ?? 0) - min) / range * 100;
  const valPct     = ((value - min) / range) * 100;
  const lo         = Math.min(defPct, valPct);
  const hi         = Math.max(defPct, valPct);
  const track      = "rgba(255,255,255,0.08)";
  return `linear-gradient(to right, ${track} ${lo}%, ${accent} ${lo}%, ${accent} ${hi}%, ${track} ${hi}%)`;
}

const ACCEPT = "image/jpeg,image/png,image/webp,image/gif,image/bmp,image/tiff,image/avif";
const MAX_PREVIEW_H = 460;

// ── Slider definitions ────────────────────────────────────────────────────────
const SLIDERS: {
  key:       keyof Adjustments;
  label:     string;
  min:       number;
  max:       number;
  step:      number;
  accent:    string;
  format?:   (v: number) => string;
}[] = [
  { key: "brightness", label: "Brightness", min: -100, max: 100, step: 1,   accent: "#ffd580" },
  { key: "contrast",   label: "Contrast",   min: -100, max: 100, step: 1,   accent: "#4cd7f6" },
  { key: "exposure",   label: "Exposure",   min: -100, max: 100, step: 1,   accent: "#ff9f7f" },
  { key: "gamma",      label: "Gamma",      min:  0.1, max:  3.0, step: 0.1, accent: "#a0c4ff",
    format: (v) => v.toFixed(1) },
  { key: "highlights", label: "Highlights", min: -100, max: 100, step: 1,   accent: "#b5ead7" },
  { key: "shadows",    label: "Shadows",    min: -100, max: 100, step: 1,   accent: "#9b8de8" },
];

// ── Component ─────────────────────────────────────────────────────────────────
export default function BrightnessContrastTool() {
  const [imgState,   setImgState]   = useState<ImgState | null>(null);
  const [adj,        setAdj]        = useState<Adjustments>(DEFAULT_ADJ);
  const [outFormat,  setOutFormat]  = useState<OutFormat>("jpg");
  const [quality,    setQuality]    = useState(90);
  const [applying,   setApplying]   = useState(false);
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);
  const [resultUrl,  setResultUrl]  = useState<string | null>(null);
  const [splitPos,   setSplitPos]   = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const [dropActive, setDropActive] = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  // Synchronous refs (bypass React batching for RAF/event handlers)
  const imgStateRef      = useRef<ImgState | null>(null);
  const splitPosRef      = useRef(50);
  const processedPrevRef = useRef<HTMLCanvasElement | null>(null);
  const origPrevRef      = useRef<HTMLCanvasElement | null>(null);

  imgStateRef.current = imgState;
  splitPosRef.current = splitPos;

  const previewCanvasRef    = useRef<HTMLCanvasElement>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef        = useRef<HTMLInputElement>(null);
  const rafComputeRef       = useRef<number>(0);
  const rafDrawRef          = useRef<number>(0);
  const roRef               = useRef<ResizeObserver | null>(null);

  // ── Cheap redraw — composites stored canvases with clip at splitPos ─────────
  const drawCanvas = useCallback(() => {
    const canvas     = previewCanvasRef.current;
    const orig       = origPrevRef.current;
    const processed  = processedPrevRef.current;
    if (!canvas || !orig || !canvas.width || !canvas.height) return;

    const w      = canvas.width, h = canvas.height;
    const ctx    = canvas.getContext("2d")!;
    const splitX = Math.round(w * splitPosRef.current / 100);

    ctx.drawImage(orig, 0, 0);

    if (processed) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(splitX, 0, w - splitX, h);
      ctx.clip();
      ctx.drawImage(processed, 0, 0);
      ctx.restore();
    }

    // Divider
    ctx.strokeStyle = "#4cd7f6";
    ctx.lineWidth   = 2;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(splitX, 0);
    ctx.lineTo(splitX, h);
    ctx.stroke();
  }, []);

  // ── Expensive recompute — builds LUT + applies to preview ──────────────────
  const recompute = useCallback(() => {
    const st        = imgStateRef.current;
    const container = previewContainerRef.current;
    const canvas    = previewCanvasRef.current;
    if (!st || !container || !canvas) return;

    const { img, natW, natH } = st;
    const pW    = Math.max(1, container.clientWidth || 600);
    const scale = Math.min(pW / natW, MAX_PREVIEW_H / natH, 1);
    const drawW = Math.max(1, Math.round(natW * scale));
    const drawH = Math.max(1, Math.round(natH * scale));
    const ox    = Math.round((pW - drawW) / 2);
    const oy    = Math.round((MAX_PREVIEW_H - drawH) / 2);
    const pH    = MAX_PREVIEW_H;

    canvas.width  = pW;
    canvas.height = pH;

    // Letterboxed original
    const origC  = document.createElement("canvas");
    origC.width  = pW;
    origC.height = pH;
    origC.getContext("2d")!.drawImage(img, ox, oy, drawW, drawH);
    origPrevRef.current = origC;

    // Letterboxed processed
    const isDefault = Object.entries(adj).every(
      ([k, v]) => Math.abs(v - DEFAULT_ADJ[k as keyof Adjustments]) < 0.001
    );
    if (isDefault) {
      processedPrevRef.current = null;
    } else {
      const lut     = buildLUT(adj);
      // Apply LUT only to the image pixels (draw-size canvas)
      const subC    = document.createElement("canvas");
      subC.width    = drawW;
      subC.height   = drawH;
      subC.getContext("2d")!.drawImage(img, 0, 0, drawW, drawH);
      const procSub = applyLUT(subC, drawW, drawH, lut);

      const procC  = document.createElement("canvas");
      procC.width  = pW;
      procC.height = pH;
      procC.getContext("2d")!.drawImage(procSub, ox, oy);
      processedPrevRef.current = procC;
    }

    drawCanvas();
  }, [adj, drawCanvas]);

  // Trigger recompute when image or adjustments change
  useEffect(() => {
    cancelAnimationFrame(rafComputeRef.current);
    cancelAnimationFrame(rafDrawRef.current);
    rafComputeRef.current = requestAnimationFrame(recompute);
    return () => cancelAnimationFrame(rafComputeRef.current);
  }, [recompute, imgState]);

  // Trigger cheap redraw when only splitPos changes
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

  // ── Apply at full native resolution ───────────────────────────────────────
  const applyChanges = useCallback(() => {
    if (!imgState || applying) return;
    setApplying(true);
    setError(null);

    try {
      const { img, natW, natH } = imgState;
      const isDefault = Object.entries(adj).every(
        ([k, v]) => Math.abs(v - DEFAULT_ADJ[k as keyof Adjustments]) < 0.001
      );

      let outCanvas: HTMLCanvasElement;
      if (isDefault) {
        outCanvas         = document.createElement("canvas");
        outCanvas.width   = natW;
        outCanvas.height  = natH;
        outCanvas.getContext("2d")!.drawImage(img, 0, 0);
      } else {
        const lut = buildLUT(adj);
        outCanvas = applyLUT(img, natW, natH, lut);
      }

      const mime = outFormat === "jpg" ? "image/jpeg" : outFormat === "webp" ? "image/webp" : "image/png";
      const q    = outFormat === "png" ? undefined : quality / 100;

      outCanvas.toBlob(blob => {
        if (!blob) { setError("Failed to encode the image."); setApplying(false); return; }
        setResultBlob(blob);
        setResultUrl(prev => { if (prev) URL.revokeObjectURL(prev); return URL.createObjectURL(blob); });
        setApplying(false);
      }, mime, q);
    } catch {
      setError("Processing failed. Please try again.");
      setApplying(false);
    }
  }, [imgState, adj, outFormat, quality, applying]);

  // ── Download ───────────────────────────────────────────────────────────────
  const download = useCallback(() => {
    if (!resultBlob || !imgState) return;
    const base = imgState.file.name.replace(/\.[^.]+$/, "");
    downloadBlob(resultBlob, `${base}-adjusted.${outFormat === "jpg" ? "jpg" : outFormat}`);
  }, [resultBlob, imgState, outFormat]);

  // ── Helpers ────────────────────────────────────────────────────────────────
  const setAdjValue = useCallback((key: keyof Adjustments, val: number) => {
    setAdj(prev => ({ ...prev, [key]: val }));
    setResultBlob(null);
    setResultUrl(prev => { if (prev) URL.revokeObjectURL(prev); return null; });
  }, []);

  const resetAll = useCallback(() => {
    setAdj(DEFAULT_ADJ);
    setResultBlob(null);
    setResultUrl(prev => { if (prev) URL.revokeObjectURL(prev); return null; });
  }, []);

  const clear = useCallback(() => {
    resetAll();
    processedPrevRef.current = null;
    origPrevRef.current      = null;
    setImgState(prev => { if (prev) URL.revokeObjectURL(prev.srcUrl); return null; });
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [resetAll]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDropActive(false);
    const file = e.dataTransfer.files[0];
    if (file) loadFile(file);
  }, [loadFile]);

  const isAllDefault = Object.entries(adj).every(
    ([k, v]) => Math.abs(v - DEFAULT_ADJ[k as keyof Adjustments]) < 0.001
  );

  // ── Drop zone ──────────────────────────────────────────────────────────────
  if (!imgState) {
    return (
      <div className="mb-12 flex flex-col gap-5">
        <div
          onDrop={onDrop}
          onDragOver={e => { e.preventDefault(); setDropActive(true); }}
          onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropActive(false); }}
          onClick={() => fileInputRef.current?.click()}
          role="button" tabIndex={0} aria-label="Upload image to adjust"
          onKeyDown={e => e.key === "Enter" && fileInputRef.current?.click()}
          className="glass-panel rounded-2xl flex flex-col items-center justify-center gap-4 cursor-pointer transition-all duration-200 select-none"
          style={{
            minHeight: 280,
            border:     `2px dashed ${dropActive ? "#4cd7f6" : "rgba(76,215,246,0.25)"}`,
            background: dropActive ? "rgba(76,215,246,0.04)" : undefined,
          }}>
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: "rgba(76,215,246,0.1)" }}>
            <span className="material-symbols-outlined text-[32px]" style={{ color: "#4cd7f6" }}>brightness_6</span>
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

  // ── Editing UI ─────────────────────────────────────────────────────────────
  const { file, natW, natH } = imgState;

  return (
    <div className="mb-12 flex flex-col gap-5">

      {/* Stats bar */}
      <div className="glass-panel rounded-2xl px-5 py-3 flex flex-wrap items-center gap-4"
        style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
        <span className="material-symbols-outlined text-[16px]" style={{ color: "#4cd7f6" }}>image</span>
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
        style={{ border: "1px solid rgba(76,215,246,0.18)" }}>
        <div className="px-4 py-2.5 flex items-center gap-3"
          style={{ borderBottom: "1px solid rgba(76,215,246,0.1)", background: "rgba(76,215,246,0.03)" }}>
          <span className="material-symbols-outlined text-[14px]" style={{ color: "#4cd7f6" }}>compare</span>
          <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "#4cd7f6" }}>
            Before / After — drag the divider to compare
          </span>
          <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full font-semibold"
            style={{ background: "rgba(76,215,246,0.1)", color: "#4cd7f6" }}>Live</span>
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
            aria-label="Before / after adjustment comparison" />

          {/* Labels */}
          <div className="absolute bottom-2 left-3 px-2 py-0.5 rounded-md text-[10px] font-bold pointer-events-none"
            style={{ background: "rgba(0,0,0,0.55)", color: "#988d9f" }}>Before</div>
          <div className="absolute bottom-2 right-3 px-2 py-0.5 rounded-md text-[10px] font-bold pointer-events-none"
            style={{ background: "rgba(0,0,0,0.55)", color: "#4cd7f6" }}>After</div>

          {/* Drag handle */}
          <div className="absolute top-0 bottom-0 flex items-center justify-center z-10"
            style={{ left: `calc(${splitPos}% - 16px)`, width: 32, cursor: "ew-resize", touchAction: "none" }}
            onMouseDown={e => { e.preventDefault(); setIsDragging(true); }}
            role="slider" aria-label="Comparison divider"
            aria-valuenow={Math.round(splitPos)} aria-valuemin={5} aria-valuemax={95}>
            <div className="w-8 h-8 rounded-full shadow-xl flex items-center justify-center"
              style={{ background: "#4cd7f6" }}>
              <span className="material-symbols-outlined text-[14px] font-black" style={{ color: "#000" }}>swap_horiz</span>
            </div>
          </div>
        </div>
      </div>

      {/* Adjustment sliders */}
      <div className="glass-panel rounded-2xl p-5 flex flex-col gap-5"
        style={{ border: "1px solid rgba(255,255,255,0.07)" }}>

        {/* Header row */}
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "#988d9f" }}>Adjustments</p>
          {!isAllDefault && (
            <button onClick={resetAll}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold transition-all"
              style={{ background: "rgba(255,255,255,0.05)", color: "#988d9f", border: "1px solid rgba(255,255,255,0.08)" }}>
              <span className="material-symbols-outlined text-[12px]">restart_alt</span>Reset All
            </button>
          )}
        </div>

        {/* 2-column slider grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5">
          {SLIDERS.map(({ key, label, min, max, step, accent, format }) => {
            const value      = adj[key];
            const defVal     = DEFAULT_ADJ[key];
            const isDefault  = Math.abs(value - defVal) < 0.001;
            const displayVal = format
              ? format(value)
              : value === 0 ? "0" : value > 0 ? `+${value}` : `${value}`;
            const fillPct    = ((Math.min(value, defVal) - min) / (max - min)) * 100;
            const fillW      = (Math.abs(value - defVal) / (max - min)) * 100;

            return (
              <div key={key} className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <label htmlFor={`adj-${key}`}
                    className="text-[12px] font-semibold" style={{ color: "#c8c0d0" }}>
                    {label}
                  </label>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[12px] font-bold tabular-nums w-10 text-right"
                      style={{ color: isDefault ? "#4d4354" : accent }}>
                      {displayVal}
                    </span>
                    {!isDefault && (
                      <button
                        onClick={() => setAdjValue(key, defVal)}
                        title={`Reset ${label}`}
                        aria-label={`Reset ${label} to default`}
                        className="w-5 h-5 rounded-full flex items-center justify-center transition-opacity hover:opacity-100 opacity-60"
                        style={{ background: "rgba(255,255,255,0.08)" }}>
                        <span className="material-symbols-outlined text-[11px]" style={{ color: accent }}>close</span>
                      </button>
                    )}
                  </div>
                </div>

                <div className="relative">
                  <input
                    id={`adj-${key}`}
                    type="range"
                    min={min} max={max} step={step}
                    value={value}
                    onChange={e => setAdjValue(key, Number(e.target.value))}
                    aria-label={label}
                    className="w-full h-1.5 rounded-full appearance-none outline-none cursor-pointer"
                    style={{
                      accentColor: accent,
                      background: `linear-gradient(to right,
                        rgba(255,255,255,0.07) 0%,
                        rgba(255,255,255,0.07) ${fillPct}%,
                        ${accent} ${fillPct}%,
                        ${accent} ${fillPct + fillW}%,
                        rgba(255,255,255,0.07) ${fillPct + fillW}%,
                        rgba(255,255,255,0.07) 100%)`,
                    }}
                  />
                </div>

                {/* Min/max labels */}
                <div className="flex justify-between text-[9px] font-semibold tabular-nums"
                  style={{ color: "#2d2535" }}>
                  <span>{format ? min.toFixed(1) : min}</span>
                  <span>{format ? max.toFixed(1) : `+${max}`}</span>
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
                    color:      outFormat === f ? "#4cd7f6" : "#988d9f",
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
          <button onClick={applyChanges} disabled={applying}
            className="btn-primary flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed">
            {applying ? (
              <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Applying…</>
            ) : (
              <><span className="material-symbols-outlined text-[16px]">brightness_6</span>Apply Changes</>
            )}
          </button>

          {resultBlob && (
            <button onClick={download}
              className="flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm transition-all"
              style={{ background: "rgba(76,215,246,0.1)", color: "#4cd7f6", border: "1px solid rgba(76,215,246,0.25)" }}>
              <span className="material-symbols-outlined text-[16px]">download</span>
              Download {outFormat.toUpperCase()}
            </button>
          )}

          {!isAllDefault && (
            <button onClick={resetAll}
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
            <p className="text-[13px] font-bold" style={{ color: "#80e0a0" }}>Adjustments applied successfully</p>
            <p className="text-[11px]" style={{ color: "#40704a" }}>
              {outFormat.toUpperCase()} · {fmtSize(resultBlob.size)}
              {outFormat !== "png" ? ` · ${quality}% quality` : " · Lossless"}
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
