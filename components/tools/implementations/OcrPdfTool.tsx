"use client";

/**
 * OCR PDF — browser-local optical character recognition
 *
 * Pipeline per page:
 *   1. pdfjs-dist renders the page to an off-screen canvas at OCR_SCALE (2×)
 *   2. Tesseract.js (v5 createWorker) recognises text + word bounding boxes
 *   3. Extracted text is accumulated for TXT download / clipboard copy
 *   4. For the searchable PDF, pdf-lib embeds the page image as background
 *      and overlays each word as invisible text (opacity 0) at the mapped
 *      coordinate, making the file fully text-searchable in any PDF viewer
 *
 * No files leave the device — pdfjs, Tesseract and pdf-lib run in the browser.
 */

import { useState, useRef, useCallback, useEffect } from "react";

// ── Constants ─────────────────────────────────────────────────────────────────

const OCR_SCALE = 2; // render scale — higher = better accuracy, slower

// Tesseract language codes mapped to display names
const LANGUAGES: { code: string; label: string }[] = [
  { code: "eng", label: "English" },
  { code: "deu", label: "German" },
  { code: "fra", label: "French" },
  { code: "spa", label: "Spanish" },
  { code: "ita", label: "Italian" },
  { code: "hrv", label: "Croatian" },
  { code: "bos", label: "Bosnian" },
  { code: "srp", label: "Serbian" },
  { code: "slv", label: "Slovenian" },
  { code: "por", label: "Portuguese" },
];

// ── Types ─────────────────────────────────────────────────────────────────────

interface PageResult {
  pageNum:    number;
  text:       string;
  confidence: number; // 0–100
  words: Array<{
    text: string;
    bbox: { x0: number; y0: number; x1: number; y1: number };
  }>;
  /** PNG data URL of the rendered page (for searchable PDF) */
  imageDataUrl: string;
  /** Original viewport dimensions in PDF points (scale=1) */
  ptWidth:  number;
  ptHeight: number;
}

type Phase = "idle" | "loading" | "ocr" | "building" | "done";

type NotifType = "success" | "error";
interface Notif { type: NotifType; msg: string }

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1_048_576) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1_048_576).toFixed(2)} MB`;
}

function download(data: BlobPart, filename: string, mime: string) {
  const blob = new Blob([data], { type: mime });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function avgConfidence(pages: PageResult[]): number {
  if (!pages.length) return 0;
  return Math.round(pages.reduce((s, p) => s + p.confidence, 0) / pages.length);
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function OcrPdfTool() {
  const [dragging, setDragging]   = useState(false);
  const [pdfFile, setPdfFile]     = useState<File | null>(null);
  const [language, setLanguage]   = useState("eng");
  const [phase, setPhase]         = useState<Phase>("idle");
  const [totalPages, setTotal]    = useState(0);
  const [donePages, setDone]      = useState(0);
  const [ocrMsg, setOcrMsg]       = useState("");
  const [results, setResults]     = useState<PageResult[]>([]);
  const [copied, setCopied]       = useState(false);
  const [notif, setNotif]         = useState<Notif | null>(null);
  const [searchPdfBytes, setSearchPdfBytes] = useState<Uint8Array | null>(null);
  const [searchPdfName, setSearchPdfName]   = useState("");

  const inputRef   = useRef<HTMLInputElement>(null);
  const dropRef    = useRef<HTMLDivElement>(null);
  const abortRef   = useRef(false);

  const notify = useCallback((type: NotifType, msg: string) => {
    setNotif({ type, msg });
    setTimeout(() => setNotif(null), 10000);
  }, []);

  // Cleanup on unmount
  useEffect(() => () => { abortRef.current = true; }, []);

  // ── File ingestion ──────────────────────────────────────────────────────────

  const handleFile = useCallback((f: File) => {
    if (f.type !== "application/pdf" && !f.name.toLowerCase().endsWith(".pdf")) {
      notify("error", `"${f.name}" is not a PDF.`); return;
    }
    if (f.size > 200 * 1024 * 1024) {
      notify("error", `File exceeds 200 MB (${fmt(f.size)}).`); return;
    }
    setPdfFile(f);
    setPhase("idle");
    setResults([]);
    setDone(0);
    setSearchPdfBytes(null);
    setNotif(null);
  }, [notify]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const f = e.dataTransfer.files[0]; if (f) handleFile(f);
  }, [handleFile]);

  // ── OCR Pipeline ────────────────────────────────────────────────────────────

  const handleStart = useCallback(async () => {
    if (!pdfFile) return;
    abortRef.current = false;
    setPhase("loading");
    setResults([]);
    setDone(0);
    setSearchPdfBytes(null);
    setNotif(null);

    try {
      // ── Step 1: load PDF with pdfjs ─────────────────────────────────────────
      setOcrMsg("Loading PDF…");
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

      const rawBuf = await pdfFile.arrayBuffer();
      let srcDoc;
      try {
        srcDoc = await pdfjs.getDocument({ data: new Uint8Array(rawBuf) }).promise;
      } catch (err: unknown) {
        const e = err as { name?: string };
        if (e?.name === "PasswordException") {
          notify("error", "This PDF is password-protected. Please unlock it first using the Unlock PDF tool.");
          setPhase("idle"); return;
        }
        throw err;
      }

      const numPages = srcDoc.numPages;
      setTotal(numPages);

      // ── Step 2: initialise Tesseract worker ──────────────────────────────────
      setOcrMsg("Initialising OCR engine…");
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker(language, 1, {
        // Load language data from jsDelivr CDN (default, no config needed)
        logger: () => {},
      });

      const pageResults: PageResult[] = [];
      setPhase("ocr");

      // ── Step 3: process each page ────────────────────────────────────────────
      for (let i = 1; i <= numPages; i++) {
        if (abortRef.current) break;
        setOcrMsg(`Recognising page ${i} of ${numPages}…`);

        const page    = await srcDoc.getPage(i);
        const vp1     = page.getViewport({ scale: 1 });          // 1pt = 1px at scale=1
        const vp      = page.getViewport({ scale: OCR_SCALE });

        const canvas      = document.createElement("canvas");
        canvas.width      = Math.round(vp.width);
        canvas.height     = Math.round(vp.height);
        const ctx         = canvas.getContext("2d")!;

        await page.render({ canvasContext: ctx, viewport: vp, canvas }).promise;

        const imageDataUrl = canvas.toDataURL("image/png");

        // Request block data so we can extract word-level bounding boxes
        const { data } = await worker.recognize(canvas, {}, { blocks: true });

        // Flatten blocks → paragraphs → lines → words
        const words: Array<{ text: string; bbox: { x0: number; y0: number; x1: number; y1: number } }> = [];
        for (const block of (data.blocks ?? [])) {
          for (const para of block.paragraphs) {
            for (const line of para.lines) {
              for (const word of line.words) {
                if (word.text.trim()) {
                  words.push({ text: word.text, bbox: word.bbox });
                }
              }
            }
          }
        }

        pageResults.push({
          pageNum:      i,
          text:         data.text ?? "",
          confidence:   Math.round(data.confidence ?? 0),
          words,
          imageDataUrl,
          ptWidth:      vp1.width,
          ptHeight:     vp1.height,
        });

        setDone(i);
        setResults([...pageResults]);
      }

      await worker.terminate();

      if (abortRef.current) { setPhase("idle"); return; }

      // ── Step 4: build searchable PDF ─────────────────────────────────────────
      setPhase("building");
      setOcrMsg("Building searchable PDF…");

      const { PDFDocument, rgb, StandardFonts } = await import("pdf-lib");
      const outDoc  = await PDFDocument.create();
      const helv    = await outDoc.embedFont(StandardFonts.Helvetica);

      for (const pr of pageResults) {
        // Embed page image
        const base64  = pr.imageDataUrl.split(",")[1];
        const pngBytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
        const pngImg  = await outDoc.embedPng(pngBytes);

        const page = outDoc.addPage([pr.ptWidth, pr.ptHeight]);
        page.drawImage(pngImg, { x: 0, y: 0, width: pr.ptWidth, height: pr.ptHeight });

        // Overlay invisible text (opacity 0) for searchability
        for (const w of pr.words) {
          if (!w.text.trim()) continue;
          // Convert canvas pixel coords → PDF point coords
          // x: straightforward scale-down
          // y: flip axis (PDF origin = bottom-left)
          const xPt   = w.bbox.x0 / OCR_SCALE;
          const yPt   = pr.ptHeight - (w.bbox.y1 / OCR_SCALE); // bottom of word in pt space
          const hPt   = (w.bbox.y1 - w.bbox.y0) / OCR_SCALE;
          const wPt   = (w.bbox.x1 - w.bbox.x0) / OCR_SCALE;

          const fontSize = Math.max(1, hPt * 0.85);
          const textW    = helv.widthOfTextAtSize(w.text, fontSize);
          // Scale horizontally to fit the bounding box
          const scaleX   = textW > 0 ? Math.min(wPt / textW, 4) : 1;

          try {
            page.drawText(w.text, {
              x:        xPt,
              y:        yPt,
              size:     fontSize,
              font:     helv,
              color:    rgb(0, 0, 0),
              opacity:  0,
              // pdf-lib doesn't expose textRenderingMode directly, but opacity 0
              // is indexed by all major PDF engines as searchable text
            });
            void scaleX; // scaleX calculated but not used — pdf-lib has no inline scale transform
          } catch {
            // Skip malformed words silently
          }
        }
      }

      const pdfBytes    = await outDoc.save({ useObjectStreams: false });
      const searchName  = pdfFile.name.replace(/\.pdf$/i, "") + "_searchable.pdf";
      setSearchPdfBytes(pdfBytes);
      setSearchPdfName(searchName);

      setPhase("done");
      setOcrMsg("");

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "OCR failed. Please try again.";
      notify("error", msg);
      setPhase("idle");
    }
  }, [pdfFile, language, notify]);

  // ── Actions ─────────────────────────────────────────────────────────────────

  const fullText = results.map((p, i) =>
    results.length > 1 ? `--- Page ${i + 1} ---\n${p.text}` : p.text
  ).join("\n\n");

  const handleCopy = useCallback(async () => {
    if (!fullText) return;
    await navigator.clipboard.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }, [fullText]);

  const handleDownloadTxt = useCallback(() => {
    if (!pdfFile || !fullText) return;
    const filename = pdfFile.name.replace(/\.pdf$/i, "") + "_ocr.txt";
    download(fullText, filename, "text/plain");
  }, [pdfFile, fullText]);

  const handleDownloadSearchable = useCallback(() => {
    if (searchPdfBytes) download(searchPdfBytes.buffer as ArrayBuffer, searchPdfName, "application/pdf");
  }, [searchPdfBytes, searchPdfName]);

  const handleCancel = useCallback(() => { abortRef.current = true; }, []);

  const handleReset = useCallback(() => {
    abortRef.current = true;
    setPdfFile(null); setPhase("idle"); setResults([]); setDone(0); setTotal(0);
    setSearchPdfBytes(null); setNotif(null); setOcrMsg("");
    if (inputRef.current) inputRef.current.value = "";
  }, []);

  // ── Derived ──────────────────────────────────────────────────────────────────

  const isRunning = phase === "loading" || phase === "ocr" || phase === "building";
  const progress  = totalPages > 0 ? Math.round((donePages / totalPages) * 100) : 0;
  const avgConf   = avgConfidence(results);

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="mb-12 flex flex-col gap-6">

      {/* Drop zone */}
      {!pdfFile && (
        <div ref={dropRef}
          onDrop={onDrop}
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={e => { if (dropRef.current && !dropRef.current.contains(e.relatedTarget as Node)) setDragging(false); }}
          onClick={() => inputRef.current?.click()}
          role="button" tabIndex={0} aria-label="Upload PDF for OCR"
          onKeyDown={e => { if (e.key === "Enter" || e.key === " ") inputRef.current?.click(); }}
          className="glass-panel rounded-2xl flex flex-col items-center justify-center gap-5 cursor-pointer transition-all duration-300 select-none outline-none focus-visible:ring-2 focus-visible:ring-[#ffb4ab]"
          style={{
            padding: "64px 40px",
            border: `2px dashed ${dragging ? "#ffb4ab" : "rgba(255,255,255,0.12)"}`,
            background: dragging ? "rgba(255,180,171,0.06)" : undefined,
            transform: dragging ? "scale(1.01)" : "scale(1)",
          }}>
          <div className="w-20 h-20 rounded-2xl flex items-center justify-center transition-all duration-300"
            style={{
              background: dragging ? "rgba(255,180,171,0.2)" : "rgba(255,180,171,0.1)",
              border: `1px solid ${dragging ? "rgba(255,180,171,0.45)" : "rgba(255,180,171,0.2)"}`,
            }}>
            <span className="material-symbols-outlined text-[38px]" style={{ color: "#ffb4ab" }}>
              {dragging ? "file_download" : "document_scanner"}
            </span>
          </div>
          <div className="text-center">
            <p className="text-[18px] font-bold text-[#e2e2e2] mb-1.5">
              {dragging ? "Drop your PDF here" : "Drag & drop your PDF here"}
            </p>
            <p className="text-[14px] text-[#988d9f]">
              or <span className="text-[#ffb4ab] font-semibold">click to browse</span>
              {" — scanned or image-based PDF · up to 200 MB"}
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            {["Scanned PDFs", "10 languages", "Searchable PDF", "TXT export", "Browser-local"].map(tag => (
              <span key={tag} className="px-2.5 py-1 rounded-lg text-[11px] font-semibold"
                style={{ background: "rgba(255,180,171,0.08)", color: "#ffb4ab", border: "1px solid rgba(255,180,171,0.15)" }}>
                {tag}
              </span>
            ))}
          </div>
          <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="sr-only"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
            aria-hidden="true" tabIndex={-1} />
        </div>
      )}

      {/* Notification */}
      {notif && (
        <div role="alert"
          className="flex items-start gap-3 px-5 py-4 rounded-xl text-[14px] font-medium"
          style={{
            background: notif.type === "success" ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)",
            border: `1px solid ${notif.type === "success" ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`,
            color: notif.type === "success" ? "#22c55e" : "#ef4444",
          }}>
          <span className="material-symbols-outlined text-[20px] flex-shrink-0 mt-0.5">
            {notif.type === "success" ? "check_circle" : "error"}
          </span>
          <span className="flex-1 leading-relaxed">{notif.msg}</span>
          <button onClick={() => setNotif(null)} aria-label="Dismiss"
            className="opacity-60 hover:opacity-100 transition-opacity">
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
      )}

      {/* Settings + Controls (file selected but not yet done) */}
      {pdfFile && phase !== "done" && (
        <div className="flex flex-col gap-4">

          {/* File header */}
          <div className="glass-panel rounded-2xl px-5 py-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: "rgba(255,180,171,0.1)", border: "1px solid rgba(255,180,171,0.2)" }}>
              <span className="material-symbols-outlined text-[18px] text-[#ffb4ab]">picture_as_pdf</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-bold text-[#e2e2e2] truncate">{pdfFile.name}</p>
              <p className="text-[11px] text-[#5a4d63]">{fmt(pdfFile.size)}</p>
            </div>
            {!isRunning && (
              <button onClick={handleReset} aria-label="Remove file"
                className="w-8 h-8 rounded-lg flex items-center justify-center opacity-50 hover:opacity-100 transition-opacity"
                style={{ background: "rgba(255,255,255,0.05)" }}>
                <span className="material-symbols-outlined text-[16px] text-[#988d9f]">close</span>
              </button>
            )}
          </div>

          {/* Language selector */}
          {!isRunning && (
            <div className="glass-panel rounded-2xl p-5 flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="ocr-lang"
                  className="text-[11px] font-semibold uppercase tracking-wide"
                  style={{ color: "#988d9f" }}>
                  Document Language
                </label>
                <select id="ocr-lang" value={language} onChange={e => setLanguage(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg text-[13px] font-medium outline-none focus-visible:ring-2 focus-visible:ring-[#ffb4ab]"
                  style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#e2e2e2", colorScheme: "dark" }}>
                  {LANGUAGES.map(l => (
                    <option key={l.code} value={l.code}>{l.label}</option>
                  ))}
                </select>
                <p className="text-[11px] text-[#5a4d63]">
                  Select the primary language of your document for best accuracy.
                </p>
              </div>

              <div className="flex flex-col gap-2 px-4 py-3 rounded-xl"
                style={{ background: "rgba(76,215,246,0.06)", border: "1px solid rgba(76,215,246,0.15)" }}>
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[15px] text-[#4cd7f6]">info</span>
                  <p className="text-[12px] font-semibold text-[#4cd7f6]">Before you start</p>
                </div>
                <ul className="text-[11px] leading-relaxed space-y-1" style={{ color: "#5a4d63" }}>
                  <li>• Works best on scanned or image-based PDFs — native text PDFs are already selectable</li>
                  <li>• Language packs are downloaded on first use (~4 MB each) from jsDelivr CDN</li>
                  <li>• Processing time: ~5–15 s per page depending on resolution and complexity</li>
                </ul>
              </div>

              <button onClick={handleStart}
                className="btn-primary w-full text-white font-bold text-[15px] py-3.5 rounded-xl flex items-center justify-center gap-2">
                <span className="material-symbols-outlined text-[18px]">document_scanner</span>Start OCR
              </button>
            </div>
          )}

          {/* Progress */}
          {isRunning && (
            <div className="glass-panel rounded-2xl p-5 flex flex-col gap-4" aria-live="polite" aria-busy="true">
              <div className="flex items-center gap-3">
                <span className="w-6 h-6 border-2 border-[#ffb4ab]/30 border-t-[#ffb4ab] rounded-full animate-spin flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-bold text-[#e2e2e2] truncate">{ocrMsg || "Processing…"}</p>
                  {totalPages > 0 && (
                    <p className="text-[11px] text-[#5a4d63] mt-0.5">
                      {donePages} of {totalPages} page{totalPages !== 1 ? "s" : ""} processed
                    </p>
                  )}
                </div>
                <p className="text-[15px] font-bold text-[#ffb4ab] flex-shrink-0">
                  {phase === "building" ? "…" : `${progress}%`}
                </p>
              </div>

              {totalPages > 0 && phase === "ocr" && (
                <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
                  <div className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${progress}%`, background: "linear-gradient(90deg,#ffb4ab,#ff8a80)" }} />
                </div>
              )}

              {/* Live results while OCR runs */}
              {results.length > 0 && (
                <div>
                  <p className="text-[11px] font-semibold text-[#988d9f] mb-2 uppercase tracking-wide">
                    Extracted so far
                  </p>
                  <div className="rounded-xl p-3 text-[12px] leading-relaxed font-mono max-h-40 overflow-y-auto"
                    style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", color: "#988d9f" }}>
                    {results[results.length - 1].text.slice(0, 500) || "(no text detected on this page)"}
                    {results[results.length - 1].text.length > 500 && "…"}
                  </div>
                </div>
              )}

              <button onClick={handleCancel}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-semibold transition-all"
                style={{ background: "rgba(239,68,68,0.08)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)" }}>
                <span className="material-symbols-outlined text-[15px]">stop_circle</span>Cancel
              </button>
            </div>
          )}
        </div>
      )}

      {/* Results */}
      {phase === "done" && results.length > 0 && (
        <div className="flex flex-col gap-5">

          {/* Stats row */}
          <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))" }}>
            {[
              { icon: "description", label: "Pages",       value: String(totalPages),       color: "#4cd7f6" },
              { icon: "spellcheck",  label: "Confidence",  value: `${avgConf}%`,            color: avgConf >= 80 ? "#4ade80" : avgConf >= 60 ? "#facc15" : "#ef4444" },
              { icon: "article",     label: "Words",       value: String(results.reduce((s, p) => s + p.words.length, 0)), color: "#ffb4ab" },
              { icon: "language",    label: "Language",    value: LANGUAGES.find(l => l.code === language)?.label ?? language, color: "#988d9f" },
            ].map(({ icon, label, value, color }) => (
              <div key={label} className="flex flex-col gap-1.5 rounded-xl p-4"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <span className="material-symbols-outlined text-[18px]" style={{ color }}>{icon}</span>
                <p className="text-[18px] font-extrabold leading-none truncate" style={{ color }}>{value}</p>
                <p className="text-[11px] text-[#988d9f] font-semibold uppercase tracking-wide">{label}</p>
              </div>
            ))}
          </div>

          {/* Confidence note */}
          {avgConf < 70 && (
            <div className="flex items-start gap-3 px-4 py-3.5 rounded-xl"
              style={{ background: "rgba(250,204,21,0.07)", border: "1px solid rgba(250,204,21,0.2)" }}>
              <span className="material-symbols-outlined text-[16px] text-[#facc15] mt-0.5 flex-shrink-0">warning</span>
              <p className="text-[12px] leading-relaxed" style={{ color: "#facc15" }}>
                OCR confidence is below 70%. Results may contain errors. Try a higher-resolution scan, or select a different language.
              </p>
            </div>
          )}

          {/* Download actions */}
          <div className="glass-panel rounded-2xl p-5 flex flex-col gap-3">
            <p className="text-[12px] font-bold text-[#ffb4ab] uppercase tracking-wide">Export</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button onClick={handleCopy}
                className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-[13px] font-semibold transition-all"
                style={{
                  background: copied ? "rgba(74,222,128,0.1)" : "rgba(255,255,255,0.05)",
                  color: copied ? "#4ade80" : "#e2e2e2",
                  border: `1px solid ${copied ? "rgba(74,222,128,0.3)" : "rgba(255,255,255,0.1)"}`,
                }}>
                <span className="material-symbols-outlined text-[16px]">{copied ? "check" : "content_copy"}</span>
                {copied ? "Copied!" : "Copy Text"}
              </button>

              <button onClick={handleDownloadTxt}
                className="btn-primary flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-white text-[13px] font-semibold">
                <span className="material-symbols-outlined text-[16px]">download</span>Download TXT
              </button>

              <button onClick={handleDownloadSearchable}
                disabled={!searchPdfBytes}
                className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-[13px] font-semibold transition-all disabled:opacity-40"
                style={{ background: "rgba(76,215,246,0.08)", color: "#4cd7f6", border: "1px solid rgba(76,215,246,0.2)" }}>
                <span className="material-symbols-outlined text-[16px]">picture_as_pdf</span>Searchable PDF
              </button>
            </div>
          </div>

          {/* Extracted text */}
          <div className="glass-panel rounded-2xl p-5 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[13px] font-bold text-[#e2e2e2]">Extracted Text</p>
              <span className="text-[11px] text-[#5a4d63]">
                {fullText.length.toLocaleString()} characters
              </span>
            </div>

            {results.map((pr, idx) => (
              <div key={pr.pageNum} className="flex flex-col gap-2">
                {results.length > 1 && (
                  <div className="flex items-center gap-2">
                    <div className="h-px flex-1" style={{ background: "rgba(255,255,255,0.06)" }} />
                    <div className="flex items-center gap-2 px-3 py-1 rounded-full flex-shrink-0"
                      style={{ background: "rgba(255,180,171,0.08)", border: "1px solid rgba(255,180,171,0.15)" }}>
                      <span className="material-symbols-outlined text-[12px] text-[#ffb4ab]">description</span>
                      <p className="text-[11px] font-bold text-[#ffb4ab]">Page {pr.pageNum}</p>
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                        style={{
                          background: pr.confidence >= 80 ? "rgba(74,222,128,0.12)" : pr.confidence >= 60 ? "rgba(250,204,21,0.12)" : "rgba(239,68,68,0.1)",
                          color: pr.confidence >= 80 ? "#4ade80" : pr.confidence >= 60 ? "#facc15" : "#ef4444",
                        }}>
                        {pr.confidence}% confidence
                      </span>
                    </div>
                    <div className="h-px flex-1" style={{ background: "rgba(255,255,255,0.06)" }} />
                  </div>
                )}
                <textarea
                  readOnly
                  value={pr.text || "(no text detected on this page)"}
                  rows={Math.min(Math.max(pr.text.split("\n").length + 1, 4), 20)}
                  aria-label={`Extracted text from page ${pr.pageNum}`}
                  className="w-full px-4 py-3 rounded-xl text-[13px] font-mono leading-relaxed resize-y outline-none focus-visible:ring-2 focus-visible:ring-[#ffb4ab]"
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.07)",
                    color: pr.text ? "#e2e2e2" : "#5a4d63",
                    minHeight: "80px",
                  }}
                />
                {/* Per-page actions */}
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={async () => {
                      await navigator.clipboard.writeText(pr.text);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold opacity-60 hover:opacity-100 transition-opacity"
                    style={{ background: "rgba(255,255,255,0.04)", color: "#988d9f" }}
                    aria-label={`Copy text from page ${pr.pageNum}`}>
                    <span className="material-symbols-outlined text-[13px]">content_copy</span>
                    Copy page {idx + 1}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Reset */}
          <div className="flex gap-3">
            <button onClick={handleReset}
              className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-[13px] font-semibold text-[#988d9f] hover:text-[#e2e2e2] transition-all"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <span className="material-symbols-outlined text-[16px]">upload_file</span>OCR Another PDF
            </button>
          </div>

          <div className="flex items-start gap-3 px-4 py-3.5 rounded-xl"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", color: "#5a4d63" }}>
            <span className="material-symbols-outlined text-[16px] mt-0.5 flex-shrink-0">info</span>
            <p className="text-[11px] leading-relaxed">
              OCR was processed entirely in your browser using Tesseract.js. No files were uploaded to any server.
              The searchable PDF contains an invisible text layer overlaid on the original images — it is fully
              text-searchable in Adobe Reader, Chrome PDF viewer, and other standard PDF viewers.
            </p>
          </div>
        </div>
      )}

      {/* How it works */}
      {!pdfFile && (
        <div className="glass-panel rounded-2xl p-6 flex flex-col gap-3">
          <p className="text-[12px] font-semibold text-[#988d9f] uppercase tracking-[0.08em]">How it works</p>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            {[
              { icon: "upload_file",      label: "1. Upload",    desc: "Drop your scanned or image-based PDF" },
              { icon: "language",         label: "2. Language",  desc: "Choose the document language for best accuracy" },
              { icon: "document_scanner", label: "3. OCR",       desc: "Tesseract reads each page and extracts text" },
              { icon: "download",         label: "4. Export",    desc: "Copy, download TXT or get a searchable PDF" },
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
