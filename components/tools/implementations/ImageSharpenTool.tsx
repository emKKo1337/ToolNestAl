"use client";

/**
 * Image Sharpen Tool — Unsharp Mask
 *
 * Algorithm:
 *   sharpened[px] = original[px] + amount × (original[px] − blurred[px])
 *
 * The blurred "low-pass" is computed with a padded CSS-filter pass (GPU-
 * accelerated, same edge-padding trick as ImageBlurTool).  The per-pixel
 * subtraction loop runs at preview scale (~600 px wide) for live feedback
 * and at full native resolution for the export.
 *
 * Controls:
 *   Sharpness  0–100 → amount  0–2.5
 *   Radius     1–10  → blur σ  proportional to canvas width / 1600
 *
 * Preview: split-view canvas (original left / sharpened right) with a
 * draggable divider.  Sharpened canvas is stored in a ref so the divider
 * can be dragged without re-running the expensive pixel loop.
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

// ── Low-level helpers ─────────────────────────────────────────────────────────

/** Single Gaussian blur pass with edge-padding to avoid dark borders. */
function blurPass(
  src:   CanvasImageSource,
  outW:  number,
  outH:  number,
  sigma: number,
): HTMLCanvasElement {
  const pad  = Math.ceil(sigma * 3);
  const tmp  = document.createElement("canvas");
  tmp.width  = outW + pad * 2;
  tmp.height = outH + pad * 2;
  const tCtx = tmp.getContext("2d")!;
  tCtx.filter = `blur(${sigma}px)`;
  tCtx.drawImage(src, pad, pad, outW, outH);
  tCtx.filter = "none";

  const out  = document.createElement("canvas");
  out.width  = outW;
  out.height = outH;
  out.getContext("2d")!.drawImage(tmp, pad, pad, outW, outH, 0, 0, outW, outH);
  return out;
}

/**
 * Unsharp mask: original + amount × (original − blurred).
 * Returns a new off-screen canvas with the sharpened pixels.
 */
function unsharpMask(
  src:    CanvasImageSource,
  outW:   number,
  outH:   number,
  amount: number,
  sigma:  number,
): HTMLCanvasElement {
  // Original pixels
  const orig  = document.createElement("canvas");
  orig.width  = outW;
  orig.height = outH;
  orig.getContext("2d")!.drawImage(src, 0, 0, outW, outH);

  // Blurred pixels
  const blurred = blurPass(src, outW, outH, Math.max(0.1, sigma));

  const oCtx = orig.getContext("2d")!;
  const bCtx = blurred.getContext("2d")!;
  const od   = oCtx.getImageData(0, 0, outW, outH);
  const bd   = bCtx.getImageData(0, 0, outW, outH);

  const out  = document.createElement("canvas");
  out.width  = outW;
  out.height = outH;
  const outCtx = out.getContext("2d")!;
  const res    = outCtx.createImageData(outW, outH);
  const o = od.data, b = bd.data, r = res.data;

  for (let i = 0; i < o.length; i += 4) {
    r[i]   = Math.max(0, Math.min(255, Math.round(o[i]   + amount * (o[i]   - b[i]))));
    r[i+1] = Math.max(0, Math.min(255, Math.round(o[i+1] + amount * (o[i+1] - b[i+1]))));
    r[i+2] = Math.max(0, Math.min(255, Math.round(o[i+2] + amount * (o[i+2] - b[i+2]))));
    r[i+3] = o[i+3]; // preserve alpha
  }

  outCtx.putImageData(res, 0, 0);
  return out;
}

function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload  = () => res(img);
    img.onerror = () => rej(new Error("Failed to load image"));
    img.src = src;
  });
}

function fmtSize(b: number): string {
  if (b < 1024)      return `${b} B`;
  if (b < 1_048_576) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1_048_576).toFixed(2)} MB`;
}

function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement("a");
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

const ACCEPT = "image/jpeg,image/png,image/webp,image/gif,image/bmp,image/tiff,image/avif";
const MAX_PREVIEW_H = 460;

// ── Component ─────────────────────────────────────────────────────────────────
export default function ImageSharpenTool() {
  const [imgState,    setImgState]    = useState<ImgState | null>(null);
  const [strength,    setStrength]    = useState(50);
  const [radius,      setRadius]      = useState(3);
  const [outFormat,   setOutFormat]   = useState<OutFormat>("jpg");
  const [quality,     setQuality]     = useState(90);
  const [applying,    setApplying]    = useState(false);
  const [resultBlob,  setResultBlob]  = useState<Blob | null>(null);
  const [resultUrl,   setResultUrl]   = useState<string | null>(null);
  const [splitPos,    setSplitPos]    = useState(50);
  const [dropActive,  setDropActive]  = useState(false);
  const [isDragging,  setIsDragging]  = useState(false);
  const [error,       setError]       = useState<string | null>(null);

  // Refs that are updated synchronously (bypass React batching in event handlers)
  const imgStateRef      = useRef<ImgState | null>(null);
  const splitPosRef      = useRef(50);
  const sharpenedPrevRef = useRef<HTMLCanvasElement | null>(null);

  imgStateRef.current  = imgState;
  splitPosRef.current  = splitPos;

  const previewCanvasRef    = useRef<HTMLCanvasElement>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef        = useRef<HTMLInputElement>(null);
  const rafComputeRef       = useRef<number>(0);
  const rafDrawRef          = useRef<number>(0);
  const roRef               = useRef<ResizeObserver | null>(null);

  // ── Draw split canvas (cheap — reuses stored sharpened canvas) ─────────────
  const drawCanvas = useCallback(() => {
    const canvas = previewCanvasRef.current;
    const st     = imgStateRef.current;
    if (!canvas || !st || !canvas.width || !canvas.height) return;
    const w = canvas.width, h = canvas.height;
    const ctx     = canvas.getContext("2d")!;
    const splitX  = Math.round(w * splitPosRef.current / 100);
    const sharpened = sharpenedPrevRef.current;

    // Original (full canvas)
    ctx.drawImage(st.img, 0, 0, w, h);

    // Sharpened (right of divider)
    if (sharpened) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(splitX, 0, w - splitX, h);
      ctx.clip();
      ctx.drawImage(sharpened, 0, 0);
      ctx.restore();
    }

    // Divider line
    ctx.strokeStyle = "#4cd7f6";
    ctx.lineWidth   = 2;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(splitX, 0);
    ctx.lineTo(splitX, h);
    ctx.stroke();
  }, []);

  // ── Expensive recompute (runs when image/settings change) ──────────────────
  const recompute = useCallback(() => {
    const st        = imgStateRef.current;
    const container = previewContainerRef.current;
    const canvas    = previewCanvasRef.current;
    if (!st || !container || !canvas) return;

    const { img, natW, natH } = st;
    const maxW  = container.clientWidth || 600;
    // Canvas always fills container width; height is proportional (capped)
    const pW    = Math.max(1, maxW);
    const rawH  = Math.round(pW * natH / natW);
    const pH    = Math.min(MAX_PREVIEW_H, rawH);
    // Scale image to fit: may letterbox if portrait is very tall
    const scale = Math.min(pW / natW, pH / natH);
    const drawW = Math.round(natW * scale);
    const drawH = Math.round(natH * scale);

    canvas.width  = pW;
    canvas.height = pH;

    // Compute sharpened at draw dimensions
    const amount = (strength / 100) * 2.5;
    const sigma  = Math.max(0.1, radius * (drawW / 1600));

    // Draw original at correct scale/position onto the preview canvas
    const origCanvas = document.createElement("canvas");
    origCanvas.width  = pW;
    origCanvas.height = pH;
    const oCtx = origCanvas.getContext("2d")!;
    const ox = Math.round((pW - drawW) / 2);
    const oy = Math.round((pH - drawH) / 2);
    oCtx.drawImage(img, ox, oy, drawW, drawH);

    // Sharpened
    if (amount > 0) {
      // Compute unsharp mask on the draw-size sub-canvas
      const sub = document.createElement("canvas");
      sub.width = drawW; sub.height = drawH;
      sub.getContext("2d")!.drawImage(img, 0, 0, drawW, drawH);
      const sharp = unsharpMask(sub, drawW, drawH, amount, sigma);
      // Place sharpened result into a full-size canvas
      const sharpFull = document.createElement("canvas");
      sharpFull.width  = pW;
      sharpFull.height = pH;
      const sfCtx = sharpFull.getContext("2d")!;
      sfCtx.drawImage(sharp, ox, oy, drawW, drawH);
      sharpenedPrevRef.current = sharpFull;
    } else {
      sharpenedPrevRef.current = null;
    }

    // Swap imgState's img reference to the letterboxed original for drawCanvas
    // We draw directly here to use origCanvas
    const ctx    = canvas.getContext("2d")!;
    const splitX = Math.round(pW * splitPosRef.current / 100);
    ctx.drawImage(origCanvas, 0, 0);
    const sharpened = sharpenedPrevRef.current;
    if (sharpened) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(splitX, 0, pW - splitX, pH);
      ctx.clip();
      ctx.drawImage(sharpened, 0, 0);
      ctx.restore();
    }
    ctx.strokeStyle = "#4cd7f6";
    ctx.lineWidth   = 2;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(splitX, 0);
    ctx.lineTo(splitX, pH);
    ctx.stroke();

    // Update imgState img ref to letterboxed version so drawCanvas works too
    imgStateRef.current = { ...st, img: origCanvas as unknown as HTMLImageElement };
  }, [strength, radius]);

  // Trigger full recompute when image or settings change
  useEffect(() => {
    cancelAnimationFrame(rafComputeRef.current);
    cancelAnimationFrame(rafDrawRef.current);
    rafComputeRef.current = requestAnimationFrame(recompute);
    return () => cancelAnimationFrame(rafComputeRef.current);
  }, [recompute, imgState]); // imgState as separate dep ensures recompute runs on image change

  // Trigger cheap redraw when only splitPos changes
  useEffect(() => {
    cancelAnimationFrame(rafDrawRef.current);
    rafDrawRef.current = requestAnimationFrame(drawCanvas);
    return () => cancelAnimationFrame(rafDrawRef.current);
  }, [splitPos, drawCanvas]);

  // ResizeObserver — recompute on container resize
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
      const rect  = container.getBoundingClientRect();
      const pct   = Math.max(5, Math.min(95, ((e.clientX - rect.left) / rect.width) * 100));
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
    sharpenedPrevRef.current = null;
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
  const applySharp = useCallback(async () => {
    const st = imgStateRef.current;
    if (!st || applying) return;

    // Retrieve the original ImgState (not the letterboxed ref version)
    const origState = imgState;
    if (!origState) return;

    setApplying(true);
    setError(null);
    try {
      const { img, natW, natH } = origState;
      const amount = (strength / 100) * 2.5;
      const sigma  = Math.max(0.1, radius * (natW / 1600));

      let sharpened: HTMLCanvasElement;
      if (amount > 0) {
        sharpened = unsharpMask(img, natW, natH, amount, sigma);
      } else {
        sharpened = document.createElement("canvas");
        sharpened.width  = natW;
        sharpened.height = natH;
        sharpened.getContext("2d")!.drawImage(img, 0, 0);
      }

      const mime = outFormat === "jpg" ? "image/jpeg" : outFormat === "webp" ? "image/webp" : "image/png";
      const q    = outFormat === "png" ? undefined : quality / 100;

      sharpened.toBlob(blob => {
        if (!blob) { setError("Failed to encode the image."); setApplying(false); return; }
        setResultBlob(blob);
        setResultUrl(prev => { if (prev) URL.revokeObjectURL(prev); return URL.createObjectURL(blob); });
        setApplying(false);
      }, mime, q);
    } catch {
      setError("Processing failed. Please try again.");
      setApplying(false);
    }
  }, [imgState, strength, radius, outFormat, quality, applying]);

  // ── Download ───────────────────────────────────────────────────────────────
  const download = useCallback(() => {
    const origState = imgState;
    if (!resultBlob || !origState) return;
    const base = origState.file.name.replace(/\.[^.]+$/, "");
    downloadBlob(resultBlob, `${base}-sharpened.${outFormat === "jpg" ? "jpg" : outFormat}`);
  }, [resultBlob, imgState, outFormat]);

  // ── Reset / Clear ──────────────────────────────────────────────────────────
  const reset = useCallback(() => {
    setStrength(50); setRadius(3); setOutFormat("jpg"); setQuality(90);
    setResultBlob(null);
    setResultUrl(prev => { if (prev) URL.revokeObjectURL(prev); return null; });
  }, []);

  const clear = useCallback(() => {
    reset();
    sharpenedPrevRef.current = null;
    setImgState(prev => { if (prev) URL.revokeObjectURL(prev.srcUrl); return null; });
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [reset]);

  // ── Drop handlers ──────────────────────────────────────────────────────────
  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDropActive(false);
    const file = e.dataTransfer.files[0];
    if (file) loadFile(file);
  }, [loadFile]);

  // ── Drop zone (no image) ───────────────────────────────────────────────────
  if (!imgState) {
    return (
      <div className="mb-12 flex flex-col gap-5">
        <div
          onDrop={onDrop}
          onDragOver={e => { e.preventDefault(); setDropActive(true); }}
          onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropActive(false); }}
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          aria-label="Upload image to sharpen"
          onKeyDown={e => e.key === "Enter" && fileInputRef.current?.click()}
          className="glass-panel rounded-2xl flex flex-col items-center justify-center gap-4 cursor-pointer transition-all duration-200 select-none"
          style={{
            minHeight: 280,
            border:     `2px dashed ${dropActive ? "#4cd7f6" : "rgba(76,215,246,0.25)"}`,
            background: dropActive ? "rgba(76,215,246,0.04)" : undefined,
          }}>
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{ background: "rgba(76,215,246,0.1)" }}>
            <span className="material-symbols-outlined text-[32px]" style={{ color: "#4cd7f6" }}>deblur</span>
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
          <span className="material-symbols-outlined text-[13px]">upload</span>
          New Image
        </button>
        <button onClick={clear}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold transition-all"
          style={{ background: "rgba(255,255,255,0.05)", color: "#988d9f", border: "1px solid rgba(255,255,255,0.08)" }}>
          <span className="material-symbols-outlined text-[13px]">close</span>
          Clear
        </button>
      </div>

      {/* Split-view preview */}
      <div className="glass-panel rounded-2xl overflow-hidden"
        style={{ border: "1px solid rgba(76,215,246,0.18)" }}>

        {/* Header */}
        <div className="px-4 py-2.5 flex items-center gap-3"
          style={{ borderBottom: "1px solid rgba(76,215,246,0.1)", background: "rgba(76,215,246,0.03)" }}>
          <span className="material-symbols-outlined text-[14px]" style={{ color: "#4cd7f6" }}>compare</span>
          <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "#4cd7f6" }}>
            Before / After — drag the divider to compare
          </span>
          <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full font-semibold"
            style={{ background: "rgba(76,215,246,0.1)", color: "#4cd7f6" }}>Live</span>
        </div>

        {/* Canvas + drag handle */}
        <div
          ref={previewContainerRef}
          className="relative select-none"
          style={{
            backgroundImage: "linear-gradient(45deg,#1e1e2e 25%,transparent 25%),linear-gradient(-45deg,#1e1e2e 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#1e1e2e 75%),linear-gradient(-45deg,transparent 75%,#1e1e2e 75%)",
            backgroundSize: "16px 16px",
            backgroundPosition: "0 0,0 8px,8px -8px,-8px 0",
            backgroundColor: "#131320",
            cursor: isDragging ? "ew-resize" : "default",
          }}>

          <canvas
            ref={previewCanvasRef}
            className="block w-full"
            aria-label="Before / after sharpening comparison"
          />

          {/* Labels */}
          <div className="absolute bottom-2 left-3 px-2 py-0.5 rounded-md text-[10px] font-bold pointer-events-none"
            style={{ background: "rgba(0,0,0,0.55)", color: "#988d9f" }}>Before</div>
          <div className="absolute bottom-2 right-3 px-2 py-0.5 rounded-md text-[10px] font-bold pointer-events-none"
            style={{ background: "rgba(0,0,0,0.55)", color: "#4cd7f6" }}>After</div>

          {/* Drag handle */}
          <div
            className="absolute top-0 bottom-0 flex items-center justify-center z-10"
            style={{
              left:      `calc(${splitPos}% - 16px)`,
              width:     32,
              cursor:    "ew-resize",
              touchAction: "none",
            }}
            onMouseDown={e => { e.preventDefault(); setIsDragging(true); }}
            role="slider"
            aria-label="Comparison divider"
            aria-valuenow={Math.round(splitPos)}
            aria-valuemin={5}
            aria-valuemax={95}>
            <div className="w-8 h-8 rounded-full shadow-xl flex items-center justify-center"
              style={{ background: "#4cd7f6" }}>
              <span className="material-symbols-outlined text-[14px] font-black" style={{ color: "#000" }}>
                swap_horiz
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="glass-panel rounded-2xl p-5 flex flex-col gap-5"
        style={{ border: "1px solid rgba(255,255,255,0.07)" }}>

        {/* Sharpness */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "#988d9f" }}>
              Sharpness
            </label>
            <span className="text-[13px] font-bold tabular-nums" style={{ color: "#4cd7f6" }}>{strength}</span>
          </div>
          <input
            type="range" min={0} max={100} step={1} value={strength}
            onChange={e => { setStrength(Number(e.target.value)); setResultBlob(null); setResultUrl(null); }}
            aria-label="Sharpness strength"
            className="w-full h-1.5 rounded-full appearance-none outline-none cursor-pointer"
            style={{
              background:  `linear-gradient(to right, #4cd7f6 ${strength}%, rgba(255,255,255,0.1) ${strength}%)`,
              accentColor: "#4cd7f6",
            }}
          />
          <div className="flex justify-between text-[10px]" style={{ color: "#3d3345" }}>
            <span>None</span><span>Maximum</span>
          </div>
        </div>

        {/* Detail Radius */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "#988d9f" }}>
                Detail Radius
              </label>
              <p className="text-[10px] mt-0.5" style={{ color: "#3d3345" }}>
                Low = fine grain · High = broad edges
              </p>
            </div>
            <span className="text-[13px] font-bold tabular-nums" style={{ color: "#e8dff0" }}>{radius}</span>
          </div>
          <input
            type="range" min={1} max={10} step={1} value={radius}
            onChange={e => { setRadius(Number(e.target.value)); setResultBlob(null); setResultUrl(null); }}
            aria-label="Sharpening radius"
            className="w-full h-1.5 rounded-full appearance-none outline-none cursor-pointer"
            style={{
              background:  `linear-gradient(to right, #e8dff0 ${(radius - 1) / 9 * 100}%, rgba(255,255,255,0.1) ${(radius - 1) / 9 * 100}%)`,
              accentColor: "#e8dff0",
            }}
          />
          <div className="flex justify-between text-[10px]" style={{ color: "#3d3345" }}>
            <span>Fine details</span><span>Broad edges</span>
          </div>
        </div>

        {/* Export format + quality */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1"
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
                  }}>
                  {f}
                </button>
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
            <input
              type="range" min={1} max={100} step={1} value={quality}
              disabled={outFormat === "png"}
              onChange={e => setQuality(Number(e.target.value))}
              aria-label="Export quality"
              className="w-full h-1.5 rounded-full appearance-none outline-none cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
              style={{
                background:  outFormat === "png"
                  ? "rgba(255,255,255,0.08)"
                  : `linear-gradient(to right, #e8dff0 ${quality}%, rgba(255,255,255,0.1) ${quality}%)`,
                accentColor: "#e8dff0",
              }}
            />
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-3 pt-1"
          style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>

          <button onClick={applySharp} disabled={applying || strength === 0}
            className="btn-primary flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed">
            {applying ? (
              <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Applying…</>
            ) : (
              <><span className="material-symbols-outlined text-[16px]">deblur</span>Apply Sharpen</>
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

          <button onClick={reset}
            className="flex items-center gap-2 px-4 py-3 rounded-xl font-semibold text-sm transition-all"
            style={{ background: "rgba(255,255,255,0.04)", color: "#988d9f", border: "1px solid rgba(255,255,255,0.07)" }}>
            <span className="material-symbols-outlined text-[15px]">restart_alt</span>
            Reset
          </button>
        </div>
      </div>

      {/* Result success bar */}
      {resultBlob && (
        <div className="glass-panel rounded-2xl px-5 py-4 flex flex-wrap items-center gap-4"
          style={{ border: "1px solid rgba(100,220,150,0.22)", background: "rgba(100,220,150,0.05)" }}>
          <span className="material-symbols-outlined text-[18px] text-green-400">check_circle</span>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-bold" style={{ color: "#80e0a0" }}>Sharpen applied successfully</p>
            <p className="text-[11px]" style={{ color: "#40704a" }}>
              {outFormat.toUpperCase()} · {fmtSize(resultBlob.size)}
              {outFormat !== "png" ? ` · ${quality}% quality` : " · Lossless"}
            </p>
          </div>
          <button onClick={download}
            className="btn-primary flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm">
            <span className="material-symbols-outlined text-[15px]">download</span>
            Download
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

      {/* Strength = 0 hint */}
      {strength === 0 && imgState && (
        <div className="flex items-center gap-3 p-4 rounded-2xl"
          style={{ background: "rgba(255,200,80,0.07)", border: "1px solid rgba(255,200,80,0.18)" }}>
          <span className="material-symbols-outlined text-[16px]" style={{ color: "#ffc850" }}>info</span>
          <p className="text-[12px]" style={{ color: "#b08030" }}>
            Sharpness is 0 — move the slider to enhance the image.
          </p>
        </div>
      )}

      <input ref={fileInputRef} type="file" accept={ACCEPT} className="sr-only"
        onChange={e => { const f = e.target.files?.[0]; if (f) loadFile(f); e.target.value = ""; }}
        aria-hidden tabIndex={-1} />
    </div>
  );
}
