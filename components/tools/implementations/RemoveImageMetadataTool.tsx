"use client";

/**
 * Remove Image Metadata
 *
 * Batch-strips all EXIF / GPS / camera metadata from images by redrawing
 * each image on an offscreen canvas and re-encoding it — the Canvas API
 * never carries metadata through toBlob().
 *
 * Flow per file:
 *   1. Upload  → create object URL, add item in state "analyzing"
 *   2. Analyze → exifr detects what metadata exists (count, GPS, camera)
 *   3. Remove  → canvas redraw + toBlob → state "done"
 *   4. Download individually or all as ZIP
 *
 * Output MIME:
 *   JPG/WebP → same format at user-chosen quality (default 95)
 *   PNG      → PNG (lossless)
 *   TIFF/HEIC → converted to JPEG (canvas limitation)
 */

import { useState, useRef, useCallback, useEffect } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────
type ItemState = "analyzing" | "pending" | "processing" | "done" | "error";

interface ImageItem {
  id:           string;
  file:         File;
  srcUrl:       string;
  // before-analysis results
  hasExif:      boolean;
  hasGps:       boolean;
  cameraModel:  string | null;
  exifCount:    number;
  analyzed:     boolean;
  // processing
  state:        ItemState;
  // results
  resultBlob:   Blob | null;
  resultUrl:    string | null;
  outMime:      string;
  outExt:       string;
  error:        string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function uid() { return Math.random().toString(36).slice(2, 9); }

function fmtSize(b: number): string {
  if (b < 1024)        return `${b} B`;
  if (b < 1_048_576)   return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1_048_576).toFixed(2)} MB`;
}

function outMimeAndExt(file: File): { mime: string; ext: string } {
  const t = file.type.toLowerCase();
  if (t === "image/png")  return { mime: "image/png",  ext: "png"  };
  if (t === "image/webp") return { mime: "image/webp", ext: "webp" };
  // TIFF / HEIC / unknown → JPEG
  if (t === "image/jpeg" || t === "image/jpg") return { mime: "image/jpeg", ext: "jpg" };
  // fallback for TIFF / HEIC / other
  return { mime: "image/jpeg", ext: "jpg" };
}

function baseName(name: string) { return name.replace(/\.[^.]+$/, ""); }

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload  = () => res(img);
    img.onerror = rej;
    img.src = src;
  });
}

// ── Metadata analysis (exifr, dynamic import) ──────────────────────────────────
async function analyzeExif(file: File): Promise<{
  hasExif: boolean; hasGps: boolean; cameraModel: string | null; exifCount: number;
}> {
  try {
    const exifr = await import("exifr");
    const exif  = await exifr.parse(file, { tiff: true, exif: true, gps: true }) as Record<string, unknown> | null;
    if (!exif || Object.keys(exif).length === 0) {
      return { hasExif: false, hasGps: false, cameraModel: null, exifCount: 0 };
    }
    const hasGps      = !!(exif.latitude ?? exif.GPSLatitude);
    const cameraModel = (exif.Model as string | undefined) ?? null;
    const exifCount   = Object.keys(exif).length;
    return { hasExif: true, hasGps, cameraModel, exifCount };
  } catch {
    return { hasExif: false, hasGps: false, cameraModel: null, exifCount: 0 };
  }
}

// ── Canvas metadata removal ────────────────────────────────────────────────────
async function stripMetadata(srcUrl: string, mime: string, quality: number): Promise<Blob> {
  const img    = await loadImg(srcUrl);
  const canvas = document.createElement("canvas");
  canvas.width  = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d")!;
  if (mime === "image/jpeg") {
    // white background so transparent areas don't become black
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.drawImage(img, 0, 0);
  return new Promise<Blob>((res, rej) =>
    canvas.toBlob(
      b => b ? res(b) : rej(new Error("Re-encode failed")),
      mime,
      mime === "image/png" ? undefined : quality / 100,
    ),
  );
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function RemoveImageMetadataTool() {
  const [items,      setItems]      = useState<ImageItem[]>([]);
  const [quality,    setQuality]    = useState(95);
  const [processing, setProcessing] = useState(false);
  const [dropActive, setDropActive] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Cleanup all object URLs on unmount
  useEffect(() => () => {
    items.forEach(it => {
      URL.revokeObjectURL(it.srcUrl);
      if (it.resultUrl) URL.revokeObjectURL(it.resultUrl);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load files ────────────────────────────────────────────────────────────
  const loadFiles = useCallback(async (files: File[]) => {
    const valid: File[] = files.filter(f =>
      /\.(jpe?g|png|webp|tiff?|heic)$/i.test(f.name) || f.type.startsWith("image/"),
    );
    if (valid.length === 0) return;

    // Create skeleton items immediately (state = analyzing)
    const skeletons: ImageItem[] = valid.map(f => {
      const { mime, ext } = outMimeAndExt(f);
      return {
        id: uid(), file: f,
        srcUrl:      URL.createObjectURL(f),
        hasExif:     false,
        hasGps:      false,
        cameraModel: null,
        exifCount:   0,
        analyzed:    false,
        state:       "analyzing" as ItemState,
        resultBlob:  null,
        resultUrl:   null,
        outMime:     mime,
        outExt:      ext,
        error:       null,
      };
    });

    setItems(prev => [...prev, ...skeletons]);

    // Analyze each file asynchronously
    for (const skel of skeletons) {
      const stats = await analyzeExif(skel.file);
      setItems(prev => prev.map(it =>
        it.id === skel.id
          ? { ...it, ...stats, analyzed: true, state: "pending" as ItemState }
          : it,
      ));
    }
  }, []);

  // ── Remove metadata (all pending/error items) ────────────────────────────
  const removeAll = useCallback(async () => {
    const pending = items.filter(it => it.state === "pending" || it.state === "error");
    if (pending.length === 0) return;
    setProcessing(true);

    for (const item of pending) {
      setItems(prev => prev.map(it =>
        it.id === item.id ? { ...it, state: "processing" as ItemState } : it,
      ));
      try {
        const blob = await stripMetadata(item.srcUrl, item.outMime, quality);
        if (item.resultUrl) URL.revokeObjectURL(item.resultUrl);
        const url  = URL.createObjectURL(blob);
        setItems(prev => prev.map(it =>
          it.id === item.id
            ? { ...it, state: "done" as ItemState, resultBlob: blob, resultUrl: url, error: null }
            : it,
        ));
      } catch (err) {
        setItems(prev => prev.map(it =>
          it.id === item.id
            ? { ...it, state: "error" as ItemState, error: err instanceof Error ? err.message : "Failed" }
            : it,
        ));
      }
    }

    setProcessing(false);
  }, [items, quality]);

  // ── Download single ───────────────────────────────────────────────────────
  const downloadOne = useCallback((item: ImageItem) => {
    if (!item.resultBlob) return;
    downloadBlob(item.resultBlob, `${baseName(item.file.name)}-clean.${item.outExt}`);
  }, []);

  // ── Download all as ZIP ───────────────────────────────────────────────────
  const downloadAll = useCallback(async () => {
    const done = items.filter(it => it.state === "done" && it.resultBlob);
    if (done.length === 0) return;
    if (done.length === 1) { downloadOne(done[0]); return; }
    try {
      const JSZip = (await import("jszip")).default;
      const zip   = new JSZip();
      done.forEach(it => zip.file(`${baseName(it.file.name)}-clean.${it.outExt}`, it.resultBlob!));
      const blob  = await zip.generateAsync({ type: "blob" });
      downloadBlob(blob, "clean-images.zip");
    } catch { /* ignore */ }
  }, [items, downloadOne]);

  // ── Remove single item ────────────────────────────────────────────────────
  const removeItem = useCallback((id: string) => {
    setItems(prev => {
      const it = prev.find(i => i.id === id);
      if (it) {
        URL.revokeObjectURL(it.srcUrl);
        if (it.resultUrl) URL.revokeObjectURL(it.resultUrl);
      }
      return prev.filter(i => i.id !== id);
    });
  }, []);

  // ── Clear all ─────────────────────────────────────────────────────────────
  const clearAll = useCallback(() => {
    items.forEach(it => {
      URL.revokeObjectURL(it.srcUrl);
      if (it.resultUrl) URL.revokeObjectURL(it.resultUrl);
    });
    setItems([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [items]);

  // ── Re-process a single item ──────────────────────────────────────────────
  const reprocessOne = useCallback(async (item: ImageItem) => {
    setItems(prev => prev.map(it =>
      it.id === item.id ? { ...it, state: "processing" as ItemState, error: null } : it,
    ));
    try {
      const blob = await stripMetadata(item.srcUrl, item.outMime, quality);
      if (item.resultUrl) URL.revokeObjectURL(item.resultUrl);
      const url  = URL.createObjectURL(blob);
      setItems(prev => prev.map(it =>
        it.id === item.id
          ? { ...it, state: "done" as ItemState, resultBlob: blob, resultUrl: url, error: null }
          : it,
      ));
    } catch (err) {
      setItems(prev => prev.map(it =>
        it.id === item.id
          ? { ...it, state: "error" as ItemState, error: err instanceof Error ? err.message : "Failed" }
          : it,
      ));
    }
  }, [quality]);

  // ── Derived ───────────────────────────────────────────────────────────────
  const doneCount    = items.filter(it => it.state === "done").length;
  const pendingCount = items.filter(it => it.state === "pending" || it.state === "error").length;
  const analyzingCount = items.filter(it => it.state === "analyzing").length;
  const lossless     = false; // quality always relevant for JPG/WebP; PNG items ignore it

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="mb-12 flex flex-col gap-5">

      {/* ── Drop zone ──────────────────────────────────────────────────────── */}
      <div
        onDrop={e => { e.preventDefault(); setDropActive(false); loadFiles(Array.from(e.dataTransfer.files)); }}
        onDragOver={e => { e.preventDefault(); setDropActive(true); }}
        onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropActive(false); }}
        onClick={() => fileInputRef.current?.click()}
        role="button" tabIndex={0} aria-label="Upload images to remove metadata"
        onKeyDown={e => { if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click(); }}
        className="glass-panel rounded-2xl flex flex-col items-center justify-center gap-4 cursor-pointer transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-[#4cd7f6]"
        style={{
          padding: items.length > 0 ? "24px 32px" : "56px 40px",
          border:  `2px dashed ${dropActive ? "#4cd7f6" : "rgba(255,255,255,0.12)"}`,
          background: dropActive ? "rgba(76,215,246,0.04)" : undefined,
        }}>
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 transition-transform duration-200"
            style={{ background: "rgba(76,215,246,0.1)", transform: dropActive ? "scale(1.1)" : "scale(1)" }}>
            <span className="material-symbols-outlined text-[28px]" style={{ color: "#4cd7f6" }}>
              {dropActive ? "file_download" : "shield"}
            </span>
          </div>
          <div>
            <p className="font-semibold text-base" style={{ color: "#e8dff0" }}>
              {dropActive ? "Drop images here" : items.length > 0 ? "Drop more images to add" : "Drag & drop images here"}
            </p>
            <p className="text-sm mt-0.5" style={{ color: "#988d9f" }}>
              or <span style={{ color: "#4cd7f6" }}>click to browse</span>
              {" "}— JPG, PNG, WebP, TIFF · max 50 MB each
            </p>
          </div>
        </div>
        {items.length === 0 && (
          <div className="flex flex-wrap justify-center gap-2 mt-1">
            {["Removes GPS","Strips EXIF","Batch Files","Privacy Safe","Browser-local"].map(tag => (
              <span key={tag} className="px-2.5 py-1 rounded-lg text-[11px] font-semibold"
                style={{ background: "rgba(76,215,246,0.08)", color: "#4cd7f6", border: "1px solid rgba(76,215,246,0.15)" }}>
                {tag}
              </span>
            ))}
          </div>
        )}
        <input ref={fileInputRef} type="file" multiple
          accept=".jpg,.jpeg,.png,.webp,.tiff,.tif,.heic"
          className="sr-only"
          onChange={e => { if (e.target.files) loadFiles(Array.from(e.target.files)); e.target.value = ""; }}
          aria-hidden tabIndex={-1} />
      </div>

      {items.length > 0 && (
        <>
          {/* ── Settings ────────────────────────────────────────────────────── */}
          <div className="glass-panel rounded-2xl p-5 flex flex-col gap-4"
            style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
            <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "#988d9f" }}>
              Output Quality (JPG / WebP)
            </p>
            <div>
              <div className="flex justify-between mb-1.5">
                <p className="text-[11px]" style={{ color: "#4d4354" }}>Lower quality = smaller file</p>
                <span className="text-[11px] font-bold tabular-nums" style={{ color: "#4cd7f6" }}>{quality}</span>
              </div>
              <input type="range" min={60} max={100} value={quality}
                onChange={e => setQuality(Number(e.target.value))}
                aria-label="Output quality"
                className="w-full h-2 rounded-full appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, #4cd7f6 ${((quality - 60) / 40) * 100}%, rgba(255,255,255,0.1) ${((quality - 60) / 40) * 100}%)`,
                  accentColor: "#4cd7f6",
                }} />
              <div className="flex justify-between mt-1">
                <span className="text-[10px]" style={{ color: "#4d4354" }}>60</span>
                <span className="text-[10px]" style={{ color: "#4d4354" }}>100 (lossless PNG ignored)</span>
              </div>
            </div>
          </div>

          {/* ── Stats bar ───────────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Images",      value: items.length.toString(),               icon: "image",       accent: false },
              { label: "Analyzing",   value: analyzingCount.toString(),              icon: "search",      accent: analyzingCount > 0 },
              { label: "Cleaned",     value: `${doneCount} / ${items.length}`,      icon: "shield",      accent: doneCount > 0 },
              { label: "Pending",     value: pendingCount.toString(),               icon: "hourglass_empty", accent: false },
            ].map(({ label, value, icon, accent }) => (
              <div key={label} className="glass-panel rounded-2xl p-4 flex flex-col gap-1"
                style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
                <span className="material-symbols-outlined text-[16px]" style={{ color: accent ? "#4cd7f6" : "#988d9f" }}>{icon}</span>
                <p className="text-lg font-bold tabular-nums leading-tight" style={{ color: accent ? "#4cd7f6" : "#e8dff0" }}>{value}</p>
                <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#988d9f" }}>{label}</p>
              </div>
            ))}
          </div>

          {/* ── Remove button ────────────────────────────────────────────────── */}
          {pendingCount > 0 && (
            <button onClick={removeAll} disabled={processing || analyzingCount > 0}
              className="btn-primary flex items-center justify-center gap-2 py-4 rounded-2xl font-bold text-base disabled:opacity-50 disabled:cursor-not-allowed">
              {processing ? (
                <><span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Removing Metadata…</>
              ) : analyzingCount > 0 ? (
                <><span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Analysing files…</>
              ) : (
                <><span className="material-symbols-outlined text-[20px]">shield</span>
                  Remove Metadata from {pendingCount} Image{pendingCount !== 1 ? "s" : ""}</>
              )}
            </button>
          )}

          {/* ── Image cards ──────────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {items.map(item => {
              const savings = item.resultBlob
                ? Math.round((1 - item.resultBlob.size / item.file.size) * 100)
                : null;
              const isTiffOrHeic = item.file.type === "image/tiff" || item.file.type === "image/heic"
                || /\.(tiff?|heic)$/i.test(item.file.name);

              return (
                <div key={item.id} className="glass-panel rounded-2xl overflow-hidden flex flex-col"
                  style={{ border: "1px solid rgba(255,255,255,0.06)" }}>

                  {/* Preview header */}
                  <div className="flex items-center gap-3 px-4 py-3"
                    style={{ borderBottom: "1px solid rgba(255,255,255,0.05)", background: "rgba(255,255,255,0.01)" }}>
                    {/* Thumbnail */}
                    <div className="w-10 h-10 rounded-xl overflow-hidden shrink-0 border border-white/10">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={item.srcUrl} alt={item.file.name}
                        className="w-full h-full object-cover" draggable={false} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-semibold truncate" style={{ color: "#e8dff0" }}>
                        {item.file.name}
                      </p>
                      <p className="text-[10px]" style={{ color: "#5a4d63" }}>
                        {fmtSize(item.file.size)}
                        {isTiffOrHeic && (
                          <span className="ml-1.5 px-1.5 py-0.5 rounded text-[9px] font-semibold"
                            style={{ background: "rgba(255,185,0,0.12)", color: "#f5c542" }}>
                            → JPEG
                          </span>
                        )}
                      </p>
                    </div>
                    {/* State indicator */}
                    <div className="shrink-0">
                      {item.state === "analyzing"   && <span className="w-5 h-5 border-2 border-[#4cd7f6]/30 border-t-[#4cd7f6] rounded-full animate-spin block" />}
                      {item.state === "processing"  && <span className="w-5 h-5 border-2 border-[#4cd7f6]/30 border-t-[#4cd7f6] rounded-full animate-spin block" />}
                      {item.state === "done"        && <span className="material-symbols-outlined text-[18px] text-green-400">check_circle</span>}
                      {item.state === "error"       && <span className="material-symbols-outlined text-[18px] text-red-400">error</span>}
                      {item.state === "pending"     && <span className="material-symbols-outlined text-[18px]" style={{ color: "#4d4354" }}>pending</span>}
                    </div>
                  </div>

                  {/* Before / After columns */}
                  <div className="flex divide-x divide-white/5">

                    {/* Before */}
                    <div className="flex-1 p-4 flex flex-col gap-2">
                      <p className="text-[9px] font-bold uppercase tracking-widest mb-1" style={{ color: "#4d4354" }}>Before</p>
                      {item.state === "analyzing" ? (
                        <div className="flex flex-col gap-2">
                          {[1,2,3].map(i => (
                            <div key={i} className="h-3 rounded-full animate-pulse"
                              style={{ background: "rgba(255,255,255,0.06)", width: `${60 + i * 12}%` }} />
                          ))}
                        </div>
                      ) : item.hasExif ? (
                        <>
                          <div className="flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-[13px] text-orange-400">warning</span>
                            <span className="text-[11px] font-semibold" style={{ color: "#ffaa60" }}>
                              {item.exifCount} metadata tag{item.exifCount !== 1 ? "s" : ""} found
                            </span>
                          </div>
                          {item.hasGps && (
                            <div className="flex items-center gap-1.5">
                              <span className="material-symbols-outlined text-[13px] text-red-400">location_on</span>
                              <span className="text-[11px] font-semibold" style={{ color: "#ff8080" }}>GPS location present</span>
                            </div>
                          )}
                          {item.cameraModel && (
                            <div className="flex items-center gap-1.5">
                              <span className="material-symbols-outlined text-[13px]" style={{ color: "#4d4354" }}>photo_camera</span>
                              <span className="text-[11px] truncate" style={{ color: "#988d9f" }}>{item.cameraModel}</span>
                            </div>
                          )}
                          {!item.hasGps && !item.cameraModel && (
                            <span className="text-[11px]" style={{ color: "#988d9f" }}>EXIF / properties present</span>
                          )}
                        </>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-[13px] text-green-400">check</span>
                          <span className="text-[11px]" style={{ color: "#80e0a0" }}>No EXIF found</span>
                        </div>
                      )}
                    </div>

                    {/* After */}
                    <div className="flex-1 p-4 flex flex-col gap-2">
                      <p className="text-[9px] font-bold uppercase tracking-widest mb-1" style={{ color: "#4d4354" }}>After</p>
                      {item.state === "processing" && (
                        <span className="text-[11px]" style={{ color: "#4cd7f6" }}>Cleaning…</span>
                      )}
                      {item.state === "done" && item.resultBlob && (
                        <>
                          <div className="flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-[13px] text-green-400">verified_user</span>
                            <span className="text-[11px] font-semibold" style={{ color: "#80e0a0" }}>Metadata removed</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-[13px]" style={{ color: "#4d4354" }}>data_usage</span>
                            <span className="text-[11px]" style={{ color: "#988d9f" }}>
                              {fmtSize(item.resultBlob.size)}
                              {savings !== null && (
                                <span className="ml-1 font-semibold" style={{ color: savings >= 0 ? "#80e0a0" : "#ff8080" }}>
                                  {savings >= 0 ? `−${savings}%` : `+${Math.abs(savings)}%`}
                                </span>
                              )}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-[13px]" style={{ color: "#4d4354" }}>check_circle</span>
                            <span className="text-[11px]" style={{ color: "#988d9f" }}>Quality preserved</span>
                          </div>
                        </>
                      )}
                      {item.state === "error" && (
                        <span className="text-[11px]" style={{ color: "#ff8080" }}>{item.error}</span>
                      )}
                      {(item.state === "pending" || item.state === "analyzing") && (
                        <span className="text-[11px]" style={{ color: "#3d3345" }}>—</span>
                      )}
                    </div>
                  </div>

                  {/* Card actions */}
                  <div className="px-4 py-2.5 flex items-center gap-2"
                    style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                    {item.state === "done" && (
                      <button onClick={() => downloadOne(item)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all"
                        style={{ background: "rgba(76,215,246,0.1)", color: "#4cd7f6", border: "1px solid rgba(76,215,246,0.2)" }}>
                        <span className="material-symbols-outlined text-[13px]">download</span>
                        Download
                      </button>
                    )}
                    {(item.state === "done" || item.state === "error") && (
                      <button onClick={() => reprocessOne(item)}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all opacity-60 hover:opacity-100"
                        style={{ background: "rgba(255,255,255,0.05)", color: "#988d9f" }}
                        aria-label="Retry">
                        <span className="material-symbols-outlined text-[13px]">refresh</span>
                      </button>
                    )}
                    <button onClick={() => removeItem(item.id)} aria-label="Remove from list"
                      className="ml-auto flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all opacity-50 hover:opacity-100"
                      style={{ background: "rgba(255,80,80,0.07)", color: "#ff8080" }}>
                      <span className="material-symbols-outlined text-[13px]">close</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── Action bar ─────────────────────────────────────────────────── */}
          <div className="flex flex-wrap gap-3">
            {doneCount > 0 && (
              <button onClick={downloadAll}
                className="btn-primary flex items-center gap-2 px-6 py-3 rounded-2xl font-bold text-sm flex-1 justify-center">
                <span className="material-symbols-outlined text-[18px]">
                  {doneCount > 1 ? "folder_zip" : "download"}
                </span>
                {doneCount > 1 ? `Download All (${doneCount}) as ZIP` : "Download Clean Image"}
              </button>
            )}
            <button onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-5 py-3 rounded-2xl font-semibold text-sm transition-all"
              style={{ background: "rgba(255,255,255,0.05)", color: "#988d9f", border: "1px solid rgba(255,255,255,0.08)" }}>
              <span className="material-symbols-outlined text-[18px]">add_photo_alternate</span>
              Add More
            </button>
            <button onClick={clearAll}
              className="flex items-center gap-2 px-5 py-3 rounded-2xl font-semibold text-sm transition-all"
              style={{ background: "rgba(255,80,80,0.08)", color: "#ff8080", border: "1px solid rgba(255,80,80,0.15)" }}>
              <span className="material-symbols-outlined text-[18px]">delete_sweep</span>
              Clear All
            </button>
          </div>
        </>
      )}

      {/* ── How it works (no files yet) ─────────────────────────────────────── */}
      {items.length === 0 && (
        <div className="glass-panel rounded-2xl p-6 flex flex-col gap-4"
          style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
          <p className="text-[12px] font-semibold text-[#988d9f] uppercase tracking-[0.08em]">What gets removed</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { icon: "location_off",    label: "GPS Location",       desc: "Exact coordinates where photo was taken" },
              { icon: "photo_camera",    label: "Camera Info",        desc: "Make, model, serial number" },
              { icon: "devices",         label: "Device Details",     desc: "Phone / camera device info" },
              { icon: "calendar_today",  label: "Dates",              desc: "Creation, modification, digitised time" },
              { icon: "person_off",      label: "Author / Copyright", desc: "Name, copyright, software tags" },
              { icon: "manage_history",  label: "All EXIF Tags",      desc: "Every embedded metadata tag" },
            ].map(({ icon, label, desc }) => (
              <div key={label} className="flex flex-col gap-1.5 p-3 rounded-xl"
                style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
                <span className="material-symbols-outlined text-[18px]" style={{ color: "#4cd7f6" }}>{icon}</span>
                <p className="text-[12px] font-bold" style={{ color: "#e2e2e2" }}>{label}</p>
                <p className="text-[11px] leading-relaxed" style={{ color: "#5a4d63" }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
