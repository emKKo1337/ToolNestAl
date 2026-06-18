"use client";

import { useState, useRef, useCallback, useMemo } from "react";
import { PDFDocument } from "pdf-lib";
import JSZip from "jszip";

// ─── Constants ────────────────────────────────────────────────────────────────
const MAX_FILE_BYTES = 100 * 1024 * 1024;
const MAX_PAGES = 500;

// ─── Types ────────────────────────────────────────────────────────────────────
type SplitMode = "individual" | "ranges" | "every" | "selected";

interface LoadedPdf {
  file: File;
  name: string;
  size: number;
  pageCount: number;
}

interface SplitResult {
  name: string;
  bytes: Uint8Array;
  pageLabel: string;
}

interface Progress {
  done: number;
  total: number;
}

type NotificationType = "success" | "error";
interface Notification {
  type: NotificationType;
  message: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function baseName(filename: string): string {
  return filename.replace(/\.pdf$/i, "");
}

/**
 * Parse a range string like "1-3,5,7-10" into a sorted, deduplicated array
 * of 0-based page indices. Returns null on parse error.
 */
function parseRanges(input: string, pageCount: number): number[] | null {
  const parts = input.split(",").map((s) => s.trim()).filter(Boolean);
  if (!parts.length) return null;
  const set = new Set<number>();
  for (const part of parts) {
    const dash = part.indexOf("-");
    if (dash === -1) {
      const n = parseInt(part, 10);
      if (isNaN(n) || n < 1 || n > pageCount) return null;
      set.add(n - 1);
    } else {
      const a = parseInt(part.slice(0, dash), 10);
      const b = parseInt(part.slice(dash + 1), 10);
      if (isNaN(a) || isNaN(b) || a < 1 || b > pageCount || a > b) return null;
      for (let i = a; i <= b; i++) set.add(i - 1);
    }
  }
  if (!set.size) return null;
  return Array.from(set).sort((a, b) => a - b);
}

/** Build list of page-index groups for each split mode */
function buildGroups(
  pageCount: number,
  mode: SplitMode,
  rangeInput: string,
  everyN: number,
  selected: Set<number>
): { indices: number[]; label: string }[] | string {
  if (mode === "individual") {
    return Array.from({ length: pageCount }, (_, i) => ({
      indices: [i],
      label: `page-${i + 1}`,
    }));
  }

  if (mode === "every") {
    const n = Math.max(1, everyN);
    const groups: { indices: number[]; label: string }[] = [];
    for (let i = 0; i < pageCount; i += n) {
      const chunk = Array.from({ length: Math.min(n, pageCount - i) }, (_, j) => i + j);
      const start = i + 1;
      const end = Math.min(i + n, pageCount);
      groups.push({ indices: chunk, label: start === end ? `page-${start}` : `pages-${start}-${end}` });
    }
    return groups;
  }

  if (mode === "ranges") {
    const indices = parseRanges(rangeInput, pageCount);
    if (!indices) return "Invalid page range. Use format: 1-3,5,7-10";
    // Each comma-separated segment becomes its own PDF
    const parts = rangeInput.split(",").map((s) => s.trim()).filter(Boolean);
    const groups: { indices: number[]; label: string }[] = [];
    for (const part of parts) {
      const segIndices = parseRanges(part, pageCount);
      if (!segIndices) return "Invalid page range. Use format: 1-3,5,7-10";
      const dash = part.indexOf("-");
      const label = dash === -1 ? `page-${part}` : `pages-${part.replace("-", "-")}`;
      groups.push({ indices: segIndices, label });
    }
    return groups;
  }

  if (mode === "selected") {
    if (!selected.size) return "Select at least one page to extract.";
    const indices = Array.from(selected).sort((a, b) => a - b);
    return [{ indices, label: `pages-${indices.map((i) => i + 1).join("-")}` }];
  }

  return "Unknown mode";
}

async function buildSinglePdf(
  source: PDFDocument,
  indices: number[]
): Promise<Uint8Array> {
  const out = await PDFDocument.create();
  const copied = await out.copyPages(source, indices);
  copied.forEach((p) => out.addPage(p));
  const bytes = await out.save();
  return bytes as unknown as Uint8Array;
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
function PageThumb({
  number,
  selected,
  onToggle,
}: {
  number: number;
  selected: boolean;
  onToggle: (n: number) => void;
}) {
  return (
    <button
      onClick={() => onToggle(number)}
      aria-pressed={selected}
      aria-label={`Page ${number}${selected ? " (selected)" : ""}`}
      className="flex flex-col items-center gap-1.5 group transition-all duration-150"
    >
      <div
        className="w-12 h-16 rounded-lg flex items-center justify-center transition-all duration-150 relative"
        style={{
          background: selected ? "rgba(221,183,255,0.15)" : "rgba(255,255,255,0.04)",
          border: `2px solid ${selected ? "#ddb7ff" : "rgba(255,255,255,0.1)"}`,
          boxShadow: selected ? "0 0 12px rgba(221,183,255,0.25)" : undefined,
        }}
      >
        <span
          className="material-symbols-outlined text-[20px] transition-colors"
          style={{ color: selected ? "#ddb7ff" : "#4d4354" }}
          aria-hidden="true"
        >
          article
        </span>
        {selected && (
          <span
            className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full flex items-center justify-center"
            style={{ background: "#ddb7ff" }}
          >
            <span className="material-symbols-outlined text-[10px] text-[#131313]">check</span>
          </span>
        )}
      </div>
      <span
        className="text-[11px] font-semibold transition-colors"
        style={{ color: selected ? "#ddb7ff" : "#988d9f" }}
      >
        {number}
      </span>
    </button>
  );
}

function ResultCard({
  result,
  index,
  onDownload,
}: {
  result: SplitResult;
  index: number;
  onDownload: (r: SplitResult) => void;
}) {
  return (
    <div
      className="flex items-center gap-3 px-5 py-3.5 border-b border-[rgba(255,255,255,0.04)] last:border-0 hover:bg-white/[0.02] transition-colors"
    >
      <span
        className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-[12px] font-bold"
        style={{ background: "rgba(255,180,171,0.12)", color: "#ffb4ab" }}
        aria-hidden="true"
      >
        {index + 1}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-[14px] font-semibold text-[#e2e2e2] truncate">{result.name}</p>
        <p className="text-[12px] text-[#988d9f]">
          {result.pageLabel} · {formatBytes(result.bytes.byteLength)}
        </p>
      </div>
      <button
        onClick={() => onDownload(result)}
        className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-semibold transition-all"
        style={{
          background: "rgba(76,215,246,0.1)",
          color: "#4cd7f6",
          border: "1px solid rgba(76,215,246,0.2)",
        }}
        aria-label={`Download ${result.name}`}
      >
        <span className="material-symbols-outlined text-[15px]">download</span>
        Download
      </button>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function SplitPdfTool() {
  const [pdf, setPdf] = useState<LoadedPdf | null>(null);
  const [draggingOver, setDraggingOver] = useState(false);
  const [mode, setMode] = useState<SplitMode>("individual");
  const [rangeInput, setRangeInput] = useState("");
  const [everyN, setEveryN] = useState(1);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [results, setResults] = useState<SplitResult[]>([]);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [notification, setNotification] = useState<Notification | null>(null);
  const [rangeError, setRangeError] = useState("");
  const dropRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const notify = useCallback((type: NotificationType, message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 6000);
  }, []);

  // ── Load PDF ────────────────────────────────────────────────────────────────
  const loadFile = useCallback(
    async (file: File) => {
      if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
        notify("error", `"${file.name}" is not a PDF file.`);
        return;
      }
      if (file.size > MAX_FILE_BYTES) {
        notify("error", `"${file.name}" exceeds the 100 MB size limit.`);
        return;
      }
      try {
        const buf = await file.arrayBuffer();
        const doc = await PDFDocument.load(buf, { ignoreEncryption: true });
        const count = doc.getPageCount();
        if (count > MAX_PAGES) {
          notify("error", `This PDF has ${count} pages — maximum allowed is ${MAX_PAGES}.`);
          return;
        }
        setPdf({ file, name: file.name, size: file.size, pageCount: count });
        setResults([]);
        setSelected(new Set());
        setRangeInput("");
        setRangeError("");
      } catch {
        notify("error", "Could not read the PDF. It may be corrupted or encrypted.");
      }
    },
    [notify]
  );

  // ── Drop zone ───────────────────────────────────────────────────────────────
  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDraggingOver(false);
      const file = e.dataTransfer.files[0];
      if (file) loadFile(file);
    },
    [loadFile]
  );

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDraggingOver(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    if (dropRef.current && !dropRef.current.contains(e.relatedTarget as Node)) {
      setDraggingOver(false);
    }
  }, []);

  // ── Page selection toggle ───────────────────────────────────────────────────
  const togglePage = useCallback((n: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      // n is 1-based from the thumb
      const idx = n - 1;
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    if (!pdf) return;
    setSelected(new Set(Array.from({ length: pdf.pageCount }, (_, i) => i)));
  }, [pdf]);

  const selectNone = useCallback(() => setSelected(new Set()), []);

  // ── Range validation (live) ─────────────────────────────────────────────────
  const rangeValid = useMemo(() => {
    if (!pdf || !rangeInput.trim()) return true;
    return parseRanges(rangeInput, pdf.pageCount) !== null;
  }, [pdf, rangeInput]);

  // ── Split ───────────────────────────────────────────────────────────────────
  const split = useCallback(async () => {
    if (!pdf) return;

    if (mode === "ranges") {
      if (!rangeInput.trim()) { setRangeError("Enter a page range."); return; }
      if (!rangeValid) { setRangeError("Invalid range. Example: 1-3,5,7-10"); return; }
    }
    setRangeError("");

    const groups = buildGroups(pdf.pageCount, mode, rangeInput, everyN, selected);
    if (typeof groups === "string") { notify("error", groups); return; }

    setResults([]);
    setProgress({ done: 0, total: groups.length });

    try {
      const buf = await pdf.file.arrayBuffer();
      const srcDoc = await PDFDocument.load(buf, { ignoreEncryption: true });
      const base = baseName(pdf.name);
      const newResults: SplitResult[] = [];

      for (let i = 0; i < groups.length; i++) {
        const { indices, label } = groups[i];
        const bytes = await buildSinglePdf(srcDoc, indices);
        const pageLabel =
          indices.length === 1
            ? `Page ${indices[0] + 1}`
            : `Pages ${indices[0] + 1}–${indices[indices.length - 1] + 1} (${indices.length} pages)`;
        newResults.push({
          name: `${base}-${label}.pdf`,
          bytes,
          pageLabel,
        });
        setProgress({ done: i + 1, total: groups.length });
      }

      setResults(newResults);
      notify("success", `Split into ${newResults.length} PDF${newResults.length !== 1 ? "s" : ""} — ready to download.`);
    } catch (err) {
      notify("error", err instanceof Error ? err.message : "Split failed. The file may be corrupted.");
    } finally {
      setProgress(null);
    }
  }, [pdf, mode, rangeInput, everyN, selected, rangeValid, notify]);

  // ── Downloads ───────────────────────────────────────────────────────────────
  const downloadOne = useCallback((r: SplitResult) => {
    const plainBuf = r.bytes.buffer.slice(
      r.bytes.byteOffset,
      r.bytes.byteOffset + r.bytes.byteLength
    ) as ArrayBuffer;
    downloadBlob(new Blob([plainBuf], { type: "application/pdf" }), r.name);
  }, []);

  const downloadZip = useCallback(async () => {
    if (!results.length) return;
    const zip = new JSZip();
    for (const r of results) {
      zip.file(r.name, r.bytes);
    }
    const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
    const base = pdf ? baseName(pdf.name) : "split";
    downloadBlob(blob, `${base}-split.zip`);
  }, [results, pdf]);

  // ── Reset ───────────────────────────────────────────────────────────────────
  const reset = useCallback(() => {
    setPdf(null);
    setResults([]);
    setSelected(new Set());
    setRangeInput("");
    setRangeError("");
    setProgress(null);
    setNotification(null);
    if (inputRef.current) inputRef.current.value = "";
  }, []);

  const isBusy = progress !== null;
  const pct = progress ? Math.round((progress.done / progress.total) * 100) : 0;

  // ── Mode tabs ───────────────────────────────────────────────────────────────
  const MODES: { id: SplitMode; label: string; icon: string; desc: string }[] = [
    { id: "individual", label: "Individual Pages", icon: "article", desc: "One PDF per page" },
    { id: "ranges", label: "Custom Ranges", icon: "tune", desc: "e.g. 1-3, 5, 7-10" },
    { id: "every", label: "Every N Pages", icon: "splitscreen", desc: "Split into chunks" },
    { id: "selected", label: "Extract Pages", icon: "select_all", desc: "Pick specific pages" },
  ];

  return (
    <div className="mb-12 flex flex-col gap-6">
      {/* ── Drop zone ── */}
      {!pdf && (
        <div
          ref={dropRef}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onClick={() => inputRef.current?.click()}
          role="button"
          tabIndex={0}
          aria-label="Upload a PDF — click or drag and drop"
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") inputRef.current?.click(); }}
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
              {draggingOver ? "Drop your PDF here" : "Drag & drop a PDF here"}
            </p>
            <p className="text-[14px] text-[#988d9f]">
              or <span className="text-[#ddb7ff] font-semibold">click to browse</span> — up to 100 MB, 500 pages
            </p>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,.pdf"
            className="sr-only"
            onChange={(e) => { if (e.target.files?.[0]) loadFile(e.target.files[0]); }}
            aria-hidden="true"
            tabIndex={-1}
          />
        </div>
      )}

      {/* ── Notification ── */}
      {notification && (
        <div
          role="alert"
          className="flex items-center gap-3 px-5 py-4 rounded-xl text-[14px] font-medium"
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
          <button onClick={() => setNotification(null)} aria-label="Dismiss" className="opacity-60 hover:opacity-100 transition-opacity">
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
      )}

      {/* ── Loaded file header ── */}
      {pdf && (
        <div className="glass-panel rounded-2xl px-5 py-4 flex items-center gap-4">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(255,180,171,0.12)", border: "1px solid rgba(255,180,171,0.2)" }}
          >
            <span className="material-symbols-outlined text-[20px] text-[#ffb4ab]">picture_as_pdf</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[15px] font-bold text-[#e2e2e2] truncate">{pdf.name}</p>
            <p className="text-[12px] text-[#988d9f]">
              {formatBytes(pdf.size)} · {pdf.pageCount} page{pdf.pageCount !== 1 ? "s" : ""}
            </p>
          </div>
          <button
            onClick={reset}
            className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center text-[#4d4354] hover:text-[#ef4444] hover:bg-[rgba(239,68,68,0.1)] transition-all"
            aria-label="Remove file"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>
      )}

      {/* ── Mode selector ── */}
      {pdf && (
        <div className="glass-panel rounded-2xl p-5">
          <p className="text-[13px] font-semibold text-[#988d9f] uppercase tracking-[0.08em] mb-4">Split Mode</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {MODES.map((m) => (
              <button
                key={m.id}
                onClick={() => { setMode(m.id); setRangeError(""); }}
                aria-pressed={mode === m.id}
                className="flex flex-col items-center gap-2 py-4 px-3 rounded-xl border text-center transition-all duration-200"
                style={{
                  background: mode === m.id ? "rgba(221,183,255,0.12)" : "rgba(255,255,255,0.03)",
                  borderColor: mode === m.id ? "rgba(221,183,255,0.4)" : "rgba(255,255,255,0.08)",
                  color: mode === m.id ? "#ddb7ff" : "#988d9f",
                }}
              >
                <span className="material-symbols-outlined text-[22px]">{m.icon}</span>
                <span className="text-[13px] font-bold leading-tight">{m.label}</span>
                <span className="text-[11px] opacity-70">{m.desc}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Mode options ── */}
      {pdf && mode === "ranges" && (
        <div className="glass-panel rounded-2xl p-5 flex flex-col gap-3">
          <label htmlFor="range-input" className="text-[14px] font-semibold text-[#e2e2e2]">
            Page Ranges
          </label>
          <input
            id="range-input"
            type="text"
            value={rangeInput}
            onChange={(e) => { setRangeInput(e.target.value); setRangeError(""); }}
            placeholder="e.g. 1-3, 5, 7-10"
            className="bg-[rgba(0,0,0,0.3)] border rounded-xl px-4 py-3 text-[15px] text-[#e2e2e2] placeholder-[#4d4354] focus:outline-none transition-colors"
            style={{
              borderColor: rangeError ? "#ef4444" : rangeInput && !rangeValid ? "#f59e0b" : "rgba(255,255,255,0.1)",
            }}
            aria-describedby="range-hint"
          />
          {rangeError ? (
            <p id="range-hint" className="text-[13px] text-[#ef4444] flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[15px]">error</span>{rangeError}
            </p>
          ) : (
            <p id="range-hint" className="text-[13px] text-[#988d9f]">
              Each comma-separated segment becomes a separate PDF file. Page range 1–{pdf.pageCount}.
            </p>
          )}
        </div>
      )}

      {pdf && mode === "every" && (
        <div className="glass-panel rounded-2xl p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <label htmlFor="every-n" className="text-[14px] font-semibold text-[#e2e2e2]">
              Pages per chunk
            </label>
            <span className="px-3 py-1 rounded-lg text-[15px] font-bold text-[#ddb7ff] bg-[rgba(221,183,255,0.1)]">{everyN}</span>
          </div>
          <input
            id="every-n"
            type="range"
            min={1}
            max={Math.max(1, Math.floor(pdf.pageCount / 2))}
            value={everyN}
            onChange={(e) => setEveryN(Number(e.target.value))}
            className="w-full h-2 rounded-full appearance-none cursor-pointer"
            style={{ accentColor: "#ddb7ff" }}
          />
          <p className="text-[13px] text-[#988d9f]">
            Will produce <span className="text-[#e2e2e2] font-semibold">{Math.ceil(pdf.pageCount / everyN)}</span> PDF{Math.ceil(pdf.pageCount / everyN) !== 1 ? "s" : ""}, each with up to {everyN} page{everyN !== 1 ? "s" : ""}.
          </p>
        </div>
      )}

      {pdf && mode === "selected" && (
        <div className="glass-panel rounded-2xl p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="text-[14px] font-semibold text-[#e2e2e2]">
              Select pages to extract
              {selected.size > 0 && (
                <span className="ml-2 px-2 py-0.5 rounded-md text-[12px] font-bold bg-[rgba(221,183,255,0.15)] text-[#ddb7ff]">
                  {selected.size} selected
                </span>
              )}
            </p>
            <div className="flex gap-2">
              <button
                onClick={selectAll}
                className="text-[12px] font-semibold text-[#ddb7ff] hover:opacity-80 transition-opacity px-3 py-1 rounded-lg"
                style={{ background: "rgba(221,183,255,0.1)" }}
              >
                Select all
              </button>
              <button
                onClick={selectNone}
                className="text-[12px] font-semibold text-[#988d9f] hover:opacity-80 transition-opacity px-3 py-1 rounded-lg"
                style={{ background: "rgba(255,255,255,0.05)" }}
              >
                Clear
              </button>
            </div>
          </div>
          <div
            className="flex flex-wrap gap-3 max-h-[260px] overflow-y-auto pr-1"
            role="group"
            aria-label="Page selection"
          >
            {Array.from({ length: pdf.pageCount }, (_, i) => (
              <PageThumb
                key={i}
                number={i + 1}
                selected={selected.has(i)}
                onToggle={togglePage}
              />
            ))}
          </div>
          {selected.size === 0 && (
            <p className="text-[13px] text-[#4d4354] flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[15px]">info</span>
              Click pages above to select them for extraction
            </p>
          )}
        </div>
      )}

      {/* ── Progress bar ── */}
      {isBusy && progress && (
        <div className="glass-panel rounded-2xl p-5 flex flex-col gap-3">
          <div className="flex items-center justify-between text-[14px]">
            <span className="font-semibold text-[#e2e2e2] flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-[#ddb7ff]/30 border-t-[#ddb7ff] rounded-full animate-spin inline-block" />
              Splitting PDF…
            </span>
            <span className="text-[#ddb7ff] font-bold">{pct}%</span>
          </div>
          <div className="h-2 rounded-full bg-[rgba(255,255,255,0.08)] overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300 ease-out"
              style={{ width: `${pct}%`, background: "linear-gradient(90deg, #ddb7ff, #4cd7f6)" }}
            />
          </div>
          <p className="text-[12px] text-[#988d9f]">
            {progress.done} of {progress.total} file{progress.total !== 1 ? "s" : ""} generated
          </p>
        </div>
      )}

      {/* ── Split button ── */}
      {pdf && !isBusy && (
        <button
          onClick={split}
          className="btn-primary w-full text-white font-bold text-[16px] py-4 rounded-xl flex items-center justify-center gap-3 transition-all"
        >
          <span className="material-symbols-outlined text-[20px]">call_split</span>
          Split PDF
        </button>
      )}

      {/* ── Results ── */}
      {results.length > 0 && !isBusy && (
        <div className="glass-panel rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(255,255,255,0.06)]">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-[20px] text-[#4cd7f6]">folder_zip</span>
              <span className="text-[15px] font-bold text-[#e2e2e2]">
                {results.length} file{results.length !== 1 ? "s" : ""} ready
              </span>
            </div>
            {results.length > 1 && (
              <button
                onClick={downloadZip}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-[14px] font-bold transition-all"
                style={{
                  background: "rgba(221,183,255,0.15)",
                  color: "#ddb7ff",
                  border: "1px solid rgba(221,183,255,0.3)",
                }}
              >
                <span className="material-symbols-outlined text-[16px]">download</span>
                Download ZIP
              </button>
            )}
          </div>
          <ol aria-label="Split PDF results">
            {results.map((r, i) => (
              <ResultCard key={r.name + i} result={r} index={i} onDownload={downloadOne} />
            ))}
          </ol>
        </div>
      )}

      {/* ── Empty state (no pdf, no dragging) ── */}
      {!pdf && (
        <div className="glass-panel rounded-2xl p-10 flex flex-col items-center justify-center gap-4 text-center">
          <span className="material-symbols-outlined text-[52px] text-[#4d4354]">call_split</span>
          <div>
            <p className="text-[16px] font-semibold text-[#4d4354]">No PDF loaded yet</p>
            <p className="text-[13px] text-[#3a3040] mt-1">Upload a PDF above to choose how to split it</p>
          </div>
        </div>
      )}
    </div>
  );
}
