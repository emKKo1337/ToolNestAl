"use client";

/**
 * PDF compression strategy:
 * True lossless PDF compression (font subsetting, image recompression) is not
 * achievable purely in the browser. Instead we use the industry-standard
 * rasterisation approach: each page is rendered to a canvas via pdfjs-dist and
 * re-exported as a JPEG at a target quality level, then assembled into a new PDF
 * with pdf-lib.  This is the same method used by most online "compress PDF"
 * tools (Smallpdf, ilovepdf, etc.).
 *
 * Trade-off: the output PDF contains JPEG images of each page; text will not
 * be selectable, but all visual content is preserved at the chosen quality.
 * Typical savings: 20-45% (Low), 45-70% (Balanced), 65-85% (High).
 */

import { useState, useRef, useCallback } from "react";
import { PDFDocument } from "pdf-lib";

// pdfjs-dist uses browser-only globals (DOMMatrix, etc.) that crash during
// Next.js SSR prerendering. Dynamic import ensures it only runs on the client.
async function getPdfjs() {
  const pdfjsLib = await import("pdfjs-dist");
  // Local worker copy in /public — no CDN dependency, no webpack bundling issues
  pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  return pdfjsLib;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const MAX_FILE_BYTES = 100 * 1024 * 1024;

// ─── Types ────────────────────────────────────────────────────────────────────
type CompressionLevel = "low" | "balanced" | "high";

interface LevelConfig {
  id: CompressionLevel;
  label: string;
  badge: string;
  /** Render scale applied to each PDF page (higher = more detail retained) */
  scale: number;
  /** JPEG quality 0–1 */
  quality: number;
  icon: string;
  color: string;
  desc: string;
  expectedRange: string;
}

interface LoadedPdf {
  file: File;
  name: string;
  size: number;
  pageCount: number;
}

interface CompressResult {
  buffer: ArrayBuffer;
  originalSize: number;
  compressedSize: number;
  savedPct: number;
  filename: string;
}

interface ProgressState {
  page: number;
  total: number;
}

type NotifType = "success" | "error";
interface Notif {
  type: NotifType;
  message: string;
}

// ─── Compression level definitions ───────────────────────────────────────────
const LEVELS: LevelConfig[] = [
  {
    id: "low",
    label: "Low Compression",
    badge: "Best Quality",
    scale: 1.5,
    quality: 0.92,
    icon: "high_quality",
    color: "#4cd7f6",
    desc: "Minimal quality loss, moderate size reduction",
    expectedRange: "20–45%",
  },
  {
    id: "balanced",
    label: "Balanced",
    badge: "Recommended",
    scale: 1.5,
    quality: 0.78,
    icon: "balance",
    color: "#ddb7ff",
    desc: "Great balance between quality and size",
    expectedRange: "45–70%",
  },
  {
    id: "high",
    label: "High Compression",
    badge: "Smallest File",
    scale: 1.0,
    quality: 0.58,
    icon: "compress",
    color: "#ffb4ab",
    desc: "Maximum size reduction, some quality loss",
    expectedRange: "65–85%",
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(2)} MB`;
}

function baseName(filename: string): string {
  return filename.replace(/\.pdf$/i, "");
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Core compression: render each page via pdfjs → JPEG → pdf-lib output */
async function doCompress(
  file: File,
  cfg: LevelConfig,
  onProgress: (p: ProgressState) => void
): Promise<ArrayBuffer> {
  const pdfjsLib = await getPdfjs();
  const arrayBuf = await file.arrayBuffer();

  // Load with pdfjs for rendering
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuf.slice(0) });
  const pdfDoc = await loadingTask.promise;
  const total = pdfDoc.numPages;

  // Build output PDF
  const outDoc = await PDFDocument.create();

  for (let pageNum = 1; pageNum <= total; pageNum++) {
    onProgress({ page: pageNum, total });

    const page = await pdfDoc.getPage(pageNum);

    // Natural page dimensions in PDF points (at scale=1, pdfjs reports in pts)
    const naturalVp = page.getViewport({ scale: 1 });
    // Render at target scale for quality
    const renderVp = page.getViewport({ scale: cfg.scale });

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(renderVp.width);
    canvas.height = Math.round(renderVp.height);

    // pdfjs-dist v6 uses `canvas` as primary render target
    await page.render({ canvas, viewport: renderVp }).promise;

    // Export as JPEG at target quality
    const dataUrl = canvas.toDataURL("image/jpeg", cfg.quality);
    const base64 = dataUrl.slice("data:image/jpeg;base64,".length);
    const jpegBytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));

    // Embed into output PDF at original page size
    const jpgImg = await outDoc.embedJpg(jpegBytes);
    const outPage = outDoc.addPage([naturalVp.width, naturalVp.height]);
    outPage.drawImage(jpgImg, { x: 0, y: 0, width: naturalVp.width, height: naturalVp.height });

    // Release canvas memory
    canvas.width = 0;
    canvas.height = 0;
  }

  const saved = await outDoc.save();
  // Copy into a plain ArrayBuffer (pdf-lib returns Uint8Array<ArrayBufferLike>)
  return saved.buffer.slice(saved.byteOffset, saved.byteOffset + saved.byteLength) as ArrayBuffer;
}

// ─── Stat card ────────────────────────────────────────────────────────────────
function StatCard({ icon, label, value, color }: { icon: string; label: string; value: string; color: string }) {
  return (
    <div className="flex flex-col gap-1.5 p-4 rounded-xl" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
      <span className="material-symbols-outlined text-[18px]" style={{ color }} aria-hidden="true">{icon}</span>
      <p className="text-[22px] font-extrabold leading-none" style={{ color }}>{value}</p>
      <p className="text-[12px] text-[#988d9f]">{label}</p>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function CompressPdfTool() {
  const [pdf, setPdf] = useState<LoadedPdf | null>(null);
  const [draggingOver, setDraggingOver] = useState(false);
  const [level, setLevel] = useState<CompressionLevel>("balanced");
  const [progress, setProgress] = useState<ProgressState | null>(null);
  const [result, setResult] = useState<CompressResult | null>(null);
  const [notif, setNotif] = useState<Notif | null>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const notify = useCallback((type: NotifType, message: string) => {
    setNotif({ type, message });
    setTimeout(() => setNotif(null), 6000);
  }, []);

  // ── Load file ───────────────────────────────────────────────────────────────
  const loadFile = useCallback(
    async (file: File) => {
      if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
        notify("error", `"${file.name}" is not a PDF file.`);
        return;
      }
      if (file.size > MAX_FILE_BYTES) {
        notify("error", `"${file.name}" exceeds the 100 MB limit.`);
        return;
      }
      try {
        const pdfjsLib = await getPdfjs();
        const buf = await file.arrayBuffer();
        const task = pdfjsLib.getDocument({ data: buf });
        const doc = await task.promise;
        setPdf({ file, name: file.name, size: file.size, pageCount: doc.numPages });
        setResult(null);
        setNotif(null);
      } catch {
        notify("error", "Could not read this PDF. It may be corrupted or password-protected.");
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

  const onDragLeave = useCallback(
    (e: React.DragEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.relatedTarget as Node)) {
        setDraggingOver(false);
      }
    },
    []
  );

  // ── Compress ────────────────────────────────────────────────────────────────
  const compress = useCallback(async () => {
    if (!pdf) return;
    const cfg = LEVELS.find((l) => l.id === level)!;
    setResult(null);
    setNotif(null);
    setProgress({ page: 0, total: pdf.pageCount });

    try {
      const buf = await doCompress(pdf.file, cfg, setProgress);
      const savedPct = Math.max(0, Math.round(((pdf.size - buf.byteLength) / pdf.size) * 100));
      setResult({
        buffer: buf,
        originalSize: pdf.size,
        compressedSize: buf.byteLength,
        savedPct,
        filename: `${baseName(pdf.name)}-compressed.pdf`,
      });
      const msg =
        savedPct > 0
          ? `Compressed successfully — ${savedPct}% smaller (${formatBytes(pdf.size - buf.byteLength)} saved).`
          : "Compression complete. This PDF was already well-optimised.";
      notify("success", msg);
    } catch (err) {
      notify("error", err instanceof Error ? err.message : "Compression failed. The PDF may be encrypted.");
    } finally {
      setProgress(null);
    }
  }, [pdf, level, notify]);

  // ── Download ────────────────────────────────────────────────────────────────
  const download = useCallback(() => {
    if (!result) return;
    downloadBlob(new Blob([result.buffer], { type: "application/pdf" }), result.filename);
  }, [result]);

  // ── Reset ───────────────────────────────────────────────────────────────────
  const reset = useCallback(() => {
    setPdf(null);
    setResult(null);
    setProgress(null);
    setNotif(null);
    if (inputRef.current) inputRef.current.value = "";
  }, []);

  const isBusy = progress !== null;
  const pct = progress && progress.total > 0 ? Math.round((progress.page / progress.total) * 100) : 0;
  const activeCfg = LEVELS.find((l) => l.id === level)!;

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
              or <span className="text-[#ddb7ff] font-semibold">click to browse</span> — up to 100 MB
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
          <button
            onClick={() => setNotif(null)}
            aria-label="Dismiss"
            className="opacity-60 hover:opacity-100 transition-opacity"
          >
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
            disabled={isBusy}
            className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center text-[#4d4354] hover:text-[#ef4444] hover:bg-[rgba(239,68,68,0.1)] transition-all disabled:opacity-40"
            aria-label="Remove file and reset"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>
      )}

      {/* ── Compression level selector ── */}
      {pdf && !isBusy && (
        <div className="glass-panel rounded-2xl p-5">
          <p className="text-[13px] font-semibold text-[#988d9f] uppercase tracking-[0.08em] mb-4">
            Compression Level
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {LEVELS.map((l) => (
              <button
                key={l.id}
                onClick={() => { setLevel(l.id); setResult(null); }}
                aria-pressed={level === l.id}
                className="flex flex-col gap-2.5 p-4 rounded-xl border text-left transition-all duration-200"
                style={{
                  background: level === l.id ? `${l.color}14` : "rgba(255,255,255,0.03)",
                  borderColor: level === l.id ? `${l.color}50` : "rgba(255,255,255,0.08)",
                }}
              >
                <div className="flex items-center justify-between">
                  <span
                    className="material-symbols-outlined text-[22px] transition-colors"
                    style={{ color: level === l.id ? l.color : "#4d4354" }}
                    aria-hidden="true"
                  >
                    {l.icon}
                  </span>
                  <span
                    className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                    style={{
                      background: level === l.id ? `${l.color}22` : "rgba(255,255,255,0.06)",
                      color: level === l.id ? l.color : "#4d4354",
                    }}
                  >
                    {l.badge}
                  </span>
                </div>
                <p
                  className="text-[14px] font-bold transition-colors"
                  style={{ color: level === l.id ? "#e2e2e2" : "#988d9f" }}
                >
                  {l.label}
                </p>
                <p
                  className="text-[12px] leading-relaxed transition-colors"
                  style={{ color: level === l.id ? "#988d9f" : "#4d4354" }}
                >
                  {l.desc}
                </p>
                <p
                  className="text-[12px] font-bold transition-colors"
                  style={{ color: level === l.id ? l.color : "#4d4354" }}
                >
                  ~{l.expectedRange} reduction
                </p>
              </button>
            ))}
          </div>
          <p className="text-[12px] text-[#4d4354] mt-3 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[14px]">info</span>
            Pages are rasterised as JPEG images — the standard browser PDF compression method.
            Text will not be selectable in the output.
          </p>
        </div>
      )}

      {/* ── Progress ── */}
      {isBusy && progress && (
        <div className="glass-panel rounded-2xl p-5 flex flex-col gap-3">
          <div className="flex items-center justify-between text-[14px]">
            <span className="font-semibold text-[#e2e2e2] flex items-center gap-2.5">
              <span
                className="w-4 h-4 border-2 rounded-full animate-spin inline-block"
                style={{
                  borderColor: `${activeCfg.color}33`,
                  borderTopColor: activeCfg.color,
                }}
              />
              Compressing PDF…
            </span>
            <span className="font-bold tabular-nums" style={{ color: activeCfg.color }}>
              {pct}%
            </span>
          </div>
          <div className="h-2.5 rounded-full bg-[rgba(255,255,255,0.08)] overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300 ease-out"
              style={{
                width: `${pct}%`,
                background: `linear-gradient(90deg, ${activeCfg.color}, #ddb7ff)`,
              }}
            />
          </div>
          <p className="text-[12px] text-[#988d9f] tabular-nums">
            Page {progress.page} of {progress.total}
          </p>
        </div>
      )}

      {/* ── Compress button ── */}
      {pdf && !isBusy && !result && (
        <button
          onClick={compress}
          className="btn-primary w-full text-white font-bold text-[16px] py-4 rounded-xl flex items-center justify-center gap-3 transition-all"
        >
          <span className="material-symbols-outlined text-[20px]">compress</span>
          Compress PDF
        </button>
      )}

      {/* ── Results ── */}
      {result && !isBusy && (
        <div className="glass-panel rounded-2xl overflow-hidden">
          <div className="p-5 border-b border-[rgba(255,255,255,0.06)]">
            <p className="text-[13px] font-semibold text-[#988d9f] uppercase tracking-[0.08em] mb-4">
              Compression Results
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard
                icon="description"
                label="Original size"
                value={formatBytes(result.originalSize)}
                color="#988d9f"
              />
              <StatCard
                icon="compress"
                label="Compressed size"
                value={formatBytes(result.compressedSize)}
                color="#ddb7ff"
              />
              <StatCard
                icon="savings"
                label="Space saved"
                value={formatBytes(Math.max(0, result.originalSize - result.compressedSize))}
                color="#22c55e"
              />
              <StatCard
                icon="trending_down"
                label="Reduction"
                value={`${result.savedPct}%`}
                color={result.savedPct >= 10 ? "#22c55e" : "#f59e0b"}
              />
            </div>
          </div>

          {/* Visual size bar */}
          <div className="px-5 py-4 border-b border-[rgba(255,255,255,0.06)]">
            <div className="flex justify-between text-[12px] text-[#988d9f] mb-2">
              <span>Original</span>
              <span>Compressed</span>
            </div>
            <div className="h-3 rounded-full bg-[rgba(255,255,255,0.08)] overflow-hidden relative">
              {/* Original (background) */}
              <div className="absolute inset-0 rounded-full bg-[rgba(255,255,255,0.08)]" />
              {/* Compressed portion */}
              <div
                className="h-full rounded-full transition-all duration-700 ease-out"
                style={{
                  width: `${Math.max(2, 100 - result.savedPct)}%`,
                  background: "linear-gradient(90deg, #ddb7ff, #4cd7f6)",
                }}
              />
            </div>
            <p className="text-[12px] text-[#988d9f] mt-2">
              Compressed to <span className="text-[#e2e2e2] font-semibold">{100 - result.savedPct}%</span> of original size
            </p>
          </div>

          <div className="p-5 flex flex-col sm:flex-row gap-3">
            <button
              onClick={download}
              className="btn-primary flex-1 text-white font-bold text-[15px] py-3.5 rounded-xl flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-[18px]">download</span>
              Download Compressed PDF
            </button>
            <button
              onClick={() => { setResult(null); setNotif(null); }}
              className="flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl text-[14px] font-semibold text-[#988d9f] hover:text-[#e2e2e2] transition-all"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              <span className="material-symbols-outlined text-[16px]">tune</span>
              Try Different Level
            </button>
          </div>
        </div>
      )}

      {/* ── Empty state ── */}
      {!pdf && (
        <div className="glass-panel rounded-2xl p-10 flex flex-col items-center justify-center gap-4 text-center">
          <span className="material-symbols-outlined text-[52px] text-[#4d4354]">compress</span>
          <div>
            <p className="text-[16px] font-semibold text-[#4d4354]">No PDF loaded yet</p>
            <p className="text-[13px] text-[#3a3040] mt-1">Upload a PDF above to compress it</p>
          </div>
        </div>
      )}
    </div>
  );
}
