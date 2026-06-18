"use client";

import { useState, useRef, useCallback, useId } from "react";
import { PDFDocument } from "pdf-lib";

const MAX_FILES = 50;
const MAX_FILE_BYTES = 100 * 1024 * 1024; // 100 MB

interface PdfFile {
  id: string;
  file: File;
  name: string;
  size: number;
  pageCount: number | null;
}

type NotificationType = "success" | "error";
interface Notification {
  type: NotificationType;
  message: string;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function getPageCount(file: File): Promise<number | null> {
  try {
    const buf = await file.arrayBuffer();
    const pdf = await PDFDocument.load(buf, { ignoreEncryption: true });
    return pdf.getPageCount();
  } catch {
    return null;
  }
}

// ─── Drag-handle icon ──────────────────────────────────────────────────────────
function DragHandle() {
  return (
    <span
      className="material-symbols-outlined text-[20px] text-[#4d4354] cursor-grab active:cursor-grabbing select-none"
      aria-hidden="true"
    >
      drag_indicator
    </span>
  );
}

export default function MergePdfTool() {
  const [files, setFiles] = useState<PdfFile[]>([]);
  const [draggingOver, setDraggingOver] = useState(false);
  const [merging, setMerging] = useState(false);
  const [notification, setNotification] = useState<Notification | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const uid = useId();

  const notify = useCallback((type: NotificationType, message: string) => {
    setNotification({ type, message });
    const t = setTimeout(() => setNotification(null), 5000);
    return () => clearTimeout(t);
  }, []);

  const addFiles = useCallback(
    async (incoming: FileList | File[]) => {
      const arr = Array.from(incoming);
      const valid: File[] = [];
      const errors: string[] = [];

      for (const f of arr) {
        if (f.type !== "application/pdf" && !f.name.toLowerCase().endsWith(".pdf")) {
          errors.push(`"${f.name}" is not a PDF file.`);
          continue;
        }
        if (f.size > MAX_FILE_BYTES) {
          errors.push(`"${f.name}" exceeds the 100 MB limit.`);
          continue;
        }
        valid.push(f);
      }

      if (errors.length) {
        notify("error", errors.slice(0, 2).join(" ") + (errors.length > 2 ? ` (+${errors.length - 2} more)` : ""));
      }

      if (!valid.length) return;

      setFiles((prev) => {
        const remaining = MAX_FILES - prev.length;
        if (remaining <= 0) {
          notify("error", `Maximum ${MAX_FILES} files allowed.`);
          return prev;
        }
        if (valid.length > remaining) {
          notify("error", `Only ${remaining} more file(s) can be added (max ${MAX_FILES}).`);
        }
        const slice = valid.slice(0, remaining);
        const newEntries: PdfFile[] = slice.map((f) => ({
          id: `${uid}-${Date.now()}-${Math.random()}`,
          file: f,
          name: f.name,
          size: f.size,
          pageCount: null,
        }));
        const next = [...prev, ...newEntries];
        // Async-load page counts
        newEntries.forEach((entry) => {
          getPageCount(entry.file).then((count) => {
            setFiles((cur) =>
              cur.map((c) => (c.id === entry.id ? { ...c, pageCount: count } : c))
            );
          });
        });
        return next;
      });
    },
    [notify, uid]
  );

  // ── Drop zone events ──────────────────────────────────────────────────────────
  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDraggingOver(false);
      addFiles(e.dataTransfer.files);
    },
    [addFiles]
  );

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDraggingOver(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    if (dropZoneRef.current && !dropZoneRef.current.contains(e.relatedTarget as Node)) {
      setDraggingOver(false);
    }
  }, []);

  // ── File list drag-to-reorder ─────────────────────────────────────────────────
  const onItemDragStart = useCallback((e: React.DragEvent, index: number) => {
    setDragIndex(index);
    e.dataTransfer.effectAllowed = "move";
  }, []);

  const onItemDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === index) return;
    setDragOverIndex(index);
  }, [dragIndex]);

  const onItemDrop = useCallback(
    (e: React.DragEvent, dropIdx: number) => {
      e.preventDefault();
      if (dragIndex === null || dragIndex === dropIdx) {
        setDragIndex(null);
        setDragOverIndex(null);
        return;
      }
      setFiles((prev) => {
        const next = [...prev];
        const [moved] = next.splice(dragIndex, 1);
        next.splice(dropIdx, 0, moved);
        return next;
      });
      setDragIndex(null);
      setDragOverIndex(null);
    },
    [dragIndex]
  );

  const onItemDragEnd = useCallback(() => {
    setDragIndex(null);
    setDragOverIndex(null);
  }, []);

  // ── Remove file ───────────────────────────────────────────────────────────────
  const removeFile = useCallback((id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  }, []);

  // ── Merge ─────────────────────────────────────────────────────────────────────
  const merge = useCallback(async () => {
    if (files.length < 2) {
      notify("error", "Add at least 2 PDF files to merge.");
      return;
    }
    setMerging(true);
    setNotification(null);
    try {
      const merged = await PDFDocument.create();
      for (const entry of files) {
        const buf = await entry.file.arrayBuffer();
        const doc = await PDFDocument.load(buf, { ignoreEncryption: true });
        const pages = await merged.copyPages(doc, doc.getPageIndices());
        pages.forEach((p) => merged.addPage(p));
      }
      const bytes = await merged.save();
      // pdf-lib returns Uint8Array<ArrayBufferLike>; copy into a plain ArrayBuffer for Blob compatibility
      const plainBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
      const blob = new Blob([plainBuffer], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "merged.pdf";
      a.click();
      URL.revokeObjectURL(url);
      notify("success", `Successfully merged ${files.length} PDFs into one file.`);
    } catch (err) {
      notify("error", err instanceof Error ? err.message : "Merge failed. One or more files may be corrupted or password-protected.");
    } finally {
      setMerging(false);
    }
  }, [files, notify]);

  const reset = useCallback(() => {
    setFiles([]);
    setNotification(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const totalPages = files.reduce((s, f) => s + (f.pageCount ?? 0), 0);
  const totalSize = files.reduce((s, f) => s + f.size, 0);

  return (
    <div className="mb-12 flex flex-col gap-6">
      {/* Drop Zone */}
      <div
        ref={dropZoneRef}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onClick={() => fileInputRef.current?.click()}
        role="button"
        tabIndex={0}
        aria-label="Upload PDF files — click or drag and drop"
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click(); }}
        className="glass-panel rounded-2xl flex flex-col items-center justify-center gap-4 p-10 md:p-14 cursor-pointer transition-all duration-300 select-none outline-none focus-visible:ring-2 focus-visible:ring-[#ddb7ff]"
        style={{
          border: `2px dashed ${draggingOver ? "#ddb7ff" : "rgba(255,255,255,0.12)"}`,
          background: draggingOver ? "rgba(221,183,255,0.06)" : undefined,
          transform: draggingOver ? "scale(1.01)" : "scale(1)",
        }}
      >
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-300"
          style={{
            background: draggingOver ? "rgba(221,183,255,0.2)" : "rgba(255,180,171,0.1)",
            border: `1px solid ${draggingOver ? "rgba(221,183,255,0.4)" : "rgba(255,180,171,0.2)"}`,
          }}
        >
          <span
            className="material-symbols-outlined text-[32px] transition-colors duration-300"
            style={{ color: draggingOver ? "#ddb7ff" : "#ffb4ab" }}
            aria-hidden="true"
          >
            {draggingOver ? "file_download" : "upload_file"}
          </span>
        </div>
        <div className="text-center">
          <p className="text-[17px] font-bold text-[#e2e2e2] mb-1">
            {draggingOver ? "Drop your PDFs here" : "Drag & drop PDF files here"}
          </p>
          <p className="text-[14px] text-[#988d9f]">
            or <span className="text-[#ddb7ff] font-semibold">click to browse</span> — up to {MAX_FILES} files, 100 MB each
          </p>
        </div>
        <input
          ref={fileInputRef}
          id={`${uid}-input`}
          type="file"
          accept="application/pdf,.pdf"
          multiple
          className="sr-only"
          onChange={(e) => { if (e.target.files) addFiles(e.target.files); }}
          aria-hidden="true"
          tabIndex={-1}
        />
      </div>

      {/* Notification */}
      {notification && (
        <div
          role="alert"
          className="flex items-center gap-3 px-5 py-4 rounded-xl text-[14px] font-medium transition-all duration-300 animate-in fade-in slide-in-from-top-2"
          style={{
            background: notification.type === "success" ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)",
            border: `1px solid ${notification.type === "success" ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`,
            color: notification.type === "success" ? "#22c55e" : "#ef4444",
          }}
        >
          <span className="material-symbols-outlined text-[20px]">
            {notification.type === "success" ? "check_circle" : "error"}
          </span>
          <span className="flex-1">{notification.message}</span>
          <button
            onClick={() => setNotification(null)}
            className="opacity-60 hover:opacity-100 transition-opacity"
            aria-label="Dismiss notification"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
      )}

      {/* File List */}
      {files.length > 0 && (
        <div className="glass-panel rounded-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(255,255,255,0.06)]">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-[20px] text-[#ffb4ab]">picture_as_pdf</span>
              <span className="text-[15px] font-bold text-[#e2e2e2]">
                {files.length} file{files.length !== 1 ? "s" : ""}
              </span>
              <span className="text-[13px] text-[#988d9f]">
                · {formatBytes(totalSize)}
                {totalPages > 0 && ` · ${totalPages} page${totalPages !== 1 ? "s" : ""}`}
              </span>
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-semibold text-[#ddb7ff] transition-all"
              style={{ background: "rgba(221,183,255,0.1)", border: "1px solid rgba(221,183,255,0.2)" }}
            >
              <span className="material-symbols-outlined text-[15px]">add</span>
              Add more
            </button>
          </div>

          {/* Hint */}
          <div className="px-5 py-2.5 bg-[rgba(255,255,255,0.02)] border-b border-[rgba(255,255,255,0.04)]">
            <p className="text-[12px] text-[#4d4354] flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[14px]">info</span>
              Drag rows to reorder — the merged PDF will follow this sequence
            </p>
          </div>

          {/* Rows */}
          <ol className="divide-y divide-[rgba(255,255,255,0.04)]" aria-label="PDF files to merge">
            {files.map((f, i) => (
              <li
                key={f.id}
                draggable
                onDragStart={(e) => onItemDragStart(e, i)}
                onDragOver={(e) => onItemDragOver(e, i)}
                onDrop={(e) => onItemDrop(e, i)}
                onDragEnd={onItemDragEnd}
                className="flex items-center gap-3 px-5 py-3.5 transition-all duration-150"
                style={{
                  opacity: dragIndex === i ? 0.4 : 1,
                  background: dragOverIndex === i && dragIndex !== i
                    ? "rgba(221,183,255,0.06)"
                    : undefined,
                  borderTop: dragOverIndex === i && dragIndex !== null && dragIndex !== i
                    ? "2px solid rgba(221,183,255,0.5)"
                    : undefined,
                }}
                aria-label={`${f.name}, ${formatBytes(f.size)}${f.pageCount !== null ? `, ${f.pageCount} page${f.pageCount !== 1 ? "s" : ""}` : ""}`}
              >
                {/* Sequence number */}
                <span
                  className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-[12px] font-bold"
                  style={{ background: "rgba(255,180,171,0.12)", color: "#ffb4ab" }}
                  aria-hidden="true"
                >
                  {i + 1}
                </span>

                <DragHandle />

                {/* File info */}
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-semibold text-[#e2e2e2] truncate" title={f.name}>
                    {f.name}
                  </p>
                  <p className="text-[12px] text-[#988d9f]">
                    {formatBytes(f.size)}
                    {f.pageCount !== null && (
                      <> · {f.pageCount} page{f.pageCount !== 1 ? "s" : ""}</>
                    )}
                    {f.pageCount === null && <> · reading…</>}
                  </p>
                </div>

                {/* Remove */}
                <button
                  onClick={() => removeFile(f.id)}
                  className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-[#4d4354] hover:text-[#ef4444] hover:bg-[rgba(239,68,68,0.1)] transition-all"
                  aria-label={`Remove ${f.name}`}
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Actions */}
      {files.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={merge}
            disabled={merging || files.length < 2}
            className="btn-primary flex-1 text-white font-bold text-[16px] py-4 rounded-xl flex items-center justify-center gap-3 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            aria-busy={merging}
          >
            {merging ? (
              <>
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" aria-hidden="true" />
                Merging PDFs…
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[20px]">merge</span>
                Merge {files.length} PDF{files.length !== 1 ? "s" : ""}
              </>
            )}
          </button>

          <button
            onClick={reset}
            disabled={merging}
            className="flex items-center justify-center gap-2 px-6 py-4 rounded-xl text-[15px] font-semibold text-[#988d9f] hover:text-[#e2e2e2] transition-all disabled:opacity-50"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <span className="material-symbols-outlined text-[18px]">restart_alt</span>
            Reset
          </button>
        </div>
      )}

      {/* Empty state */}
      {files.length === 0 && (
        <div className="glass-panel rounded-2xl p-10 flex flex-col items-center justify-center gap-4 text-center">
          <span className="material-symbols-outlined text-[52px] text-[#4d4354]">merge</span>
          <div>
            <p className="text-[16px] font-semibold text-[#4d4354]">No PDFs added yet</p>
            <p className="text-[13px] text-[#3a3040] mt-1">Upload 2 or more PDFs to get started</p>
          </div>
        </div>
      )}

      {/* Requirement hint when only 1 file */}
      {files.length === 1 && (
        <p className="text-center text-[13px] text-[#988d9f]">
          <span className="material-symbols-outlined text-[14px] align-middle mr-1">info</span>
          Add at least one more PDF to enable merging
        </p>
      )}
    </div>
  );
}
