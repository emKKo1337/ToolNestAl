"use client";

/**
 * PDF → XLSX conversion (browser-only)
 *
 * Pipeline:
 *  1. pdfjs-dist  — loads the PDF and calls getTextContent() per page.
 *                   Each text item carries an x/y position (via the
 *                   transform matrix) and a string value.
 *  2. Column detection — all unique X positions across a page are bucketed
 *                   with a 12 pt tolerance.  Items whose X falls within a
 *                   bucket are placed in that column, forming a grid of
 *                   (row, col) cells.  Rows are bucketed by Y position with
 *                   a similar tolerance derived from the median font size.
 *  3. SheetJS (xlsx) — each page becomes a worksheet named "Page N".
 *                   Cell values are written as strings; SheetJS infers
 *                   numeric types automatically on open in Excel.
 *  4. XLSX blob   — downloaded directly from the browser.
 *
 * Limitations (inherent to browser-based PDF→XLSX):
 *  • Scanned / image-only PDFs produce no text → the user is warned.
 *  • PDFs without strict column alignment (flowing prose) produce one
 *    cell per text run rather than a structured table.
 *  • Cell merges, colours, and fonts are not reproduced.
 */

import { useState, useRef, useCallback } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface TextItem { str: string; x: number; y: number; fontSize: number; }
interface PageData  { pageNum: number; rows: string[][]; rowCount: number; colCount: number; }

type NotifType = "success" | "error" | "warning";
interface Notif { type: NotifType; message: string; }

interface ConvertResult {
  filename: string;
  sizeBytes: number;
  totalPages: number;
  totalRows: number;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_FILE_BYTES = 100 * 1024 * 1024; // 100 MB
const X_TOL_BASE    = 12;   // column bucket tolerance (pts)
const Y_TOL_FACTOR  = 0.55; // row bucket tolerance = medianFontSize × factor

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1048576).toFixed(2)} MB`;
}

function median(arr: number[]): number {
  if (!arr.length) return 12;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Group values into buckets with the given tolerance.
 *  Returns a map from original value → bucket representative. */
function bucket(values: number[], tol: number): Map<number, number> {
  const sorted = [...new Set(values)].sort((a, b) => a - b);
  const map    = new Map<number, number>();
  const reps: number[] = [];

  for (const v of sorted) {
    const existing = reps.find((r) => Math.abs(v - r) <= tol);
    if (existing !== undefined) {
      map.set(v, existing);
    } else {
      reps.push(v);
      map.set(v, v);
    }
  }
  return map;
}

// ── pdfjs loader ──────────────────────────────────────────────────────────────

async function getPdfjs() {
  const lib = await import("pdfjs-dist");
  lib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  return lib;
}

// ── Extraction ────────────────────────────────────────────────────────────────

async function extractPage(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  page: any
): Promise<PageData> {
  const vp      = page.getViewport({ scale: 1 });
  const pageH   = vp.height;
  const content = await page.getTextContent();

  const items: TextItem[] = [];
  for (const item of content.items) {
    const it = item as { str: string; transform: number[]; height: number };
    if (!it.str.trim()) continue;
    const [, , , scaleY, tx, ty] = it.transform;
    items.push({
      str:      it.str,
      x:        tx,
      y:        pageH - ty,           // flip: top = 0
      fontSize: Math.abs(scaleY) || 10,
    });
  }

  if (!items.length) {
    return { pageNum: 0, rows: [], rowCount: 0, colCount: 0 };
  }

  const medFS  = median(items.map((i) => i.fontSize));
  const yTol   = medFS * Y_TOL_FACTOR;

  // Bucket Y positions → row representatives
  const yMap   = bucket(items.map((i) => i.y), yTol);
  // Bucket X positions → column representatives
  const xMap   = bucket(items.map((i) => i.x), X_TOL_BASE);

  // Collect unique row/col reps and sort them
  const rowReps = [...new Set([...yMap.values()])].sort((a, b) => a - b);
  const colReps = [...new Set([...xMap.values()])].sort((a, b) => a - b);

  const rowIdx  = new Map(rowReps.map((r, i) => [r, i]));
  const colIdx  = new Map(colReps.map((c, i) => [c, i]));

  // Build 2-D grid
  const grid: string[][] = Array.from({ length: rowReps.length }, () =>
    Array(colReps.length).fill("")
  );

  for (const item of items) {
    const rRep = yMap.get(item.y)!;
    const cRep = xMap.get(item.x)!;
    const ri   = rowIdx.get(rRep)!;
    const ci   = colIdx.get(cRep)!;
    // Append if cell already has content (items can share a bucket)
    grid[ri][ci] = grid[ri][ci] ? `${grid[ri][ci]} ${item.str}` : item.str;
  }

  // Remove fully-empty rows
  const rows = grid.filter((r) => r.some((c) => c.trim()));

  return {
    pageNum:  0,
    rows,
    rowCount: rows.length,
    colCount: colReps.length,
  };
}

async function convertPdfToExcel(
  file: File,
  onProgress: (page: number, total: number) => void
): Promise<ConvertResult & { data: Uint8Array }> {
  const pdfjsLib = await getPdfjs();
  const buf      = await file.arrayBuffer();
  const pdfDoc   = await pdfjsLib.getDocument({ data: buf }).promise;
  const total    = pdfDoc.numPages;

  const pages: PageData[] = [];

  for (let pageNum = 1; pageNum <= total; pageNum++) {
    onProgress(pageNum, total);
    const page = await pdfDoc.getPage(pageNum);
    const data = await extractPage(page);
    data.pageNum = pageNum;
    pages.push(data);
  }

  const totalRows = pages.reduce((s, p) => s + p.rowCount, 0);

  if (totalRows === 0) {
    throw new Error(
      "No text content found in this PDF. " +
      "The file may be scanned (image-only). " +
      "OCR is required to extract data from scanned PDFs."
    );
  }

  // Build XLSX workbook with SheetJS
  const XLSX = await import("xlsx");
  const wb   = XLSX.utils.book_new();

  for (const page of pages) {
    const sheetName = `Page ${page.pageNum}`;
    if (!page.rows.length) {
      const ws = XLSX.utils.aoa_to_sheet([["(no text on this page)"]]);
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
      continue;
    }
    const ws = XLSX.utils.aoa_to_sheet(page.rows);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  }

  const xlsxBuf = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as Uint8Array;
  const filename = file.name.replace(/\.pdf$/i, "") + ".xlsx";

  return { filename, sizeBytes: xlsxBuf.byteLength, totalPages: total, totalRows, data: xlsxBuf };
}

function downloadXlsx(data: Uint8Array, filename: string) {
  const blob = new Blob([data.buffer as ArrayBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({ icon, label, value, color }: { icon: string; label: string; value: string; color: string }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-xl p-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
      <span className="material-symbols-outlined text-[18px]" style={{ color }} aria-hidden="true">{icon}</span>
      <p className="text-[20px] font-extrabold leading-none" style={{ color }}>{value}</p>
      <p className="text-[11px] text-[#988d9f] font-semibold uppercase tracking-wide">{label}</p>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function PdfToExcelTool() {
  const [draggingOver, setDraggingOver]  = useState(false);
  const [converting, setConverting]      = useState(false);
  const [progress, setProgress]          = useState<{ page: number; total: number } | null>(null);
  const [result, setResult]              = useState<(ConvertResult & { data: Uint8Array }) | null>(null);
  const [loadedFile, setLoadedFile]      = useState<File | null>(null);
  const [notif, setNotif]                = useState<Notif | null>(null);

  const dropRef  = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const notify = useCallback((type: NotifType, message: string) => {
    setNotif({ type, message });
    setTimeout(() => setNotif(null), 8000);
  }, []);

  // ── File ingestion ─────────────────────────────────────────────────────────

  const handleFile = useCallback(async (file: File) => {
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      notify("error", `"${file.name}" is not a PDF file.`);
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      notify("error", `File exceeds the 100 MB limit (${formatBytes(file.size)}).`);
      return;
    }

    setLoadedFile(file);
    setResult(null);
    setNotif(null);
    setConverting(true);
    setProgress(null);

    try {
      const res = await convertPdfToExcel(file, (page, total) => setProgress({ page, total }));
      setResult(res);
      notify("success", `Converted — ${res.totalPages} page${res.totalPages !== 1 ? "s" : ""}, ${res.totalRows.toLocaleString()} rows extracted.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Conversion failed. Please try another PDF.";
      notify("error", msg);
      setLoadedFile(null);
    } finally {
      setConverting(false);
      setProgress(null);
    }
  }, [notify]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDraggingOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const onDragOver  = useCallback((e: React.DragEvent) => { e.preventDefault(); setDraggingOver(true);  }, []);
  const onDragLeave = useCallback((e: React.DragEvent) => {
    if (dropRef.current && !dropRef.current.contains(e.relatedTarget as Node)) setDraggingOver(false);
  }, []);

  const handleDownload = useCallback(() => {
    if (!result) return;
    downloadXlsx(result.data, result.filename);
  }, [result]);

  const handleReset = useCallback(() => {
    setLoadedFile(null);
    setResult(null);
    setNotif(null);
    setProgress(null);
    if (inputRef.current) inputRef.current.value = "";
  }, []);

  const progressPct = progress ? Math.round((progress.page / progress.total) * 100) : 0;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="mb-12 flex flex-col gap-6">

      {/* ── Drop zone ──────────────────────────────────────────────────────── */}
      {!converting && !result && (
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
            <span
              className="material-symbols-outlined text-[38px]"
              style={{ color: "#ffb4ab" }}
              aria-hidden="true"
            >
              {draggingOver ? "file_download" : "picture_as_pdf"}
            </span>
          </div>

          <div className="text-center">
            <p className="text-[18px] font-bold text-[#e2e2e2] mb-1.5">
              {draggingOver ? "Drop your PDF here" : "Drag & drop your PDF here"}
            </p>
            <p className="text-[14px] text-[#988d9f]">
              or <span className="text-[#ffb4ab] font-semibold">click to browse</span>
              {" — PDF only · up to 100 MB"}
            </p>
          </div>

          <div className="flex flex-wrap justify-center gap-2">
            {["Tables detected", "Multi-page", "One sheet per page", "Rows & columns preserved"].map((f) => (
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

      {/* ── Notification ──────────────────────────────────────────────────── */}
      {notif && (
        <div
          role="alert"
          className="flex items-start gap-3 px-5 py-4 rounded-xl text-[14px] font-medium"
          style={{
            background: notif.type === "success" ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)",
            border: `1px solid ${notif.type === "success" ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`,
            color: notif.type === "success" ? "#22c55e" : "#ef4444",
          }}
        >
          <span className="material-symbols-outlined text-[20px] flex-shrink-0 mt-0.5">
            {notif.type === "success" ? "check_circle" : "error"}
          </span>
          <span className="flex-1 leading-relaxed">{notif.message}</span>
          <button onClick={() => setNotif(null)} aria-label="Dismiss" className="opacity-60 hover:opacity-100 transition-opacity flex-shrink-0">
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
      )}

      {/* ── Conversion progress ────────────────────────────────────────────── */}
      {converting && (
        <div className="glass-panel rounded-2xl p-6 flex flex-col gap-4" aria-live="polite" aria-busy="true">
          <div className="flex items-center gap-4">
            <span className="w-6 h-6 border-2 border-[#ffb4ab]/30 border-t-[#ffb4ab] rounded-full animate-spin flex-shrink-0" />
            <div className="flex-1">
              <p className="text-[15px] font-bold text-[#e2e2e2]">
                {progress ? `Extracting page ${progress.page} of ${progress.total}…` : "Loading PDF…"}
              </p>
              {progress && (
                <p className="text-[12px] text-[#988d9f] mt-0.5">
                  Detecting columns and reconstructing rows
                </p>
              )}
            </div>
          </div>

          {progress && (
            <div>
              <div
                className="w-full h-1.5 rounded-full overflow-hidden"
                style={{ background: "rgba(255,255,255,0.08)" }}
                role="progressbar"
                aria-valuenow={progressPct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`Conversion progress ${progressPct}%`}
              >
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{ width: `${progressPct}%`, background: "#ffb4ab" }}
                />
              </div>
              <p className="text-right text-[11px] text-[#988d9f] mt-1">{progressPct}%</p>
            </div>
          )}

          {loadedFile && (
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-[12px]"
              style={{ background: "rgba(255,255,255,0.03)", color: "#5a4d63" }}
            >
              <span className="material-symbols-outlined text-[14px]">picture_as_pdf</span>
              <span className="truncate flex-1">{loadedFile.name}</span>
              <span className="shrink-0">{formatBytes(loadedFile.size)}</span>
            </div>
          )}
        </div>
      )}

      {/* ── Result ────────────────────────────────────────────────────────── */}
      {result && !converting && (
        <div className="flex flex-col gap-4">
          <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))" }}>
            <StatCard icon="description"   label="Pages"      value={String(result.totalPages)}          color="#ffb4ab" />
            <StatCard icon="table_rows"    label="Rows found" value={result.totalRows.toLocaleString()}  color="#4cd7f6" />
            <StatCard icon="download"      label="XLSX size"  value={formatBytes(result.sizeBytes)}      color="#4ade80" />
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
                <p className="text-[15px] font-bold text-[#e2e2e2]">Excel spreadsheet ready</p>
                <p className="text-[12px] text-[#988d9f] truncate">{result.filename}</p>
              </div>
            </div>
            <div className="p-5 flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleDownload}
                className="btn-primary flex-1 text-white font-bold text-[15px] py-3.5 rounded-xl flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-[18px]">download</span>
                Download XLSX
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

          <div
            className="flex items-start gap-3 px-4 py-3.5 rounded-xl text-[13px]"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", color: "#5a4d63" }}
          >
            <span className="material-symbols-outlined text-[16px] mt-0.5 flex-shrink-0">info</span>
            <span>
              Text and table data are extracted and placed into one worksheet per PDF page.
              Scanned PDFs (image-only) require OCR before conversion. Cell colours,
              merged cells, and fonts are not reproduced.
              Your file is processed entirely in your browser — nothing is uploaded to any server.
            </span>
          </div>
        </div>
      )}

      {/* ── How it works (idle) ────────────────────────────────────────────── */}
      {!converting && !result && (
        <div className="glass-panel rounded-2xl p-6 flex flex-col gap-3">
          <p className="text-[12px] font-semibold text-[#988d9f] uppercase tracking-[0.08em]">How it works</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { icon: "upload_file",  label: "1. Upload PDF",         desc: "Drag & drop or browse for your PDF file (up to 100 MB)" },
              { icon: "table_chart",  label: "2. Extract tables",     desc: "Column positions and row data are detected from text layout" },
              { icon: "download",     label: "3. Download XLSX",      desc: "Open and edit in Excel, Google Sheets or LibreOffice" },
            ].map(({ icon, label, desc }) => (
              <div key={label} className="flex flex-col gap-2 p-4 rounded-xl" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
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
