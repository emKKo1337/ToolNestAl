"use client";

/**
 * Image Color Picker
 *
 * Hover → magnifier lens (8× zoom, pixel-precise crosshair).
 * Click → lock color; displays HEX, RGB, RGBA, HSL, HSV, CMYK.
 * Color history (last 12 unique picks) + favorites (localStorage).
 * All pixel reads via Canvas API getImageData — fully client-side.
 *
 * Performance note: mousemove updates the magnifier via direct DOM
 * manipulation (no React state) to avoid per-move re-renders.
 */

import { useState, useRef, useCallback, useEffect, useMemo } from "react";

// ── Constants ─────────────────────────────────────────────────────────────────
const LENS_SIZE   = 136; // px, circular magnifier diameter
const ZOOM        = 8;   // magnification factor
const MAX_HISTORY = 12;

// ── Color math ────────────────────────────────────────────────────────────────
function rgbToHex(r: number, g: number, b: number): string {
  return "#" + [r, g, b].map(v => v.toString(16).padStart(2, "0")).join("");
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, Math.round(l * 100)];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if      (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
  else if (max === gn) h = ((bn - rn) / d + 2) / 6;
  else                  h = ((rn - gn) / d + 4) / 6;
  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}

function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  const v = max, d = max - min;
  const s = max === 0 ? 0 : d / max;
  let h = 0;
  if (max !== min) {
    if      (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
    else if (max === gn) h = ((bn - rn) / d + 2) / 6;
    else                  h = ((rn - gn) / d + 4) / 6;
  }
  return [Math.round(h * 360), Math.round(s * 100), Math.round(v * 100)];
}

function rgbToCmyk(r: number, g: number, b: number): [number, number, number, number] {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const k = 1 - Math.max(rn, gn, bn);
  if (k >= 1) return [0, 0, 0, 100];
  const inv = 1 - k;
  return [
    Math.round(((1 - rn - k) / inv) * 100),
    Math.round(((1 - gn - k) / inv) * 100),
    Math.round(((1 - bn - k) / inv) * 100),
    Math.round(k * 100),
  ];
}

function getLuminance(r: number, g: number, b: number) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrastColor(r: number, g: number, b: number) {
  return getLuminance(r, g, b) > 128 ? "#000000" : "#ffffff";
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload  = () => res(img);
    img.onerror = rej;
    img.src = src;
  });
}
function fmtSize(b: number): string {
  if (b < 1024)        return `${b} B`;
  if (b < 1_048_576)   return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1_048_576).toFixed(2)} MB`;
}
function uid() { return Math.random().toString(36).slice(2, 9); }

type RGBA = [number, number, number, number];

// ── Component ─────────────────────────────────────────────────────────────────
export default function ImageColorPickerTool() {
  // Image state
  const [mainFile, setMainFile] = useState<File | null>(null);
  const [mainUrl,  setMainUrl]  = useState("");
  const mainImgRef = useRef<HTMLImageElement | null>(null);

  // Color state
  const [pickedRGBA, setPickedRGBA] = useState<RGBA | null>(null);
  const [prevHex,    setPrevHex]    = useState<string | null>(null);
  const [history,    setHistory]    = useState<RGBA[]>([]);
  const [favorites,  setFavorites]  = useState<RGBA[]>(() => {
    if (typeof window === "undefined") return [];
    try { return JSON.parse(localStorage.getItem("cp-favs") ?? "[]") as RGBA[]; }
    catch { return []; }
  });
  const [copied,    setCopied]    = useState<string | null>(null);
  const [dropActive, setDropActive] = useState(false);
  const [notif,     setNotif]     = useState<string | null>(null);

  // Refs for magnifier (DOM-direct, no state)
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const previewContRef   = useRef<HTMLDivElement>(null);
  const lensWrapRef      = useRef<HTMLDivElement>(null);
  const lensCanvasRef    = useRef<HTMLCanvasElement>(null);
  const hoverBadgeRef    = useRef<HTMLSpanElement>(null);
  const fileInputRef     = useRef<HTMLInputElement>(null);

  // Persist favorites
  useEffect(() => {
    try { localStorage.setItem("cp-favs", JSON.stringify(favorites)); }
    catch { /* ignore */ }
  }, [favorites]);

  // Revoke previous URL on change / unmount
  useEffect(() => {
    return () => { if (mainUrl) URL.revokeObjectURL(mainUrl); };
  }, [mainUrl]);

  // ── Load image ───────────────────────────────────────────────────────────────
  const loadFile = useCallback(async (file: File) => {
    const url = URL.createObjectURL(file);
    const img = await loadImg(url);
    mainImgRef.current = img;
    setMainFile(file);
    setMainUrl(url);
    setPickedRGBA(null);
    setPrevHex(null);
    setHistory([]);
  }, []);

  // ── Draw preview canvas ──────────────────────────────────────────────────────
  const drawPreview = useCallback(() => {
    const canvas = previewCanvasRef.current;
    const cont   = previewContRef.current;
    const img    = mainImgRef.current;
    if (!canvas || !cont || !img) return;
    const w = cont.clientWidth;
    const h = Math.round(img.naturalHeight * (w / img.naturalWidth));
    canvas.width  = w;
    canvas.height = h;
    canvas.style.height = `${h}px`;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, 0, 0, w, h);
  }, []);

  useEffect(() => {
    if (mainFile) drawPreview();
  }, [mainFile, drawPreview]);

  useEffect(() => {
    const cont = previewContRef.current;
    if (!cont) return;
    const ro = new ResizeObserver(() => { if (mainFile) drawPreview(); });
    ro.observe(cont);
    return () => ro.disconnect();
  }, [mainFile, drawPreview]);

  // ── Magnifier (direct DOM) ───────────────────────────────────────────────────
  const drawMagnifier = useCallback((cx: number, cy: number) => {
    const canvas  = previewCanvasRef.current;
    const img     = mainImgRef.current;
    const lensCtx = lensCanvasRef.current?.getContext("2d");
    if (!canvas || !img || !lensCtx) return;

    // Convert canvas display coords → native image coords
    const scaleX = img.naturalWidth  / canvas.width;
    const scaleY = img.naturalHeight / canvas.height;
    const nx = cx * scaleX;
    const ny = cy * scaleY;

    // Region of native image shown at ZOOM× (LENS_SIZE/ZOOM native px per axis)
    const regionW = LENS_SIZE / ZOOM;
    const regionH = LENS_SIZE / ZOOM;
    const srcX    = nx - regionW / 2;
    const srcY    = ny - regionH / 2;

    lensCtx.imageSmoothingEnabled = false;
    lensCtx.clearRect(0, 0, LENS_SIZE, LENS_SIZE);
    lensCtx.drawImage(img, srcX, srcY, regionW, regionH, 0, 0, LENS_SIZE, LENS_SIZE);

    // White crosshair
    const half = LENS_SIZE / 2;
    lensCtx.strokeStyle = "rgba(255,255,255,0.9)";
    lensCtx.lineWidth   = 1;
    lensCtx.beginPath();
    lensCtx.moveTo(half, 0);        lensCtx.lineTo(half, LENS_SIZE);
    lensCtx.moveTo(0,    half);     lensCtx.lineTo(LENS_SIZE, half);
    lensCtx.stroke();

    // Centre-pixel highlight (ZOOM×ZOOM square)
    lensCtx.strokeStyle = "rgba(0,0,0,0.55)";
    lensCtx.lineWidth   = 1;
    lensCtx.strokeRect(half - ZOOM / 2, half - ZOOM / 2, ZOOM, ZOOM);
  }, []);

  const onMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const cont   = previewContRef.current;
    const canvas = previewCanvasRef.current;
    const lens   = lensWrapRef.current;
    if (!cont || !canvas || !lens) return;

    const rect = cont.getBoundingClientRect();
    const x    = e.clientX - rect.left;
    const y    = e.clientY - rect.top;
    if (x < 0 || y < 0 || x > canvas.width || y > canvas.height) return;

    // Move lens (clamp inside container)
    const lx = Math.max(0, Math.min(cont.clientWidth  - LENS_SIZE, x - LENS_SIZE / 2));
    const ly = Math.max(0, Math.min(cont.clientHeight - LENS_SIZE, y - LENS_SIZE / 2));
    lens.style.transform = `translate(${lx}px, ${ly}px)`;
    lens.style.opacity   = "1";

    // Sample pixel
    const px   = Math.max(0, Math.min(canvas.width  - 1, Math.floor(x)));
    const py   = Math.max(0, Math.min(canvas.height - 1, Math.floor(y)));
    const data = canvas.getContext("2d")!.getImageData(px, py, 1, 1).data;
    const hex  = rgbToHex(data[0], data[1], data[2]);

    // Update badge DOM directly (no React state)
    const badge = hoverBadgeRef.current;
    if (badge) {
      badge.textContent  = hex.toUpperCase();
      badge.style.background = hex;
      badge.style.color  = contrastColor(data[0], data[1], data[2]);
    }

    drawMagnifier(x, y);
  }, [drawMagnifier]);

  const onMouseLeave = useCallback(() => {
    const lens = lensWrapRef.current;
    if (lens) lens.style.opacity = "0";
  }, []);

  // ── Pick color on click ──────────────────────────────────────────────────────
  const onCanvasClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const cont   = previewContRef.current;
    const canvas = previewCanvasRef.current;
    if (!cont || !canvas) return;

    const rect = cont.getBoundingClientRect();
    const x    = e.clientX - rect.left;
    const y    = e.clientY - rect.top;
    if (x < 0 || y < 0 || x > canvas.width || y > canvas.height) return;

    const px   = Math.max(0, Math.min(canvas.width  - 1, Math.floor(x)));
    const py   = Math.max(0, Math.min(canvas.height - 1, Math.floor(y)));
    const data = canvas.getContext("2d")!.getImageData(px, py, 1, 1).data;
    const rgba: RGBA = [data[0], data[1], data[2], data[3]];
    const hex  = rgbToHex(rgba[0], rgba[1], rgba[2]);

    setPickedRGBA(prev => {
      if (prev) setPrevHex(rgbToHex(prev[0], prev[1], prev[2]));
      return rgba;
    });
    setHistory(prev => {
      const filtered = prev.filter(c => rgbToHex(c[0], c[1], c[2]) !== hex);
      return [rgba, ...filtered].slice(0, MAX_HISTORY);
    });
  }, []);

  // ── Derived color values ─────────────────────────────────────────────────────
  const colorInfo = useMemo(() => {
    if (!pickedRGBA) return null;
    const [r, g, b, a] = pickedRGBA;
    const hex           = rgbToHex(r, g, b);
    const [h, s, l]     = rgbToHsl(r, g, b);
    const [hv, sv, v]   = rgbToHsv(r, g, b);
    const [c, m, y, k]  = rgbToCmyk(r, g, b);
    const alpha         = (a / 255).toFixed(2);
    return {
      hex, r, g, b, a,
      rgb:   `rgb(${r}, ${g}, ${b})`,
      rgba:  `rgba(${r}, ${g}, ${b}, ${alpha})`,
      hsl:   `hsl(${h}, ${s}%, ${l}%)`,
      hsv:   `hsv(${hv}, ${sv}%, ${v}%)`,
      cmyk:  `cmyk(${c}%, ${m}%, ${y}%, ${k}%)`,
      h, s, l, hv, sv, v, c, m, y, k,
      contrast: contrastColor(r, g, b),
    };
  }, [pickedRGBA]);

  // ── Clipboard ────────────────────────────────────────────────────────────────
  const copyVal = useCallback(async (value: string, key: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    } catch { /* ignore */ }
  }, []);

  // ── Favorites ────────────────────────────────────────────────────────────────
  const addFav = useCallback(() => {
    if (!pickedRGBA) return;
    const hex = rgbToHex(pickedRGBA[0], pickedRGBA[1], pickedRGBA[2]);
    setFavorites(prev => {
      if (prev.some(c => rgbToHex(c[0], c[1], c[2]) === hex)) {
        setNotif("Already in favorites"); setTimeout(() => setNotif(null), 2000);
        return prev;
      }
      return [pickedRGBA, ...prev].slice(0, 20);
    });
  }, [pickedRGBA]);

  const removeFav = useCallback((hex: string) => {
    setFavorites(prev => prev.filter(c => rgbToHex(c[0], c[1], c[2]) !== hex));
  }, []);

  // ── Drop zone handler ────────────────────────────────────────────────────────
  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDropActive(false);
    const f = e.dataTransfer.files[0];
    if (f) loadFile(f);
  }, [loadFile]);

  // ── Clear ────────────────────────────────────────────────────────────────────
  const clear = useCallback(() => {
    setMainFile(null);
    setMainUrl("");
    mainImgRef.current = null;
    setPickedRGBA(null);
    setPrevHex(null);
    setHistory([]);
  }, []);

  // ── Reusable inner components (defined here to close over copyVal/copied) ────

  const CopyBtn = ({ value, ckey }: { value: string; ckey: string }) => (
    <button onClick={() => copyVal(value, ckey)} aria-label={`Copy ${ckey}`}
      className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold transition-all shrink-0"
      style={{
        background: copied === ckey ? "rgba(100,220,150,0.14)" : "rgba(255,255,255,0.05)",
        color:      copied === ckey ? "#80e0a0"               : "#6a5f72",
        border:     `1px solid ${copied === ckey ? "rgba(100,220,150,0.3)" : "rgba(255,255,255,0.08)"}`,
      }}>
      <span className="material-symbols-outlined text-[11px]">
        {copied === ckey ? "check" : "content_copy"}
      </span>
      {copied === ckey ? "Copied!" : "Copy"}
    </button>
  );

  const ColorRow = ({ label, value }: { label: string; value: string }) => (
    <div className="flex items-center gap-2 py-1.5" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
      <span className="text-[10px] font-bold uppercase tracking-widest w-10 shrink-0" style={{ color: "#3d3345" }}>{label}</span>
      <span className="flex-1 text-[12px] font-mono font-semibold truncate" style={{ color: "#e8dff0" }}>{value}</span>
      <CopyBtn value={value} ckey={label} />
    </div>
  );

  // ── No image: drop zone ──────────────────────────────────────────────────────
  if (!mainFile) {
    return (
      <div className="mb-12 flex flex-col gap-6">
        <div
          onDrop={onDrop}
          onDragOver={e => { e.preventDefault(); setDropActive(true); }}
          onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropActive(false); }}
          onClick={() => fileInputRef.current?.click()}
          role="button" tabIndex={0} aria-label="Upload an image to pick colors from"
          onKeyDown={e => { if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click(); }}
          className="glass-panel rounded-2xl flex flex-col items-center justify-center gap-4 cursor-pointer transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-[#4cd7f6]"
          style={{
            padding: "60px 40px",
            border: `2px dashed ${dropActive ? "#4cd7f6" : "rgba(255,255,255,0.12)"}`,
            background: dropActive ? "rgba(76,215,246,0.04)" : undefined,
          }}>
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 transition-transform duration-200"
            style={{ background: "rgba(76,215,246,0.1)", transform: dropActive ? "scale(1.08)" : "scale(1)" }}>
            <span className="material-symbols-outlined text-[32px]" style={{ color: "#4cd7f6" }}>
              {dropActive ? "file_download" : "colorize"}
            </span>
          </div>
          <div className="text-center">
            <p className="font-semibold text-base" style={{ color: "#e8dff0" }}>
              {dropActive ? "Drop image here" : "Drag & drop an image here"}
            </p>
            <p className="text-sm mt-1" style={{ color: "#988d9f" }}>
              or <span style={{ color: "#4cd7f6" }}>click to browse</span>
              {" "}— JPG, PNG, WebP, BMP, AVIF, GIF · max 50 MB
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-2 mt-1">
            {["HEX","RGB","HSL","HSV","CMYK","Magnifier","Favorites","Browser-local"].map(tag => (
              <span key={tag} className="px-2.5 py-1 rounded-lg text-[11px] font-semibold"
                style={{ background: "rgba(76,215,246,0.08)", color: "#4cd7f6", border: "1px solid rgba(76,215,246,0.15)" }}>
                {tag}
              </span>
            ))}
          </div>
          <input ref={fileInputRef} type="file"
            accept=".jpg,.jpeg,.png,.webp,.bmp,.tiff,.avif,.gif"
            className="sr-only"
            onChange={e => { const f = e.target.files?.[0]; if (f) loadFile(f); e.target.value = ""; }}
            aria-hidden tabIndex={-1} />
        </div>

        {favorites.length > 0 && (
          <div className="glass-panel rounded-2xl p-5 flex flex-col gap-3"
            style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "#988d9f" }}>
                Saved Favorites ({favorites.length})
              </p>
              <button onClick={() => setFavorites([])}
                className="text-[10px] font-semibold transition-opacity hover:opacity-70"
                style={{ color: "#ff8080" }}>
                Clear all
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {favorites.map(c => {
                const hex = rgbToHex(c[0], c[1], c[2]);
                return (
                  <div key={`${hex}-${uid()}`} className="relative group">
                    <div
                      className="w-9 h-9 rounded-xl cursor-pointer border border-white/10 transition-transform hover:scale-110"
                      style={{ background: hex }} title={hex.toUpperCase()}
                      onClick={() => copyVal(hex.toUpperCase(), hex)} />
                    <button onClick={() => removeFav(hex)}
                      aria-label={`Remove ${hex}`}
                      className="absolute -top-1 -right-1 w-4 h-4 rounded-full hidden group-hover:flex items-center justify-center z-10"
                      style={{ background: "#ff8080", color: "#fff" }}>
                      <span className="material-symbols-outlined text-[10px]">close</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Editor ────────────────────────────────────────────────────────────────────
  return (
    <div className="mb-12 flex flex-col gap-4">

      {/* File bar */}
      <div className="glass-panel rounded-2xl px-4 py-3 flex items-center gap-3"
        style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
        <span className="material-symbols-outlined text-[18px]" style={{ color: "#4cd7f6" }}>image</span>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold truncate" style={{ color: "#e8dff0" }}>{mainFile.name}</p>
          <p className="text-[11px]" style={{ color: "#5a4d63" }}>
            {mainImgRef.current
              ? `${mainImgRef.current.naturalWidth}×${mainImgRef.current.naturalHeight} · `
              : ""}
            {fmtSize(mainFile.size)} — Hover to preview · Click to pick
          </p>
        </div>
        <button onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold transition-all shrink-0"
          style={{ background: "rgba(76,215,246,0.08)", color: "#4cd7f6", border: "1px solid rgba(76,215,246,0.2)" }}>
          <span className="material-symbols-outlined text-[14px]">upload_file</span> New Image
        </button>
        <button onClick={clear}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold transition-all shrink-0"
          style={{ background: "rgba(255,80,80,0.08)", color: "#ff8080", border: "1px solid rgba(255,80,80,0.15)" }}>
          <span className="material-symbols-outlined text-[14px]">close</span> Clear
        </button>
      </div>

      {/* Notification */}
      {notif && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-[12px] font-semibold"
          style={{ background: "rgba(76,215,246,0.08)", color: "#4cd7f6", border: "1px solid rgba(76,215,246,0.2)" }}>
          <span className="material-symbols-outlined text-[16px]">info</span>
          {notif}
        </div>
      )}

      {/* Two-column layout */}
      <div className="flex flex-col lg:flex-row gap-4">

        {/* ── Canvas column ──────────────────────────────────────────────────── */}
        <div className="flex-1 min-w-0 flex flex-col gap-3">

          {/* Canvas + magnifier overlay */}
          <div className="glass-panel rounded-2xl overflow-hidden"
            style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
            <div ref={previewContRef} className="relative w-full" style={{ cursor: "crosshair" }}
              onMouseMove={onMouseMove}
              onMouseLeave={onMouseLeave}
              onClick={onCanvasClick}>
              <canvas ref={previewCanvasRef} className="w-full block" />

              {/* Magnifier lens */}
              <div ref={lensWrapRef}
                className="absolute top-0 left-0 pointer-events-none"
                style={{
                  width:        LENS_SIZE,
                  height:       LENS_SIZE,
                  opacity:      0,
                  borderRadius: "50%",
                  overflow:     "hidden",
                  border:       "2.5px solid rgba(255,255,255,0.85)",
                  boxShadow:    "0 6px 28px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(0,0,0,0.2)",
                  willChange:   "transform, opacity",
                  transition:   "opacity 0.12s",
                }}>
                <canvas ref={lensCanvasRef} width={LENS_SIZE} height={LENS_SIZE} />
                {/* HEX badge inside lens, at bottom */}
                <div className="absolute bottom-0 left-0 right-0 flex justify-center pb-2">
                  <span ref={hoverBadgeRef}
                    className="px-2 py-0.5 rounded text-[9px] font-mono font-bold"
                    style={{ background: "#000", color: "#fff", letterSpacing: "0.05em" }}
                  />
                </div>
              </div>
            </div>
          </div>

          {!pickedRGBA && (
            <p className="text-center text-[12px] font-medium" style={{ color: "#4d4354" }}>
              Hover over the image to see the magnifier · Click to pick a color
            </p>
          )}

          {/* Color history */}
          {history.length > 0 && (
            <div className="glass-panel rounded-2xl p-4"
              style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "#988d9f" }}>
                  Color History ({history.length})
                </p>
                <button onClick={() => setHistory([])}
                  className="text-[10px] font-semibold hover:opacity-70 transition-opacity"
                  style={{ color: "#ff8080" }}>
                  Clear
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {history.map((c, i) => {
                  const hex = rgbToHex(c[0], c[1], c[2]);
                  const isCurrent = pickedRGBA && rgbToHex(pickedRGBA[0], pickedRGBA[1], pickedRGBA[2]) === hex;
                  return (
                    <div key={`${hex}-${i}`}
                      title={hex.toUpperCase()}
                      className="relative w-8 h-8 rounded-lg cursor-pointer border transition-all hover:scale-110"
                      style={{
                        background: hex,
                        borderColor: isCurrent ? "rgba(76,215,246,0.8)" : "rgba(255,255,255,0.1)",
                        boxShadow: isCurrent ? `0 0 0 2px rgba(76,215,246,0.4)` : undefined,
                      }}
                      onClick={() => {
                        if (pickedRGBA) setPrevHex(rgbToHex(pickedRGBA[0], pickedRGBA[1], pickedRGBA[2]));
                        setPickedRGBA(c);
                      }}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ── Color info panel ──────────────────────────────────────────────── */}
        <div className="lg:w-72 xl:w-80 shrink-0 flex flex-col gap-3">

          {/* Color swatch */}
          <div className="glass-panel rounded-2xl p-4 flex flex-col gap-3"
            style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
            <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "#988d9f" }}>
              Selected Color
            </p>

            <div className="flex gap-3 items-end">
              {/* Current */}
              <div className="flex-1 flex flex-col gap-1.5">
                <div className="h-20 rounded-xl border border-white/10 transition-all duration-300"
                  style={{
                    background: colorInfo?.hex ?? "rgba(255,255,255,0.04)",
                    boxShadow: colorInfo ? `0 4px 20px ${colorInfo.hex}55` : undefined,
                  }} />
                <p className="text-[10px] text-center font-semibold" style={{ color: "#988d9f" }}>Current</p>
              </div>
              {/* Previous */}
              {prevHex && (
                <div className="w-14 flex flex-col gap-1.5">
                  <div className="h-14 rounded-xl border border-white/10" style={{ background: prevHex }} />
                  <p className="text-[10px] text-center font-semibold" style={{ color: "#988d9f" }}>Previous</p>
                </div>
              )}
            </div>

            {colorInfo ? (
              <div className="flex items-center gap-2">
                <span className="text-[14px] font-mono font-bold" style={{ color: "#e8dff0" }}>
                  {colorInfo.hex.toUpperCase()}
                </span>
                <button onClick={addFav} aria-label="Save to favorites"
                  className="ml-auto flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all"
                  style={{ background: "rgba(255,185,0,0.1)", color: "#f5c542", border: "1px solid rgba(255,185,0,0.2)" }}>
                  <span className="material-symbols-outlined text-[13px]">star</span> Save
                </button>
              </div>
            ) : (
              <p className="text-[11px] text-center py-2" style={{ color: "#4d4354" }}>
                Click the image above to pick a color
              </p>
            )}
          </div>

          {/* Color values */}
          {colorInfo && (
            <div className="glass-panel rounded-2xl p-4"
              style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
              <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: "#988d9f" }}>
                Color Values
              </p>
              <ColorRow label="HEX"  value={colorInfo.hex.toUpperCase()} />
              <ColorRow label="RGB"  value={colorInfo.rgb} />
              <ColorRow label="RGBA" value={colorInfo.rgba} />
              <ColorRow label="HSL"  value={colorInfo.hsl} />
              <ColorRow label="HSV"  value={colorInfo.hsv} />
              <ColorRow label="CMYK" value={colorInfo.cmyk} />
            </div>
          )}

          {/* RGB channel bars */}
          {colorInfo && (
            <div className="glass-panel rounded-2xl p-4"
              style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
              <p className="text-[10px] font-semibold uppercase tracking-widest mb-3" style={{ color: "#988d9f" }}>
                RGB Channels
              </p>
              {([
                { ch: "R", val: colorInfo.r, col: "#ff6b6b" },
                { ch: "G", val: colorInfo.g, col: "#6bcb77" },
                { ch: "B", val: colorInfo.b, col: "#4fc3f7" },
              ] as const).map(({ ch, val, col }) => (
                <div key={ch} className="flex items-center gap-2 mb-2 last:mb-0">
                  <span className="text-[11px] font-bold w-3 shrink-0" style={{ color: col }}>{ch}</span>
                  <div className="flex-1 h-2 rounded-full overflow-hidden"
                    style={{ background: "rgba(255,255,255,0.07)" }}>
                    <div className="h-full rounded-full transition-all duration-300"
                      style={{ width: `${(val / 255) * 100}%`, background: col }} />
                  </div>
                  <span className="text-[11px] font-mono tabular-nums w-8 text-right" style={{ color: "#e8dff0" }}>
                    {val}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Quick Copy */}
          {colorInfo && (
            <div className="glass-panel rounded-2xl p-4"
              style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
              <p className="text-[10px] font-semibold uppercase tracking-widest mb-3" style={{ color: "#988d9f" }}>
                Quick Copy
              </p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "HEX",  val: colorInfo.hex.toUpperCase(), key: "qc-hex"  },
                  { label: "RGB",  val: colorInfo.rgb,               key: "qc-rgb"  },
                  { label: "HSL",  val: colorInfo.hsl,               key: "qc-hsl"  },
                  { label: "RGBA", val: colorInfo.rgba,              key: "qc-rgba" },
                ].map(({ label, val, key }) => (
                  <button key={key} onClick={() => copyVal(val, key)}
                    aria-label={`Copy ${label}`}
                    className="flex items-center justify-center gap-1.5 py-2 rounded-xl text-[11px] font-bold transition-all"
                    style={{
                      background: copied === key ? "rgba(100,220,150,0.12)" : "rgba(255,255,255,0.04)",
                      color:      copied === key ? "#80e0a0"               : "#988d9f",
                      border:     `1px solid ${copied === key ? "rgba(100,220,150,0.3)" : "rgba(255,255,255,0.08)"}`,
                    }}>
                    <span className="material-symbols-outlined text-[13px]">
                      {copied === key ? "check" : "content_copy"}
                    </span>
                    {copied === key ? "Copied!" : label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Favorites */}
          <div className="glass-panel rounded-2xl p-4"
            style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "#988d9f" }}>
                Favorites ({favorites.length})
              </p>
              {favorites.length > 0 && (
                <button onClick={() => setFavorites([])}
                  className="text-[10px] font-semibold hover:opacity-70 transition-opacity"
                  style={{ color: "#ff8080" }}>
                  Clear all
                </button>
              )}
            </div>
            {favorites.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {favorites.map(c => {
                  const hex = rgbToHex(c[0], c[1], c[2]);
                  return (
                    <div key={hex} className="relative group">
                      <div
                        className="w-8 h-8 rounded-lg cursor-pointer border border-white/10 transition-all hover:scale-110"
                        style={{ background: hex }} title={hex.toUpperCase()}
                        onClick={() => copyVal(hex.toUpperCase(), hex)} />
                      <button onClick={() => removeFav(hex)}
                        aria-label={`Remove ${hex} from favorites`}
                        className="absolute -top-1 -right-1 w-4 h-4 rounded-full hidden group-hover:flex items-center justify-center z-10"
                        style={{ background: "#ff8080", color: "#fff" }}>
                        <span className="material-symbols-outlined text-[10px]">close</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-[11px] text-center py-3" style={{ color: "#4d4354" }}>
                Pick a color then click ★ Save to add favorites
              </p>
            )}
          </div>

          {/* Reset */}
          <button
            onClick={() => { setPickedRGBA(null); setPrevHex(null); setHistory([]); }}
            className="flex items-center justify-center gap-2 py-3 rounded-2xl font-semibold text-sm transition-all"
            style={{
              background: "rgba(255,255,255,0.04)",
              color: "#988d9f",
              border: "1px solid rgba(255,255,255,0.08)",
            }}>
            <span className="material-symbols-outlined text-[16px]">restart_alt</span>
            Reset Colors
          </button>
        </div>
      </div>

      {/* Hidden file input (reused for "New Image") */}
      <input ref={fileInputRef} type="file"
        accept=".jpg,.jpeg,.png,.webp,.bmp,.tiff,.avif,.gif"
        className="sr-only"
        onChange={e => { const f = e.target.files?.[0]; if (f) loadFile(f); e.target.value = ""; }}
        aria-hidden tabIndex={-1} />
    </div>
  );
}
