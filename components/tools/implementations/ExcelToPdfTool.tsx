"use client";

/**
 * Excel → PDF conversion strategy (browser-only):
 *
 * 1. SheetJS (xlsx) reads the binary XLSX/XLS file and exposes every sheet as
 *    a 2-D array of cell values.
 * 2. pdf-lib creates a new PDF document.  For each selected sheet we add page(s)
 *    and draw a grid table: column headers (row 0) on a tinted background, then
 *    data rows alternating between white and a subtle grey tint.
 * 3. Column widths are calculated proportionally from SheetJS's `!cols` array
 *    (or estimated from content) and scaled to fit the page.
 * 4. Long text is truncated with an ellipsis to keep cells readable.
 *
 * Limitations (same as all browser-based converters):
 * - Charts, images, conditional formatting, merged cells, and rich cell styles
 *   are not reproduced — only raw text/number cell values.
 * - Long rows or very wide sheets are scaled down to fit the page width.
 */

import { useState, useRef, useCallback } from "react";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

// ── Types ─────────────────────────────────────────────────────────────────────

type Orientation = "portrait" | "landscape";
type PageSizeKey = "A4" | "Letter";

interface SheetInfo {
  name: string;
  rows: number;
  cols: number;
  data: string[][];
}

interface LoadedFile {
  file: File;
  name: string;
  size: number;
  sheets: SheetInfo[];
}

interface ConvertResult {
  buffer: ArrayBuffer;
  filename: string;
  sizeBytes: number;
}

type NotifType = "success" | "error";
interface Notif { type: NotifType; message: string; }

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_FILE_BYTES = 50 * 1024 * 1024; // 50 MB
const ACCEPTED_EXT  = /\.(xlsx|xls)$/i;

// PDF page dimensions in points (1 pt = 1/72 inch)
const PAGE_DIMS: Record<PageSizeKey, [number, number]> = {
  A4:     [595.28, 841.89],
  Letter: [612,    792   ],
};

const MARGIN   = 36;   // pts
const ROW_H    = 16;   // pts per row
const HEADER_H = 18;   // pts for header row
const FONT_SIZE       = 7.5;
const HEADER_FONT_SIZE = 8;
const MAX_COLS_DISPLAY = 30; // truncate very wide sheets

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(2)} MB`;
}

function truncate(str: string, maxChars: number): string {
  if (str.length <= maxChars) return str;
  return str.slice(0, maxChars - 1) + "…";
}

// Parse Excel file using SheetJS (dynamic import to avoid SSR crash)
async function parseExcel(file: File): Promise<SheetInfo[]> {
  const XLSX = await import("xlsx");
  const buf  = await file.arrayBuffer();
  const wb   = XLSX.read(buf, { type: "array" });

  return wb.SheetNames.map((name) => {
    const ws   = wb.Sheets[name];
    const data: string[][] = XLSX.utils.sheet_to_json(ws, {
      header: 1,
      defval: "",
      raw: false,
    }) as string[][];

    const rows = data.length;
    const cols = data.reduce((m, r) => Math.max(m, r.length), 0);
    return { name, rows, cols, data };
  });
}

// Render one sheet as one or more PDF pages
async function renderSheet(
  pdfDoc: PDFDocument,
  sheet: SheetInfo,
  orientation: Orientation,
  pageSizeKey: PageSizeKey,
  fitToPage: boolean,
): Promise<void> {
  const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold    = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let [pageW, pageH] = PAGE_DIMS[pageSizeKey];
  if (orientation === "landscape") [pageW, pageH] = [pageH, pageW];

  const availW = pageW - 2 * MARGIN;
  const availH = pageH - 2 * MARGIN;

  const data    = sheet.data;
  const numCols = Math.min(sheet.cols, MAX_COLS_DISPLAY);
  const numRows = data.length;

  if (numRows === 0 || numCols === 0) {
    // Empty sheet — add a blank page with a label
    const page = pdfDoc.addPage([pageW, pageH]);
    page.drawText(`Sheet: ${sheet.name} (empty)`, {
      x: MARGIN, y: pageH - MARGIN - 12,
      size: 10, font: bold, color: rgb(0.4, 0.4, 0.4),
    });
    return;
  }

  // ── Column widths ──────────────────────────────────────────────────────────
  // Estimate character widths from content (max 18 chars per col as base)
  const charWidths = Array.from({ length: numCols }, (_, ci) => {
    let maxLen = 0;
    for (const row of data) {
      const cell = String(row[ci] ?? "");
      maxLen = Math.max(maxLen, cell.length);
    }
    return Math.min(Math.max(maxLen, 4), 20); // clamp 4–20
  });

  const totalChars = charWidths.reduce((s, w) => s + w, 0);

  let colWidths: number[];
  if (fitToPage || totalChars * 6 > availW) {
    // Proportional fit
    colWidths = charWidths.map((w) => (w / totalChars) * availW);
  } else {
    colWidths = charWidths.map((w) => w * 6);
  }

  // ── Paginate rows ──────────────────────────────────────────────────────────
  const firstPageDataRows = Math.floor((availH - HEADER_H) / ROW_H);
  const morePageDataRows  = Math.floor((availH - HEADER_H - 14) / ROW_H); // 14pt for sheet label

  const dataRows     = data.slice(1); // row 0 = header
  const headerRow    = data[0] ?? [];

  let remaining = [...dataRows];
  let pageIndex = 0;

  while (remaining.length > 0 || pageIndex === 0) {
    const maxRows = pageIndex === 0 ? firstPageDataRows : morePageDataRows;
    const chunk   = remaining.splice(0, maxRows);
    const page    = pdfDoc.addPage([pageW, pageH]);

    let y = pageH - MARGIN;

    // Sheet name label (first page only shows it prominently, others show continuation)
    const label = pageIndex === 0
      ? `Sheet: ${sheet.name}`
      : `Sheet: ${sheet.name} (continued)`;
    page.drawText(label, {
      x: MARGIN, y,
      size: 8.5, font: bold, color: rgb(0.3, 0.3, 0.3),
    });
    y -= 14;

    // ── Header row ────────────────────────────────────────────────────────────
    let xCursor = MARGIN;
    // Header background
    page.drawRectangle({
      x: MARGIN, y: y - HEADER_H + 3,
      width: availW, height: HEADER_H,
      color: rgb(0.22, 0.22, 0.28),
    });

    for (let ci = 0; ci < numCols; ci++) {
      const cell  = truncate(String(headerRow[ci] ?? `Col ${ci + 1}`), 22);
      const colW  = colWidths[ci];
      page.drawText(cell, {
        x: xCursor + 3,
        y: y - HEADER_H + 6,
        size: HEADER_FONT_SIZE,
        font: bold,
        color: rgb(0.95, 0.95, 0.95),
        maxWidth: colW - 5,
      });
      xCursor += colW;
    }
    y -= HEADER_H;

    // ── Data rows ──────────────────────────────────────────────────────────────
    for (let ri = 0; ri < chunk.length; ri++) {
      const row   = chunk[ri];
      const isAlt = ri % 2 === 1;
      xCursor     = MARGIN;

      // Row background
      if (isAlt) {
        page.drawRectangle({
          x: MARGIN, y: y - ROW_H + 3,
          width: availW, height: ROW_H,
          color: rgb(0.96, 0.96, 0.97),
        });
      }

      for (let ci = 0; ci < numCols; ci++) {
        const raw  = String(row?.[ci] ?? "");
        const cell = truncate(raw, 24);
        const colW = colWidths[ci];

        // Right-align numbers
        const isNum = raw !== "" && !isNaN(Number(raw.replace(/[,$%]/g, "")));
        const textX = isNum
          ? xCursor + colW - regular.widthOfTextAtSize(cell, FONT_SIZE) - 4
          : xCursor + 3;

        page.drawText(cell, {
          x: Math.max(xCursor + 2, textX),
          y: y - ROW_H + 5,
          size: FONT_SIZE,
          font: regular,
          color: rgb(0.1, 0.1, 0.1),
          maxWidth: colW - 5,
        });
        xCursor += colW;
      }

      // Subtle bottom border
      page.drawLine({
        start: { x: MARGIN,           y: y - ROW_H + 3 },
        end:   { x: MARGIN + availW,  y: y - ROW_H + 3 },
        thickness: 0.3,
        color: rgb(0.85, 0.85, 0.87),
      });

      y -= ROW_H;
    }

    // Column separator lines (vertical)
    xCursor = MARGIN;
    const tableTop    = pageH - MARGIN - 14;
    const tableBottom = y + ROW_H - 3;
    for (let ci = 0; ci < numCols; ci++) {
      xCursor += colWidths[ci];
      page.drawLine({
        start: { x: xCursor, y: tableTop    },
        end:   { x: xCursor, y: tableBottom },
        thickness: 0.3,
        color: rgb(0.75, 0.75, 0.78),
      });
    }

    // Outer border
    page.drawRectangle({
      x: MARGIN,
      y: tableBottom,
      width: availW,
      height: tableTop - tableBottom,
      borderColor: rgb(0.5, 0.5, 0.55),
      borderWidth: 0.5,
      color: undefined,
    });

    pageIndex++;
    if (chunk.length < maxRows) break; // no more rows
  }
}

async function convertToPdf(
  sheets: SheetInfo[],
  selectedSheets: Set<string>,
  orientation: Orientation,
  pageSizeKey: PageSizeKey,
  fitToPage: boolean,
  filename: string,
): Promise<ConvertResult> {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.setTitle(filename);
  pdfDoc.setCreator("ToolNest AI – Excel to PDF");

  const toRender = sheets.filter((s) => selectedSheets.has(s.name));
  if (toRender.length === 0) throw new Error("No sheets selected.");

  for (const sheet of toRender) {
    await renderSheet(pdfDoc, sheet, orientation, pageSizeKey, fitToPage);
  }

  const saved = await pdfDoc.save();
  const buffer = saved.buffer.slice(saved.byteOffset, saved.byteOffset + saved.byteLength) as ArrayBuffer;
  return { buffer, filename: filename.replace(/\.xlsx?$/i, "") + ".pdf", sizeBytes: buffer.byteLength };
}

function downloadBuffer(buffer: ArrayBuffer, filename: string) {
  const url = URL.createObjectURL(new Blob([buffer], { type: "application/pdf" }));
  const a   = document.createElement("a");
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className="px-3.5 py-2 rounded-xl text-[13px] font-semibold transition-all duration-200"
      style={{
        background: active ? "rgba(255,180,171,0.15)" : "rgba(255,255,255,0.04)",
        color: active ? "#ffb4ab" : "#988d9f",
        border: `1px solid ${active ? "rgba(255,180,171,0.35)" : "rgba(255,255,255,0.08)"}`,
      }}
    >
      {children}
    </button>
  );
}

function Toggle({ id, label, checked, onChange }: { id: string; label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label htmlFor={id} className="flex items-center gap-3 cursor-pointer select-none group">
      <div className="relative shrink-0">
        <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="sr-only" />
        <div className="w-10 h-5 rounded-full transition-colors duration-200" style={{ background: checked ? "rgba(255,180,171,0.35)" : "rgba(255,255,255,0.1)" }} />
        <div className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full shadow transition-all duration-200" style={{ background: checked ? "#ffb4ab" : "#988d9f", transform: checked ? "translateX(20px)" : "translateX(0)" }} />
      </div>
      <span className="text-[14px] text-[#c4b5cf] group-hover:text-[#e2e2e2] transition-colors">{label}</span>
    </label>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ExcelToPdfTool() {
  const [draggingOver, setDraggingOver]     = useState(false);
  const [loading, setLoading]               = useState(false);
  const [converting, setConverting]         = useState(false);
  const [loadedFile, setLoadedFile]         = useState<LoadedFile | null>(null);
  const [selectedSheets, setSelectedSheets] = useState<Set<string>>(new Set());
  const [orientation, setOrientation]       = useState<Orientation>("portrait");
  const [pageSize, setPageSize]             = useState<PageSizeKey>("A4");
  const [fitToPage, setFitToPage]           = useState(true);
  const [result, setResult]                 = useState<ConvertResult | null>(null);
  const [notif, setNotif]                   = useState<Notif | null>(null);

  const dropRef  = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const notify = useCallback((type: NotifType, message: string) => {
    setNotif({ type, message });
    setTimeout(() => setNotif(null), 7000);
  }, []);

  // ── File ingestion ─────────────────────────────────────────────────────────

  const loadFile = useCallback(async (file: File) => {
    if (!ACCEPTED_EXT.test(file.name)) {
      notify("error", `"${file.name}" is not a supported format. Please upload an XLSX or XLS file.`);
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      notify("error", `File exceeds the 50 MB limit (${formatBytes(file.size)}).`);
      return;
    }

    setLoading(true);
    setResult(null);
    setNotif(null);

    try {
      const sheets = await parseExcel(file);
      const all    = new Set(sheets.map((s) => s.name));
      setLoadedFile({ file, name: file.name, size: file.size, sheets });
      setSelectedSheets(all);
    } catch (err) {
      notify("error", err instanceof Error ? err.message : "Failed to read the Excel file.");
      setLoadedFile(null);
    } finally {
      setLoading(false);
    }
  }, [notify]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDraggingOver(false);
    const file = e.dataTransfer.files[0];
    if (file) loadFile(file);
  }, [loadFile]);

  const onDragOver  = useCallback((e: React.DragEvent) => { e.preventDefault(); setDraggingOver(true);  }, []);
  const onDragLeave = useCallback((e: React.DragEvent) => {
    if (dropRef.current && !dropRef.current.contains(e.relatedTarget as Node)) setDraggingOver(false);
  }, []);

  // ── Sheet selection ────────────────────────────────────────────────────────

  const toggleSheet = useCallback((name: string) => {
    setSelectedSheets((prev) => {
      const next = new Set(prev);
      if (next.has(name)) { if (next.size > 1) next.delete(name); }
      else next.add(name);
      return next;
    });
    setResult(null);
  }, []);

  const selectAll = useCallback(() => {
    if (!loadedFile) return;
    setSelectedSheets(new Set(loadedFile.sheets.map((s) => s.name)));
    setResult(null);
  }, [loadedFile]);

  // ── Convert ────────────────────────────────────────────────────────────────

  const handleConvert = useCallback(async () => {
    if (!loadedFile) return;
    setConverting(true);
    setResult(null);
    setNotif(null);
    try {
      const res = await convertToPdf(
        loadedFile.sheets,
        selectedSheets,
        orientation,
        pageSize,
        fitToPage,
        loadedFile.name,
      );
      setResult(res);
      notify("success", `PDF created — ${selectedSheets.size} sheet${selectedSheets.size !== 1 ? "s" : ""} · ${formatBytes(res.sizeBytes)}`);
    } catch (err) {
      notify("error", err instanceof Error ? err.message : "Conversion failed.");
    } finally {
      setConverting(false);
    }
  }, [loadedFile, selectedSheets, orientation, pageSize, fitToPage, notify]);

  const handleDownload = useCallback(() => {
    if (!result) return;
    downloadBuffer(result.buffer, result.filename);
  }, [result]);

  const handleReset = useCallback(() => {
    setLoadedFile(null);
    setResult(null);
    setNotif(null);
    setSelectedSheets(new Set());
    if (inputRef.current) inputRef.current.value = "";
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────

  const hasFile = !!loadedFile;

  return (
    <div className="mb-12 flex flex-col gap-6">

      {/* ── Drop zone ──────────────────────────────────────────────────────── */}
      {!hasFile && (
        <div
          ref={dropRef}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onClick={() => inputRef.current?.click()}
          role="button"
          tabIndex={0}
          aria-label="Upload Excel file — click or drag and drop"
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") inputRef.current?.click(); }}
          className="glass-panel rounded-2xl flex flex-col items-center justify-center gap-4 cursor-pointer transition-all duration-300 select-none outline-none focus-visible:ring-2 focus-visible:ring-[#ffb4ab]"
          style={{
            padding: "56px 40px",
            border: `2px dashed ${draggingOver ? "#ffb4ab" : "rgba(255,255,255,0.12)"}`,
            background: draggingOver ? "rgba(255,180,171,0.06)" : undefined,
            transform: draggingOver ? "scale(1.01)" : "scale(1)",
          }}
        >
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-300"
            style={{
              background: draggingOver ? "rgba(255,180,171,0.2)" : "rgba(255,180,171,0.1)",
              border: `1px solid ${draggingOver ? "rgba(255,180,171,0.4)" : "rgba(255,180,171,0.2)"}`,
            }}
          >
            <span
              className="material-symbols-outlined text-[32px] transition-colors duration-300"
              style={{ color: draggingOver ? "#ffb4ab" : "#ffb4ab" }}
              aria-hidden="true"
            >
              {draggingOver ? "file_download" : "table_chart"}
            </span>
          </div>
          <div className="text-center">
            <p className="text-[17px] font-bold text-[#e2e2e2] mb-1">
              {draggingOver ? "Drop your Excel file here" : "Drag & drop your Excel file here"}
            </p>
            <p className="text-[13px] text-[#988d9f]">
              or <span className="text-[#ffb4ab] font-semibold">click to browse</span>
              {" — XLSX & XLS · up to 50 MB"}
            </p>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
            className="sr-only"
            onChange={(e) => { if (e.target.files?.[0]) loadFile(e.target.files[0]); }}
            aria-hidden="true"
            tabIndex={-1}
          />
        </div>
      )}

      {/* ── Loading ────────────────────────────────────────────────────────── */}
      {loading && (
        <div className="glass-panel rounded-2xl p-5 flex items-center gap-4" aria-live="polite" aria-busy="true">
          <span className="w-5 h-5 border-2 border-[#ffb4ab]/30 border-t-[#ffb4ab] rounded-full animate-spin flex-shrink-0" />
          <p className="text-[15px] font-semibold text-[#e2e2e2]">Reading Excel file…</p>
        </div>
      )}

      {/* ── Notification ──────────────────────────────────────────────────── */}
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
          <button onClick={() => setNotif(null)} aria-label="Dismiss notification" className="opacity-60 hover:opacity-100 transition-opacity">
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
      )}

      {/* ── File info + sheet selector + settings ─────────────────────────── */}
      {hasFile && !loading && (
        <>
          {/* File card */}
          <div className="glass-panel rounded-2xl overflow-hidden">
            <div className="flex items-center gap-4 px-5 py-4 border-b border-[rgba(255,255,255,0.06)]">
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: "rgba(255,180,171,0.1)", border: "1px solid rgba(255,180,171,0.2)" }}
              >
                <span className="material-symbols-outlined text-[22px] text-[#ffb4ab]">table_chart</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-bold text-[#e2e2e2] truncate" title={loadedFile.name}>
                  {loadedFile.name}
                </p>
                <p className="text-[12px] text-[#988d9f]">
                  {formatBytes(loadedFile.size)} · {loadedFile.sheets.length} sheet{loadedFile.sheets.length !== 1 ? "s" : ""}
                </p>
              </div>
              <button
                onClick={handleReset}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold text-[#4d4354] hover:text-[#ef4444] transition-colors"
                aria-label="Remove file and start over"
              >
                <span className="material-symbols-outlined text-[15px]">delete_sweep</span>
                Clear
              </button>
            </div>

            {/* Sheet table */}
            <div className="px-5 py-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[13px] font-semibold text-[#988d9f] uppercase tracking-[0.07em]">
                  Sheets to convert
                </p>
                {loadedFile.sheets.length > 1 && (
                  <button
                    onClick={selectAll}
                    className="text-[12px] text-[#ffb4ab] hover:text-[#e2e2e2] transition-colors font-semibold"
                  >
                    Select all
                  </button>
                )}
              </div>
              <div className="flex flex-col gap-1.5" role="group" aria-label="Select sheets">
                {loadedFile.sheets.map((s) => {
                  const sel = selectedSheets.has(s.name);
                  return (
                    <button
                      key={s.name}
                      onClick={() => toggleSheet(s.name)}
                      aria-pressed={sel}
                      className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-left transition-all"
                      style={{
                        background: sel ? "rgba(255,180,171,0.1)" : "rgba(255,255,255,0.03)",
                        border: `1px solid ${sel ? "rgba(255,180,171,0.3)" : "rgba(255,255,255,0.06)"}`,
                      }}
                    >
                      <span
                        className="material-symbols-outlined text-[16px] flex-shrink-0"
                        style={{ color: sel ? "#ffb4ab" : "#4d4354" }}
                      >
                        {sel ? "check_box" : "check_box_outline_blank"}
                      </span>
                      <span className="flex-1 text-[13px] font-semibold truncate" style={{ color: sel ? "#e2e2e2" : "#988d9f" }}>
                        {s.name}
                      </span>
                      <span className="text-[11px] text-[#5a4d63] shrink-0">
                        {s.rows} rows × {s.cols} cols
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Settings */}
          <div className="glass-panel rounded-2xl p-5 flex flex-col gap-5">
            <p className="text-[13px] font-semibold text-[#988d9f] uppercase tracking-[0.08em]">PDF Settings</p>

            <div className="flex flex-col gap-2">
              <p className="text-[13px] font-semibold text-[#e2e2e2]">Page size</p>
              <div className="flex flex-wrap gap-2">
                {(["A4", "Letter"] as PageSizeKey[]).map((s) => (
                  <Chip key={s} active={pageSize === s} onClick={() => { setPageSize(s); setResult(null); }}>{s}</Chip>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <p className="text-[13px] font-semibold text-[#e2e2e2]">Orientation</p>
              <div className="flex flex-wrap gap-2">
                <Chip active={orientation === "portrait"} onClick={() => { setOrientation("portrait"); setResult(null); }}>
                  <span className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[14px]">crop_portrait</span>Portrait
                  </span>
                </Chip>
                <Chip active={orientation === "landscape"} onClick={() => { setOrientation("landscape"); setResult(null); }}>
                  <span className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[14px]">crop_landscape</span>Landscape
                  </span>
                </Chip>
              </div>
            </div>

            <Toggle
              id="fit-to-page"
              label="Fit sheet to page width"
              checked={fitToPage}
              onChange={(v) => { setFitToPage(v); setResult(null); }}
            />
          </div>

          {/* Convert button */}
          {!converting && !result && (
            <button
              onClick={handleConvert}
              disabled={selectedSheets.size === 0}
              className="btn-primary w-full text-white font-bold text-[16px] py-4 rounded-xl flex items-center justify-center gap-3 transition-all disabled:opacity-40"
            >
              <span className="material-symbols-outlined text-[20px]">picture_as_pdf</span>
              Convert to PDF
            </button>
          )}

          {/* Converting progress */}
          {converting && (
            <div className="glass-panel rounded-2xl p-5 flex items-center gap-4" aria-live="polite" aria-busy="true">
              <span className="w-5 h-5 border-2 border-[#ffb4ab]/30 border-t-[#ffb4ab] rounded-full animate-spin flex-shrink-0" />
              <p className="text-[15px] font-semibold text-[#e2e2e2]">
                Converting {selectedSheets.size} sheet{selectedSheets.size !== 1 ? "s" : ""} to PDF…
              </p>
            </div>
          )}

          {/* Result */}
          {result && !converting && (
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
                    {result.filename} · {formatBytes(result.sizeBytes)}
                  </p>
                </div>
              </div>
              <div className="p-5 flex flex-col sm:flex-row gap-3">
                <button
                  onClick={handleDownload}
                  className="btn-primary flex-1 text-white font-bold text-[15px] py-3.5 rounded-xl flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-[18px]">download</span>
                  Download PDF
                </button>
                <button
                  onClick={handleReset}
                  className="flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl text-[14px] font-semibold text-[#988d9f] hover:text-[#e2e2e2] transition-all"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
                >
                  <span className="material-symbols-outlined text-[16px]">upload_file</span>
                  Upload Another File
                </button>
                <button
                  onClick={() => setResult(null)}
                  className="flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl text-[14px] font-semibold text-[#988d9f] hover:text-[#e2e2e2] transition-all"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
                >
                  <span className="material-symbols-outlined text-[16px]">tune</span>
                  Change Settings
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Info note ──────────────────────────────────────────────────────── */}
      <div
        className="flex items-start gap-3 px-4 py-3.5 rounded-xl text-[13px]"
        style={{
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.06)",
          color: "#5a4d63",
        }}
      >
        <span className="material-symbols-outlined text-[16px] mt-0.5 flex-shrink-0">info</span>
        <span>
          Cell data and table structure are preserved. Charts, images, cell colours, and merged-cell styling are not reproduced — the output is a clean, readable table layout.
          All processing happens entirely in your browser — your file never leaves your device.
        </span>
      </div>
    </div>
  );
}
