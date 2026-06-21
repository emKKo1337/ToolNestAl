"use client";

/**
 * Delete PDF Pages (browser-only)
 *
 * Pipeline:
 *  1. pdfjs-dist  — renders every page to a thumbnail canvas (same pattern
 *                   as RotatePdfTool) so the user can identify pages to remove.
 *  2. Interactive — the user marks pages for deletion by clicking thumbnails,
 *                   typing a range ("1-3, 5, 8"), or using Select All.
 *                   Marked pages show a red destructive highlight.
 *  3. pdf-lib     — creates a new PDFDocument, copies only the pages NOT
 *                   marked for deletion via copyPages(), then saves.
 *                   The original page order is preserved for the kept pages.
 *
 * Guard: if the user tries to delete ALL pages an error is shown.
 * Files never leave the device.
 */

import { useState, useRef, useCallback } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface PageThumb {
  dataUrl: string;
  width: number;
  height: number;
}

type NotifType = "success" | "error" | "warning";
interface Notif { type: NotifType; msg: string }

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_BYTES    = 200 * 1024 * 1024;
const THUMB_HEIGHT = 160;
const THUMB_SCALE  = 1.5;

// Destructive accent colour used for "marked for deletion" state
const DEL_COLOR    = "#ff6b6b";
const DEL_BG       = "rgba(255,107,107,0.12)";
const DEL_BORDER   = "rgba(255,107,107,0.45)";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1_048_576) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1_048_576).toFixed(2)} MB`;
}

/**
 * Parse a page-range string like "1-3, 5, 7-9" into a 0-based Set.
 * Returns null if the string contains invalid tokens.
 */
function parseRange(str: string, total: number): Set<number> | null {
  const result = new Set<number>();
  const parts  = str.split(/[\s,]+/).filter(Boolean);
  for (const part of parts) {
    const rangeMatch = part.match(/^(\d+)-(\d+)$/);
    const singleMatch = part.match(/^(\d+)$/);
    if (rangeMatch) {
      const lo = parseInt(rangeMatch[1], 10) - 1;
      const hi = parseInt(rangeMatch[2], 10) - 1;
      if (lo < 0 || hi >= total || lo > hi) return null;
      for (let i = lo; i <= hi; i++) result.add(i);
    } else if (singleMatch) {
      const idx = parseInt(singleMatch[1], 10) - 1;
      if (idx < 0 || idx >= total) return null;
      result.add(idx);
    } else {
      return null;
    }
  }
  return result;
}

// ── Library loaders ───────────────────────────────────────────────────────────

async function getPdfjs() {
  const lib = await import("pdfjs-dist");
  lib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  return lib;
}

async function getPdfLib() {
  return import("pdf-lib");
}

// ── Thumbnail renderer ────────────────────────────────────────────────────────

async function renderThumbs(
  file: File,
  onPage: (idx: number, total: number) => void,
): Promise<PageThumb[]> {
  const pdfjs = await getPdfjs();
  const buf   = await file.arrayBuffer();
  const doc   = await pdfjs.getDocument({ data: buf }).promise;
  const total = doc.numPages;
  const thumbs: PageThumb[] = [];

  for (let i = 1; i <= total; i++) {
    onPage(i, total);
    const page   = await doc.getPage(i);
    const vp1    = page.getViewport({ scale: 1 });
    const scale  = (THUMB_HEIGHT * THUMB_SCALE) / vp1.height;
    const vp     = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width  = Math.round(vp.width);
    canvas.height = Math.round(vp.height);
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport: vp, canvas }).promise;
    thumbs.push({ dataUrl: canvas.toDataURL("image/jpeg", 0.82), width: vp1.width, height: vp1.height });
  }

  return thumbs;
}

// ── pdf-lib page deletion ─────────────────────────────────────────────────────

async function deletePages(file: File, toDelete: Set<number>): Promise<Uint8Array> {
  const { PDFDocument } = await getPdfLib();
  const buf    = await file.arrayBuffer();
  const srcDoc = await PDFDocument.load(buf);
  const dstDoc = await PDFDocument.create();

  const total      = srcDoc.getPageCount();
  const keepIndices = Array.from({ length: total }, (_, i) => i).filter((i) => !toDelete.has(i));

  const copied = await dstDoc.copyPages(srcDoc, keepIndices);
  copied.forEach((page) => dstDoc.addPage(page));

  return dstDoc.save();
}

function downloadPdf(data: Uint8Array, filename: string) {
  const blob = new Blob([data.buffer as ArrayBuffer], { type: "application/pdf" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── PageCard ──────────────────────────────────────────────────────────────────

function PageCard({
  thumb,
  index,
  marked,
  onToggle,
}: {
  thumb: PageThumb;
  index: number;
  marked: boolean;
  onToggle: (i: number) => void;
}) {
  const [hovered, setHovered] = useState(false);

  const dispH = THUMB_HEIGHT;
  const dispW = Math.round((thumb.width / thumb.height) * THUMB_HEIGHT);

  return (
    <button
      type="button"
      onClick={() => onToggle(index)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      aria-pressed={marked}
      aria-label={`Page ${index + 1}${marked ? " — marked for deletion" : ""}`}
      className="flex flex-col items-center gap-2 outline-none focus-visible:ring-2 rounded-xl"
      style={{ focusRingColor: DEL_COLOR } as React.CSSProperties}
    >
      {/* Card */}
      <div
        className="relative rounded-xl overflow-hidden transition-all duration-200"
        style={{
          width:      dispW + 16,
          height:     dispH + 16,
          background: marked ? DEL_BG : hovered ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.04)",
          border:     `2px solid ${marked ? DEL_BORDER : hovered ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.08)"}`,
          display:    "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {/* Thumbnail */}
        <img
          src={thumb.dataUrl}
          alt={`Page ${index + 1}`}
          draggable={false}
          style={{
            width:     dispW,
            height:    dispH,
            objectFit: "cover",
            display:   "block",
            borderRadius: 4,
            opacity: marked ? 0.45 : 1,
            transition: "opacity 0.2s",
          }}
        />

        {/* Delete overlay */}
        {marked && (
          <div
            className="absolute inset-0 flex items-center justify-center rounded-lg"
            style={{ background: "rgba(255,107,107,0.18)" }}
          >
            <span
              className="material-symbols-outlined text-[32px]"
              style={{ color: DEL_COLOR, filter: "drop-shadow(0 0 4px rgba(255,107,107,0.6))" }}
            >
              delete
            </span>
          </div>
        )}

        {/* Hover zoom hint when not marked */}
        {hovered && !marked && (
          <div
            className="absolute inset-0 flex items-end justify-center pb-2 rounded-lg"
            style={{ background: "rgba(0,0,0,0.25)" }}
          >
            <span className="text-[10px] font-semibold text-white/80">Click to remove</span>
          </div>
        )}
      </div>

      {/* Page number */}
      <span
        className="text-[11px] font-semibold transition-colors"
        style={{ color: marked ? DEL_COLOR : "#5a4d63" }}
      >
        {index + 1}
      </span>
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function DeletePdfPagesTool() {
  const [draggingOver, setDraggingOver]   = useState(false);
  const [loadedFile, setLoadedFile]       = useState<File | null>(null);
  const [thumbs, setThumbs]               = useState<PageThumb[]>([]);
  const [thumbLoading, setThumbLoading]   = useState(false);
  const [thumbProgress, setThumbProgress] = useState<{ n: number; total: number } | null>(null);

  // 0-indexed set of pages marked for deletion
  const [marked, setMarked]               = useState<Set<number>>(new Set());

  // Range input
  const [rangeInput, setRangeInput]       = useState("");
  const [rangeError, setRangeError]       = useState(false);

  const [applying, setApplying]           = useState(false);
  const [done, setDone]                   = useState(false);
  const [resultInfo, setResultInfo]       = useState<{ size: number; kept: number; deleted: number } | null>(null);

  const [notif, setNotif]                 = useState<Notif | null>(null);

  const dropRef  = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const notify = useCallback((type: NotifType, msg: string) => {
    setNotif({ type, msg });
    setTimeout(() => setNotif(null), 7000);
  }, []);

  // ── File ingestion ────────────────────────────────────────────────────────

  const handleFile = useCallback(async (file: File) => {
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      notify("error", `"${file.name}" is not a PDF.`);
      return;
    }
    if (file.size > MAX_BYTES) {
      notify("error", `File exceeds the 200 MB limit (${fmt(file.size)}).`);
      return;
    }

    setLoadedFile(file);
    setThumbs([]);
    setMarked(new Set());
    setRangeInput("");
    setRangeError(false);
    setDone(false);
    setResultInfo(null);
    setNotif(null);
    setThumbLoading(true);
    setThumbProgress(null);

    try {
      const result = await renderThumbs(file, (n, total) => setThumbProgress({ n, total }));
      setThumbs(result);
    } catch {
      notify("error", "Could not read the PDF. It may be password-protected or corrupted.");
      setLoadedFile(null);
    } finally {
      setThumbLoading(false);
      setThumbProgress(null);
    }
  }, [notify]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDraggingOver(false);
    const f = e.dataTransfer.files[0]; if (f) handleFile(f);
  }, [handleFile]);

  const onDragOver  = useCallback((e: React.DragEvent) => { e.preventDefault(); setDraggingOver(true); }, []);
  const onDragLeave = useCallback((e: React.DragEvent) => {
    if (dropRef.current && !dropRef.current.contains(e.relatedTarget as Node)) setDraggingOver(false);
  }, []);

  // ── Page selection ────────────────────────────────────────────────────────

  const togglePage = useCallback((i: number) => {
    setMarked((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  }, []);

  const selectAll   = useCallback(() => setMarked(new Set(thumbs.map((_, i) => i))), [thumbs]);
  const deselectAll = useCallback(() => setMarked(new Set()), []);

  // ── Range input ───────────────────────────────────────────────────────────

  const applyRange = useCallback(() => {
    if (!rangeInput.trim()) { setRangeError(false); return; }
    const result = parseRange(rangeInput, thumbs.length);
    if (result === null) {
      setRangeError(true);
      return;
    }
    setRangeError(false);
    setMarked(result);
  }, [rangeInput, thumbs.length]);

  const clearRange = useCallback(() => {
    setRangeInput("");
    setRangeError(false);
  }, []);

  // ── Delete & download ─────────────────────────────────────────────────────

  const handleDelete = useCallback(async () => {
    if (!loadedFile || marked.size === 0) return;
    if (marked.size >= thumbs.length) {
      notify("error", "You cannot delete all pages — at least one page must remain.");
      return;
    }

    setApplying(true);
    try {
      const bytes    = await deletePages(loadedFile, marked);
      const filename = loadedFile.name.replace(/\.pdf$/i, "") + "_pages_removed.pdf";
      downloadPdf(bytes, filename);
      setResultInfo({ size: bytes.byteLength, kept: thumbs.length - marked.size, deleted: marked.size });
      setDone(true);
    } catch {
      notify("error", "Failed to process the PDF. Please try again.");
    } finally {
      setApplying(false);
    }
  }, [loadedFile, marked, thumbs.length, notify]);

  const handleReset = useCallback(() => {
    setLoadedFile(null);
    setThumbs([]);
    setMarked(new Set());
    setRangeInput("");
    setRangeError(false);
    setDone(false);
    setResultInfo(null);
    setNotif(null);
    if (inputRef.current) inputRef.current.value = "";
  }, []);

  const thumbLoaded  = thumbs.length > 0;
  const allMarked    = thumbLoaded && marked.size === thumbs.length;
  const noneMarked   = marked.size === 0;
  const thumbPct     = thumbProgress ? Math.round((thumbProgress.n / thumbProgress.total) * 100) : 0;
  const remaining    = thumbs.length - marked.size;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="mb-12 flex flex-col gap-6">

      {/* ── Drop zone ──────────────────────────────────────────────────────── */}
      {!loadedFile && (
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
            border: `2px dashed ${draggingOver ? "#ffb4ab" : "rgba(255,255,255,0.12)"}`,
            background: draggingOver ? "rgba(255,180,171,0.06)" : undefined,
            transform: draggingOver ? "scale(1.01)" : "scale(1)",
          }}
        >
          <div
            className="w-20 h-20 rounded-2xl flex items-center justify-center transition-all duration-300"
            style={{
              background: draggingOver ? "rgba(255,180,171,0.2)" : "rgba(255,180,171,0.1)",
              border: `1px solid ${draggingOver ? "rgba(255,180,171,0.45)" : "rgba(255,180,171,0.2)"}`,
            }}
          >
            <span className="material-symbols-outlined text-[38px]" style={{ color: "#ffb4ab" }}>
              {draggingOver ? "file_download" : "delete"}
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
            {["Page thumbnails", "Click to remove", "Range selection", "Order preserved", "No upload"].map((f) => (
              <span key={f} className="px-2.5 py-1 rounded-lg text-[11px] font-semibold"
                style={{ background: "rgba(255,180,171,0.08)", color: "#ffb4ab", border: "1px solid rgba(255,180,171,0.15)" }}>
                {f}
              </span>
            ))}
          </div>

          <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="sr-only"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
            aria-hidden="true" tabIndex={-1} />
        </div>
      )}

      {/* ── Thumbnail loading progress ────────────────────────────────────── */}
      {thumbLoading && (
        <div className="glass-panel rounded-2xl p-6 flex flex-col gap-4" aria-live="polite" aria-busy="true">
          <div className="flex items-center gap-3">
            <span className="w-6 h-6 border-2 border-[#ffb4ab]/30 border-t-[#ffb4ab] rounded-full animate-spin flex-shrink-0" />
            <p className="text-[15px] font-bold text-[#e2e2e2]">
              {thumbProgress ? `Rendering page ${thumbProgress.n} of ${thumbProgress.total}…` : "Loading PDF…"}
            </p>
          </div>
          {thumbProgress && (
            <div>
              <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}
                role="progressbar" aria-valuenow={thumbPct} aria-valuemin={0} aria-valuemax={100}>
                <div className="h-full rounded-full transition-all duration-300" style={{ width: `${thumbPct}%`, background: "#ffb4ab" }} />
              </div>
              <p className="text-right text-[11px] text-[#988d9f] mt-1">{thumbPct}%</p>
            </div>
          )}
        </div>
      )}

      {/* ── Notification ──────────────────────────────────────────────────── */}
      {notif && (
        <div role="alert" className="flex items-start gap-3 px-5 py-4 rounded-xl text-[14px] font-medium"
          style={{
            background: notif.type === "success" ? "rgba(34,197,94,0.12)"
                      : notif.type === "warning"  ? "rgba(250,204,21,0.10)"
                      :                             "rgba(239,68,68,0.12)",
            border: `1px solid ${
              notif.type === "success" ? "rgba(34,197,94,0.3)"
            : notif.type === "warning" ? "rgba(250,204,21,0.3)"
            :                           "rgba(239,68,68,0.3)"}`,
            color: notif.type === "success" ? "#22c55e" : notif.type === "warning" ? "#facc15" : "#ef4444",
          }}>
          <span className="material-symbols-outlined text-[20px] flex-shrink-0 mt-0.5">
            {notif.type === "success" ? "check_circle" : notif.type === "warning" ? "warning" : "error"}
          </span>
          <span className="flex-1 leading-relaxed">{notif.msg}</span>
          <button onClick={() => setNotif(null)} aria-label="Dismiss" className="opacity-60 hover:opacity-100 transition-opacity">
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
      )}

      {/* ── Editor ────────────────────────────────────────────────────────── */}
      {thumbLoaded && !thumbLoading && !done && (
        <div className="flex flex-col gap-5">

          {/* ── Toolbar ─────────────────────────────────────────────────── */}
          <div className="glass-panel rounded-2xl p-4 flex flex-col gap-4">

            {/* File info */}
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: "rgba(255,180,171,0.1)", border: "1px solid rgba(255,180,171,0.2)" }}>
                <span className="material-symbols-outlined text-[18px] text-[#ffb4ab]">picture_as_pdf</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-bold text-[#e2e2e2] truncate">{loadedFile?.name}</p>
                <p className="text-[11px] text-[#5a4d63]">
                  {fmt(loadedFile?.size ?? 0)} · {thumbs.length} page{thumbs.length !== 1 ? "s" : ""}
                </p>
              </div>
              <button onClick={handleReset} aria-label="Remove file"
                className="w-8 h-8 rounded-lg flex items-center justify-center opacity-50 hover:opacity-100 transition-opacity"
                style={{ background: "rgba(255,255,255,0.05)" }}>
                <span className="material-symbols-outlined text-[16px] text-[#988d9f]">close</span>
              </button>
            </div>

            <div className="h-px" style={{ background: "rgba(255,255,255,0.06)" }} />

            {/* Selection controls */}
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-[12px] font-semibold text-[#988d9f] uppercase tracking-wide mr-1">Select</p>

              <button onClick={allMarked ? deselectAll : selectAll}
                className="px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all"
                style={{
                  background: allMarked ? "rgba(255,107,107,0.15)" : "rgba(255,255,255,0.06)",
                  color:  allMarked ? DEL_COLOR : "#988d9f",
                  border: `1px solid ${allMarked ? DEL_BORDER : "rgba(255,255,255,0.08)"}`,
                }}>
                {allMarked ? "Deselect All" : "Select All"}
              </button>

              {!noneMarked && (
                <button onClick={deselectAll}
                  className="px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all"
                  style={{ background: "rgba(255,255,255,0.05)", color: "#5a4d63", border: "1px solid rgba(255,255,255,0.08)" }}>
                  Clear
                </button>
              )}

              <span className="text-[12px] ml-auto" style={{ color: marked.size > 0 ? DEL_COLOR : "#5a4d63" }}>
                {marked.size > 0
                  ? `${marked.size} page${marked.size !== 1 ? "s" : ""} marked for deletion · ${remaining} remaining`
                  : "No pages selected"}
              </span>
            </div>

            {/* Range input */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="range-input" className="text-[12px] font-semibold text-[#988d9f] uppercase tracking-wide">
                Select by range
              </label>
              <div className="flex gap-2">
                <input
                  id="range-input"
                  type="text"
                  value={rangeInput}
                  onChange={(e) => { setRangeInput(e.target.value); setRangeError(false); }}
                  onKeyDown={(e) => { if (e.key === "Enter") applyRange(); }}
                  placeholder={`e.g. 1-3, 5, 7-9  (1–${thumbs.length})`}
                  aria-invalid={rangeError}
                  aria-describedby={rangeError ? "range-error" : undefined}
                  className="flex-1 px-3.5 py-2 rounded-xl text-[13px] font-medium outline-none transition-all"
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    border: `1px solid ${rangeError ? "rgba(239,68,68,0.5)" : "rgba(255,255,255,0.1)"}`,
                    color: "#e2e2e2",
                  }}
                />
                <button onClick={applyRange}
                  className="px-4 py-2 rounded-xl text-[13px] font-semibold transition-all"
                  style={{ background: "rgba(255,180,171,0.1)", color: "#ffb4ab", border: "1px solid rgba(255,180,171,0.2)" }}>
                  Apply
                </button>
                {rangeInput && (
                  <button onClick={clearRange} aria-label="Clear range"
                    className="px-3 py-2 rounded-xl transition-all"
                    style={{ background: "rgba(255,255,255,0.05)", color: "#5a4d63", border: "1px solid rgba(255,255,255,0.08)" }}>
                    <span className="material-symbols-outlined text-[16px]">close</span>
                  </button>
                )}
              </div>
              {rangeError && (
                <p id="range-error" className="text-[11px] text-[#ef4444]" role="alert">
                  Invalid range. Use page numbers 1–{thumbs.length}, e.g. "1-3, 5, 8".
                </p>
              )}
            </div>

            <div className="h-px" style={{ background: "rgba(255,255,255,0.06)" }} />

            {/* Delete button */}
            <button
              onClick={handleDelete}
              disabled={applying || noneMarked || marked.size >= thumbs.length}
              className="w-full text-white font-bold text-[15px] py-3.5 rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: noneMarked ? "rgba(255,107,107,0.3)" : DEL_COLOR }}
            >
              {applying ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Processing…
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[18px]">delete</span>
                  Delete Pages
                  {marked.size > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-bold"
                      style={{ background: "rgba(255,255,255,0.25)" }}>
                      {marked.size}
                    </span>
                  )}
                </>
              )}
            </button>

            {marked.size >= thumbs.length && thumbLoaded && (
              <p className="text-[12px] text-[#ef4444] text-center -mt-1">
                You cannot delete all pages — at least one page must remain.
              </p>
            )}
            {noneMarked && thumbLoaded && (
              <p className="text-[12px] text-[#5a4d63] text-center -mt-1">
                Click thumbnails below or use range selection to mark pages for deletion
              </p>
            )}
          </div>

          {/* ── Thumbnail grid ───────────────────────────────────────────── */}
          <div className="glass-panel rounded-2xl p-5" role="group" aria-label="PDF pages — click to mark for deletion">
            {/* Remaining pages counter */}
            <div className="flex items-center justify-between mb-4">
              <p className="text-[12px] font-semibold text-[#5a4d63]">
                {thumbs.length} pages total
              </p>
              {marked.size > 0 && (
                <div className="flex items-center gap-4 text-[12px] font-semibold">
                  <span style={{ color: DEL_COLOR }}>
                    <span className="material-symbols-outlined text-[14px] mr-1 align-middle">delete</span>
                    {marked.size} to delete
                  </span>
                  <span style={{ color: "#4ade80" }}>
                    <span className="material-symbols-outlined text-[14px] mr-1 align-middle">check_circle</span>
                    {remaining} to keep
                  </span>
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-4 justify-start" style={{ minHeight: THUMB_HEIGHT + 48 }}>
              {thumbs.map((thumb, i) => (
                <PageCard
                  key={i}
                  thumb={thumb}
                  index={i}
                  marked={marked.has(i)}
                  onToggle={togglePage}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Done state ────────────────────────────────────────────────────── */}
      {done && resultInfo && (
        <div className="flex flex-col gap-4">
          {/* Stats */}
          <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))" }}>
            <div className="flex flex-col gap-1.5 rounded-xl p-4"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <span className="material-symbols-outlined text-[18px]" style={{ color: DEL_COLOR }}>delete</span>
              <p className="text-[20px] font-extrabold leading-none" style={{ color: DEL_COLOR }}>{resultInfo.deleted}</p>
              <p className="text-[11px] text-[#988d9f] font-semibold uppercase tracking-wide">Pages deleted</p>
            </div>
            <div className="flex flex-col gap-1.5 rounded-xl p-4"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <span className="material-symbols-outlined text-[18px] text-[#4ade80]">check_circle</span>
              <p className="text-[20px] font-extrabold leading-none text-[#4ade80]">{resultInfo.kept}</p>
              <p className="text-[11px] text-[#988d9f] font-semibold uppercase tracking-wide">Pages kept</p>
            </div>
            <div className="flex flex-col gap-1.5 rounded-xl p-4"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <span className="material-symbols-outlined text-[18px] text-[#4cd7f6]">download</span>
              <p className="text-[20px] font-extrabold leading-none text-[#4cd7f6]">{fmt(resultInfo.size)}</p>
              <p className="text-[11px] text-[#988d9f] font-semibold uppercase tracking-wide">File size</p>
            </div>
          </div>

          {/* Download card */}
          <div className="glass-panel rounded-2xl overflow-hidden">
            <div className="flex items-center gap-4 px-5 py-4 border-b border-[rgba(255,255,255,0.06)]">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.25)" }}>
                <span className="material-symbols-outlined text-[22px] text-[#22c55e]">check_circle</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-bold text-[#e2e2e2]">PDF saved — {resultInfo.deleted} page{resultInfo.deleted !== 1 ? "s" : ""} removed</p>
                <p className="text-[12px] text-[#988d9f]">{resultInfo.kept} page{resultInfo.kept !== 1 ? "s" : ""} remain in original order</p>
              </div>
            </div>
            <div className="p-5 flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleDelete}
                className="btn-primary flex-1 text-white font-bold text-[15px] py-3.5 rounded-xl flex items-center justify-center gap-2"
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
                Upload Another File
              </button>
            </div>
          </div>

          <div className="flex items-start gap-3 px-4 py-3.5 rounded-xl text-[13px]"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", color: "#5a4d63" }}>
            <span className="material-symbols-outlined text-[16px] mt-0.5 flex-shrink-0">info</span>
            <span>
              The remaining pages are copied into a new PDF in their original order.
              The original file is not modified. Everything runs in your browser — your file is never uploaded.
            </span>
          </div>
        </div>
      )}

      {/* ── How it works (idle) ─────────────────────────────────────────────── */}
      {!loadedFile && !thumbLoading && (
        <div className="glass-panel rounded-2xl p-6 flex flex-col gap-3">
          <p className="text-[12px] font-semibold text-[#988d9f] uppercase tracking-[0.08em]">How it works</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { icon: "upload_file",  label: "1. Upload PDF",      desc: "Drag & drop or browse — every page appears as a thumbnail" },
              { icon: "touch_app",    label: "2. Mark Pages",       desc: "Click thumbnails or type a range like '1-3, 5' to mark pages for deletion" },
              { icon: "download",     label: "3. Download PDF",     desc: "The cleaned PDF downloads instantly with remaining pages in order" },
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
