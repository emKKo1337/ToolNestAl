"use client";

/**
 * PDF → PPTX conversion (browser-only)
 *
 * Pipeline:
 *  1. pdfjs-dist  — loads the PDF and, for every page:
 *      a. Renders the page to an offscreen canvas at 2× scale and encodes it
 *         as a JPEG data URL (the slide "background image" layer)
 *      b. Calls getTextContent() to extract text items with x/y positions,
 *         font size, and bounding-box dimensions (the editable text layer)
 *  2. PptxGenJS   — builds one PPTX slide per PDF page:
 *      a. Text boxes are added FIRST (z-order behind the image), positioned
 *         exactly over where they appear in the PDF
 *      b. The full-page JPEG is added ON TOP, perfectly covering the slide
 *         and preserving visual fidelity
 *      → The user sees the PDF as-is; moving or deleting the image in
 *        PowerPoint reveals the editable text layer underneath
 *  3. Output      — PptxGenJS writes a Blob and it is downloaded directly
 *
 * Supported formats: PDF (all versions readable by pdfjs-dist)
 *
 * Limitations (inherent to browser-only conversion):
 *  • Text font family is not preserved (falls back to the system sans-serif)
 *  • Scanned/image-only PDFs produce slides with no text layer
 *  • Complex vector graphics, gradients, and blending modes may differ
 *    slightly from the original PDF rendering engine
 */

import { useState, useRef, useCallback } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ExtractedText {
  str: string;
  xPt: number;  // from left edge, in PDF points
  yPt: number;  // from top edge, in PDF points
  wPt: number;
  hPt: number;
  sizePt: number;
}

interface PageData {
  jpegDataUrl: string;
  widthPt: number;   // PDF point dimensions (72 pt = 1 inch)
  heightPt: number;
  texts: ExtractedText[];
}

interface ConvertResult {
  filename: string;
  sizeBytes: number;
  totalPages: number;
}

type NotifType = "success" | "error" | "warning";
interface Notif { type: NotifType; message: string; }

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_FILE_BYTES  = 100 * 1024 * 1024;  // 100 MB
const RENDER_SCALE    = 2;                   // canvas render quality multiplier
const MIN_TEXT_LEN    = 1;                   // skip empty/whitespace-only runs

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1048576).toFixed(2)} MB`;
}

// ── pdfjs loader ──────────────────────────────────────────────────────────────

async function getPdfjs() {
  const lib = await import("pdfjs-dist");
  lib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  return lib;
}

// ── Per-page extraction ───────────────────────────────────────────────────────

async function extractPage(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pdfPage: any,
): Promise<PageData> {
  const viewport1x = pdfPage.getViewport({ scale: 1 });
  const widthPt    = viewport1x.width;   // at scale=1, pdfjs uses CSS px ≈ pt
  const heightPt   = viewport1x.height;

  // ── Render to canvas (high-res for quality) ──────────────────────────────
  const vp     = pdfPage.getViewport({ scale: RENDER_SCALE });
  const canvas = document.createElement("canvas");
  canvas.width  = Math.round(vp.width);
  canvas.height = Math.round(vp.height);
  const ctx = canvas.getContext("2d")!;

  // White background so JPEG compression doesn't darken transparent areas
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  await pdfPage.render({ canvasContext: ctx, viewport: vp }).promise;
  const jpegDataUrl = canvas.toDataURL("image/jpeg", 0.88);

  // ── Extract text items ────────────────────────────────────────────────────
  const content = await pdfPage.getTextContent();
  const texts: ExtractedText[] = [];

  for (const item of content.items) {
    // pdfjs TextItem: { str, transform:[a,b,c,d,e,f], width, height }
    // transform is a CSS-matrix; e=tx, f=ty (origin bottom-left in PDF space)
    const it = item as {
      str: string;
      transform: number[];
      width: number;
      height: number;
    };

    if (it.str.trim().length < MIN_TEXT_LEN) continue;

    const [, , , scaleY, tx, ty] = it.transform;
    const fontH = Math.abs(scaleY);
    const itemW = Math.abs(it.width)  || fontH * it.str.length * 0.55;
    const itemH = Math.abs(it.height) || fontH;

    // Flip y: PDF origin is bottom-left; PPTX origin is top-left
    const xPt = tx;
    const yPt = heightPt - ty - fontH;

    texts.push({
      str:    it.str,
      xPt:    Math.max(0, xPt),
      yPt:    Math.max(0, yPt),
      wPt:    Math.max(itemW, 4),
      hPt:    Math.max(itemH + 2, 6),
      sizePt: Math.max(fontH, 6),
    });
  }

  return { jpegDataUrl, widthPt, heightPt, texts };
}

// ── PPTX builder ──────────────────────────────────────────────────────────────

async function buildPptx(pages: PageData[], filename: string): Promise<Blob> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const PptxGenJS = (await import("pptxgenjs")).default as any;
  const pptx = new PptxGenJS();

  // Use the first page's dimensions for the slide layout
  if (pages.length > 0) {
    const { widthPt, heightPt } = pages[0];
    const wIn = widthPt  / 72;
    const hIn = heightPt / 72;
    pptx.defineLayout({ name: "PDF_PAGE", width: wIn, height: hIn });
    pptx.layout = "PDF_PAGE";
  }

  for (const page of pages) {
    const slideW = page.widthPt  / 72;  // inches
    const slideH = page.heightPt / 72;

    const slide = pptx.addSlide();

    // ── 1. Text layer (behind image — editable) ───────────────────────────
    // Text boxes use transparent fill so the image on top is fully visible.
    // In PowerPoint, the user can move or delete the image to reveal and
    // edit the text layer underneath.
    for (const t of page.texts) {
      const xIn = t.xPt / 72;
      const yIn = t.yPt / 72;
      const wIn = t.wPt / 72;
      const hIn = t.hPt / 72;

      // Skip items that fall outside the slide bounds
      if (xIn >= slideW || yIn >= slideH || xIn < 0 || yIn < 0) continue;

      slide.addText(t.str, {
        x: xIn,
        y: yIn,
        w: Math.min(wIn, slideW - xIn),
        h: Math.min(hIn, slideH - yIn),
        fontSize:  Math.round(t.sizePt * 0.75),  // pt → pptx pt (approx scale)
        fontFace:  "Arial",
        color:     "000000",
        fill:      { type: "none" },
        line:      { type: "none" },
        wrap:      false,
        shrinkText: true,
        margin:    0,
      });
    }

    // ── 2. Full-page JPEG (on top — visual layer) ─────────────────────────
    // Added last so it renders above the text boxes.
    // Deleting this image in PowerPoint reveals the editable text layer.
    slide.addImage({
      data: page.jpegDataUrl,
      x: 0,
      y: 0,
      w: slideW,
      h: slideH,
    });
  }

  return (await pptx.write({ outputType: "blob" })) as Blob;
}

// ── Download ──────────────────────────────────────────────────────────────────

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement("a");
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({
  icon, label, value, color,
}: { icon: string; label: string; value: string; color: string }) {
  return (
    <div
      className="flex flex-col gap-1.5 rounded-xl p-4"
      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
    >
      <span className="material-symbols-outlined text-[18px]" style={{ color }}>{icon}</span>
      <p className="text-[20px] font-extrabold leading-none" style={{ color }}>{value}</p>
      <p className="text-[11px] text-[#988d9f] font-semibold uppercase tracking-wide">{label}</p>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function PdfToPowerPointTool() {
  const [draggingOver, setDraggingOver] = useState(false);
  const [converting, setConverting]     = useState(false);
  const [progress, setProgress]         = useState<{ page: number; total: number } | null>(null);
  const [phase, setPhase]               = useState<"render" | "build">("render");
  const [result, setResult]             = useState<(ConvertResult & { blob: Blob }) | null>(null);
  const [loadedFile, setLoadedFile]     = useState<File | null>(null);
  const [notif, setNotif]               = useState<Notif | null>(null);

  const dropRef  = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const notify = useCallback((type: NotifType, message: string) => {
    setNotif({ type, message });
    setTimeout(() => setNotif(null), 8000);
  }, []);

  // ── File handling ─────────────────────────────────────────────────────────

  const handleFile = useCallback(async (file: File) => {
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      notify("error", `"${file.name}" is not a PDF. Please upload a .pdf file.`);
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
    setPhase("render");

    try {
      const pdfjsLib = await getPdfjs();
      const buf      = await file.arrayBuffer();
      const pdfDoc   = await pdfjsLib.getDocument({ data: buf }).promise;
      const total    = pdfDoc.numPages;

      // Extract all pages
      const pages: PageData[] = [];
      for (let i = 1; i <= total; i++) {
        setProgress({ page: i, total });
        const page = await pdfDoc.getPage(i);
        pages.push(await extractPage(page));
      }

      // Build PPTX
      setPhase("build");
      setProgress(null);

      const filename = file.name.replace(/\.pdf$/i, "") + ".pptx";
      const blob     = await buildPptx(pages, filename);

      setResult({ filename, sizeBytes: blob.size, totalPages: total, blob });
      notify("success", `Converted ${total} page${total !== 1 ? "s" : ""} to PowerPoint (${formatBytes(blob.size)}).`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Conversion failed. Please try another file.";
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
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const onDragOver  = useCallback((e: React.DragEvent) => { e.preventDefault(); setDraggingOver(true); }, []);
  const onDragLeave = useCallback((e: React.DragEvent) => {
    if (dropRef.current && !dropRef.current.contains(e.relatedTarget as Node)) setDraggingOver(false);
  }, []);

  const handleDownload = useCallback(() => {
    if (!result) return;
    downloadBlob(result.blob, result.filename);
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
            {["One slide per page", "Editable text layer", "Images preserved", "Multi-page", "No upload"].map((f) => (
              <span
                key={f}
                className="px-2.5 py-1 rounded-lg text-[11px] font-semibold"
                style={{
                  background: "rgba(255,180,171,0.08)",
                  color: "#ffb4ab",
                  border: "1px solid rgba(255,180,171,0.15)",
                }}
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
            background: notif.type === "success"
              ? "rgba(34,197,94,0.12)"
              : notif.type === "warning"
              ? "rgba(250,204,21,0.10)"
              : "rgba(239,68,68,0.12)",
            border: `1px solid ${
              notif.type === "success" ? "rgba(34,197,94,0.3)"
              : notif.type === "warning" ? "rgba(250,204,21,0.3)"
              : "rgba(239,68,68,0.3)"}`,
            color: notif.type === "success" ? "#22c55e"
                 : notif.type === "warning" ? "#facc15"
                 : "#ef4444",
          }}
        >
          <span className="material-symbols-outlined text-[20px] flex-shrink-0 mt-0.5">
            {notif.type === "success" ? "check_circle" : notif.type === "warning" ? "warning" : "error"}
          </span>
          <span className="flex-1 leading-relaxed">{notif.message}</span>
          <button
            onClick={() => setNotif(null)}
            aria-label="Dismiss"
            className="opacity-60 hover:opacity-100 transition-opacity flex-shrink-0"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
      )}

      {/* ── Conversion progress ────────────────────────────────────────────── */}
      {converting && (
        <div
          className="glass-panel rounded-2xl p-6 flex flex-col gap-4"
          aria-live="polite"
          aria-busy="true"
        >
          {/* File info */}
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

          {/* Phase indicator */}
          <div className="flex items-center gap-3">
            <span className="w-6 h-6 border-2 border-[#ffb4ab]/30 border-t-[#ffb4ab] rounded-full animate-spin flex-shrink-0" />
            <div className="flex-1">
              {phase === "render" ? (
                <>
                  <p className="text-[15px] font-bold text-[#e2e2e2]">
                    {progress
                      ? `Rendering page ${progress.page} of ${progress.total}…`
                      : "Loading PDF…"}
                  </p>
                  <p className="text-[12px] text-[#988d9f] mt-0.5">
                    Rendering each page and extracting text positions
                  </p>
                </>
              ) : (
                <>
                  <p className="text-[15px] font-bold text-[#e2e2e2]">Building PPTX…</p>
                  <p className="text-[12px] text-[#988d9f] mt-0.5">
                    Assembling slides with image and text layers
                  </p>
                </>
              )}
            </div>
          </div>

          {/* Progress bar (render phase only) */}
          {phase === "render" && progress && (
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

          {/* Build phase spinner indicator */}
          {phase === "build" && (
            <div className="flex gap-1.5 items-center">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="w-1.5 h-1.5 rounded-full"
                  style={{
                    background: "#ffb4ab",
                    animation: `bounce 1.2s ${i * 0.2}s infinite`,
                    opacity: 0.6,
                  }}
                />
              ))}
              <style>{`@keyframes bounce { 0%,80%,100%{transform:scale(1)}40%{transform:scale(1.5)} }`}</style>
            </div>
          )}
        </div>
      )}

      {/* ── Result ────────────────────────────────────────────────────────── */}
      {result && !converting && (
        <div className="flex flex-col gap-4">
          {/* Stats */}
          <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))" }}>
            <StatCard icon="slideshow"   label="Slides"    value={String(result.totalPages)}   color="#ffb4ab" />
            <StatCard icon="download"    label="PPTX size" value={formatBytes(result.sizeBytes)} color="#4ade80" />
            <StatCard icon="description" label="Source"    value={loadedFile ? formatBytes(loadedFile.size) : "—"} color="#4cd7f6" />
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
                <p className="text-[15px] font-bold text-[#e2e2e2]">Presentation ready</p>
                <p className="text-[12px] text-[#988d9f] truncate">{result.filename}</p>
              </div>
            </div>
            <div className="p-5 flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleDownload}
                className="btn-primary flex-1 text-white font-bold text-[15px] py-3.5 rounded-xl flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-[18px]">download</span>
                Download PPTX
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

          {/* How to use the output */}
          <div
            className="rounded-xl overflow-hidden"
            style={{ border: "1px solid rgba(255,255,255,0.06)" }}
          >
            <div
              className="px-4 py-3 flex items-center gap-2"
              style={{ background: "rgba(255,180,171,0.06)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}
            >
              <span className="material-symbols-outlined text-[16px] text-[#ffb4ab]">tips_and_updates</span>
              <p className="text-[12px] font-bold text-[#ffb4ab]">How to edit your slides</p>
            </div>
            <div className="px-4 py-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { step: "1", text: "Open the PPTX in PowerPoint, Google Slides, or LibreOffice." },
                { step: "2", text: "Click the background image on any slide, then press Delete to reveal the editable text layer." },
                { step: "3", text: "Click any text to edit it, restyle it, or add new content on top." },
              ].map(({ step, text }) => (
                <div key={step} className="flex items-start gap-2.5">
                  <span
                    className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-[11px] font-bold mt-0.5"
                    style={{ background: "rgba(255,180,171,0.15)", color: "#ffb4ab" }}
                  >
                    {step}
                  </span>
                  <p className="text-[12px] text-[#5a4d63] leading-relaxed">{text}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Limitations note */}
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
              Each slide contains the original PDF page as a high-resolution background image plus an
              editable text layer. Fonts fall back to Arial; scanned PDFs produce no text layer.
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
              { icon: "upload_file",  label: "1. Upload PDF",         desc: "Drag & drop or browse for your PDF (up to 100 MB)" },
              { icon: "auto_awesome", label: "2. Auto-convert",        desc: "Pages render as slides with image and editable text layers" },
              { icon: "download",     label: "3. Download PPTX",       desc: "Open in PowerPoint, Google Slides, or LibreOffice" },
            ].map(({ icon, label, desc }) => (
              <div
                key={label}
                className="flex flex-col gap-2 p-4 rounded-xl"
                style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}
              >
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
