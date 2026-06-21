"use client";

/**
 * Sign PDF — browser-local PDF signing
 *
 * Three signature methods:
 *   Draw   → pointer-event canvas → transparent PNG → pdf-lib embedPng
 *   Type   → text rendered to canvas using Google Handwriting fonts
 *   Upload → PNG / JPG file read as data-URL
 *
 * Placed signatures are stored in PDF-point units (ptX, ptY from top-left).
 * The preview overlays convert to screen pixels via viewScale.
 * On download, pdf-lib draws each embedded image at the correct position and
 * rotation, with proper center-based rotation math so the visual placement
 * matches the preview exactly.
 */

import { useState, useRef, useCallback, useEffect } from "react";

// ── Constants ─────────────────────────────────────────────────────────────────

const DRAW_W = 480;
const DRAW_H = 140;
const DEFAULT_SIG_PT_W = 150; // default sig width in PDF points (~2 in)
const INK_COLOR = "#0d1b2a";

const SIG_FONTS = [
  { value: "Dancing Script", label: "Elegant Cursive" },
  { value: "Pacifico",       label: "Bold Script"     },
  { value: "Caveat",         label: "Natural Hand"    },
  { value: "Sacramento",     label: "Classic Italic"  },
];

// ── Types ─────────────────────────────────────────────────────────────────────

interface PlacedSig {
  id:       string;
  dataUrl:  string;
  pageNum:  number;
  ptX:      number;   // x from page left in PDF points
  ptY:      number;   // y from page top in PDF points
  ptW:      number;   // width in PDF points
  ptH:      number;   // height in PDF points
  rotation: number;   // degrees, clockwise positive
  opacity:  number;   // 0–1
  isJpg:    boolean;
}

type SigTab    = "draw" | "type" | "upload";
type Phase     = "idle" | "rendering" | "processing" | "done";
type NotifType = "success" | "error";
interface Notif { type: NotifType; msg: string }

// ── Helpers ───────────────────────────────────────────────────────────────────

function uid() { return Math.random().toString(36).slice(2, 10); }

function fmt(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1_048_576) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1_048_576).toFixed(2)} MB`;
}

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const b64 = dataUrl.split(",")[1];
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function downloadBlob(data: Uint8Array, filename: string) {
  const blob = new Blob([data.buffer as ArrayBuffer], { type: "application/pdf" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

async function renderTypedSig(text: string, font: string): Promise<{ dataUrl: string; w: number; h: number }> {
  const fontSize = 72;
  const h = Math.round(fontSize * 1.6);
  try { await document.fonts.load(`bold ${fontSize}px "${font}"`); } catch { /* use fallback */ }
  const temp = document.createElement("canvas");
  temp.width = 900; temp.height = h;
  const tc = temp.getContext("2d")!;
  tc.font = `bold ${fontSize}px "${font}", cursive`;
  const w = Math.max(180, Math.ceil(tc.measureText(text).width) + 40);
  const cvs = document.createElement("canvas");
  cvs.width = w; cvs.height = h;
  const ctx = cvs.getContext("2d")!;
  ctx.font = `bold ${fontSize}px "${font}", cursive`;
  ctx.fillStyle = INK_COLOR;
  ctx.textBaseline = "middle";
  ctx.fillText(text, 20, h / 2);
  return { dataUrl: cvs.toDataURL("image/png"), w, h };
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function SignPdfTool() {
  // ── File / page state ───────────────────────────────────────────────────────
  const [draggingFile, setDraggingFile] = useState(false);
  const [pdfFile, setPdfFile]           = useState<File | null>(null);
  const [pageCount, setPageCount]       = useState(0);
  const [currentPage, setCurrentPage]   = useState(1);
  const [phase, setPhase]               = useState<Phase>("idle");
  const [notif, setNotif]               = useState<Notif | null>(null);
  const [ptWidth, setPtWidth]           = useState(0);
  const [ptHeight, setPtHeight]         = useState(0);
  const [viewScale, setViewScale]       = useState(1);
  const [canvasSize, setCanvasSize]     = useState({ w: 0, h: 0 });
  const [docLoaded, setDocLoaded]       = useState(false);

  // ── Signature creation ──────────────────────────────────────────────────────
  const [sigTab, setSigTab]       = useState<SigTab>("draw");
  const [sigFont, setSigFont]     = useState(SIG_FONTS[0].value);
  const [typedText, setTypedText] = useState("");
  const [hasDrawing, setHasDrawing] = useState(false);

  // ── Placements ──────────────────────────────────────────────────────────────
  const [placements, setPlacements] = useState<PlacedSig[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // ── Refs ────────────────────────────────────────────────────────────────────
  const fileInputRef    = useRef<HTMLInputElement>(null);
  const sigFileInputRef = useRef<HTMLInputElement>(null);
  const dropRef         = useRef<HTMLDivElement>(null);
  const previewRef      = useRef<HTMLCanvasElement>(null);
  const previewContRef  = useRef<HTMLDivElement>(null);
  const drawCanvasRef   = useRef<HTMLCanvasElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfjsDocRef     = useRef<any>(null);
  const isDrawingRef    = useRef(false);
  const dragRef         = useRef<{ id: string; startX: number; startY: number; origPtX: number; origPtY: number } | null>(null);
  const resizeRef       = useRef<{ id: string; startX: number; startY: number; origPtW: number; origPtH: number; ar: number } | null>(null);

  const notify = useCallback((type: NotifType, msg: string) => {
    setNotif({ type, msg });
    setTimeout(() => setNotif(null), 8000);
  }, []);

  // ── Load Google Fonts for typed signatures ──────────────────────────────────
  useEffect(() => {
    const link = document.createElement("link");
    link.rel  = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Dancing+Script:wght@700&family=Pacifico&family=Caveat:wght@700&family=Sacramento&display=swap";
    document.head.appendChild(link);
    return () => { try { document.head.removeChild(link); } catch { /* already removed */ } };
  }, []);

  // ── Load PDF ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!pdfFile) return;
    let cancelled = false;
    pdfjsDocRef.current = null;
    setDocLoaded(false);
    setPlacements([]);
    setSelectedId(null);
    setCurrentPage(1);
    setPageCount(0);
    setPhase("rendering");

    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        const buf = await pdfFile.arrayBuffer();
        const doc = await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise;
        if (cancelled) return;
        pdfjsDocRef.current = doc;
        setPageCount(doc.numPages);
        setDocLoaded(true); // triggers page render effect
      } catch (err: unknown) {
        if (cancelled) return;
        const e = err as { name?: string };
        if (e?.name === "PasswordException") {
          notify("error", "This PDF is password-protected. Unlock it first using the Unlock PDF tool.");
        } else {
          notify("error", "Could not load the PDF. It may be corrupted.");
        }
        setPdfFile(null);
        setPhase("idle");
      }
    })();

    return () => { cancelled = true; };
  }, [pdfFile, notify]);

  // ── Render current page ───────────────────────────────────────────────────
  useEffect(() => {
    if (!docLoaded || !pdfjsDocRef.current) return;
    let cancelled = false;
    setPhase("rendering");

    (async () => {
      try {
        const page = await pdfjsDocRef.current.getPage(currentPage);
        if (cancelled) return;

        const containerW = previewContRef.current?.clientWidth ?? 700;
        const vp1   = page.getViewport({ scale: 1 });
        const scale = containerW / vp1.width;
        const vp    = page.getViewport({ scale });

        const canvas = previewRef.current;
        if (!canvas || cancelled) return;
        canvas.width  = Math.round(vp.width);
        canvas.height = Math.round(vp.height);

        const ctx = canvas.getContext("2d")!;
        await page.render({ canvasContext: ctx, viewport: vp, canvas }).promise;
        if (cancelled) return;

        setPtWidth(vp1.width);
        setPtHeight(vp1.height);
        setViewScale(scale);
        setCanvasSize({ w: canvas.width, h: canvas.height });
        setPhase("idle");
      } catch {
        if (!cancelled) { notify("error", "Failed to render page."); setPhase("idle"); }
      }
    })();

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docLoaded, currentPage]);

  // ── Drawing ───────────────────────────────────────────────────────────────
  const startDraw = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const sx = canvas.width / rect.width;
    const sy = canvas.height / rect.height;
    const ctx = canvas.getContext("2d")!;
    isDrawingRef.current = true;
    ctx.beginPath();
    ctx.moveTo((e.clientX - rect.left) * sx, (e.clientY - rect.top) * sy);
    canvas.setPointerCapture(e.pointerId);
    setHasDrawing(true);
  }, []);

  const continueDraw = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const sx = canvas.width / rect.width;
    const sy = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * sx;
    const y = (e.clientY - rect.top) * sy;
    const ctx = canvas.getContext("2d")!;
    ctx.strokeStyle = INK_COLOR;
    ctx.lineWidth   = 2.5;
    ctx.lineCap     = "round";
    ctx.lineJoin    = "round";
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
  }, []);

  const endDraw = useCallback(() => { isDrawingRef.current = false; }, []);

  const clearDraw = useCallback(() => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    canvas.getContext("2d")!.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawing(false);
  }, []);

  // ── Place signature onto current PDF page ─────────────────────────────────
  const addPlacement = useCallback((dataUrl: string, natW: number, natH: number, isJpg = false) => {
    if (!ptWidth || !ptHeight) { notify("error", "Load a PDF first."); return; }
    const ptW = Math.min(DEFAULT_SIG_PT_W, ptWidth * 0.45);
    const ptH = ptW * (natH / natW);
    const ptX = (ptWidth  - ptW) / 2;
    const ptY = (ptHeight - ptH) / 2;
    const sig: PlacedSig = {
      id: uid(), dataUrl, pageNum: currentPage,
      ptX, ptY, ptW, ptH, rotation: 0, opacity: 1, isJpg,
    };
    setPlacements(p => [...p, sig]);
    setSelectedId(sig.id);
  }, [ptWidth, ptHeight, currentPage, notify]);

  const handleAddDraw = useCallback(() => {
    if (!hasDrawing) return;
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    addPlacement(canvas.toDataURL("image/png"), canvas.width, canvas.height);
  }, [hasDrawing, addPlacement]);

  const handleAddTyped = useCallback(async () => {
    if (!typedText.trim()) return;
    const { dataUrl, w, h } = await renderTypedSig(typedText, sigFont);
    addPlacement(dataUrl, w, h);
  }, [typedText, sigFont, addPlacement]);

  const handleSigFileChange = useCallback((file: File) => {
    const isJpg = file.type === "image/jpeg" || file.name.toLowerCase().endsWith(".jpg") || file.name.toLowerCase().endsWith(".jpeg");
    const reader = new FileReader();
    reader.onload = ev => {
      const dataUrl = ev.target?.result as string;
      const img = new Image();
      img.onload = () => addPlacement(dataUrl, img.naturalWidth, img.naturalHeight, isJpg);
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  }, [addPlacement]);

  // ── Drag ──────────────────────────────────────────────────────────────────
  const onSigPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>, sigId: string) => {
    e.stopPropagation();
    setSelectedId(sigId);
    const sig = placements.find(p => p.id === sigId);
    if (!sig) return;
    dragRef.current = { id: sigId, startX: e.clientX, startY: e.clientY, origPtX: sig.ptX, origPtY: sig.ptY };
    e.currentTarget.setPointerCapture(e.pointerId);
  }, [placements]);

  const onSigPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>, sigId: string) => {
    const d = dragRef.current;
    if (!d || d.id !== sigId || viewScale === 0) return;
    const dx = (e.clientX - d.startX) / viewScale;
    const dy = (e.clientY - d.startY) / viewScale;
    setPlacements(prev => prev.map(p => {
      if (p.id !== sigId) return p;
      return {
        ...p,
        ptX: Math.max(0, Math.min(ptWidth  - p.ptW, d.origPtX + dx)),
        ptY: Math.max(0, Math.min(ptHeight - p.ptH, d.origPtY + dy)),
      };
    }));
  }, [viewScale, ptWidth, ptHeight]);

  const onSigPointerUp = useCallback(() => { dragRef.current = null; }, []);

  // ── Resize ────────────────────────────────────────────────────────────────
  const onResizePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>, sigId: string) => {
    e.stopPropagation();
    const sig = placements.find(p => p.id === sigId);
    if (!sig) return;
    resizeRef.current = { id: sigId, startX: e.clientX, startY: e.clientY, origPtW: sig.ptW, origPtH: sig.ptH, ar: sig.ptW / sig.ptH };
    e.currentTarget.setPointerCapture(e.pointerId);
  }, [placements]);

  const onResizePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>, sigId: string) => {
    const r = resizeRef.current;
    if (!r || r.id !== sigId || viewScale === 0) return;
    const dx = (e.clientX - r.startX) / viewScale;
    const newW = Math.max(20, r.origPtW + dx);
    const newH = newW / r.ar;
    setPlacements(prev => prev.map(p => p.id === sigId ? { ...p, ptW: newW, ptH: newH } : p));
  }, [viewScale]);

  const onResizePointerUp = useCallback(() => { resizeRef.current = null; }, []);

  // ── Sig controls ──────────────────────────────────────────────────────────
  const deleteSig   = useCallback((id: string) => {
    setPlacements(p => p.filter(s => s.id !== id));
    setSelectedId(prev => (prev === id ? null : prev));
  }, []);

  const duplicateSig = useCallback((id: string) => {
    const sig = placements.find(p => p.id === id);
    if (!sig) return;
    const newSig: PlacedSig = { ...sig, id: uid(), ptX: sig.ptX + 10, ptY: sig.ptY + 10 };
    setPlacements(p => [...p, newSig]);
    setSelectedId(newSig.id);
  }, [placements]);

  const updateSig = useCallback(<K extends keyof PlacedSig>(id: string, key: K, value: PlacedSig[K]) =>
    setPlacements(p => p.map(s => s.id === id ? { ...s, [key]: value } : s)), []);

  const rotateSig = useCallback((id: string, delta: number) =>
    setPlacements(p => p.map(s => s.id === id ? { ...s, rotation: s.rotation + delta } : s)), []);

  // ── File drop zone ────────────────────────────────────────────────────────
  const handlePdfFile = useCallback((f: File) => {
    if (!f.type.includes("pdf") && !f.name.toLowerCase().endsWith(".pdf")) {
      notify("error", `"${f.name}" is not a PDF.`); return;
    }
    if (f.size > 200 * 1024 * 1024) { notify("error", "File exceeds 200 MB."); return; }
    setPdfFile(f);
  }, [notify]);

  const handleReset = useCallback(() => {
    setPdfFile(null); setPlacements([]); setSelectedId(null);
    setPageCount(0); setCurrentPage(1); setPhase("idle");
    setDocLoaded(false); setNotif(null); setTypedText("");
    setHasDrawing(false); clearDraw();
    pdfjsDocRef.current = null;
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [clearDraw]);

  // ── Download signed PDF ───────────────────────────────────────────────────
  const handleDownload = useCallback(async () => {
    if (!pdfFile) return;
    if (placements.length === 0) { notify("error", "Add at least one signature before downloading."); return; }
    setPhase("processing");
    try {
      const { PDFDocument, degrees } = await import("pdf-lib");
      const buf = await pdfFile.arrayBuffer();
      const doc = await PDFDocument.load(buf, { ignoreEncryption: true });
      const pages = doc.getPages();

      for (const sig of placements) {
        const pg = pages[sig.pageNum - 1];
        if (!pg) continue;
        const { width: pgW, height: pgH } = pg.getSize();

        const bytes = dataUrlToBytes(sig.dataUrl);
        const img   = sig.isJpg ? await doc.embedJpg(bytes) : await doc.embedPng(bytes);

        // Convert from "ptY from top" to pdf-lib's "from bottom"
        const y_bottom = pgH - sig.ptY - sig.ptH;

        // Center-based rotation so the PDF placement matches the CSS preview
        // pdf-lib rotates CCW around (x, y); we solve for (x0,y0) such that the
        // image center lands at (cx, cy) after rotating by -sig.rotation (CW→CCW)
        if (sig.rotation === 0) {
          pg.drawImage(img, {
            x: sig.ptX, y: y_bottom,
            width: sig.ptW, height: sig.ptH,
            opacity: sig.opacity,
          });
        } else {
          const θ  = (sig.rotation * Math.PI) / 180; // clockwise in radians
          const cx = sig.ptX + sig.ptW / 2;
          const cy = y_bottom + sig.ptH / 2;
          // R = -θ (CCW for pdf-lib)
          const cosR =  Math.cos(θ); // cos(-θ) = cos(θ)
          const sinR = -Math.sin(θ); // sin(-θ) = -sin(θ)
          // x0 = cx - (W/2)*cos(R) + (H/2)*sin(R)
          // y0 = cy - (W/2)*sin(R) - (H/2)*cos(R)
          const x0 = cx - (sig.ptW / 2) * cosR + (sig.ptH / 2) * sinR;
          const y0 = cy - (sig.ptW / 2) * sinR - (sig.ptH / 2) * cosR;
          pg.drawImage(img, {
            x: x0, y: y0,
            width: sig.ptW, height: sig.ptH,
            rotate: degrees(-sig.rotation),
            opacity: sig.opacity,
          });
        }
      }

      const outBytes = await doc.save({ useObjectStreams: false });
      downloadBlob(outBytes, pdfFile.name.replace(/\.pdf$/i, "") + "_signed.pdf");
      setPhase("done");
    } catch (err: unknown) {
      notify("error", err instanceof Error ? err.message : "Failed to sign the PDF.");
      setPhase("idle");
    }
  }, [pdfFile, placements, notify]);

  // ── Derived ───────────────────────────────────────────────────────────────
  const isRendering  = phase === "rendering";
  const isProcessing = phase === "processing";
  const isDone       = phase === "done";
  const selectedSig  = placements.find(p => p.id === selectedId) ?? null;
  const pageSigs     = placements.filter(p => p.pageNum === currentPage);
  const totalSigs    = placements.length;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="mb-12 flex flex-col gap-6">

      {/* ── Drop zone ──────────────────────────────────────────────────────── */}
      {!pdfFile && (
        <div ref={dropRef}
          onDrop={e => { e.preventDefault(); setDraggingFile(false); const f = e.dataTransfer.files[0]; if (f) handlePdfFile(f); }}
          onDragOver={e => { e.preventDefault(); setDraggingFile(true); }}
          onDragLeave={e => { if (dropRef.current && !dropRef.current.contains(e.relatedTarget as Node)) setDraggingFile(false); }}
          onClick={() => fileInputRef.current?.click()}
          role="button" tabIndex={0} aria-label="Upload PDF to sign"
          onKeyDown={e => { if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click(); }}
          className="glass-panel rounded-2xl flex flex-col items-center justify-center gap-5 cursor-pointer transition-all duration-300 select-none outline-none focus-visible:ring-2 focus-visible:ring-[#ffb4ab]"
          style={{ padding: "64px 40px", border: `2px dashed ${draggingFile ? "#ffb4ab" : "rgba(255,255,255,0.12)"}`, background: draggingFile ? "rgba(255,180,171,0.06)" : undefined, transform: draggingFile ? "scale(1.01)" : "scale(1)" }}>
          <div className="w-20 h-20 rounded-2xl flex items-center justify-center transition-all duration-300"
            style={{ background: draggingFile ? "rgba(255,180,171,0.2)" : "rgba(255,180,171,0.1)", border: `1px solid ${draggingFile ? "rgba(255,180,171,0.45)" : "rgba(255,180,171,0.2)"}` }}>
            <span className="material-symbols-outlined text-[38px]" style={{ color: "#ffb4ab" }}>
              {draggingFile ? "file_download" : "draw"}
            </span>
          </div>
          <div className="text-center">
            <p className="text-[18px] font-bold text-[#e2e2e2] mb-1.5">{draggingFile ? "Drop your PDF here" : "Drag & drop your PDF here"}</p>
            <p className="text-[14px] text-[#988d9f]">or <span className="text-[#ffb4ab] font-semibold">click to browse</span> — PDF only · up to 200 MB</p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            {["Draw signature", "Type signature", "Upload image", "Multi-page", "Browser-local"].map(tag => (
              <span key={tag} className="px-2.5 py-1 rounded-lg text-[11px] font-semibold"
                style={{ background: "rgba(255,180,171,0.08)", color: "#ffb4ab", border: "1px solid rgba(255,180,171,0.15)" }}>{tag}</span>
            ))}
          </div>
          <input ref={fileInputRef} type="file" accept="application/pdf,.pdf" className="sr-only"
            onChange={e => { const f = e.target.files?.[0]; if (f) handlePdfFile(f); e.target.value = ""; }}
            aria-hidden tabIndex={-1} />
        </div>
      )}

      {/* ── Notification ───────────────────────────────────────────────────── */}
      {notif && (
        <div role="alert" className="flex items-start gap-3 px-5 py-4 rounded-xl text-[14px] font-medium"
          style={{ background: notif.type === "success" ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)", border: `1px solid ${notif.type === "success" ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`, color: notif.type === "success" ? "#22c55e" : "#ef4444" }}>
          <span className="material-symbols-outlined text-[20px] flex-shrink-0 mt-0.5">{notif.type === "success" ? "check_circle" : "error"}</span>
          <span className="flex-1 leading-relaxed">{notif.msg}</span>
          <button onClick={() => setNotif(null)} aria-label="Dismiss" className="opacity-60 hover:opacity-100 transition-opacity">
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
      )}

      {/* ── Editor ─────────────────────────────────────────────────────────── */}
      {pdfFile && (
        <div className="flex flex-col gap-4">

          {/* File header */}
          <div className="glass-panel rounded-2xl px-5 py-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: "rgba(255,180,171,0.1)", border: "1px solid rgba(255,180,171,0.2)" }}>
              <span className="material-symbols-outlined text-[18px] text-[#ffb4ab]">picture_as_pdf</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-bold text-[#e2e2e2] truncate">{pdfFile.name}</p>
              <p className="text-[11px] text-[#5a4d63]">{fmt(pdfFile.size)} · {pageCount || "…"} page{pageCount !== 1 ? "s" : ""} · {totalSigs} signature{totalSigs !== 1 ? "s" : ""} placed</p>
            </div>
            {isDone && (
              <span className="flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-full"
                style={{ background: "rgba(34,197,94,0.1)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.25)" }}>
                <span className="material-symbols-outlined text-[14px]">check_circle</span>Signed
              </span>
            )}
            <button onClick={handleReset} aria-label="Close file"
              className="w-8 h-8 rounded-lg flex items-center justify-center opacity-50 hover:opacity-100 transition-opacity"
              style={{ background: "rgba(255,255,255,0.05)" }}>
              <span className="material-symbols-outlined text-[16px] text-[#988d9f]">close</span>
            </button>
          </div>

          <div className="flex flex-col lg:flex-row gap-4 items-start">

            {/* ── Left: Signature creation panel ───────────────────────────── */}
            <div className="w-full lg:w-[320px] flex-shrink-0 flex flex-col gap-4">

              {/* Tabs */}
              <div className="glass-panel rounded-2xl p-5 flex flex-col gap-4">
                <div className="flex rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
                  {(["draw", "type", "upload"] as SigTab[]).map(tab => (
                    <button key={tab} onClick={() => setSigTab(tab)}
                      className="flex-1 py-2 text-[12px] font-bold capitalize transition-all"
                      style={{
                        background: sigTab === tab ? "rgba(255,180,171,0.15)" : "rgba(255,255,255,0.03)",
                        color: sigTab === tab ? "#ffb4ab" : "#5a4d63",
                        borderRight: tab !== "upload" ? "1px solid rgba(255,255,255,0.08)" : undefined,
                      }}>
                      {tab === "draw" ? "Draw" : tab === "type" ? "Type" : "Upload"}
                    </button>
                  ))}
                </div>

                {/* Draw tab */}
                {sigTab === "draw" && (
                  <div className="flex flex-col gap-3">
                    <p className="text-[11px] text-[#5a4d63]">Sign below with your mouse, touchscreen or stylus</p>
                    <div className="relative rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.97)" }}>
                      <canvas ref={drawCanvasRef} width={DRAW_W} height={DRAW_H}
                        className="w-full block"
                        style={{ touchAction: "none", cursor: "crosshair" }}
                        onPointerDown={startDraw}
                        onPointerMove={continueDraw}
                        onPointerUp={endDraw}
                        onPointerLeave={endDraw}
                        aria-label="Draw your signature here"
                      />
                      {!hasDrawing && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
                          <p className="text-[18px]" style={{ color: "rgba(0,0,0,0.15)", fontFamily: "cursive" }}>Sign here</p>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button onClick={clearDraw} disabled={!hasDrawing}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-semibold transition-all disabled:opacity-30"
                        style={{ background: "rgba(255,255,255,0.05)", color: "#988d9f", border: "1px solid rgba(255,255,255,0.08)" }}>
                        <span className="material-symbols-outlined text-[14px]">clear</span>Clear
                      </button>
                      <button onClick={handleAddDraw} disabled={!hasDrawing || !ptWidth}
                        className="btn-primary flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[13px] font-bold text-white disabled:opacity-40">
                        <span className="material-symbols-outlined text-[15px]">add</span>Add to Page
                      </button>
                    </div>
                  </div>
                )}

                {/* Type tab */}
                {sigTab === "type" && (
                  <div className="flex flex-col gap-3">
                    <input type="text" value={typedText} onChange={e => setTypedText(e.target.value)}
                      placeholder="Type your name" maxLength={60}
                      className="w-full px-3 py-2.5 rounded-lg text-[14px] outline-none focus-visible:ring-2 focus-visible:ring-[#ffb4ab]"
                      style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#e2e2e2" }} />
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-semibold uppercase tracking-wide text-[#988d9f]">Font style</label>
                      <div className="grid grid-cols-2 gap-2">
                        {SIG_FONTS.map(f => (
                          <button key={f.value} onClick={() => setSigFont(f.value)}
                            className="px-3 py-2 rounded-lg text-[12px] transition-all text-left"
                            style={{
                              fontFamily: `'${f.value}', cursive`,
                              fontSize: "18px",
                              background: sigFont === f.value ? "rgba(255,180,171,0.15)" : "rgba(255,255,255,0.05)",
                              border: `1px solid ${sigFont === f.value ? "rgba(255,180,171,0.4)" : "rgba(255,255,255,0.08)"}`,
                              color: sigFont === f.value ? "#ffb4ab" : "#988d9f",
                            }}>
                            {typedText || f.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <button onClick={handleAddTyped} disabled={!typedText.trim() || !ptWidth}
                      className="btn-primary w-full flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-[13px] font-bold text-white disabled:opacity-40">
                      <span className="material-symbols-outlined text-[15px]">add</span>Add to Page
                    </button>
                  </div>
                )}

                {/* Upload tab */}
                {sigTab === "upload" && (
                  <div className="flex flex-col gap-3">
                    <p className="text-[11px] text-[#5a4d63]">Upload a PNG, JPG or JPEG signature image. Transparent PNG files work best.</p>
                    <div
                      onClick={() => sigFileInputRef.current?.click()}
                      role="button" tabIndex={0}
                      onKeyDown={e => { if (e.key === "Enter" || e.key === " ") sigFileInputRef.current?.click(); }}
                      className="flex flex-col items-center gap-3 py-8 rounded-xl cursor-pointer transition-all outline-none focus-visible:ring-2 focus-visible:ring-[#ffb4ab]"
                      style={{ background: "rgba(255,255,255,0.03)", border: "2px dashed rgba(255,255,255,0.1)" }}>
                      <span className="material-symbols-outlined text-[32px] text-[#ffb4ab]">upload</span>
                      <p className="text-[13px] font-semibold text-[#e2e2e2]">Click to upload</p>
                      <p className="text-[11px] text-[#5a4d63]">PNG, JPG, JPEG · transparent PNG preferred</p>
                    </div>
                    <input ref={sigFileInputRef} type="file" accept="image/png,image/jpeg,image/jpg" className="sr-only"
                      onChange={e => { const f = e.target.files?.[0]; if (f) handleSigFileChange(f); e.target.value = ""; }}
                      aria-hidden tabIndex={-1} />
                    {!ptWidth && <p className="text-[11px] text-[#facc15]">Load a PDF first, then upload your signature.</p>}
                  </div>
                )}
              </div>

              {/* Selected signature properties */}
              {selectedSig && (
                <div className="glass-panel rounded-2xl p-5 flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <p className="text-[12px] font-bold text-[#ffb4ab] uppercase tracking-wide">Signature Properties</p>
                    <span className="text-[10px] text-[#5a4d63]">Page {selectedSig.pageNum}</span>
                  </div>

                  {/* Preview */}
                  <div className="rounded-xl overflow-hidden flex items-center justify-center"
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", minHeight: "60px" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={selectedSig.dataUrl} alt="Signature preview"
                      style={{ maxHeight: "60px", maxWidth: "100%", opacity: selectedSig.opacity,
                        transform: `rotate(${selectedSig.rotation}deg)`, objectFit: "contain" }} />
                  </div>

                  {/* Opacity */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] font-semibold uppercase tracking-wide text-[#988d9f]">Opacity</label>
                      <span className="text-[11px] font-bold text-[#e2e2e2]">{Math.round(selectedSig.opacity * 100)}%</span>
                    </div>
                    <input type="range" min={0.1} max={1} step={0.05}
                      value={selectedSig.opacity}
                      onChange={e => updateSig(selectedSig.id, "opacity", parseFloat(e.target.value))}
                      className="w-full" aria-label="Signature opacity"
                      style={{ accentColor: "#ffb4ab" }} />
                  </div>

                  {/* Rotation */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] font-semibold uppercase tracking-wide text-[#988d9f]">Rotation</label>
                      <span className="text-[11px] font-bold text-[#e2e2e2]">{selectedSig.rotation}°</span>
                    </div>
                    <div className="flex gap-1.5">
                      {([-90, -15, 15, 90] as const).map(delta => (
                        <button key={delta} onClick={() => rotateSig(selectedSig.id, delta)}
                          className="flex-1 py-1.5 rounded-lg text-[11px] font-bold transition-all"
                          style={{ background: "rgba(255,255,255,0.05)", color: "#988d9f", border: "1px solid rgba(255,255,255,0.08)" }}
                          aria-label={`Rotate ${delta > 0 ? "+" : ""}${delta}°`}>
                          {delta > 0 ? "+" : ""}{delta}°
                        </button>
                      ))}
                    </div>
                    <button onClick={() => updateSig(selectedSig.id, "rotation", 0)}
                      disabled={selectedSig.rotation === 0}
                      className="text-[11px] font-semibold text-center py-1 rounded-lg transition-all disabled:opacity-30"
                      style={{ color: "#988d9f" }}>
                      Reset rotation
                    </button>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <button onClick={() => duplicateSig(selectedSig.id)}
                      className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-[12px] font-semibold transition-all"
                      style={{ background: "rgba(76,215,246,0.08)", color: "#4cd7f6", border: "1px solid rgba(76,215,246,0.18)" }}>
                      <span className="material-symbols-outlined text-[14px]">content_copy</span>Duplicate
                    </button>
                    <button onClick={() => deleteSig(selectedSig.id)}
                      className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-[12px] font-semibold transition-all"
                      style={{ background: "rgba(239,68,68,0.08)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)" }}>
                      <span className="material-symbols-outlined text-[14px]">delete</span>Delete
                    </button>
                  </div>
                </div>
              )}

              {/* Download button */}
              <div className="flex flex-col gap-2">
                <button onClick={handleDownload} disabled={isProcessing || !pdfFile || !docLoaded}
                  className="btn-primary w-full text-white font-bold text-[15px] py-3.5 rounded-xl flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed">
                  {isProcessing ? (
                    <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Signing…</>
                  ) : (
                    <><span className="material-symbols-outlined text-[18px]">download</span>Download Signed PDF</>
                  )}
                </button>
                {totalSigs === 0 && pdfFile && docLoaded && (
                  <p className="text-[11px] text-center text-[#5a4d63]">Add a signature first using the panel above</p>
                )}
              </div>
            </div>

            {/* ── Right: PDF preview ────────────────────────────────────────── */}
            <div className="flex-1 min-w-0 flex flex-col gap-3">

              {/* Page navigation */}
              {pageCount > 0 && (
                <div className="glass-panel rounded-xl px-4 py-2.5 flex items-center justify-between gap-3">
                  <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage <= 1 || isRendering}
                    className="w-8 h-8 rounded-lg flex items-center justify-center transition-all disabled:opacity-30"
                    style={{ background: "rgba(255,255,255,0.06)" }} aria-label="Previous page">
                    <span className="material-symbols-outlined text-[18px] text-[#988d9f]">chevron_left</span>
                  </button>

                  <div className="flex items-center gap-1.5 flex-wrap justify-center">
                    {Array.from({ length: Math.min(pageCount, 12) }, (_, i) => i + 1).map(n => (
                      <button key={n} onClick={() => setCurrentPage(n)}
                        className="min-w-[28px] h-7 px-1.5 rounded-md text-[11px] font-bold transition-all"
                        style={{
                          background: currentPage === n ? "rgba(255,180,171,0.2)" : "rgba(255,255,255,0.04)",
                          color: currentPage === n ? "#ffb4ab" : "#5a4d63",
                          border: `1px solid ${currentPage === n ? "rgba(255,180,171,0.4)" : "rgba(255,255,255,0.06)"}`,
                        }}>
                        {n}
                        {placements.some(p => p.pageNum === n) && (
                          <span className="inline-block w-1 h-1 rounded-full bg-[#ffb4ab] ml-0.5 mb-0.5 align-middle" />
                        )}
                      </button>
                    ))}
                    {pageCount > 12 && <span className="text-[11px] text-[#5a4d63]">… {pageCount} pages</span>}
                  </div>

                  <button onClick={() => setCurrentPage(p => Math.min(pageCount, p + 1))}
                    disabled={currentPage >= pageCount || isRendering}
                    className="w-8 h-8 rounded-lg flex items-center justify-center transition-all disabled:opacity-30"
                    style={{ background: "rgba(255,255,255,0.06)" }} aria-label="Next page">
                    <span className="material-symbols-outlined text-[18px] text-[#988d9f]">chevron_right</span>
                  </button>
                </div>
              )}

              {/* Canvas + overlay */}
              <div className="glass-panel rounded-2xl overflow-hidden">
                {isRendering && (
                  <div className="flex items-center justify-center gap-3 py-12">
                    <span className="w-6 h-6 border-2 border-[#ffb4ab]/30 border-t-[#ffb4ab] rounded-full animate-spin" />
                    <p className="text-[14px] text-[#988d9f]">Rendering page…</p>
                  </div>
                )}

                <div ref={previewContRef}
                  className="relative w-full"
                  style={{ display: isRendering ? "none" : "block" }}
                  onClick={() => setSelectedId(null)}>
                  {/* PDF canvas */}
                  <canvas ref={previewRef} className="block w-full" aria-label={`PDF page ${currentPage}`} />

                  {/* Signature overlays */}
                  {canvasSize.w > 0 && (
                    <div className="absolute inset-0" style={{ userSelect: "none" }}>
                      {pageSigs.map(sig => {
                        const x  = sig.ptX * viewScale;
                        const y  = sig.ptY * viewScale;
                        const w  = sig.ptW * viewScale;
                        const h  = sig.ptH * viewScale;
                        const isSel = selectedId === sig.id;
                        return (
                          <div key={sig.id}
                            style={{
                              position: "absolute",
                              left: x, top: y, width: w, height: h,
                              cursor: "move",
                              transformOrigin: "center center",
                              transform: `rotate(${sig.rotation}deg)`,
                              zIndex: isSel ? 10 : 1,
                            }}
                            onPointerDown={e => onSigPointerDown(e, sig.id)}
                            onPointerMove={e => onSigPointerMove(e, sig.id)}
                            onPointerUp={onSigPointerUp}
                            onPointerCancel={onSigPointerUp}
                            role="button"
                            aria-label={`Signature on page ${sig.pageNum}`}
                            tabIndex={0}
                            onKeyDown={e => { if (e.key === "Delete") deleteSig(sig.id); }}>

                            {/* The image */}
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={sig.dataUrl} alt="Signature"
                              draggable={false}
                              style={{ width: "100%", height: "100%", objectFit: "fill", opacity: sig.opacity, display: "block", pointerEvents: "none" }} />

                            {/* Selection border */}
                            {isSel && (
                              <div style={{ position: "absolute", inset: -2, border: "2px dashed #ffb4ab", borderRadius: 2, pointerEvents: "none" }} />
                            )}

                            {/* Delete button (top-right) */}
                            {isSel && (
                              <button
                                onClick={e => { e.stopPropagation(); deleteSig(sig.id); }}
                                onPointerDown={e => e.stopPropagation()}
                                style={{ position: "absolute", top: -12, right: -12, width: 22, height: 22, borderRadius: "50%", background: "#ef4444", color: "#fff", fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", border: "2px solid #131313", zIndex: 20 }}
                                aria-label="Delete signature">
                                ×
                              </button>
                            )}

                            {/* Resize handle (bottom-right) */}
                            {isSel && (
                              <div
                                onPointerDown={e => onResizePointerDown(e, sig.id)}
                                onPointerMove={e => onResizePointerMove(e, sig.id)}
                                onPointerUp={onResizePointerUp}
                                onPointerCancel={onResizePointerUp}
                                style={{ position: "absolute", bottom: -5, right: -5, width: 14, height: 14, background: "#ffb4ab", borderRadius: 3, cursor: "se-resize", zIndex: 20, border: "2px solid #131313" }}
                                aria-label="Resize signature"
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Instructions overlay when no sigs on this page */}
                {!isRendering && ptWidth > 0 && pageSigs.length === 0 && (
                  <div className="px-5 py-3 border-t" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
                    <p className="text-[12px] text-center text-[#5a4d63]">
                      Create a signature in the panel and click <strong className="text-[#ffb4ab]">Add to Page</strong> — then drag it into position
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Upload another */}
          {isDone && (
            <div className="glass-panel rounded-2xl p-5 flex flex-col sm:flex-row items-center gap-4">
              <div className="flex items-center gap-3 flex-1">
                <span className="material-symbols-outlined text-[24px] text-[#22c55e]">check_circle</span>
                <div>
                  <p className="text-[14px] font-bold text-[#e2e2e2]">PDF signed and downloaded</p>
                  <p className="text-[12px] text-[#988d9f]">Your signatures were embedded into the PDF</p>
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={handleDownload} disabled={isProcessing}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-semibold"
                  style={{ background: "rgba(255,255,255,0.05)", color: "#e2e2e2", border: "1px solid rgba(255,255,255,0.1)" }}>
                  <span className="material-symbols-outlined text-[15px]">download</span>Download Again
                </button>
                <button onClick={handleReset}
                  className="btn-primary flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-[13px] font-semibold">
                  <span className="material-symbols-outlined text-[15px]">upload_file</span>Sign Another PDF
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── How it works ────────────────────────────────────────────────────── */}
      {!pdfFile && (
        <div className="glass-panel rounded-2xl p-6 flex flex-col gap-3">
          <p className="text-[12px] font-semibold text-[#988d9f] uppercase tracking-[0.08em]">How it works</p>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            {[
              { icon: "upload_file",  label: "1. Upload",     desc: "Drop your PDF — it stays in your browser" },
              { icon: "draw",         label: "2. Create",     desc: "Draw, type or upload your signature" },
              { icon: "touch_app",    label: "3. Position",   desc: "Drag the signature anywhere on any page" },
              { icon: "download",     label: "4. Download",   desc: "Save the signed PDF with embedded signatures" },
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
