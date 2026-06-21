"use client";

/**
 * Image Watermark Tool
 *
 * Text watermarks: custom text, font family, size, bold/italic/underline,
 *   colour, opacity, rotation, letter-spacing.
 * Image watermarks: upload PNG/JPG/WebP logo, resize, opacity, rotation.
 * Position: 7 presets + free drag on the canvas.
 * Export: JPG / PNG / WebP at user-selected quality.
 * All processing is client-side via Canvas API.
 */

import { useState, useRef, useCallback, useEffect } from "react";

// ── Constants ─────────────────────────────────────────────────────────────────
const MAX_FILE_BYTES = 50 * 1024 * 1024;
const FONTS = [
  "Arial", "Arial Black", "Georgia", "Times New Roman",
  "Courier New", "Verdana", "Trebuchet MS", "Impact",
];
const ACCEPTED_MAIN_EXT = ".jpg,.jpeg,.png,.webp,.bmp,.tiff,.avif";
const ACCEPTED_MAIN_TYPES = [
  "image/jpeg","image/png","image/webp","image/bmp","image/tiff","image/avif",
];
const ACCEPTED_WM_EXT = ".png,.jpg,.jpeg,.webp";
const ACCEPTED_WM_TYPES = ["image/jpeg","image/png","image/webp"];

// ── Types ─────────────────────────────────────────────────────────────────────
type WmType    = "text" | "image";
type OutFormat = "jpg" | "png" | "webp";
type PosPreset = "center"|"top-left"|"top-center"|"top-right"
               | "bottom-left"|"bottom-center"|"bottom-right"|"custom";
type NotifType = "success" | "error" | "info";

const FORMAT_MIME: Record<OutFormat, string> = {
  jpg: "image/jpeg", png: "image/png", webp: "image/webp",
};

// ── Drawing helper ─────────────────────────────────────────────────────────────
// All dimensional params (fontSize, letterSpacing, margin) are in EXPORT pixels.
// `scale` = canvasW / mainImg.naturalWidth so the same function works for both
// preview and full-res export.
function drawWatermarkOnCtx(
  ctx: CanvasRenderingContext2D,
  canvasW: number,
  canvasH: number,
  scale: number,
  // text settings
  wmType: WmType,
  text: string,
  fontFamily: string,
  fontSize: number,
  bold: boolean,
  italic: boolean,
  underline: boolean,
  textColor: string,
  textOpacity: number,
  textRotation: number,
  letterSpacing: number,
  // image settings
  wmImg: HTMLImageElement | null,
  wmImgSize: number,   // fraction of main img width
  wmImgOpacity: number,
  wmImgRotation: number,
  // position (fractions 0-1)
  posX: number,
  posY: number,
): void {
  const cx = posX * canvasW;
  const cy = posY * canvasH;

  ctx.save();
  ctx.translate(cx, cy);

  if (wmType === "text" && text.trim()) {
    const size    = Math.max(4, fontSize * scale);
    const spacing = letterSpacing * scale;
    const weight  = bold   ? "bold"   : "normal";
    const style   = italic ? "italic" : "normal";
    ctx.font         = `${style} ${weight} ${size}px "${fontFamily}"`;
    ctx.fillStyle    = textColor;
    ctx.globalAlpha  = textOpacity;
    ctx.textBaseline = "middle";
    ctx.textAlign    = "left";
    ctx.rotate((textRotation * Math.PI) / 180);

    // Measure total width respecting letter-spacing
    const chars      = [...text];
    const charWidths = chars.map(c => ctx.measureText(c).width);
    const totalW     = charWidths.reduce((s, w) => s + w, 0) +
                       spacing * Math.max(0, chars.length - 1);

    let x = -totalW / 2;
    for (let i = 0; i < chars.length; i++) {
      ctx.fillText(chars[i], x, 0);
      x += charWidths[i] + spacing;
    }

    if (underline) {
      const lineY = size * 0.15;
      const lineH = Math.max(1, size / 16);
      ctx.fillRect(-totalW / 2, lineY, totalW, lineH);
    }

  } else if (wmType === "image" && wmImg) {
    const wmW = wmImgSize * canvasW;
    const wmH = wmW * (wmImg.naturalHeight / wmImg.naturalWidth);
    ctx.globalAlpha = wmImgOpacity;
    ctx.rotate((wmImgRotation * Math.PI) / 180);
    ctx.drawImage(wmImg, -wmW / 2, -wmH / 2, wmW, wmH);
  }

  ctx.restore();
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function uid() { return Math.random().toString(36).slice(2, 10); }
function fmt(b: number): string {
  if (b < 1024)      return `${b} B`;
  if (b < 1_048_576) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1_048_576).toFixed(2)} MB`;
}
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload  = () => res(img);
    img.onerror = rej;
    img.src = src;
  });
}

// ── Preset position calculator ─────────────────────────────────────────────────
function presetPos(preset: PosPreset, m: number): { x: number; y: number } {
  const margin = m / 100;
  switch (preset) {
    case "top-left":      return { x: margin,      y: margin };
    case "top-center":    return { x: 0.5,          y: margin };
    case "top-right":     return { x: 1 - margin,   y: margin };
    case "bottom-left":   return { x: margin,        y: 1 - margin };
    case "bottom-center": return { x: 0.5,           y: 1 - margin };
    case "bottom-right":  return { x: 1 - margin,    y: 1 - margin };
    default:              return { x: 0.5,            y: 0.5 };
  }
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function ImageWatermarkTool() {
  // Main image
  const [mainFile, setMainFile] = useState<File | null>(null);
  const [mainUrl,  setMainUrl]  = useState("");
  const mainImgRef = useRef<HTMLImageElement | null>(null);

  // Watermark type
  const [wmType, setWmType] = useState<WmType>("text");

  // Text settings
  const [text,          setText]          = useState("Watermark");
  const [fontFamily,    setFontFamily]    = useState("Arial");
  const [fontSize,      setFontSize]      = useState(72);
  const [bold,          setBold]          = useState(false);
  const [italic,        setItalic]        = useState(false);
  const [underline,     setUnderline]     = useState(false);
  const [textColor,     setTextColor]     = useState("#ffffff");
  const [textOpacity,   setTextOpacity]   = useState(0.7);
  const [textRotation,  setTextRotation]  = useState(0);
  const [letterSpacing, setLetterSpacing] = useState(0);

  // Image watermark settings
  const [wmImgFile,     setWmImgFile]     = useState<File | null>(null);
  const [wmImgUrl,      setWmImgUrl]      = useState("");
  const wmImgRef = useRef<HTMLImageElement | null>(null);
  const [wmImgSize,     setWmImgSize]     = useState(0.25);
  const [wmImgOpacity,  setWmImgOpacity]  = useState(0.7);
  const [wmImgRotation, setWmImgRotation] = useState(0);

  // Position
  const [posPreset, setPosPreset] = useState<PosPreset>("center");
  const [posX,      setPosX]      = useState(0.5);
  const [posY,      setPosY]      = useState(0.5);
  const [margin,    setMargin]    = useState(5);

  // Export
  const [outFormat, setOutFormat] = useState<OutFormat>("jpg");
  const [quality,   setQuality]   = useState(92);

  // State
  const [applying,   setApplying]   = useState(false);
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);
  const [resultUrl,  setResultUrl]  = useState("");
  const [resultFile, setResultFile] = useState("");
  const [notif,      setNotif]      = useState<{ type: NotifType; msg: string } | null>(null);
  const [dragging,   setDragging]   = useState(false);

  // Refs
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const previewContRef   = useRef<HTMLDivElement>(null);
  const mainFileInputRef = useRef<HTMLInputElement>(null);
  const wmFileInputRef   = useRef<HTMLInputElement>(null);
  const isDraggingWm     = useRef(false);
  const rafRef           = useRef<number | null>(null);

  const notify = useCallback((type: NotifType, msg: string) => {
    setNotif({ type, msg });
    if (type !== "info") setTimeout(() => setNotif(null), 7000);
  }, []);

  // ── Load main image ──────────────────────────────────────────────────────────
  const loadMainFile = useCallback(async (file: File) => {
    const ok = ACCEPTED_MAIN_TYPES.includes(file.type) ||
      /\.(jpg|jpeg|png|webp|bmp|tiff|avif)$/i.test(file.name);
    if (!ok)                          { notify("error", "Unsupported format."); return; }
    if (file.size > MAX_FILE_BYTES)   { notify("error", "File exceeds 50 MB.");  return; }
    const url = URL.createObjectURL(file);
    const img = await loadImage(url);
    mainImgRef.current = img;
    setMainFile(file);
    setMainUrl(url);
    setResultBlob(null);
    setResultUrl("");
    setNotif(null);
  }, [notify]);

  // ── Load watermark image ─────────────────────────────────────────────────────
  const loadWmFile = useCallback(async (file: File) => {
    const ok = ACCEPTED_WM_TYPES.includes(file.type) ||
      /\.(png|jpg|jpeg|webp)$/i.test(file.name);
    if (!ok) { notify("error", "Watermark must be PNG, JPG or WebP."); return; }
    const url = URL.createObjectURL(file);
    const img = await loadImage(url);
    wmImgRef.current = img;
    setWmImgFile(file);
    setWmImgUrl(url);
    setResultBlob(null);
    setResultUrl("");
  }, [notify]);

  // ── Drop zone for main image ─────────────────────────────────────────────────
  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) loadMainFile(file);
  }, [loadMainFile]);

  // ── Draw preview ─────────────────────────────────────────────────────────────
  const drawPreview = useCallback(() => {
    const canvas = previewCanvasRef.current;
    const cont   = previewContRef.current;
    const img    = mainImgRef.current;
    if (!canvas || !cont || !img) return;

    const contW  = cont.clientWidth;
    const scale  = img.naturalWidth > 0 ? contW / img.naturalWidth : 1;
    const contH  = Math.round(img.naturalHeight * scale);

    canvas.width  = contW;
    canvas.height = contH;
    canvas.style.height = `${contH}px`;

    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, contW, contH);
    ctx.drawImage(img, 0, 0, contW, contH);

    drawWatermarkOnCtx(
      ctx, contW, contH, scale,
      wmType, text, fontFamily, fontSize, bold, italic, underline,
      textColor, textOpacity, textRotation, letterSpacing,
      wmImgRef.current, wmImgSize, wmImgOpacity, wmImgRotation,
      posX, posY,
    );
  }, [
    wmType, text, fontFamily, fontSize, bold, italic, underline,
    textColor, textOpacity, textRotation, letterSpacing,
    wmImgSize, wmImgOpacity, wmImgRotation, posX, posY,
  ]);

  // Throttle preview redraws to rAF
  const schedulePreview = useCallback(() => {
    if (rafRef.current !== null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      drawPreview();
    });
  }, [drawPreview]);

  useEffect(() => { if (mainFile) schedulePreview(); }, [
    mainFile, wmImgFile, schedulePreview,
    wmType, text, fontFamily, fontSize, bold, italic, underline,
    textColor, textOpacity, textRotation, letterSpacing,
    wmImgSize, wmImgOpacity, wmImgRotation, posX, posY,
  ]);

  // ResizeObserver to redraw on container resize
  useEffect(() => {
    const cont = previewContRef.current;
    if (!cont) return;
    const ro = new ResizeObserver(() => { if (mainFile) schedulePreview(); });
    ro.observe(cont);
    return () => ro.disconnect();
  }, [mainFile, schedulePreview]);

  // Cleanup object URLs on unmount
  useEffect(() => () => {
    if (mainUrl)   URL.revokeObjectURL(mainUrl);
    if (wmImgUrl)  URL.revokeObjectURL(wmImgUrl);
    if (resultUrl) URL.revokeObjectURL(resultUrl);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Canvas pointer events for drag-to-position ────────────────────────────────
  const onCanvasPointer = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = previewCanvasRef.current;
    if (!canvas) return;

    if (e.type === "pointerdown") {
      canvas.setPointerCapture(e.pointerId);
      isDraggingWm.current = true;
    }
    if (!isDraggingWm.current) return;

    const rect = canvas.getBoundingClientRect();
    const nx = Math.max(0, Math.min(1, (e.clientX - rect.left)  / rect.width));
    const ny = Math.max(0, Math.min(1, (e.clientY - rect.top)   / rect.height));
    setPosX(nx);
    setPosY(ny);
    setPosPreset("custom");

    if (e.type === "pointerup" || e.type === "pointercancel") {
      isDraggingWm.current = false;
    }
  }, []);

  // ── Apply watermark (full-res export) ─────────────────────────────────────────
  const applyWatermark = useCallback(async () => {
    const img = mainImgRef.current;
    if (!img || !mainFile) return;
    if (wmType === "image" && !wmImgRef.current) {
      notify("error", "Please upload a watermark image first."); return;
    }
    setApplying(true);
    try {
      const canvas = document.createElement("canvas");
      canvas.width  = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d")!;

      if (outFormat === "jpg") {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      ctx.drawImage(img, 0, 0);

      drawWatermarkOnCtx(
        ctx, canvas.width, canvas.height, 1,
        wmType, text, fontFamily, fontSize, bold, italic, underline,
        textColor, textOpacity, textRotation, letterSpacing,
        wmImgRef.current, wmImgSize, wmImgOpacity, wmImgRotation,
        posX, posY,
      );

      const blob = await new Promise<Blob>((res, rej) =>
        canvas.toBlob(
          b => b ? res(b) : rej(new Error("Export failed")),
          FORMAT_MIME[outFormat],
          outFormat === "png" ? undefined : quality / 100,
        ),
      );

      if (resultUrl) URL.revokeObjectURL(resultUrl);
      const url      = URL.createObjectURL(blob);
      const baseName = mainFile.name.replace(/\.[^.]+$/, "");
      const fileName = `${baseName}-watermark.${outFormat}`;
      setResultBlob(blob);
      setResultUrl(url);
      setResultFile(fileName);
      notify("success", "Watermark applied! Click Download to save.");
    } catch (err) {
      notify("error", err instanceof Error ? err.message : "Export failed.");
    } finally {
      setApplying(false);
    }
  }, [
    mainFile, outFormat, quality,
    wmType, text, fontFamily, fontSize, bold, italic, underline,
    textColor, textOpacity, textRotation, letterSpacing,
    wmImgSize, wmImgOpacity, wmImgRotation,
    posX, posY, resultUrl, notify,
  ]);

  // ── Handle preset change ──────────────────────────────────────────────────────
  const handlePreset = useCallback((preset: PosPreset) => {
    setPosPreset(preset);
    if (preset !== "custom") {
      const { x, y } = presetPos(preset, margin);
      setPosX(x);
      setPosY(y);
    }
  }, [margin]);

  // ── Reset ─────────────────────────────────────────────────────────────────────
  const reset = useCallback(() => {
    setText("Watermark");
    setFontFamily("Arial");
    setFontSize(72);
    setBold(false);
    setItalic(false);
    setUnderline(false);
    setTextColor("#ffffff");
    setTextOpacity(0.7);
    setTextRotation(0);
    setLetterSpacing(0);
    setWmImgFile(null);
    setWmImgUrl("");
    wmImgRef.current = null;
    setWmImgSize(0.25);
    setWmImgOpacity(0.7);
    setWmImgRotation(0);
    setPosPreset("center");
    setPosX(0.5);
    setPosY(0.5);
    setMargin(5);
    setResultBlob(null);
    setResultUrl("");
    setNotif(null);
  }, []);

  const clear = useCallback(() => {
    if (mainUrl)   URL.revokeObjectURL(mainUrl);
    if (wmImgUrl)  URL.revokeObjectURL(wmImgUrl);
    if (resultUrl) URL.revokeObjectURL(resultUrl);
    setMainFile(null);
    setMainUrl("");
    mainImgRef.current = null;
    reset();
    if (mainFileInputRef.current) mainFileInputRef.current.value = "";
    if (wmFileInputRef.current)   wmFileInputRef.current.value   = "";
  }, [mainUrl, wmImgUrl, resultUrl, reset]);

  // ── Shared section heading ────────────────────────────────────────────────────
  const SectionLabel = ({ label }: { label: string }) => (
    <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: "#988d9f" }}>{label}</p>
  );

  // ── Toggle button (Bold / Italic / Underline) ──────────────────────────────────
  const ToggleBtn = ({ active, onClick, label, children }: {
    active: boolean; onClick: () => void; label: string; children: React.ReactNode;
  }) => (
    <button onClick={onClick} aria-pressed={active} aria-label={label}
      className="flex-1 py-2 rounded-xl text-[13px] font-bold transition-all"
      style={{
        background: active ? "rgba(76,215,246,0.15)" : "rgba(255,255,255,0.04)",
        color:      active ? "#4cd7f6"               : "#988d9f",
        border:     `1px solid ${active ? "rgba(76,215,246,0.35)" : "rgba(255,255,255,0.08)"}`,
      }}>
      {children}
    </button>
  );

  // ── Number input ──────────────────────────────────────────────────────────────
  const NumInput = ({ value, onChange, min, max, label }: {
    value: number; onChange: (v: number) => void; min: number; max: number; label: string;
  }) => (
    <input type="number" value={value} min={min} max={max} aria-label={label}
      onChange={e => onChange(Math.max(min, Math.min(max, Number(e.target.value))))}
      className="w-full px-3 py-2 rounded-xl text-[13px] font-semibold outline-none transition"
      style={{
        background: "rgba(255,255,255,0.05)",
        border: "1px solid rgba(255,255,255,0.10)",
        color: "#e8dff0",
      }} />
  );

  // ── Range slider ──────────────────────────────────────────────────────────────
  const RangeSlider = ({ value, onChange, min, max, step = 1, label, showValue, unit = "" }: {
    value: number; onChange: (v: number) => void; min: number; max: number; step?: number;
    label: string; showValue?: string; unit?: string;
  }) => {
    const pct = ((value - min) / (max - min)) * 100;
    return (
      <div>
        <div className="flex justify-between mb-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "#988d9f" }}>{label}</p>
          <span className="text-[11px] font-bold tabular-nums" style={{ color: "#4cd7f6" }}>
            {showValue ?? `${value}${unit}`}
          </span>
        </div>
        <input type="range" min={min} max={max} step={step} value={value}
          onChange={e => onChange(Number(e.target.value))}
          aria-label={label}
          className="w-full h-2 rounded-full appearance-none cursor-pointer"
          style={{
            background: `linear-gradient(to right, #4cd7f6 ${pct}%, rgba(255,255,255,0.1) ${pct}%)`,
            accentColor: "#4cd7f6",
          }} />
      </div>
    );
  };

  // ── POSITION PRESETS ──────────────────────────────────────────────────────────
  const PRESETS: { id: PosPreset; icon: string; label: string }[] = [
    { id: "top-left",      icon: "north_west",  label: "Top Left"      },
    { id: "top-center",    icon: "north",        label: "Top Center"    },
    { id: "top-right",     icon: "north_east",   label: "Top Right"     },
    { id: "center",        icon: "center_focus_strong", label: "Center" },
    { id: "bottom-left",   icon: "south_west",   label: "Bottom Left"   },
    { id: "bottom-center", icon: "south",        label: "Bottom Center" },
    { id: "bottom-right",  icon: "south_east",   label: "Bottom Right"  },
    { id: "custom",        icon: "drag_pan",      label: "Drag"          },
  ];

  // ── Render ────────────────────────────────────────────────────────────────────
  if (!mainFile) {
    return (
      <div className="mb-12 flex flex-col gap-6">
        {/* Drop zone */}
        <div
          onDrop={onDrop}
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false); }}
          onClick={() => mainFileInputRef.current?.click()}
          role="button" tabIndex={0} aria-label="Upload an image to watermark"
          onKeyDown={e => { if (e.key === "Enter" || e.key === " ") mainFileInputRef.current?.click(); }}
          className="glass-panel rounded-2xl flex flex-col items-center justify-center gap-4 cursor-pointer transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-[#4cd7f6]"
          style={{
            padding: "60px 40px",
            border: `2px dashed ${dragging ? "#4cd7f6" : "rgba(255,255,255,0.12)"}`,
            background: dragging ? "rgba(76,215,246,0.04)" : undefined,
          }}>
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 transition-transform duration-200"
            style={{ background: "rgba(76,215,246,0.1)", transform: dragging ? "scale(1.08)" : "scale(1)" }}>
            <span className="material-symbols-outlined text-[32px]" style={{ color: "#4cd7f6" }}>
              {dragging ? "file_download" : "branding_watermark"}
            </span>
          </div>
          <div className="text-center">
            <p className="font-semibold text-base" style={{ color: "#e8dff0" }}>
              {dragging ? "Drop image here" : "Drag & drop your image here"}
            </p>
            <p className="text-sm mt-1" style={{ color: "#988d9f" }}>
              or <span style={{ color: "#4cd7f6" }}>click to browse</span> — JPG, PNG, WebP, BMP, TIFF, AVIF · max 50 MB
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-2 mt-1">
            {["Text Watermark","Logo Watermark","Drag Position","Batch-free","Browser-local"].map(tag => (
              <span key={tag} className="px-2.5 py-1 rounded-lg text-[11px] font-semibold"
                style={{ background: "rgba(76,215,246,0.08)", color: "#4cd7f6", border: "1px solid rgba(76,215,246,0.15)" }}>
                {tag}
              </span>
            ))}
          </div>
          <input ref={mainFileInputRef} type="file" accept={ACCEPTED_MAIN_EXT} className="sr-only"
            onChange={e => { const f = e.target.files?.[0]; if (f) loadMainFile(f); e.target.value = ""; }}
            aria-hidden tabIndex={-1} />
        </div>

        {/* How-it-works */}
        <div className="glass-panel rounded-2xl p-6 flex flex-col gap-4" style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
          <p className="text-[12px] font-semibold text-[#988d9f] uppercase tracking-[0.08em]">How it works</p>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            {[
              { icon: "upload_file",           label: "1. Upload",   desc: "Drop any JPG, PNG, WebP, BMP, TIFF or AVIF image" },
              { icon: "tune",                  label: "2. Customise", desc: "Choose text or logo, set font, size, colour, opacity and rotation" },
              { icon: "drag_pan",              label: "3. Position", desc: "Pick a preset spot or drag the watermark anywhere on the canvas" },
              { icon: "download",              label: "4. Download", desc: "Export as JPG, PNG or WebP at your chosen quality" },
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
      </div>
    );
  }

  // ── Editor ────────────────────────────────────────────────────────────────────
  return (
    <div className="mb-12 flex flex-col gap-4">

      {/* File info bar */}
      <div className="glass-panel rounded-2xl px-4 py-3 flex items-center gap-3"
        style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
        <span className="material-symbols-outlined text-[18px]" style={{ color: "#4cd7f6" }}>image</span>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold truncate" style={{ color: "#e8dff0" }}>{mainFile.name}</p>
          <p className="text-[11px]" style={{ color: "#5a4d63" }}>
            {mainImgRef.current ? `${mainImgRef.current.naturalWidth}×${mainImgRef.current.naturalHeight} · ` : ""}
            {fmt(mainFile.size)}
          </p>
        </div>
        <button onClick={clear} aria-label="Remove image and start over"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold transition-all"
          style={{ background: "rgba(255,80,80,0.08)", color: "#ff8080", border: "1px solid rgba(255,80,80,0.15)" }}>
          <span className="material-symbols-outlined text-[14px]">close</span> Clear
        </button>
      </div>

      {/* Notification */}
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

      {/* Two-column layout */}
      <div className="flex flex-col lg:flex-row gap-4">

        {/* ── Left: Controls ──────────────────────────────────────────────────── */}
        <div className="lg:w-80 xl:w-88 shrink-0 flex flex-col gap-3">

          {/* Watermark type tabs */}
          <div className="glass-panel rounded-2xl p-4" style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
            <SectionLabel label="Watermark Type" />
            <div className="flex gap-2">
              {(["text","image"] as WmType[]).map(t => (
                <button key={t} onClick={() => setWmType(t)} aria-pressed={wmType === t}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[13px] font-bold transition-all"
                  style={{
                    background: wmType === t ? "rgba(76,215,246,0.15)" : "rgba(255,255,255,0.04)",
                    color:      wmType === t ? "#4cd7f6"               : "#988d9f",
                    border:     `1px solid ${wmType === t ? "rgba(76,215,246,0.35)" : "rgba(255,255,255,0.08)"}`,
                  }}>
                  <span className="material-symbols-outlined text-[16px]">
                    {t === "text" ? "text_fields" : "image"}
                  </span>
                  {t === "text" ? "Text" : "Image"}
                </button>
              ))}
            </div>
          </div>

          {/* ── Text watermark options ───────────────────────────────────────── */}
          {wmType === "text" && (
            <div className="glass-panel rounded-2xl p-4 flex flex-col gap-4" style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
              <SectionLabel label="Text Settings" />

              {/* Text input */}
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-widest block mb-1.5" style={{ color: "#988d9f" }}>
                  Watermark Text
                </label>
                <input type="text" value={text} maxLength={120}
                  onChange={e => setText(e.target.value)}
                  placeholder="Your watermark text"
                  aria-label="Watermark text"
                  className="w-full px-3 py-2 rounded-xl text-[13px] font-semibold outline-none transition"
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.10)",
                    color: "#e8dff0",
                  }} />
              </div>

              {/* Font family */}
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-widest block mb-1.5" style={{ color: "#988d9f" }}>
                  Font Family
                </label>
                <select value={fontFamily} onChange={e => setFontFamily(e.target.value)}
                  aria-label="Font family"
                  className="w-full px-3 py-2 rounded-xl text-[13px] font-semibold outline-none cursor-pointer"
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.10)",
                    color: "#e8dff0",
                  }}>
                  {FONTS.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>

              {/* Font size */}
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-widest block mb-1.5" style={{ color: "#988d9f" }}>
                  Font Size (px)
                </label>
                <NumInput value={fontSize} onChange={setFontSize} min={8} max={500} label="Font size" />
              </div>

              {/* Style toggles */}
              <div>
                <SectionLabel label="Style" />
                <div className="flex gap-2">
                  <ToggleBtn active={bold}      onClick={() => setBold(v => !v)}           label="Bold">      <b>B</b>        </ToggleBtn>
                  <ToggleBtn active={italic}    onClick={() => setItalic(v => !v)}         label="Italic">    <i>I</i>        </ToggleBtn>
                  <ToggleBtn active={underline} onClick={() => setUnderline(v => !v)}      label="Underline"> <u>U</u>        </ToggleBtn>
                </div>
              </div>

              {/* Text colour */}
              <div>
                <SectionLabel label="Text Colour" />
                <div className="flex items-center gap-3">
                  <input type="color" value={textColor} onChange={e => setTextColor(e.target.value)}
                    aria-label="Text colour" className="w-10 h-10 rounded-xl cursor-pointer border-0 bg-transparent" />
                  <span className="text-[12px] font-mono font-semibold" style={{ color: "#988d9f" }}>{textColor}</span>
                </div>
              </div>

              {/* Opacity */}
              <RangeSlider value={Math.round(textOpacity * 100)} onChange={v => setTextOpacity(v / 100)}
                min={1} max={100} label="Opacity" unit="%" />

              {/* Rotation */}
              <RangeSlider value={textRotation} onChange={setTextRotation}
                min={-180} max={180} label="Rotation" unit="°" />

              {/* Letter spacing */}
              <RangeSlider value={letterSpacing} onChange={setLetterSpacing}
                min={0} max={50} label="Letter Spacing" unit="px" />
            </div>
          )}

          {/* ── Image watermark options ──────────────────────────────────────── */}
          {wmType === "image" && (
            <div className="glass-panel rounded-2xl p-4 flex flex-col gap-4" style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
              <SectionLabel label="Watermark Image" />

              {/* Upload watermark image */}
              <div>
                <button onClick={() => wmFileInputRef.current?.click()}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all"
                  style={{
                    background: wmImgFile ? "rgba(76,215,246,0.08)" : "rgba(255,255,255,0.04)",
                    border: `1px dashed ${wmImgFile ? "rgba(76,215,246,0.3)" : "rgba(255,255,255,0.12)"}`,
                    color: wmImgFile ? "#4cd7f6" : "#988d9f",
                  }}>
                  <span className="material-symbols-outlined text-[20px]">
                    {wmImgFile ? "check_circle" : "upload"}
                  </span>
                  <span className="text-[13px] font-semibold truncate">
                    {wmImgFile ? wmImgFile.name : "Upload PNG / JPG / WebP logo"}
                  </span>
                </button>
                <input ref={wmFileInputRef} type="file" accept={ACCEPTED_WM_EXT} className="sr-only"
                  onChange={e => { const f = e.target.files?.[0]; if (f) loadWmFile(f); e.target.value = ""; }}
                  aria-hidden tabIndex={-1} />
              </div>

              {wmImgFile && (
                <>
                  {/* Size slider */}
                  <RangeSlider value={Math.round(wmImgSize * 100)} onChange={v => setWmImgSize(v / 100)}
                    min={5} max={90} label="Size (% of image width)" unit="%" />

                  {/* Opacity */}
                  <RangeSlider value={Math.round(wmImgOpacity * 100)} onChange={v => setWmImgOpacity(v / 100)}
                    min={1} max={100} label="Opacity" unit="%" />

                  {/* Rotation */}
                  <RangeSlider value={wmImgRotation} onChange={setWmImgRotation}
                    min={-180} max={180} label="Rotation" unit="°" />
                </>
              )}
            </div>
          )}

          {/* ── Position ─────────────────────────────────────────────────────── */}
          <div className="glass-panel rounded-2xl p-4 flex flex-col gap-4" style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
            <SectionLabel label="Position" />
            <div className="grid grid-cols-4 gap-1.5">
              {PRESETS.map(p => (
                <button key={p.id} onClick={() => handlePreset(p.id)}
                  aria-pressed={posPreset === p.id} aria-label={p.label}
                  title={p.label}
                  className="flex flex-col items-center justify-center gap-1 py-2 rounded-xl text-[10px] font-semibold transition-all"
                  style={{
                    background: posPreset === p.id ? "rgba(76,215,246,0.15)" : "rgba(255,255,255,0.04)",
                    color:      posPreset === p.id ? "#4cd7f6"               : "#988d9f",
                    border:     `1px solid ${posPreset === p.id ? "rgba(76,215,246,0.35)" : "rgba(255,255,255,0.08)"}`,
                  }}>
                  <span className="material-symbols-outlined text-[14px]">{p.icon}</span>
                  {p.id === "center" ? "Center" : p.id === "custom" ? "Drag" : ""}
                </button>
              ))}
            </div>

            {/* Margin */}
            <RangeSlider value={margin} onChange={v => {
              setMargin(v);
              if (posPreset !== "custom") {
                const { x, y } = presetPos(posPreset, v);
                setPosX(x); setPosY(y);
              }
            }} min={0} max={20} label="Edge Margin" unit="%" />
          </div>

          {/* ── Export settings ───────────────────────────────────────────────── */}
          <div className="glass-panel rounded-2xl p-4 flex flex-col gap-4" style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
            <SectionLabel label="Export" />

            {/* Format */}
            <div>
              <SectionLabel label="Format" />
              <div className="flex gap-2">
                {(["jpg","png","webp"] as OutFormat[]).map(f => (
                  <button key={f} onClick={() => setOutFormat(f)} aria-pressed={outFormat === f}
                    className="flex-1 py-2 rounded-xl text-[12px] font-bold transition-all uppercase"
                    style={{
                      background: outFormat === f ? "rgba(76,215,246,0.15)" : "rgba(255,255,255,0.04)",
                      color:      outFormat === f ? "#4cd7f6"               : "#988d9f",
                      border:     `1px solid ${outFormat === f ? "rgba(76,215,246,0.35)" : "rgba(255,255,255,0.08)"}`,
                    }}>
                    {f}
                  </button>
                ))}
              </div>
            </div>

            {/* Quality */}
            {outFormat !== "png" && (
              <RangeSlider value={quality} onChange={setQuality}
                min={1} max={100} label="Quality" unit="" />
            )}
          </div>
        </div>

        {/* ── Right: Canvas preview ────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col gap-3 min-w-0">

          {/* Canvas */}
          <div className="glass-panel rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="px-4 py-2.5 flex items-center justify-between"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px]" style={{ color: "#4cd7f6" }}>preview</span>
                <span className="text-[12px] font-semibold" style={{ color: "#988d9f" }}>Live Preview</span>
              </div>
              <span className="text-[10px] font-semibold" style={{ color: "#4d4354" }}>
                {posPreset === "custom" ? "Drag on canvas to reposition" : "Click canvas to set custom position"}
              </span>
            </div>
            <div ref={previewContRef} className="w-full" style={{ cursor: "crosshair" }}>
              <canvas ref={previewCanvasRef}
                className="w-full block"
                style={{ touchAction: "none", userSelect: "none" }}
                onPointerDown={onCanvasPointer}
                onPointerMove={onCanvasPointer}
                onPointerUp={onCanvasPointer}
                onPointerCancel={onCanvasPointer}
                aria-label="Watermark preview canvas — click or drag to reposition watermark"
              />
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-3">
            <button onClick={applyWatermark} disabled={applying}
              className="btn-primary flex items-center gap-2 px-6 py-3.5 rounded-2xl font-bold text-sm flex-1 justify-center disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ minWidth: 160 }}>
              {applying ? (
                <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Applying…</>
              ) : (
                <><span className="material-symbols-outlined text-[18px]">branding_watermark</span>Apply Watermark</>
              )}
            </button>

            {resultBlob && (
              <button onClick={() => downloadBlob(resultBlob!, resultFile)}
                className="flex items-center gap-2 px-6 py-3.5 rounded-2xl font-bold text-sm flex-1 justify-center transition-all"
                style={{
                  background: "rgba(76,215,246,0.1)",
                  color: "#4cd7f6",
                  border: "1px solid rgba(76,215,246,0.25)",
                  minWidth: 160,
                }}>
                <span className="material-symbols-outlined text-[18px]">download</span>
                Download {outFormat.toUpperCase()} ({fmt(resultBlob.size)})
              </button>
            )}

            <button onClick={reset} aria-label="Reset all watermark settings"
              className="flex items-center gap-2 px-4 py-3.5 rounded-2xl font-semibold text-sm transition-all"
              style={{ background: "rgba(255,255,255,0.05)", color: "#988d9f", border: "1px solid rgba(255,255,255,0.08)" }}>
              <span className="material-symbols-outlined text-[16px]">restart_alt</span> Reset
            </button>

            <button onClick={() => mainFileInputRef.current?.click()}
              className="flex items-center gap-2 px-4 py-3.5 rounded-2xl font-semibold text-sm transition-all"
              style={{ background: "rgba(255,255,255,0.05)", color: "#988d9f", border: "1px solid rgba(255,255,255,0.08)" }}>
              <span className="material-symbols-outlined text-[16px]">upload_file</span> Upload Another
            </button>
          </div>

          {/* Result preview */}
          {resultUrl && (
            <div className="glass-panel rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(76,215,246,0.2)" }}>
              <div className="px-4 py-2.5 flex items-center gap-2"
                style={{ borderBottom: "1px solid rgba(255,255,255,0.05)", background: "rgba(76,215,246,0.04)" }}>
                <span className="material-symbols-outlined text-[16px] text-green-400">check_circle</span>
                <span className="text-[12px] font-semibold" style={{ color: "#80e0a0" }}>
                  Watermarked — {resultFile} · {fmt(resultBlob!.size)}
                </span>
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={resultUrl} alt="Watermarked result" className="w-full block" draggable={false} />
            </div>
          )}
        </div>
      </div>

      {/* Hidden file input for "Upload Another" */}
      <input ref={mainFileInputRef} type="file" accept={ACCEPTED_MAIN_EXT} className="sr-only"
        onChange={e => { const f = e.target.files?.[0]; if (f) loadMainFile(f); e.target.value = ""; }}
        aria-hidden tabIndex={-1} />
    </div>
  );
}
