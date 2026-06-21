"use client";

/**
 * Add Page Numbers to PDF
 *
 * Uses pdfjs-dist to render thumbnails + pdf-lib to stamp page numbers.
 *
 * Options:
 *   position      — top-left | top-center | top-right
 *                   bottom-left | bottom-center | bottom-right
 *   format        — "N" | "Page N" | "Page N of M"
 *                   "roman-upper" (I,II,III) | "roman-lower" (i,ii,iii)
 *   startFrom     — integer, default 1
 *   fontSize      — 8-32, default 11
 *   fontColor     — hex string, default #000000
 *   fontFamily    — Helvetica | Times-Roman | Courier
 *   margin        — 10-60 px from page edge, default 24
 *   skipFirst     — boolean, default false
 *   skipLast      — boolean, default false
 *
 * pdf-lib drawing:
 *   page.drawText(label, { x, y, size, color, font })
 *   color derived from hex via rgb() → values 0-1
 *   Helvetica/TimesRoman/Courier embedded via StandardFonts enum
 *
 * Coordinate system: pdf-lib uses bottom-left origin.
 *   "bottom" positions: y = margin
 *   "top" positions:   y = pageHeight - margin - fontSize
 *   x for center: (pageWidth - textWidth) / 2
 *   x for right:  pageWidth - margin - textWidth
 *   x for left:   margin
 *
 * Roman numeral conversion uses subtractive notation up to 3999.
 */

import { useState, useRef, useCallback } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

type Position =
  | "top-left" | "top-center" | "top-right"
  | "bottom-left" | "bottom-center" | "bottom-right";

type Format =
  | "plain"          // 1, 2, 3
  | "page-n"         // Page 1
  | "page-n-of-m"    // Page 1 of 10
  | "roman-upper"    // I, II, III
  | "roman-lower";   // i, ii, iii

type FontFamily = "Helvetica" | "Times-Roman" | "Courier";

interface Options {
  position:   Position;
  format:     Format;
  startFrom:  number;
  fontSize:   number;
  fontColor:  string;
  fontFamily: FontFamily;
  margin:     number;
  skipFirst:  boolean;
  skipLast:   boolean;
}

interface Thumb {
  dataUrl: string;
}

type NotifType = "success" | "error";
interface Notif { type: NotifType; msg: string }

// ── Defaults ──────────────────────────────────────────────────────────────────

const DEFAULT_OPTIONS: Options = {
  position:   "bottom-center",
  format:     "plain",
  startFrom:  1,
  fontSize:   11,
  fontColor:  "#000000",
  fontFamily: "Helvetica",
  margin:     24,
  skipFirst:  false,
  skipLast:   false,
};

const MAX_BYTES = 200 * 1024 * 1024;
const THUMB_H   = 140;

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1_048_576) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1_048_576).toFixed(2)} MB`;
}

function toRoman(n: number, lower = false): string {
  const vals  = [1000,900,500,400,100,90,50,40,10,9,5,4,1];
  const syms  = ["M","CM","D","CD","C","XC","L","XL","X","IX","V","IV","I"];
  let result  = "";
  for (let i = 0; i < vals.length; i++) {
    while (n >= vals[i]) { result += syms[i]; n -= vals[i]; }
  }
  return lower ? result.toLowerCase() : result;
}

function formatLabel(pageNum: number, totalPages: number, opts: Options): string {
  const n = pageNum;
  switch (opts.format) {
    case "plain":        return String(n);
    case "page-n":       return `Page ${n}`;
    case "page-n-of-m": return `Page ${n} of ${totalPages}`;
    case "roman-upper":  return toRoman(n, false);
    case "roman-lower":  return toRoman(n, true);
  }
}

function hexToRgb01(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.substring(0, 2), 16) / 255;
  const g = parseInt(clean.substring(2, 4), 16) / 255;
  const b = parseInt(clean.substring(4, 6), 16) / 255;
  return [r, g, b];
}

// ── Library loaders ───────────────────────────────────────────────────────────

async function getPdfjs() {
  const lib = await import("pdfjs-dist");
  lib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  return lib;
}

// ── Thumbnail renderer ────────────────────────────────────────────────────────

async function renderThumbs(
  file: File,
  onProgress: (n: number, total: number) => void,
): Promise<Thumb[]> {
  const pdfjs = await getPdfjs();
  const buf   = await file.arrayBuffer();
  const doc   = await pdfjs.getDocument({ data: buf }).promise;
  const total = doc.numPages;
  const thumbs: Thumb[] = [];

  for (let i = 1; i <= total; i++) {
    onProgress(i, total);
    const page    = await doc.getPage(i);
    const vp1     = page.getViewport({ scale: 1 });
    const scale   = (THUMB_H * 1.5) / vp1.height;
    const vp      = page.getViewport({ scale });
    const canvas  = document.createElement("canvas");
    canvas.width  = Math.round(vp.width);
    canvas.height = Math.round(vp.height);
    const ctx     = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport: vp, canvas }).promise;
    thumbs.push({ dataUrl: canvas.toDataURL("image/jpeg", 0.78) });
  }
  return thumbs;
}

// ── pdf-lib stamping ──────────────────────────────────────────────────────────

async function stampPageNumbers(file: File, opts: Options): Promise<Uint8Array> {
  const { PDFDocument, rgb, StandardFonts } = await import("pdf-lib");
  const buf = await file.arrayBuffer();
  const doc = await PDFDocument.load(buf);

  const fontMap: Record<FontFamily, typeof StandardFonts[keyof typeof StandardFonts]> = {
    "Helvetica":   StandardFonts.Helvetica,
    "Times-Roman": StandardFonts.TimesRoman,
    "Courier":     StandardFonts.Courier,
  };
  const embeddedFont = await doc.embedFont(fontMap[opts.fontFamily]);

  const pages = doc.getPages();
  const total = pages.length;
  const [cr, cg, cb] = hexToRgb01(opts.fontColor);
  const color = rgb(cr, cg, cb);

  // Counter advances only for non-skipped pages
  let labelCounter = opts.startFrom;

  pages.forEach((page, idx) => {
    const isFirst = idx === 0;
    const isLast  = idx === total - 1;
    if ((opts.skipFirst && isFirst) || (opts.skipLast && isLast)) {
      return; // skip — don't advance label counter
    }

    const { width, height } = page.getSize();
    const label      = formatLabel(labelCounter, total, opts);
    const textWidth  = embeddedFont.widthOfTextAtSize(label, opts.fontSize);
    const textHeight = opts.fontSize; // close enough for positioning

    const isTop    = opts.position.startsWith("top");
    const isBottom = opts.position.startsWith("bottom");
    const isLeft   = opts.position.endsWith("left");
    const isCenter = opts.position.endsWith("center");
    const isRight  = opts.position.endsWith("right");

    let x: number;
    if (isLeft)        x = opts.margin;
    else if (isCenter) x = (width - textWidth) / 2;
    else               x = width - opts.margin - textWidth; // right

    let y: number;
    if (isTop)         y = height - opts.margin - textHeight;
    else if (isBottom) y = opts.margin;
    else               y = opts.margin; // fallback

    // Suppress unused warning — isBottom is always true when !isTop above
    void isBottom;

    page.drawText(label, {
      x,
      y,
      size:  opts.fontSize,
      font:  embeddedFont,
      color,
    });

    labelCounter++;
  });

  return doc.save();
}

function downloadPdf(data: Uint8Array, filename: string) {
  const blob = new Blob([data.buffer as ArrayBuffer], { type: "application/pdf" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ── Sub-components ────────────────────────────────────────────────────────────

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "#988d9f" }}>
      {children}
    </span>
  );
}

function SelectField({
  label, value, onChange, options,
}: {
  label: string;
  value: string;
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
        {options.map((o) => (
          <option key={o.value} value={o.value} style={{ background: "#1e1a24" }}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function NumberField({
  label, value, onChange, min, max, step = 1,
}: {
  label: string; value: number; onChange: (v: number) => void;
  min: number; max: number; step?: number;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <FieldLabel>{label}</FieldLabel>
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => {
          const v = parseInt(e.target.value, 10);
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
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-9 h-9 rounded-lg cursor-pointer border-0 p-0.5"
          style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
          aria-label={label}
        />
        <span className="text-[12px] font-mono" style={{ color: "#e2e2e2" }}>{value.toUpperCase()}</span>
      </div>
    </div>
  );
}

function Toggle({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <label className="flex items-start gap-3 cursor-pointer group">
      <div
        role="switch"
        aria-checked={checked}
        tabIndex={0}
        onClick={() => onChange(!checked)}
        onKeyDown={(e) => { if (e.key === " " || e.key === "Enter") onChange(!checked); }}
        className="relative flex-shrink-0 w-10 h-6 rounded-full transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-[#ffb4ab] mt-0.5"
        style={{
          background: checked ? "#ffb4ab" : "rgba(255,255,255,0.1)",
          border:     checked ? "1px solid #ffb4ab" : "1px solid rgba(255,255,255,0.15)",
        }}
      >
        <span
          className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full transition-all duration-200"
          style={{
            background: checked ? "#131313" : "#988d9f",
            transform:  checked ? "translateX(16px)" : "translateX(0)",
          }}
        />
      </div>
      <div>
        <p className="text-[13px] font-semibold text-[#e2e2e2] leading-tight">{label}</p>
        {hint && <p className="text-[11px] text-[#5a4d63] mt-0.5">{hint}</p>}
      </div>
    </label>
  );
}

// ── Position selector ─────────────────────────────────────────────────────────

const POSITIONS: { value: Position; label: string; icon: string }[] = [
  { value: "top-left",      label: "Top Left",      icon: "north_west" },
  { value: "top-center",    label: "Top Center",    icon: "north" },
  { value: "top-right",     label: "Top Right",     icon: "north_east" },
  { value: "bottom-left",   label: "Bottom Left",   icon: "south_west" },
  { value: "bottom-center", label: "Bottom Center", icon: "south" },
  { value: "bottom-right",  label: "Bottom Right",  icon: "south_east" },
];

function PositionPicker({ value, onChange }: { value: Position; onChange: (v: Position) => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <FieldLabel>Position</FieldLabel>
      <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="Page number position">
        {POSITIONS.map((p) => {
          const active = value === p.value;
          return (
            <button
              key={p.value}
              role="radio"
              aria-checked={active}
              onClick={() => onChange(p.value)}
              title={p.label}
              className="flex flex-col items-center gap-1 py-2 px-1 rounded-lg text-[11px] font-semibold transition-all outline-none focus-visible:ring-2 focus-visible:ring-[#ffb4ab]"
              style={{
                background: active ? "rgba(255,180,171,0.15)" : "rgba(255,255,255,0.04)",
                border:     `1px solid ${active ? "#ffb4ab" : "rgba(255,255,255,0.07)"}`,
                color:      active ? "#ffb4ab" : "#988d9f",
              }}
            >
              <span className="material-symbols-outlined text-[16px]">{p.icon}</span>
              <span className="leading-tight text-center">{p.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Preview card (single thumbnail with label overlay) ─────────────────────────

function PreviewCard({
  thumb, pageNum, totalPages, opts, isSkipped,
}: {
  thumb: Thumb; pageNum: number; totalPages: number; opts: Options; isSkipped: boolean;
}) {
  const label = isSkipped ? "" : formatLabel(pageNum, totalPages, opts);
  const dispH = THUMB_H;
  const dispW = Math.round(dispH * 0.707); // A4-ish

  const isTop    = opts.position.startsWith("top");
  const isLeft   = opts.position.endsWith("left");
  const isCenter = opts.position.endsWith("center");

  // Overlay position as percentages
  const overlayStyle: React.CSSProperties = {
    position:   "absolute",
    fontSize:   Math.max(7, Math.min(13, opts.fontSize * 0.55)),
    fontFamily: opts.fontFamily === "Times-Roman" ? "Georgia, serif" : opts.fontFamily === "Courier" ? "monospace" : "sans-serif",
    color:      opts.fontColor,
    whiteSpace: "nowrap",
    lineHeight: 1,
    top:        isTop ? `${Math.round((opts.margin / 841) * 100)}%` : undefined,
    bottom:     !isTop ? `${Math.round((opts.margin / 841) * 100)}%` : undefined,
    left:       isLeft ? `${Math.round((opts.margin / 595) * 100)}%` : isCenter ? "50%" : undefined,
    right:      !isLeft && !isCenter ? `${Math.round((opts.margin / 595) * 100)}%` : undefined,
    transform:  isCenter ? "translateX(-50%)" : undefined,
  };

  return (
    <div
      className="relative rounded-lg overflow-hidden flex-shrink-0"
      style={{
        width:   dispW,
        height:  dispH,
        background: "#fff",
        border:  "1px solid rgba(255,255,255,0.08)",
      }}
      aria-label={`Page ${pageNum}${isSkipped ? " (skipped)" : ""}`}
    >
      <img
        src={thumb.dataUrl}
        alt={`Page ${pageNum}`}
        draggable={false}
        style={{ width: dispW, height: dispH, objectFit: "cover", display: "block" }}
      />
      {!isSkipped && label && (
        <span style={overlayStyle}>{label}</span>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function AddPageNumbersTool() {
  const [draggingOver, setDraggingOver]   = useState(false);
  const [file, setFile]                   = useState<File | null>(null);
  const [thumbs, setThumbs]               = useState<Thumb[]>([]);
  const [loading, setLoading]             = useState(false);
  const [progress, setProgress]           = useState<{ n: number; total: number } | null>(null);
  const [processing, setProcessing]       = useState(false);
  const [done, setDone]                   = useState(false);
  const [resultSize, setResultSize]       = useState(0);
  const [opts, setOpts]                   = useState<Options>(DEFAULT_OPTIONS);
  const [notif, setNotif]                 = useState<Notif | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const dropRef  = useRef<HTMLDivElement>(null);

  const notify = useCallback((type: NotifType, msg: string) => {
    setNotif({ type, msg });
    setTimeout(() => setNotif(null), 7000);
  }, []);

  const set = useCallback(<K extends keyof Options>(key: K, value: Options[K]) => {
    setOpts((prev) => ({ ...prev, [key]: value }));
  }, []);

  // ── File ingestion ────────────────────────────────────────────────────────

  const handleFile = useCallback(async (f: File) => {
    if (f.type !== "application/pdf" && !f.name.toLowerCase().endsWith(".pdf")) {
      notify("error", `"${f.name}" is not a PDF.`); return;
    }
    if (f.size > MAX_BYTES) {
      notify("error", `File exceeds the 200 MB limit (${fmt(f.size)}).`); return;
    }

    setFile(f); setThumbs([]); setDone(false); setNotif(null);
    setLoading(true); setProgress(null);

    try {
      const result = await renderThumbs(f, (n, total) => setProgress({ n, total }));
      setThumbs(result);
    } catch {
      notify("error", "Could not read the PDF. It may be password-protected or corrupted.");
      setFile(null);
    } finally {
      setLoading(false); setProgress(null);
    }
  }, [notify]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDraggingOver(false);
    const f = e.dataTransfer.files[0]; if (f) handleFile(f);
  }, [handleFile]);
  const onDragOver  = (e: React.DragEvent) => { e.preventDefault(); setDraggingOver(true); };
  const onDragLeave = (e: React.DragEvent) => {
    if (dropRef.current && !dropRef.current.contains(e.relatedTarget as Node)) setDraggingOver(false);
  };

  // ── Processing ────────────────────────────────────────────────────────────

  const handleProcess = useCallback(async () => {
    if (!file) return;
    setProcessing(true);
    try {
      const bytes    = await stampPageNumbers(file, opts);
      const filename = file.name.replace(/\.pdf$/i, "") + "_numbered.pdf";
      downloadPdf(bytes, filename);
      setResultSize(bytes.byteLength);
      setDone(true);
    } catch {
      notify("error", "Failed to process the PDF. Please try again.");
    } finally {
      setProcessing(false);
    }
  }, [file, opts, notify]);

  const handleReset = useCallback(() => {
    setFile(null); setThumbs([]); setDone(false); setNotif(null);
    setOpts(DEFAULT_OPTIONS);
    if (inputRef.current) inputRef.current.value = "";
  }, []);

  // ── Derived ───────────────────────────────────────────────────────────────

  const thumbLoaded = thumbs.length > 0 && !loading;
  const thumbPct    = progress ? Math.round((progress.n / progress.total) * 100) : 0;
  const totalPages  = thumbs.length;

  // Label counter: starts at startFrom, increments only non-skipped pages
  function getLabelNum(pageIdx: number): number {
    // Count how many non-skipped pages precede this one
    let count = opts.startFrom;
    for (let i = 0; i < pageIdx; i++) {
      const first = i === 0;
      const last  = i === totalPages - 1;
      if (!((opts.skipFirst && first) || (opts.skipLast && last))) count++;
    }
    return count;
  }

  function isSkipped(idx: number): boolean {
    if (opts.skipFirst && idx === 0) return true;
    if (opts.skipLast && idx === totalPages - 1) return true;
    return false;
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="mb-12 flex flex-col gap-6">

      {/* ── Drop zone ──────────────────────────────────────────────────────── */}
      {!file && (
        <div
          ref={dropRef}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onClick={() => inputRef.current?.click()}
          role="button"
          tabIndex={0}
          aria-label="Upload PDF — click or drag and drop"
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") inputRef.current?.click(); }}
          className="glass-panel rounded-2xl flex flex-col items-center justify-center gap-5 cursor-pointer transition-all duration-300 select-none outline-none focus-visible:ring-2 focus-visible:ring-[#ffb4ab]"
          style={{
            padding: "64px 40px",
            border:  `2px dashed ${draggingOver ? "#ffb4ab" : "rgba(255,255,255,0.12)"}`,
            background: draggingOver ? "rgba(255,180,171,0.06)" : undefined,
            transform: draggingOver ? "scale(1.01)" : "scale(1)",
          }}
        >
          <div
            className="w-20 h-20 rounded-2xl flex items-center justify-center transition-all duration-300"
            style={{
              background: draggingOver ? "rgba(255,180,171,0.2)" : "rgba(255,180,171,0.1)",
              border:     `1px solid ${draggingOver ? "rgba(255,180,171,0.45)" : "rgba(255,180,171,0.2)"}`,
            }}
          >
            <span className="material-symbols-outlined text-[38px]" style={{ color: "#ffb4ab" }}>
              {draggingOver ? "file_download" : "pin"}
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
            {["Page numbers", "6 positions", "5 formats", "Custom style", "Browser-local"].map((f) => (
              <span
                key={f}
                className="px-2.5 py-1 rounded-lg text-[11px] font-semibold"
                style={{ background: "rgba(255,180,171,0.08)", color: "#ffb4ab", border: "1px solid rgba(255,180,171,0.15)" }}
              >
                {f}
              </span>
            ))}
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,.pdf"
            className="sr-only"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
            aria-hidden="true"
            tabIndex={-1}
          />
        </div>
      )}

      {/* ── Loading progress ──────────────────────────────────────────────── */}
      {loading && (
        <div className="glass-panel rounded-2xl p-6 flex flex-col gap-4" aria-live="polite" aria-busy="true">
          <div className="flex items-center gap-3">
            <span className="w-6 h-6 border-2 border-[#ffb4ab]/30 border-t-[#ffb4ab] rounded-full animate-spin flex-shrink-0" />
            <p className="text-[15px] font-bold text-[#e2e2e2]">
              {progress ? `Rendering page ${progress.n} of ${progress.total}…` : "Loading PDF…"}
            </p>
          </div>
          {progress && (
            <div>
              <div
                className="w-full h-1.5 rounded-full overflow-hidden"
                style={{ background: "rgba(255,255,255,0.08)" }}
                role="progressbar"
                aria-valuenow={thumbPct}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{ width: `${thumbPct}%`, background: "#ffb4ab" }}
                />
              </div>
              <p className="text-right text-[11px] text-[#988d9f] mt-1">{thumbPct}%</p>
            </div>
          )}
        </div>
      )}

      {/* ── Notification ──────────────────────────────────────────────────── */}
      {notif && (
        <div
          role="alert"
          className="flex items-start gap-3 px-5 py-4 rounded-xl text-[14px] font-medium"
          style={{
            background: notif.type === "success" ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)",
            border:     `1px solid ${notif.type === "success" ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`,
            color:      notif.type === "success" ? "#22c55e" : "#ef4444",
          }}
        >
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
      {thumbLoaded && !done && (
        <div className="flex flex-col gap-5">

          {/* File header */}
          <div
            className="glass-panel rounded-2xl px-5 py-4 flex items-center gap-3"
          >
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: "rgba(255,180,171,0.1)", border: "1px solid rgba(255,180,171,0.2)" }}
            >
              <span className="material-symbols-outlined text-[18px] text-[#ffb4ab]">picture_as_pdf</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-bold text-[#e2e2e2] truncate">{file?.name}</p>
              <p className="text-[11px] text-[#5a4d63]">
                {fmt(file?.size ?? 0)} · {totalPages} page{totalPages !== 1 ? "s" : ""}
              </p>
            </div>
            <button
              onClick={handleReset}
              aria-label="Remove file"
              className="w-8 h-8 rounded-lg flex items-center justify-center opacity-50 hover:opacity-100 transition-opacity"
              style={{ background: "rgba(255,255,255,0.05)" }}
            >
              <span className="material-symbols-outlined text-[16px] text-[#988d9f]">close</span>
            </button>
          </div>

          {/* Two-column layout: settings + preview */}
          <div className="flex flex-col lg:flex-row gap-5 items-start">

            {/* ── Settings panel ─────────────────────────────────────────── */}
            <div
              className="glass-panel rounded-2xl p-5 flex flex-col gap-5 w-full lg:w-[360px] flex-shrink-0"
            >
              <p className="text-[13px] font-bold text-[#e2e2e2]">Numbering Options</p>

              <PositionPicker value={opts.position} onChange={(v) => set("position", v)} />

              <SelectField
                label="Number Format"
                value={opts.format}
                onChange={(v) => set("format", v as Format)}
                options={[
                  { value: "plain",        label: "1, 2, 3…" },
                  { value: "page-n",       label: "Page 1, Page 2…" },
                  { value: "page-n-of-m",  label: `Page 1 of ${totalPages}…` },
                  { value: "roman-upper",  label: "I, II, III… (uppercase)" },
                  { value: "roman-lower",  label: "i, ii, iii… (lowercase)" },
                ]}
              />

              <NumberField
                label="Start numbering from"
                value={opts.startFrom}
                onChange={(v) => set("startFrom", v)}
                min={1}
                max={9999}
              />

              <div className="h-px" style={{ background: "rgba(255,255,255,0.06)" }} />
              <p className="text-[13px] font-bold text-[#e2e2e2] -mb-2">Appearance</p>

              <div className="grid grid-cols-2 gap-3">
                <NumberField
                  label="Font size (pt)"
                  value={opts.fontSize}
                  onChange={(v) => set("fontSize", v)}
                  min={8}
                  max={32}
                />
                <NumberField
                  label="Margin (px)"
                  value={opts.margin}
                  onChange={(v) => set("margin", v)}
                  min={10}
                  max={60}
                />
              </div>

              <ColorField
                label="Font color"
                value={opts.fontColor}
                onChange={(v) => set("fontColor", v)}
              />

              <SelectField
                label="Font Family"
                value={opts.fontFamily}
                onChange={(v) => set("fontFamily", v as FontFamily)}
                options={[
                  { value: "Helvetica",   label: "Helvetica (sans-serif)" },
                  { value: "Times-Roman", label: "Times Roman (serif)" },
                  { value: "Courier",     label: "Courier (monospace)" },
                ]}
              />

              <div className="h-px" style={{ background: "rgba(255,255,255,0.06)" }} />
              <p className="text-[13px] font-bold text-[#e2e2e2] -mb-2">Skip Pages</p>

              <div className="flex flex-col gap-3">
                <Toggle
                  label="Skip first page"
                  checked={opts.skipFirst}
                  onChange={(v) => set("skipFirst", v)}
                  hint="Leaves the cover page unnumbered"
                />
                <Toggle
                  label="Skip last page"
                  checked={opts.skipLast}
                  onChange={(v) => set("skipLast", v)}
                  hint="Leaves the last page unnumbered"
                />
              </div>

              <div className="h-px" style={{ background: "rgba(255,255,255,0.06)" }} />

              {/* Action buttons */}
              <button
                onClick={handleProcess}
                disabled={processing}
                className="btn-primary w-full text-white font-bold text-[15px] py-3.5 rounded-xl flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {processing ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Adding numbers…
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[17px]">pin</span>
                    Add Page Numbers
                  </>
                )}
              </button>

              <button
                onClick={handleReset}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-semibold text-[#988d9f] hover:text-[#e2e2e2] transition-all"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
              >
                <span className="material-symbols-outlined text-[15px]">restart_alt</span>
                Reset
              </button>
            </div>

            {/* ── Thumbnail preview ───────────────────────────────────────── */}
            <div className="flex-1 min-w-0">
              <div className="glass-panel rounded-2xl p-5 flex flex-col gap-4">
                <p className="text-[13px] font-bold text-[#e2e2e2]">
                  Live Preview
                  <span className="ml-2 text-[11px] font-normal text-[#5a4d63]">
                    — numbers overlay is approximate
                  </span>
                </p>
                <div
                  className="flex flex-wrap gap-3"
                  role="list"
                  aria-label="PDF page previews"
                >
                  {thumbs.map((thumb, idx) => {
                    const skipped  = isSkipped(idx);
                    const labelNum = skipped ? 0 : getLabelNum(idx);
                    return (
                      <div key={idx} className="flex flex-col items-center gap-1.5" role="listitem">
                        <PreviewCard
                          thumb={thumb}
                          pageNum={labelNum}
                          totalPages={totalPages}
                          opts={opts}
                          isSkipped={skipped}
                        />
                        <span
                          className="text-[10px] font-semibold"
                          style={{ color: skipped ? "#5a4d63" : "#988d9f" }}
                        >
                          {skipped ? "skip" : `p.${idx + 1}`}
                        </span>
                      </div>
                    );
                  })}
                </div>
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
              { icon: "pin",         label: "Pages numbered", value: String(
                  totalPages - (opts.skipFirst ? 1 : 0) - (opts.skipLast ? 1 : 0)
                ), color: "#ffb4ab" },
              { icon: "description", label: "Total pages",    value: String(totalPages),  color: "#4cd7f6" },
              { icon: "download",    label: "File size",      value: fmt(resultSize),      color: "#4ade80" },
            ].map(({ icon, label, value, color }) => (
              <div
                key={label}
                className="flex flex-col gap-1.5 rounded-xl p-4"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
              >
                <span className="material-symbols-outlined text-[18px]" style={{ color }}>{icon}</span>
                <p className="text-[20px] font-extrabold leading-none" style={{ color }}>{value}</p>
                <p className="text-[11px] text-[#988d9f] font-semibold uppercase tracking-wide">{label}</p>
              </div>
            ))}
          </div>

          <div className="glass-panel rounded-2xl overflow-hidden">
            <div className="flex items-center gap-4 px-5 py-4 border-b border-[rgba(255,255,255,0.06)]">
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.25)" }}
              >
                <span className="material-symbols-outlined text-[22px] text-[#22c55e]">check_circle</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-bold text-[#e2e2e2]">Page numbers added</p>
                <p className="text-[12px] text-[#988d9f]">PDF downloaded automatically</p>
              </div>
            </div>
            <div className="p-5 flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleProcess}
                disabled={processing}
                className="btn-primary flex-1 text-white font-bold text-[15px] py-3.5 rounded-xl flex items-center justify-center gap-2 disabled:opacity-40"
              >
                <span className="material-symbols-outlined text-[18px]">download</span>
                Download Again
              </button>
              <button
                onClick={handleReset}
                className="flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl text-[14px] font-semibold text-[#988d9f] hover:text-[#e2e2e2] transition-all"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
              >
                <span className="material-symbols-outlined text-[16px]">upload_file</span>
                Number Another PDF
              </button>
            </div>
          </div>

          <div
            className="flex items-start gap-3 px-4 py-3.5 rounded-xl text-[13px]"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", color: "#5a4d63" }}
          >
            <span className="material-symbols-outlined text-[16px] mt-0.5 flex-shrink-0">info</span>
            <span>
              Page numbers are stamped directly onto PDF pages using pdf-lib — no re-rendering of existing content.
              Your file is processed entirely in your browser and never uploaded to any server.
            </span>
          </div>
        </div>
      )}

      {/* ── How it works (no file loaded) ─────────────────────────────────── */}
      {!file && !loading && (
        <div className="glass-panel rounded-2xl p-6 flex flex-col gap-3">
          <p className="text-[12px] font-semibold text-[#988d9f] uppercase tracking-[0.08em]">How it works</p>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            {[
              { icon: "upload_file",  label: "1. Upload",    desc: "Drop your PDF — pages render as thumbnails" },
              { icon: "tune",         label: "2. Configure", desc: "Choose position, format, font, color and margin" },
              { icon: "visibility",   label: "3. Preview",   desc: "See live page number placement before saving" },
              { icon: "download",     label: "4. Download",  desc: "Get your numbered PDF instantly" },
            ].map(({ icon, label, desc }) => (
              <div
                key={label}
                className="flex flex-col gap-2 p-4 rounded-xl"
                style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}
              >
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
