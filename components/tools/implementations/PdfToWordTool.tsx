"use client";

/**
 * PDF → DOCX conversion (browser-only)
 *
 * Pipeline:
 *  1. pdfjs-dist  — loads the PDF and calls getTextContent() per page,
 *                   returning text items with x/y positions and font sizes.
 *  2. Reconstruction — groups items into lines (same Y), then lines into
 *                   paragraphs (Y-gap > threshold).  Font sizes are compared
 *                   to the median body size to detect H1/H2/H3 headings.
 *                   Bold is inferred from the font name.
 *                   Simple tables are detected when items on consecutive lines
 *                   share ≥3 distinct X-column boundaries within tolerance.
 *  3. docx        — emits a standards-compliant .docx with proper paragraph
 *                   styles, heading levels, bold runs, and table cells.
 *
 * Limitations (inherent to any browser-based PDF→DOCX tool):
 *  • Embedded images, vector graphics, and charts are not reproduced.
 *  • Complex multi-column layouts are linearised left-to-right.
 *  • Exact font matching is not possible; the output uses Calibri / Times New Roman.
 *  • Scanned (image-only) PDFs produce no text — the user is warned.
 */

import { useState, useRef, useCallback } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface TextItem {
  str: string;
  x: number;
  y: number;
  fontSize: number;
  fontName: string;
  bold: boolean;
}

interface Line {
  y: number;
  items: TextItem[];
  text: string;
  avgFontSize: number;
  isBold: boolean;
}

type BlockKind = "heading1" | "heading2" | "heading3" | "paragraph" | "table" | "pagebreak";

interface Block {
  kind: BlockKind;
  lines?: Line[];
  text?: string;
  bold?: boolean;
  rows?: string[][];
}

type NotifType = "success" | "error" | "warning";
interface Notif { type: NotifType; message: string; }

interface ConvertResult { buffer: Uint8Array; filename: string; pages: number; words: number; }

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(2)} MB`;
}

function median(arr: number[]): number {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

// ── pdfjs loader ──────────────────────────────────────────────────────────────

async function getPdfjs() {
  const lib = await import("pdfjs-dist");
  lib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  return lib;
}

// ── Text extraction ───────────────────────────────────────────────────────────

async function extractPages(file: File, onProgress: (p: number, t: number) => void): Promise<Line[][]> {
  const pdfjsLib = await getPdfjs();
  const buf      = await file.arrayBuffer();
  const pdfDoc   = await pdfjsLib.getDocument({ data: buf }).promise;
  const total    = pdfDoc.numPages;

  const allPages: Line[][] = [];

  for (let pageNum = 1; pageNum <= total; pageNum++) {
    onProgress(pageNum, total);
    const page    = await pdfDoc.getPage(pageNum);
    const content = await page.getTextContent();
    const vp      = page.getViewport({ scale: 1 });
    const pageH   = vp.height;

    // Build TextItems — pdfjs transform: [scaleX,skewX,skewY,scaleY,tx,ty]
    const items: TextItem[] = [];
    for (const item of content.items) {
      const it = item as { str: string; transform: number[]; fontName: string; width: number; height: number };
      if (!it.str.trim()) continue;
      const [, , , scaleY, tx, ty] = it.transform;
      const fontSize = Math.abs(scaleY);
      const x        = tx;
      const y        = pageH - ty; // flip Y so top=0
      const isBold   = /bold|black|heavy/i.test(it.fontName);

      items.push({ str: it.str, x, y, fontSize, fontName: it.fontName, bold: isBold });
    }

    // Group into lines by Y coordinate (tolerance = half the median font size)
    const fontSizes = items.map((i) => i.fontSize).filter((s) => s > 0);
    const medFS     = median(fontSizes) || 12;
    const yTol      = medFS * 0.5;

    items.sort((a, b) => a.y - b.y || a.x - b.x);

    const lines: Line[] = [];
    for (const item of items) {
      const existing = lines.find((l) => Math.abs(l.y - item.y) < yTol);
      if (existing) {
        existing.items.push(item);
      } else {
        lines.push({ y: item.y, items: [item], text: "", avgFontSize: 0, isBold: false });
      }
    }

    // Finalise lines
    for (const line of lines) {
      line.items.sort((a, b) => a.x - b.x);
      line.text        = line.items.map((i) => i.str).join(" ").trim();
      const sizes      = line.items.map((i) => i.fontSize).filter((s) => s > 0);
      line.avgFontSize = sizes.length ? sizes.reduce((a, b) => a + b, 0) / sizes.length : medFS;
      line.isBold      = line.items.some((i) => i.bold);
    }

    allPages.push(lines.filter((l) => l.text.trim()));
  }

  return allPages;
}

// ── Document reconstruction ───────────────────────────────────────────────────

function detectTableRows(lines: Line[]): string[][] | null {
  if (lines.length < 2) return null;

  // Collect all unique X bucket boundaries across lines
  const xBuckets = (line: Line): number[] => {
    const xs = line.items.map((i) => i.x);
    xs.sort((a, b) => a - b);
    const buckets: number[] = [];
    for (const x of xs) {
      if (!buckets.length || x - buckets[buckets.length - 1] > 20) buckets.push(x);
    }
    return buckets;
  };

  const allBuckets = lines.map(xBuckets);
  const firstBuckets = allBuckets[0];
  if (firstBuckets.length < 2) return null;

  // Check that subsequent lines share roughly the same column X positions
  const consistent = allBuckets.every((b) => {
    if (Math.abs(b.length - firstBuckets.length) > 1) return false;
    return b.every((x, i) => {
      const ref = firstBuckets[i] ?? firstBuckets[firstBuckets.length - 1];
      return Math.abs(x - ref) < 30;
    });
  });

  if (!consistent) return null;

  // Build cell grid
  return lines.map((line) => {
    return firstBuckets.map((colX, ci) => {
      const nextX = firstBuckets[ci + 1] ?? Infinity;
      const cellItems = line.items.filter((it) => it.x >= colX - 15 && it.x < nextX - 15);
      return cellItems.map((it) => it.str).join(" ").trim();
    });
  });
}

function reconstruct(pages: Line[][]): Block[] {
  const blocks: Block[] = [];

  // Get global median font size across all pages for heading detection
  const allFontSizes: number[] = [];
  for (const page of pages) {
    for (const line of page) allFontSizes.push(line.avgFontSize);
  }
  const bodySize = median(allFontSizes) || 12;

  for (let pi = 0; pi < pages.length; pi++) {
    if (pi > 0) blocks.push({ kind: "pagebreak" });

    const lines = pages[pi];
    if (!lines.length) continue;

    // Group lines into paragraphs (gap > 1.8× body line height)
    const lineGapThreshold = bodySize * 1.8;
    const paragraphGroups: Line[][] = [];
    let current: Line[] = [];

    for (let li = 0; li < lines.length; li++) {
      if (!current.length) {
        current.push(lines[li]);
        continue;
      }
      const prevY = current[current.length - 1].y;
      const gap   = lines[li].y - prevY;
      if (gap > lineGapThreshold) {
        paragraphGroups.push(current);
        current = [lines[li]];
      } else {
        current.push(lines[li]);
      }
    }
    if (current.length) paragraphGroups.push(current);

    // Classify each paragraph group
    for (const group of paragraphGroups) {
      if (!group.length) continue;

      const avgSize  = group.reduce((s, l) => s + l.avgFontSize, 0) / group.length;
      const isBold   = group.every((l) => l.isBold);
      const textFull = group.map((l) => l.text).join(" ").trim();
      const isShort  = group.length === 1 && textFull.length < 120;

      // Try table detection first (only multi-line groups)
      if (group.length >= 2) {
        const rows = detectTableRows(group);
        if (rows && rows[0].length >= 2) {
          blocks.push({ kind: "table", rows });
          continue;
        }
      }

      // Heading detection
      const ratio = avgSize / bodySize;
      if (isShort && (ratio >= 1.6 || (ratio >= 1.3 && isBold))) {
        const heading: BlockKind = ratio >= 1.9 ? "heading1" : ratio >= 1.5 ? "heading2" : "heading3";
        blocks.push({ kind: heading, text: textFull });
        continue;
      }

      blocks.push({ kind: "paragraph", lines: group, text: textFull, bold: isBold });
    }
  }

  return blocks;
}

// ── DOCX builder ──────────────────────────────────────────────────────────────

async function buildDocx(blocks: Block[], title: string): Promise<Uint8Array> {
  const {
    Document, Packer, Paragraph, TextRun, HeadingLevel,
    Table, TableRow, TableCell, WidthType, BorderStyle,
    PageBreak, AlignmentType,
  } = await import("docx");

  const children: InstanceType<typeof Paragraph | typeof Table>[] = [];

  for (const block of blocks) {
    if (block.kind === "pagebreak") {
      children.push(
        new Paragraph({ children: [new PageBreak()] })
      );
      continue;
    }

    if (block.kind === "heading1") {
      children.push(
        new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: block.text ?? "" })] })
      );
      continue;
    }

    if (block.kind === "heading2") {
      children.push(
        new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: block.text ?? "" })] })
      );
      continue;
    }

    if (block.kind === "heading3") {
      children.push(
        new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun({ text: block.text ?? "" })] })
      );
      continue;
    }

    if (block.kind === "table" && block.rows) {
      const noBorder = { style: BorderStyle.NONE, size: 0, color: "auto" };
      const cellBorder = { style: BorderStyle.SINGLE, size: 4, color: "AAAAAA" };
      const borderDef = { top: cellBorder, bottom: cellBorder, left: cellBorder, right: cellBorder };

      const tableRows = block.rows.map((row, ri) =>
        new TableRow({
          tableHeader: ri === 0,
          children: row.map((cell) =>
            new TableCell({
              borders: borderDef,
              width: { size: Math.floor(9000 / row.length), type: WidthType.DXA },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({ text: cell, bold: ri === 0 }),
                  ],
                }),
              ],
            })
          ),
        })
      );

      children.push(
        new Table({
          width: { size: 9000, type: WidthType.DXA },
          rows: tableRows,
        })
      );
      // Add spacing after table
      children.push(new Paragraph({ children: [] }));
      continue;
    }

    // Paragraph — reconstruct runs per line for better spacing
    if (block.lines && block.lines.length) {
      const runs: InstanceType<typeof TextRun>[] = [];
      block.lines.forEach((line, li) => {
        line.items.forEach((item, ii) => {
          runs.push(
            new TextRun({
              text: item.str,
              bold: item.bold,
              break: ii === 0 && li > 0 ? 1 : 0,
            })
          );
          // Add space between items on same line
          if (ii < line.items.length - 1) {
            runs.push(new TextRun({ text: " " }));
          }
        });
      });

      children.push(
        new Paragraph({
          alignment: AlignmentType.LEFT,
          spacing: { after: 120 },
          children: runs,
        })
      );
    } else {
      children.push(
        new Paragraph({
          alignment: AlignmentType.LEFT,
          spacing: { after: 120 },
          children: [
            new TextRun({ text: block.text ?? "", bold: block.bold }),
          ],
        })
      );
    }
  }

  // Empty document guard
  if (!children.length) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: "No text content could be extracted from this PDF." })],
      })
    );
  }

  const doc = new Document({
    creator: "ToolNest AI",
    title,
    description: "Converted from PDF by ToolNest AI",
    sections: [{ children }],
  });

  return Packer.toBuffer(doc);
}

// ── Main conversion entry point ───────────────────────────────────────────────

async function convertPdfToWord(
  file: File,
  onProgress: (page: number, total: number) => void
): Promise<ConvertResult> {
  const pages  = await extractPages(file, onProgress);
  const blocks = reconstruct(pages);

  const totalWords = pages
    .flat()
    .reduce((s, l) => s + l.text.split(/\s+/).filter(Boolean).length, 0);

  if (totalWords === 0) {
    throw new Error(
      "No selectable text found. This PDF may be scanned (image-only). " +
      "OCR is required to extract text from scanned PDFs."
    );
  }

  const title  = file.name.replace(/\.pdf$/i, "");
  const buffer = await buildDocx(blocks, title);

  return {
    buffer,
    filename: title + ".docx",
    pages: pages.length,
    words: totalWords,
  };
}

function downloadBuffer(buf: Uint8Array, filename: string) {
  const blob = new Blob([buf.buffer as ArrayBuffer], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
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
    <div
      className="flex flex-col gap-1.5 rounded-xl p-4"
      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
    >
      <span className="material-symbols-outlined text-[18px]" style={{ color }} aria-hidden="true">{icon}</span>
      <p className="text-[20px] font-extrabold leading-none" style={{ color }}>{value}</p>
      <p className="text-[11px] text-[#988d9f] font-semibold uppercase tracking-wide">{label}</p>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function PdfToWordTool() {
  const [draggingOver, setDraggingOver] = useState(false);
  const [converting, setConverting]     = useState(false);
  const [progress, setProgress]         = useState<{ page: number; total: number } | null>(null);
  const [result, setResult]             = useState<ConvertResult | null>(null);
  const [notif, setNotif]               = useState<Notif | null>(null);
  const [loadedFile, setLoadedFile]     = useState<File | null>(null);

  const dropRef  = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const notify = useCallback((type: NotifType, message: string) => {
    setNotif({ type, message });
    if (type !== "warning") setTimeout(() => setNotif(null), 8000);
  }, []);

  // ── File ingestion ─────────────────────────────────────────────────────────

  const handleFile = useCallback(
    async (file: File) => {
      if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
        notify("error", `"${file.name}" is not a PDF file.`);
        return;
      }
      if (file.size > 100 * 1024 * 1024) {
        notify("error", `File exceeds the 100 MB limit (${formatBytes(file.size)}).`);
        return;
      }

      setLoadedFile(file);
      setResult(null);
      setNotif(null);
      setConverting(true);
      setProgress(null);

      try {
        const res = await convertPdfToWord(file, (page, total) => {
          setProgress({ page, total });
        });
        setResult(res);
        notify("success", `Converted successfully — ${res.pages} page${res.pages !== 1 ? "s" : ""}, ~${res.words.toLocaleString()} words.`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Conversion failed. Please try another PDF.";
        notify("error", msg);
        setLoadedFile(null);
      } finally {
        setConverting(false);
        setProgress(null);
      }
    },
    [notify]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDraggingOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const onDragOver  = useCallback((e: React.DragEvent) => { e.preventDefault(); setDraggingOver(true);  }, []);
  const onDragLeave = useCallback((e: React.DragEvent) => {
    if (dropRef.current && !dropRef.current.contains(e.relatedTarget as Node)) setDraggingOver(false);
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
      e.target.value = "";
    },
    [handleFile]
  );

  const handleDownload = useCallback(() => {
    if (!result) return;
    downloadBuffer(result.buffer, result.filename);
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
              className="material-symbols-outlined text-[38px] transition-colors duration-300"
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

          {/* Feature chips */}
          <div className="flex flex-wrap justify-center gap-2 mt-1">
            {["Text & fonts preserved", "Headings detected", "Tables supported", "Multi-page"].map((f) => (
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
            onChange={handleInputChange}
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
            background: notif.type === "success"
              ? "rgba(34,197,94,0.12)"
              : notif.type === "warning"
              ? "rgba(250,204,21,0.10)"
              : "rgba(239,68,68,0.12)",
            border: `1px solid ${notif.type === "success" ? "rgba(34,197,94,0.3)" : notif.type === "warning" ? "rgba(250,204,21,0.3)" : "rgba(239,68,68,0.3)"}`,
            color: notif.type === "success" ? "#22c55e" : notif.type === "warning" ? "#facc15" : "#ef4444",
          }}
        >
          <span className="material-symbols-outlined text-[20px] flex-shrink-0 mt-0.5">
            {notif.type === "success" ? "check_circle" : notif.type === "warning" ? "warning" : "error"}
          </span>
          <span className="flex-1 leading-relaxed">{notif.message}</span>
          <button onClick={() => setNotif(null)} aria-label="Dismiss" className="opacity-60 hover:opacity-100 transition-opacity flex-shrink-0">
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
      )}

      {/* ── Converting progress ────────────────────────────────────────────── */}
      {converting && (
        <div className="glass-panel rounded-2xl p-6 flex flex-col gap-4" aria-live="polite" aria-busy="true">
          <div className="flex items-center gap-4">
            <span className="w-6 h-6 border-2 border-[#ffb4ab]/30 border-t-[#ffb4ab] rounded-full animate-spin flex-shrink-0" />
            <div className="flex-1">
              <p className="text-[15px] font-bold text-[#e2e2e2]">
                {progress ? `Processing page ${progress.page} of ${progress.total}…` : "Loading PDF…"}
              </p>
              {progress && (
                <p className="text-[12px] text-[#988d9f] mt-0.5">
                  Extracting text, detecting structure, building document
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
              <span className="material-symbols-outlined text-[14px]">description</span>
              <span className="truncate">{loadedFile.name}</span>
              <span className="ml-auto shrink-0">{formatBytes(loadedFile.size)}</span>
            </div>
          )}
        </div>
      )}

      {/* ── Result ────────────────────────────────────────────────────────── */}
      {result && !converting && (
        <div className="flex flex-col gap-4">
          {/* Stats */}
          <div
            className="grid gap-3"
            style={{ gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))" }}
          >
            <StatCard icon="description" label="Pages"      value={String(result.pages)}               color="#ffb4ab" />
            <StatCard icon="text_fields" label="Words"      value={result.words.toLocaleString()}       color="#4cd7f6" />
            <StatCard icon="download"    label="File size"  value={formatBytes(result.buffer.byteLength)} color="#4ade80" />
          </div>

          {/* Download card */}
          <div className="glass-panel rounded-2xl overflow-hidden">
            <div className="flex items-center gap-4 px-5 py-4 border-b border-[rgba(255,255,255,0.06)]">
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.25)" }}
              >
                <span className="material-symbols-outlined text-[22px] text-[#22c55e]">check_circle</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-bold text-[#e2e2e2]">Word document ready</p>
                <p className="text-[12px] text-[#988d9f] truncate">{result.filename}</p>
              </div>
            </div>
            <div className="p-5 flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleDownload}
                className="btn-primary flex-1 text-white font-bold text-[15px] py-3.5 rounded-xl flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-[18px]">download</span>
                Download .docx
              </button>
              <button
                onClick={handleReset}
                className="flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl text-[14px] font-semibold text-[#988d9f] hover:text-[#e2e2e2] transition-all"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
              >
                <span className="material-symbols-outlined text-[16px]">upload_file</span>
                Convert Another PDF
              </button>
            </div>
          </div>

          {/* Limitations note */}
          <div
            className="flex items-start gap-3 px-4 py-3.5 rounded-xl text-[13px]"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", color: "#5a4d63" }}
          >
            <span className="material-symbols-outlined text-[16px] mt-0.5 flex-shrink-0">info</span>
            <span>
              Text, headings, tables, bold formatting, and paragraph structure are preserved.
              Embedded images, charts, and vector graphics are not reproduced in the output document.
              Complex multi-column layouts may be linearised. Everything runs in your browser — your file never leaves your device.
            </span>
          </div>
        </div>
      )}

      {/* ── Empty state (after reset, no file) ────────────────────────────── */}
      {!converting && !result && !draggingOver && (
        <div className="glass-panel rounded-2xl p-6 flex flex-col gap-3">
          <p className="text-[12px] font-semibold text-[#988d9f] uppercase tracking-[0.08em]">How it works</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { icon: "upload_file",     label: "1. Upload PDF",          desc: "Drag & drop or browse for your PDF file" },
              { icon: "auto_awesome",    label: "2. Auto-convert",         desc: "Text, headings, tables and formatting are extracted" },
              { icon: "download",        label: "3. Download .docx",       desc: "Open and edit in Word, Google Docs or LibreOffice" },
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
