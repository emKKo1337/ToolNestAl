"use client";

import { useState, useRef, useCallback, useEffect, useId } from "react";

// ── Constants ─────────────────────────────────────────────────────────────────
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/bmp", "image/tiff", "image/avif"];
const ACCEPTED_EXT   = ".jpg,.jpeg,.png,.webp,.gif,.bmp,.tiff,.tif,.avif";
const MAX_FILE_BYTES = 50 * 1024 * 1024;
const PREVIEW_MAX_H  = 420;

// ── Types ─────────────────────────────────────────────────────────────────────
type Format    = "jpg" | "png" | "webp";
type BgOption  = "white" | "black" | "transparent" | "custom";
type NotifType = "success" | "error" | "info";

const FORMAT_MIME: Record<Format, string> = {
  jpg: "image/jpeg", png: "image/png", webp: "image/webp",
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(b: number): string {
  if (b < 1024)      return `${b} B`;
  if (b < 1_048_576) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1_048_576).toFixed(2)} MB`;
}

function baseName(n: string) { return n.replace(/\.[^.]+$/, ""); }

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function defaultFormat(mime: string): Format {
  if (mime === "image/png")  return "png";
  if (mime === "image/webp") return "webp";
  return "jpg";
}

/**
 * Rotate + flip an image and return a Blob.
 * autoExpand = true: output canvas fits the rotated bounding box.
 * autoExpand = false: output canvas = original dimensions (corners may clip).
 */
async function rotateFlipImage(
  srcUrl: string,
  angleDeg: number,
  flipH: boolean,
  flipV: boolean,
  autoExpand: boolean,
  bgColor: string,       // "transparent" or a CSS color
  format: Format,
  quality: number,
): Promise<{ blob: Blob; outW: number; outH: number }> {
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = srcUrl;
  });

  const rad  = (angleDeg * Math.PI) / 180;
  const natW = img.naturalWidth;
  const natH = img.naturalHeight;

  let outW: number;
  let outH: number;

  if (autoExpand) {
    const cos  = Math.abs(Math.cos(rad));
    const sin  = Math.abs(Math.sin(rad));
    outW = Math.round(natW * cos + natH * sin);
    outH = Math.round(natW * sin + natH * cos);
  } else {
    outW = natW;
    outH = natH;
  }

  const canvas = document.createElement("canvas");
  canvas.width  = outW;
  canvas.height = outH;
  const ctx = canvas.getContext("2d")!;

  if (bgColor !== "transparent") {
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, outW, outH);
  }

  ctx.translate(outW / 2, outH / 2);
  ctx.rotate(rad);
  ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
  ctx.drawImage(img, -natW / 2, -natH / 2);

  const blob = await new Promise<Blob>((res, rej) =>
    canvas.toBlob(
      b => b ? res(b) : rej(new Error("Export failed")),
      FORMAT_MIME[format],
      format === "png" ? undefined : quality / 100,
    ),
  );

  return { blob, outW, outH };
}

/** Draw a small preview into a canvas element */
function drawPreview(
  canvas: HTMLCanvasElement,
  img: HTMLImageElement,
  angleDeg: number,
  flipH: boolean,
  flipV: boolean,
  autoExpand: boolean,
  bgColor: string,
) {
  const rad  = (angleDeg * Math.PI) / 180;
  const natW = img.naturalWidth;
  const natH = img.naturalHeight;

  let outW: number;
  let outH: number;

  if (autoExpand) {
    const cos = Math.abs(Math.cos(rad));
    const sin = Math.abs(Math.sin(rad));
    outW = Math.round(natW * cos + natH * sin);
    outH = Math.round(natW * sin + natH * cos);
  } else {
    outW = natW;
    outH = natH;
  }

  // Scale to fit preview
  const containerW = canvas.parentElement?.clientWidth ?? 600;
  const scale      = Math.min(containerW / outW, PREVIEW_MAX_H / outH, 1);

  canvas.width  = Math.round(outW  * scale);
  canvas.height = Math.round(outH * scale);

  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Checkerboard
  const sq = 10;
  for (let ry = 0; ry < canvas.height; ry += sq)
    for (let rx = 0; rx < canvas.width; rx += sq) {
      ctx.fillStyle = ((rx / sq + ry / sq) % 2 === 0) ? "#2a2a3a" : "#1e1e2e";
      ctx.fillRect(rx, ry, sq, sq);
    }

  if (bgColor !== "transparent") {
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  const dW = natW * scale;
  const dH = natH * scale;

  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate(rad);
  ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
  ctx.drawImage(img, -dW / 2, -dH / 2, dW, dH);
}

// ── Chip ──────────────────────────────────────────────────────────────────────
function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
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

// ── Main Component ────────────────────────────────────────────────────────────
export default function ImageRotatorTool() {
  const uid = useId();

  // File state
  const [original, setOriginal] = useState<{ file: File; url: string; w: number; h: number } | null>(null);
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);
  const [resultUrl,  setResultUrl]  = useState("");
  const [outDims,    setOutDims]    = useState({ w: 0, h: 0 });

  // Transform settings
  const [angle,      setAngle]      = useState(0);
  const [customAngle, setCustomAngle] = useState("0");
  const [flipH,      setFlipH]      = useState(false);
  const [flipV,      setFlipV]      = useState(false);
  const [autoExpand, setAutoExpand] = useState(true);
  const [bgOption,   setBgOption]   = useState<BgOption>("white");
  const [customBg,   setCustomBg]   = useState("#ffffff");

  // Export
  const [format,  setFormat]  = useState<Format>("jpg");
  const [quality, setQuality] = useState(92);

  // UI
  const [dragging,   setDragging]   = useState(false);
  const [applying,   setApplying]   = useState(false);
  const [notif,      setNotif]      = useState<{ type: NotifType; msg: string } | null>(null);

  const dropRef    = useRef<HTMLDivElement>(null);
  const inputRef   = useRef<HTMLInputElement>(null);
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const imgElRef   = useRef<HTMLImageElement | null>(null);

  const colorId   = `${uid}-color`;
  const angleId   = `${uid}-angle`;

  const notify = useCallback((type: NotifType, msg: string) => {
    setNotif({ type, msg });
    if (type !== "info") setTimeout(() => setNotif(null), 8000);
  }, []);

  // ── Derived background color ───────────────────────────────────────────────
  const resolvedBg = useCallback((): string => {
    if (bgOption === "transparent") return "transparent";
    if (bgOption === "black")       return "#000000";
    if (bgOption === "custom")      return customBg;
    return "#ffffff";
  }, [bgOption, customBg]);

  // ── Refresh live preview ───────────────────────────────────────────────────
  const refreshPreview = useCallback(() => {
    const canvas = canvasRef.current;
    const img    = imgElRef.current;
    if (!canvas || !img) return;
    drawPreview(canvas, img, angle, flipH, flipV, autoExpand, resolvedBg());
  }, [angle, flipH, flipV, autoExpand, resolvedBg]);

  useEffect(() => { refreshPreview(); }, [refreshPreview]);

  // ── Load file ─────────────────────────────────────────────────────────────
  const loadFile = useCallback((file: File) => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      notify("error", `"${file.name}" is not supported. Upload JPG, PNG, WEBP, GIF, BMP, TIFF or AVIF.`);
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      notify("error", `"${file.name}" exceeds 50 MB.`);
      return;
    }

    if (original?.url) URL.revokeObjectURL(original.url);
    if (resultUrl)     URL.revokeObjectURL(resultUrl);

    const url   = URL.createObjectURL(file);
    const imgEl = new Image();
    imgEl.onload = () => {
      imgElRef.current = imgEl;
      setOriginal({ file, url, w: imgEl.naturalWidth, h: imgEl.naturalHeight });
      setAngle(0);
      setCustomAngle("0");
      setFlipH(false);
      setFlipV(false);
      setResultBlob(null);
      setResultUrl("");
      setOutDims({ w: 0, h: 0 });
      setFormat(defaultFormat(file.type));
      setNotif(null);
    };
    imgEl.onerror = () => { notify("error", "Could not read this image."); URL.revokeObjectURL(url); };
    imgEl.src = url;
  }, [original, resultUrl, notify]);

  // ── Drop zone ─────────────────────────────────────────────────────────────
  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const f = e.dataTransfer.files[0]; if (f) loadFile(f);
  }, [loadFile]);

  const onDragOver  = useCallback((e: React.DragEvent) => { e.preventDefault(); setDragging(true); }, []);
  const onDragLeave = useCallback((e: React.DragEvent) => {
    if (dropRef.current && !dropRef.current.contains(e.relatedTarget as Node)) setDragging(false);
  }, []);

  // ── Quick rotation buttons ────────────────────────────────────────────────
  const quickRotate = useCallback((delta: number) => {
    const next = ((angle + delta) % 360 + 360) % 360;
    setAngle(next);
    setCustomAngle(String(next));
  }, [angle]);

  // ── Custom angle input ────────────────────────────────────────────────────
  const handleAngleInput = useCallback((raw: string) => {
    setCustomAngle(raw);
    const v = parseFloat(raw);
    if (!isNaN(v)) setAngle(((v % 360) + 360) % 360);
  }, []);

  // ── Apply ─────────────────────────────────────────────────────────────────
  const apply = useCallback(async () => {
    if (!original) return;
    setApplying(true);
    if (resultUrl) URL.revokeObjectURL(resultUrl);
    setResultBlob(null);
    setResultUrl("");

    try {
      const { blob, outW, outH } = await rotateFlipImage(
        original.url, angle, flipH, flipV, autoExpand, resolvedBg(), format, quality,
      );
      const url = URL.createObjectURL(blob);
      setResultBlob(blob);
      setResultUrl(url);
      setOutDims({ w: outW, h: outH });
      notify("success", `Done — ${outW}×${outH} px · ${fmt(blob.size)}.`);
    } catch (err) {
      notify("error", err instanceof Error ? err.message : "Processing failed.");
    } finally {
      setApplying(false);
    }
  }, [original, angle, flipH, flipV, autoExpand, resolvedBg, format, quality, resultUrl, notify]);

  // ── Download ──────────────────────────────────────────────────────────────
  const doDownload = useCallback(() => {
    if (!resultBlob || !original) return;
    downloadBlob(resultBlob, `${baseName(original.file.name)}-rotated.${format}`);
  }, [resultBlob, original, format]);

  // ── Reset ─────────────────────────────────────────────────────────────────
  const reset = useCallback(() => {
    if (original?.url) URL.revokeObjectURL(original.url);
    if (resultUrl)     URL.revokeObjectURL(resultUrl);
    imgElRef.current = null;
    setOriginal(null);
    setResultBlob(null);
    setResultUrl("");
    setOutDims({ w: 0, h: 0 });
    setAngle(0);
    setCustomAngle("0");
    setFlipH(false);
    setFlipV(false);
    setNotif(null);
    if (inputRef.current) inputRef.current.value = "";
    const canvas = canvasRef.current;
    if (canvas) canvas.getContext("2d")!.clearRect(0, 0, canvas.width, canvas.height);
  }, [original, resultUrl]);

  // Cleanup on unmount
  useEffect(() => () => {
    if (original?.url) URL.revokeObjectURL(original.url);
    if (resultUrl)     URL.revokeObjectURL(resultUrl);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derived ───────────────────────────────────────────────────────────────
  const hasChanges = angle !== 0 || flipH || flipV;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="mb-12 flex flex-col gap-6">

      {/* ── Drop zone ───────────────────────────────────────────────────────── */}
      {!original && (
        <div ref={dropRef}
          onDrop={onDrop} onDragOver={onDragOver} onDragLeave={onDragLeave}
          onClick={() => inputRef.current?.click()}
          role="button" tabIndex={0} aria-label="Upload image to rotate"
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
              {dragging ? "file_download" : "rotate_right"}
            </span>
          </div>
          <div className="text-center">
            <p className="font-semibold text-base" style={{ color: "#e8dff0" }}>
              {dragging ? "Drop your image here" : "Drag & drop an image here"}
            </p>
            <p className="text-sm mt-1" style={{ color: "#988d9f" }}>
              or <span style={{ color: "#4cd7f6" }}>click to browse</span> — JPG, PNG, WEBP, GIF, BMP, TIFF, AVIF · max 50 MB
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            {["90° / 180°", "Custom angle", "Flip H & V", "Auto-expand", "Browser-local"].map(tag => (
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
      {original && (
        <div className="flex flex-col gap-4">

          {/* File header */}
          <div className="glass-panel rounded-2xl px-4 py-3 flex items-center gap-3"
            style={{ border: "1px solid rgba(76,215,246,0.2)" }}>
            <div className="w-9 h-9 rounded-xl overflow-hidden shrink-0 border border-white/10">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={original.url} alt="preview" className="w-full h-full object-cover" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm truncate" style={{ color: "#e8dff0" }}>{original.file.name}</p>
              <p className="text-xs" style={{ color: "#988d9f" }}>{original.w} × {original.h} px · {fmt(original.file.size)}</p>
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
              { label: "Original",      value: `${original.w} × ${original.h}`,                                icon: "open_in_full", accent: false },
              { label: "Output size",   value: outDims.w ? `${outDims.w} × ${outDims.h}` : "—",               icon: "photo_size_select_large", accent: !!outDims.w },
              { label: "Original file", value: fmt(original.file.size),                                        icon: "folder",       accent: false },
              { label: "Output file",   value: resultBlob ? fmt(resultBlob.size) : "—",                        icon: "download",     accent: !!resultBlob },
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
            <div className="w-full lg:w-[280px] shrink-0 flex flex-col gap-4">

              {/* Quick rotation */}
              <div className="glass-panel rounded-2xl p-4 flex flex-col gap-3"
                style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
                <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "#988d9f" }}>Rotate</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: "−90°", icon: "rotate_left",  delta: -90 },
                    { label: "+90°", icon: "rotate_right", delta:  90 },
                    { label: "180°", icon: "sync",         delta: 180 },
                    { label: "Reset", icon: "restart_alt", delta: null },
                  ].map(({ label, icon, delta }) => (
                    <button key={label}
                      onClick={() => delta !== null ? quickRotate(delta) : (setAngle(0), setCustomAngle("0"))}
                      aria-label={label}
                      className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[13px] font-semibold transition-all"
                      style={{ background: "rgba(255,255,255,0.05)", color: "#988d9f", border: "1px solid rgba(255,255,255,0.08)" }}>
                      <span className="material-symbols-outlined text-[16px]">{icon}</span>{label}
                    </button>
                  ))}
                </div>

                {/* Custom angle */}
                <div>
                  <label htmlFor={angleId} className="text-[10px] font-semibold uppercase tracking-widest block mb-2"
                    style={{ color: "#988d9f" }}>Custom Angle (°)</label>
                  <div className="flex items-center gap-2">
                    <input id={angleId} type="number" min={0} max={360} step={1}
                      value={customAngle}
                      onChange={e => handleAngleInput(e.target.value)}
                      placeholder="0"
                      className="w-24 px-3 py-2 rounded-xl text-[13px] font-bold tabular-nums outline-none"
                      style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "#e8dff0" }} />
                    <span className="text-[12px] font-bold tabular-nums" style={{ color: "#4cd7f6" }}>
                      = {Math.round(angle)}°
                    </span>
                  </div>
                  <input type="range" min={0} max={360} step={1}
                    value={angle}
                    onChange={e => { const v = Number(e.target.value); setAngle(v); setCustomAngle(String(v)); }}
                    aria-label="Rotation angle slider"
                    className="w-full h-2 mt-3 rounded-full appearance-none cursor-pointer"
                    style={{
                      background: `linear-gradient(to right, #4cd7f6 ${angle / 360 * 100}%, rgba(255,255,255,0.1) ${angle / 360 * 100}%)`,
                      accentColor: "#4cd7f6",
                    }} />
                  <div className="flex justify-between mt-1">
                    <span className="text-[10px]" style={{ color: "#4d4354" }}>0°</span>
                    <span className="text-[10px]" style={{ color: "#4d4354" }}>360°</span>
                  </div>
                </div>
              </div>

              {/* Flip */}
              <div className="glass-panel rounded-2xl p-4 flex flex-col gap-3"
                style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
                <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "#988d9f" }}>Flip</p>
                <div className="flex gap-2">
                  <button onClick={() => setFlipH(v => !v)} aria-pressed={flipH}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[13px] font-semibold transition-all"
                    style={{
                      background: flipH ? "rgba(76,215,246,0.12)" : "rgba(255,255,255,0.05)",
                      color:      flipH ? "#4cd7f6"               : "#988d9f",
                      border:     `1px solid ${flipH ? "rgba(76,215,246,0.3)" : "rgba(255,255,255,0.08)"}`,
                    }}>
                    <span className="material-symbols-outlined text-[16px]">flip</span>Horizontal
                  </button>
                  <button onClick={() => setFlipV(v => !v)} aria-pressed={flipV}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[13px] font-semibold transition-all"
                    style={{
                      background: flipV ? "rgba(76,215,246,0.12)" : "rgba(255,255,255,0.05)",
                      color:      flipV ? "#4cd7f6"               : "#988d9f",
                      border:     `1px solid ${flipV ? "rgba(76,215,246,0.3)" : "rgba(255,255,255,0.08)"}`,
                    }}>
                    <span className="material-symbols-outlined text-[16px]" style={{ transform: "rotate(90deg)" }}>flip</span>Vertical
                  </button>
                </div>
              </div>

              {/* Options */}
              <div className="glass-panel rounded-2xl p-4 flex flex-col gap-3"
                style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
                <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "#988d9f" }}>Options</p>

                {/* Auto-expand toggle */}
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <div
                    onClick={() => setAutoExpand(v => !v)}
                    role="switch" aria-checked={autoExpand}
                    className="relative w-10 h-5 rounded-full transition-colors duration-200 shrink-0"
                    style={{ background: autoExpand ? "#4cd7f6" : "rgba(255,255,255,0.12)", cursor: "pointer" }}>
                    <div className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200"
                      style={{ left: autoExpand ? "calc(100% - 18px)" : "2px" }} />
                  </div>
                  <div>
                    <p className="text-[13px] font-semibold" style={{ color: "#e8dff0" }}>Auto Expand Canvas</p>
                    <p className="text-[11px]" style={{ color: "#5a4d63" }}>Prevent clipping at custom angles</p>
                  </div>
                </label>

                {/* Background color */}
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: "#988d9f" }}>
                    Background (expanded areas)
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {(["white", "black", "transparent", "custom"] as BgOption[]).map(opt => (
                      <Chip key={opt} active={bgOption === opt} onClick={() => setBgOption(opt)}>
                        {opt.charAt(0).toUpperCase() + opt.slice(1)}
                      </Chip>
                    ))}
                  </div>
                  {bgOption === "custom" && (
                    <div className="flex items-center gap-3 mt-3">
                      <label htmlFor={colorId} className="text-sm font-medium shrink-0" style={{ color: "#988d9f" }}>Color</label>
                      <input id={colorId} type="color" value={customBg}
                        onChange={e => setCustomBg(e.target.value)}
                        className="w-10 h-10 rounded-xl cursor-pointer border-0 p-0"
                        style={{ background: "none" }} />
                      <span className="text-sm font-mono" style={{ color: "#4cd7f6" }}>{customBg.toUpperCase()}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Export format + quality */}
              <div className="glass-panel rounded-2xl p-4 flex flex-col gap-3"
                style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
                <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "#988d9f" }}>Output Format</p>
                <div className="flex gap-2">
                  {(["jpg", "png", "webp"] as Format[]).map(f => (
                    <Chip key={f} active={format === f} onClick={() => setFormat(f)}>
                      {f.toUpperCase()}
                    </Chip>
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

            {/* ── Right: Preview ───────────────────────────────────────────── */}
            <div className="flex-1 min-w-0 flex flex-col gap-3">
              <div className="glass-panel rounded-2xl overflow-hidden flex items-center justify-center"
                style={{ border: "1px solid rgba(255,255,255,0.08)", minHeight: "200px" }}>
                <canvas ref={canvasRef} className="block max-w-full" aria-label="Image rotation preview" />
              </div>

              {/* Active transform badges */}
              {hasChanges && (
                <div className="flex flex-wrap gap-2">
                  {angle !== 0 && (
                    <span className="px-2.5 py-1 rounded-lg text-[11px] font-semibold"
                      style={{ background: "rgba(76,215,246,0.1)", color: "#4cd7f6", border: "1px solid rgba(76,215,246,0.2)" }}>
                      {Math.round(angle)}° rotation
                    </span>
                  )}
                  {flipH && (
                    <span className="px-2.5 py-1 rounded-lg text-[11px] font-semibold"
                      style={{ background: "rgba(76,215,246,0.1)", color: "#4cd7f6", border: "1px solid rgba(76,215,246,0.2)" }}>
                      Flip horizontal
                    </span>
                  )}
                  {flipV && (
                    <span className="px-2.5 py-1 rounded-lg text-[11px] font-semibold"
                      style={{ background: "rgba(76,215,246,0.1)", color: "#4cd7f6", border: "1px solid rgba(76,215,246,0.2)" }}>
                      Flip vertical
                    </span>
                  )}
                </div>
              )}

              {/* Apply button */}
              <button onClick={apply} disabled={applying}
                className="btn-primary flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-base disabled:opacity-40 disabled:cursor-not-allowed">
                {applying ? (
                  <><span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Applying…</>
                ) : (
                  <><span className="material-symbols-outlined text-[20px]">rotate_right</span>Apply Changes</>
                )}
              </button>

              {/* Result */}
              {resultBlob && resultUrl && (
                <div className="flex flex-col gap-3">
                  <div className="glass-panel rounded-2xl overflow-hidden"
                    style={{ border: "1px solid rgba(76,215,246,0.2)" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={resultUrl} alt="Rotated result"
                      className="w-full block"
                      style={{
                        maxHeight: "380px", objectFit: "contain",
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
                    <button onClick={reset}
                      className="flex items-center gap-2 px-5 py-3 rounded-2xl font-semibold text-sm transition-all"
                      style={{ background: "rgba(255,255,255,0.05)", color: "#988d9f", border: "1px solid rgba(255,255,255,0.08)" }}>
                      <span className="material-symbols-outlined text-[18px]">add_photo_alternate</span>New image
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── How it works ─────────────────────────────────────────────────────── */}
      {!original && (
        <div className="glass-panel rounded-2xl p-6 flex flex-col gap-3">
          <p className="text-[12px] font-semibold text-[#988d9f] uppercase tracking-[0.08em]">How it works</p>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            {[
              { icon: "upload_file",  label: "1. Upload",   desc: "Drop any JPG, PNG, WEBP, GIF, BMP or TIFF" },
              { icon: "rotate_right", label: "2. Rotate",   desc: "Quick 90°/180° buttons or any custom angle" },
              { icon: "flip",         label: "3. Flip",     desc: "Flip horizontally and/or vertically" },
              { icon: "download",     label: "4. Download", desc: "Export as JPG, PNG or WebP at full quality" },
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
