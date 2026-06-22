"use client";

/**
 * Image Filters Tool
 *
 * 17 filters via CSS canvas filters (GPU-accelerated) + per-pixel for
 * Cinematic, Sketch, Pixel Art and Posterize.
 *
 * Pipeline per render:
 *   1. Apply base filter → baseCanvas
 *   2. Blend baseCanvas with original at `strength`% → blended
 *   3. Apply fine-tune adjustments (brightness/contrast/saturation/hue)
 *      as a second CSS-filter pass → finalCanvas
 *
 * Two-tier RAF:
 *   recompute() — full pipeline (triggered by filter/settings change)
 *   drawCanvas() — cheap composite: clips orig left / processed right at splitX
 *
 * Thumbnails: generated synchronously at 84×56px on image load.
 * All processing is client-side via Canvas 2D API.
 */

import { useState, useRef, useCallback, useEffect } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────
type FilterId =
  | "original" | "bw" | "sepia" | "warm" | "cool" | "vintage"
  | "hdr" | "vivid" | "soft" | "fade" | "retro" | "noir"
  | "invert" | "cinematic" | "sketch" | "pixelart" | "posterize";

type OutFormat = "jpg" | "png" | "webp";

interface ImgState {
  file: File;
  srcUrl: string;
  img: HTMLImageElement;
  natW: number;
  natH: number;
}

// ── Filter catalogue ──────────────────────────────────────────────────────────
interface FilterDef {
  id: FilterId;
  label: string;
  icon: string;
  css: string | null; // null → pixel-based
}

const FILTERS: FilterDef[] = [
  { id: "original",  label: "Original",  icon: "image",           css: "" },
  { id: "bw",        label: "B&W",       icon: "tonality",        css: "grayscale(1)" },
  { id: "sepia",     label: "Sepia",     icon: "light_mode",      css: "sepia(1) contrast(1.1) brightness(1.05)" },
  { id: "warm",      label: "Warm",      icon: "wb_sunny",        css: "sepia(0.2) saturate(1.3) hue-rotate(-15deg) brightness(1.05)" },
  { id: "cool",      label: "Cool",      icon: "water_drop",      css: "saturate(0.9) hue-rotate(15deg) brightness(1.02) contrast(1.05)" },
  { id: "vintage",   label: "Vintage",   icon: "camera",          css: "sepia(0.4) saturate(0.7) brightness(0.9) contrast(1.15) hue-rotate(5deg)" },
  { id: "hdr",       label: "HDR",       icon: "hdr_strong",      css: "contrast(1.4) saturate(1.5) brightness(1.05)" },
  { id: "vivid",     label: "Vivid",     icon: "palette",         css: "saturate(1.8) contrast(1.2)" },
  { id: "soft",      label: "Soft",      icon: "blur_on",         css: "brightness(1.08) contrast(0.85) saturate(0.9)" },
  { id: "fade",      label: "Fade",      icon: "exposure",        css: "brightness(1.1) contrast(0.72) saturate(0.75)" },
  { id: "retro",     label: "Retro",     icon: "photo_camera",    css: "sepia(0.35) saturate(1.15) hue-rotate(10deg) contrast(0.9) brightness(1.08)" },
  { id: "noir",      label: "Noir",      icon: "dark_mode",       css: "grayscale(1) contrast(1.7) brightness(0.85)" },
  { id: "invert",    label: "Invert",    icon: "invert_colors",   css: "invert(1)" },
  { id: "cinematic", label: "Cinematic", icon: "movie",           css: null },
  { id: "sketch",    label: "Sketch",    icon: "draw",            css: null },
  { id: "pixelart",  label: "Pixel Art", icon: "grid_view",       css: null },
  { id: "posterize", label: "Posterize", icon: "layers",          css: null },
];

// ── Canvas utilities ──────────────────────────────────────────────────────────
function mkCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  return c;
}

function drawSimple(src: CanvasImageSource, w: number, h: number): HTMLCanvasElement {
  const c = mkCanvas(w, h);
  c.getContext("2d")!.drawImage(src, 0, 0, w, h);
  return c;
}

function drawCSS(src: CanvasImageSource, w: number, h: number, css: string): HTMLCanvasElement {
  const c   = mkCanvas(w, h);
  const ctx = c.getContext("2d")!;
  ctx.filter = css;
  ctx.drawImage(src, 0, 0, w, h);
  ctx.filter = "none";
  return c;
}

function adjCSSStr(b: number, c: number, s: number, h: number): string {
  const parts: string[] = [];
  if (Math.abs(b) > 0) parts.push(`brightness(${(100 + b) / 100})`);
  if (Math.abs(c) > 0) parts.push(`contrast(${(100 + c) / 100})`);
  if (Math.abs(s) > 0) parts.push(`saturate(${Math.max(0, (100 + s) / 100)})`);
  if (Math.abs(h) > 0) parts.push(`hue-rotate(${h}deg)`);
  return parts.join(" ");
}

// ── Pixel-based filters ───────────────────────────────────────────────────────
function pixelCinematic(src: CanvasImageSource, w: number, h: number): HTMLCanvasElement {
  const c   = drawSimple(src, w, h);
  const ctx = c.getContext("2d")!;
  const id  = ctx.getImageData(0, 0, w, h);
  const d   = id.data;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i + 1], b = d[i + 2];
    const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    const sh  = (1 - lum) * (1 - lum) * 0.28; // shadow teal push
    const hl  = lum * lum * 0.28;              // highlight warm push
    d[i]   = Math.max(15, Math.min(240, Math.round(r - sh * 22 + hl * 38)));
    d[i+1] = Math.max(15, Math.min(240, Math.round(g + sh *  7 + hl *  7)));
    d[i+2] = Math.max(15, Math.min(240, Math.round(b + sh * 32 - hl * 32)));
  }
  ctx.putImageData(id, 0, 0);
  return c;
}

function pixelSketch(src: CanvasImageSource, w: number, h: number): HTMLCanvasElement {
  const blurR  = Math.max(1, Math.round(Math.min(w, h) / 120));
  const gray   = drawCSS(src, w, h, "grayscale(1)");
  const blurred = drawCSS(gray, w, h, `blur(${blurR}px)`);

  const gCtx = gray.getContext("2d")!;
  const bCtx = blurred.getContext("2d")!;
  const gd   = gCtx.getImageData(0, 0, w, h).data;
  const bd   = bCtx.getImageData(0, 0, w, h).data;

  const out  = mkCanvas(w, h);
  const oCtx = out.getContext("2d")!;
  const res  = oCtx.createImageData(w, h);
  const rd   = res.data;

  for (let i = 0; i < gd.length; i += 4) {
    const g  = gd[i];
    const bi = 255 - bd[i]; // inverted blurred
    // colour-dodge blend for pencil-sketch look
    const v  = bi >= 255 ? 255 : Math.min(255, Math.round(g * 255 / (255 - bi)));
    rd[i] = rd[i+1] = rd[i+2] = v;
    rd[i+3] = gd[i+3];
  }
  oCtx.putImageData(res, 0, 0);
  return out;
}

function pixelArt(src: CanvasImageSource, w: number, h: number): HTMLCanvasElement {
  const block = Math.max(4, Math.round(Math.min(w, h) / 40));
  const sW    = Math.max(1, Math.round(w / block));
  const sH    = Math.max(1, Math.round(h / block));
  const small = mkCanvas(sW, sH);
  const sCtx  = small.getContext("2d")!;
  sCtx.imageSmoothingEnabled = false;
  sCtx.drawImage(src, 0, 0, sW, sH);
  const out  = mkCanvas(w, h);
  const oCtx = out.getContext("2d")!;
  oCtx.imageSmoothingEnabled = false;
  oCtx.drawImage(small, 0, 0, w, h);
  return out;
}

function pixelPosterize(src: CanvasImageSource, w: number, h: number, levels = 4): HTMLCanvasElement {
  const c   = drawSimple(src, w, h);
  const ctx = c.getContext("2d")!;
  const id  = ctx.getImageData(0, 0, w, h);
  const d   = id.data;
  const step = 255 / (levels - 1);
  for (let i = 0; i < d.length; i += 4) {
    d[i]   = Math.round(Math.round(d[i]   / step) * step);
    d[i+1] = Math.round(Math.round(d[i+1] / step) * step);
    d[i+2] = Math.round(Math.round(d[i+2] / step) * step);
  }
  ctx.putImageData(id, 0, 0);
  return c;
}

// ── Main render pipeline ──────────────────────────────────────────────────────
function renderFilter(
  src:        CanvasImageSource,
  w:          number,
  h:          number,
  filterId:   FilterId,
  strength:   number,   // 0–100
  brightness: number,   // -100…100
  contrast:   number,
  saturation: number,
  hue:        number,   // -180…180
): HTMLCanvasElement {
  const def = FILTERS.find(f => f.id === filterId)!;
  const adj = adjCSSStr(brightness, contrast, saturation, hue);

  // 1. Base filter
  let base: HTMLCanvasElement;
  if (!def.css && def.css !== "") {
    // pixel-based
    switch (filterId) {
      case "cinematic": base = pixelCinematic(src, w, h); break;
      case "sketch":    base = pixelSketch(src, w, h);    break;
      case "pixelart":  base = pixelArt(src, w, h);       break;
      case "posterize": base = pixelPosterize(src, w, h); break;
      default:          base = drawSimple(src, w, h);
    }
  } else if (def.css) {
    base = drawCSS(src, w, h, def.css);
  } else {
    base = drawSimple(src, w, h); // "original"
  }

  // 2. Blend with original at strength%
  let blended: HTMLCanvasElement;
  if (filterId === "original" || strength >= 100) {
    blended = base;
  } else if (strength <= 0) {
    blended = drawSimple(src, w, h);
  } else {
    blended = drawSimple(src, w, h);
    const ctx = blended.getContext("2d")!;
    ctx.globalAlpha = strength / 100;
    ctx.drawImage(base, 0, 0);
    ctx.globalAlpha = 1;
  }

  // 3. Fine-tune adjustments
  if (!adj) return blended;
  return drawCSS(blended, w, h, adj);
}

// ── Misc helpers ──────────────────────────────────────────────────────────────
function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img   = new Image();
    img.onload  = () => res(img);
    img.onerror = () => rej(new Error("Failed to load image"));
    img.src     = src;
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

const ACCEPT     = "image/jpeg,image/png,image/webp,image/gif,image/bmp,image/tiff,image/avif";
const MAX_PREV_H = 460;
const ACCENT     = "#4cd7f6";
const THUMB_W    = 84;
const THUMB_H    = 56;

// ── Component ─────────────────────────────────────────────────────────────────
export default function ImageFiltersTool() {
  const [imgState,    setImgState]    = useState<ImgState | null>(null);
  const [filter,      setFilter]      = useState<FilterId>("original");
  const [strength,    setStrength]    = useState(100);
  const [adjBr,       setAdjBr]       = useState(0);
  const [adjCo,       setAdjCo]       = useState(0);
  const [adjSa,       setAdjSa]       = useState(0);
  const [adjHu,       setAdjHu]       = useState(0);
  const [thumbnails,  setThumbnails]  = useState<Record<string, string>>({});
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

  const previewCanvasRef    = useRef<HTMLCanvasElement>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef        = useRef<HTMLInputElement>(null);
  const rafComputeRef       = useRef(0);
  const rafDrawRef          = useRef(0);
  const roRef               = useRef<ResizeObserver | null>(null);

  imgStateRef.current = imgState;
  splitPosRef.current = splitPos;

  // ── Generate thumbnails whenever image changes ────────────────────────────
  useEffect(() => {
    if (!imgState) { setThumbnails({}); return; }
    const { img, natW, natH } = imgState;
    const scale = Math.min(THUMB_W / natW, THUMB_H / natH);
    const tW    = Math.max(1, Math.round(natW * scale));
    const tH    = Math.max(1, Math.round(natH * scale));

    const thumbs: Record<string, string> = {};
    for (const { id } of FILTERS) {
      const result = renderFilter(img, tW, tH, id, 100, 0, 0, 0, 0);
      // Centre on fixed THUMB_W × THUMB_H canvas
      const holder  = mkCanvas(THUMB_W, THUMB_H);
      const hCtx    = holder.getContext("2d")!;
      const ox      = Math.round((THUMB_W - tW) / 2);
      const oy      = Math.round((THUMB_H - tH) / 2);
      hCtx.fillStyle = "#1a1825";
      hCtx.fillRect(0, 0, THUMB_W, THUMB_H);
      hCtx.drawImage(result, ox, oy);
      thumbs[id] = holder.toDataURL("image/jpeg", 0.72);
    }
    setThumbnails(thumbs);
  }, [imgState]);

  // ── drawCanvas (cheap) ───────────────────────────────────────────────────
  const drawCanvas = useCallback(() => {
    const canvas = previewCanvasRef.current;
    const orig   = origPrevRef.current;
    if (!canvas || !orig || !canvas.width || !canvas.height) return;
    const w     = canvas.width, h = canvas.height;
    const ctx   = canvas.getContext("2d")!;
    const splitX = Math.round(w * splitPosRef.current / 100);

    ctx.drawImage(orig, 0, 0);

    const proc = processedPrevRef.current;
    if (proc) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(splitX, 0, w - splitX, h);
      ctx.clip();
      ctx.drawImage(proc, 0, 0);
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

  // ── recompute (expensive) ────────────────────────────────────────────────
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
    const origC = mkCanvas(pW, pH);
    origC.getContext("2d")!.drawImage(img, ox, oy, drawW, drawH);
    origPrevRef.current = origC;

    // Filtered version at draw size, then letterboxed
    const drawSrc = drawSimple(img, drawW, drawH);
    const filtered = renderFilter(drawSrc, drawW, drawH, filter, strength, adjBr, adjCo, adjSa, adjHu);
    const procC    = mkCanvas(pW, pH);
    procC.getContext("2d")!.drawImage(filtered, ox, oy);
    processedPrevRef.current = procC;

    drawCanvas();
  }, [filter, strength, adjBr, adjCo, adjSa, adjHu, drawCanvas]);

  // Recompute when settings or image change
  useEffect(() => {
    cancelAnimationFrame(rafComputeRef.current);
    cancelAnimationFrame(rafDrawRef.current);
    rafComputeRef.current = requestAnimationFrame(recompute);
    return () => cancelAnimationFrame(rafComputeRef.current);
  }, [recompute, imgState]);

  // Cheap redraw when only split position changes
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

  // ── Split handle drag ────────────────────────────────────────────────────
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

  // ── Load file ────────────────────────────────────────────────────────────
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

  // ── Apply at full resolution ─────────────────────────────────────────────
  const applyFilter = useCallback(() => {
    if (!imgState || applying) return;
    setApplying(true);
    setError(null);
    try {
      const { img, natW, natH } = imgState;
      const out  = renderFilter(img, natW, natH, filter, strength, adjBr, adjCo, adjSa, adjHu);
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
  }, [imgState, filter, strength, adjBr, adjCo, adjSa, adjHu, outFormat, quality, applying]);

  // ── Download ─────────────────────────────────────────────────────────────
  const download = useCallback(() => {
    if (!resultBlob || !imgState) return;
    const base = imgState.file.name.replace(/\.[^.]+$/, "");
    const label = FILTERS.find(f => f.id === filter)?.label.toLowerCase().replace(/\s+/g, "-") ?? filter;
    downloadBlob(resultBlob, `${base}-${label}.${outFormat === "jpg" ? "jpg" : outFormat}`);
  }, [resultBlob, imgState, filter, outFormat]);

  // ── Reset / Clear ────────────────────────────────────────────────────────
  const reset = useCallback(() => {
    setFilter("original");
    setStrength(100);
    setAdjBr(0); setAdjCo(0); setAdjSa(0); setAdjHu(0);
    setResultBlob(null);
    setResultUrl(prev => { if (prev) URL.revokeObjectURL(prev); return null; });
  }, []);

  const clear = useCallback(() => {
    reset();
    processedPrevRef.current = null;
    origPrevRef.current      = null;
    setImgState(prev => { if (prev) URL.revokeObjectURL(prev.srcUrl); return null; });
    setThumbnails({});
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [reset]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDropActive(false);
    const file = e.dataTransfer.files[0];
    if (file) loadFile(file);
  }, [loadFile]);

  const isDefault = filter === "original" && strength === 100 && adjBr === 0 && adjCo === 0 && adjSa === 0 && adjHu === 0;
  const currentFilterLabel = FILTERS.find(f => f.id === filter)?.label ?? "";

  // ── Drop zone (no image) ─────────────────────────────────────────────────
  if (!imgState) {
    return (
      <div className="mb-12 flex flex-col gap-5">
        <div
          onDrop={onDrop}
          onDragOver={e => { e.preventDefault(); setDropActive(true); }}
          onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropActive(false); }}
          onClick={() => fileInputRef.current?.click()}
          role="button" tabIndex={0} aria-label="Upload image to apply filters"
          onKeyDown={e => e.key === "Enter" && fileInputRef.current?.click()}
          className="glass-panel rounded-2xl flex flex-col items-center justify-center gap-4 cursor-pointer transition-all duration-200 select-none"
          style={{
            minHeight: 280,
            border:     `2px dashed ${dropActive ? ACCENT : "rgba(76,215,246,0.25)"}`,
            background: dropActive ? "rgba(76,215,246,0.04)" : undefined,
          }}>
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{ background: "rgba(76,215,246,0.1)" }}>
            <span className="material-symbols-outlined text-[32px]" style={{ color: ACCENT }}>auto_fix_high</span>
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
  const thumbsReady = Object.keys(thumbnails).length > 0;

  // ── Editing UI ───────────────────────────────────────────────────────────
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
          {filter !== "original" && (
            <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full font-semibold"
              style={{ background: "rgba(76,215,246,0.1)", color: ACCENT }}>
              {currentFilterLabel}
            </span>
          )}
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
            aria-label="Before / after filter comparison" />

          <div className="absolute bottom-2 left-3 px-2 py-0.5 rounded-md text-[10px] font-bold pointer-events-none"
            style={{ background: "rgba(0,0,0,0.55)", color: "#988d9f" }}>Original</div>
          <div className="absolute bottom-2 right-3 px-2 py-0.5 rounded-md text-[10px] font-bold pointer-events-none"
            style={{ background: "rgba(0,0,0,0.55)", color: ACCENT }}>Filtered</div>

          {/* Drag handle */}
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

      {/* Filter gallery */}
      <div className="glass-panel rounded-2xl p-4 flex flex-col gap-3"
        style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "#988d9f" }}>
            Choose Filter
          </p>
          {filter !== "original" && (
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
              style={{ background: "rgba(76,215,246,0.1)", color: ACCENT }}>
              {currentFilterLabel} · {strength}% strength
            </span>
          )}
        </div>

        <div className="grid gap-2"
          style={{ gridTemplateColumns: "repeat(auto-fill, minmax(84px, 1fr))" }}>
          {FILTERS.map(({ id, label, icon }) => {
            const isActive = filter === id;
            const thumbSrc = thumbnails[id];
            return (
              <button
                key={id}
                onClick={() => {
                  setFilter(id);
                  setResultBlob(null);
                  setResultUrl(null);
                }}
                aria-pressed={isActive}
                aria-label={`Apply ${label} filter`}
                className="flex flex-col items-center gap-1 rounded-xl overflow-hidden transition-all"
                style={{
                  border:     `2px solid ${isActive ? ACCENT : "rgba(255,255,255,0.07)"}`,
                  background: isActive ? "rgba(76,215,246,0.07)" : "rgba(255,255,255,0.02)",
                  outline:    "none",
                }}>
                {/* Thumbnail */}
                <div className="w-full overflow-hidden relative"
                  style={{ height: THUMB_H, background: "#1a1825" }}>
                  {thumbSrc ? (
                    <img
                      src={thumbSrc}
                      alt={label}
                      width={THUMB_W}
                      height={THUMB_H}
                      className="w-full h-full object-cover"
                      draggable={false}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="material-symbols-outlined text-[18px]"
                        style={{ color: "#3d3345" }}>{icon}</span>
                    </div>
                  )}
                  {isActive && (
                    <div className="absolute inset-0 flex items-center justify-center"
                      style={{ background: "rgba(76,215,246,0.15)" }}>
                      <span className="material-symbols-outlined text-[16px] font-bold"
                        style={{ color: ACCENT }}>check_circle</span>
                    </div>
                  )}
                </div>
                {/* Label */}
                <span className="text-[10px] font-semibold pb-1.5 px-1 text-center leading-tight"
                  style={{ color: isActive ? ACCENT : "#988d9f" }}>
                  {label}
                </span>
              </button>
            );
          })}
        </div>

        {!thumbsReady && (
          <p className="text-[11px] text-center" style={{ color: "#3d3345" }}>
            Generating thumbnails…
          </p>
        )}
      </div>

      {/* Controls */}
      <div className="glass-panel rounded-2xl p-5 flex flex-col gap-5"
        style={{ border: "1px solid rgba(255,255,255,0.07)" }}>

        {/* Header */}
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "#988d9f" }}>
            Adjustments
          </p>
          {!isDefault && (
            <button onClick={reset}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold"
              style={{ background: "rgba(255,255,255,0.05)", color: "#988d9f", border: "1px solid rgba(255,255,255,0.08)" }}>
              <span className="material-symbols-outlined text-[12px]">restart_alt</span>Reset All
            </button>
          )}
        </div>

        {/* Sliders */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5">
          {[
            {
              id: "strength", label: "Filter Strength", value: strength, min: 0, max: 100, step: 1,
              accent: ACCENT, defVal: 100,
              display: (v: number) => `${v}%`,
              set: (v: number) => { setStrength(v); setResultBlob(null); setResultUrl(null); },
              minLabel: "Original", maxLabel: "Full",
            },
            {
              id: "brightness", label: "Brightness", value: adjBr, min: -100, max: 100, step: 1,
              accent: "#ffd580", defVal: 0,
              display: (v: number) => v === 0 ? "0" : v > 0 ? `+${v}` : `${v}`,
              set: (v: number) => { setAdjBr(v); setResultBlob(null); setResultUrl(null); },
              minLabel: "−100", maxLabel: "+100",
            },
            {
              id: "contrast", label: "Contrast", value: adjCo, min: -100, max: 100, step: 1,
              accent: "#a0c4ff", defVal: 0,
              display: (v: number) => v === 0 ? "0" : v > 0 ? `+${v}` : `${v}`,
              set: (v: number) => { setAdjCo(v); setResultBlob(null); setResultUrl(null); },
              minLabel: "−100", maxLabel: "+100",
            },
            {
              id: "saturation", label: "Saturation", value: adjSa, min: -100, max: 100, step: 1,
              accent: "#b9f880", defVal: 0,
              display: (v: number) => v === 0 ? "0" : v > 0 ? `+${v}` : `${v}`,
              set: (v: number) => { setAdjSa(v); setResultBlob(null); setResultUrl(null); },
              minLabel: "−100", maxLabel: "+100",
            },
            {
              id: "hue", label: "Hue", value: adjHu, min: -180, max: 180, step: 1,
              accent: "#f4a4f4", defVal: 0,
              display: (v: number) => v === 0 ? "0°" : `${v > 0 ? "+" : ""}${v}°`,
              set: (v: number) => { setAdjHu(v); setResultBlob(null); setResultUrl(null); },
              minLabel: "−180°", maxLabel: "+180°",
            },
          ].map(({ id, label, value, min, max, step, accent, defVal, display, set, minLabel, maxLabel }) => {
            const isSliderDefault = Math.abs(value - defVal) < 0.001;
            const lo  = ((Math.min(value, defVal) - min) / (max - min)) * 100;
            const wid = (Math.abs(value - defVal) / (max - min)) * 100;
            return (
              <div key={id} className={`flex flex-col gap-2 ${id === "strength" ? "sm:col-span-2" : ""}`}>
                <div className="flex items-center justify-between gap-2">
                  <label htmlFor={`if-${id}`} className="text-[12px] font-semibold" style={{ color: "#c8c0d0" }}>
                    {label}
                  </label>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[12px] font-bold tabular-nums w-12 text-right"
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
                  id={`if-${id}`}
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
          <button onClick={applyFilter} disabled={applying}
            className="btn-primary flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed">
            {applying ? (
              <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Applying…</>
            ) : (
              <><span className="material-symbols-outlined text-[16px]">auto_fix_high</span>Apply Filter</>
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
            <p className="text-[13px] font-bold" style={{ color: "#80e0a0" }}>Filter applied successfully</p>
            <p className="text-[11px]" style={{ color: "#40704a" }}>
              {outFormat.toUpperCase()} · {fmtSize(resultBlob.size)}
              {outFormat !== "png" ? ` · ${quality}% quality` : " · Lossless"}
              {filter !== "original" ? ` · ${currentFilterLabel} filter` : ""}
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
