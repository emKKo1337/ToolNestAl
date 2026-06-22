"use client";

/**
 * Image Metadata Viewer
 *
 * Extracts and displays:
 *   - Basic file info  (name, size, type, dimensions, aspect ratio)
 *   - Camera / EXIF   (make, model, lens, focal length, aperture, ISO,
 *                       exposure time, flash, white balance)
 *   - Image properties (orientation, DPI, colour space, bit depth)
 *   - Dates            (date taken, digitised, modified)
 *   - GPS              (lat/lng/alt + Google Maps link)
 *
 * EXIF parsing via `exifr` (browser-local, no upload).
 * Export: JSON or TXT; copy all to clipboard.
 */

import { useState, useRef, useCallback } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────
interface MetaSection {
  title: string;
  icon: string;
  rows: { label: string; value: string; link?: string }[];
}

interface ParsedMeta {
  sections: MetaSection[];
  hasExif: boolean;
  hasGps: boolean;
  gpsLat?: number;
  gpsLng?: number;
  raw: Record<string, unknown>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtSize(b: number): string {
  if (b < 1024)        return `${b} B`;
  if (b < 1_048_576)   return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1_073_741_824) return `${(b / 1_048_576).toFixed(2)} MB`;
  return `${(b / 1_073_741_824).toFixed(2)} GB`;
}

function gcd(a: number, b: number): number { return b === 0 ? a : gcd(b, a % b); }

function aspectRatio(w: number, h: number): string {
  const d = gcd(w, h);
  return `${w / d}:${h / d}`;
}

function fmtExposure(val: unknown): string {
  if (typeof val !== "number") return String(val ?? "—");
  if (val >= 1) return `${val.toFixed(1)}s`;
  const denom = Math.round(1 / val);
  return `1/${denom}s`;
}

function fmtGps(deg: number[]): number {
  // exifr returns decimal degrees directly, but sometimes returns DMS array
  if (deg.length === 1) return deg[0];
  return deg[0] + deg[1] / 60 + deg[2] / 3600;
}

function fmtDate(val: unknown): string {
  if (!val) return "—";
  if (val instanceof Date) {
    return isNaN(val.getTime()) ? "—" : val.toLocaleString();
  }
  // EXIF string "YYYY:MM:DD HH:MM:SS"
  const str = String(val).replace(/^(\d{4}):(\d{2}):(\d{2})/, "$1-$2-$3");
  const d = new Date(str);
  return isNaN(d.getTime()) ? String(val) : d.toLocaleString();
}

function fmtFlash(val: unknown): string {
  if (typeof val === "boolean") return val ? "Flash fired" : "No flash";
  if (typeof val === "number") {
    // Bit 0: flash fired
    return (val & 1) ? "Flash fired" : "No flash";
  }
  return String(val ?? "—");
}

function fmtWhiteBalance(val: unknown): string {
  if (val === 0) return "Auto";
  if (val === 1) return "Manual";
  return String(val ?? "—");
}

function fmtOrientation(val: unknown): string {
  const map: Record<number, string> = {
    1: "Normal (0°)", 2: "Flipped horizontal", 3: "Rotated 180°",
    4: "Flipped vertical", 5: "Transposed", 6: "Rotated 90° CW",
    7: "Transverse", 8: "Rotated 90° CCW",
  };
  return typeof val === "number" ? (map[val] ?? `${val}`) : String(val ?? "—");
}

function fmtColorSpace(val: unknown): string {
  if (val === 1) return "sRGB";
  if (val === 65535 || val === 0xFFFF) return "Uncalibrated";
  return String(val ?? "—");
}

function str(val: unknown, suffix = ""): string {
  if (val === undefined || val === null || val === "") return "—";
  return `${val}${suffix}`;
}

function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload  = () => res(img);
    img.onerror = rej;
    img.src = src;
  });
}

// ── EXIF parsing ─────────────────────────────────────────────────────────────
async function extractMeta(file: File, imgW: number, imgH: number): Promise<ParsedMeta> {
  // Dynamic import — exifr is client-side only
  const exifr = await import("exifr");

  // Attempt full parse including GPS
  let exif: Record<string, unknown> | null = null;
  try {
    exif = await exifr.parse(file, {
      tiff: true, exif: true, gps: true, iptc: false, xmp: false,
      translateValues: true, reviveValues: true,
    }) as Record<string, unknown> | null;
  } catch {
    exif = null;
  }

  const has = (key: string) => exif && exif[key] !== undefined && exif[key] !== null;
  const get = (key: string) => (exif && exif[key] !== undefined ? exif[key] : undefined);

  // GPS
  let gpsLat: number | undefined;
  let gpsLng: number | undefined;
  let gpsAlt: number | undefined;

  if (has("latitude") && has("longitude")) {
    // exifr returns decimal degrees when translateValues = true
    gpsLat = get("latitude") as number;
    gpsLng = get("longitude") as number;
  } else if (has("GPSLatitude") && has("GPSLongitude")) {
    const rawLat = get("GPSLatitude") as number | number[];
    const rawLng = get("GPSLongitude") as number | number[];
    gpsLat = Array.isArray(rawLat) ? fmtGps(rawLat) : rawLat;
    gpsLng = Array.isArray(rawLng) ? fmtGps(rawLng) : rawLng;
    if (get("GPSLatitudeRef") === "S") gpsLat = -gpsLat;
    if (get("GPSLongitudeRef") === "W") gpsLng = -gpsLng;
  }
  if (has("GPSAltitude")) gpsAlt = get("GPSAltitude") as number;

  const mapsUrl = gpsLat !== undefined && gpsLng !== undefined
    ? `https://www.google.com/maps?q=${gpsLat.toFixed(6)},${gpsLng.toFixed(6)}`
    : undefined;

  // Sections
  const sections: MetaSection[] = [];

  // ── Basic ──────────────────────────────────────────────────────────────────
  sections.push({
    title: "Basic Information",
    icon: "insert_drive_file",
    rows: [
      { label: "File Name",    value: file.name },
      { label: "File Size",    value: fmtSize(file.size) },
      { label: "File Type",    value: file.type || file.name.split(".").pop()?.toUpperCase() || "—" },
      { label: "Width",        value: imgW ? `${imgW} px` : "—" },
      { label: "Height",       value: imgH ? `${imgH} px` : "—" },
      { label: "Aspect Ratio", value: imgW && imgH ? aspectRatio(imgW, imgH) : "—" },
    ],
  });

  // ── Camera / EXIF ──────────────────────────────────────────────────────────
  const cameraRows: MetaSection["rows"] = [
    { label: "Camera Brand",   value: str(get("Make"))         },
    { label: "Camera Model",   value: str(get("Model"))        },
    { label: "Lens",           value: str(get("LensModel"))    },
    { label: "Focal Length",   value: has("FocalLength")  ? `${get("FocalLength")} mm`                       : "—" },
    { label: "Aperture",       value: has("FNumber")      ? `f/${get("FNumber")}`                            : "—" },
    { label: "ISO",            value: str(get("ISO") ?? get("ISOSpeedRatings")) },
    { label: "Exposure Time",  value: has("ExposureTime") ? fmtExposure(get("ExposureTime"))                  : "—" },
    { label: "Flash",          value: has("Flash")        ? fmtFlash(get("Flash"))                           : "—" },
    { label: "White Balance",  value: has("WhiteBalance") ? fmtWhiteBalance(get("WhiteBalance"))              : "—" },
  ];
  const hasCamera = cameraRows.some(r => r.value !== "—");
  sections.push({ title: "Camera (EXIF)", icon: "photo_camera", rows: cameraRows });

  // ── Image properties ───────────────────────────────────────────────────────
  const xDpi = get("XResolution") ?? get("PixelXDimension");
  const yDpi = get("YResolution") ?? get("PixelYDimension");
  const dpiStr = (has("XResolution") && has("YResolution"))
    ? `${get("XResolution")} × ${get("YResolution")} DPI`
    : "—";

  sections.push({
    title: "Image Properties",
    icon: "image",
    rows: [
      { label: "Orientation",  value: has("Orientation") ? fmtOrientation(get("Orientation")) : "—" },
      { label: "DPI",          value: dpiStr },
      { label: "Colour Space", value: has("ColorSpace") ? fmtColorSpace(get("ColorSpace")) : (has("colorspace") ? str(get("colorspace")) : "—") },
      { label: "Bit Depth",    value: has("BitsPerSample")    ? str(get("BitsPerSample"), " bit") : (has("BitDepth") ? str(get("BitDepth"), " bit") : "—") },
    ],
  });

  // ── Dates ──────────────────────────────────────────────────────────────────
  sections.push({
    title: "Dates",
    icon: "calendar_today",
    rows: [
      { label: "Date Taken",    value: fmtDate(get("DateTimeOriginal")  ?? get("dateTimeOriginal")) },
      { label: "Date Digitised",value: fmtDate(get("DateTimeDigitized") ?? get("CreateDate")) },
      { label: "Date Modified", value: fmtDate(get("ModifyDate")        ?? get("DateTime")) },
    ],
  });

  // ── GPS ────────────────────────────────────────────────────────────────────
  const gpsRows: MetaSection["rows"] = [];
  if (gpsLat !== undefined && gpsLng !== undefined) {
    gpsRows.push({ label: "Latitude",   value: `${gpsLat.toFixed(6)}°` });
    gpsRows.push({ label: "Longitude",  value: `${gpsLng.toFixed(6)}°` });
    if (gpsAlt !== undefined) gpsRows.push({ label: "Altitude", value: `${Math.round(gpsAlt)} m` });
    gpsRows.push({ label: "Google Maps", value: "Open location", link: mapsUrl });
  }
  sections.push({
    title: "GPS Location",
    icon: "location_on",
    rows: gpsRows.length > 0 ? gpsRows : [{ label: "Status", value: "No GPS data found" }],
  });

  return {
    sections,
    hasExif: !!exif && hasCamera,
    hasGps: gpsLat !== undefined && gpsLng !== undefined,
    gpsLat,
    gpsLng,
    raw: exif ?? {},
  };
}

// ── Flatten meta to a plain string for export/copy ────────────────────────────
function metaToText(sections: MetaSection[]): string {
  return sections
    .map(s => {
      const rows = s.rows.map(r => `  ${r.label}: ${r.value}`).join("\n");
      return `=== ${s.title} ===\n${rows}`;
    })
    .join("\n\n");
}

function downloadText(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function ImageMetadataViewerTool() {
  const [file,        setFile]        = useState<File | null>(null);
  const [imgUrl,      setImgUrl]      = useState("");
  const [meta,        setMeta]        = useState<ParsedMeta | null>(null);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [dropActive,  setDropActive]  = useState(false);
  const [copied,      setCopied]      = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const prevUrl      = useRef("");

  // ── Load & parse ──────────────────────────────────────────────────────────
  const processFile = useCallback(async (f: File) => {
    // Revoke previous object URL
    if (prevUrl.current) URL.revokeObjectURL(prevUrl.current);

    setLoading(true);
    setError(null);
    setMeta(null);

    const url = URL.createObjectURL(f);
    prevUrl.current = url;
    setFile(f);
    setImgUrl(url);

    try {
      const img = await loadImg(url);
      const parsed = await extractMeta(f, img.naturalWidth, img.naturalHeight);
      setMeta(parsed);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to read metadata.");
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Drop zone ─────────────────────────────────────────────────────────────
  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDropActive(false);
    const f = e.dataTransfer.files[0];
    if (f) processFile(f);
  }, [processFile]);

  // ── Clear ─────────────────────────────────────────────────────────────────
  const clear = useCallback(() => {
    if (prevUrl.current) URL.revokeObjectURL(prevUrl.current);
    prevUrl.current = "";
    setFile(null);
    setImgUrl("");
    setMeta(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  // ── Copy all metadata ─────────────────────────────────────────────────────
  const copyAll = useCallback(async () => {
    if (!meta) return;
    try {
      await navigator.clipboard.writeText(metaToText(meta.sections));
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch { /* ignore */ }
  }, [meta]);

  // ── Export ────────────────────────────────────────────────────────────────
  const exportJson = useCallback(() => {
    if (!meta || !file) return;
    const payload = {
      file: { name: file.name, size: file.size, type: file.type },
      sections: meta.sections,
      raw: meta.raw,
    };
    downloadText(JSON.stringify(payload, null, 2), `${file.name}-metadata.json`, "application/json");
  }, [meta, file]);

  const exportTxt = useCallback(() => {
    if (!meta || !file) return;
    const content = `Image Metadata — ${file.name}\nExtracted by ToolNest AI\n\n${metaToText(meta.sections)}`;
    downloadText(content, `${file.name}-metadata.txt`, "text/plain");
  }, [meta, file]);

  // ── Reusable section card ─────────────────────────────────────────────────
  const SectionCard = ({ section }: { section: MetaSection }) => {
    const allEmpty = section.rows.every(r => r.value === "—" || r.value === "No GPS data found");
    return (
      <div className="glass-panel rounded-2xl overflow-hidden"
        style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
        {/* Header */}
        <div className="flex items-center gap-2.5 px-5 py-3.5"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.05)", background: "rgba(255,255,255,0.02)" }}>
          <span className="material-symbols-outlined text-[18px]" style={{ color: "#4cd7f6" }}>
            {section.icon}
          </span>
          <span className="text-[13px] font-bold" style={{ color: "#e8dff0" }}>{section.title}</span>
          {allEmpty && (
            <span className="ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-lg"
              style={{ background: "rgba(255,255,255,0.05)", color: "#4d4354" }}>
              Not available
            </span>
          )}
        </div>
        {/* Rows */}
        <div className="px-5 py-2">
          {section.rows.map((row, i) => (
            <div key={i} className="flex items-start gap-3 py-2"
              style={{ borderBottom: i < section.rows.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
              <span className="text-[11px] font-semibold uppercase tracking-wide w-32 shrink-0 pt-0.5"
                style={{ color: "#4d4354" }}>
                {row.label}
              </span>
              {row.link ? (
                <a href={row.link} target="_blank" rel="noopener noreferrer"
                  className="text-[13px] font-medium flex items-center gap-1 transition-opacity hover:opacity-80"
                  style={{ color: "#4cd7f6" }}>
                  <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                  {row.value}
                </a>
              ) : (
                <span className="text-[13px] font-medium break-words flex-1"
                  style={{ color: row.value === "—" || row.value === "No GPS data found" ? "#3d3345" : "#e8dff0" }}>
                  {row.value}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  // ── No image: drop zone ───────────────────────────────────────────────────
  if (!file && !loading) {
    return (
      <div className="mb-12 flex flex-col gap-6">
        <div
          onDrop={onDrop}
          onDragOver={e => { e.preventDefault(); setDropActive(true); }}
          onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropActive(false); }}
          onClick={() => fileInputRef.current?.click()}
          role="button" tabIndex={0} aria-label="Upload an image to view its metadata"
          onKeyDown={e => { if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click(); }}
          className="glass-panel rounded-2xl flex flex-col items-center justify-center gap-4 cursor-pointer transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-[#4cd7f6]"
          style={{
            padding: "60px 40px",
            border: `2px dashed ${dropActive ? "#4cd7f6" : "rgba(255,255,255,0.12)"}`,
            background: dropActive ? "rgba(76,215,246,0.04)" : undefined,
          }}>
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 transition-transform duration-200"
            style={{ background: "rgba(76,215,246,0.1)", transform: dropActive ? "scale(1.08)" : "scale(1)" }}>
            <span className="material-symbols-outlined text-[32px]" style={{ color: "#4cd7f6" }}>
              {dropActive ? "file_download" : "info"}
            </span>
          </div>
          <div className="text-center">
            <p className="font-semibold text-base" style={{ color: "#e8dff0" }}>
              {dropActive ? "Drop image here" : "Drag & drop an image here"}
            </p>
            <p className="text-sm mt-1" style={{ color: "#988d9f" }}>
              or <span style={{ color: "#4cd7f6" }}>click to browse</span>
              {" "}— JPG, PNG, WebP, TIFF, HEIC
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-2 mt-1">
            {["EXIF Data","GPS Location","Camera Info","Dates","Export JSON","Browser-local"].map(tag => (
              <span key={tag} className="px-2.5 py-1 rounded-lg text-[11px] font-semibold"
                style={{ background: "rgba(76,215,246,0.08)", color: "#4cd7f6", border: "1px solid rgba(76,215,246,0.15)" }}>
                {tag}
              </span>
            ))}
          </div>
          <input ref={fileInputRef} type="file"
            accept=".jpg,.jpeg,.png,.webp,.tiff,.tif,.heic"
            className="sr-only"
            onChange={e => { const f = e.target.files?.[0]; if (f) processFile(f); e.target.value = ""; }}
            aria-hidden tabIndex={-1} />
        </div>

        {/* What gets shown */}
        <div className="glass-panel rounded-2xl p-6 flex flex-col gap-4"
          style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
          <p className="text-[12px] font-semibold text-[#988d9f] uppercase tracking-[0.08em]">What you can see</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { icon: "insert_drive_file", label: "File info",    desc: "Name, size, type, dimensions" },
              { icon: "photo_camera",      label: "Camera EXIF",  desc: "Make, model, lens, aperture, ISO" },
              { icon: "image",             label: "Image props",  desc: "DPI, colour space, orientation" },
              { icon: "calendar_today",    label: "Dates",        desc: "Date taken, modified, digitised" },
              { icon: "location_on",       label: "GPS location", desc: "Lat/lng + Google Maps link" },
              { icon: "download",          label: "Export",       desc: "Save as JSON or plain text" },
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
      </div>
    );
  }

  // ── Loading state ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="mb-12 flex items-center justify-center py-32">
        <div className="flex flex-col items-center gap-4">
          <span className="w-10 h-10 border-2 border-[#4cd7f6]/30 border-t-[#4cd7f6] rounded-full animate-spin" />
          <p className="text-[13px] font-semibold" style={{ color: "#988d9f" }}>Reading metadata…</p>
        </div>
      </div>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="mb-12 flex flex-col gap-4">
        <div className="glass-panel rounded-2xl p-6 flex flex-col items-center gap-3 text-center"
          style={{ border: "1px solid rgba(255,100,100,0.2)" }}>
          <span className="material-symbols-outlined text-[28px] text-red-400">error</span>
          <p className="font-semibold" style={{ color: "#ff8080" }}>Could not read file</p>
          <p className="text-[12px]" style={{ color: "#5a4d63" }}>{error}</p>
          <button onClick={clear} className="btn-primary px-6 py-2.5 rounded-xl font-semibold text-sm mt-2">
            Try Another File
          </button>
        </div>
      </div>
    );
  }

  // ── Results ───────────────────────────────────────────────────────────────
  if (!meta) return null;

  return (
    <div className="mb-12 flex flex-col gap-4">

      {/* Top bar */}
      <div className="glass-panel rounded-2xl px-4 py-3 flex items-center gap-3 flex-wrap"
        style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
        {/* Thumbnail */}
        {imgUrl && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={imgUrl} alt={file?.name}
            className="w-10 h-10 rounded-xl object-cover border border-white/10 shrink-0"
            draggable={false} />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold truncate" style={{ color: "#e8dff0" }}>{file?.name}</p>
          <p className="text-[11px]" style={{ color: "#5a4d63" }}>
            {fmtSize(file?.size ?? 0)}
            {meta.hasExif ? " · EXIF data found" : " · No EXIF data"}
            {meta.hasGps ? " · GPS available" : ""}
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <button onClick={copyAll} aria-label="Copy all metadata to clipboard"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold transition-all"
            style={{
              background: copied ? "rgba(100,220,150,0.12)" : "rgba(76,215,246,0.08)",
              color:      copied ? "#80e0a0"               : "#4cd7f6",
              border:     `1px solid ${copied ? "rgba(100,220,150,0.3)" : "rgba(76,215,246,0.2)"}`,
            }}>
            <span className="material-symbols-outlined text-[14px]">
              {copied ? "check" : "content_copy"}
            </span>
            {copied ? "Copied!" : "Copy All"}
          </button>

          <button onClick={exportJson} aria-label="Export metadata as JSON"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold transition-all"
            style={{ background: "rgba(255,255,255,0.05)", color: "#988d9f", border: "1px solid rgba(255,255,255,0.08)" }}>
            <span className="material-symbols-outlined text-[14px]">data_object</span>
            JSON
          </button>

          <button onClick={exportTxt} aria-label="Export metadata as TXT"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold transition-all"
            style={{ background: "rgba(255,255,255,0.05)", color: "#988d9f", border: "1px solid rgba(255,255,255,0.08)" }}>
            <span className="material-symbols-outlined text-[14px]">description</span>
            TXT
          </button>

          <button onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold transition-all"
            style={{ background: "rgba(76,215,246,0.08)", color: "#4cd7f6", border: "1px solid rgba(76,215,246,0.2)" }}>
            <span className="material-symbols-outlined text-[14px]">upload_file</span>
            New Image
          </button>

          <button onClick={clear}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold transition-all"
            style={{ background: "rgba(255,80,80,0.08)", color: "#ff8080", border: "1px solid rgba(255,80,80,0.15)" }}>
            <span className="material-symbols-outlined text-[14px]">close</span>
            Clear
          </button>
        </div>
      </div>

      {/* No EXIF banner */}
      {!meta.hasExif && (
        <div className="flex items-start gap-3 p-4 rounded-2xl"
          style={{ background: "rgba(255,185,0,0.07)", border: "1px solid rgba(255,185,0,0.2)" }}>
          <span className="material-symbols-outlined text-[18px] text-yellow-400 mt-0.5 shrink-0">info</span>
          <div>
            <p className="text-[13px] font-semibold" style={{ color: "#f5c542" }}>No EXIF camera data found</p>
            <p className="text-[12px] mt-0.5" style={{ color: "#7a6a40" }}>
              This file may be a PNG, screenshot, or edited image with EXIF stripped. Basic file info is shown below.
            </p>
          </div>
        </div>
      )}

      {/* Two-column layout for larger screens */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {meta.sections.map((section, i) => (
          <SectionCard key={i} section={section} />
        ))}
      </div>

      {/* GPS map embed hint */}
      {meta.hasGps && meta.gpsLat !== undefined && meta.gpsLng !== undefined && (
        <div className="glass-panel rounded-2xl p-4 flex items-center gap-4"
          style={{ border: "1px solid rgba(76,215,246,0.15)", background: "rgba(76,215,246,0.03)" }}>
          <span className="material-symbols-outlined text-[22px]" style={{ color: "#4cd7f6" }}>location_on</span>
          <div className="flex-1">
            <p className="text-[13px] font-semibold" style={{ color: "#e8dff0" }}>
              GPS: {meta.gpsLat.toFixed(5)}°, {meta.gpsLng.toFixed(5)}°
            </p>
            <p className="text-[11px]" style={{ color: "#5a4d63" }}>Photo location embedded in EXIF</p>
          </div>
          <a href={`https://www.google.com/maps?q=${meta.gpsLat},${meta.gpsLng}`}
            target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12px] font-semibold transition-all"
            style={{ background: "rgba(76,215,246,0.12)", color: "#4cd7f6", border: "1px solid rgba(76,215,246,0.25)" }}>
            <span className="material-symbols-outlined text-[14px]">open_in_new</span>
            View on Maps
          </a>
        </div>
      )}

      {/* Hidden file input */}
      <input ref={fileInputRef} type="file"
        accept=".jpg,.jpeg,.png,.webp,.tiff,.tif,.heic"
        className="sr-only"
        onChange={e => { const f = e.target.files?.[0]; if (f) processFile(f); e.target.value = ""; }}
        aria-hidden tabIndex={-1} />
    </div>
  );
}
