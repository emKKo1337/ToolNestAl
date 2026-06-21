"use client";

/**
 * Watermark PDF — browser-local PDF watermarking tool
 *
 * Watermark types:
 *   Text — custom string stamped with pdf-lib's drawText():
 *     font      Helvetica | Times-Roman | Courier (StandardFonts)
 *     size      8-96 pt
 *     bold/italic  mapped to StandardFonts bold/italic/boldItalic variants
 *     color     hex → rgb(r,g,b) in 0-1 range
 *     opacity   0-100 → 0.0-1.0 (pdf-lib opacity option)
 *     rotation  0-360 degrees
 *     spacing   letter-spacing approximated by drawText per-char loop
 *
 *   Image — PNG/JPG embedded via PDFDocument.embedPng/embedJpg:
 *     width     1-800 pt
 *     opacity   0-100
 *     rotation  0-360
 *
 * Position:
 *   center | top-left | top-center | top-right
 *   bottom-left | bottom-center | bottom-right | custom
 *   custom: x/y offset in pt from bottom-left origin
 *   Rotation is applied around the watermark's own center point using
 *   pdf-lib's rotate option on drawText / drawImage
 *
 * Page targeting:
 *   all | first | last | custom (range string "1-3,5")
 *
 * Preview:
 *   First page rendered via pdfjs-dist at ~400px wide
 *   Text/image overlaid with CSS matching the pdf-lib positioning logic
 *
 * Libraries: pdfjs-dist (thumbnails), pdf-lib (stamping)
 * All processing is browser-local — no network requests.
 */

import { useState, useRef, useCallback, useEffect } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

type WatermarkTab = "text" | "image";

type Position =
  | "center"
  | "top-left" | "top-center" | "top-right"
  | "bottom-left" | "bottom-center" | "bottom-right"
  | "custom";

type PageTarget = "all" | "first" | "last" | "custom";
type FontFamily = "Helvetica" | "Times-Roman" | "Courier";

interface TextOpts {
  text:        string;
  fontFamily:  FontFamily;
  fontSize:    number;
  bold:        boolean;
  italic:      boolean;
  color:       string;
  opacity:     number;   // 0-100
  rotation:    number;   // degrees
  spacing:     number;   // letter spacing in pt (0 = none)
}

interface ImageOpts {
  dataUrl:  string;      // base64 data URL of uploaded image
  mimeType: "image/png" | "image/jpeg";
  width:    number;      // pt
  opacity:  number;      // 0-100
  rotation: number;
}

interface Placement {
  position: Position;
  customX:  number;     // pt from left (used when position === "custom")
  customY:  number;     // pt from bottom (used when position === "custom")
}

interface PageOpts {
  target:      PageTarget;
  customRange: string;
}

type NotifType = "success" | "error";
interface Notif { type: NotifType; msg: string }

// ── Defaults ──────────────────────────────────────────────────────────────────

const DEF_TEXT: TextOpts = {
  text:       "CONFIDENTIAL",
  fontFamily: "Helvetica",
  fontSize:   48,
  bold:       false,
  italic:     false,
  color:      "#cc0000",
  opacity:    30,
  rotation:   45,
  spacing:    0,
};

const DEF_IMAGE: ImageOpts = {
  dataUrl:  "",
  mimeType: "image/png",
  width:    200,
  opacity:  40,
  rotation: 0,
};

const DEF_PLACEMENT: Placement = {
  position: "center",
  customX:  100,
  customY:  100,
};

const DEF_PAGE: PageOpts = {
  target:      "all",
  customRange: "",
};

const MAX_PDF_BYTES   = 200 * 1024 * 1024;
const MAX_IMG_BYTES   = 10  * 1024 * 1024;
const PREVIEW_W       = 400;

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1_048_576) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1_048_576).toFixed(2)} MB`;
}

function hexToRgb01(hex: string): [number, number, number] {
  const c = hex.replace("#", "");
  return [
    parseInt(c.substring(0, 2), 16) / 255,
    parseInt(c.substring(2, 4), 16) / 255,
    parseInt(c.substring(4, 6), 16) / 255,
  ];
}

// Parse "1-3,5,7-9" → Set of 0-based indices
function parseRange(str: string, total: number): Set<number> | null {
  const set = new Set<number>();
  const tokens = str.split(/[\s,]+/).filter(Boolean);
  for (const tok of tokens) {
    const m = tok.match(/^(\d+)(?:-(\d+))?$/);
    if (!m) return null;
    const lo = parseInt(m[1], 10);
    const hi = m[2] ? parseInt(m[2], 10) : lo;
    if (lo < 1 || hi > total || lo > hi) return null;
    for (let i = lo; i <= hi; i++) set.add(i - 1); // 0-based
  }
  return set.size > 0 ? set : null;
}

function targetPages(total: number, opts: PageOpts): Set<number> | null {
  switch (opts.target) {
    case "all":    return new Set(Array.from({ length: total }, (_, i) => i));
    case "first":  return new Set([0]);
    case "last":   return new Set([total - 1]);
    case "custom": return parseRange(opts.customRange, total);
  }
}

// ── Library loaders ───────────────────────────────────────────────────────────

async function getPdfjs() {
  const lib = await import("pdfjs-dist");
  lib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  return lib;
}

// ── Thumbnail for first page (preview) ───────────────────────────────────────

async function renderFirstPage(file: File): Promise<{ dataUrl: string; width: number; height: number }> {
  const pdfjs  = await getPdfjs();
  const buf    = await file.arrayBuffer();
  const doc    = await pdfjs.getDocument({ data: buf }).promise;
  const page   = await doc.getPage(1);
  const vp1    = page.getViewport({ scale: 1 });
  const scale  = PREVIEW_W / vp1.width;
  const vp     = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width  = Math.round(vp.width);
  canvas.height = Math.round(vp.height);
  const ctx    = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport: vp, canvas }).promise;
  return { dataUrl: canvas.toDataURL("image/jpeg", 0.85), width: vp1.width, height: vp1.height };
}

// ── pdf-lib stamping ──────────────────────────────────────────────────────────

async function applyWatermark(
  pdfFile: File,
  tab: WatermarkTab,
  textOpts: TextOpts,
  imageOpts: ImageOpts,
  placement: Placement,
  pageOpts: PageOpts,
): Promise<Uint8Array> {
  const { PDFDocument, rgb, degrees, StandardFonts } = await import("pdf-lib");

  const buf = await pdfFile.arrayBuffer();
  const doc = await PDFDocument.load(buf);
  const pages = doc.getPages();
  const total = pages.length;

  const targetSet = targetPages(total, pageOpts);
  if (!targetSet) throw new Error("Invalid page range");

  // ── Text watermark setup ────────────────────────────────────────────────

  let textFont: Awaited<ReturnType<typeof doc.embedFont>> | null = null;

  if (tab === "text") {
    const fontKey = (() => {
      const b = textOpts.bold, i = textOpts.italic;
      switch (textOpts.fontFamily) {
        case "Helvetica":
          return b && i ? StandardFonts.HelveticaBoldOblique
               : b      ? StandardFonts.HelveticaBold
               : i      ? StandardFonts.HelveticaOblique
               :           StandardFonts.Helvetica;
        case "Times-Roman":
          return b && i ? StandardFonts.TimesRomanBoldItalic
               : b      ? StandardFonts.TimesRomanBold
               : i      ? StandardFonts.TimesRomanItalic
               :           StandardFonts.TimesRoman;
        case "Courier":
          return b && i ? StandardFonts.CourierBoldOblique
               : b      ? StandardFonts.CourierBold
               : i      ? StandardFonts.CourierOblique
               :           StandardFonts.Courier;
      }
    })();
    textFont = await doc.embedFont(fontKey);
  }

  // ── Image watermark setup ───────────────────────────────────────────────

  let embeddedImg: { width: number; height: number; embed: Awaited<ReturnType<typeof doc.embedPng>> } | null = null;

  if (tab === "image" && imageOpts.dataUrl) {
    const b64 = imageOpts.dataUrl.split(",")[1];
    const binary = atob(b64);
    const bytes  = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

    const embed = imageOpts.mimeType === "image/png"
      ? await doc.embedPng(bytes)
      : await doc.embedJpg(bytes);

    embeddedImg = { width: embed.width, height: embed.height, embed };
  }

  // ── Stamp each target page ──────────────────────────────────────────────

  for (const idx of targetSet) {
    const page = pages[idx];
    const { width: pw, height: ph } = page.getSize();

    if (tab === "text" && textFont) {
      const { text, fontSize, color, opacity, rotation, spacing } = textOpts;
      const [r, g, b] = hexToRgb01(color);
      const op = opacity / 100;

      if (spacing === 0) {
        // Single draw call — fast path
        const tw = textFont.widthOfTextAtSize(text, fontSize);
        const th = fontSize;
        const { x, y } = calcXY(placement, pw, ph, tw, th);
        page.drawText(text, {
          x, y,
          size:     fontSize,
          font:     textFont,
          color:    rgb(r, g, b),
          opacity:  op,
          rotate:   degrees(rotation),
        });
      } else {
        // Letter-spacing: draw char by char at offset positions
        // Rotation is applied per-char around a computed center
        const charW = textFont.widthOfTextAtSize("M", fontSize);
        const gap   = charW * spacing * 0.01 + spacing;
        let totalW  = 0;
        for (const ch of text) totalW += textFont.widthOfTextAtSize(ch, fontSize) + gap;
        totalW -= gap;
        const th = fontSize;
        const { x: ox, y: oy } = calcXY(placement, pw, ph, totalW, th);
        let cx = ox;
        for (const ch of text) {
          const cw = textFont.widthOfTextAtSize(ch, fontSize);
          page.drawText(ch, {
            x: cx, y: oy,
            size:    fontSize,
            font:    textFont,
            color:   rgb(r, g, b),
            opacity: op,
            rotate:  degrees(rotation),
          });
          cx += cw + gap;
        }
      }
    }

    if (tab === "image" && embeddedImg) {
      const { embed, width: nw, height: nh } = embeddedImg;
      const { width: iw, opacity: iop, rotation: irot } = imageOpts;
      const scale   = iw / nw;
      const drawW   = iw;
      const drawH   = nh * scale;
      const { x, y } = calcXY(placement, pw, ph, drawW, drawH);
      page.drawImage(embed, {
        x, y,
        width:   drawW,
        height:  drawH,
        opacity: iop / 100,
        rotate:  degrees(irot),
      });
    }
  }

  return doc.save();
}

// ── Compute (x,y) bottom-left origin for a watermark of size (ww×wh) ─────────

function calcXY(
  placement: Placement,
  pw: number, ph: number,
  ww: number, wh: number,
): { x: number; y: number } {
  const margin = 30;
  switch (placement.position) {
    case "center":        return { x: (pw - ww) / 2,          y: (ph - wh) / 2 };
    case "top-left":      return { x: margin,                  y: ph - wh - margin };
    case "top-center":    return { x: (pw - ww) / 2,          y: ph - wh - margin };
    case "top-right":     return { x: pw - ww - margin,       y: ph - wh - margin };
    case "bottom-left":   return { x: margin,                  y: margin };
    case "bottom-center": return { x: (pw - ww) / 2,          y: margin };
    case "bottom-right":  return { x: pw - ww - margin,       y: margin };
    case "custom":        return { x: placement.customX,       y: placement.customY };
  }
}

function downloadPdf(data: Uint8Array, filename: string) {
  const blob = new Blob([data.buffer as ArrayBuffer], { type: "application/pdf" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ── Reusable form controls ────────────────────────────────────────────────────

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "#988d9f" }}>{children}</span>;
}

function SelectField({ label, value, onChange, options }: {
  label: string; value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <FieldLabel>{label}</FieldLabel>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="px-3 py-2 rounded-lg text-[13px] font-medium outline-none focus-visible:ring-2 focus-visible:ring-[#ffb4ab] appearance-none"
        style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#e2e2e2" }}
        aria-label={label}
      >
        {options.map((o) => <option key={o.value} value={o.value} style={{ background: "#1e1a24" }}>{o.label}</option>)}
      </select>
    </div>
  );
}

function NumberField({ label, value, onChange, min, max, step = 1 }: {
  label: string; value: number; onChange: (v: number) => void;
  min: number; max: number; step?: number;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <FieldLabel>{label}</FieldLabel>
      <input type="number" min={min} max={max} step={step} value={value}
        onChange={(e) => {
          const v = parseFloat(e.target.value);
          if (!isNaN(v)) onChange(Math.max(min, Math.min(max, v)));
        }}
        className="px-3 py-2 rounded-lg text-[13px] font-medium outline-none focus-visible:ring-2 focus-visible:ring-[#ffb4ab]"
        style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#e2e2e2" }}
        aria-label={label}
      />
    </div>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <FieldLabel>{label}</FieldLabel>
      <div className="flex items-center gap-2">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)}
          className="w-9 h-9 rounded-lg cursor-pointer border-0 p-0.5"
          style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
          aria-label={label}
        />
        <span className="text-[12px] font-mono" style={{ color: "#e2e2e2" }}>{value.toUpperCase()}</span>
      </div>
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer">
      <div
        role="switch" aria-checked={checked} tabIndex={0}
        onClick={() => onChange(!checked)}
        onKeyDown={(e) => { if (e.key === " " || e.key === "Enter") onChange(!checked); }}
        className="relative w-10 h-6 rounded-full transition-all duration-200 flex-shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-[#ffb4ab]"
        style={{ background: checked ? "#ffb4ab" : "rgba(255,255,255,0.1)", border: `1px solid ${checked ? "#ffb4ab" : "rgba(255,255,255,0.15)"}` }}
      >
        <span className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full transition-all duration-200"
          style={{ background: checked ? "#131313" : "#988d9f", transform: checked ? "translateX(16px)" : "translateX(0)" }} />
      </div>
      <span className="text-[13px] font-semibold text-[#e2e2e2]">{label}</span>
    </label>
  );
}

function SliderField({ label, value, onChange, min, max, unit = "" }: {
  label: string; value: number; onChange: (v: number) => void;
  min: number; max: number; unit?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <FieldLabel>{label}</FieldLabel>
        <span className="text-[12px] font-bold" style={{ color: "#ffb4ab" }}>{value}{unit}</span>
      </div>
      <input type="range" min={min} max={max} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[#ffb4ab] h-1.5 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-[#ffb4ab]"
        aria-label={label}
        aria-valuenow={value}
        aria-valuemin={min}
        aria-valuemax={max}
      />
    </div>
  );
}

// ── Position picker ───────────────────────────────────────────────────────────

const POSITIONS: { value: Position; label: string; icon: string }[] = [
  { value: "top-left",      label: "Top Left",      icon: "north_west" },
  { value: "top-center",    label: "Top Center",    icon: "north" },
  { value: "top-right",     label: "Top Right",     icon: "north_east" },
  { value: "center",        label: "Center",        icon: "filter_center_focus" },
  { value: "bottom-left",   label: "Bottom Left",   icon: "south_west" },
  { value: "bottom-center", label: "Bottom Center", icon: "south" },
  { value: "bottom-right",  label: "Bottom Right",  icon: "south_east" },
  { value: "custom",        label: "Custom",        icon: "my_location" },
];

function PositionPicker({ value, onChange }: { value: Position; onChange: (v: Position) => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <FieldLabel>Position</FieldLabel>
      <div className="grid grid-cols-4 gap-1.5" role="radiogroup" aria-label="Watermark position">
        {POSITIONS.map((p) => {
          const active = value === p.value;
          return (
            <button key={p.value} role="radio" aria-checked={active}
              onClick={() => onChange(p.value)} title={p.label}
              className="flex flex-col items-center gap-1 py-2 px-1 rounded-lg text-[10px] font-semibold transition-all outline-none focus-visible:ring-2 focus-visible:ring-[#ffb4ab]"
              style={{
                background: active ? "rgba(255,180,171,0.15)" : "rgba(255,255,255,0.04)",
                border:     `1px solid ${active ? "#ffb4ab" : "rgba(255,255,255,0.07)"}`,
                color:      active ? "#ffb4ab" : "#988d9f",
              }}
            >
              <span className="material-symbols-outlined text-[15px]">{p.icon}</span>
              <span className="leading-tight text-center">{p.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── CSS preview overlay ───────────────────────────────────────────────────────

function WatermarkOverlay({
  tab, textOpts, imageOpts, placement, previewW, previewH, pdfW, pdfH,
}: {
  tab: WatermarkTab;
  textOpts: TextOpts;
  imageOpts: ImageOpts;
  placement: Placement;
  previewW: number;
  previewH: number;
  pdfW: number;
  pdfH: number;
}) {
  const scale = previewW / pdfW;

  // Estimate watermark render size in pt
  const wPt = tab === "text"
    ? textOpts.text.length * textOpts.fontSize * 0.6
    : imageOpts.width;
  const hPt = tab === "text" ? textOpts.fontSize : imageOpts.width * 0.5;

  const { x: xPt, y: yPt } = calcXY(placement, pdfW, pdfH, wPt, hPt);

  // Convert pt → px (in preview coords); pdf-lib y is bottom-left, CSS top-left
  const xPx = xPt * scale;
  const yPx = previewH - (yPt + hPt) * scale;

  const rotation = tab === "text" ? textOpts.rotation : imageOpts.rotation;
  const opacity  = (tab === "text" ? textOpts.opacity : imageOpts.opacity) / 100;

  const style: React.CSSProperties = {
    position:    "absolute",
    left:        xPx,
    top:         yPx,
    transform:   `rotate(${rotation}deg)`,
    opacity,
    pointerEvents: "none",
    whiteSpace:  "nowrap",
    transformOrigin: "center center",
  };

  if (tab === "text") {
    const { text, fontSize, color, fontFamily, bold, italic, spacing } = textOpts;
    style.fontSize   = fontSize * scale;
    style.color      = color;
    style.fontFamily = fontFamily === "Times-Roman" ? "Georgia, serif"
                     : fontFamily === "Courier"     ? "Courier New, monospace"
                     :                                "Arial, sans-serif";
    style.fontWeight  = bold ? "bold" : "normal";
    style.fontStyle   = italic ? "italic" : "normal";
    style.letterSpacing = `${spacing * scale}px`;
    return <span style={style}>{text}</span>;
  }

  if (imageOpts.dataUrl) {
    const drawW = imageOpts.width * scale;
    style.width = drawW;
    return (
      <img
        src={imageOpts.dataUrl}
        alt="Watermark preview"
        draggable={false}
        style={{ ...style, width: drawW, height: "auto" }}
      />
    );
  }
  return null;
}

// ── Main component ────────────────────────────────────────────────────────────

export default function WatermarkPdfTool() {
  const [draggingOver, setDraggingOver]   = useState(false);
  const [pdfFile, setPdfFile]             = useState<File | null>(null);
  const [preview, setPreview]             = useState<{ dataUrl: string; width: number; height: number } | null>(null);
  const [loading, setLoading]             = useState(false);
  const [processing, setProcessing]       = useState(false);
  const [done, setDone]                   = useState(false);
  const [resultSize, setResultSize]       = useState(0);
  const [pageCount, setPageCount]         = useState(0);

  const [tab, setTab]               = useState<WatermarkTab>("text");
  const [textOpts, setTextOpts]     = useState<TextOpts>(DEF_TEXT);
  const [imageOpts, setImageOpts]   = useState<ImageOpts>(DEF_IMAGE);
  const [placement, setPlacement]   = useState<Placement>(DEF_PLACEMENT);
  const [pageOpts, setPageOpts]     = useState<PageOpts>(DEF_PAGE);

  const [notif, setNotif] = useState<Notif | null>(null);

  const pdfInputRef = useRef<HTMLInputElement>(null);
  const imgInputRef = useRef<HTMLInputElement>(null);
  const dropRef     = useRef<HTMLDivElement>(null);

  const notify = useCallback((type: NotifType, msg: string) => {
    setNotif({ type, msg });
    setTimeout(() => setNotif(null), 7000);
  }, []);

  const setT = useCallback(<K extends keyof TextOpts>(k: K, v: TextOpts[K]) =>
    setTextOpts((p) => ({ ...p, [k]: v })), []);
  const setI = useCallback(<K extends keyof ImageOpts>(k: K, v: ImageOpts[K]) =>
    setImageOpts((p) => ({ ...p, [k]: v })), []);
  const setP = useCallback(<K extends keyof Placement>(k: K, v: Placement[K]) =>
    setPlacement((p) => ({ ...p, [k]: v })), []);
  const setPO = useCallback(<K extends keyof PageOpts>(k: K, v: PageOpts[K]) =>
    setPageOpts((p) => ({ ...p, [k]: v })), []);

  // ── PDF upload ────────────────────────────────────────────────────────────

  const handlePdf = useCallback(async (f: File) => {
    if (f.type !== "application/pdf" && !f.name.toLowerCase().endsWith(".pdf")) {
      notify("error", `"${f.name}" is not a PDF.`); return;
    }
    if (f.size > MAX_PDF_BYTES) {
      notify("error", `File exceeds 200 MB (${fmt(f.size)}).`); return;
    }
    setPdfFile(f); setPreview(null); setDone(false); setNotif(null);
    setLoading(true);
    try {
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
      const buf = await f.arrayBuffer();
      const doc = await pdfjs.getDocument({ data: buf }).promise;
      setPageCount(doc.numPages);
      const result = await renderFirstPage(f);
      setPreview(result);
    } catch {
      notify("error", "Could not read the PDF. It may be password-protected or corrupted.");
      setPdfFile(null);
    } finally {
      setLoading(false);
    }
  }, [notify]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDraggingOver(false);
    const f = e.dataTransfer.files[0]; if (f) handlePdf(f);
  }, [handlePdf]);

  // ── Image upload ──────────────────────────────────────────────────────────

  const handleImgFile = useCallback((f: File) => {
    if (!["image/png", "image/jpeg"].includes(f.type)) {
      notify("error", "Only PNG and JPG images are supported."); return;
    }
    if (f.size > MAX_IMG_BYTES) {
      notify("error", `Image exceeds 10 MB (${fmt(f.size)}).`); return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setI("dataUrl", reader.result as string);
      setI("mimeType", f.type as "image/png" | "image/jpeg");
    };
    reader.readAsDataURL(f);
  }, [notify, setI]);

  // ── Derived ───────────────────────────────────────────────────────────────

  const previewH = preview ? Math.round((preview.height / preview.width) * PREVIEW_W) : 0;

  const canProcess = pdfFile !== null
    && (tab === "text" ? textOpts.text.trim().length > 0 : imageOpts.dataUrl.length > 0);

  // ── Auto-clear done when options change ───────────────────────────────────

  useEffect(() => { setDone(false); }, [tab, textOpts, imageOpts, placement, pageOpts]);

  // ── Process ───────────────────────────────────────────────────────────────

  const handleProcess = useCallback(async () => {
    if (!pdfFile) return;
    if (pageOpts.target === "custom") {
      const set = parseRange(pageOpts.customRange, pageCount);
      if (!set) { notify("error", "Invalid page range. Example: 1-3, 5, 7"); return; }
    }
    setProcessing(true);
    try {
      const bytes    = await applyWatermark(pdfFile, tab, textOpts, imageOpts, placement, pageOpts);
      const filename = pdfFile.name.replace(/\.pdf$/i, "") + "_watermarked.pdf";
      downloadPdf(bytes, filename);
      setResultSize(bytes.byteLength);
      setDone(true);
    } catch (err) {
      notify("error", err instanceof Error ? err.message : "Failed to apply watermark. Please try again.");
    } finally {
      setProcessing(false);
    }
  }, [pdfFile, tab, textOpts, imageOpts, placement, pageOpts, pageCount, notify]);

  const handleReset = useCallback(() => {
    setPdfFile(null); setPreview(null); setDone(false); setNotif(null);
    setPageCount(0);
    setTextOpts(DEF_TEXT); setImageOpts(DEF_IMAGE);
    setPlacement(DEF_PLACEMENT); setPageOpts(DEF_PAGE);
    if (pdfInputRef.current) pdfInputRef.current.value = "";
    if (imgInputRef.current) imgInputRef.current.value = "";
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="mb-12 flex flex-col gap-6">

      {/* ── Drop zone ──────────────────────────────────────────────────────── */}
      {!pdfFile && (
        <div
          ref={dropRef}
          onDrop={onDrop}
          onDragOver={(e) => { e.preventDefault(); setDraggingOver(true); }}
          onDragLeave={(e) => { if (dropRef.current && !dropRef.current.contains(e.relatedTarget as Node)) setDraggingOver(false); }}
          onClick={() => pdfInputRef.current?.click()}
          role="button" tabIndex={0} aria-label="Upload PDF"
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") pdfInputRef.current?.click(); }}
          className="glass-panel rounded-2xl flex flex-col items-center justify-center gap-5 cursor-pointer transition-all duration-300 select-none outline-none focus-visible:ring-2 focus-visible:ring-[#ffb4ab]"
          style={{
            padding:    "64px 40px",
            border:     `2px dashed ${draggingOver ? "#ffb4ab" : "rgba(255,255,255,0.12)"}`,
            background: draggingOver ? "rgba(255,180,171,0.06)" : undefined,
            transform:  draggingOver ? "scale(1.01)" : "scale(1)",
          }}
        >
          <div className="w-20 h-20 rounded-2xl flex items-center justify-center transition-all duration-300"
            style={{
              background: draggingOver ? "rgba(255,180,171,0.2)" : "rgba(255,180,171,0.1)",
              border:     `1px solid ${draggingOver ? "rgba(255,180,171,0.45)" : "rgba(255,180,171,0.2)"}`,
            }}>
            <span className="material-symbols-outlined text-[38px]" style={{ color: "#ffb4ab" }}>
              {draggingOver ? "file_download" : "branding_watermark"}
            </span>
          </div>
          <div className="text-center">
            <p className="text-[18px] font-bold text-[#e2e2e2] mb-1.5">
              {draggingOver ? "Drop your PDF here" : "Drag & drop your PDF here"}
            </p>
            <p className="text-[14px] text-[#988d9f]">
              or <span className="text-[#ffb4ab] font-semibold">click to browse</span>
              {" — PDF only · up to 200 MB"}
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            {["Text watermark", "Image watermark", "Custom position", "Opacity control", "Browser-local"].map((f) => (
              <span key={f} className="px-2.5 py-1 rounded-lg text-[11px] font-semibold"
                style={{ background: "rgba(255,180,171,0.08)", color: "#ffb4ab", border: "1px solid rgba(255,180,171,0.15)" }}>
                {f}
              </span>
            ))}
          </div>
          <input ref={pdfInputRef} type="file" accept="application/pdf,.pdf" className="sr-only"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePdf(f); e.target.value = ""; }}
            aria-hidden="true" tabIndex={-1} />
        </div>
      )}

      {/* ── Loading ───────────────────────────────────────────────────────── */}
      {loading && (
        <div className="glass-panel rounded-2xl p-6 flex items-center gap-3" aria-live="polite" aria-busy="true">
          <span className="w-6 h-6 border-2 border-[#ffb4ab]/30 border-t-[#ffb4ab] rounded-full animate-spin flex-shrink-0" />
          <p className="text-[15px] font-bold text-[#e2e2e2]">Loading PDF…</p>
        </div>
      )}

      {/* ── Notification ──────────────────────────────────────────────────── */}
      {notif && (
        <div role="alert" className="flex items-start gap-3 px-5 py-4 rounded-xl text-[14px] font-medium"
          style={{
            background: notif.type === "success" ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)",
            border:     `1px solid ${notif.type === "success" ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`,
            color:      notif.type === "success" ? "#22c55e" : "#ef4444",
          }}>
          <span className="material-symbols-outlined text-[20px] flex-shrink-0 mt-0.5">
            {notif.type === "success" ? "check_circle" : "error"}
          </span>
          <span className="flex-1 leading-relaxed">{notif.msg}</span>
          <button onClick={() => setNotif(null)} aria-label="Dismiss" className="opacity-60 hover:opacity-100 transition-opacity">
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
      )}

      {/* ── Editor ─────────────────────────────────────────────────────────── */}
      {pdfFile && !loading && !done && (
        <div className="flex flex-col gap-5">

          {/* File header */}
          <div className="glass-panel rounded-2xl px-5 py-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: "rgba(255,180,171,0.1)", border: "1px solid rgba(255,180,171,0.2)" }}>
              <span className="material-symbols-outlined text-[18px] text-[#ffb4ab]">picture_as_pdf</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-bold text-[#e2e2e2] truncate">{pdfFile.name}</p>
              <p className="text-[11px] text-[#5a4d63]">{fmt(pdfFile.size)} · {pageCount} page{pageCount !== 1 ? "s" : ""}</p>
            </div>
            <button onClick={handleReset} aria-label="Remove file"
              className="w-8 h-8 rounded-lg flex items-center justify-center opacity-50 hover:opacity-100 transition-opacity"
              style={{ background: "rgba(255,255,255,0.05)" }}>
              <span className="material-symbols-outlined text-[16px] text-[#988d9f]">close</span>
            </button>
          </div>

          <div className="flex flex-col lg:flex-row gap-5 items-start">

            {/* ── Settings panel ─────────────────────────────────────────── */}
            <div className="glass-panel rounded-2xl p-5 flex flex-col gap-5 w-full lg:w-[380px] flex-shrink-0">

              {/* Tab switcher */}
              <div className="flex rounded-xl overflow-hidden" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }} role="tablist">
                {([["text", "text_fields", "Text"], ["image", "image", "Image"]] as const).map(([t, icon, label]) => (
                  <button key={t} role="tab" aria-selected={tab === t}
                    onClick={() => setTab(t)}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 text-[13px] font-bold transition-all"
                    style={{
                      background: tab === t ? "rgba(255,180,171,0.15)" : "transparent",
                      color:      tab === t ? "#ffb4ab" : "#988d9f",
                      borderBottom: tab === t ? "2px solid #ffb4ab" : "2px solid transparent",
                    }}>
                    <span className="material-symbols-outlined text-[16px]">{icon}</span>
                    {label}
                  </button>
                ))}
              </div>

              {/* ── Text options ──────────────────────────────────────────── */}
              {tab === "text" && (
                <>
                  <div className="flex flex-col gap-1.5">
                    <FieldLabel>Watermark text</FieldLabel>
                    <input
                      type="text"
                      value={textOpts.text}
                      onChange={(e) => setT("text", e.target.value)}
                      placeholder="e.g. CONFIDENTIAL"
                      maxLength={100}
                      className="px-3 py-2 rounded-lg text-[13px] font-medium outline-none focus-visible:ring-2 focus-visible:ring-[#ffb4ab]"
                      style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#e2e2e2" }}
                      aria-label="Watermark text"
                    />
                  </div>

                  <SelectField label="Font Family" value={textOpts.fontFamily}
                    onChange={(v) => setT("fontFamily", v as FontFamily)}
                    options={[
                      { value: "Helvetica",   label: "Helvetica (sans-serif)" },
                      { value: "Times-Roman", label: "Times Roman (serif)" },
                      { value: "Courier",     label: "Courier (monospace)" },
                    ]}
                  />

                  <div className="grid grid-cols-2 gap-3">
                    <NumberField label="Font size (pt)" value={textOpts.fontSize} onChange={(v) => setT("fontSize", v)} min={8} max={96} />
                    <NumberField label="Letter spacing" value={textOpts.spacing}  onChange={(v) => setT("spacing", v)}  min={0} max={20} />
                  </div>

                  <div className="flex gap-4">
                    <Toggle label="Bold"   checked={textOpts.bold}   onChange={(v) => setT("bold", v)} />
                    <Toggle label="Italic" checked={textOpts.italic} onChange={(v) => setT("italic", v)} />
                  </div>

                  <ColorField label="Text color" value={textOpts.color} onChange={(v) => setT("color", v)} />

                  <SliderField label="Opacity"  value={textOpts.opacity}  onChange={(v) => setT("opacity", v)}  min={5} max={100} unit="%" />
                  <SliderField label="Rotation" value={textOpts.rotation} onChange={(v) => setT("rotation", v)} min={0} max={360} unit="°" />
                </>
              )}

              {/* ── Image options ─────────────────────────────────────────── */}
              {tab === "image" && (
                <>
                  {imageOpts.dataUrl ? (
                    <div className="flex items-center gap-3 p-3 rounded-xl"
                      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                      <img src={imageOpts.dataUrl} alt="Watermark" className="w-14 h-14 object-contain rounded-lg flex-shrink-0"
                        style={{ background: "rgba(255,255,255,0.06)" }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-bold text-[#e2e2e2]">Image loaded</p>
                        <p className="text-[11px] text-[#5a4d63]">{imageOpts.mimeType}</p>
                      </div>
                      <button onClick={() => { setI("dataUrl", ""); if (imgInputRef.current) imgInputRef.current.value = ""; }}
                        aria-label="Remove image"
                        className="w-7 h-7 rounded-lg flex items-center justify-center opacity-60 hover:opacity-100 transition-opacity"
                        style={{ background: "rgba(255,107,107,0.1)" }}>
                        <span className="material-symbols-outlined text-[14px] text-[#ff6b6b]">close</span>
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => imgInputRef.current?.click()}
                      className="flex flex-col items-center gap-3 p-5 rounded-xl transition-all border-2 border-dashed"
                      style={{ borderColor: "rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.02)" }}>
                      <span className="material-symbols-outlined text-[28px] text-[#ffb4ab]">upload</span>
                      <p className="text-[13px] font-semibold text-[#988d9f]">Click to upload watermark image</p>
                      <p className="text-[11px] text-[#5a4d63]">PNG, JPG · up to 10 MB</p>
                    </button>
                  )}
                  <input ref={imgInputRef} type="file" accept="image/png,image/jpeg,image/jpg" className="sr-only"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImgFile(f); e.target.value = ""; }}
                    aria-hidden="true" tabIndex={-1} />

                  <NumberField label="Width (pt)" value={imageOpts.width} onChange={(v) => setI("width", v)} min={20} max={800} />
                  <SliderField label="Opacity"  value={imageOpts.opacity}  onChange={(v) => setI("opacity", v)}  min={5} max={100} unit="%" />
                  <SliderField label="Rotation" value={imageOpts.rotation} onChange={(v) => setI("rotation", v)} min={0} max={360} unit="°" />
                </>
              )}

              <div className="h-px" style={{ background: "rgba(255,255,255,0.06)" }} />

              {/* ── Placement ─────────────────────────────────────────────── */}
              <PositionPicker value={placement.position} onChange={(v) => setP("position", v)} />

              {placement.position === "custom" && (
                <div className="grid grid-cols-2 gap-3">
                  <NumberField label="X offset (pt)" value={placement.customX} onChange={(v) => setP("customX", v)} min={0} max={2000} />
                  <NumberField label="Y offset (pt)" value={placement.customY} onChange={(v) => setP("customY", v)} min={0} max={2000} />
                </div>
              )}

              <div className="h-px" style={{ background: "rgba(255,255,255,0.06)" }} />

              {/* ── Page targeting ────────────────────────────────────────── */}
              <SelectField label="Apply to pages" value={pageOpts.target}
                onChange={(v) => setPO("target", v as PageTarget)}
                options={[
                  { value: "all",    label: "All pages" },
                  { value: "first",  label: "First page only" },
                  { value: "last",   label: "Last page only" },
                  { value: "custom", label: "Custom range" },
                ]}
              />

              {pageOpts.target === "custom" && (
                <div className="flex flex-col gap-1.5">
                  <FieldLabel>Page range</FieldLabel>
                  <input type="text" value={pageOpts.customRange}
                    onChange={(e) => setPO("customRange", e.target.value)}
                    placeholder={`e.g. 1-3, 5, 7 (of ${pageCount})`}
                    className="px-3 py-2 rounded-lg text-[13px] font-medium outline-none focus-visible:ring-2 focus-visible:ring-[#ffb4ab]"
                    style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#e2e2e2" }}
                    aria-label="Custom page range"
                  />
                </div>
              )}

              <div className="h-px" style={{ background: "rgba(255,255,255,0.06)" }} />

              {/* ── Action buttons ────────────────────────────────────────── */}
              <button onClick={handleProcess} disabled={processing || !canProcess}
                className="btn-primary w-full text-white font-bold text-[15px] py-3.5 rounded-xl flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed">
                {processing ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Applying…
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[17px]">branding_watermark</span>
                    Apply Watermark
                  </>
                )}
              </button>

              <button onClick={handleReset}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-semibold text-[#988d9f] hover:text-[#e2e2e2] transition-all"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <span className="material-symbols-outlined text-[15px]">restart_alt</span>
                Reset
              </button>
            </div>

            {/* ── Live preview ────────────────────────────────────────────── */}
            <div className="flex-1 min-w-0">
              <div className="glass-panel rounded-2xl p-5 flex flex-col gap-4">
                <p className="text-[13px] font-bold text-[#e2e2e2]">
                  Live Preview
                  <span className="ml-2 text-[11px] font-normal text-[#5a4d63]">— page 1 · approximate</span>
                </p>
                {preview && (
                  <div className="relative rounded-xl overflow-hidden flex-shrink-0 mx-auto"
                    style={{ width: PREVIEW_W, height: previewH, background: "#fff" }}>
                    <img src={preview.dataUrl} alt="PDF page preview"
                      style={{ width: PREVIEW_W, height: previewH, display: "block" }}
                      draggable={false}
                    />
                    <WatermarkOverlay
                      tab={tab}
                      textOpts={textOpts}
                      imageOpts={imageOpts}
                      placement={placement}
                      previewW={PREVIEW_W}
                      previewH={previewH}
                      pdfW={preview.width}
                      pdfH={preview.height}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Done state ────────────────────────────────────────────────────── */}
      {done && (
        <div className="flex flex-col gap-4">
          <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))" }}>
            {[
              { icon: "branding_watermark", label: "Watermark",    value: tab === "text" ? "Text" : "Image", color: "#ffb4ab" },
              { icon: "description",        label: "Pages",        value: String(pageCount),                  color: "#4cd7f6" },
              { icon: "download",           label: "File size",    value: fmt(resultSize),                    color: "#4ade80" },
            ].map(({ icon, label, value, color }) => (
              <div key={label} className="flex flex-col gap-1.5 rounded-xl p-4"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <span className="material-symbols-outlined text-[18px]" style={{ color }}>{icon}</span>
                <p className="text-[20px] font-extrabold leading-none" style={{ color }}>{value}</p>
                <p className="text-[11px] text-[#988d9f] font-semibold uppercase tracking-wide">{label}</p>
              </div>
            ))}
          </div>

          <div className="glass-panel rounded-2xl overflow-hidden">
            <div className="flex items-center gap-4 px-5 py-4 border-b border-[rgba(255,255,255,0.06)]">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.25)" }}>
                <span className="material-symbols-outlined text-[22px] text-[#22c55e]">check_circle</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-bold text-[#e2e2e2]">Watermark applied</p>
                <p className="text-[12px] text-[#988d9f]">PDF downloaded automatically</p>
              </div>
            </div>
            <div className="p-5 flex flex-col sm:flex-row gap-3">
              <button onClick={handleProcess} disabled={processing}
                className="btn-primary flex-1 text-white font-bold text-[15px] py-3.5 rounded-xl flex items-center justify-center gap-2 disabled:opacity-40">
                <span className="material-symbols-outlined text-[18px]">download</span>
                Download Again
              </button>
              <button onClick={handleReset}
                className="flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl text-[14px] font-semibold text-[#988d9f] hover:text-[#e2e2e2] transition-all"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <span className="material-symbols-outlined text-[16px]">upload_file</span>
                Watermark Another PDF
              </button>
            </div>
          </div>

          <div className="flex items-start gap-3 px-4 py-3.5 rounded-xl text-[13px]"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", color: "#5a4d63" }}>
            <span className="material-symbols-outlined text-[16px] mt-0.5 flex-shrink-0">info</span>
            <span>
              Watermarks are stamped using pdf-lib — no re-rendering of existing content.
              Your file is processed entirely in your browser and never uploaded to any server.
            </span>
          </div>
        </div>
      )}

      {/* ── How it works ──────────────────────────────────────────────────── */}
      {!pdfFile && !loading && (
        <div className="glass-panel rounded-2xl p-6 flex flex-col gap-3">
          <p className="text-[12px] font-semibold text-[#988d9f] uppercase tracking-[0.08em]">How it works</p>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            {[
              { icon: "upload_file",        label: "1. Upload",    desc: "Drop your PDF — a live preview of page 1 appears" },
              { icon: "branding_watermark", label: "2. Configure", desc: "Choose text or image, set style, position and pages" },
              { icon: "visibility",         label: "3. Preview",   desc: "See the watermark overlaid on your PDF instantly" },
              { icon: "download",           label: "4. Download",  desc: "Apply and download your watermarked PDF" },
            ].map(({ icon, label, desc }) => (
              <div key={label} className="flex flex-col gap-2 p-4 rounded-xl"
                style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
                <span className="material-symbols-outlined text-[22px] text-[#ffb4ab]">{icon}</span>
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
