"use client";

/**
 * Image Blur Tool
 *
 * Three blur modes — all Canvas-based, fully client-side:
 *   • Gaussian  — single-pass CSS-filter blur (GPU-accelerated)
 *   • Box       — 3-pass CSS-filter blur (σ = R/√3 per pass) ≈ uniform box
 *   • Pixel     — manual mosaic: fills NxN blocks with the centre pixel colour
 *
 * Preview canvas is redrawn on every setting change via RAF.
 * Export processes the full native resolution and returns a Blob for download.
 */

import { useState, useRef, useCallback, useEffect } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────
type BlurType  = "gaussian" | "box" | "pixel";
type OutFormat = "jpg" | "png" | "webp";

interface ImgState {
  file:   File;
  srcUrl: string;
  img:    HTMLImageElement;
  natW:   number;
  natH:   number;
}

// ── Pure blur helpers (return a new off-screen canvas) ────────────────────────

/**
 * Single CSS-filter blur pass with edge-padding to prevent darkening.
 * Works for both HTMLImageElement and HTMLCanvasElement sources.
 */
function blurPass(
  src:    CanvasImageSource,
  outW:   number,
  outH:   number,
  sigma:  number,
): HTMLCanvasElement {
  const pad = Math.ceil(sigma * 3);
  const tmp = document.createElement("canvas");
  tmp.width  = outW + pad * 2;
  tmp.height = outH + pad * 2;
  const tCtx = tmp.getContext("2d")!;
  tCtx.filter = `blur(${sigma}px)`;
  tCtx.drawImage(src, pad, pad, outW, outH);
  tCtx.filter = "none";

  const out = document.createElement("canvas");
  out.width  = outW;
  out.height = outH;
  out.getContext("2d")!.drawImage(tmp, pad, pad, outW, outH, 0, 0, outW, outH);
  return out;
}

function gaussianBlur(
  src:    CanvasImageSource,
  outW:   number,
  outH:   number,
  radius: number,
): HTMLCanvasElement {
  if (radius < 0.1) {
    const c = document.createElement("canvas");
    c.width = outW; c.height = outH;
    c.getContext("2d")!.drawImage(src, 0, 0, outW, outH);
    return c;
  }
  return blurPass(src, outW, outH, radius);
}

function boxBlur(
  src:    CanvasImageSource,
  outW:   number,
  outH:   number,
  radius: number,
): HTMLCanvasElement {
  if (radius < 0.1) {
    const c = document.createElement("canvas");
    c.width = outW; c.height = outH;
    c.getContext("2d")!.drawImage(src, 0, 0, outW, outH);
    return c;
  }
  // 3 passes of σ = R/√3 approximates a uniform box blur
  const sigma = radius / Math.sqrt(3);
  let current: CanvasImageSource = src;
  for (let i = 0; i < 3; i++) current = blurPass(current, outW, outH, sigma);
  return current as HTMLCanvasElement;
}

function pixelBlur(
  src:      CanvasImageSource,
  outW:     number,
  outH:     number,
  blockPx:  number,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = outW; canvas.height = outH;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(src, 0, 0, outW, outH);
  if (blockPx <= 1) return canvas;

  const imgData = ctx.getImageData(0, 0, outW, outH);
  const d = imgData.data;
  for (let y = 0; y < outH; y += blockPx) {
    for (let x = 0; x < outW; x += blockPx) {
      const cx = Math.min(x + (blockPx >> 1), outW - 1);
      const cy = Math.min(y + (blockPx >> 1), outH - 1);
      const ci = (cy * outW + cx) * 4;
      const r = d[ci], g = d[ci + 1], b = d[ci + 2], a = d[ci + 3];
      for (let by = y; by < Math.min(y + blockPx, outH); by++) {
        for (let bx = x; bx < Math.min(x + blockPx, outW); bx++) {
          const i = (by * outW + bx) * 4;
          d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = a;
        }
      }
    }
  }
  ctx.putImageData(imgData, 0, 0);
  return canvas;
}

// ── Strength → native pixel radius/block ─────────────────────────────────────
function nativeParam(type: BlurType, strength: number): number {
  if (type === "pixel")    return Math.max(1, Math.round(strength * 0.8));   // 1–80 px block
  if (type === "box")      return (strength / 100) * 60;                     // 0–60 px radius
  return (strength / 100) * 80;                                              // 0–80 px radius
}

function applyBlurToCanvas(
  src:      CanvasImageSource,
  outW:     number,
  outH:     number,
  type:     BlurType,
  strength: number,
  scale:    number = 1,
): HTMLCanvasElement {
  const param = nativeParam(type, strength) * scale;
  if (type === "pixel")   return pixelBlur(src, outW, outH, Math.max(1, Math.round(param)));
  if (type === "box")     return boxBlur(src, outW, outH, param);
  return gaussianBlur(src, outW, outH, param);
}

// ── Misc helpers ──────────────────────────────────────────────────────────────
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
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

const ACCEPT = "image/jpeg,image/png,image/webp,image/gif,image/bmp,image/tiff,image/avif";

// ── Component ─────────────────────────────────────────────────────────────────
export default function ImageBlurTool() {
  const [imgState,  setImgState]  = useState<ImgState | null>(null);
  const [blurType,  setBlurType]  = useState<BlurType>("gaussian");
  const [strength,  setStrength]  = useState(30);
  const [outFormat, setOutFormat] = useState<OutFormat>("jpg");
  const [quality,   setQuality]   = useState(90);
  const [applying,  setApplying]  = useState(false);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);
  const [dropActive, setDropActive] = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const previewPanelRef  = useRef<HTMLDivElement>(null);
  const fileInputRef     = useRef<HTMLInputElement>(null);
  const rafRef           = useRef<number>(0);
  const roRef            = useRef<ResizeObserver | null>(null);

  // ── Draw preview canvas ────────────────────────────────────────────────────
  const drawPreview = useCallback(() => {
    if (!imgState || !previewCanvasRef.current || !previewPanelRef.current) return;
    const { img, natW, natH } = imgState;
    const panel = previewPanelRef.current;
    const canvas = previewCanvasRef.current;

    const maxW = panel.clientWidth  || 600;
    const maxH = Math.min(480, maxW * (natH / natW));
    const scale = Math.min(maxW / natW, maxH / natH, 1);
    const pW = Math.max(1, Math.round(natW * scale));
    const pH = Math.max(1, Math.round(natH * scale));

    const blurred = applyBlurToCanvas(img, pW, pH, blurType, strength, scale);
    canvas.width  = pW;
    canvas.height = pH;
    canvas.getContext("2d")!.drawImage(blurred, 0, 0);
  }, [imgState, blurType, strength]);

  // Trigger preview via RAF whenever settings or image changes
  useEffect(() => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(drawPreview);
    return () => cancelAnimationFrame(rafRef.current);
  }, [drawPreview]);

  // ResizeObserver to redraw when panel resizes
  useEffect(() => {
    if (!previewPanelRef.current) return;
    roRef.current?.disconnect();
    roRef.current = new ResizeObserver(() => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(drawPreview);
    });
    roRef.current.observe(previewPanelRef.current);
    return () => roRef.current?.disconnect();
  }, [drawPreview]);

  // ── Load image from File ───────────────────────────────────────────────────
  const loadFile = useCallback(async (file: File) => {
    setError(null);
    setResultUrl(null);
    setResultBlob(null);

    if (!file.type.startsWith("image/")) {
      setError("Please upload an image file (JPG, PNG, WebP, GIF, BMP, TIFF, AVIF).");
      return;
    }

    const srcUrl = URL.createObjectURL(file);
    try {
      const img  = await loadImg(srcUrl);
      setImgState(prev => {
        if (prev) URL.revokeObjectURL(prev.srcUrl);
        return { file, srcUrl, img, natW: img.naturalWidth, natH: img.naturalHeight };
      });
    } catch {
      URL.revokeObjectURL(srcUrl);
      setError("Could not read the image. Please try a different file.");
    }
  }, []);

  // ── Apply blur at full resolution → Blob ──────────────────────────────────
  const applyBlur = useCallback(async () => {
    if (!imgState || applying) return;
    setApplying(true);
    setError(null);

    try {
      const { img, natW, natH } = imgState;
      const blurred = applyBlurToCanvas(img, natW, natH, blurType, strength, 1);
      const mime = outFormat === "jpg" ? "image/jpeg" : outFormat === "webp" ? "image/webp" : "image/png";
      const q    = outFormat === "png" ? undefined : quality / 100;

      blurred.toBlob(blob => {
        if (!blob) { setError("Failed to encode the image."); setApplying(false); return; }
        if (resultUrl) URL.revokeObjectURL(resultUrl);
        const url = URL.createObjectURL(blob);
        setResultBlob(blob);
        setResultUrl(url);
        setApplying(false);
      }, mime, q);
    } catch {
      setError("Processing failed. Please try again.");
      setApplying(false);
    }
  }, [imgState, blurType, strength, outFormat, quality, applying, resultUrl]);

  // ── Download ───────────────────────────────────────────────────────────────
  const download = useCallback(() => {
    if (!resultBlob || !imgState) return;
    const base = imgState.file.name.replace(/\.[^.]+$/, "");
    const ext  = outFormat === "jpg" ? "jpg" : outFormat;
    downloadBlob(resultBlob, `${base}-blurred.${ext}`);
  }, [resultBlob, imgState, outFormat]);

  // ── Reset (keep image, reset settings) ────────────────────────────────────
  const reset = useCallback(() => {
    setStrength(30);
    setBlurType("gaussian");
    setOutFormat("jpg");
    setQuality(90);
    if (resultUrl) URL.revokeObjectURL(resultUrl);
    setResultUrl(null);
    setResultBlob(null);
  }, [resultUrl]);

  // ── Clear everything ───────────────────────────────────────────────────────
  const clear = useCallback(() => {
    reset();
    setImgState(prev => { if (prev) URL.revokeObjectURL(prev.srcUrl); return null; });
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [reset]);

  // ── Drag & drop ────────────────────────────────────────────────────────────
  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDropActive(false);
    const file = e.dataTransfer.files[0];
    if (file) loadFile(file);
  }, [loadFile]);

  // ── Blur type selector pills ───────────────────────────────────────────────
  const BLUR_TYPES: { id: BlurType; label: string; icon: string; desc: string }[] = [
    { id: "gaussian", label: "Gaussian", icon: "blur_on",      desc: "Smooth, natural softening" },
    { id: "box",      label: "Box",      icon: "blur_linear",  desc: "Uniform averaging blur" },
    { id: "pixel",    label: "Pixel",    icon: "grid_on",      desc: "Mosaic / censored effect" },
  ];

  // ── Render ─────────────────────────────────────────────────────────────────
  if (!imgState) {
    return (
      <div className="mb-12 flex flex-col gap-5">
        {/* Drop zone */}
        <div
          onDrop={onDrop}
          onDragOver={e => { e.preventDefault(); setDropActive(true); }}
          onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropActive(false); }}
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          aria-label="Upload image to blur"
          onKeyDown={e => e.key === "Enter" && fileInputRef.current?.click()}
          className="glass-panel rounded-2xl flex flex-col items-center justify-center gap-4 cursor-pointer transition-all duration-200 select-none"
          style={{
            minHeight: 280,
            border: `2px dashed ${dropActive ? "#4cd7f6" : "rgba(76,215,246,0.25)"}`,
            background: dropActive ? "rgba(76,215,246,0.04)" : undefined,
          }}>
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{ background: "rgba(76,215,246,0.1)" }}>
            <span className="material-symbols-outlined text-[32px]" style={{ color: "#4cd7f6" }}>blur_on</span>
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

  // ── Main editing UI ────────────────────────────────────────────────────────
  const { file, natW, natH, srcUrl } = imgState;

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
        <button onClick={clear}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold transition-all"
          style={{ background: "rgba(255,255,255,0.05)", color: "#988d9f", border: "1px solid rgba(255,255,255,0.08)" }}>
          <span className="material-symbols-outlined text-[13px]">close</span>
          Clear
        </button>
      </div>

      {/* Main: side-by-side previews */}
      <div className="flex flex-col lg:flex-row gap-4">

        {/* Original */}
        <div className="flex-1 glass-panel rounded-2xl overflow-hidden"
          style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
          <div className="px-4 py-2.5 flex items-center gap-2"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.05)", background: "rgba(255,255,255,0.02)" }}>
            <span className="material-symbols-outlined text-[14px]" style={{ color: "#988d9f" }}>image</span>
            <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "#988d9f" }}>Original</span>
          </div>
          <div className="p-3 flex items-center justify-center"
            style={{
              minHeight: 200,
              backgroundImage: "linear-gradient(45deg,#1e1e2e 25%,transparent 25%),linear-gradient(-45deg,#1e1e2e 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#1e1e2e 75%),linear-gradient(-45deg,transparent 75%,#1e1e2e 75%)",
              backgroundSize: "16px 16px",
              backgroundPosition: "0 0,0 8px,8px -8px,-8px 0",
              backgroundColor: "#131320",
            }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={srcUrl} alt="Original" className="max-w-full max-h-96 object-contain rounded-lg" draggable={false} />
          </div>
        </div>

        {/* Blurred preview */}
        <div className="flex-1 glass-panel rounded-2xl overflow-hidden"
          style={{ border: "1px solid rgba(76,215,246,0.18)" }}>
          <div className="px-4 py-2.5 flex items-center gap-2"
            style={{ borderBottom: "1px solid rgba(76,215,246,0.1)", background: "rgba(76,215,246,0.03)" }}>
            <span className="material-symbols-outlined text-[14px]" style={{ color: "#4cd7f6" }}>blur_on</span>
            <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "#4cd7f6" }}>Preview</span>
            <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full font-semibold"
              style={{ background: "rgba(76,215,246,0.1)", color: "#4cd7f6" }}>
              Live
            </span>
          </div>
          <div ref={previewPanelRef}
            className="p-3 flex items-center justify-center"
            style={{
              minHeight: 200,
              backgroundImage: "linear-gradient(45deg,#1e1e2e 25%,transparent 25%),linear-gradient(-45deg,#1e1e2e 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#1e1e2e 75%),linear-gradient(-45deg,transparent 75%,#1e1e2e 75%)",
              backgroundSize: "16px 16px",
              backgroundPosition: "0 0,0 8px,8px -8px,-8px 0",
              backgroundColor: "#131320",
            }}>
            <canvas ref={previewCanvasRef}
              className="max-w-full max-h-96 rounded-lg object-contain"
              aria-label="Blurred preview" />
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="glass-panel rounded-2xl p-5 flex flex-col gap-5"
        style={{ border: "1px solid rgba(255,255,255,0.07)" }}>

        {/* Blur type */}
        <div className="flex flex-col gap-3">
          <label className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "#988d9f" }}>
            Blur Type
          </label>
          <div className="grid grid-cols-3 gap-2">
            {BLUR_TYPES.map(({ id, label, icon, desc }) => (
              <button key={id} onClick={() => { setBlurType(id); setResultUrl(null); setResultBlob(null); }}
                aria-pressed={blurType === id}
                className="flex flex-col items-center gap-2 py-3 px-2 rounded-xl transition-all"
                style={{
                  background:  blurType === id ? "rgba(76,215,246,0.12)" : "rgba(255,255,255,0.03)",
                  border:      `1px solid ${blurType === id ? "rgba(76,215,246,0.35)" : "rgba(255,255,255,0.07)"}`,
                  color:       blurType === id ? "#4cd7f6" : "#988d9f",
                }}>
                <span className="material-symbols-outlined text-[22px]">{icon}</span>
                <div className="text-center">
                  <p className="text-[12px] font-bold leading-tight">{label}</p>
                  <p className="text-[10px] leading-snug mt-0.5" style={{ color: blurType === id ? "rgba(76,215,246,0.7)" : "#3d3345" }}>{desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Strength slider */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "#988d9f" }}>
              Blur Strength
            </label>
            <span className="text-[13px] font-bold tabular-nums" style={{ color: "#4cd7f6" }}>{strength}</span>
          </div>
          <div className="relative flex items-center">
            <input
              type="range"
              min={0} max={100} step={1}
              value={strength}
              onChange={e => { setStrength(Number(e.target.value)); setResultUrl(null); setResultBlob(null); }}
              aria-label="Blur strength"
              className="w-full h-1.5 rounded-full appearance-none outline-none cursor-pointer"
              style={{
                background: `linear-gradient(to right, #4cd7f6 ${strength}%, rgba(255,255,255,0.1) ${strength}%)`,
                accentColor: "#4cd7f6",
              }}
            />
          </div>
          <div className="flex justify-between text-[10px]" style={{ color: "#3d3345" }}>
            <span>None</span>
            <span>Max</span>
          </div>
        </div>

        {/* Export settings */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1"
          style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>

          {/* Format */}
          <div className="flex flex-col gap-2">
            <label className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "#988d9f" }}>
              Export Format
            </label>
            <div className="flex gap-2">
              {(["jpg", "png", "webp"] as OutFormat[]).map(f => (
                <button key={f} onClick={() => setOutFormat(f)} aria-pressed={outFormat === f}
                  className="flex-1 py-2 rounded-xl text-[12px] font-bold transition-all uppercase"
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

          {/* Quality */}
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
              type="range"
              min={1} max={100} step={1}
              value={quality}
              disabled={outFormat === "png"}
              onChange={e => setQuality(Number(e.target.value))}
              aria-label="Export quality"
              className="w-full h-1.5 rounded-full appearance-none outline-none cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
              style={{
                background: outFormat === "png"
                  ? "rgba(255,255,255,0.08)"
                  : `linear-gradient(to right, #e8dff0 ${quality}%, rgba(255,255,255,0.1) ${quality}%)`,
                accentColor: "#e8dff0",
              }}
            />
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-3 pt-1" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
          <button onClick={applyBlur} disabled={applying || strength === 0}
            className="btn-primary flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed">
            {applying ? (
              <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Applying…</>
            ) : (
              <><span className="material-symbols-outlined text-[16px]">blur_on</span>Apply Blur</>
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

          <button onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-4 py-3 rounded-xl font-semibold text-sm transition-all"
            style={{ background: "rgba(255,255,255,0.04)", color: "#988d9f", border: "1px solid rgba(255,255,255,0.07)" }}>
            <span className="material-symbols-outlined text-[15px]">upload</span>
            New Image
          </button>
        </div>
      </div>

      {/* Result success bar */}
      {resultBlob && (
        <div className="glass-panel rounded-2xl px-5 py-4 flex flex-wrap items-center gap-4"
          style={{ border: "1px solid rgba(100,220,150,0.22)", background: "rgba(100,220,150,0.05)" }}>
          <span className="material-symbols-outlined text-[18px] text-green-400">check_circle</span>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-bold" style={{ color: "#80e0a0" }}>Blur applied successfully</p>
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
          <button onClick={() => setError(null)} aria-label="Dismiss">
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
            Blur strength is 0 — move the slider to apply a blur effect.
          </p>
        </div>
      )}

      <input ref={fileInputRef} type="file" accept={ACCEPT} className="sr-only"
        onChange={e => { const f = e.target.files?.[0]; if (f) loadFile(f); e.target.value = ""; }}
        aria-hidden tabIndex={-1} />
    </div>
  );
}
