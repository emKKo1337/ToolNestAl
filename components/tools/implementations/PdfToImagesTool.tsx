"use client";

import { useState, useRef, useCallback } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import JSZip from "jszip";

// ─── Constants ────────────────────────────────────────────────────────────────
const MAX_FILE_BYTES = 100 * 1024 * 1024;
const MAX_PAGES = 500;
const THUMB_SCALE = 0.25;
const THUMB_BATCH = 8;

// ─── Types ────────────────────────────────────────────────────────────────────
type ImageFormat = "png" | "jpg" | "webp";
type QualityKey = "low" | "medium" | "high" | "original";
type DpiValue = 72 | 150 | 300;
type ExportMode = "all" | "selected";
type NotifType = "success" | "error" | "info";

const MIME: Record<ImageFormat, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  webp: "image/webp",
};

const QUALITY_VAL: Record<QualityKey, number> = {
  low: 0.60,
  medium: 0.82,
  high: 0.94,
  original: 1.0,
};

const DPI_SCALE: Record<DpiValue, number> = {
  72: 1.0,
  150: 150 / 72,
  300: 300 / 72,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getPdfjs() {
  const lib = await import("pdfjs-dist");
  lib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  return lib;
}

async function renderPageToDataUrl(doc: PDFDocumentProxy, pageNum: number, scale: number): Promise<string> {
  const page = await doc.getPage(pageNum);
  const vp = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(vp.width);
  canvas.height = Math.round(vp.height);
  await page.render({ canvas, viewport: vp }).promise;
  const url = canvas.toDataURL("image/jpeg", 0.7);
  canvas.width = 0;
  canvas.height = 0;
  return url;
}

async function renderPageToBytes(
  doc: PDFDocumentProxy,
  pageNum: number,
  scale: number,
  format: ImageFormat,
  quality: number,
): Promise<Uint8Array> {
  const page = await doc.getPage(pageNum);
  const vp = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(vp.width);
  canvas.height = Math.round(vp.height);

  if (format !== "png") {
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  await page.render({ canvas, viewport: vp }).promise;

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) { reject(new Error(`Page ${pageNum} export failed`)); return; }
        blob.arrayBuffer().then((buf) => {
          canvas.width = 0;
          canvas.height = 0;
          resolve(new Uint8Array(buf));
        }).catch(reject);
      },
      MIME[format],
      format === "png" ? undefined : quality,
    );
  });
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1_048_576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1_048_576).toFixed(2)} MB`;
}

function baseName(filename: string): string {
  return filename.replace(/\.pdf$/i, "");
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

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
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

function PageThumb({
  pageNum, thumbnail, selected, onToggle,
}: {
  pageNum: number;
  thumbnail: string | undefined;
  selected: boolean;
  onToggle: (n: number) => void;
}) {
  return (
    <button
      onClick={() => onToggle(pageNum)}
      aria-pressed={selected}
      aria-label={`Page ${pageNum}${selected ? " (selected)" : ""}`}
      className="flex flex-col items-center gap-1.5 select-none"
    >
      <div
        className="w-14 rounded-lg overflow-hidden relative transition-all duration-150"
        style={{
          height: "72px",
          border: `2px solid ${selected ? "#ddb7ff" : "rgba(255,255,255,0.1)"}`,
          background: "rgba(255,255,255,0.03)",
          boxShadow: selected ? "0 0 12px rgba(221,183,255,0.25)" : undefined,
        }}
      >
        {thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumbnail} alt={`Page ${pageNum}`} className="w-full h-full object-contain" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="w-3.5 h-3.5 border-2 border-[#4d4354] border-t-[#ddb7ff] rounded-full animate-spin" />
          </div>
        )}
        {selected && (
          <div
            className="absolute inset-0 flex items-end justify-end p-0.5"
            style={{ background: "rgba(221,183,255,0.15)" }}
          >
            <div
              className="w-4 h-4 rounded-full flex items-center justify-center"
              style={{ background: "#ddb7ff" }}
            >
              <span className="material-symbols-outlined text-[10px] text-[#1a0d2e]" style={{ fontSize: "10px" }}>check</span>
            </div>
          </div>
        )}
      </div>
      <span
        className="text-[11px] font-semibold tabular-nums transition-colors"
        style={{ color: selected ? "#ddb7ff" : "#988d9f" }}
      >
        {pageNum}
      </span>
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function PdfToImagesTool() {
  const [pdf, setPdf] = useState<{ name: string; size: number; pageCount: number } | null>(null);
  const [thumbnails, setThumbnails] = useState<Map<number, string>>(new Map());
  const [thumbProgress, setThumbProgress] = useState<{ done: number; total: number } | null>(null);
  const [draggingOver, setDraggingOver] = useState(false);
  const [format, setFormat] = useState<ImageFormat>("png");
  const [quality, setQuality] = useState<QualityKey>("high");
  const [dpi, setDpi] = useState<DpiValue>(150);
  const [mode, setMode] = useState<ExportMode>("all");
  const [selectedPages, setSelectedPages] = useState<Set<number>>(new Set());
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<{ done: number; total: number } | null>(null);
  const [notif, setNotif] = useState<{ type: NotifType; message: string } | null>(null);

  const pdfDocRef = useRef<PDFDocumentProxy | null>(null);
  const thumbCancelRef = useRef(false);
  const dropRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const notify = useCallback((type: NotifType, message: string) => {
    setNotif({ type, message });
    if (type !== "info") setTimeout(() => setNotif(null), 8000);
  }, []);

  // ── Load ─────────────────────────────────────────────────────────────────
  const loadFile = useCallback(async (file: File) => {
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      notify("error", `"${file.name}" is not a PDF file.`);
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      notify("error", `"${file.name}" exceeds the 100 MB size limit.`);
      return;
    }

    thumbCancelRef.current = true;
    setExporting(false);
    setExportProgress(null);

    try {
      const pdfjs = await getPdfjs();
      const buf = await file.arrayBuffer();
      const doc = await pdfjs.getDocument({ data: buf }).promise;
      const count = doc.numPages;

      if (count > MAX_PAGES) {
        notify("error", `This PDF has ${count} pages. The limit is ${MAX_PAGES}.`);
        return;
      }

      pdfDocRef.current = doc;

      setPdf({ name: file.name, size: file.size, pageCount: count });
      setThumbnails(new Map());
      setSelectedPages(new Set());
      setNotif(null);

      thumbCancelRef.current = false;
      setThumbProgress({ done: 0, total: count });

      for (let batch = 0; batch < count; batch += THUMB_BATCH) {
        if (thumbCancelRef.current) break;
        const end = Math.min(batch + THUMB_BATCH, count);
        const results = await Promise.all(
          Array.from({ length: end - batch }, (_, j) =>
            renderPageToDataUrl(doc, batch + j + 1, THUMB_SCALE)
              .then((url) => ({ page: batch + j + 1, url }))
              .catch(() => ({ page: batch + j + 1, url: "" })),
          ),
        );
        if (thumbCancelRef.current) break;
        setThumbnails((prev) => {
          const next = new Map(prev);
          results.forEach(({ page, url }) => { if (url) next.set(page, url); });
          return next;
        });
        setThumbProgress({ done: end, total: count });
      }

      if (!thumbCancelRef.current) setThumbProgress(null);
    } catch {
      notify("error", "Could not read this PDF. It may be corrupted or password-protected.");
      thumbCancelRef.current = false;
    }
  }, [notify]);

  // ── Drop zone ─────────────────────────────────────────────────────────────
  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDraggingOver(false);
    const file = e.dataTransfer.files[0];
    if (file) loadFile(file);
  }, [loadFile]);

  const onDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); setDraggingOver(true); }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    if (dropRef.current && !dropRef.current.contains(e.relatedTarget as Node)) setDraggingOver(false);
  }, []);

  // ── Page selection ────────────────────────────────────────────────────────
  const togglePage = useCallback((n: number) => {
    setSelectedPages((prev) => {
      const next = new Set(prev);
      if (next.has(n)) next.delete(n); else next.add(n);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    if (!pdf) return;
    setSelectedPages(new Set(Array.from({ length: pdf.pageCount }, (_, i) => i + 1)));
  }, [pdf]);

  const selectNone = useCallback(() => setSelectedPages(new Set()), []);

  // ── Export ────────────────────────────────────────────────────────────────
  const doExport = useCallback(async (singlePage?: number) => {
    if (!pdf || !pdfDocRef.current) return;
    const doc = pdfDocRef.current;
    const base = baseName(pdf.name);
    const scale = DPI_SCALE[dpi];
    const q = QUALITY_VAL[quality];

    const pages = singlePage
      ? [singlePage]
      : mode === "all"
        ? Array.from({ length: pdf.pageCount }, (_, i) => i + 1)
        : Array.from(selectedPages).sort((a, b) => a - b);

    if (!pages.length) {
      notify("error", "Select at least one page to export.");
      return;
    }

    setExporting(true);
    setExportProgress({ done: 0, total: pages.length });
    setNotif(null);

    try {
      if (pages.length === 1) {
        const bytes = await renderPageToBytes(doc, pages[0], scale, format, q);
        const plainBuf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
        downloadBlob(new Blob([plainBuf], { type: MIME[format] }), `${base}-page-${pages[0]}.${format}`);
        setExportProgress({ done: 1, total: 1 });
        notify("success", `Downloaded page ${pages[0]} as ${format.toUpperCase()}.`);
      } else {
        const zip = new JSZip();
        for (let i = 0; i < pages.length; i++) {
          const bytes = await renderPageToBytes(doc, pages[i], scale, format, q);
          zip.file(`${base}-page-${String(pages[i]).padStart(4, "0")}.${format}`, bytes);
          setExportProgress({ done: i + 1, total: pages.length });
        }
        const blob = await zip.generateAsync({ type: "blob", compression: "STORE" });
        downloadBlob(blob, `${base}-images.zip`);
        notify("success", `Downloaded ${pages.length} images as ZIP (${formatBytes(blob.size)}).`);
      }
    } catch (err) {
      notify("error", err instanceof Error ? err.message : "Export failed.");
    } finally {
      setExporting(false);
      setExportProgress(null);
    }
  }, [pdf, format, quality, dpi, mode, selectedPages, notify]);

  // ── Reset ─────────────────────────────────────────────────────────────────
  const reset = useCallback(() => {
    thumbCancelRef.current = true;
    pdfDocRef.current = null;
    setPdf(null);
    setThumbnails(new Map());
    setThumbProgress(null);
    setSelectedPages(new Set());
    setExporting(false);
    setExportProgress(null);
    setNotif(null);
    if (inputRef.current) inputRef.current.value = "";
  }, []);

  // ── Derived ───────────────────────────────────────────────────────────────
  const exportCount = mode === "all" ? (pdf?.pageCount ?? 0) : selectedPages.size;
  const pct = exportProgress ? Math.round((exportProgress.done / exportProgress.total) * 100) : 0;
  const thumbPct = thumbProgress ? Math.round((thumbProgress.done / thumbProgress.total) * 100) : 0;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="mb-12 flex flex-col gap-6">

      {/* Drop zone */}
      {!pdf && (
        <div
          ref={dropRef}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onClick={() => inputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") inputRef.current?.click(); }}
          className="glass-panel rounded-2xl flex flex-col items-center justify-center gap-4 p-12 cursor-pointer transition-all duration-200"
          style={{
            border: `2px dashed ${draggingOver ? "#ddb7ff" : "rgba(255,255,255,0.12)"}`,
            background: draggingOver ? "rgba(221,183,255,0.06)" : undefined,
            minHeight: "220px",
          }}
        >
          <span className="material-symbols-outlined text-[48px]" style={{ color: "#ffb4ab" }}>picture_as_pdf</span>
          <div className="text-center">
            <p className="font-semibold text-base" style={{ color: "#e8dff0" }}>
              {draggingOver ? "Drop your PDF here" : "Drag & drop a PDF here"}
            </p>
            <p className="text-sm mt-1" style={{ color: "#988d9f" }}>or click to browse — PDF only, max 100 MB, 500 pages</p>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,.pdf"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) loadFile(f); }}
          />
        </div>
      )}

      {/* Notification */}
      {notif && (
        <div
          className="flex items-start gap-3 p-4 rounded-2xl text-sm font-medium"
          style={{
            background: notif.type === "error" ? "rgba(255,100,100,0.1)" : notif.type === "success" ? "rgba(100,220,150,0.1)" : "rgba(76,215,246,0.1)",
            border: `1px solid ${notif.type === "error" ? "rgba(255,100,100,0.25)" : notif.type === "success" ? "rgba(100,220,150,0.25)" : "rgba(76,215,246,0.25)"}`,
            color: notif.type === "error" ? "#ff8080" : notif.type === "success" ? "#80e0a0" : "#4cd7f6",
          }}
        >
          <span className="material-symbols-outlined text-[18px] mt-0.5 shrink-0">
            {notif.type === "error" ? "error" : notif.type === "success" ? "check_circle" : "info"}
          </span>
          <span>{notif.message}</span>
          <button onClick={() => setNotif(null)} className="ml-auto shrink-0 opacity-60 hover:opacity-100 transition-opacity">
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>
      )}

      {/* File header */}
      {pdf && (
        <div
          className="glass-panel rounded-2xl p-4 flex items-center gap-4"
          style={{ border: "1px solid rgba(255,180,171,0.2)" }}
        >
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: "rgba(255,180,171,0.12)" }}
          >
            <span className="material-symbols-outlined text-[20px]" style={{ color: "#ffb4ab" }}>picture_as_pdf</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm truncate" style={{ color: "#e8dff0" }}>{pdf.name}</p>
            <p className="text-xs mt-0.5" style={{ color: "#988d9f" }}>
              {formatBytes(pdf.size)} · {pdf.pageCount} {pdf.pageCount === 1 ? "page" : "pages"}
            </p>
          </div>
          <button
            onClick={reset}
            disabled={exporting}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
            style={{
              background: "rgba(255,255,255,0.06)",
              color: "#988d9f",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <span className="material-symbols-outlined text-[14px]">close</span>
            Remove
          </button>
        </div>
      )}

      {/* Thumbnail loading progress */}
      {thumbProgress && thumbProgress.done < thumbProgress.total && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium" style={{ color: "#988d9f" }}>
              Rendering thumbnails… {thumbProgress.done}/{thumbProgress.total}
            </span>
            <span className="text-xs font-semibold tabular-nums" style={{ color: "#ddb7ff" }}>{thumbPct}%</span>
          </div>
          <div className="h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{ width: `${thumbPct}%`, background: "linear-gradient(90deg,#ddb7ff,#4cd7f6)" }}
            />
          </div>
        </div>
      )}

      {/* Settings */}
      {pdf && (
        <div className="glass-panel rounded-2xl p-5 flex flex-col gap-5" style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
          {/* Format */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "#988d9f" }}>Format</p>
            <div className="flex flex-wrap gap-2">
              {(["png", "jpg", "webp"] as ImageFormat[]).map((f) => (
                <Chip key={f} active={format === f} onClick={() => setFormat(f)}>
                  {f.toUpperCase()}
                </Chip>
              ))}
            </div>
            {format === "png" && (
              <p className="text-xs mt-2" style={{ color: "#988d9f" }}>PNG is lossless — compression quality has no effect.</p>
            )}
          </div>

          {/* DPI + Quality */}
          <div className="flex flex-wrap gap-8">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "#988d9f" }}>DPI</p>
              <div className="flex flex-wrap gap-2">
                {([72, 150, 300] as DpiValue[]).map((d) => (
                  <Chip key={d} active={dpi === d} onClick={() => setDpi(d)}>
                    {d} DPI
                  </Chip>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "#988d9f" }}>
                Quality {format === "png" ? "(lossless)" : ""}
              </p>
              <div className="flex flex-wrap gap-2">
                {(["low", "medium", "high", "original"] as QualityKey[]).map((q) => (
                  <Chip key={q} active={quality === q} onClick={() => setQuality(q)}>
                    {q.charAt(0).toUpperCase() + q.slice(1)}
                  </Chip>
                ))}
              </div>
            </div>
          </div>

          {/* Export scope */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "#988d9f" }}>Pages</p>
            <div className="flex flex-wrap gap-2">
              <Chip active={mode === "all"} onClick={() => setMode("all")}>All pages ({pdf.pageCount})</Chip>
              <Chip active={mode === "selected"} onClick={() => setMode("selected")}>
                Selected {mode === "selected" && selectedPages.size > 0 ? `(${selectedPages.size})` : "pages"}
              </Chip>
            </div>
          </div>
        </div>
      )}

      {/* Page thumbnail grid (selected mode) */}
      {pdf && mode === "selected" && (
        <div className="glass-panel rounded-2xl p-5 flex flex-col gap-4" style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <p className="text-sm font-semibold" style={{ color: "#e8dff0" }}>
              Select pages
              {selectedPages.size > 0 && (
                <span className="ml-2 text-xs font-medium" style={{ color: "#ddb7ff" }}>
                  {selectedPages.size} selected
                </span>
              )}
            </p>
            <div className="flex gap-2">
              <button
                onClick={selectAll}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
                style={{ background: "rgba(221,183,255,0.1)", color: "#ddb7ff", border: "1px solid rgba(221,183,255,0.2)" }}
              >
                Select all
              </button>
              <button
                onClick={selectNone}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
                style={{ background: "rgba(255,255,255,0.05)", color: "#988d9f", border: "1px solid rgba(255,255,255,0.08)" }}
              >
                Clear
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-3 max-h-80 overflow-y-auto pr-1">
            {Array.from({ length: pdf.pageCount }, (_, i) => i + 1).map((n) => (
              <PageThumb
                key={n}
                pageNum={n}
                thumbnail={thumbnails.get(n)}
                selected={selectedPages.has(n)}
                onToggle={togglePage}
              />
            ))}
          </div>
        </div>
      )}

      {/* All-pages thumbnail grid (preview) */}
      {pdf && mode === "all" && thumbnails.size > 0 && (
        <div className="glass-panel rounded-2xl p-5 flex flex-col gap-3" style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
          <p className="text-sm font-semibold" style={{ color: "#e8dff0" }}>Page preview</p>
          <div className="flex flex-wrap gap-3 max-h-64 overflow-y-auto pr-1">
            {Array.from({ length: pdf.pageCount }, (_, i) => i + 1).map((n) => (
              <div key={n} className="flex flex-col items-center gap-1.5">
                <div
                  className="w-14 rounded-lg overflow-hidden"
                  style={{
                    height: "72px",
                    border: "2px solid rgba(255,255,255,0.1)",
                    background: "rgba(255,255,255,0.03)",
                  }}
                >
                  {thumbnails.get(n) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={thumbnails.get(n)} alt={`Page ${n}`} className="w-full h-full object-contain" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="w-3.5 h-3.5 border-2 border-[#4d4354] border-t-[#ddb7ff] rounded-full animate-spin" />
                    </div>
                  )}
                </div>
                <span className="text-[11px] font-semibold tabular-nums" style={{ color: "#988d9f" }}>{n}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Export progress */}
      {exporting && exportProgress && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium" style={{ color: "#988d9f" }}>
              Exporting page {exportProgress.done} of {exportProgress.total}…
            </span>
            <span className="text-xs font-semibold tabular-nums" style={{ color: "#ddb7ff" }}>{pct}%</span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{ width: `${pct}%`, background: "linear-gradient(90deg,#ddb7ff,#4cd7f6)" }}
            />
          </div>
        </div>
      )}

      {/* Export button */}
      {pdf && (
        <button
          onClick={() => doExport()}
          disabled={exporting || (mode === "selected" && selectedPages.size === 0)}
          className="btn-primary flex items-center justify-center gap-2 py-4 rounded-2xl font-bold text-base transition-all"
          style={{
            opacity: exporting || (mode === "selected" && selectedPages.size === 0) ? 0.5 : 1,
            cursor: exporting || (mode === "selected" && selectedPages.size === 0) ? "not-allowed" : "pointer",
          }}
        >
          {exporting ? (
            <>
              <span className="w-5 h-5 border-2 border-[rgba(255,255,255,0.3)] border-t-white rounded-full animate-spin" />
              Exporting…
            </>
          ) : (
            <>
              <span className="material-symbols-outlined text-[20px]">download</span>
              {exportCount > 1
                ? `Download ${exportCount} images as ZIP`
                : exportCount === 1
                  ? `Download image`
                  : "Download images"}
            </>
          )}
        </button>
      )}

      {/* Empty state hint */}
      {!pdf && !notif && (
        <p className="text-center text-sm" style={{ color: "#4d4354" }}>
          Upload a PDF to get started
        </p>
      )}
    </div>
  );
}
