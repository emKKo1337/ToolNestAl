"use client";

/**
 * Organize PDF — unified browser-local PDF page editor
 *
 * Combines reorder + rotate + delete + duplicate into one session.
 *
 * State model:
 *   thumbs[i]     PageThumb for original page i (never mutated after load)
 *   pages         PageItem[] — ordered list of page slots; each slot has:
 *                   id       unique string (allows duplicate origIdx)
 *                   origIdx  which original page to render / copy
 *                   rotation cumulative degrees to add on save (0/90/180/270)
 *   selected      Set<string> of page ids currently selected
 *   history       stack of up to 20 previous pages snapshots (undo)
 *   dragSrcPos    grid position being dragged
 *   dropTargetPos grid position being hovered during drag
 *
 * Operations (all push to history):
 *   Reorder  — HTML5 DnD; arrMove(pages, dragSrc, dropTarget)
 *   Rotate   — increment item.rotation by ±90 or 180, mod 360
 *   Delete   — filter pages removing selected or specific id
 *   Duplicate— insert copy (new unique id, same origIdx/rotation) after source
 *   Batch    — rotate/delete/duplicate applied to all selected pages at once
 *
 * pdf-lib output:
 *   dst.copyPages(src, pages.map(p => p.origIdx))
 *   → for each copy apply (src page original rotation + item.rotation) % 360
 *   → dst.addPage() in order
 *   Lossless: no re-rendering.
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

interface PageItem {
  id:       string;   // unique across duplicates
  origIdx:  number;   // index into thumbs[] and source PDF pages
  rotation: number;   // cumulative added rotation: 0 | 90 | 180 | 270
}

type NotifType = "success" | "error" | "warning";
interface Notif { type: NotifType; msg: string }

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_BYTES   = 200 * 1024 * 1024;
const THUMB_H     = 168;
const THUMB_SCALE = 1.5;
const MAX_HISTORY = 20;

// ── ID counter (module-level, reset per file load) ────────────────────────────

let _idSeq = 0;
function nextId(origIdx: number) { return `pg${origIdx}_${_idSeq++}`; }

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1_048_576) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1_048_576).toFixed(2)} MB`;
}

function arrMove<T>(arr: T[], from: number, to: number): T[] {
  const n = [...arr];
  const [x] = n.splice(from, 1);
  n.splice(to, 0, x);
  return n;
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
    const scale = (THUMB_H * THUMB_SCALE) / vp1.height;
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

async function savePdf(file: File, pages: PageItem[]): Promise<Uint8Array> {
  const { PDFDocument, degrees } = await import("pdf-lib");
  const buf    = await file.arrayBuffer();
  const srcDoc = await PDFDocument.load(buf);
  const dstDoc = await PDFDocument.create();

  // copyPages handles duplicate origIdx correctly (each copy is independent)
  const copied = await dstDoc.copyPages(srcDoc, pages.map((p) => p.origIdx));

  pages.forEach((item, i) => {
    const origAngle = srcDoc.getPage(item.origIdx).getRotation().angle;
    const newAngle  = ((origAngle + item.rotation) % 360 + 360) % 360;
    copied[i].setRotation(degrees(newAngle));
    dstDoc.addPage(copied[i]);
  });

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
  item:        PageItem;
  thumb:       PageThumb;
  position:    number;   // 1-based display position
  selected:    boolean;
  dragging:    boolean;
  dropBefore:  boolean;
  dropAfter:   boolean;
  isDuplicate: boolean;
  onToggle:    () => void;
  onRotateL:   () => void;
  onRotateR:   () => void;
  onDuplicate: () => void;
  onDelete:    () => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragOver:  (e: React.DragEvent) => void;
  onDrop:      (e: React.DragEvent) => void;
  onDragEnd:   () => void;
}

function PageCard({
  item, thumb, position, selected, dragging,
  dropBefore, dropAfter, isDuplicate,
  onToggle, onRotateL, onRotateR, onDuplicate, onDelete,
  onDragStart, onDragOver, onDrop, onDragEnd,
}: PageCardProps) {
  const [hovered, setHovered] = useState(false);

  const dispH = THUMB_H;
  const dispW = Math.round((thumb.width / thumb.height) * THUMB_H);

  // Swap dimensions for 90°/270° so rotated image never clips box
  const r       = ((item.rotation % 360) + 360) % 360;
  const swapped = r === 90 || r === 270;
  const boxW    = (swapped ? dispH : dispW) + 16;
  const boxH    = (swapped ? dispW : dispH) + 16;

  return (
    <div className="relative flex flex-col items-center gap-1.5" style={{ flexShrink: 0 }}>
      {/* Insert-before line */}
      {dropBefore && (
        <div className="absolute left-0 top-0 bottom-6 w-0.5 rounded-full z-20 pointer-events-none"
          style={{ background: "#ffb4ab", boxShadow: "0 0 6px rgba(255,180,171,0.8)" }} />
      )}
      {/* Insert-after line */}
      {dropAfter && (
        <div className="absolute right-0 top-0 bottom-6 w-0.5 rounded-full z-20 pointer-events-none"
          style={{ background: "#ffb4ab", boxShadow: "0 0 6px rgba(255,180,171,0.8)" }} />
      )}

      {/* Card */}
      <div
        draggable
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onDragEnd={onDragEnd}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className="relative rounded-xl overflow-hidden transition-all duration-150 cursor-grab active:cursor-grabbing outline-none focus-visible:ring-2 focus-visible:ring-[#ffb4ab]"
        style={{
          width:      boxW,
          height:     boxH,
          background: selected ? "rgba(255,180,171,0.14)" : "rgba(255,255,255,0.04)",
          border:     `2px solid ${selected ? "#ffb4ab" : "rgba(255,255,255,0.08)"}`,
          opacity:    dragging ? 0.35 : 1,
          transform:  dragging ? "scale(0.96)" : "scale(1)",
          display:    "flex",
          alignItems: "center",
          justifyContent: "center",
          userSelect: "none",
        }}
        onClick={onToggle}
        role="button"
        tabIndex={0}
        aria-pressed={selected}
        aria-label={`Page ${position} (original ${item.origIdx + 1})${item.rotation ? ` rotated ${item.rotation}°` : ""}${isDuplicate ? " (duplicate)" : ""}`}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onToggle(); }}
      >
        {/* Thumbnail — CSS rotated for live preview */}
        <img
          src={thumb.dataUrl}
          alt={`Page ${position}`}
          draggable={false}
          style={{
            width:  dispW,
            height: dispH,
            objectFit: "cover",
            borderRadius: 4,
            display: "block",
            transform: `rotate(${item.rotation}deg)`,
            transition: "transform 0.25s ease",
          }}
        />

        {/* Position badge */}
        <span
          className="absolute top-1.5 left-1.5 min-w-[22px] h-[22px] px-1 rounded-full flex items-center justify-center text-[11px] font-black"
          style={{ background: selected ? "#ffb4ab" : "rgba(0,0,0,0.55)", color: selected ? "#131313" : "#fff" }}
        >
          {position}
        </span>

        {/* Selected tick */}
        {selected && (
          <span className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center"
            style={{ background: "#ffb4ab" }}>
            <span className="material-symbols-outlined text-[12px] text-[#131313] font-black">check</span>
          </span>
        )}

        {/* Rotation badge */}
        {item.rotation !== 0 && (
          <span className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded text-[10px] font-bold"
            style={{ background: "rgba(76,215,246,0.85)", color: "#131313" }}>
            {item.rotation}°
          </span>
        )}

        {/* Duplicate badge */}
        {isDuplicate && (
          <span className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded text-[10px] font-bold"
            style={{ background: "rgba(74,222,128,0.85)", color: "#131313" }}>
            copy
          </span>
        )}

        {/* Hover action bar */}
        {hovered && !dragging && (
          <div
            className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 py-1.5"
            style={{ background: "linear-gradient(to top, rgba(19,19,19,0.92) 0%, transparent 100%)" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Rotate L */}
            <button
              onClick={(e) => { e.stopPropagation(); onRotateL(); }}
              title="Rotate left 90°"
              className="w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:scale-110"
              style={{ background: "rgba(255,180,171,0.2)", color: "#ffb4ab" }}
              aria-label="Rotate left"
            >
              <span className="material-symbols-outlined text-[15px]">rotate_left</span>
            </button>
            {/* Rotate R */}
            <button
              onClick={(e) => { e.stopPropagation(); onRotateR(); }}
              title="Rotate right 90°"
              className="w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:scale-110"
              style={{ background: "rgba(255,180,171,0.2)", color: "#ffb4ab" }}
              aria-label="Rotate right"
            >
              <span className="material-symbols-outlined text-[15px]">rotate_right</span>
            </button>
            {/* Duplicate */}
            <button
              onClick={(e) => { e.stopPropagation(); onDuplicate(); }}
              title="Duplicate page"
              className="w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:scale-110"
              style={{ background: "rgba(74,222,128,0.2)", color: "#4ade80" }}
              aria-label="Duplicate page"
            >
              <span className="material-symbols-outlined text-[15px]">content_copy</span>
            </button>
            {/* Delete */}
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              title="Delete page"
              className="w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:scale-110"
              style={{ background: "rgba(255,107,107,0.2)", color: "#ff6b6b" }}
              aria-label="Delete page"
            >
              <span className="material-symbols-outlined text-[15px]">delete</span>
            </button>
          </div>
        )}
      </div>

      {/* Label */}
      <span className="text-[11px] font-semibold"
        style={{ color: selected ? "#ffb4ab" : "#5a4d63" }}>
        p.{item.origIdx + 1}
      </span>
    </div>
  );
}

// ── Toolbar action button ─────────────────────────────────────────────────────

function ActionBtn({
  icon, label, onClick, color = "#ffb4ab", bg = "rgba(255,180,171,0.09)",
  border = "rgba(255,180,171,0.22)", disabled = false,
}: {
  icon: string; label: string; onClick: () => void;
  color?: string; bg?: string; border?: string; disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all disabled:opacity-35 disabled:cursor-not-allowed"
      style={{ background: bg, color, border: `1px solid ${border}` }}
      aria-label={label}
    >
      <span className="material-symbols-outlined text-[15px]">{icon}</span>
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function OrganizePdfTool() {
  const [draggingOver, setDraggingOver]   = useState(false);
  const [loadedFile, setLoadedFile]       = useState<File | null>(null);
  const [thumbs, setThumbs]               = useState<PageThumb[]>([]);
  const [thumbLoading, setThumbLoading]   = useState(false);
  const [thumbProgress, setThumbProgress] = useState<{ n: number; total: number } | null>(null);

  const [pages, setPages]       = useState<PageItem[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [history, setHistory]   = useState<PageItem[][]>([]);

  const [dragSrcPos, setDragSrcPos]       = useState<number | null>(null);
  const [dropTargetPos, setDropTargetPos] = useState<number | null>(null);

  const [saving, setSaving]     = useState(false);
  const [done, setDone]         = useState(false);
  const [resultSize, setResultSize] = useState(0);

  const [notif, setNotif] = useState<Notif | null>(null);

  const dropRef  = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const notify = useCallback((type: NotifType, msg: string) => {
    setNotif({ type, msg });
    setTimeout(() => setNotif(null), 7000);
  }, []);

  // ── History ───────────────────────────────────────────────────────────────

  const commit = useCallback((prev: PageItem[], next: PageItem[]) => {
    setHistory((h) => [...h.slice(-MAX_HISTORY + 1), prev]);
    setPages(next);
  }, []);

  const undo = useCallback(() => {
    setHistory((h) => {
      if (!h.length) return h;
      const prev = h[h.length - 1];
      setPages(prev);
      setSelected(new Set());
      return h.slice(0, -1);
    });
  }, []);

  const reset = useCallback((current: PageItem[], origThumbs: PageThumb[]) => {
    const original = origThumbs.map((_, i) => ({ id: nextId(i), origIdx: i, rotation: 0 }));
    commit(current, original);
    setSelected(new Set());
  }, [commit]);

  // ── File ingestion ────────────────────────────────────────────────────────

  const handleFile = useCallback(async (file: File) => {
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      notify("error", `"${file.name}" is not a PDF.`); return;
    }
    if (file.size > MAX_BYTES) {
      notify("error", `File exceeds the 200 MB limit (${fmt(file.size)}).`); return;
    }

    _idSeq = 0;
    setLoadedFile(file);
    setThumbs([]); setPages([]); setSelected(new Set()); setHistory([]);
    setDone(false); setNotif(null); setThumbLoading(true); setThumbProgress(null);

    try {
      const result = await renderThumbs(file, (n, total) => setThumbProgress({ n, total }));
      setThumbs(result);
      setPages(result.map((_, i) => ({ id: nextId(i), origIdx: i, rotation: 0 })));
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

  // ── Page mutations ────────────────────────────────────────────────────────

  // Rotate a specific page id by delta degrees
  const rotatePage = useCallback((id: string, delta: number) => {
    setPages((prev) => {
      const next = prev.map((p) =>
        p.id === id ? { ...p, rotation: ((p.rotation + delta) % 360 + 360) % 360 } : p
      );
      setHistory((h) => [...h.slice(-MAX_HISTORY + 1), prev]);
      return next;
    });
  }, []);

  // Rotate all selected pages
  const rotateSelected = useCallback((delta: number) => {
    if (!selected.size) return;
    setPages((prev) => {
      const next = prev.map((p) =>
        selected.has(p.id) ? { ...p, rotation: ((p.rotation + delta) % 360 + 360) % 360 } : p
      );
      setHistory((h) => [...h.slice(-MAX_HISTORY + 1), prev]);
      return next;
    });
  }, [selected]);

  // Duplicate a specific page id (insert copy immediately after)
  const duplicatePage = useCallback((id: string) => {
    setPages((prev) => {
      const idx  = prev.findIndex((p) => p.id === id);
      if (idx === -1) return prev;
      const src  = prev[idx];
      const copy = { ...src, id: nextId(src.origIdx) };
      const next = [...prev.slice(0, idx + 1), copy, ...prev.slice(idx + 1)];
      setHistory((h) => [...h.slice(-MAX_HISTORY + 1), prev]);
      return next;
    });
  }, []);

  // Duplicate all selected pages (insert copies after their last selected page)
  const duplicateSelected = useCallback(() => {
    if (!selected.size) return;
    setPages((prev) => {
      const copies: PageItem[] = [];
      const next = prev.flatMap((p) => {
        if (!selected.has(p.id)) return [p];
        const copy = { ...p, id: nextId(p.origIdx) };
        copies.push(copy);
        return [p, copy];
      });
      setHistory((h) => [...h.slice(-MAX_HISTORY + 1), prev]);
      setSelected(new Set(copies.map((c) => c.id)));
      return next;
    });
  }, [selected]);

  // Delete a specific page id
  const deletePage = useCallback((id: string) => {
    setPages((prev) => {
      if (prev.length <= 1) { notify("error", "Cannot delete the last page."); return prev; }
      const next = prev.filter((p) => p.id !== id);
      setHistory((h) => [...h.slice(-MAX_HISTORY + 1), prev]);
      setSelected((s) => { const ns = new Set(s); ns.delete(id); return ns; });
      return next;
    });
  }, [notify]);

  // Delete all selected pages
  const deleteSelected = useCallback(() => {
    if (!selected.size) return;
    setPages((prev) => {
      const next = prev.filter((p) => !selected.has(p.id));
      if (next.length === 0) { notify("error", "Cannot delete all pages — at least one must remain."); return prev; }
      setHistory((h) => [...h.slice(-MAX_HISTORY + 1), prev]);
      setSelected(new Set());
      return next;
    });
  }, [selected, notify]);

  // ── Selection ─────────────────────────────────────────────────────────────

  const toggleSelect = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const selectAll   = useCallback(() => setSelected(new Set(pages.map((p) => p.id))), [pages]);
  const deselectAll = useCallback(() => setSelected(new Set()), []);

  // ── Drag-and-drop (single page move) ─────────────────────────────────────

  const handleDragStart = useCallback((pos: number) => (e: React.DragEvent) => {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(pos));
    setDragSrcPos(pos);
  }, []);

  const handleDragOver = useCallback((pos: number) => (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragSrcPos !== null && pos !== dragSrcPos) setDropTargetPos(pos);
  }, [dragSrcPos]);

  const handleDrop = useCallback((pos: number) => (e: React.DragEvent) => {
    e.preventDefault();
    if (dragSrcPos === null || dragSrcPos === pos) { setDropTargetPos(null); return; }
    commit(pages, arrMove(pages, dragSrcPos, pos));
    setDragSrcPos(null); setDropTargetPos(null);
  }, [dragSrcPos, pages, commit]);

  const handleDragEnd = useCallback(() => {
    setDragSrcPos(null); setDropTargetPos(null);
  }, []);

  // ── Move selected via buttons ─────────────────────────────────────────────

  const moveSelectedDir = useCallback((delta: -1 | 1) => {
    if (!selected.size) return;
    setPages((prev) => {
      // Collect positions of selected pages, sorted appropriately
      const positions = prev
        .map((p, i) => ({ id: p.id, i }))
        .filter((x) => selected.has(x.id))
        .map((x) => x.i);

      if (delta === -1 && positions[0] === 0) return prev;
      if (delta ===  1 && positions[positions.length - 1] === prev.length - 1) return prev;

      let next = [...prev];
      // Move in order that avoids displacement: ascending for +1, descending for -1
      const sorted = delta === 1 ? [...positions].reverse() : positions;
      for (const pos of sorted) {
        const target = pos + delta;
        if (target < 0 || target >= next.length) continue;
        [next[pos], next[target]] = [next[target], next[pos]];
      }
      setHistory((h) => [...h.slice(-MAX_HISTORY + 1), prev]);
      return next;
    });
  }, [selected]);

  // ── Save ─────────────────────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    if (!loadedFile || !pages.length) return;
    setSaving(true);
    try {
      const bytes    = await savePdf(loadedFile, pages);
      const filename = loadedFile.name.replace(/\.pdf$/i, "") + "_organized.pdf";
      downloadPdf(bytes, filename);
      setResultSize(bytes.byteLength);
      setDone(true);
    } catch {
      notify("error", "Failed to save the PDF. Please try again.");
    } finally {
      setSaving(false);
    }
  }, [loadedFile, pages, notify]);

  const handleReset = useCallback(() => {
    setLoadedFile(null); setThumbs([]); setPages([]); setSelected(new Set());
    setHistory([]); setDone(false); setNotif(null);
    if (inputRef.current) inputRef.current.value = "";
  }, []);

  // ── Derived state ─────────────────────────────────────────────────────────

  const thumbLoaded  = thumbs.length > 0 && pages.length > 0;
  const thumbPct     = thumbProgress ? Math.round((thumbProgress.n / thumbProgress.total) * 100) : 0;
  const canUndo      = history.length > 0;
  const hasChanges   = pages.some((p, i) =>
    p.origIdx !== i || p.rotation !== 0 || pages.length !== thumbs.length
  );
  const noneSelected = selected.size === 0;
  const allSelected  = selected.size === pages.length && pages.length > 0;

  // Track which origIdx values have appeared more than once (duplicates)
  const origCount = new Map<number, number>();
  pages.forEach((p) => origCount.set(p.origIdx, (origCount.get(p.origIdx) ?? 0) + 1));
  const isDuplicate = (p: PageItem) => (origCount.get(p.origIdx) ?? 0) > 1;

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
              {draggingOver ? "file_download" : "tune"}
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
            {["Drag to reorder", "Rotate pages", "Delete pages", "Duplicate pages", "No upload"].map((f) => (
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

      {/* ── Loading progress ──────────────────────────────────────────────── */}
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
        <div className="flex flex-col gap-4">

          {/* ── Toolbar ─────────────────────────────────────────────────── */}
          <div className="glass-panel rounded-2xl p-4 flex flex-col gap-3">

            {/* File info */}
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: "rgba(255,180,171,0.1)", border: "1px solid rgba(255,180,171,0.2)" }}>
                <span className="material-symbols-outlined text-[18px] text-[#ffb4ab]">picture_as_pdf</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-bold text-[#e2e2e2] truncate">{loadedFile?.name}</p>
                <p className="text-[11px] text-[#5a4d63]">
                  {fmt(loadedFile?.size ?? 0)} · {thumbs.length} original pages · {pages.length} current
                </p>
              </div>
              <button onClick={handleReset} aria-label="Remove file"
                className="w-8 h-8 rounded-lg flex items-center justify-center opacity-50 hover:opacity-100 transition-opacity"
                style={{ background: "rgba(255,255,255,0.05)" }}>
                <span className="material-symbols-outlined text-[16px] text-[#988d9f]">close</span>
              </button>
            </div>

            <div className="h-px" style={{ background: "rgba(255,255,255,0.06)" }} />

            {/* Selection row */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-semibold text-[#988d9f] uppercase tracking-wide mr-1">Select</span>
              <button onClick={allSelected ? deselectAll : selectAll}
                className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all"
                style={{
                  background: allSelected ? "rgba(255,180,171,0.15)" : "rgba(255,255,255,0.06)",
                  color:  allSelected ? "#ffb4ab" : "#988d9f",
                  border: `1px solid ${allSelected ? "rgba(255,180,171,0.35)" : "rgba(255,255,255,0.08)"}`,
                }}>
                {allSelected ? "Deselect All" : "Select All"}
              </button>
              {!noneSelected && (
                <span className="text-[12px]" style={{ color: "#ffb4ab" }}>
                  {selected.size} selected
                </span>
              )}
            </div>

            {/* Batch actions (visible when pages are selected) */}
            {!noneSelected && (
              <>
                <div className="h-px" style={{ background: "rgba(255,255,255,0.06)" }} />
                <div className="flex flex-wrap gap-2 items-center">
                  <span className="text-[11px] font-semibold text-[#988d9f] uppercase tracking-wide mr-1">
                    Batch ({selected.size})
                  </span>
                  <ActionBtn icon="rotate_left"    label="Rotate L"   onClick={() => rotateSelected(-90)} />
                  <ActionBtn icon="rotate_right"   label="Rotate R"   onClick={() => rotateSelected(90)} />
                  <ActionBtn icon="content_copy"   label="Duplicate"  onClick={duplicateSelected}
                    color="#4ade80" bg="rgba(74,222,128,0.09)" border="rgba(74,222,128,0.22)" />
                  <ActionBtn icon="delete"         label="Delete"     onClick={deleteSelected}
                    color="#ff6b6b" bg="rgba(255,107,107,0.09)" border="rgba(255,107,107,0.25)" />
                  <div className="h-4 w-px mx-1" style={{ background: "rgba(255,255,255,0.1)" }} />
                  <ActionBtn icon="keyboard_arrow_left"  label="Move L" onClick={() => moveSelectedDir(-1)} />
                  <ActionBtn icon="keyboard_arrow_right" label="Move R" onClick={() => moveSelectedDir(1)} />
                </div>
              </>
            )}

            {!noneSelected && <div className="h-px" style={{ background: "rgba(255,255,255,0.06)" }} />}

            {/* History + save row */}
            <div className="flex flex-wrap items-center gap-2">
              <button onClick={undo} disabled={!canUndo}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all disabled:opacity-35 disabled:cursor-not-allowed"
                style={{ background: "rgba(255,255,255,0.05)", color: "#988d9f", border: "1px solid rgba(255,255,255,0.08)" }}>
                <span className="material-symbols-outlined text-[15px]">undo</span>
                Undo {canUndo ? `(${history.length})` : ""}
              </button>
              <button onClick={() => reset(pages, thumbs)} disabled={!hasChanges}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all disabled:opacity-35 disabled:cursor-not-allowed"
                style={{ background: "rgba(255,255,255,0.05)", color: "#988d9f", border: "1px solid rgba(255,255,255,0.08)" }}>
                <span className="material-symbols-outlined text-[15px]">restart_alt</span>
                Reset
              </button>
              <span className="text-[11px] ml-auto" style={{ color: "#5a4d63" }}>
                {pages.length} page{pages.length !== 1 ? "s" : ""}
                {pages.length !== thumbs.length ? ` (orig: ${thumbs.length})` : ""}
              </span>
              <button
                onClick={handleSave}
                disabled={saving || !hasChanges}
                className="btn-primary flex items-center gap-2 px-5 py-2 rounded-xl text-[13px] font-bold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Saving…
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[15px]">download</span>
                    Save PDF
                  </>
                )}
              </button>
            </div>

            {/* Hint */}
            {noneSelected && !hasChanges && (
              <p className="text-[11px] text-[#5a4d63]">
                Hover any thumbnail for quick actions · click to select · drag to reorder
              </p>
            )}
          </div>

          {/* ── Thumbnail grid ───────────────────────────────────────────── */}
          <div
            className="glass-panel rounded-2xl p-5"
            role="group"
            aria-label="PDF pages — drag to reorder, hover for actions, click to select"
            onDragOver={(e) => e.preventDefault()}
          >
            <div className="flex flex-wrap gap-4 justify-start" style={{ minHeight: THUMB_H + 56 }}>
              {pages.map((item, pos) => (
                <PageCard
                  key={item.id}
                  item={item}
                  thumb={thumbs[item.origIdx]}
                  position={pos + 1}
                  selected={selected.has(item.id)}
                  dragging={dragSrcPos === pos}
                  dropBefore={dropTargetPos === pos && dragSrcPos !== null && dragSrcPos > pos}
                  dropAfter={dropTargetPos === pos && dragSrcPos !== null && dragSrcPos < pos}
                  isDuplicate={isDuplicate(item)}
                  onToggle={() => toggleSelect(item.id)}
                  onRotateL={() => rotatePage(item.id, -90)}
                  onRotateR={() => rotatePage(item.id, 90)}
                  onDuplicate={() => duplicatePage(item.id)}
                  onDelete={() => deletePage(item.id)}
                  onDragStart={handleDragStart(pos)}
                  onDragOver={handleDragOver(pos)}
                  onDrop={handleDrop(pos)}
                  onDragEnd={handleDragEnd}
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
              { icon: "description", label: "Pages in PDF",   value: String(pages.length),  color: "#ffb4ab" },
              { icon: "source",      label: "Original pages", value: String(thumbs.length),  color: "#4cd7f6" },
              { icon: "download",    label: "File size",      value: fmt(resultSize),         color: "#4ade80" },
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
                <p className="text-[15px] font-bold text-[#e2e2e2]">PDF organized and saved</p>
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
                Organize Another PDF
              </button>
            </div>
          </div>

          <div className="flex items-start gap-3 px-4 py-3.5 rounded-xl text-[13px]"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", color: "#5a4d63" }}>
            <span className="material-symbols-outlined text-[16px] mt-0.5 flex-shrink-0">info</span>
            <span>
              Pages are copied losslessly via pdf-lib — no re-rendering or re-compression.
              Your file is processed entirely in your browser and never uploaded to any server.
            </span>
          </div>
        </div>
      )}

      {/* ── How it works ──────────────────────────────────────────────────── */}
      {!loadedFile && !thumbLoading && (
        <div className="glass-panel rounded-2xl p-6 flex flex-col gap-3">
          <p className="text-[12px] font-semibold text-[#988d9f] uppercase tracking-[0.08em]">How it works</p>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            {[
              { icon: "upload_file",   label: "1. Upload",    desc: "Drop your PDF — all pages appear as thumbnails" },
              { icon: "drag_indicator",label: "2. Reorder",   desc: "Drag thumbnails into any order" },
              { icon: "tune",          label: "3. Edit",      desc: "Hover pages to rotate, duplicate, or delete" },
              { icon: "download",      label: "4. Download",  desc: "Save the organized PDF losslessly" },
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
