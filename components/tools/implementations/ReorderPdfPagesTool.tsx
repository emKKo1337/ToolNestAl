"use client";

/**
 * Reorder PDF Pages (browser-only)
 *
 * Pipeline:
 *  1. pdfjs-dist  — renders each page to a thumbnail canvas (identical
 *                   pattern to RotatePdfTool / DeletePdfPagesTool).
 *  2. Interactive — the user reorders pages via:
 *      a. Drag-and-drop (HTML5 DnD) — drag any card to a new position;
 *         a coloured insert-line indicator tracks the drop target.
 *      b. Click-to-select + toolbar buttons — Move Up, Move Down,
 *         Move to First, Move to Last, Move to typed position.
 *      c. Undo (up to 20 steps) and Reset to original order.
 *  3. pdf-lib     — PDFDocument.copyPages(src, newOrder) copies the
 *                   pages in the reordered sequence into a new document.
 *                   Lossless: no re-rendering or re-compression.
 *
 * State model:
 *   thumbs[i]   = PageThumb for original page i (never mutated)
 *   order[pos]  = original page index currently at position pos
 *   history     = stack of previous 'order' snapshots (undo)
 *   selected    = position index of the currently selected card (or null)
 *   dragSrc     = position index being dragged (or null)
 *   dropTarget  = position index the drag is hovering over (or null)
 *
 * Files never leave the device.
 */

import { useState, useRef, useCallback } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface PageThumb {
  dataUrl: string;
  width:   number;
  height:  number;
}

type NotifType = "success" | "error" | "warning";
interface Notif { type: NotifType; msg: string }

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_BYTES    = 200 * 1024 * 1024;
const THUMB_HEIGHT = 152;
const THUMB_SCALE  = 1.5;
const MAX_HISTORY  = 20;

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1_048_576) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1_048_576).toFixed(2)} MB`;
}

function arrMove<T>(arr: T[], from: number, to: number): T[] {
  const next = [...arr];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
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
  onPage: (n: number, total: number) => void,
): Promise<PageThumb[]> {
  const pdfjs = await getPdfjs();
  const buf   = await file.arrayBuffer();
  const doc   = await pdfjs.getDocument({ data: buf }).promise;
  const total = doc.numPages;
  const out: PageThumb[] = [];

  for (let i = 1; i <= total; i++) {
    onPage(i, total);
    const page  = await doc.getPage(i);
    const vp1   = page.getViewport({ scale: 1 });
    const scale = (THUMB_HEIGHT * THUMB_SCALE) / vp1.height;
    const vp    = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width  = Math.round(vp.width);
    canvas.height = Math.round(vp.height);
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport: vp, canvas }).promise;
    out.push({ dataUrl: canvas.toDataURL("image/jpeg", 0.82), width: vp1.width, height: vp1.height });
  }
  return out;
}

// ── pdf-lib save ──────────────────────────────────────────────────────────────

async function saveReordered(file: File, order: number[]): Promise<Uint8Array> {
  const { PDFDocument } = await getPdfLib();
  const buf    = await file.arrayBuffer();
  const srcDoc = await PDFDocument.load(buf);
  const dstDoc = await PDFDocument.create();
  const copied = await dstDoc.copyPages(srcDoc, order);
  copied.forEach((p) => dstDoc.addPage(p));
  return dstDoc.save();
}

function downloadPdf(data: Uint8Array, filename: string) {
  const blob = new Blob([data.buffer as ArrayBuffer], { type: "application/pdf" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ── PageCard ──────────────────────────────────────────────────────────────────

interface PageCardProps {
  thumb:       PageThumb;
  origIndex:   number;   // original page index (0-based)
  position:    number;   // current position in order (0-based, for display as 1-based)
  selected:    boolean;
  dragging:    boolean;
  dropBefore:  boolean;  // show insert-line BEFORE this card
  dropAfter:   boolean;  // show insert-line AFTER this card
  changed:     boolean;  // page is not in its original position
  onSelect:    () => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragOver:  (e: React.DragEvent) => void;
  onDrop:      (e: React.DragEvent) => void;
  onDragEnd:   () => void;
}

function PageCard({
  thumb, origIndex, position, selected, dragging,
  dropBefore, dropAfter, changed,
  onSelect, onDragStart, onDragOver, onDrop, onDragEnd,
}: PageCardProps) {
  const dispH = THUMB_HEIGHT;
  const dispW = Math.round((thumb.width / thumb.height) * THUMB_HEIGHT);

  return (
    <div
      className="relative flex flex-col items-center gap-1.5"
      style={{ flexShrink: 0 }}
    >
      {/* Insert-before line */}
      {dropBefore && (
        <div
          className="absolute left-0 top-0 bottom-6 w-0.5 rounded-full z-20 pointer-events-none"
          style={{ background: "#ffb4ab", boxShadow: "0 0 6px rgba(255,180,171,0.8)" }}
        />
      )}
      {/* Insert-after line */}
      {dropAfter && (
        <div
          className="absolute right-0 top-0 bottom-6 w-0.5 rounded-full z-20 pointer-events-none"
          style={{ background: "#ffb4ab", boxShadow: "0 0 6px rgba(255,180,171,0.8)" }}
        />
      )}

      {/* Card */}
      <div
        draggable
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onDragEnd={onDragEnd}
        onClick={onSelect}
        role="button"
        tabIndex={0}
        aria-pressed={selected}
        aria-label={`Position ${position + 1}, original page ${origIndex + 1}${changed ? " (moved)" : ""}`}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onSelect(); }}
        className="relative rounded-xl overflow-hidden transition-all duration-150 cursor-grab active:cursor-grabbing outline-none focus-visible:ring-2 focus-visible:ring-[#ffb4ab]"
        style={{
          width:      dispW + 16,
          height:     dispH + 16,
          background: selected ? "rgba(255,180,171,0.14)" : "rgba(255,255,255,0.04)",
          border:     `2px solid ${selected ? "#ffb4ab" : changed ? "rgba(255,180,171,0.3)" : "rgba(255,255,255,0.08)"}`,
          opacity:    dragging ? 0.35 : 1,
          transform:  dragging ? "scale(0.96)" : "scale(1)",
          display:    "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          userSelect: "none",
        }}
      >
        <img
          src={thumb.dataUrl}
          alt={`Page ${origIndex + 1}`}
          draggable={false}
          style={{ width: dispW, height: dispH, objectFit: "cover", borderRadius: 4, display: "block" }}
        />

        {/* Current position badge (top-left) */}
        <span
          className="absolute top-1.5 left-1.5 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black"
          style={{
            background: selected ? "#ffb4ab" : changed ? "rgba(255,180,171,0.7)" : "rgba(0,0,0,0.55)",
            color: selected || changed ? "#131313" : "#fff",
          }}
        >
          {position + 1}
        </span>

        {/* Drag handle hint */}
        {!selected && (
          <span
            className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-60 transition-opacity"
            style={{ color: "#988d9f", fontSize: 14, lineHeight: 1 }}
          >
            ⠿
          </span>
        )}

        {/* Selected tick */}
        {selected && (
          <span
            className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center"
            style={{ background: "#ffb4ab" }}
          >
            <span className="material-symbols-outlined text-[12px] text-[#131313] font-black">check</span>
          </span>
        )}
      </div>

      {/* Label: current pos / original page */}
      <div className="flex flex-col items-center gap-0" style={{ lineHeight: 1.2 }}>
        <span className="text-[11px] font-semibold" style={{ color: selected ? "#ffb4ab" : changed ? "rgba(255,180,171,0.7)" : "#5a4d63" }}>
          {changed ? `p.${origIndex + 1}` : `p.${origIndex + 1}`}
        </span>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ReorderPdfPagesTool() {
  const [draggingOver, setDraggingOver]   = useState(false);
  const [loadedFile, setLoadedFile]       = useState<File | null>(null);
  const [thumbs, setThumbs]               = useState<PageThumb[]>([]);
  const [thumbLoading, setThumbLoading]   = useState(false);
  const [thumbProgress, setThumbProgress] = useState<{ n: number; total: number } | null>(null);

  // order[pos] = original page index at that position
  const [order, setOrder]     = useState<number[]>([]);
  const [history, setHistory] = useState<number[][]>([]);
  const [selected, setSelected] = useState<number | null>(null); // position index

  // Drag state
  const [dragSrc, setDragSrc]       = useState<number | null>(null);
  const [dropTarget, setDropTarget] = useState<number | null>(null);

  // Move-to input
  const [moveToVal, setMoveToVal]   = useState("");
  const [moveToErr, setMoveToErr]   = useState(false);

  const [saving, setSaving]   = useState(false);
  const [done, setDone]       = useState(false);
  const [resultSize, setResultSize] = useState(0);

  const [notif, setNotif] = useState<Notif | null>(null);

  const dropRef  = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const notify = useCallback((type: NotifType, msg: string) => {
    setNotif({ type, msg });
    setTimeout(() => setNotif(null), 7000);
  }, []);

  // ── History helpers ───────────────────────────────────────────────────────

  const pushHistory = useCallback((prev: number[]) => {
    setHistory((h) => [...h.slice(-MAX_HISTORY + 1), prev]);
  }, []);

  const applyOrder = useCallback((prev: number[], next: number[]) => {
    pushHistory(prev);
    setOrder(next);
  }, [pushHistory]);

  const undo = useCallback(() => {
    setHistory((h) => {
      if (!h.length) return h;
      const prev = h[h.length - 1];
      setOrder(prev);
      return h.slice(0, -1);
    });
    setSelected(null);
  }, []);

  const reset = useCallback(() => {
    if (!thumbs.length) return;
    const original = thumbs.map((_, i) => i);
    applyOrder(order, original);
    setSelected(null);
    setMoveToVal("");
    setMoveToErr(false);
  }, [thumbs, order, applyOrder]);

  // ── File ingestion ────────────────────────────────────────────────────────

  const handleFile = useCallback(async (file: File) => {
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      notify("error", `"${file.name}" is not a PDF.`); return;
    }
    if (file.size > MAX_BYTES) {
      notify("error", `File exceeds the 200 MB limit (${fmt(file.size)}).`); return;
    }

    setLoadedFile(file);
    setThumbs([]); setOrder([]); setHistory([]); setSelected(null);
    setDone(false); setNotif(null); setMoveToVal(""); setMoveToErr(false);
    setThumbLoading(true); setThumbProgress(null);

    try {
      const result = await renderThumbs(file, (n, total) => setThumbProgress({ n, total }));
      setThumbs(result);
      setOrder(result.map((_, i) => i));
    } catch {
      notify("error", "Could not read the PDF. It may be password-protected or corrupted.");
      setLoadedFile(null);
    } finally {
      setThumbLoading(false); setThumbProgress(null);
    }
  }, [notify]);

  const onFileDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDraggingOver(false);
    const f = e.dataTransfer.files[0]; if (f) handleFile(f);
  }, [handleFile]);
  const onFileDragOver  = useCallback((e: React.DragEvent) => { e.preventDefault(); setDraggingOver(true); }, []);
  const onFileDragLeave = useCallback((e: React.DragEvent) => {
    if (dropRef.current && !dropRef.current.contains(e.relatedTarget as Node)) setDraggingOver(false);
  }, []);

  // ── Move helpers (toolbar buttons) ───────────────────────────────────────

  const moveSelected = useCallback((delta: number) => {
    if (selected === null) return;
    const target = selected + delta;
    if (target < 0 || target >= order.length) return;
    applyOrder(order, arrMove(order, selected, target));
    setSelected(target);
  }, [selected, order, applyOrder]);

  const moveToFirst = useCallback(() => {
    if (selected === null || selected === 0) return;
    applyOrder(order, arrMove(order, selected, 0));
    setSelected(0);
  }, [selected, order, applyOrder]);

  const moveToLast = useCallback(() => {
    if (selected === null || selected === order.length - 1) return;
    const last = order.length - 1;
    applyOrder(order, arrMove(order, selected, last));
    setSelected(last);
  }, [selected, order, applyOrder]);

  const applyMoveTo = useCallback(() => {
    if (selected === null) return;
    const n = parseInt(moveToVal, 10);
    if (isNaN(n) || n < 1 || n > order.length) { setMoveToErr(true); return; }
    const target = n - 1;
    setMoveToErr(false);
    applyOrder(order, arrMove(order, selected, target));
    setSelected(target);
    setMoveToVal("");
  }, [selected, order, moveToVal, applyOrder]);

  // ── Drag-and-drop handlers ────────────────────────────────────────────────

  const handleCardDragStart = useCallback((pos: number) => (e: React.DragEvent) => {
    e.dataTransfer.effectAllowed = "move";
    // Store position as text payload (backup for browsers that require it)
    e.dataTransfer.setData("text/plain", String(pos));
    setDragSrc(pos);
    setSelected(pos);
  }, []);

  const handleCardDragOver = useCallback((pos: number) => (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragSrc !== null && pos !== dragSrc) setDropTarget(pos);
  }, [dragSrc]);

  const handleCardDrop = useCallback((pos: number) => (e: React.DragEvent) => {
    e.preventDefault();
    if (dragSrc === null || dragSrc === pos) { setDropTarget(null); return; }
    const next = arrMove(order, dragSrc, pos);
    applyOrder(order, next);
    setSelected(pos);
    setDragSrc(null);
    setDropTarget(null);
  }, [dragSrc, order, applyOrder]);

  const handleCardDragEnd = useCallback(() => {
    setDragSrc(null);
    setDropTarget(null);
  }, []);

  // ── Save ─────────────────────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    if (!loadedFile || !order.length) return;
    setSaving(true);
    try {
      const bytes    = await saveReordered(loadedFile, order);
      const filename = loadedFile.name.replace(/\.pdf$/i, "") + "_reordered.pdf";
      downloadPdf(bytes, filename);
      setResultSize(bytes.byteLength);
      setDone(true);
    } catch {
      notify("error", "Failed to save the PDF. Please try again.");
    } finally {
      setSaving(false);
    }
  }, [loadedFile, order, notify]);

  const handleReset = useCallback(() => {
    setLoadedFile(null); setThumbs([]); setOrder([]); setHistory([]);
    setSelected(null); setDone(false); setNotif(null);
    setMoveToVal(""); setMoveToErr(false);
    if (inputRef.current) inputRef.current.value = "";
  }, []);

  // ── Derived ───────────────────────────────────────────────────────────────

  const thumbLoaded   = thumbs.length > 0;
  const thumbPct      = thumbProgress ? Math.round((thumbProgress.n / thumbProgress.total) * 100) : 0;
  const isChanged     = thumbLoaded && order.some((origIdx, pos) => origIdx !== pos);
  const canUndo       = history.length > 0;

  // Which positions have changed from the original?
  const changedSet = new Set(order.map((origIdx, pos) => origIdx !== pos ? pos : -1).filter((p) => p >= 0));

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="mb-12 flex flex-col gap-6">

      {/* ── Drop zone ──────────────────────────────────────────────────────── */}
      {!loadedFile && (
        <div
          ref={dropRef}
          onDrop={onFileDrop}
          onDragOver={onFileDragOver}
          onDragLeave={onFileDragLeave}
          onClick={() => inputRef.current?.click()}
          role="button" tabIndex={0}
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
          <div className="w-20 h-20 rounded-2xl flex items-center justify-center transition-all duration-300"
            style={{
              background: draggingOver ? "rgba(255,180,171,0.2)" : "rgba(255,180,171,0.1)",
              border: `1px solid ${draggingOver ? "rgba(255,180,171,0.45)" : "rgba(255,180,171,0.2)"}`,
            }}>
            <span className="material-symbols-outlined text-[38px]" style={{ color: "#ffb4ab" }}>
              {draggingOver ? "file_download" : "swap_vert"}
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
            {["Drag to reorder", "Click + move buttons", "Undo & reset", "Lossless quality", "No upload"].map((f) => (
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
            background: notif.type === "success" ? "rgba(34,197,94,0.12)" : notif.type === "warning" ? "rgba(250,204,21,0.10)" : "rgba(239,68,68,0.12)",
            border: `1px solid ${notif.type === "success" ? "rgba(34,197,94,0.3)" : notif.type === "warning" ? "rgba(250,204,21,0.3)" : "rgba(239,68,68,0.3)"}`,
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

            {/* File info + close */}
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: "rgba(255,180,171,0.1)", border: "1px solid rgba(255,180,171,0.2)" }}>
                <span className="material-symbols-outlined text-[18px] text-[#ffb4ab]">picture_as_pdf</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-bold text-[#e2e2e2] truncate">{loadedFile?.name}</p>
                <p className="text-[11px] text-[#5a4d63]">{fmt(loadedFile?.size ?? 0)} · {thumbs.length} pages</p>
              </div>
              <button onClick={handleReset} aria-label="Remove file"
                className="w-8 h-8 rounded-lg flex items-center justify-center opacity-50 hover:opacity-100 transition-opacity"
                style={{ background: "rgba(255,255,255,0.05)" }}>
                <span className="material-symbols-outlined text-[16px] text-[#988d9f]">close</span>
              </button>
            </div>

            <div className="h-px" style={{ background: "rgba(255,255,255,0.06)" }} />

            {/* Move controls — only shown when a card is selected */}
            {selected !== null ? (
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-[12px] font-semibold text-[#988d9f] uppercase tracking-wide mr-1">
                    Move page {order[selected] + 1}
                  </span>
                  <span className="text-[11px] text-[#5a4d63]">(position {selected + 1} of {order.length})</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {/* Move Up */}
                  <button onClick={() => moveSelected(-1)} disabled={selected === 0}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all disabled:opacity-35 disabled:cursor-not-allowed"
                    style={{ background: "rgba(255,180,171,0.08)", color: "#ffb4ab", border: "1px solid rgba(255,180,171,0.2)" }}
                    aria-label="Move page up one position">
                    <span className="material-symbols-outlined text-[14px]">keyboard_arrow_left</span>
                    Move Left
                  </button>
                  {/* Move Down */}
                  <button onClick={() => moveSelected(1)} disabled={selected === order.length - 1}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all disabled:opacity-35 disabled:cursor-not-allowed"
                    style={{ background: "rgba(255,180,171,0.08)", color: "#ffb4ab", border: "1px solid rgba(255,180,171,0.2)" }}
                    aria-label="Move page down one position">
                    Move Right
                    <span className="material-symbols-outlined text-[14px]">keyboard_arrow_right</span>
                  </button>
                  {/* Move to First */}
                  <button onClick={moveToFirst} disabled={selected === 0}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all disabled:opacity-35 disabled:cursor-not-allowed"
                    style={{ background: "rgba(255,255,255,0.05)", color: "#988d9f", border: "1px solid rgba(255,255,255,0.08)" }}
                    aria-label="Move page to first position">
                    <span className="material-symbols-outlined text-[14px]">first_page</span>
                    First
                  </button>
                  {/* Move to Last */}
                  <button onClick={moveToLast} disabled={selected === order.length - 1}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all disabled:opacity-35 disabled:cursor-not-allowed"
                    style={{ background: "rgba(255,255,255,0.05)", color: "#988d9f", border: "1px solid rgba(255,255,255,0.08)" }}
                    aria-label="Move page to last position">
                    Last
                    <span className="material-symbols-outlined text-[14px]">last_page</span>
                  </button>
                  {/* Deselect */}
                  <button onClick={() => setSelected(null)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all ml-auto"
                    style={{ background: "rgba(255,255,255,0.04)", color: "#5a4d63", border: "1px solid rgba(255,255,255,0.06)" }}>
                    <span className="material-symbols-outlined text-[14px]">close</span>
                    Deselect
                  </button>
                </div>
                {/* Move to position input */}
                <div className="flex items-center gap-2">
                  <label htmlFor="move-to-pos" className="text-[12px] text-[#5a4d63] font-semibold whitespace-nowrap">
                    Move to position
                  </label>
                  <input
                    id="move-to-pos"
                    type="number"
                    min={1}
                    max={order.length}
                    value={moveToVal}
                    onChange={(e) => { setMoveToVal(e.target.value); setMoveToErr(false); }}
                    onKeyDown={(e) => { if (e.key === "Enter") applyMoveTo(); }}
                    placeholder={`1–${order.length}`}
                    aria-invalid={moveToErr}
                    className="w-24 px-3 py-1.5 rounded-lg text-[13px] outline-none transition-all"
                    style={{
                      background: "rgba(255,255,255,0.05)",
                      border: `1px solid ${moveToErr ? "rgba(239,68,68,0.5)" : "rgba(255,255,255,0.1)"}`,
                      color: "#e2e2e2",
                    }}
                  />
                  <button onClick={applyMoveTo}
                    className="px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all"
                    style={{ background: "rgba(255,180,171,0.1)", color: "#ffb4ab", border: "1px solid rgba(255,180,171,0.2)" }}>
                    Go
                  </button>
                  {moveToErr && <span className="text-[11px] text-[#ef4444]">Invalid position</span>}
                </div>
              </div>
            ) : (
              <p className="text-[12px] text-[#5a4d63]">
                <span className="text-[#988d9f] font-semibold">Drag</span> thumbnails to reorder, or{" "}
                <span className="text-[#988d9f] font-semibold">click</span> a page to select it and use the move buttons.
              </p>
            )}

            <div className="h-px" style={{ background: "rgba(255,255,255,0.06)" }} />

            {/* History + save row */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Undo */}
              <button onClick={undo} disabled={!canUndo}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[13px] font-semibold transition-all disabled:opacity-35 disabled:cursor-not-allowed"
                style={{ background: "rgba(255,255,255,0.05)", color: "#988d9f", border: "1px solid rgba(255,255,255,0.08)" }}>
                <span className="material-symbols-outlined text-[16px]">undo</span>
                Undo
                {canUndo && <span className="text-[10px] opacity-60">({history.length})</span>}
              </button>
              {/* Reset */}
              <button onClick={reset} disabled={!isChanged}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[13px] font-semibold transition-all disabled:opacity-35 disabled:cursor-not-allowed"
                style={{ background: "rgba(255,255,255,0.05)", color: "#988d9f", border: "1px solid rgba(255,255,255,0.08)" }}>
                <span className="material-symbols-outlined text-[16px]">restart_alt</span>
                Reset Order
              </button>

              {/* Status */}
              <span className="text-[12px] ml-auto" style={{ color: isChanged ? "#ffb4ab" : "#5a4d63" }}>
                {isChanged ? `${changedSet.size} page${changedSet.size !== 1 ? "s" : ""} moved` : "Original order"}
              </span>

              {/* Save */}
              <button onClick={handleSave} disabled={saving || !isChanged}
                className="btn-primary flex items-center gap-2 px-5 py-2.5 rounded-xl text-[14px] font-bold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                {saving ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Saving…
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[16px]">download</span>
                    Save New Order
                  </>
                )}
              </button>
            </div>
          </div>

          {/* ── Thumbnail grid ───────────────────────────────────────────── */}
          <div
            className="glass-panel rounded-2xl p-5"
            role="group"
            aria-label="PDF pages — drag to reorder or click to select"
            // Prevent the browser's native drag-ghost from obscuring the indicator
            onDragOver={(e) => e.preventDefault()}
          >
            <p className="text-[11px] font-semibold text-[#5a4d63] mb-3 uppercase tracking-wide">
              {thumbs.length} pages · badges show new position · circle shows original page number
            </p>
            <div className="flex flex-wrap gap-4 justify-start" style={{ minHeight: THUMB_HEIGHT + 56 }}>
              {order.map((origIdx, pos) => (
                <PageCard
                  key={origIdx}
                  thumb={thumbs[origIdx]}
                  origIndex={origIdx}
                  position={pos}
                  selected={selected === pos}
                  dragging={dragSrc === pos}
                  dropBefore={dropTarget === pos && dragSrc !== null && dragSrc > pos}
                  dropAfter={dropTarget === pos && dragSrc !== null && dragSrc < pos}
                  changed={changedSet.has(pos)}
                  onSelect={() => setSelected((prev) => prev === pos ? null : pos)}
                  onDragStart={handleCardDragStart(pos)}
                  onDragOver={handleCardDragOver(pos)}
                  onDrop={handleCardDrop(pos)}
                  onDragEnd={handleCardDragEnd}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Done state ────────────────────────────────────────────────────── */}
      {done && (
        <div className="flex flex-col gap-4">
          <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))" }}>
            {[
              { icon: "swap_vert",   label: "Pages moved",  value: String(changedSet.size), color: "#ffb4ab" },
              { icon: "description", label: "Total pages",  value: String(thumbs.length),   color: "#4ade80" },
              { icon: "download",    label: "File size",    value: fmt(resultSize),          color: "#4cd7f6" },
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
                <p className="text-[15px] font-bold text-[#e2e2e2]">PDF reordered successfully</p>
                <p className="text-[12px] text-[#988d9f]">Lossless — original quality preserved</p>
              </div>
            </div>
            <div className="p-5 flex flex-col sm:flex-row gap-3">
              <button onClick={handleSave}
                className="btn-primary flex-1 text-white font-bold text-[15px] py-3.5 rounded-xl flex items-center justify-center gap-2">
                <span className="material-symbols-outlined text-[18px]">download</span>
                Download Again
              </button>
              <button onClick={handleReset}
                className="flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl text-[14px] font-semibold text-[#988d9f] hover:text-[#e2e2e2] transition-all"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <span className="material-symbols-outlined text-[16px]">upload_file</span>
                Reorder Another PDF
              </button>
            </div>
          </div>

          <div className="flex items-start gap-3 px-4 py-3.5 rounded-xl text-[13px]"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", color: "#5a4d63" }}>
            <span className="material-symbols-outlined text-[16px] mt-0.5 flex-shrink-0">info</span>
            <span>
              Pages are copied into the new order using pdf-lib — no re-rendering or re-compression occurs.
              Your file is processed entirely in your browser and never uploaded.
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
              { icon: "upload_file",   label: "1. Upload PDF",      desc: "Drag & drop or browse — every page appears as a numbered thumbnail" },
              { icon: "drag_indicator",label: "2. Rearrange Pages",  desc: "Drag thumbnails into any order, or click a page and use the move buttons" },
              { icon: "download",      label: "3. Download PDF",     desc: "Save the new page order as a lossless PDF instantly" },
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
