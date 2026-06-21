"use client";

/**
 * Image Cropper — browser-local image cropping
 *
 * Architecture:
 *   • A <canvas> renders the image with CSS-matched buffer size so pointer
 *     event coordinates align 1-to-1 with canvas pixels.
 *   • An absolute overlay div hosts the crop-box div + 8 resize handles.
 *   • imageRect ref tracks where the image is drawn (left, top, w, h)
 *     in canvas / container px, updated after every redraw.
 *   • Crop box state is in container px. On export it is converted to
 *     native image px via renderScale, then drawn at full resolution.
 *   • Rotation and flip are applied via ctx.transform before drawImage.
 */

import { useState, useRef, useCallback, useEffect } from "react";

// ── Constants ─────────────────────────────────────────────────────────────────
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/bmp"];
const ACCEPTED_EXT   = ".jpg,.jpeg,.png,.webp,.gif,.bmp";
const MAX_FILE_BYTES = 50 * 1024 * 1024;
const CANVAS_H       = 460;   // fixed canvas buffer height (px)
const MIN_CROP_PX    = 16;    // minimum crop-box edge in display px
const ZOOM_STEP      = 0.15;
const MIN_ZOOM       = 0.3;
const MAX_ZOOM       = 4;

// ── Types ─────────────────────────────────────────────────────────────────────
type AspectMode = "free" | "1:1" | "4:3" | "16:9" | "3:2" | "9:16" | "custom";
type Format     = "jpg" | "png" | "webp";
type Handle     = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";
type NotifType  = "success" | "error" | "info";

interface CropBox { x: number; y: number; w: number; h: number }

interface ImageRect { left: number; top: number; width: number; height: number }

// ── Data ──────────────────────────────────────────────────────────────────────
const FORMAT_MIME: Record<Format, string> = {
  jpg: "image/jpeg", png: "image/png", webp: "image/webp",
};

const ASPECT_OPTIONS: { label: string; value: AspectMode; ratio: number | null }[] = [
  { label: "Free",  value: "free",  ratio: null },
  { label: "1:1",   value: "1:1",   ratio: 1 },
  { label: "4:3",   value: "4:3",   ratio: 4 / 3 },
  { label: "16:9",  value: "16:9",  ratio: 16 / 9 },
  { label: "3:2",   value: "3:2",   ratio: 3 / 2 },
  { label: "9:16",  value: "9:16",  ratio: 9 / 16 },
  { label: "Custom", value: "custom", ratio: null },
];

const HANDLES: Handle[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];

const HANDLE_STYLE: Record<Handle, React.CSSProperties> = {
  nw: { top: -5, left: -5, cursor: "nw-resize" },
  n:  { top: -5, left: "calc(50% - 5px)", cursor: "n-resize" },
  ne: { top: -5, right: -5, cursor: "ne-resize" },
  e:  { top: "calc(50% - 5px)", right: -5, cursor: "e-resize" },
  se: { bottom: -5, right: -5, cursor: "se-resize" },
  s:  { bottom: -5, left: "calc(50% - 5px)", cursor: "s-resize" },
  sw: { bottom: -5, left: -5, cursor: "sw-resize" },
  w:  { top: "calc(50% - 5px)", left: -5, cursor: "w-resize" },
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(b: number): string {
  if (b < 1024)      return `${b} B`;
  if (b < 1_048_576) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1_048_576).toFixed(2)} MB`;
}

function baseName(name: string): string { return name.replace(/\.[^.]+$/, ""); }

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }

/** Effective aspect ratio given mode and custom values */
function getAR(mode: AspectMode, cW: number, cH: number): number | null {
  const found = ASPECT_OPTIONS.find(a => a.value === mode);
  if (!found) return null;
  if (mode === "custom") return cH > 0 ? cW / cH : null;
  return found.ratio;
}

/**
 * Redraws the image on the canvas with the given transforms.
 * Returns the imageRect in canvas-local px.
 */
function redraw(
  canvas: HTMLCanvasElement,
  img: HTMLImageElement,
  rotation: number,
  flipH: boolean,
  flipV: boolean,
  zoom: number,
): ImageRect {
  const cW = canvas.width;
  const cH = canvas.height;
  const rotated = rotation % 180 !== 0;
  const rotW = rotated ? img.naturalHeight : img.naturalWidth;
  const rotH = rotated ? img.naturalWidth  : img.naturalHeight;

  const padding   = 0.90;
  const fitScale  = Math.min(cW / rotW, cH / rotH) * padding;
  const renderScale = fitScale * zoom;

  const dispW = rotW * renderScale;
  const dispH = rotH * renderScale;
  const left  = (cW - dispW) / 2;
  const top   = (cH - dispH) / 2;

  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, cW, cH);

  // Checkerboard background
  const sq = 12;
  for (let ry = 0; ry < cH; ry += sq) {
    for (let rx = 0; rx < cW; rx += sq) {
      ctx.fillStyle = ((rx / sq + ry / sq) % 2 === 0) ? "#2a2a3a" : "#1e1e2e";
      ctx.fillRect(rx, ry, sq, sq);
    }
  }

  // Draw image
  const drawNatW = rotated ? img.naturalHeight : img.naturalWidth;
  const drawNatH = rotated ? img.naturalWidth  : img.naturalHeight;

  ctx.save();
  ctx.translate(cW / 2, cH / 2);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
  ctx.drawImage(img, -drawNatW * renderScale / 2, -drawNatH * renderScale / 2, drawNatW * renderScale, drawNatH * renderScale);
  ctx.restore();

  return { left, top, width: dispW, height: dispH };
}

/** Constrain a crop box to image bounds, applying aspect ratio if needed */
function constrainBox(
  box: CropBox,
  imgRect: ImageRect,
  ar: number | null,
): CropBox {
  let { x, y, w, h } = box;

  // Clamp to image rect
  x = clamp(x, imgRect.left, imgRect.left + imgRect.width  - MIN_CROP_PX);
  y = clamp(y, imgRect.top,  imgRect.top  + imgRect.height - MIN_CROP_PX);
  w = clamp(w, MIN_CROP_PX, imgRect.left + imgRect.width  - x);
  h = clamp(h, MIN_CROP_PX, imgRect.top  + imgRect.height - y);

  if (ar !== null) {
    // Enforce AR by adjusting height
    h = w / ar;
    if (h < MIN_CROP_PX) { h = MIN_CROP_PX; w = h * ar; }
    if (y + h > imgRect.top + imgRect.height) {
      h = imgRect.top + imgRect.height - y;
      w = h * ar;
    }
    if (x + w > imgRect.left + imgRect.width) {
      w = imgRect.left + imgRect.width - x;
      h = w / ar;
    }
  }

  return { x, y, w, h };
}

/** Apply handle drag delta to orig box */
function applyHandle(
  handle: Handle,
  dx: number,
  dy: number,
  orig: CropBox,
  ar: number | null,
  imgRect: ImageRect,
): CropBox {
  let { x, y, w, h } = orig;

  if (handle.includes("w")) { x += dx; w -= dx; }
  if (handle.includes("e")) { w += dx; }
  if (handle.includes("n")) { y += dy; h -= dy; }
  if (handle.includes("s")) { h += dy; }

  // Enforce minimums before AR
  if (w < MIN_CROP_PX) { if (handle.includes("w")) x = orig.x + orig.w - MIN_CROP_PX; w = MIN_CROP_PX; }
  if (h < MIN_CROP_PX) { if (handle.includes("n")) y = orig.y + orig.h - MIN_CROP_PX; h = MIN_CROP_PX; }

  // Apply AR: primary axis = whichever dimension was dragged
  if (ar !== null) {
    const hDir = handle.includes("e") || handle.includes("w");
    if (hDir) {
      const nh = w / ar;
      if (handle.includes("n")) y = orig.y + orig.h - nh;
      h = nh;
    } else {
      const nw = h * ar;
      if (handle.includes("w")) x = orig.x + orig.w - nw;
      w = nw;
    }
  }

  return constrainBox({ x, y, w, h }, imgRect, null); // already has AR applied
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function ImageCropperTool() {
  // File / image
  const [imgFile,  setImgFile]  = useState<File | null>(null);
  const [imgUrl,   setImgUrl]   = useState("");
  const [natW,     setNatW]     = useState(0);
  const [natH,     setNatH]     = useState(0);

  // Transforms
  const [rotation, setRotation] = useState(0);
  const [flipH,    setFlipH]    = useState(false);
  const [flipV,    setFlipV]    = useState(false);
  const [zoom,     setZoom]     = useState(1);

  // Crop
  const [cropBox,    setCropBox]    = useState<CropBox | null>(null);
  const [aspectMode, setAspectMode] = useState<AspectMode>("free");
  const [customARW,  setCustomARW]  = useState(16);
  const [customARH,  setCustomARH]  = useState(9);

  // Export
  const [format,     setFormat]     = useState<Format>("jpg");
  const [quality,    setQuality]    = useState(90);
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);
  const [resultUrl,  setResultUrl]  = useState("");
  const [cropping,   setCropping]   = useState(false);

  // UI
  const [dragging,   setDragging]   = useState(false);
  const [notif,      setNotif]      = useState<{ type: NotifType; msg: string } | null>(null);
  const [canvasW,    setCanvasW]    = useState(700);

  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const inputRef     = useRef<HTMLInputElement>(null);
  const dropRef      = useRef<HTMLDivElement>(null);
  const imgElRef     = useRef<HTMLImageElement | null>(null);
  const imageRectRef = useRef<ImageRect>({ left: 0, top: 0, width: 0, height: 0 });

  // Interaction ref — avoids stale closures during pointer drag
  const interactionRef = useRef<{
    type: "move" | "resize";
    handle?: Handle;
    startX: number; startY: number;
    origBox: CropBox;
  } | null>(null);

  const notify = useCallback((type: NotifType, msg: string) => {
    setNotif({ type, msg });
    if (type !== "info") setTimeout(() => setNotif(null), 7000);
  }, []);

  // ── Canvas resize observer ────────────────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      const w = entries[0]?.contentRect.width ?? 700;
      setCanvasW(Math.round(w));
    });
    ro.observe(el);
    setCanvasW(Math.round(el.clientWidth));
    return () => ro.disconnect();
  }, []);

  // ── Draw whenever image/transforms/zoom/canvasW change ───────────────────
  const doRedraw = useCallback(() => {
    const canvas = canvasRef.current;
    const img    = imgElRef.current;
    if (!canvas || !img || !imgUrl) return;

    canvas.width  = canvasW;
    canvas.height = CANVAS_H;

    const ir = redraw(canvas, img, rotation, flipH, flipV, zoom);
    imageRectRef.current = ir;

    // Reset crop to full image whenever transforms change (but not on first load)
    setCropBox(prev => {
      if (!prev) {
        // Initial: full image
        return constrainBox({ x: ir.left, y: ir.top, w: ir.width, h: ir.height },
          ir, getAR(aspectMode, customARW, customARH));
      }
      // Re-constrain existing box
      return constrainBox(prev, ir, getAR(aspectMode, customARW, customARH));
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imgUrl, rotation, flipH, flipV, zoom, canvasW]);

  useEffect(() => { doRedraw(); }, [doRedraw]);

  // ── Load file ─────────────────────────────────────────────────────────────
  const loadFile = useCallback((file: File) => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      notify("error", `"${file.name}" is not supported. Upload JPG, PNG, WEBP, GIF or BMP.`);
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      notify("error", `"${file.name}" exceeds 50 MB.`);
      return;
    }

    if (imgUrl) URL.revokeObjectURL(imgUrl);
    if (resultUrl) URL.revokeObjectURL(resultUrl);

    const url  = URL.createObjectURL(file);
    const imgEl = new Image();
    imgEl.onload = () => {
      imgElRef.current = imgEl;
      setImgFile(file);
      setImgUrl(url);
      setNatW(imgEl.naturalWidth);
      setNatH(imgEl.naturalHeight);
      setRotation(0);
      setFlipH(false);
      setFlipV(false);
      setZoom(1);
      setAspectMode("free");
      setCropBox(null);
      setResultBlob(null);
      setResultUrl("");
      setNotif(null);
    };
    imgEl.onerror = () => { notify("error", "Could not read this image."); URL.revokeObjectURL(url); };
    imgEl.src = url;
  }, [imgUrl, resultUrl, notify]);

  // ── Drop zone ─────────────────────────────────────────────────────────────
  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const f = e.dataTransfer.files[0]; if (f) loadFile(f);
  }, [loadFile]);

  const onDragOver  = useCallback((e: React.DragEvent) => { e.preventDefault(); setDragging(true); }, []);
  const onDragLeave = useCallback((e: React.DragEvent) => {
    if (dropRef.current && !dropRef.current.contains(e.relatedTarget as Node)) setDragging(false);
  }, []);

  // ── Aspect ratio change ───────────────────────────────────────────────────
  const changeAspect = useCallback((mode: AspectMode) => {
    setAspectMode(mode);
    const ar = getAR(mode, customARW, customARH);
    setCropBox(prev => prev ? constrainBox(prev, imageRectRef.current, ar) : null);
  }, [customARW, customARH]);

  useEffect(() => {
    const ar = getAR(aspectMode, customARW, customARH);
    setCropBox(prev => prev ? constrainBox(prev, imageRectRef.current, ar) : null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customARW, customARH]);

  // ── Pointer events on crop box ────────────────────────────────────────────
  const getCropBoxPos = useCallback((e: React.PointerEvent): { x: number; y: number } => {
    const rect = containerRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }, []);

  const onBoxPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (!cropBox) return;
    const pos = getCropBoxPos(e);
    interactionRef.current = { type: "move", startX: pos.x, startY: pos.y, origBox: { ...cropBox } };
    e.currentTarget.setPointerCapture(e.pointerId);
  }, [cropBox, getCropBoxPos]);

  const onBoxPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const int = interactionRef.current;
    if (!int || int.type !== "move" || !cropBox) return;
    const pos = getCropBoxPos(e);
    const dx = pos.x - int.startX;
    const dy = pos.y - int.startY;
    const ir = imageRectRef.current;
    const ar = getAR(aspectMode, customARW, customARH);
    const nb: CropBox = {
      x: clamp(int.origBox.x + dx, ir.left, ir.left + ir.width  - int.origBox.w),
      y: clamp(int.origBox.y + dy, ir.top,  ir.top  + ir.height - int.origBox.h),
      w: int.origBox.w,
      h: int.origBox.h,
    };
    setCropBox(constrainBox(nb, ir, ar));
  }, [cropBox, getCropBoxPos, aspectMode, customARW, customARH]);

  const onBoxPointerUp = useCallback(() => { interactionRef.current = null; }, []);

  const onHandlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>, handle: Handle) => {
    e.stopPropagation();
    if (!cropBox) return;
    const pos = getCropBoxPos(e);
    interactionRef.current = { type: "resize", handle, startX: pos.x, startY: pos.y, origBox: { ...cropBox } };
    e.currentTarget.setPointerCapture(e.pointerId);
  }, [cropBox, getCropBoxPos]);

  const onHandlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>, handle: Handle) => {
    const int = interactionRef.current;
    if (!int || int.type !== "resize" || int.handle !== handle || !cropBox) return;
    const pos = getCropBoxPos(e);
    const dx  = pos.x - int.startX;
    const dy  = pos.y - int.startY;
    const ar  = getAR(aspectMode, customARW, customARH);
    setCropBox(applyHandle(handle, dx, dy, int.origBox, ar, imageRectRef.current));
  }, [cropBox, getCropBoxPos, aspectMode, customARW, customARH]);

  const onHandlePointerUp = useCallback(() => { interactionRef.current = null; }, []);

  // ── Rotate / flip ─────────────────────────────────────────────────────────
  const rotate = useCallback((delta: number) => {
    setRotation(r => (r + delta + 360) % 360);
    setCropBox(null); // reset crop box — image dims may swap
  }, []);

  // ── Zoom ──────────────────────────────────────────────────────────────────
  const changeZoom = useCallback((delta: number) => {
    setZoom(z => clamp(z + delta, MIN_ZOOM, MAX_ZOOM));
  }, []);

  // ── Crop & export ─────────────────────────────────────────────────────────
  const doCrop = useCallback(async () => {
    if (!cropBox || !imgElRef.current || !imgUrl) return;
    setCropping(true);
    if (resultUrl) URL.revokeObjectURL(resultUrl);
    setResultBlob(null);
    setResultUrl("");

    try {
      const img = imgElRef.current;
      const ir  = imageRectRef.current;

      // Compute renderScale: how many display px per native px (in rotated space)
      const rotated = rotation % 180 !== 0;
      const rotW    = rotated ? img.naturalHeight : img.naturalWidth;
      const rotH    = rotated ? img.naturalWidth  : img.naturalHeight;
      const renderScale = ir.width / rotW; // = fitScale * zoom

      // Build intermediate canvas: full rotated image at native resolution
      const tmpCanvas    = document.createElement("canvas");
      tmpCanvas.width    = rotW;
      tmpCanvas.height   = rotH;
      const tCtx         = tmpCanvas.getContext("2d")!;
      tCtx.translate(rotW / 2, rotH / 2);
      tCtx.rotate((rotation * Math.PI) / 180);
      tCtx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
      tCtx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);

      // Crop region in native-resolution rotated-image px
      const srcX = Math.round((cropBox.x - ir.left) / renderScale);
      const srcY = Math.round((cropBox.y - ir.top)  / renderScale);
      const srcW = Math.round(cropBox.w / renderScale);
      const srcH = Math.round(cropBox.h / renderScale);

      // Output canvas
      const outCanvas    = document.createElement("canvas");
      outCanvas.width    = Math.max(1, srcW);
      outCanvas.height   = Math.max(1, srcH);
      const oCtx         = outCanvas.getContext("2d")!;
      if (format === "jpg") { oCtx.fillStyle = "#ffffff"; oCtx.fillRect(0, 0, srcW, srcH); }
      oCtx.drawImage(tmpCanvas, srcX, srcY, srcW, srcH, 0, 0, srcW, srcH);

      const blob = await new Promise<Blob>((res, rej) =>
        outCanvas.toBlob(
          b => b ? res(b) : rej(new Error("Export failed")),
          FORMAT_MIME[format],
          format === "png" ? undefined : quality / 100,
        ),
      );

      const blobUrl = URL.createObjectURL(blob);
      setResultBlob(blob);
      setResultUrl(blobUrl);
      notify("success", `Cropped to ${srcW}×${srcH} px — ${fmt(blob.size)}.`);
    } catch (err) {
      notify("error", err instanceof Error ? err.message : "Crop failed.");
    } finally {
      setCropping(false);
    }
  }, [cropBox, imgUrl, rotation, flipH, flipV, format, quality, resultUrl, notify]);

  // ── Download ──────────────────────────────────────────────────────────────
  const doDownload = useCallback(() => {
    if (!resultBlob || !imgFile) return;
    downloadBlob(resultBlob, `${baseName(imgFile.name)}-cropped.${format}`);
  }, [resultBlob, imgFile, format]);

  // ── Reset ─────────────────────────────────────────────────────────────────
  const reset = useCallback(() => {
    if (imgUrl)    URL.revokeObjectURL(imgUrl);
    if (resultUrl) URL.revokeObjectURL(resultUrl);
    imgElRef.current = null;
    setImgFile(null); setImgUrl(""); setNatW(0); setNatH(0);
    setRotation(0); setFlipH(false); setFlipV(false); setZoom(1);
    setCropBox(null); setAspectMode("free");
    setResultBlob(null); setResultUrl(""); setNotif(null);
    if (inputRef.current) inputRef.current.value = "";
    const canvas = canvasRef.current;
    if (canvas) { canvas.getContext("2d")!.clearRect(0, 0, canvas.width, canvas.height); }
  }, [imgUrl, resultUrl]);

  // Cleanup on unmount
  useEffect(() => () => {
    if (imgUrl)    URL.revokeObjectURL(imgUrl);
    if (resultUrl) URL.revokeObjectURL(resultUrl);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derived ───────────────────────────────────────────────────────────────
  const ar = getAR(aspectMode, customARW, customARH);
  const cropW_nat = cropBox ? Math.round(cropBox.w / (imageRectRef.current.width  / (rotation % 180 !== 0 ? natH : natW))) : 0;
  const cropH_nat = cropBox ? Math.round(cropBox.h / (imageRectRef.current.height / (rotation % 180 !== 0 ? natW : natH))) : 0;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="mb-12 flex flex-col gap-6">

      {/* ── Drop zone ───────────────────────────────────────────────────────── */}
      {!imgFile && (
        <div ref={dropRef}
          onDrop={onDrop} onDragOver={onDragOver} onDragLeave={onDragLeave}
          onClick={() => inputRef.current?.click()}
          role="button" tabIndex={0} aria-label="Upload image to crop"
          onKeyDown={e => { if (e.key === "Enter" || e.key === " ") inputRef.current?.click(); }}
          className="glass-panel rounded-2xl flex flex-col items-center justify-center gap-4 cursor-pointer transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-[#4cd7f6]"
          style={{
            padding: "52px 40px", minHeight: "220px",
            border: `2px dashed ${dragging ? "#4cd7f6" : "rgba(255,255,255,0.12)"}`,
            background: dragging ? "rgba(76,215,246,0.05)" : undefined,
          }}>
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center transition-transform duration-200"
            style={{ background: "rgba(76,215,246,0.1)", transform: dragging ? "scale(1.1)" : "scale(1)" }}>
            <span className="material-symbols-outlined text-[32px]" style={{ color: "#4cd7f6" }}>
              {dragging ? "file_download" : "crop"}
            </span>
          </div>
          <div className="text-center">
            <p className="font-semibold text-base" style={{ color: "#e8dff0" }}>
              {dragging ? "Drop your image here" : "Drag & drop an image here"}
            </p>
            <p className="text-sm mt-1" style={{ color: "#988d9f" }}>
              or <span style={{ color: "#4cd7f6" }}>click to browse</span> — JPG, PNG, WEBP, GIF, BMP · max 50 MB
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            {["Free crop", "1:1", "16:9", "4:3", "Rotate & flip", "Browser-local"].map(tag => (
              <span key={tag} className="px-2.5 py-1 rounded-lg text-[11px] font-semibold"
                style={{ background: "rgba(76,215,246,0.08)", color: "#4cd7f6", border: "1px solid rgba(76,215,246,0.15)" }}>
                {tag}
              </span>
            ))}
          </div>
          <input ref={inputRef} type="file" accept={ACCEPTED_EXT} className="sr-only"
            onChange={e => { const f = e.target.files?.[0]; if (f) loadFile(f); e.target.value = ""; }}
            aria-hidden tabIndex={-1} />
        </div>
      )}

      {/* ── Notification ────────────────────────────────────────────────────── */}
      {notif && (
        <div role="alert" className="flex items-start gap-3 p-4 rounded-2xl text-sm font-medium"
          style={{
            background: notif.type === "error" ? "rgba(255,100,100,0.1)" : notif.type === "success" ? "rgba(100,220,150,0.1)" : "rgba(76,215,246,0.1)",
            border: `1px solid ${notif.type === "error" ? "rgba(255,100,100,0.25)" : notif.type === "success" ? "rgba(100,220,150,0.25)" : "rgba(76,215,246,0.25)"}`,
            color: notif.type === "error" ? "#ff8080" : notif.type === "success" ? "#80e0a0" : "#4cd7f6",
          }}>
          <span className="material-symbols-outlined text-[18px] mt-0.5 shrink-0">
            {notif.type === "error" ? "error" : notif.type === "success" ? "check_circle" : "info"}
          </span>
          <span className="flex-1">{notif.msg}</span>
          <button onClick={() => setNotif(null)} aria-label="Dismiss" className="opacity-60 hover:opacity-100 transition-opacity">
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>
      )}

      {/* ── Editor ──────────────────────────────────────────────────────────── */}
      {imgFile && (
        <div className="flex flex-col gap-4">

          {/* File header */}
          <div className="glass-panel rounded-2xl px-4 py-3 flex items-center gap-3"
            style={{ border: "1px solid rgba(76,215,246,0.2)" }}>
            <div className="w-9 h-9 rounded-xl overflow-hidden shrink-0 border border-white/10">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imgUrl} alt="preview" className="w-full h-full object-cover" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm truncate" style={{ color: "#e8dff0" }}>{imgFile.name}</p>
              <p className="text-xs" style={{ color: "#988d9f" }}>{natW} × {natH} px · {fmt(imgFile.size)}</p>
            </div>
            <button onClick={reset}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
              style={{ background: "rgba(255,255,255,0.06)", color: "#988d9f", border: "1px solid rgba(255,255,255,0.08)" }}>
              <span className="material-symbols-outlined text-[14px]">close</span>Reset
            </button>
          </div>

          {/* Stats bar */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Original",     value: `${natW} × ${natH}`,                      icon: "open_in_full", accent: false },
              { label: "Crop region",  value: cropBox ? `${cropW_nat} × ${cropH_nat}` : "—", icon: "crop",     accent: true  },
              { label: "Original file", value: fmt(imgFile.size),                         icon: "folder",       accent: false },
              { label: "Cropped file", value: resultBlob ? fmt(resultBlob.size) : "—",   icon: "download",     accent: !!resultBlob },
            ].map(({ label, value, icon, accent }) => (
              <div key={label} className="glass-panel rounded-2xl p-4 flex flex-col gap-1"
                style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
                <span className="material-symbols-outlined text-[16px]"
                  style={{ color: accent ? "#4cd7f6" : "#988d9f" }}>{icon}</span>
                <p className="text-base font-bold tabular-nums leading-tight"
                  style={{ color: accent ? "#4cd7f6" : "#e8dff0" }}>{value}</p>
                <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#988d9f" }}>{label}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-col lg:flex-row gap-4 items-start">

            {/* ── Left: Controls ───────────────────────────────────────────── */}
            <div className="w-full lg:w-[260px] shrink-0 flex flex-col gap-4">

              {/* Aspect ratio */}
              <div className="glass-panel rounded-2xl p-4 flex flex-col gap-3"
                style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
                <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "#988d9f" }}>Aspect Ratio</p>
                <div className="grid grid-cols-3 gap-1.5">
                  {ASPECT_OPTIONS.map(opt => (
                    <button key={opt.value} onClick={() => changeAspect(opt.value)}
                      aria-pressed={aspectMode === opt.value}
                      className="py-2 rounded-xl text-[12px] font-bold transition-all"
                      style={{
                        background: aspectMode === opt.value ? "rgba(76,215,246,0.15)" : "rgba(255,255,255,0.04)",
                        color:      aspectMode === opt.value ? "#4cd7f6"                : "#988d9f",
                        border:     `1px solid ${aspectMode === opt.value ? "rgba(76,215,246,0.35)" : "rgba(255,255,255,0.08)"}`,
                      }}>
                      {opt.label}
                    </button>
                  ))}
                </div>

                {/* Custom ratio inputs */}
                {aspectMode === "custom" && (
                  <div className="flex items-center gap-2">
                    <input type="number" min={1} max={9999} value={customARW}
                      onChange={e => setCustomARW(Math.max(1, parseInt(e.target.value) || 1))}
                      aria-label="Custom aspect ratio width"
                      className="w-16 px-2 py-1.5 rounded-lg text-[13px] font-bold tabular-nums text-center outline-none"
                      style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "#e8dff0" }} />
                    <span className="text-[#988d9f] font-bold">:</span>
                    <input type="number" min={1} max={9999} value={customARH}
                      onChange={e => setCustomARH(Math.max(1, parseInt(e.target.value) || 1))}
                      aria-label="Custom aspect ratio height"
                      className="w-16 px-2 py-1.5 rounded-lg text-[13px] font-bold tabular-nums text-center outline-none"
                      style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "#e8dff0" }} />
                  </div>
                )}
              </div>

              {/* Transform controls */}
              <div className="glass-panel rounded-2xl p-4 flex flex-col gap-3"
                style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
                <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "#988d9f" }}>Transform</p>

                {/* Rotation */}
                <div className="flex gap-2">
                  <button onClick={() => rotate(-90)} aria-label="Rotate 90° counter-clockwise"
                    className="flex-1 flex items-center justify-center gap-1 py-2 rounded-xl text-[12px] font-semibold transition-all"
                    style={{ background: "rgba(255,255,255,0.05)", color: "#988d9f", border: "1px solid rgba(255,255,255,0.08)" }}>
                    <span className="material-symbols-outlined text-[16px]">rotate_left</span>−90°
                  </button>
                  <button onClick={() => rotate(90)} aria-label="Rotate 90° clockwise"
                    className="flex-1 flex items-center justify-center gap-1 py-2 rounded-xl text-[12px] font-semibold transition-all"
                    style={{ background: "rgba(255,255,255,0.05)", color: "#988d9f", border: "1px solid rgba(255,255,255,0.08)" }}>
                    <span className="material-symbols-outlined text-[16px]">rotate_right</span>+90°
                  </button>
                </div>

                {/* Flip */}
                <div className="flex gap-2">
                  <button onClick={() => setFlipH(v => !v)} aria-pressed={flipH}
                    className="flex-1 flex items-center justify-center gap-1 py-2 rounded-xl text-[12px] font-semibold transition-all"
                    style={{
                      background: flipH ? "rgba(76,215,246,0.12)" : "rgba(255,255,255,0.05)",
                      color:      flipH ? "#4cd7f6"                : "#988d9f",
                      border:     `1px solid ${flipH ? "rgba(76,215,246,0.3)" : "rgba(255,255,255,0.08)"}`,
                    }}>
                    <span className="material-symbols-outlined text-[16px]">flip</span>Flip H
                  </button>
                  <button onClick={() => setFlipV(v => !v)} aria-pressed={flipV}
                    className="flex-1 flex items-center justify-center gap-1 py-2 rounded-xl text-[12px] font-semibold transition-all"
                    style={{
                      background: flipV ? "rgba(76,215,246,0.12)" : "rgba(255,255,255,0.05)",
                      color:      flipV ? "#4cd7f6"                : "#988d9f",
                      border:     `1px solid ${flipV ? "rgba(76,215,246,0.3)" : "rgba(255,255,255,0.08)"}`,
                    }}>
                    <span className="material-symbols-outlined text-[16px]" style={{ transform: "rotate(90deg)" }}>flip</span>Flip V
                  </button>
                </div>

                {/* Rotation badge */}
                {rotation !== 0 && (
                  <p className="text-[11px] text-center" style={{ color: "#4cd7f6" }}>
                    {rotation}° rotation active
                  </p>
                )}
              </div>

              {/* Zoom */}
              <div className="glass-panel rounded-2xl p-4 flex flex-col gap-3"
                style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "#988d9f" }}>Zoom</p>
                  <span className="text-[11px] font-bold tabular-nums" style={{ color: "#4cd7f6" }}>{Math.round(zoom * 100)}%</span>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => changeZoom(-ZOOM_STEP)} disabled={zoom <= MIN_ZOOM}
                    aria-label="Zoom out"
                    className="w-9 h-9 rounded-xl flex items-center justify-center transition-all disabled:opacity-30"
                    style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "#988d9f" }}>
                    <span className="material-symbols-outlined text-[18px]">zoom_out</span>
                  </button>
                  <input type="range" min={MIN_ZOOM * 100} max={MAX_ZOOM * 100} step={5}
                    value={Math.round(zoom * 100)}
                    onChange={e => setZoom(Number(e.target.value) / 100)}
                    aria-label="Zoom level"
                    className="flex-1 h-2 rounded-full appearance-none cursor-pointer"
                    style={{
                      background: `linear-gradient(to right, #4cd7f6 ${((zoom - MIN_ZOOM) / (MAX_ZOOM - MIN_ZOOM)) * 100}%, rgba(255,255,255,0.1) ${((zoom - MIN_ZOOM) / (MAX_ZOOM - MIN_ZOOM)) * 100}%)`,
                      accentColor: "#4cd7f6",
                    }} />
                  <button onClick={() => changeZoom(ZOOM_STEP)} disabled={zoom >= MAX_ZOOM}
                    aria-label="Zoom in"
                    className="w-9 h-9 rounded-xl flex items-center justify-center transition-all disabled:opacity-30"
                    style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "#988d9f" }}>
                    <span className="material-symbols-outlined text-[18px]">zoom_in</span>
                  </button>
                </div>
              </div>

              {/* Output format + quality */}
              <div className="glass-panel rounded-2xl p-4 flex flex-col gap-3"
                style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
                <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "#988d9f" }}>Output Format</p>
                <div className="flex gap-2">
                  {(["jpg", "png", "webp"] as Format[]).map(f => (
                    <button key={f} onClick={() => setFormat(f)} aria-pressed={format === f}
                      className="flex-1 py-2 rounded-xl text-[12px] font-bold transition-all"
                      style={{
                        background: format === f ? "rgba(76,215,246,0.15)" : "rgba(255,255,255,0.04)",
                        color:      format === f ? "#4cd7f6"                : "#988d9f",
                        border:     `1px solid ${format === f ? "rgba(76,215,246,0.35)" : "rgba(255,255,255,0.08)"}`,
                      }}>
                      {f.toUpperCase()}
                    </button>
                  ))}
                </div>

                <div>
                  <div className="flex justify-between mb-2">
                    <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "#988d9f" }}>
                      Quality{format === "png" ? " (lossless)" : ""}
                    </p>
                    <span className="text-[11px] font-bold tabular-nums" style={{ color: "#4cd7f6" }}>
                      {format === "png" ? "—" : quality}
                    </span>
                  </div>
                  <input type="range" min={1} max={100} value={quality}
                    onChange={e => setQuality(Number(e.target.value))}
                    disabled={format === "png"}
                    aria-label="Output quality"
                    className="w-full h-2 rounded-full appearance-none cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{
                      background: format !== "png"
                        ? `linear-gradient(to right, #4cd7f6 ${quality}%, rgba(255,255,255,0.1) ${quality}%)`
                        : "rgba(255,255,255,0.1)",
                      accentColor: "#4cd7f6",
                    }} />
                </div>
              </div>
            </div>

            {/* ── Right: Canvas + crop overlay ─────────────────────────────── */}
            <div className="flex-1 min-w-0 flex flex-col gap-3">
              {/* Canvas container */}
              <div ref={containerRef}
                className="glass-panel rounded-2xl overflow-hidden relative select-none"
                style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
                <canvas ref={canvasRef} width={canvasW} height={CANVAS_H}
                  className="block w-full"
                  aria-label="Image cropping canvas" />

                {/* Crop overlay */}
                {cropBox && (
                  <div className="absolute inset-0 pointer-events-none">
                    {/* Darkened areas outside crop */}
                    {/* Top */}
                    <div className="absolute"
                      style={{ top: 0, left: 0, right: 0, height: cropBox.y, background: "rgba(0,0,0,0.45)" }} />
                    {/* Bottom */}
                    <div className="absolute"
                      style={{ top: cropBox.y + cropBox.h, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.45)" }} />
                    {/* Left */}
                    <div className="absolute"
                      style={{ top: cropBox.y, left: 0, width: cropBox.x, height: cropBox.h, background: "rgba(0,0,0,0.45)" }} />
                    {/* Right */}
                    <div className="absolute"
                      style={{ top: cropBox.y, left: cropBox.x + cropBox.w, right: 0, height: cropBox.h, background: "rgba(0,0,0,0.45)" }} />

                    {/* Crop box itself — interactive */}
                    <div
                      className="absolute pointer-events-auto"
                      style={{
                        left: cropBox.x, top: cropBox.y,
                        width: cropBox.w, height: cropBox.h,
                        border: "2px solid rgba(76,215,246,0.9)",
                        cursor: "move",
                        boxSizing: "border-box",
                      }}
                      onPointerDown={onBoxPointerDown}
                      onPointerMove={onBoxPointerMove}
                      onPointerUp={onBoxPointerUp}
                      onPointerCancel={onBoxPointerUp}
                      role="slider"
                      aria-label="Crop area — drag to move"
                      tabIndex={0}>

                      {/* Rule-of-thirds grid */}
                      <div className="absolute inset-0 pointer-events-none" style={{ opacity: 0.25 }}>
                        {[1/3, 2/3].map(f => (
                          <div key={`v${f}`} className="absolute top-0 bottom-0"
                            style={{ left: `${f * 100}%`, borderLeft: "1px solid #4cd7f6" }} />
                        ))}
                        {[1/3, 2/3].map(f => (
                          <div key={`h${f}`} className="absolute left-0 right-0"
                            style={{ top: `${f * 100}%`, borderTop: "1px solid #4cd7f6" }} />
                        ))}
                      </div>

                      {/* Corner accents */}
                      {[
                        { top: -1, left: -1 }, { top: -1, right: -1 },
                        { bottom: -1, left: -1 }, { bottom: -1, right: -1 },
                      ].map((s, i) => (
                        <div key={i} className="absolute w-4 h-4 pointer-events-none"
                          style={{ ...s, borderTop: i < 2 ? "3px solid #4cd7f6" : undefined,
                            borderBottom: i >= 2 ? "3px solid #4cd7f6" : undefined,
                            borderLeft: i % 2 === 0 ? "3px solid #4cd7f6" : undefined,
                            borderRight: i % 2 === 1 ? "3px solid #4cd7f6" : undefined }} />
                      ))}

                      {/* Resize handles */}
                      {HANDLES.map(h => (
                        <div key={h}
                          className="absolute w-[10px] h-[10px] rounded-sm"
                          style={{
                            ...HANDLE_STYLE[h],
                            background: "#4cd7f6",
                            border: "2px solid #131313",
                            zIndex: 10,
                          }}
                          onPointerDown={e => onHandlePointerDown(e, h)}
                          onPointerMove={e => onHandlePointerMove(e, h)}
                          onPointerUp={onHandlePointerUp}
                          onPointerCancel={onHandlePointerUp}
                          aria-label={`Resize handle ${h}`}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Canvas instruction */}
              <p className="text-[11px] text-center" style={{ color: "#4d4354" }}>
                Drag the crop box to move · drag handles to resize · use zoom and rotation controls on the left
              </p>

              {/* Crop button */}
              <button onClick={doCrop} disabled={cropping || !cropBox}
                className="btn-primary flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-base disabled:opacity-40 disabled:cursor-not-allowed">
                {cropping ? (
                  <><span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Cropping…</>
                ) : (
                  <><span className="material-symbols-outlined text-[20px]">crop</span>Crop Image</>
                )}
              </button>
            </div>
          </div>

          {/* ── Result ──────────────────────────────────────────────────────── */}
          {resultBlob && resultUrl && (
            <div className="flex flex-col gap-3">
              <div className="glass-panel rounded-2xl overflow-hidden"
                style={{ border: "1px solid rgba(76,215,246,0.2)" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={resultUrl} alt="Cropped result"
                  className="w-full block"
                  style={{
                    maxHeight: "400px", objectFit: "contain",
                    background: format === "png"
                      ? "linear-gradient(45deg,#444 25%,transparent 25%),linear-gradient(-45deg,#444 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#444 75%),linear-gradient(-45deg,transparent 75%,#444 75%)"
                      : "rgba(0,0,0,0.2)",
                    backgroundSize: format === "png" ? "16px 16px" : undefined,
                    backgroundPosition: format === "png" ? "0 0,0 8px,8px -8px,-8px 0" : undefined,
                    backgroundColor: format === "png" ? "#555" : undefined,
                  }} />
              </div>
              <div className="flex flex-wrap gap-3">
                <button onClick={doDownload}
                  className="btn-primary flex items-center gap-2 px-6 py-3 rounded-2xl font-bold text-sm flex-1 justify-center">
                  <span className="material-symbols-outlined text-[18px]">download</span>
                  Download {format.toUpperCase()}
                </button>
                <button onClick={doCrop} disabled={cropping}
                  className="flex items-center gap-2 px-5 py-3 rounded-2xl font-semibold text-sm transition-all"
                  style={{ background: "rgba(255,255,255,0.05)", color: "#988d9f", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <span className="material-symbols-outlined text-[18px]">refresh</span>Re-crop
                </button>
                <button onClick={reset}
                  className="flex items-center gap-2 px-5 py-3 rounded-2xl font-semibold text-sm transition-all"
                  style={{ background: "rgba(255,255,255,0.05)", color: "#988d9f", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <span className="material-symbols-outlined text-[18px]">add_photo_alternate</span>New image
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── How it works ─────────────────────────────────────────────────────── */}
      {!imgFile && (
        <div className="glass-panel rounded-2xl p-6 flex flex-col gap-3">
          <p className="text-[12px] font-semibold text-[#988d9f] uppercase tracking-[0.08em]">How it works</p>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            {[
              { icon: "upload_file", label: "1. Upload",    desc: "Drop any JPG, PNG, WEBP, GIF or BMP" },
              { icon: "crop",        label: "2. Crop",      desc: "Drag the crop box and resize handles" },
              { icon: "tune",        label: "3. Adjust",    desc: "Set aspect ratio, rotate, flip and zoom" },
              { icon: "download",    label: "4. Download",  desc: "Export as JPG, PNG or WebP instantly" },
            ].map(({ icon, label, desc }) => (
              <div key={label} className="flex flex-col gap-2 p-4 rounded-xl"
                style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
                <span className="material-symbols-outlined text-[22px]" style={{ color: "#4cd7f6" }}>{icon}</span>
                <p className="text-[13px] font-bold text-[#e2e2e2]">{label}</p>
                <p className="text-[12px] text-[#5a4d63] leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
