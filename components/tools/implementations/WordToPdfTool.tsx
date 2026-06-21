"use client";

/**
 * Word → PDF conversion (browser-only)
 *
 * Pipeline:
 *  1. mammoth   — parses the DOCX/DOC file and converts it to clean HTML,
 *                 preserving headings, bold, italic, underline, tables,
 *                 lists, images (base64 data URIs), and paragraph structure.
 *  2. jsPDF.html() — renders the HTML into a hidden A4-sized container
 *                 using html2canvas (bundled with jsPDF), then paginates
 *                 the canvas into a multi-page PDF document.
 *  3. Output    — the PDF is emitted as a blob and downloaded directly.
 *
 * Supported formats: DOCX (full support) · DOC (best-effort via mammoth)
 *
 * Limitations (inherent to any browser-based Word→PDF converter):
 *  • Complex DOCX features (mail merge, macros, ActiveX) are ignored.
 *  • Exact font metrics may differ if system fonts are not available.
 *  • Very large documents may take longer to render (html2canvas is O(pixels)).
 *  • Old binary .DOC files: mammoth provides partial support only.
 */

import { useState, useRef, useCallback } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

type NotifType = "success" | "error" | "warning";
interface Notif { type: NotifType; message: string; }

type Phase = "idle" | "reading" | "converting" | "rendering" | "done";

interface ConvertResult {
  filename: string;
  sizeBytes: number;
  pageCount: number;
  messages: string[];
}

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_FILE_BYTES = 50 * 1024 * 1024; // 50 MB
const ACCEPTED_EXT  = /\.(docx|doc)$/i;

// A4 at 96 dpi = 794 px wide; PDF points: 595 pt wide
const A4_PX_WIDTH   = 794;
const A4_MARGIN_PX  = 48; // ~0.5 inch

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(2)} MB`;
}

// ── Loaders (dynamic — avoid SSR & keep initial bundle small) ─────────────────

async function getMammoth() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return import("mammoth") as Promise<any>;
}

async function getJsPDF() {
  const { jsPDF } = await import("jspdf");
  return jsPDF;
}

// ── Mammoth → HTML ────────────────────────────────────────────────────────────

async function docxToHtml(file: File): Promise<{ html: string; warnings: string[] }> {
  const mammoth   = await getMammoth();
  const arrayBuffer = await file.arrayBuffer();

  // Use style map for best semantic fidelity
  const styleMap = [
    "p[style-name='Heading 1'] => h1:fresh",
    "p[style-name='Heading 2'] => h2:fresh",
    "p[style-name='Heading 3'] => h3:fresh",
    "p[style-name='Heading 4'] => h4:fresh",
    "p[style-name='Title']     => h1.doc-title:fresh",
    "p[style-name='Subtitle']  => p.doc-subtitle:fresh",
    "r[style-name='Strong']    => strong",
    "r[style-name='Emphasis']  => em",
    "table                     => table.doc-table",
  ].join("\n");

  const result = await mammoth.convertToHtml(
    { arrayBuffer },
    { styleMap, includeDefaultStyleMap: true }
  );

  const warnings = result.messages
    .filter((m: { type: string; message: string }) => m.type === "warning")
    .map((m: { type: string; message: string }) => m.message)
    .slice(0, 5);

  return { html: result.value, warnings };
}

// ── HTML → PDF via jsPDF.html() ───────────────────────────────────────────────

async function htmlToPdf(
  html: string,
  filename: string,
  onPhase: (p: Phase) => void
): Promise<{ blob: Blob; pageCount: number }> {
  const jsPDF = await getJsPDF();

  onPhase("rendering");

  // Create a hidden, A4-width container in the DOM for html2canvas to render
  const container = document.createElement("div");
  container.setAttribute("aria-hidden", "true");
  Object.assign(container.style, {
    position:   "absolute",
    left:       "-9999px",
    top:        "0",
    width:      `${A4_PX_WIDTH}px`,
    padding:    `${A4_MARGIN_PX}px`,
    background: "#ffffff",
    color:      "#000000",
    fontFamily: "'Calibri', 'Arial', sans-serif",
    fontSize:   "11pt",
    lineHeight: "1.5",
    boxSizing:  "border-box",
  });

  // Inject document HTML and scoped styles
  container.innerHTML = `
    <style>
      * { box-sizing: border-box; }
      body, div { margin: 0; padding: 0; }
      h1 { font-size: 24pt; font-weight: bold; margin: 16pt 0 8pt; color: #1a1a2e; }
      h2 { font-size: 18pt; font-weight: bold; margin: 14pt 0 6pt; color: #1a1a2e; }
      h3 { font-size: 14pt; font-weight: bold; margin: 12pt 0 4pt; color: #1a1a2e; }
      h4 { font-size: 12pt; font-weight: bold; margin: 10pt 0 4pt; }
      p  { margin: 0 0 8pt; orphans: 3; widows: 3; }
      strong, b { font-weight: bold; }
      em, i     { font-style: italic; }
      u         { text-decoration: underline; }
      ul, ol    { margin: 0 0 8pt 24pt; padding: 0; }
      li        { margin-bottom: 3pt; }
      table.doc-table {
        width: 100%; border-collapse: collapse; margin: 8pt 0 12pt;
        font-size: 10pt;
      }
      table.doc-table th,
      table.doc-table td {
        border: 1px solid #c0c0c0; padding: 4pt 6pt; text-align: left;
        vertical-align: top;
      }
      table.doc-table tr:first-child td,
      table.doc-table th { background: #f0f0f0; font-weight: bold; }
      img { max-width: 100%; height: auto; display: block; margin: 8pt 0; }
      .doc-title    { font-size: 28pt; font-weight: bold; margin-bottom: 4pt; }
      .doc-subtitle { font-size: 14pt; color: #555; margin-bottom: 16pt; }
      a { color: #1155cc; text-decoration: underline; }
      hr { border: none; border-top: 1px solid #ccc; margin: 12pt 0; }
      blockquote { border-left: 3px solid #ccc; margin: 8pt 0 8pt 16pt; padding-left: 8pt; color: #555; }
      code, pre { font-family: 'Courier New', monospace; font-size: 9.5pt; background: #f5f5f5; padding: 2pt 4pt; border-radius: 2px; }
      pre { padding: 8pt; overflow-wrap: break-word; white-space: pre-wrap; }
    </style>
    ${html}
  `;

  document.body.appendChild(container);

  try {
    const doc = new jsPDF({
      orientation: "portrait",
      unit:        "pt",
      format:      "a4",
    });

    await new Promise<void>((resolve, reject) => {
      doc.html(container, {
        callback: (d) => {
          // Remove the first blank page jsPDF sometimes adds
          if ((d as { internal: { pages: unknown[] } }).internal.pages.length > 1 &&
              !(html.trim())) {
            d.deletePage(1);
          }
          resolve();
        },
        // Map container px to PDF points (A4 = 595pt, content width = A4_PX_WIDTH - 2*margin)
        x: 28,
        y: 28,
        width:       539, // A4 content width in pt (595 - 28*2)
        windowWidth: A4_PX_WIDTH - A4_MARGIN_PX * 2,
        margin:      [28, 28, 28, 28],
        autoPaging:  "text",
        html2canvas: {
          scale:       2,       // retina-quality canvas
          useCORS:     true,
          logging:     false,
          letterRendering: true,
        },
        // Prevent jsPDF from treating every element as potentially-problematic
        fontFaces: [],
      });

      // Safety timeout — html2canvas can hang on broken images
      setTimeout(() => reject(new Error("Rendering timed out. Try a smaller document.")), 120_000);
    });

    const blob      = doc.output("blob");
    const pageCount = doc.getNumberOfPages();
    return { blob, pageCount };
  } finally {
    document.body.removeChild(container);
  }
}

// ── Main conversion ───────────────────────────────────────────────────────────

async function convertWordToPdf(
  file: File,
  onPhase: (p: Phase) => void
): Promise<ConvertResult & { blob: Blob }> {
  onPhase("reading");
  const { html, warnings } = await docxToHtml(file);

  if (!html.trim()) {
    throw new Error(
      "No content could be extracted from this document. " +
      "The file may be empty, password-protected, or in an unsupported format."
    );
  }

  onPhase("converting");
  const filename    = file.name.replace(ACCEPTED_EXT, "") + ".pdf";
  const { blob, pageCount } = await htmlToPdf(html, filename, onPhase);

  return { blob, filename, sizeBytes: blob.size, pageCount, messages: warnings };
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement("a");
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

const PHASE_LABELS: Record<Phase, string> = {
  idle:       "",
  reading:    "Reading document…",
  converting: "Parsing content and structure…",
  rendering:  "Rendering pages to PDF…",
  done:       "Done",
};

// ── Main component ────────────────────────────────────────────────────────────

export default function WordToPdfTool() {
  const [draggingOver, setDraggingOver] = useState(false);
  const [phase, setPhase]               = useState<Phase>("idle");
  const [result, setResult]             = useState<(ConvertResult & { blob: Blob }) | null>(null);
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
      if (!ACCEPTED_EXT.test(file.name)) {
        notify("error", `"${file.name}" is not a supported format. Please upload a DOCX or DOC file.`);
        return;
      }
      if (file.size > MAX_FILE_BYTES) {
        notify("error", `File exceeds the 50 MB limit (${formatBytes(file.size)}).`);
        return;
      }

      setLoadedFile(file);
      setResult(null);
      setNotif(null);
      setPhase("reading");

      try {
        const res = await convertWordToPdf(file, setPhase);
        setResult(res);
        setPhase("done");

        if (res.messages.length) {
          notify("warning", `Converted with ${res.messages.length} note${res.messages.length > 1 ? "s" : ""}: ${res.messages[0]}`);
        } else {
          notify("success", `PDF created — ${res.pageCount} page${res.pageCount !== 1 ? "s" : ""}, ${formatBytes(res.sizeBytes)}.`);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Conversion failed. Please try another file.";
        notify("error", msg);
        setPhase("idle");
        setLoadedFile(null);
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
    downloadBlob(result.blob, result.filename);
  }, [result]);

  const handleReset = useCallback(() => {
    setLoadedFile(null);
    setResult(null);
    setNotif(null);
    setPhase("idle");
    if (inputRef.current) inputRef.current.value = "";
  }, []);

  const isConverting = phase !== "idle" && phase !== "done";

  // Phase progress steps
  const PHASES: Phase[] = ["reading", "converting", "rendering"];
  const phaseIdx = PHASES.indexOf(phase);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="mb-12 flex flex-col gap-6">

      {/* ── Drop zone ──────────────────────────────────────────────────────── */}
      {!isConverting && phase !== "done" && (
        <div
          ref={dropRef}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onClick={() => inputRef.current?.click()}
          role="button"
          tabIndex={0}
          aria-label="Upload Word document — click or drag and drop"
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
              {draggingOver ? "file_download" : "description"}
            </span>
          </div>

          <div className="text-center">
            <p className="text-[18px] font-bold text-[#e2e2e2] mb-1.5">
              {draggingOver ? "Drop your document here" : "Drag & drop your Word document here"}
            </p>
            <p className="text-[14px] text-[#988d9f]">
              or <span className="text-[#ffb4ab] font-semibold">click to browse</span>
              {" — DOCX & DOC · up to 50 MB"}
            </p>
          </div>

          {/* Feature chips */}
          <div className="flex flex-wrap justify-center gap-2 mt-1">
            {["Headings preserved", "Tables supported", "Images included", "Multi-page", "Bold & italic"].map((f) => (
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
            accept=".docx,.doc,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword"
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
            border: `1px solid ${
              notif.type === "success" ? "rgba(34,197,94,0.3)"
              : notif.type === "warning" ? "rgba(250,204,21,0.3)"
              : "rgba(239,68,68,0.3)"}`,
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
      {isConverting && (
        <div className="glass-panel rounded-2xl p-6 flex flex-col gap-5" aria-live="polite" aria-busy="true">
          {/* File info */}
          {loadedFile && (
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-[12px]"
              style={{ background: "rgba(255,255,255,0.03)", color: "#5a4d63" }}
            >
              <span className="material-symbols-outlined text-[14px]">description</span>
              <span className="truncate flex-1">{loadedFile.name}</span>
              <span className="shrink-0">{formatBytes(loadedFile.size)}</span>
            </div>
          )}

          {/* Step indicators */}
          <div className="flex items-center gap-2">
            {PHASES.map((p, i) => {
              const done    = phaseIdx > i;
              const active  = phaseIdx === i;
              return (
                <div key={p} className="flex items-center gap-2 flex-1 min-w-0">
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-300"
                    style={{
                      background: done ? "rgba(34,197,94,0.2)" : active ? "rgba(255,180,171,0.2)" : "rgba(255,255,255,0.05)",
                      border: `1px solid ${done ? "rgba(34,197,94,0.4)" : active ? "rgba(255,180,171,0.4)" : "rgba(255,255,255,0.08)"}`,
                    }}
                  >
                    {done ? (
                      <span className="material-symbols-outlined text-[12px] text-[#22c55e]">check</span>
                    ) : active ? (
                      <span className="w-3 h-3 border border-[#ffb4ab]/30 border-t-[#ffb4ab] rounded-full animate-spin" />
                    ) : (
                      <span className="w-1.5 h-1.5 rounded-full bg-[rgba(255,255,255,0.2)]" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-[12px] font-semibold truncate"
                      style={{ color: done ? "#22c55e" : active ? "#e2e2e2" : "#4d4354" }}
                    >
                      {PHASE_LABELS[p]}
                    </p>
                  </div>
                  {i < PHASES.length - 1 && (
                    <div
                      className="w-6 h-px flex-shrink-0"
                      style={{ background: done ? "rgba(34,197,94,0.4)" : "rgba(255,255,255,0.06)" }}
                    />
                  )}
                </div>
              );
            })}
          </div>

          {/* Active phase description */}
          <div className="flex items-center gap-3">
            <span className="w-5 h-5 border-2 border-[#ffb4ab]/30 border-t-[#ffb4ab] rounded-full animate-spin flex-shrink-0" />
            <div>
              <p className="text-[15px] font-bold text-[#e2e2e2]">{PHASE_LABELS[phase]}</p>
              {phase === "rendering" && (
                <p className="text-[12px] text-[#988d9f] mt-0.5">
                  This may take a moment for large or image-heavy documents
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Result ────────────────────────────────────────────────────────── */}
      {phase === "done" && result && (
        <div className="flex flex-col gap-4">
          {/* Stats */}
          <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))" }}>
            <StatCard icon="description"  label="Pages"     value={String(result.pageCount)}          color="#ffb4ab" />
            <StatCard icon="download"     label="File size" value={formatBytes(result.sizeBytes)}      color="#4ade80" />
            <StatCard icon="description"  label="Source"    value={loadedFile ? formatBytes(loadedFile.size) : "—"} color="#4cd7f6" />
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
                <p className="text-[15px] font-bold text-[#e2e2e2]">PDF ready</p>
                <p className="text-[12px] text-[#988d9f] truncate">{result.filename}</p>
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
                Convert Another File
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
              Headings, paragraphs, bold/italic, lists, tables, and embedded images are preserved.
              Complex DOCX features such as tracked changes, macros, and custom fonts not available on this system may not render exactly as in Word.
              Everything runs in your browser — your file never leaves your device.
            </span>
          </div>
        </div>
      )}

      {/* ── How it works (idle state) ──────────────────────────────────────── */}
      {phase === "idle" && (
        <div className="glass-panel rounded-2xl p-6 flex flex-col gap-3">
          <p className="text-[12px] font-semibold text-[#988d9f] uppercase tracking-[0.08em]">How it works</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { icon: "upload_file",  label: "1. Upload Document",    desc: "Drag & drop or browse for your DOCX or DOC file" },
              { icon: "auto_awesome", label: "2. Auto-convert",        desc: "Formatting, headings, tables and images are parsed and rendered" },
              { icon: "download",     label: "3. Download PDF",        desc: "Open anywhere — no Word required" },
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
