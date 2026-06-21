"use client";

/**
 * Universal Image Converter — browser-local batch image conversion
 *
 * Output format support:
 *   JPG / PNG / WebP / AVIF  → canvas.toBlob (native)
 *   BMP                       → pure-JS 24-bit BMP encoder
 *   ICO                       → pure-JS PNG-in-ICO encoder
 *
 * Input format support (whatever the browser Image element can decode):
 *   JPG, PNG, WebP, AVIF, BMP, GIF (first frame), ICO
 */

import { useState, useRef, useCallback, useEffect } from "react";

// ── Constants ─────────────────────────────────────────────────────────────────
const MAX_FILE_BYTES = 50 * 1024 * 1024;
const ACCEPTED_TYPES = [
  "image/jpeg", "image/png", "image/webp", "image/avif",
  "image/bmp", "image/gif", "image/x-icon", "image/vnd.microsoft.icon",
];
const ACCEPTED_EXT = ".jpg,.jpeg,.png,.webp,.avif,.bmp,.gif,.ico";

// ── Types ─────────────────────────────────────────────────────────────────────
type OutFormat  = "jpg" | "png" | "webp" | "avif" | "bmp" | "ico";
type ItemState  = "pending" | "converting" | "done" | "error";
type NotifType  = "success" | "error" | "info";

interface ImageItem {
  id:         string;
  file:       File;
  srcUrl:     string;
  w:          number;
  h:          number;
  state:      ItemState;
  resultBlob: Blob | null;
  resultUrl:  string | null;
  error:      string | null;
}

const FORMAT_LABELS: Record<OutFormat, string> = {
  jpg: "JPG", png: "PNG", webp: "WebP", avif: "AVIF", bmp: "BMP", ico: "ICO",
};

const FORMAT_MIME: Record<OutFormat, string> = {
  jpg: "image/jpeg", png: "image/png", webp: "image/webp",
  avif: "image/avif", bmp: "image/bmp", ico: "image/x-icon",
};

// ── Pure-JS BMP encoder (24-bit, no alpha) ────────────────────────────────────
function encodeBmp(canvas: HTMLCanvasElement): Blob {
  const w = canvas.width;
  const h = canvas.height;
  const ctx = canvas.getContext("2d")!;
  const data = ctx.getImageData(0, 0, w, h).data;

  // Row stride padded to 4-byte boundary (3 bytes/px, BGR order)
  const rowStride = Math.ceil((w * 3) / 4) * 4;
  const pixelSize = rowStride * h;
  const buf       = new ArrayBuffer(54 + pixelSize);
  const v         = new DataView(buf);
  const u8        = new Uint8Array(buf);

  // File header
  u8[0] = 0x42; u8[1] = 0x4d;               // 'BM'
  v.setUint32(2,  54 + pixelSize, true);     // file size
  v.setUint32(10, 54, true);                 // pixel data offset

  // BITMAPINFOHEADER
  v.setUint32(14, 40,  true);                // header size
  v.setInt32 (18,  w,  true);                // width
  v.setInt32 (22, -h,  true);                // height negative → top-down
  v.setUint16(26,  1,  true);                // colour planes
  v.setUint16(28, 24,  true);                // bits per pixel
  v.setUint32(34, pixelSize, true);          // image size

  // Pixel data (BGR, top-down because of negative height)
  let off = 54;
  for (let row = 0; row < h; row++) {
    for (let col = 0; col < w; col++) {
      const i = (row * w + col) * 4;
      u8[off++] = data[i + 2]; // B
      u8[off++] = data[i + 1]; // G
      u8[off++] = data[i + 0]; // R
    }
    off += rowStride - w * 3; // row padding
  }

  return new Blob([buf], { type: "image/bmp" });
}

// ── Pure-JS ICO encoder (PNG-in-ICO, max 256×256) ────────────────────────────
async function encodeIco(canvas: HTMLCanvasElement): Promise<Blob> {
  // Resize to max 256×256 if needed
  let src: HTMLCanvasElement = canvas;
  if (canvas.width > 256 || canvas.height > 256) {
    const scale = Math.min(256 / canvas.width, 256 / canvas.height);
    src = document.createElement("canvas");
    src.width  = Math.round(canvas.width  * scale);
    src.height = Math.round(canvas.height * scale);
    src.getContext("2d")!.drawImage(canvas, 0, 0, src.width, src.height);
  }

  const pngBlob  = await new Promise<Blob>((res, rej) =>
    src.toBlob(b => b ? res(b) : rej(new Error("PNG export failed")), "image/png"),
  );
  const pngBytes = new Uint8Array(await pngBlob.arrayBuffer());
  const icoW     = src.width  >= 256 ? 0 : src.width;
  const icoH     = src.height >= 256 ? 0 : src.height;

  // ICONDIR (6) + ICONDIRENTRY (16) + PNG bytes
  const buf = new ArrayBuffer(22 + pngBytes.length);
  const v   = new DataView(buf);
  const u8  = new Uint8Array(buf);

  v.setUint16(0, 0, true); // reserved
  v.setUint16(2, 1, true); // type: ICO
  v.setUint16(4, 1, true); // image count

  v.setUint8 (6,  icoW);              // width  (0 = 256)
  v.setUint8 (7,  icoH);              // height (0 = 256)
  v.setUint8 (8,  0);                 // colour count
  v.setUint8 (9,  0);                 // reserved
  v.setUint16(10, 1,  true);          // colour planes
  v.setUint16(12, 32, true);          // bits per pixel
  v.setUint32(14, pngBytes.length, true); // data size
  v.setUint32(18, 22, true);          // data offset

  u8.set(pngBytes, 22);
  return new Blob([buf], { type: "image/x-icon" });
}

// ── Main conversion function ───────────────────────────────────────────────────
async function convertImage(
  srcUrl: string,
  format: OutFormat,
  quality: number,
): Promise<Blob> {
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image();
    i.onload  = () => res(i);
    i.onerror = rej;
    i.src = srcUrl;
  });

  const canvas = document.createElement("canvas");
  canvas.width  = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d")!;

  // White background for formats that don't support transparency
  if (format === "jpg" || format === "bmp") {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.drawImage(img, 0, 0);

  if (format === "bmp") return encodeBmp(canvas);
  if (format === "ico") return encodeIco(canvas);

  return new Promise<Blob>((res, rej) =>
    canvas.toBlob(
      b => b ? res(b) : rej(new Error("Conversion failed")),
      FORMAT_MIME[format],
      format === "png" ? undefined : quality / 100,
    ),
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function uid()    { return Math.random().toString(36).slice(2, 10); }
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

// ── Main Component ────────────────────────────────────────────────────────────
export default function ImageConverterTool() {
  const [items,      setItems]      = useState<ImageItem[]>([]);
  const [format,     setFormat]     = useState<OutFormat>("jpg");
  const [quality,    setQuality]    = useState(92);
  const [converting, setConverting] = useState(false);
  const [dragging,   setDragging]   = useState(false);
  const [notif,      setNotif]      = useState<{ type: NotifType; msg: string } | null>(null);

  const dropRef  = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const notify = useCallback((type: NotifType, msg: string) => {
    setNotif({ type, msg });
    if (type !== "info") setTimeout(() => setNotif(null), 8000);
  }, []);

  // ── Load files ──────────────────────────────────────────────────────────────
  const loadFiles = useCallback(async (files: File[]) => {
    const valid: ImageItem[] = [];
    const bad: string[] = [];

    for (const file of files) {
      const ok = ACCEPTED_TYPES.includes(file.type) ||
        /\.(jpg|jpeg|png|webp|avif|bmp|gif|ico)$/i.test(file.name);
      if (!ok) { bad.push(file.name); continue; }
      if (file.size > MAX_FILE_BYTES) { bad.push(`${file.name} (too large)`); continue; }

      const srcUrl = URL.createObjectURL(file);
      const dims   = await new Promise<{ w: number; h: number }>(res => {
        const img = new Image();
        img.onload  = () => res({ w: img.naturalWidth, h: img.naturalHeight });
        img.onerror = () => res({ w: 0, h: 0 });
        img.src = srcUrl;
      });

      valid.push({ id: uid(), file, srcUrl, w: dims.w, h: dims.h,
        state: "pending", resultBlob: null, resultUrl: null, error: null });
    }

    if (bad.length > 0) notify("error", `Skipped: ${bad.slice(0, 3).join(", ")}${bad.length > 3 ? ` +${bad.length - 3} more` : ""}`);
    if (valid.length > 0) {
      setItems(prev => [...prev, ...valid]);
      setNotif(null);
    }
  }, [notify]);

  // ── Drop zone ───────────────────────────────────────────────────────────────
  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    loadFiles(Array.from(e.dataTransfer.files));
  }, [loadFiles]);

  const onDragOver  = useCallback((e: React.DragEvent) => { e.preventDefault(); setDragging(true); }, []);
  const onDragLeave = useCallback((e: React.DragEvent) => {
    if (dropRef.current && !dropRef.current.contains(e.relatedTarget as Node)) setDragging(false);
  }, []);

  // ── Convert all ─────────────────────────────────────────────────────────────
  const convertAll = useCallback(async () => {
    const pending = items.filter(it => it.state === "pending" || it.state === "error");
    if (pending.length === 0) return;
    setConverting(true);

    for (const item of pending) {
      setItems(prev => prev.map(it => it.id === item.id ? { ...it, state: "converting" } : it));
      try {
        const blob   = await convertImage(item.srcUrl, format, quality);
        const resUrl = URL.createObjectURL(blob);
        setItems(prev => prev.map(it => it.id === item.id
          ? { ...it, state: "done", resultBlob: blob, resultUrl: resUrl, error: null }
          : it));
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Conversion failed";
        setItems(prev => prev.map(it => it.id === item.id
          ? { ...it, state: "error", error: msg }
          : it));
      }
    }

    setConverting(false);
    notify("success", `Converted ${pending.length} image${pending.length !== 1 ? "s" : ""} to ${FORMAT_LABELS[format]}.`);
  }, [items, format, quality, notify]);

  // ── Download single ──────────────────────────────────────────────────────────
  const downloadOne = useCallback((item: ImageItem) => {
    if (!item.resultBlob) return;
    downloadBlob(item.resultBlob, `${baseName(item.file.name)}.${format}`);
  }, [format]);

  // ── Download all as ZIP ──────────────────────────────────────────────────────
  const downloadAll = useCallback(async () => {
    const done = items.filter(it => it.state === "done" && it.resultBlob);
    if (done.length === 0) return;
    if (done.length === 1) { downloadOne(done[0]); return; }
    try {
      const JSZip = (await import("jszip")).default;
      const zip   = new JSZip();
      done.forEach(it => zip.file(`${baseName(it.file.name)}.${format}`, it.resultBlob!));
      const blob  = await zip.generateAsync({ type: "blob" });
      downloadBlob(blob, `image-converter-${FORMAT_LABELS[format]}.zip`);
    } catch {
      notify("error", "Failed to create ZIP.");
    }
  }, [items, format, downloadOne, notify]);

  // ── Remove item ──────────────────────────────────────────────────────────────
  const removeItem = useCallback((id: string) => {
    setItems(prev => {
      const item = prev.find(it => it.id === id);
      if (item) {
        URL.revokeObjectURL(item.srcUrl);
        if (item.resultUrl) URL.revokeObjectURL(item.resultUrl);
      }
      return prev.filter(it => it.id !== id);
    });
  }, []);

  // ── Re-convert a single item (e.g. after format/quality change) ──────────────
  const reconvertOne = useCallback(async (item: ImageItem) => {
    setItems(prev => prev.map(it => it.id === item.id ? { ...it, state: "converting", error: null } : it));
    try {
      if (item.resultUrl) URL.revokeObjectURL(item.resultUrl);
      const blob   = await convertImage(item.srcUrl, format, quality);
      const resUrl = URL.createObjectURL(blob);
      setItems(prev => prev.map(it => it.id === item.id
        ? { ...it, state: "done", resultBlob: blob, resultUrl: resUrl, error: null }
        : it));
    } catch (err) {
      setItems(prev => prev.map(it => it.id === item.id
        ? { ...it, state: "error", error: err instanceof Error ? err.message : "Failed" }
        : it));
    }
  }, [format, quality]);

  // ── Clear all ────────────────────────────────────────────────────────────────
  const clearAll = useCallback(() => {
    items.forEach(it => {
      URL.revokeObjectURL(it.srcUrl);
      if (it.resultUrl) URL.revokeObjectURL(it.resultUrl);
    });
    setItems([]);
    setNotif(null);
    if (inputRef.current) inputRef.current.value = "";
  }, [items]);

  // Cleanup on unmount
  useEffect(() => () => {
    items.forEach(it => {
      URL.revokeObjectURL(it.srcUrl);
      if (it.resultUrl) URL.revokeObjectURL(it.resultUrl);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derived ─────────────────────────────────────────────────────────────────
  const doneCount    = items.filter(it => it.state === "done").length;
  const pendingCount = items.filter(it => it.state === "pending" || it.state === "error").length;
  const totalOriginalSize = items.reduce((s, it) => s + it.file.size, 0);
  const totalResultSize   = items.filter(it => it.resultBlob).reduce((s, it) => s + (it.resultBlob?.size ?? 0), 0);
  const savingsPct = totalOriginalSize > 0 && totalResultSize > 0
    ? Math.round((1 - totalResultSize / totalOriginalSize) * 100)
    : null;
  const lossless = format === "png" || format === "bmp" || format === "ico";

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="mb-12 flex flex-col gap-6">

      {/* ── Drop zone ─────────────────────────────────────────────────────────── */}
      <div ref={dropRef}
        onDrop={onDrop} onDragOver={onDragOver} onDragLeave={onDragLeave}
        onClick={() => inputRef.current?.click()}
        role="button" tabIndex={0} aria-label="Upload images to convert"
        onKeyDown={e => { if (e.key === "Enter" || e.key === " ") inputRef.current?.click(); }}
        className="glass-panel rounded-2xl flex flex-col items-center justify-center gap-4 cursor-pointer transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-[#4cd7f6]"
        style={{
          padding: items.length > 0 ? "28px 40px" : "52px 40px",
          border: `2px dashed ${dragging ? "#4cd7f6" : "rgba(255,255,255,0.12)"}`,
          background: dragging ? "rgba(76,215,246,0.05)" : undefined,
        }}>
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 transition-transform duration-200"
            style={{ background: "rgba(76,215,246,0.1)", transform: dragging ? "scale(1.1)" : "scale(1)" }}>
            <span className="material-symbols-outlined text-[28px]" style={{ color: "#4cd7f6" }}>
              {dragging ? "file_download" : "swap_horiz"}
            </span>
          </div>
          <div>
            <p className="font-semibold text-base" style={{ color: "#e8dff0" }}>
              {dragging ? "Drop images here" : items.length > 0 ? "Drop more images to add" : "Drag & drop images here"}
            </p>
            <p className="text-sm mt-0.5" style={{ color: "#988d9f" }}>
              or <span style={{ color: "#4cd7f6" }}>click to browse</span> — JPG, PNG, WebP, AVIF, BMP, GIF, ICO · max 50 MB each
            </p>
          </div>
        </div>
        {items.length === 0 && (
          <div className="flex flex-wrap justify-center gap-2 mt-1">
            {["JPG","PNG","WebP","AVIF","BMP","GIF","ICO","Batch","Browser-local"].map(tag => (
              <span key={tag} className="px-2.5 py-1 rounded-lg text-[11px] font-semibold"
                style={{ background: "rgba(76,215,246,0.08)", color: "#4cd7f6", border: "1px solid rgba(76,215,246,0.15)" }}>
                {tag}
              </span>
            ))}
          </div>
        )}
        <input ref={inputRef} type="file" accept={ACCEPTED_EXT} multiple className="sr-only"
          onChange={e => { if (e.target.files) loadFiles(Array.from(e.target.files)); e.target.value = ""; }}
          aria-hidden tabIndex={-1} />
      </div>

      {/* ── Notification ──────────────────────────────────────────────────────── */}
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

      {items.length > 0 && (
        <>
          {/* ── Settings panel ────────────────────────────────────────────────── */}
          <div className="glass-panel rounded-2xl p-5 flex flex-col gap-5"
            style={{ border: "1px solid rgba(255,255,255,0.06)" }}>

            {/* Format selector */}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest mb-3" style={{ color: "#988d9f" }}>
                Convert all to
              </p>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(FORMAT_LABELS) as OutFormat[]).map(f => (
                  <button key={f} onClick={() => setFormat(f)} aria-pressed={format === f}
                    className="px-4 py-2 rounded-xl text-[13px] font-bold transition-all"
                    style={{
                      background: format === f ? "rgba(76,215,246,0.15)" : "rgba(255,255,255,0.04)",
                      color:      format === f ? "#4cd7f6"               : "#988d9f",
                      border:     `1px solid ${format === f ? "rgba(76,215,246,0.35)" : "rgba(255,255,255,0.08)"}`,
                    }}>
                    {FORMAT_LABELS[f]}
                  </button>
                ))}
              </div>
            </div>

            {/* Quality slider */}
            <div>
              <div className="flex justify-between mb-2">
                <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "#988d9f" }}>
                  Quality{lossless ? " (lossless)" : ""}
                </p>
                <span className="text-[11px] font-bold tabular-nums" style={{ color: "#4cd7f6" }}>
                  {lossless ? "—" : quality}
                </span>
              </div>
              <input type="range" min={1} max={100} value={quality}
                onChange={e => setQuality(Number(e.target.value))}
                disabled={lossless}
                aria-label="Output quality"
                className="w-full h-2 rounded-full appearance-none cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                style={{
                  background: !lossless
                    ? `linear-gradient(to right, #4cd7f6 ${quality}%, rgba(255,255,255,0.1) ${quality}%)`
                    : "rgba(255,255,255,0.1)",
                  accentColor: "#4cd7f6",
                }} />
              {!lossless && (
                <div className="flex justify-between mt-1">
                  <span className="text-[10px]" style={{ color: "#4d4354" }}>Smaller file</span>
                  <span className="text-[10px]" style={{ color: "#4d4354" }}>Higher quality</span>
                </div>
              )}
            </div>
          </div>

          {/* ── Stats bar ─────────────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Images",         value: items.length.toString(),            icon: "image",    accent: false },
              { label: "Converted",      value: `${doneCount} / ${items.length}`,  icon: "check",    accent: doneCount > 0 },
              { label: "Original size",  value: fmt(totalOriginalSize),             icon: "folder",   accent: false },
              { label: savingsPct !== null ? (savingsPct >= 0 ? `${savingsPct}% smaller` : `${Math.abs(savingsPct)}% larger`) : "Output size",
                value: totalResultSize > 0 ? fmt(totalResultSize) : "—",            icon: "download", accent: totalResultSize > 0 },
            ].map(({ label, value, icon, accent }) => (
              <div key={label} className="glass-panel rounded-2xl p-4 flex flex-col gap-1"
                style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
                <span className="material-symbols-outlined text-[16px]" style={{ color: accent ? "#4cd7f6" : "#988d9f" }}>{icon}</span>
                <p className="text-lg font-bold tabular-nums leading-tight" style={{ color: accent ? "#4cd7f6" : "#e8dff0" }}>{value}</p>
                <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#988d9f" }}>{label}</p>
              </div>
            ))}
          </div>

          {/* ── Convert button ────────────────────────────────────────────────── */}
          {pendingCount > 0 && (
            <button onClick={convertAll} disabled={converting}
              className="btn-primary flex items-center justify-center gap-2 py-4 rounded-2xl font-bold text-base disabled:opacity-50 disabled:cursor-not-allowed">
              {converting ? (
                <><span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Converting…</>
              ) : (
                <><span className="material-symbols-outlined text-[20px]">swap_horiz</span>
                  Convert {pendingCount} Image{pendingCount !== 1 ? "s" : ""} to {FORMAT_LABELS[format]}</>
              )}
            </button>
          )}

          {/* ── Image cards ───────────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {items.map(item => {
              const savings = item.resultBlob
                ? Math.round((1 - item.resultBlob.size / item.file.size) * 100)
                : null;

              return (
                <div key={item.id} className="glass-panel rounded-2xl overflow-hidden flex flex-col"
                  style={{ border: "1px solid rgba(255,255,255,0.06)" }}>

                  {/* Preview row */}
                  <div className="flex divide-x divide-white/5">
                    {/* Original */}
                    <div className="flex-1 relative">
                      <div className="aspect-video bg-[#1a1a2e] overflow-hidden flex items-center justify-center"
                        style={{
                          backgroundImage: "linear-gradient(45deg,#2a2a3a 25%,transparent 25%),linear-gradient(-45deg,#2a2a3a 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#2a2a3a 75%),linear-gradient(-45deg,transparent 75%,#2a2a3a 75%)",
                          backgroundSize: "12px 12px",
                          backgroundPosition: "0 0,0 6px,6px -6px,-6px 0",
                          backgroundColor: "#1e1e2e",
                        }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={item.srcUrl} alt={item.file.name}
                          className="max-w-full max-h-full object-contain"
                          draggable={false} />
                      </div>
                      <div className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded-md text-[10px] font-bold"
                        style={{ background: "rgba(0,0,0,0.7)", color: "#ccc" }}>
                        {item.file.name.split(".").pop()?.toUpperCase() ?? "IMG"}
                      </div>
                    </div>

                    {/* Result */}
                    <div className="flex-1 relative">
                      <div className="aspect-video bg-[#1a1a2e] overflow-hidden flex items-center justify-center"
                        style={{
                          backgroundImage: format === "png" || format === "ico"
                            ? "linear-gradient(45deg,#2a2a3a 25%,transparent 25%),linear-gradient(-45deg,#2a2a3a 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#2a2a3a 75%),linear-gradient(-45deg,transparent 75%,#2a2a3a 75%)"
                            : undefined,
                          backgroundSize: "12px 12px",
                          backgroundPosition: "0 0,0 6px,6px -6px,-6px 0",
                          backgroundColor: "#1e1e2e",
                        }}>
                        {item.resultUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={item.resultUrl} alt="Converted"
                            className="max-w-full max-h-full object-contain"
                            draggable={false} />
                        ) : item.state === "converting" ? (
                          <span className="w-6 h-6 border-2 border-[#4cd7f6]/30 border-t-[#4cd7f6] rounded-full animate-spin" />
                        ) : item.state === "error" ? (
                          <div className="flex flex-col items-center gap-1 px-3 text-center">
                            <span className="material-symbols-outlined text-[22px] text-red-400">error</span>
                            <p className="text-[10px] text-red-400">{item.error}</p>
                          </div>
                        ) : (
                          <span className="material-symbols-outlined text-[28px]" style={{ color: "#4d4354" }}>image</span>
                        )}
                      </div>
                      <div className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded-md text-[10px] font-bold"
                        style={{ background: "rgba(0,0,0,0.7)", color: item.resultUrl ? "#4cd7f6" : "#555" }}>
                        {FORMAT_LABELS[format]}
                      </div>
                      {savings !== null && (
                        <div className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded-md text-[10px] font-bold"
                          style={{
                            background: "rgba(0,0,0,0.7)",
                            color: savings >= 0 ? "#80e0a0" : "#ff8080",
                          }}>
                          {savings >= 0 ? `−${savings}%` : `+${Math.abs(savings)}%`}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Info row */}
                  <div className="px-3 py-2.5 flex items-center gap-2">
                    {/* Status icon */}
                    <span className="shrink-0 w-5 flex items-center justify-center">
                      {item.state === "done"      && <span className="material-symbols-outlined text-[16px] text-green-400">check_circle</span>}
                      {item.state === "converting"&& <span className="w-4 h-4 border-2 border-[#4cd7f6]/30 border-t-[#4cd7f6] rounded-full animate-spin" />}
                      {item.state === "error"     && <span className="material-symbols-outlined text-[16px] text-red-400">error</span>}
                      {item.state === "pending"   && <span className="material-symbols-outlined text-[16px]" style={{ color: "#4d4354" }}>hourglass_empty</span>}
                    </span>

                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-semibold truncate" style={{ color: "#e8dff0" }}>{item.file.name}</p>
                      <p className="text-[10px]" style={{ color: "#5a4d63" }}>
                        {item.w > 0 ? `${item.w}×${item.h} · ` : ""}{fmt(item.file.size)}
                        {item.resultBlob && ` → ${fmt(item.resultBlob.size)}`}
                      </p>
                    </div>

                    {/* Per-item actions */}
                    <div className="flex gap-1.5 shrink-0">
                      {item.state === "done" && (
                        <button onClick={() => downloadOne(item)} aria-label={`Download ${baseName(item.file.name)}.${format}`}
                          className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-semibold transition-all"
                          style={{ background: "rgba(76,215,246,0.1)", color: "#4cd7f6", border: "1px solid rgba(76,215,246,0.2)" }}>
                          <span className="material-symbols-outlined text-[13px]">download</span>
                          {FORMAT_LABELS[format]}
                        </button>
                      )}
                      {(item.state === "done" || item.state === "error") && (
                        <button onClick={() => reconvertOne(item)} aria-label="Re-convert"
                          className="w-7 h-7 flex items-center justify-center rounded-lg transition-all opacity-60 hover:opacity-100"
                          style={{ background: "rgba(255,255,255,0.05)" }}>
                          <span className="material-symbols-outlined text-[13px]" style={{ color: "#988d9f" }}>refresh</span>
                        </button>
                      )}
                      <button onClick={() => removeItem(item.id)} aria-label="Remove"
                        className="w-7 h-7 flex items-center justify-center rounded-lg transition-all opacity-50 hover:opacity-100"
                        style={{ background: "rgba(255,255,255,0.05)" }}>
                        <span className="material-symbols-outlined text-[13px]" style={{ color: "#988d9f" }}>close</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── Action bar ────────────────────────────────────────────────────── */}
          <div className="flex flex-wrap gap-3">
            {doneCount > 0 && (
              <button onClick={downloadAll}
                className="btn-primary flex items-center gap-2 px-6 py-3 rounded-2xl font-bold text-sm flex-1 justify-center">
                <span className="material-symbols-outlined text-[18px]">
                  {doneCount > 1 ? "folder_zip" : "download"}
                </span>
                {doneCount > 1 ? `Download All (${doneCount}) as ZIP` : `Download ${FORMAT_LABELS[format]}`}
              </button>
            )}
            <button onClick={() => inputRef.current?.click()}
              className="flex items-center gap-2 px-5 py-3 rounded-2xl font-semibold text-sm transition-all"
              style={{ background: "rgba(255,255,255,0.05)", color: "#988d9f", border: "1px solid rgba(255,255,255,0.08)" }}>
              <span className="material-symbols-outlined text-[18px]">add_photo_alternate</span>
              Add More
            </button>
            <button onClick={clearAll}
              className="flex items-center gap-2 px-5 py-3 rounded-2xl font-semibold text-sm transition-all"
              style={{ background: "rgba(255,80,80,0.08)", color: "#ff8080", border: "1px solid rgba(255,80,80,0.15)" }}>
              <span className="material-symbols-outlined text-[18px]">delete_sweep</span>
              Clear All
            </button>
          </div>
        </>
      )}

      {/* ── How it works ──────────────────────────────────────────────────────── */}
      {items.length === 0 && (
        <div className="glass-panel rounded-2xl p-6 flex flex-col gap-4">
          <p className="text-[12px] font-semibold text-[#988d9f] uppercase tracking-[0.08em]">How it works</p>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            {[
              { icon: "upload_file",  label: "1. Upload",    desc: "Drop any JPG, PNG, WebP, AVIF, BMP, GIF or ICO" },
              { icon: "tune",         label: "2. Configure", desc: "Choose output format and quality" },
              { icon: "swap_horiz",   label: "3. Convert",   desc: "Batch-convert all files instantly in your browser" },
              { icon: "download",     label: "4. Download",  desc: "Save files individually or all together as a ZIP" },
            ].map(({ icon, label, desc }) => (
              <div key={label} className="flex flex-col gap-2 p-4 rounded-xl"
                style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
                <span className="material-symbols-outlined text-[22px]" style={{ color: "#4cd7f6" }}>{icon}</span>
                <p className="text-[13px] font-bold text-[#e2e2e2]">{label}</p>
                <p className="text-[12px] text-[#5a4d63] leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>

          {/* Format matrix */}
          <div className="mt-2">
            <p className="text-[10px] font-semibold uppercase tracking-widest mb-3" style={{ color: "#988d9f" }}>
              Supported conversions
            </p>
            <div className="flex flex-wrap gap-2">
              {[
                "JPG → PNG","JPG → WebP","JPG → AVIF","JPG → BMP","JPG → ICO",
                "PNG → JPG","PNG → WebP","PNG → AVIF","PNG → BMP","PNG → ICO",
                "WebP → JPG","WebP → PNG","WebP → AVIF",
                "AVIF → JPG","AVIF → PNG","AVIF → WebP",
                "BMP → JPG","BMP → PNG","GIF → JPG","GIF → PNG",
                "ICO → JPG","ICO → PNG",
              ].map(label => (
                <span key={label} className="px-2 py-1 rounded-lg text-[10px] font-semibold"
                  style={{ background: "rgba(255,255,255,0.04)", color: "#5a4d63", border: "1px solid rgba(255,255,255,0.06)" }}>
                  {label}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
