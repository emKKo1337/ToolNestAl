"use client";

import { useState, useRef, useCallback, useId } from "react";
import { PDFDocument } from "pdf-lib";

// ─── Constants ────────────────────────────────────────────────────────────────
const MAX_IMAGES = 50;
const MAX_IMAGE_BYTES = 20 * 1024 * 1024; // 20 MB
const ACCEPTED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
const ACCEPTED_EXT = /\.(jpe?g|png|webp)$/i;

// PDF page dimensions in points (72 pt = 1 inch)
const PAGE_DIMS = {
  A4: [595.28, 841.89] as [number, number],
  Letter: [612, 792] as [number, number],
  Legal: [612, 1008] as [number, number],
};

const MARGIN_PTS = { none: 0, small: 18, medium: 36, large: 72 };
const GAP_PTS = 6; // gap between images in multi-image layouts

// ─── Types ────────────────────────────────────────────────────────────────────
type PageSizeKey = "A4" | "Letter" | "Legal" | "Auto";
type Orientation = "portrait" | "landscape";
type MarginKey = "none" | "small" | "medium" | "large";
type LayoutKey = "one" | "two" | "four";

interface ImageEntry {
  id: string;
  file: File;
  name: string;
  size: number;
  rotation: number; // 0 | 90 | 180 | 270
  previewUrl: string;
}

interface Settings {
  pageSize: PageSizeKey;
  orientation: Orientation;
  margin: MarginKey;
  layout: LayoutKey;
}

type NotifType = "success" | "error";
interface Notif { type: NotifType; message: string; }

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(2)} MB`;
}

function isAccepted(file: File): boolean {
  return ACCEPTED_MIME.has(file.type) || ACCEPTED_EXT.test(file.name);
}

/** Render image to canvas (handles rotation + WEBP → JPEG conversion).
 *  For JPEG/PNG with no rotation, returns raw bytes for lossless embedding. */
async function processImage(
  file: File,
  rotation: number
): Promise<{ bytes: Uint8Array; kind: "jpg" | "png" }> {
  const needsCanvas = file.type === "image/webp" || rotation !== 0;

  if (!needsCanvas) {
    const buf = await file.arrayBuffer();
    return { bytes: new Uint8Array(buf), kind: file.type === "image/png" ? "png" : "jpg" };
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      const isOdd = rotation === 90 || rotation === 270;
      const cw = isOdd ? img.naturalHeight : img.naturalWidth;
      const ch = isOdd ? img.naturalWidth : img.naturalHeight;

      const canvas = document.createElement("canvas");
      canvas.width = cw;
      canvas.height = ch;
      const ctx = canvas.getContext("2d")!;

      // White background so transparent PNGs don't become black in JPEG
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, cw, ch);

      ctx.save();
      ctx.translate(cw / 2, ch / 2);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
      ctx.restore();

      URL.revokeObjectURL(url);

      canvas.toBlob(
        (blob) => {
          if (!blob) { reject(new Error(`Failed to process ${file.name}`)); return; }
          blob.arrayBuffer().then((buf) => {
            canvas.width = 0; // release memory
            resolve({ bytes: new Uint8Array(buf), kind: "jpg" });
          }).catch(reject);
        },
        "image/jpeg",
        0.95
      );
    };

    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error(`Could not load ${file.name}`)); };
    img.src = url;
  });
}

/** Resolve page [width, height] in PDF points, applying orientation. */
function resolvePageDims(
  settings: Settings,
  imgW: number,
  imgH: number
): [number, number] {
  if (settings.pageSize === "Auto") {
    // Size page to image's aspect ratio, longest side = A4 long dimension
    const MAX = 841.89;
    const scale = MAX / Math.max(imgW, imgH);
    const pw = imgW * scale;
    const ph = imgH * scale;
    // Still respect orientation preference
    return settings.orientation === "landscape" && pw < ph ? [ph, pw] : [pw, ph];
  }
  let [w, h] = PAGE_DIMS[settings.pageSize];
  if (settings.orientation === "landscape") [w, h] = [h, w];
  return [w, h];
}

/** Compute columns and rows for a given layout. */
function gridShape(layout: LayoutKey): [cols: number, rows: number] {
  if (layout === "two") return [2, 1];   // side-by-side
  if (layout === "four") return [2, 2];  // 2×2
  return [1, 1];
}

async function buildPdf(images: ImageEntry[], settings: Settings): Promise<ArrayBuffer> {
  const pdfDoc = await PDFDocument.create();
  const margin = MARGIN_PTS[settings.margin];
  const [cols, rows] = gridShape(settings.layout);
  const perPage = cols * rows;

  // Process all images up front
  const processed = await Promise.all(
    images.map((img) => processImage(img.file, img.rotation))
  );

  // Chunk images into pages
  for (let start = 0; start < processed.length; start += perPage) {
    const chunk = processed.slice(start, start + perPage);
    const srcImages = images.slice(start, start + perPage);

    // Embed images into pdf-lib
    const embedded = await Promise.all(
      chunk.map(({ bytes, kind }) =>
        kind === "png" ? pdfDoc.embedPng(bytes) : pdfDoc.embedJpg(bytes)
      )
    );

    // Determine page dimensions (use first image's natural size for Auto)
    const first = embedded[0];
    const [pageW, pageH] = resolvePageDims(settings, first.width, first.height);

    const page = pdfDoc.addPage([pageW, pageH]);
    const availW = pageW - 2 * margin;
    const availH = pageH - 2 * margin;

    if (perPage === 1) {
      // Single image — centre and fit
      const scale = Math.min(availW / first.width, availH / first.height);
      const dw = first.width * scale;
      const dh = first.height * scale;
      page.drawImage(first, {
        x: margin + (availW - dw) / 2,
        y: margin + (availH - dh) / 2,
        width: dw,
        height: dh,
      });
    } else {
      // Grid layout
      const gapX = GAP_PTS * (cols - 1);
      const gapY = GAP_PTS * (rows - 1);
      const cellW = (availW - gapX) / cols;
      const cellH = (availH - gapY) / rows;

      embedded.forEach((img, idx) => {
        if (!img) return;
        const col = idx % cols;
        // PDF y=0 is bottom; row 0 visually is the TOP row → invert
        const row = Math.floor(idx / cols);
        const cellX = margin + col * (cellW + GAP_PTS);
        const cellY = margin + (rows - 1 - row) * (cellH + GAP_PTS);

        const scale = Math.min(cellW / img.width, cellH / img.height);
        const dw = img.width * scale;
        const dh = img.height * scale;
        page.drawImage(img, {
          x: cellX + (cellW - dw) / 2,
          y: cellY + (cellH - dh) / 2,
          width: dw,
          height: dh,
        });
      });
    }

    void srcImages; // used for ordering reference only
  }

  const saved = await pdfDoc.save();
  return saved.buffer.slice(saved.byteOffset, saved.byteOffset + saved.byteLength) as ArrayBuffer;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Individual image thumbnail card */
function ImageThumb({
  entry,
  index,
  dragIndex,
  dragOverIndex,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onRemove,
  onRotate,
}: {
  entry: ImageEntry;
  index: number;
  dragIndex: number | null;
  dragOverIndex: number | null;
  onDragStart: (e: React.DragEvent, i: number) => void;
  onDragOver: (e: React.DragEvent, i: number) => void;
  onDrop: (e: React.DragEvent, i: number) => void;
  onDragEnd: () => void;
  onRemove: (id: string) => void;
  onRotate: (id: string) => void;
}) {
  const isBeingDragged = dragIndex === index;
  const isDropTarget = dragOverIndex === index && dragIndex !== index;

  return (
    <li
      draggable
      onDragStart={(e) => onDragStart(e, index)}
      onDragOver={(e) => onDragOver(e, index)}
      onDrop={(e) => onDrop(e, index)}
      onDragEnd={onDragEnd}
      className="relative flex flex-col gap-1 group transition-all duration-150 cursor-grab active:cursor-grabbing"
      style={{
        opacity: isBeingDragged ? 0.4 : 1,
        outline: isDropTarget ? "2px solid #ddb7ff" : "none",
        outlineOffset: "2px",
        borderRadius: "12px",
      }}
      aria-label={`Image ${index + 1}: ${entry.name}`}
    >
      {/* Thumbnail */}
      <div
        className="relative aspect-square rounded-xl overflow-hidden"
        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={entry.previewUrl}
          alt={entry.name}
          className="w-full h-full object-cover transition-transform duration-300"
          style={{ transform: `rotate(${entry.rotation}deg)` }}
          draggable={false}
        />

        {/* Rotation badge */}
        {entry.rotation !== 0 && (
          <span
            className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-md text-[10px] font-bold"
            style={{ background: "rgba(221,183,255,0.85)", color: "#131313" }}
          >
            {entry.rotation}°
          </span>
        )}

        {/* Sequence number */}
        <span
          className="absolute top-1.5 right-1.5 w-5 h-5 rounded-md flex items-center justify-center text-[11px] font-extrabold"
          style={{ background: "rgba(0,0,0,0.55)", color: "#e2e2e2" }}
        >
          {index + 1}
        </span>

        {/* Action overlay */}
        <div className="absolute inset-0 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-150" style={{ background: "rgba(0,0,0,0.5)" }}>
          <button
            onClick={(e) => { e.stopPropagation(); onRotate(entry.id); }}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white transition-all"
            style={{ background: "rgba(221,183,255,0.25)", border: "1px solid rgba(221,183,255,0.4)" }}
            aria-label="Rotate 90°"
            title="Rotate 90°"
          >
            <span className="material-symbols-outlined text-[16px]">rotate_right</span>
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onRemove(entry.id); }}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white transition-all"
            style={{ background: "rgba(239,68,68,0.25)", border: "1px solid rgba(239,68,68,0.4)" }}
            aria-label={`Remove ${entry.name}`}
            title="Remove"
          >
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>
      </div>

      {/* File name */}
      <p className="text-[11px] text-[#988d9f] truncate px-0.5" title={entry.name}>
        {entry.name}
      </p>
    </li>
  );
}

/** Compact settings chip button */
function Chip({
  active, onClick, children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className="px-3.5 py-2 rounded-xl text-[13px] font-semibold transition-all duration-200"
      style={{
        background: active ? "rgba(221,183,255,0.15)" : "rgba(255,255,255,0.04)",
        color: active ? "#ddb7ff" : "#988d9f",
        border: `1px solid ${active ? "rgba(221,183,255,0.35)" : "rgba(255,255,255,0.08)"}`,
      }}
    >
      {children}
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function ImageToPdfTool() {
  const [images, setImages] = useState<ImageEntry[]>([]);
  const [draggingOver, setDraggingOver] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [settings, setSettings] = useState<Settings>({
    pageSize: "A4",
    orientation: "portrait",
    margin: "medium",
    layout: "one",
  });
  const [generating, setGenerating] = useState(false);
  const [resultBuf, setResultBuf] = useState<ArrayBuffer | null>(null);
  const [notif, setNotif] = useState<Notif | null>(null);

  const dropRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const uid = useId();

  const notify = useCallback((type: NotifType, message: string) => {
    setNotif({ type, message });
    setTimeout(() => setNotif(null), 6000);
  }, []);

  // ── Add images ──────────────────────────────────────────────────────────────
  const addImages = useCallback(
    (incoming: FileList | File[]) => {
      const arr = Array.from(incoming);
      const valid: File[] = [];
      const errors: string[] = [];

      for (const f of arr) {
        if (!isAccepted(f)) { errors.push(`"${f.name}" is not a supported image format.`); continue; }
        if (f.size > MAX_IMAGE_BYTES) { errors.push(`"${f.name}" exceeds the 20 MB limit.`); continue; }
        valid.push(f);
      }

      if (errors.length) notify("error", errors.slice(0, 2).join(" ") + (errors.length > 2 ? ` (+${errors.length - 2} more)` : ""));
      if (!valid.length) return;

      setImages((prev) => {
        const remaining = MAX_IMAGES - prev.length;
        if (remaining <= 0) { notify("error", `Maximum ${MAX_IMAGES} images allowed.`); return prev; }
        const slice = valid.slice(0, remaining);
        if (valid.length > remaining) notify("error", `Added ${remaining} of ${valid.length} images (limit: ${MAX_IMAGES}).`);
        const entries: ImageEntry[] = slice.map((f) => ({
          id: `${uid}-${Date.now()}-${Math.random()}`,
          file: f,
          name: f.name,
          size: f.size,
          rotation: 0,
          previewUrl: URL.createObjectURL(f),
        }));
        return [...prev, ...entries];
      });
      setResultBuf(null);
    },
    [notify, uid]
  );

  // ── Drop zone ───────────────────────────────────────────────────────────────
  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDraggingOver(false);
    addImages(e.dataTransfer.files);
  }, [addImages]);

  const onDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); setDraggingOver(true); }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    if (dropRef.current && !dropRef.current.contains(e.relatedTarget as Node)) setDraggingOver(false);
  }, []);

  // ── Image list reorder ──────────────────────────────────────────────────────
  const onItemDragStart = useCallback((e: React.DragEvent, i: number) => {
    setDragIndex(i);
    e.dataTransfer.effectAllowed = "move";
  }, []);

  const onItemDragOver = useCallback((e: React.DragEvent, i: number) => {
    e.preventDefault();
    if (dragIndex !== null && dragIndex !== i) setDragOverIndex(i);
  }, [dragIndex]);

  const onItemDrop = useCallback((e: React.DragEvent, dropIdx: number) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === dropIdx) { setDragIndex(null); setDragOverIndex(null); return; }
    setImages((prev) => {
      const next = [...prev];
      const [moved] = next.splice(dragIndex, 1);
      next.splice(dropIdx, 0, moved);
      return next;
    });
    setDragIndex(null);
    setDragOverIndex(null);
    setResultBuf(null);
  }, [dragIndex]);

  const onItemDragEnd = useCallback(() => { setDragIndex(null); setDragOverIndex(null); }, []);

  // ── Remove / rotate ─────────────────────────────────────────────────────────
  const removeImage = useCallback((id: string) => {
    setImages((prev) => {
      const removed = prev.find((img) => img.id === id);
      if (removed) URL.revokeObjectURL(removed.previewUrl);
      return prev.filter((img) => img.id !== id);
    });
    setResultBuf(null);
  }, []);

  const rotateImage = useCallback((id: string) => {
    setImages((prev) =>
      prev.map((img) => img.id === id ? { ...img, rotation: (img.rotation + 90) % 360 } : img)
    );
    setResultBuf(null);
  }, []);

  // ── Settings helpers ────────────────────────────────────────────────────────
  const set = useCallback(<K extends keyof Settings>(key: K, val: Settings[K]) => {
    setSettings((s) => ({ ...s, [key]: val }));
    setResultBuf(null);
  }, []);

  // ── Generate PDF ─────────────────────────────────────────────────────────────
  const generate = useCallback(async () => {
    if (!images.length) return;
    setGenerating(true);
    setNotif(null);
    try {
      const buf = await buildPdf(images, settings);
      setResultBuf(buf);
      notify("success", `PDF created — ${images.length} image${images.length !== 1 ? "s" : ""}, ${formatBytes(buf.byteLength)}.`);
    } catch (err) {
      notify("error", err instanceof Error ? err.message : "PDF generation failed.");
    } finally {
      setGenerating(false);
    }
  }, [images, settings, notify]);

  // ── Download ────────────────────────────────────────────────────────────────
  const download = useCallback(() => {
    if (!resultBuf) return;
    downloadBlob(new Blob([resultBuf], { type: "application/pdf" }), "images.pdf");
  }, [resultBuf]);

  // ── Reset ───────────────────────────────────────────────────────────────────
  const reset = useCallback(() => {
    setImages((prev) => { prev.forEach((img) => URL.revokeObjectURL(img.previewUrl)); return []; });
    setResultBuf(null);
    setNotif(null);
    if (inputRef.current) inputRef.current.value = "";
  }, []);

  const totalSize = images.reduce((s, img) => s + img.size, 0);

  return (
    <div className="mb-12 flex flex-col gap-6">

      {/* ── Drop zone (shown when no images OR as add-more area) ── */}
      <div
        ref={dropRef}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        aria-label="Upload images — click or drag and drop"
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") inputRef.current?.click(); }}
        className="glass-panel rounded-2xl flex flex-col items-center justify-center gap-4 cursor-pointer transition-all duration-300 select-none outline-none focus-visible:ring-2 focus-visible:ring-[#ddb7ff]"
        style={{
          padding: images.length ? "20px" : "56px 40px",
          border: `2px dashed ${draggingOver ? "#ddb7ff" : "rgba(255,255,255,0.12)"}`,
          background: draggingOver ? "rgba(221,183,255,0.06)" : undefined,
          transform: draggingOver ? "scale(1.01)" : "scale(1)",
        }}
      >
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-300"
          style={{
            background: draggingOver ? "rgba(221,183,255,0.2)" : "rgba(255,180,171,0.1)",
            border: `1px solid ${draggingOver ? "rgba(221,183,255,0.4)" : "rgba(255,180,171,0.2)"}`,
          }}
        >
          <span
            className="material-symbols-outlined text-[28px] transition-colors duration-300"
            style={{ color: draggingOver ? "#ddb7ff" : "#ffb4ab" }}
            aria-hidden="true"
          >
            {draggingOver ? "file_download" : "add_photo_alternate"}
          </span>
        </div>
        <div className="text-center">
          <p className="text-[16px] font-bold text-[#e2e2e2] mb-0.5">
            {draggingOver ? "Drop images here" : images.length ? "Add more images" : "Drag & drop images here"}
          </p>
          <p className="text-[13px] text-[#988d9f]">
            or <span className="text-[#ddb7ff] font-semibold">click to browse</span>
            {!images.length && " — JPG, PNG, WEBP · up to 50 images · 20 MB each"}
          </p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
          multiple
          className="sr-only"
          onChange={(e) => { if (e.target.files) addImages(e.target.files); }}
          aria-hidden="true"
          tabIndex={-1}
        />
      </div>

      {/* ── Notification ── */}
      {notif && (
        <div
          role="alert"
          className="flex items-center gap-3 px-5 py-4 rounded-xl text-[14px] font-medium"
          style={{
            background: notif.type === "success" ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)",
            border: `1px solid ${notif.type === "success" ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`,
            color: notif.type === "success" ? "#22c55e" : "#ef4444",
          }}
        >
          <span className="material-symbols-outlined text-[20px]">
            {notif.type === "success" ? "check_circle" : "error"}
          </span>
          <span className="flex-1">{notif.message}</span>
          <button onClick={() => setNotif(null)} aria-label="Dismiss" className="opacity-60 hover:opacity-100 transition-opacity">
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
      )}

      {/* ── Image grid ── */}
      {images.length > 0 && (
        <div className="glass-panel rounded-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-[rgba(255,255,255,0.06)]">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-[18px] text-[#ffb4ab]">photo_library</span>
              <span className="text-[15px] font-bold text-[#e2e2e2]">
                {images.length} image{images.length !== 1 ? "s" : ""}
              </span>
              <span className="text-[12px] text-[#988d9f]">· {formatBytes(totalSize)}</span>
            </div>
            <button
              onClick={reset}
              className="text-[12px] text-[#4d4354] hover:text-[#ef4444] transition-colors flex items-center gap-1"
              aria-label="Remove all images"
            >
              <span className="material-symbols-outlined text-[16px]">delete_sweep</span>
              Clear all
            </button>
          </div>

          {/* Hint */}
          <div className="px-5 py-2 bg-[rgba(255,255,255,0.02)] border-b border-[rgba(255,255,255,0.04)]">
            <p className="text-[11px] text-[#4d4354] flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[13px]">info</span>
              Drag thumbnails to reorder · hover to rotate or remove
            </p>
          </div>

          {/* Grid */}
          <ol
            className="grid gap-3 p-5"
            style={{ gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))" }}
            aria-label="Images to convert"
          >
            {images.map((img, i) => (
              <ImageThumb
                key={img.id}
                entry={img}
                index={i}
                dragIndex={dragIndex}
                dragOverIndex={dragOverIndex}
                onDragStart={onItemDragStart}
                onDragOver={onItemDragOver}
                onDrop={onItemDrop}
                onDragEnd={onItemDragEnd}
                onRemove={removeImage}
                onRotate={rotateImage}
              />
            ))}
          </ol>
        </div>
      )}

      {/* ── Settings ── */}
      {images.length > 0 && (
        <div className="glass-panel rounded-2xl p-5 flex flex-col gap-5">
          <p className="text-[13px] font-semibold text-[#988d9f] uppercase tracking-[0.08em]">PDF Settings</p>

          {/* Page size */}
          <div className="flex flex-col gap-2">
            <p className="text-[13px] font-semibold text-[#e2e2e2]">Page size</p>
            <div className="flex flex-wrap gap-2">
              {(["A4", "Letter", "Legal", "Auto"] as PageSizeKey[]).map((s) => (
                <Chip key={s} active={settings.pageSize === s} onClick={() => set("pageSize", s)}>
                  {s === "Auto" ? "Auto (match image)" : s}
                </Chip>
              ))}
            </div>
          </div>

          {/* Orientation */}
          <div className="flex flex-col gap-2">
            <p className="text-[13px] font-semibold text-[#e2e2e2]">Orientation</p>
            <div className="flex flex-wrap gap-2">
              {([
                { id: "portrait", label: "Portrait", icon: "crop_portrait" },
                { id: "landscape", label: "Landscape", icon: "crop_landscape" },
              ] as { id: Orientation; label: string; icon: string }[]).map((o) => (
                <Chip key={o.id} active={settings.orientation === o.id} onClick={() => set("orientation", o.id)}>
                  <span className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[14px]">{o.icon}</span>
                    {o.label}
                  </span>
                </Chip>
              ))}
            </div>
          </div>

          {/* Margin */}
          <div className="flex flex-col gap-2">
            <p className="text-[13px] font-semibold text-[#e2e2e2]">Margins</p>
            <div className="flex flex-wrap gap-2">
              {([
                { id: "none", label: "None" },
                { id: "small", label: "Small" },
                { id: "medium", label: "Medium" },
                { id: "large", label: "Large" },
              ] as { id: MarginKey; label: string }[]).map((m) => (
                <Chip key={m.id} active={settings.margin === m.id} onClick={() => set("margin", m.id)}>
                  {m.label}
                </Chip>
              ))}
            </div>
          </div>

          {/* Layout */}
          <div className="flex flex-col gap-2">
            <p className="text-[13px] font-semibold text-[#e2e2e2]">Images per page</p>
            <div className="flex flex-wrap gap-2">
              {([
                { id: "one", label: "1 per page", icon: "crop_square" },
                { id: "two", label: "2 per page", icon: "view_agenda" },
                { id: "four", label: "4 per page", icon: "grid_view" },
              ] as { id: LayoutKey; label: string; icon: string }[]).map((l) => (
                <Chip key={l.id} active={settings.layout === l.id} onClick={() => set("layout", l.id)}>
                  <span className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[14px]">{l.icon}</span>
                    {l.label}
                  </span>
                </Chip>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Generate button ── */}
      {images.length > 0 && !generating && (
        <button
          onClick={generate}
          className="btn-primary w-full text-white font-bold text-[16px] py-4 rounded-xl flex items-center justify-center gap-3 transition-all"
        >
          <span className="material-symbols-outlined text-[20px]">picture_as_pdf</span>
          Convert {images.length} Image{images.length !== 1 ? "s" : ""} to PDF
        </button>
      )}

      {/* ── Generating state ── */}
      {generating && (
        <div
          className="glass-panel rounded-2xl p-5 flex items-center gap-4"
          aria-live="polite"
          aria-busy="true"
        >
          <span className="w-5 h-5 border-2 border-[#ddb7ff]/30 border-t-[#ddb7ff] rounded-full animate-spin flex-shrink-0" />
          <p className="text-[15px] font-semibold text-[#e2e2e2]">
            Generating PDF… processing {images.length} image{images.length !== 1 ? "s" : ""}
          </p>
        </div>
      )}

      {/* ── Result ── */}
      {resultBuf && !generating && (
        <div className="glass-panel rounded-2xl overflow-hidden">
          <div className="flex items-center gap-4 px-5 py-4 border-b border-[rgba(255,255,255,0.06)]">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.25)" }}
            >
              <span className="material-symbols-outlined text-[20px] text-[#22c55e]">check_circle</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-bold text-[#e2e2e2]">PDF ready</p>
              <p className="text-[12px] text-[#988d9f]">
                {images.length} image{images.length !== 1 ? "s" : ""} · {formatBytes(resultBuf.byteLength)}
              </p>
            </div>
          </div>
          <div className="p-5 flex flex-col sm:flex-row gap-3">
            <button
              onClick={download}
              className="btn-primary flex-1 text-white font-bold text-[15px] py-3.5 rounded-xl flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-[18px]">download</span>
              Download PDF
            </button>
            <button
              onClick={() => setResultBuf(null)}
              className="flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl text-[14px] font-semibold text-[#988d9f] hover:text-[#e2e2e2] transition-all"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              <span className="material-symbols-outlined text-[16px]">tune</span>
              Change Settings
            </button>
          </div>
        </div>
      )}

      {/* ── Empty state ── */}
      {!images.length && (
        <div className="glass-panel rounded-2xl p-10 flex flex-col items-center justify-center gap-4 text-center">
          <span className="material-symbols-outlined text-[52px] text-[#4d4354]">picture_as_pdf</span>
          <div>
            <p className="text-[16px] font-semibold text-[#4d4354]">No images added yet</p>
            <p className="text-[13px] text-[#3a3040] mt-1">Upload JPG, PNG or WEBP images to convert them to PDF</p>
          </div>
        </div>
      )}
    </div>
  );
}
