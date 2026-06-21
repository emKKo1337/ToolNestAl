"use client";

/**
 * Rotate PDF (browser-only)
 *
 * Pipeline:
 *  1. pdfjs-dist  — renders every page to a small thumbnail canvas so the
 *                   user can see each page and pick which ones to rotate.
 *  2. Interactive — the user selects pages (click-to-toggle or Select All)
 *                   and picks a rotation angle (90° left, 90° right, 180°, 270°).
 *                   Selected thumbnails animate via CSS transform in real time,
 *                   giving instant visual feedback before applying.
 *  3. pdf-lib     — loads the original file bytes, iterates over every page
 *                   and calls page.setRotation(degrees((current + delta) % 360))
 *                   for each selected page; saves and triggers download.
 *                   No re-rendering / re-compression — quality is lossless.
 *
 * Supported: any PDF readable by pdfjs-dist.
 * Files never leave the device.
 */

import { useState, useRef, useCallback } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface PageThumb {
  dataUrl: string;
  width: number;   // original page width  (pts)
  height: number;  // original page height (pts)
}

type NotifType = "success" | "error";
interface Notif { type: NotifType; msg: string }

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_BYTES    = 200 * 1024 * 1024;   // 200 MB
const THUMB_HEIGHT = 160;                  // target thumbnail height (px)
const THUMB_SCALE  = 1.5;                  // render scale for quality

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1_048_576) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1_048_576).toFixed(2)} MB`;
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
  const pdfjs  = await getPdfjs();
  const buf    = await file.arrayBuffer();
  const doc    = await pdfjs.getDocument({ data: buf }).promise;
  const total  = doc.numPages;
  const thumbs: PageThumb[] = [];

  for (let i = 1; i <= total; i++) {
    onPage(i, total);
    const page    = await doc.getPage(i);
    const vp1     = page.getViewport({ scale: 1 });

    // Scale so the rendered thumb height is THUMB_HEIGHT * THUMB_SCALE
    const scale   = (THUMB_HEIGHT * THUMB_SCALE) / vp1.height;
    const vp      = page.getViewport({ scale });

    const canvas  = document.createElement("canvas");
    canvas.width  = Math.round(vp.width);
    canvas.height = Math.round(vp.height);
    const ctx     = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport: vp, canvas }).promise;

    thumbs.push({
      dataUrl: canvas.toDataURL("image/jpeg", 0.82),
      width:   vp1.width,
      height:  vp1.height,
    });
  }

  return thumbs;
}

// ── pdf-lib rotation ──────────────────────────────────────────────────────────

async function applyRotations(
  file: File,
  /** pageRotations[i] = total degrees to add to page i (0-indexed) */
  pageRotations: number[],
): Promise<Uint8Array> {
  const { PDFDocument, degrees } = await getPdfLib();
  const buf    = await file.arrayBuffer();
  const pdfDoc = await PDFDocument.load(buf);
  const pages  = pdfDoc.getPages();

  pages.forEach((page, i) => {
    const delta = pageRotations[i] ?? 0;
    if (delta === 0) return;
    const current = page.getRotation().angle;
    page.setRotation(degrees((current + delta + 360) % 360));
  });

  return pdfDoc.save();
}

function download(data: Uint8Array, filename: string) {
  const blob = new Blob([data.buffer as ArrayBuffer], { type: "application/pdf" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Sub-components ────────────────────────────────────────────────────────────

/** A single page thumbnail card */
function PageCard({
  thumb,
  index,
  selected,
  visualRotation,
  onToggle,
}: {
  thumb: PageThumb;
  index: number;
  selected: boolean;
  visualRotation: number;
  onToggle: (i: number) => void;
}) {
  const isLandscape = thumb.width > thumb.height;
  // Base display dimensions fit within a THUMB_HEIGHT×THUMB_HEIGHT square
  const dispH  = THUMB_HEIGHT;
  const dispW  = Math.round((thumb.width / thumb.height) * THUMB_HEIGHT);

  // After the user's chosen rotation the displayed image will be rotated;
  // calculate the outer box size so the rotated image doesn't overflow.
  const r = ((visualRotation % 360) + 360) % 360;
  const swapped = r === 90 || r === 270;
  const boxW = swapped ? dispH : dispW;
  const boxH = swapped ? dispW : dispH;

  return (
    <button
      type="button"
      onClick={() => onToggle(index)}
      aria-pressed={selected}
      aria-label={`Page ${index + 1}${selected ? " (selected)" : ""}`}
      className="flex flex-col items-center gap-2 group outline-none focus-visible:ring-2 focus-visible:ring-[#ffb4ab] rounded-xl"
    >
      {/* Card */}
      <div
        className="relative rounded-xl overflow-hidden transition-all duration-200"
        style={{
          width:  boxW + 16,
          height: boxH + 16,
          background: selected ? "rgba(255,180,171,0.12)" : "rgba(255,255,255,0.04)",
          border: `2px solid ${selected ? "#ffb4ab" : "rgba(255,255,255,0.08)"}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {/* Thumbnail image — CSS rotated for live preview */}
        <img
          src={thumb.dataUrl}
          alt={`Page ${index + 1}`}
          draggable={false}
          style={{
            width:  dispW,
            height: dispH,
            objectFit: "cover",
            display: "block",
            transform: `rotate(${visualRotation}deg)`,
            transition: "transform 0.25s ease",
            borderRadius: 4,
          }}
        />

        {/* Selection checkmark */}
        {selected && (
          <span
            className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center"
            style={{ background: "#ffb4ab" }}
          >
            <span className="material-symbols-outlined text-[13px] text-[#131313] font-black">check</span>
          </span>
        )}

        {/* Rotation badge (shows only when non-zero) */}
        {visualRotation !== 0 && (
          <span
            className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded text-[10px] font-bold"
            style={{ background: "rgba(255,180,171,0.9)", color: "#131313" }}
          >
            {((visualRotation % 360) + 360) % 360}°
          </span>
        )}
      </div>

      {/* Page number label */}
      <span
        className="text-[11px] font-semibold transition-colors"
        style={{ color: selected ? "#ffb4ab" : "#5a4d63" }}
      >
        {index + 1}
      </span>
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function RotatePdfTool() {
  const [draggingOver, setDraggingOver]   = useState(false);
  const [loadedFile, setLoadedFile]       = useState<File | null>(null);
  const [thumbs, setThumbs]               = useState<PageThumb[]>([]);
  const [thumbLoading, setThumbLoading]   = useState(false);
  const [thumbProgress, setThumbProgress] = useState<{ n: number; total: number } | null>(null);

  // pageRotations[i] = cumulative degrees added by user for page i
  const [pageRotations, setPageRotations] = useState<number[]>([]);
  // selected pages (0-indexed)
  const [selected, setSelected]           = useState<Set<number>>(new Set());

  const [applying, setApplying]           = useState(false);
  const [done, setDone]                   = useState(false);
  const [resultSize, setResultSize]       = useState(0);

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
    setPageRotations([]);
    setSelected(new Set());
    setDone(false);
    setNotif(null);
    setThumbLoading(true);
    setThumbProgress(null);

    try {
      const result = await renderThumbs(file, (n, total) => setThumbProgress({ n, total }));
      setThumbs(result);
      setPageRotations(new Array(result.length).fill(0));
      // Select all pages by default
      setSelected(new Set(result.map((_, i) => i)));
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
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelected(new Set(thumbs.map((_, i) => i)));
  }, [thumbs]);

  const deselectAll = useCallback(() => setSelected(new Set()), []);

  const allSelected  = thumbs.length > 0 && selected.size === thumbs.length;
  const noneSelected = selected.size === 0;

  // ── Live rotation preview ─────────────────────────────────────────────────

  const addRotation = useCallback((delta: number) => {
    if (selected.size === 0) {
      notify("error", "Select at least one page first.");
      return;
    }
    setPageRotations((prev) => {
      const next = [...prev];
      selected.forEach((i) => { next[i] = ((next[i] ?? 0) + delta + 360) % 360; });
      return next;
    });
  }, [selected, notify]);

  const resetRotations = useCallback(() => {
    setPageRotations(new Array(thumbs.length).fill(0));
  }, [thumbs.length]);

  // ── Apply & download ──────────────────────────────────────────────────────

  const handleApply = useCallback(async () => {
    if (!loadedFile) return;
    const anyChanged = pageRotations.some((r) => r !== 0);
    if (!anyChanged) {
      notify("error", "No rotations have been applied. Select pages and choose an angle first.");
      return;
    }

    setApplying(true);
    try {
      const bytes    = await applyRotations(loadedFile, pageRotations);
      const filename = loadedFile.name.replace(/\.pdf$/i, "") + "_rotated.pdf";
      download(bytes, filename);
      setResultSize(bytes.byteLength);
      setDone(true);
    } catch {
      notify("error", "Failed to apply rotations. Please try again.");
    } finally {
      setApplying(false);
    }
  }, [loadedFile, pageRotations, notify]);

  const handleReset = useCallback(() => {
    setLoadedFile(null);
    setThumbs([]);
    setPageRotations([]);
    setSelected(new Set());
    setDone(false);
    setNotif(null);
    if (inputRef.current) inputRef.current.value = "";
  }, []);

  // Are any selected pages currently rotated?
  const anyRotated     = pageRotations.some((r) => r !== 0);
  const changedCount   = pageRotations.filter((r) => r !== 0).length;
  const thumbLoaded    = thumbs.length > 0;
  const thumbPct       = thumbProgress ? Math.round((thumbProgress.n / thumbProgress.total) * 100) : 0;

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
              {draggingOver ? "file_download" : "rotate_right"}
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
            {["Page thumbnails", "Select any pages", "90° · 180° · 270°", "Lossless quality", "No upload"].map((f) => (
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
            background: notif.type === "success" ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)",
            border: `1px solid ${notif.type === "success" ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`,
            color: notif.type === "success" ? "#22c55e" : "#ef4444",
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

      {/* ── Editor (thumbnails + controls) ────────────────────────────────── */}
      {thumbLoaded && !thumbLoading && !done && (
        <div className="flex flex-col gap-5">

          {/* ── Toolbar ─────────────────────────────────────────────────── */}
          <div className="glass-panel rounded-2xl p-4 flex flex-col gap-4">

            {/* File info + reset */}
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
              <p className="text-[12px] font-semibold text-[#988d9f] uppercase tracking-wide mr-1">Pages</p>
              <button
                onClick={allSelected ? deselectAll : selectAll}
                className="px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all"
                style={{
                  background: allSelected ? "rgba(255,180,171,0.15)" : "rgba(255,255,255,0.06)",
                  color: allSelected ? "#ffb4ab" : "#988d9f",
                  border: `1px solid ${allSelected ? "rgba(255,180,171,0.35)" : "rgba(255,255,255,0.08)"}`,
                }}
              >
                {allSelected ? "Deselect All" : "Select All"}
              </button>
              <span className="text-[12px] text-[#5a4d63]">
                {selected.size} of {thumbs.length} selected
              </span>
            </div>

            <div className="h-px" style={{ background: "rgba(255,255,255,0.06)" }} />

            {/* Rotation controls */}
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-[12px] font-semibold text-[#988d9f] uppercase tracking-wide mr-1">Rotate</p>

              {[
                { label: "90° Left",  icon: "rotate_left",  delta: -90 },
                { label: "90° Right", icon: "rotate_right", delta:  90 },
                { label: "180°",      icon: "sync",         delta: 180 },
              ].map(({ label, icon, delta }) => (
                <button
                  key={label}
                  onClick={() => addRotation(delta)}
                  disabled={noneSelected}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[13px] font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{
                    background: "rgba(255,180,171,0.08)",
                    color: "#ffb4ab",
                    border: "1px solid rgba(255,180,171,0.2)",
                  }}
                  aria-label={`Rotate selected pages ${label}`}
                >
                  <span className="material-symbols-outlined text-[16px]">{icon}</span>
                  {label}
                </button>
              ))}

              {anyRotated && (
                <button
                  onClick={resetRotations}
                  className="px-3 py-2 rounded-xl text-[12px] font-semibold transition-all"
                  style={{ background: "rgba(255,255,255,0.05)", color: "#5a4d63", border: "1px solid rgba(255,255,255,0.08)" }}
                >
                  Reset All
                </button>
              )}
            </div>

            <div className="h-px" style={{ background: "rgba(255,255,255,0.06)" }} />

            {/* Apply button */}
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleApply}
                disabled={applying || !anyRotated}
                className="btn-primary flex-1 text-white font-bold text-[15px] py-3.5 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {applying ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Applying…
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[18px]">rotate_right</span>
                    Apply Rotation
                    {anyRotated && changedCount > 0 && (
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-bold" style={{ background: "rgba(255,255,255,0.2)" }}>
                        {changedCount}
                      </span>
                    )}
                  </>
                )}
              </button>
            </div>

            {/* Hint */}
            {!anyRotated && !noneSelected && (
              <p className="text-[12px] text-[#5a4d63] text-center -mt-1">
                Select pages above, then choose a rotation angle
              </p>
            )}
          </div>

          {/* ── Thumbnail grid ───────────────────────────────────────────── */}
          <div
            className="glass-panel rounded-2xl p-5"
            role="group"
            aria-label="PDF pages — click to select"
          >
            <div
              className="flex flex-wrap gap-4 justify-start"
              style={{ minHeight: THUMB_HEIGHT + 48 }}
            >
              {thumbs.map((thumb, i) => (
                <PageCard
                  key={i}
                  thumb={thumb}
                  index={i}
                  selected={selected.has(i)}
                  visualRotation={pageRotations[i] ?? 0}
                  onToggle={togglePage}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Done state ────────────────────────────────────────────────────── */}
      {done && (
        <div className="flex flex-col gap-4">
          {/* Stats */}
          <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))" }}>
            <div className="flex flex-col gap-1.5 rounded-xl p-4"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <span className="material-symbols-outlined text-[18px] text-[#ffb4ab]">rotate_right</span>
              <p className="text-[20px] font-extrabold leading-none text-[#ffb4ab]">{changedCount}</p>
              <p className="text-[11px] text-[#988d9f] font-semibold uppercase tracking-wide">Pages rotated</p>
            </div>
            <div className="flex flex-col gap-1.5 rounded-xl p-4"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <span className="material-symbols-outlined text-[18px] text-[#4ade80]">description</span>
              <p className="text-[20px] font-extrabold leading-none text-[#4ade80]">{thumbs.length}</p>
              <p className="text-[11px] text-[#988d9f] font-semibold uppercase tracking-wide">Total pages</p>
            </div>
            <div className="flex flex-col gap-1.5 rounded-xl p-4"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <span className="material-symbols-outlined text-[18px] text-[#4cd7f6]">download</span>
              <p className="text-[20px] font-extrabold leading-none text-[#4cd7f6]">{fmt(resultSize)}</p>
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
                <p className="text-[15px] font-bold text-[#e2e2e2]">PDF rotated successfully</p>
                <p className="text-[12px] text-[#988d9f]">Lossless — original quality preserved</p>
              </div>
            </div>
            <div className="p-5 flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => {
                  // Re-trigger download with the already-applied rotations
                  handleApply();
                }}
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
                Rotate Another PDF
              </button>
            </div>
          </div>

          <div className="flex items-start gap-3 px-4 py-3.5 rounded-xl text-[13px]"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", color: "#5a4d63" }}>
            <span className="material-symbols-outlined text-[16px] mt-0.5 flex-shrink-0">info</span>
            <span>
              Rotation is applied to PDF page metadata only — no re-rendering or re-compression occurs,
              so the output is lossless. Your file is processed entirely in your browser and never uploaded.
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
              { icon: "upload_file",  label: "1. Upload PDF",       desc: "Drag & drop or browse — all pages are previewed as thumbnails" },
              { icon: "touch_app",    label: "2. Select & Rotate",  desc: "Click pages to select them, then choose 90°, 180°, or 270°" },
              { icon: "download",     label: "3. Download PDF",      desc: "The rotated PDF is saved losslessly and downloads instantly" },
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
