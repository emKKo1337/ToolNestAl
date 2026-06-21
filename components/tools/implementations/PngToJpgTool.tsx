"use client";

import { useState, useRef, useCallback, useEffect, useId } from "react";

// ─── Constants ────────────────────────────────────────────────────────────────
const MAX_FILE_BYTES = 50 * 1024 * 1024;

// ─── Types ────────────────────────────────────────────────────────────────────
type BgOption  = "white" | "black" | "custom";
type ItemState = "pending" | "converting" | "done" | "error";
type NotifType = "success" | "error" | "info";

interface ImageItem {
  id:          string;
  file:        File;
  srcUrl:      string;
  w:           number;
  h:           number;
  state:       ItemState;
  resultBlob:  Blob | null;
  resultUrl:   string | null;
  error:       string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function uid() { return Math.random().toString(36).slice(2, 10); }

function fmt(b: number): string {
  if (b < 1024)      return `${b} B`;
  if (b < 1_048_576) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1_048_576).toFixed(2)} MB`;
}

function baseName(name: string): string { return name.replace(/\.[^.]+$/, ""); }

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

async function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload  = () => res(img);
    img.onerror = rej;
    img.src = url;
  });
}

async function pngToJpg(srcUrl: string, quality: number, bgColor: string): Promise<Blob> {
  const img    = await loadImage(srcUrl);
  const canvas = document.createElement("canvas");
  canvas.width  = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0);
  return new Promise<Blob>((res, rej) =>
    canvas.toBlob(
      b => b ? res(b) : rej(new Error("Canvas toBlob failed")),
      "image/jpeg",
      quality / 100,
    ),
  );
}

// ─── Chip ─────────────────────────────────────────────────────────────────────
function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} aria-pressed={active}
      className="px-3.5 py-2 rounded-xl text-[13px] font-semibold transition-all duration-200"
      style={{
        background: active ? "rgba(76,215,246,0.15)" : "rgba(255,255,255,0.04)",
        color:      active ? "#4cd7f6"               : "#988d9f",
        border:     `1px solid ${active ? "rgba(76,215,246,0.35)" : "rgba(255,255,255,0.08)"}`,
      }}>
      {children}
    </button>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function PngToJpgTool() {
  const uid0 = useId();
  const colorId = `${uid0}-color`;

  const [items,       setItems]       = useState<ImageItem[]>([]);
  const [quality,     setQuality]     = useState(92);
  const [bgOption,    setBgOption]    = useState<BgOption>("white");
  const [customColor, setCustomColor] = useState("#ffffff");
  const [dragging,    setDragging]    = useState(false);
  const [converting,  setConverting]  = useState(false);
  const [notif,       setNotif]       = useState<{ type: NotifType; msg: string } | null>(null);

  const dropRef  = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const notify = useCallback((type: NotifType, msg: string) => {
    setNotif({ type, msg });
    if (type !== "info") setTimeout(() => setNotif(null), 8000);
  }, []);

  // ── Load files ──────────────────────────────────────────────────────────────
  const loadFiles = useCallback(async (files: FileList | File[]) => {
    const list = Array.from(files);
    const pngs = list.filter(f => f.type === "image/png" || f.name.toLowerCase().endsWith(".png"));
    const bad  = list.filter(f => !pngs.includes(f));

    if (bad.length > 0) notify("error", `${bad.length} file(s) skipped — only PNG is accepted.`);
    if (pngs.length === 0) return;

    const newItems: ImageItem[] = [];
    for (const file of pngs) {
      if (file.size > MAX_FILE_BYTES) { notify("error", `"${file.name}" exceeds 50 MB.`); continue; }
      const srcUrl = URL.createObjectURL(file);
      let w = 0, h = 0;
      try {
        const img = await loadImage(srcUrl);
        w = img.naturalWidth; h = img.naturalHeight;
      } catch { URL.revokeObjectURL(srcUrl); continue; }
      newItems.push({ id: uid(), file, srcUrl, w, h, state: "pending", resultBlob: null, resultUrl: null, error: null });
    }
    setItems(prev => [...prev, ...newItems]);
    setNotif(null);
  }, [notify]);

  // ── Drop zone ───────────────────────────────────────────────────────────────
  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    loadFiles(e.dataTransfer.files);
  }, [loadFiles]);

  const onDragOver  = useCallback((e: React.DragEvent) => { e.preventDefault(); setDragging(true); }, []);
  const onDragLeave = useCallback((e: React.DragEvent) => {
    if (dropRef.current && !dropRef.current.contains(e.relatedTarget as Node)) setDragging(false);
  }, []);

  // ── Convert all ─────────────────────────────────────────────────────────────
  const convertAll = useCallback(async () => {
    const pending = items.filter(it => it.state === "pending" || it.state === "error");
    if (pending.length === 0) return;
    setConverting(true);

    const bg = bgOption === "custom" ? customColor : bgOption === "black" ? "#000000" : "#ffffff";

    for (const item of pending) {
      setItems(prev => prev.map(it => it.id === item.id ? { ...it, state: "converting" } : it));
      try {
        const blob    = await pngToJpg(item.srcUrl, quality, bg);
        const resUrl  = URL.createObjectURL(blob);
        setItems(prev => prev.map(it => it.id === item.id
          ? { ...it, state: "done", resultBlob: blob, resultUrl: resUrl, error: null }
          : it));
      } catch (err) {
        setItems(prev => prev.map(it => it.id === item.id
          ? { ...it, state: "error", error: err instanceof Error ? err.message : "Conversion failed" }
          : it));
      }
    }
    setConverting(false);
    notify("success", `Converted ${pending.length} image${pending.length !== 1 ? "s" : ""} to JPG.`);
  }, [items, quality, bgOption, customColor, notify]);

  // ── Download single ──────────────────────────────────────────────────────────
  const downloadOne = useCallback((item: ImageItem) => {
    if (!item.resultBlob) return;
    downloadBlob(item.resultBlob, `${baseName(item.file.name)}.jpg`);
  }, []);

  // ── Download all (ZIP) ──────────────────────────────────────────────────────
  const downloadAll = useCallback(async () => {
    const done = items.filter(it => it.state === "done" && it.resultBlob);
    if (done.length === 0) return;
    if (done.length === 1) { downloadOne(done[0]); return; }

    try {
      const JSZip = (await import("jszip")).default;
      const zip   = new JSZip();
      done.forEach(it => zip.file(`${baseName(it.file.name)}.jpg`, it.resultBlob!));
      const blob = await zip.generateAsync({ type: "blob" });
      downloadBlob(blob, "png-to-jpg-converted.zip");
    } catch {
      notify("error", "Failed to create ZIP archive.");
    }
  }, [items, downloadOne, notify]);

  // ── Remove item ─────────────────────────────────────────────────────────────
  const removeItem = useCallback((id: string) => {
    setItems(prev => {
      const item = prev.find(it => it.id === id);
      if (item) {
        URL.revokeObjectURL(item.srcUrl);
        if (item.resultUrl) URL.revokeObjectURL(item.resultUrl);
      }
      return prev.filter(it => it.id !== id);
    });
  }, []);

  // ── Clear all ───────────────────────────────────────────────────────────────
  const clearAll = useCallback(() => {
    items.forEach(it => {
      URL.revokeObjectURL(it.srcUrl);
      if (it.resultUrl) URL.revokeObjectURL(it.resultUrl);
    });
    setItems([]);
    setNotif(null);
    if (inputRef.current) inputRef.current.value = "";
  }, [items]);

  // Cleanup on unmount
  useEffect(() => () => {
    items.forEach(it => {
      URL.revokeObjectURL(it.srcUrl);
      if (it.resultUrl) URL.revokeObjectURL(it.resultUrl);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Derived ──────────────────────────────────────────────────────────────
  const doneCount    = items.filter(it => it.state === "done").length;
  const pendingCount = items.filter(it => it.state === "pending" || it.state === "error").length;
  const totalSize    = items.reduce((s, it) => s + it.file.size, 0);
  const resultSize   = items.filter(it => it.resultBlob).reduce((s, it) => s + (it.resultBlob?.size ?? 0), 0);
  const savings      = totalSize > 0 && resultSize > 0 ? Math.round((1 - resultSize / totalSize) * 100) : null;

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="mb-12 flex flex-col gap-6">

      {/* ── Drop zone ───────────────────────────────────────────────────────── */}
      <div ref={dropRef}
        onDrop={onDrop} onDragOver={onDragOver} onDragLeave={onDragLeave}
        onClick={() => inputRef.current?.click()}
        role="button" tabIndex={0} aria-label="Upload PNG images"
        onKeyDown={e => { if (e.key === "Enter" || e.key === " ") inputRef.current?.click(); }}
        className="glass-panel rounded-2xl flex flex-col items-center justify-center gap-4 cursor-pointer transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-[#4cd7f6]"
        style={{
          padding: "52px 40px",
          border: `2px dashed ${dragging ? "#4cd7f6" : "rgba(255,255,255,0.12)"}`,
          background: dragging ? "rgba(76,215,246,0.05)" : undefined,
          minHeight: "200px",
        }}>
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center transition-transform duration-200"
          style={{ background: "rgba(76,215,246,0.1)", transform: dragging ? "scale(1.1)" : "scale(1)" }}>
          <span className="material-symbols-outlined text-[32px]" style={{ color: "#4cd7f6" }}>
            {dragging ? "file_download" : "image"}
          </span>
        </div>
        <div className="text-center">
          <p className="font-semibold text-base" style={{ color: "#e8dff0" }}>
            {dragging ? "Drop PNG files here" : "Drag & drop PNG files here"}
          </p>
          <p className="text-sm mt-1" style={{ color: "#988d9f" }}>
            or <span style={{ color: "#4cd7f6" }}>click to browse</span> — PNG only · up to 50 MB per file
          </p>
        </div>
        {items.length === 0 && (
          <div className="flex flex-wrap justify-center gap-2">
            {["Multiple files", "Batch convert", "ZIP download", "Browser-local"].map(tag => (
              <span key={tag} className="px-2.5 py-1 rounded-lg text-[11px] font-semibold"
                style={{ background: "rgba(76,215,246,0.08)", color: "#4cd7f6", border: "1px solid rgba(76,215,246,0.15)" }}>
                {tag}
              </span>
            ))}
          </div>
        )}
        <input ref={inputRef} type="file" accept=".png,image/png" multiple className="sr-only"
          onChange={e => { if (e.target.files) loadFiles(e.target.files); e.target.value = ""; }}
          aria-hidden tabIndex={-1} />
      </div>

      {/* ── Notification ────────────────────────────────────────────────────── */}
      {notif && (
        <div role="alert" className="flex items-start gap-3 p-4 rounded-2xl text-sm font-medium"
          style={{
            background: notif.type === "error" ? "rgba(255,100,100,0.1)" : notif.type === "success" ? "rgba(100,220,150,0.1)" : "rgba(76,215,246,0.1)",
            border: `1px solid ${notif.type === "error" ? "rgba(255,100,100,0.25)" : notif.type === "success" ? "rgba(100,220,150,0.25)" : "rgba(76,215,246,0.25)"}`,
            color: notif.type === "error" ? "#ff8080" : notif.type === "success" ? "#80e0a0" : "#4cd7f6",
          }}>
          <span className="material-symbols-outlined text-[18px] mt-0.5 shrink-0">
            {notif.type === "error" ? "error" : notif.type === "success" ? "check_circle" : "info"}
          </span>
          <span className="flex-1">{notif.msg}</span>
          <button onClick={() => setNotif(null)} className="opacity-60 hover:opacity-100 transition-opacity" aria-label="Dismiss">
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>
      )}

      {items.length > 0 && (
        <>
          {/* ── Settings panel ───────────────────────────────────────────────── */}
          <div className="glass-panel rounded-2xl p-5 flex flex-col gap-5"
            style={{ border: "1px solid rgba(255,255,255,0.06)" }}>

            {/* Quality slider */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#988d9f" }}>JPG Quality</p>
                <span className="text-sm font-bold tabular-nums" style={{ color: "#4cd7f6" }}>{quality}</span>
              </div>
              <input type="range" min={1} max={100} value={quality}
                onChange={e => setQuality(Number(e.target.value))}
                aria-label="JPG quality"
                className="w-full h-2 rounded-full appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, #4cd7f6 ${quality}%, rgba(255,255,255,0.1) ${quality}%)`,
                  accentColor: "#4cd7f6",
                }} />
              <div className="flex justify-between mt-1.5">
                <span className="text-[11px]" style={{ color: "#4d4354" }}>Smaller file</span>
                <span className="text-[11px]" style={{ color: "#4d4354" }}>Higher quality</span>
              </div>
            </div>

            {/* Background color */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "#988d9f" }}>
                Transparent areas background
              </p>
              <div className="flex flex-wrap gap-2 mb-3">
                {(["white", "black", "custom"] as BgOption[]).map(opt => (
                  <Chip key={opt} active={bgOption === opt} onClick={() => setBgOption(opt)}>
                    {opt.charAt(0).toUpperCase() + opt.slice(1)}
                  </Chip>
                ))}
              </div>
              {bgOption === "custom" && (
                <div className="flex items-center gap-3">
                  <label htmlFor={colorId} className="text-sm font-medium" style={{ color: "#988d9f" }}>Color</label>
                  <input id={colorId} type="color" value={customColor}
                    onChange={e => setCustomColor(e.target.value)}
                    className="w-10 h-10 rounded-xl cursor-pointer border-0 p-0"
                    style={{ background: "none" }} />
                  <span className="text-sm font-mono" style={{ color: "#4cd7f6" }}>{customColor.toUpperCase()}</span>
                </div>
              )}
            </div>
          </div>

          {/* ── Stats bar ────────────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Images",        value: items.length.toString(),            icon: "image",     accent: false },
              { label: "Converted",     value: `${doneCount} / ${items.length}`,  icon: "check",     accent: doneCount > 0 },
              { label: "Original size", value: fmt(totalSize),                     icon: "folder",    accent: false },
              { label: savings !== null ? (savings >= 0 ? `${savings}% smaller` : `${Math.abs(savings)}% larger`) : "Converted size",
                value: resultSize > 0 ? fmt(resultSize) : "—",                    icon: "download",  accent: resultSize > 0 },
            ].map(({ label, value, icon, accent }) => (
              <div key={label} className="glass-panel rounded-2xl p-4 flex flex-col gap-1"
                style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
                <span className="material-symbols-outlined text-[16px]"
                  style={{ color: accent ? "#4cd7f6" : "#988d9f" }}>{icon}</span>
                <p className="text-lg font-bold tabular-nums leading-tight"
                  style={{ color: accent ? "#4cd7f6" : "#e8dff0" }}>{value}</p>
                <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#988d9f" }}>{label}</p>
              </div>
            ))}
          </div>

          {/* ── Convert button ───────────────────────────────────────────────── */}
          {pendingCount > 0 && (
            <button onClick={convertAll} disabled={converting}
              className="btn-primary flex items-center justify-center gap-2 py-4 rounded-2xl font-bold text-base transition-all"
              style={{ opacity: converting ? 0.6 : 1, cursor: converting ? "not-allowed" : "pointer" }}>
              {converting ? (
                <><span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Converting…</>
              ) : (
                <><span className="material-symbols-outlined text-[20px]">swap_horiz</span>
                  Convert {pendingCount} PNG{pendingCount !== 1 ? "s" : ""} to JPG</>
              )}
            </button>
          )}

          {/* ── Image grid ───────────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {items.map(item => (
              <div key={item.id} className="glass-panel rounded-2xl overflow-hidden flex flex-col"
                style={{ border: "1px solid rgba(255,255,255,0.06)" }}>

                {/* Preview row */}
                <div className="flex gap-0 divide-x divide-white/5">
                  {/* Original */}
                  <div className="flex-1 relative">
                    <div className="aspect-video bg-[#1a1a2e] overflow-hidden flex items-center justify-center">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={item.srcUrl} alt={item.file.name}
                        className="max-w-full max-h-full object-contain"
                        style={{
                          backgroundImage: "linear-gradient(45deg,#444 25%,transparent 25%),linear-gradient(-45deg,#444 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#444 75%),linear-gradient(-45deg,transparent 75%,#444 75%)",
                          backgroundSize: "12px 12px",
                          backgroundPosition: "0 0,0 6px,6px -6px,-6px 0",
                          backgroundColor: "#555",
                        }} />
                    </div>
                    <div className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded-md text-[10px] font-bold"
                      style={{ background: "rgba(0,0,0,0.65)", color: "#ccc" }}>PNG</div>
                  </div>

                  {/* Result */}
                  <div className="flex-1 relative">
                    <div className="aspect-video bg-[#1a1a2e] overflow-hidden flex items-center justify-center">
                      {item.resultUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.resultUrl} alt="JPG result"
                          className="max-w-full max-h-full object-contain" />
                      ) : item.state === "converting" ? (
                        <span className="w-6 h-6 border-2 border-[#4cd7f6]/30 border-t-[#4cd7f6] rounded-full animate-spin" />
                      ) : item.state === "error" ? (
                        <div className="flex flex-col items-center gap-1">
                          <span className="material-symbols-outlined text-[24px] text-red-400">error</span>
                          <p className="text-[10px] text-red-400 text-center px-2">{item.error}</p>
                        </div>
                      ) : (
                        <span className="material-symbols-outlined text-[28px]" style={{ color: "#4d4354" }}>image</span>
                      )}
                    </div>
                    <div className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded-md text-[10px] font-bold"
                      style={{ background: "rgba(0,0,0,0.65)", color: item.resultUrl ? "#4cd7f6" : "#555" }}>JPG</div>
                  </div>
                </div>

                {/* Info row */}
                <div className="px-4 py-3 flex items-center gap-2">
                  {/* State badge */}
                  <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                    {item.state === "done" && <span className="material-symbols-outlined text-[16px] text-green-400">check_circle</span>}
                    {item.state === "converting" && <span className="w-4 h-4 border-2 border-[#4cd7f6]/30 border-t-[#4cd7f6] rounded-full animate-spin" />}
                    {item.state === "error" && <span className="material-symbols-outlined text-[16px] text-red-400">error</span>}
                    {item.state === "pending" && <span className="material-symbols-outlined text-[16px]" style={{ color: "#4d4354" }}>hourglass_empty</span>}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-semibold truncate" style={{ color: "#e8dff0" }}>{item.file.name}</p>
                    <p className="text-[10px]" style={{ color: "#5a4d63" }}>
                      {item.w} × {item.h} px · {fmt(item.file.size)}
                      {item.resultBlob && ` → ${fmt(item.resultBlob.size)}`}
                    </p>
                  </div>

                  {item.state === "done" && (
                    <button onClick={() => downloadOne(item)} aria-label={`Download ${baseName(item.file.name)}.jpg`}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all"
                      style={{ background: "rgba(76,215,246,0.1)", color: "#4cd7f6", border: "1px solid rgba(76,215,246,0.2)" }}>
                      <span className="material-symbols-outlined text-[13px]">download</span>JPG
                    </button>
                  )}

                  <button onClick={() => removeItem(item.id)} aria-label="Remove image"
                    className="w-7 h-7 flex items-center justify-center rounded-lg transition-all opacity-50 hover:opacity-100"
                    style={{ background: "rgba(255,255,255,0.05)" }}>
                    <span className="material-symbols-outlined text-[14px]" style={{ color: "#988d9f" }}>close</span>
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* ── Action bar ───────────────────────────────────────────────────── */}
          <div className="flex flex-wrap gap-3">
            {doneCount > 0 && (
              <button onClick={downloadAll}
                className="btn-primary flex items-center gap-2 px-6 py-3 rounded-2xl font-bold text-sm flex-1 justify-center">
                <span className="material-symbols-outlined text-[18px]">
                  {doneCount > 1 ? "folder_zip" : "download"}
                </span>
                {doneCount > 1 ? `Download All (${doneCount}) as ZIP` : "Download JPG"}
              </button>
            )}
            <button onClick={() => inputRef.current?.click()}
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

      {/* ── How it works ─────────────────────────────────────────────────────── */}
      {items.length === 0 && (
        <div className="glass-panel rounded-2xl p-6 flex flex-col gap-3">
          <p className="text-[12px] font-semibold text-[#988d9f] uppercase tracking-[0.08em]">How it works</p>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            {[
              { icon: "upload_file",  label: "1. Upload",    desc: "Drop PNG files — process multiple at once" },
              { icon: "tune",         label: "2. Configure", desc: "Set JPG quality and background fill color" },
              { icon: "swap_horiz",   label: "3. Convert",   desc: "Instant browser-local conversion — no uploads" },
              { icon: "download",     label: "4. Download",  desc: "Download JPGs individually or all as a ZIP" },
            ].map(({ icon, label, desc }) => (
              <div key={label} className="flex flex-col gap-2 p-4 rounded-xl"
                style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
                <span className="material-symbols-outlined text-[22px]" style={{ color: "#4cd7f6" }}>{icon}</span>
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
