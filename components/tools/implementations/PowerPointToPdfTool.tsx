"use client";

/**
 * PowerPoint → PDF conversion (browser-only)
 *
 * Pipeline:
 *  1. JSZip      — unpacks the PPTX archive (PPTX is a ZIP of XML + media)
 *  2. XML parser — reads ppt/presentation.xml for slide size & order,
 *                  then each ppt/slides/slideN.xml for elements
 *  3. Canvas     — renders every slide at 1280×720 using Canvas 2D:
 *                  background colour, shapes, images, text boxes
 *  4. jsPDF      — assembles canvas frames into a multi-page PDF;
 *                  supports 1 / 2 / 4 / 6 slides per page layouts
 *
 * Supported formats: PPTX (full) · PPT (text/basic shapes via partial XML)
 *
 * Limitations (inherent to browser-only rendering):
 *  • Animations, transitions, and embedded video are omitted.
 *  • Charts, SmartArt, and complex vector shapes are approximated.
 *  • Non-system fonts fall back to sans-serif.
 *  • Old binary .PPT: JSZip may not fully unpack — text extraction
 *    degrades gracefully and the user is warned.
 */

import { useState, useRef, useCallback } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface TextRun {
  text: string;
  bold: boolean;
  italic: boolean;
  size: number;    // points
  color: string;  // 6-char hex, no #
}

interface TextPara {
  runs: TextRun[];
  align: "l" | "ctr" | "r" | "just";
}

interface TextBox {
  kind: "text";
  x: number; y: number; w: number; h: number;
  paragraphs: TextPara[];
  fillColor?: string;
  insetL: number; insetR: number; insetT: number; insetB: number;
  anchor: "t" | "ctr" | "b";
  zOrder: number;
}

interface ImageEl {
  kind: "image";
  x: number; y: number; w: number; h: number;
  dataUrl: string;
  zOrder: number;
}

interface ShapeEl {
  kind: "shape";
  x: number; y: number; w: number; h: number;
  fillColor?: string;
  paragraphs?: TextPara[];
  zOrder: number;
}

type SlideEl = TextBox | ImageEl | ShapeEl;

interface Slide {
  width: number;   // EMU
  height: number;  // EMU
  background?: string; // 6-char hex
  elements: SlideEl[];
}

interface ParsedPptx {
  slides: Slide[];
}

type Orientation = "portrait" | "landscape";
type PageSize    = "a4" | "letter";
type SlidesPerPage = 1 | 2 | 4 | 6;

interface PdfOptions {
  orientation: Orientation;
  pageSize: PageSize;
  slidesPerPage: SlidesPerPage;
}

interface ConvertResult {
  filename: string;
  sizeBytes: number;
  slideCount: number;
  pageCount: number;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_FILE_BYTES = 100 * 1024 * 1024; // 100 MB
const ACCEPTED_EXT   = /\.(pptx|ppt)$/i;
const EMU_TO_PX      = 1 / 9525;          // 1 EMU = 1/9525 px at 96 dpi
const CANVAS_W       = 1280;
const CANVAS_H       = 720;

// PDF page sizes in pt [portrait-width, portrait-height]
const PAGE_SIZES: Record<PageSize, [number, number]> = {
  a4:     [595, 842],
  letter: [612, 792],
};
const MARGIN_PT = 28;

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1048576).toFixed(2)} MB`;
}

/**
 * Strip XML namespace prefixes so we can use plain querySelector().
 * r:embed → r_embed, a:off → off, etc.
 */
function parseXml(xmlStr: string): Document {
  const cleaned = xmlStr
    .replace(/\s+xmlns(?::\w+)?="[^"]*"/g, "")    // drop xmlns declarations
    .replace(/<(\/?)\w+:/g, "<$1")                  // strip element prefixes
    .replace(/\s(\w+):(\w+)=/g, " $1_$2=");         // prefix:attr → prefix_attr
  return new DOMParser().parseFromString(cleaned, "text/xml");
}

function attr(el: Element | null, name: string): string | null {
  return el?.getAttribute(name) ?? null;
}

function intAttr(el: Element | null, name: string, def = 0): number {
  const v = attr(el, name);
  return v !== null ? parseInt(v, 10) : def;
}

// ── XML Parsers ───────────────────────────────────────────────────────────────

function parseTextBody(txBody: Element): TextPara[] {
  const paras: TextPara[] = [];
  for (const p of txBody.querySelectorAll("p")) {
    const pPr  = p.querySelector("pPr");
    const algn = (attr(pPr, "algn") ?? "l") as TextPara["align"];

    const runs: TextRun[] = [];
    for (const r of p.querySelectorAll("r")) {
      const t = r.querySelector("t")?.textContent ?? "";
      if (!t) continue;
      const rPr = r.querySelector("rPr");
      const bold   = attr(rPr, "b") === "1";
      const italic = attr(rPr, "i") === "1";
      const szRaw  = attr(rPr, "sz");
      const size   = szRaw ? parseInt(szRaw, 10) / 100 : 18;
      // Colour: try solidFill → srgbClr, else schemeClr → fallback black
      const clr  = rPr?.querySelector("solidFill srgbClr")?.getAttribute("val") ?? "000000";
      runs.push({ text: t, bold, italic, size, color: clr });
    }

    // Inherit default font size from paragraph defaults if runs are empty
    if (runs.length === 0) {
      const defSz = attr(p.querySelector("pPr defRPr"), "sz");
      runs.push({ text: "", bold: false, italic: false, size: defSz ? parseInt(defSz) / 100 : 18, color: "000000" });
    }
    paras.push({ runs, align: algn });
  }
  return paras;
}

function parseXfrm(sp: Element): { x: number; y: number; w: number; h: number } | null {
  const xfrm = sp.querySelector("xfrm");
  const off  = xfrm?.querySelector("off");
  const ext  = xfrm?.querySelector("ext");
  if (!off || !ext) return null;
  const x = intAttr(off, "x"); const y = intAttr(off, "y");
  const w = intAttr(ext, "cx"); const h = intAttr(ext, "cy");
  if (w === 0 || h === 0) return null;
  return { x, y, w, h };
}

function parseSolidFill(parent: Element): string | undefined {
  return parent.querySelector("solidFill srgbClr")?.getAttribute("val") ?? undefined;
}

// ── PPTX Parser ───────────────────────────────────────────────────────────────

async function parsePptx(file: File): Promise<ParsedPptx> {
  const JSZip   = (await import("jszip")).default;
  const zip     = await JSZip.loadAsync(await file.arrayBuffer());

  // ── Presentation: slide size + ordered slide rIds ──────────────────────────
  const presXml = await zip.file("ppt/presentation.xml")?.async("string") ?? "";
  const presDoc = parseXml(presXml);

  const sldSz     = presDoc.querySelector("sldSz");
  const slideW    = intAttr(sldSz, "cx", 9144000);
  const slideH    = intAttr(sldSz, "cy", 6858000);

  // Presentation relationships to find slide file paths
  const presRels = await zip.file("ppt/_rels/presentation.xml.rels")?.async("string") ?? "";
  const presRelsDoc = parseXml(presRels);
  const relMap   = new Map<string, string>();
  for (const rel of presRelsDoc.querySelectorAll("Relationship")) {
    relMap.set(attr(rel, "Id") ?? "", attr(rel, "Target") ?? "");
  }

  // Slide IDs in presentation order (r_id after NS strip of r:id → r_id)
  const sldIds: string[] = [];
  for (const sldId of presDoc.querySelectorAll("sldIdLst sldId")) {
    const rId = attr(sldId, "r_id");
    if (rId && relMap.has(rId)) {
      const target = relMap.get(rId)!.replace(/^\.\.\//g, "");
      sldIds.push("ppt/" + target);
    }
  }

  // ── Parse each slide ───────────────────────────────────────────────────────
  const slides: Slide[] = [];

  for (let si = 0; si < sldIds.length; si++) {
    const slidePath = sldIds[si];
    const slideXml  = await zip.file(slidePath)?.async("string");
    if (!slideXml) continue;

    // Slide relationships (for embedded images)
    const slideDir  = slidePath.slice(0, slidePath.lastIndexOf("/"));
    const slideName = slidePath.slice(slidePath.lastIndexOf("/") + 1);
    const relsPath  = `${slideDir}/_rels/${slideName}.rels`;
    const relsXml   = await zip.file(relsPath)?.async("string") ?? "<Relationships/>";
    const relsDoc   = parseXml(relsXml);

    // Build rId → media data URL map
    const imgMap = new Map<string, string>();
    for (const rel of relsDoc.querySelectorAll("Relationship")) {
      const type   = attr(rel, "Type") ?? "";
      const rId    = attr(rel, "Id")   ?? "";
      const target = attr(rel, "Target") ?? "";
      if (!type.includes("image")) continue;
      // Resolve relative path: ../media/imageN.xxx → ppt/media/imageN.xxx
      const mediaPath = target.startsWith("../")
        ? "ppt/" + target.slice(3)
        : slideDir + "/" + target;
      const imgBytes  = await zip.file(mediaPath)?.async("base64");
      if (!imgBytes) continue;
      const ext  = mediaPath.split(".").pop()?.toLowerCase() ?? "png";
      const mime = ext === "jpg" || ext === "jpeg" ? "image/jpeg"
                 : ext === "gif" ? "image/gif"
                 : ext === "svg" ? "image/svg+xml"
                 : "image/png";
      imgMap.set(rId, `data:${mime};base64,${imgBytes}`);
    }

    slides.push(parseSlide(slideXml, slideW, slideH, imgMap));
  }

  return { slides };
}

function parseSlide(
  xmlStr: string,
  slideW: number,
  slideH: number,
  imgMap: Map<string, string>
): Slide {
  const doc = parseXml(xmlStr);

  // Background colour
  let background: string | undefined;
  const bgSolidFill = doc.querySelector("bg solidFill srgbClr");
  if (bgSolidFill) background = attr(bgSolidFill, "val") ?? undefined;

  const elements: SlideEl[] = [];
  let z = 0;

  const spTree = doc.querySelector("spTree");
  if (!spTree) return { width: slideW, height: slideH, background, elements };

  for (const child of Array.from(spTree.children)) {
    const tag = child.tagName;

    if (tag === "sp") {
      // Text box or shape with optional text
      const dims = parseXfrm(child);
      if (!dims) { z++; continue; }

      const spPr    = child.querySelector("spPr");
      const fillClr = parseSolidFill(spPr ?? child);
      const txBody  = child.querySelector("txBody");

      if (txBody) {
        const bodyPr  = txBody.querySelector("bodyPr");
        elements.push({
          kind:      "text",
          ...dims,
          paragraphs: parseTextBody(txBody),
          fillColor:  fillClr,
          insetL: intAttr(bodyPr, "lIns", 91440),
          insetR: intAttr(bodyPr, "rIns", 91440),
          insetT: intAttr(bodyPr, "tIns", 45720),
          insetB: intAttr(bodyPr, "bIns", 45720),
          anchor: (attr(bodyPr, "anchor") ?? "t") as TextBox["anchor"],
          zOrder: z++,
        });
      } else {
        elements.push({ kind: "shape", ...dims, fillColor: fillClr, zOrder: z++ });
      }
    } else if (tag === "pic") {
      // Picture
      const dims  = parseXfrm(child);
      if (!dims) { z++; continue; }
      const rId   = child.querySelector("blip")?.getAttribute("r_embed") ?? "";
      const dataUrl = imgMap.get(rId);
      if (dataUrl) {
        elements.push({ kind: "image", ...dims, dataUrl, zOrder: z++ });
      }
      z++;
    } else {
      z++;
    }
  }

  return { width: slideW, height: slideH, background, elements };
}

// ── Canvas renderer ───────────────────────────────────────────────────────────

async function renderSlide(slide: Slide): Promise<string> {
  const canvas = document.createElement("canvas");
  canvas.width  = CANVAS_W;
  canvas.height = CANVAS_H;
  const ctx = canvas.getContext("2d")!;

  const sx = CANVAS_W / (slide.width  * EMU_TO_PX);
  const sy = CANVAS_H / (slide.height * EMU_TO_PX);

  // Background
  ctx.fillStyle = slide.background ? `#${slide.background}` : "#ffffff";
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // Preload images
  const imgEls = new Map<string, HTMLImageElement>();
  for (const el of slide.elements) {
    if (el.kind === "image") {
      const img = new Image();
      img.src   = el.dataUrl;
      await new Promise<void>((resolve) => { img.onload = img.onerror = () => resolve(); });
      imgEls.set(el.dataUrl, img);
    }
  }

  // Sort by z-order
  const sorted = [...slide.elements].sort((a, b) => a.zOrder - b.zOrder);

  for (const el of sorted) {
    const ex = el.x * EMU_TO_PX * sx;
    const ey = el.y * EMU_TO_PX * sy;
    const ew = el.w * EMU_TO_PX * sx;
    const eh = el.h * EMU_TO_PX * sy;

    if (el.kind === "image") {
      const img = imgEls.get(el.dataUrl);
      if (img?.complete) ctx.drawImage(img, ex, ey, ew, eh);
    } else if (el.kind === "shape") {
      if (el.fillColor) {
        ctx.fillStyle = `#${el.fillColor}`;
        ctx.fillRect(ex, ey, ew, eh);
      }
    } else if (el.kind === "text") {
      if (el.fillColor) {
        ctx.fillStyle = `#${el.fillColor}`;
        ctx.fillRect(ex, ey, ew, eh);
      }
      const il = el.insetL * EMU_TO_PX * sx;
      const ir = el.insetR * EMU_TO_PX * sx;
      const it = el.insetT * EMU_TO_PX * sy;
      const ib = el.insetB * EMU_TO_PX * sy;
      drawText(ctx, el.paragraphs, ex, ey, ew, eh, il, ir, it, ib, el.anchor, sx, sy);
    }
  }

  return canvas.toDataURL("image/jpeg", 0.88);
}

/**
 * Draw wrapped, aligned text into a box.
 * Supports multi-paragraph, per-run font/color, horizontal & vertical align.
 */
function drawText(
  ctx: CanvasRenderingContext2D,
  paragraphs: TextPara[],
  bx: number, by: number, bw: number, bh: number,
  il: number, ir: number, it: number, ib: number,
  anchor: "t" | "ctr" | "b",
  sx: number, sy: number,
): void {
  if (!paragraphs.length) return;

  const cx  = bx + il;
  const cw  = bw - il - ir;
  if (cw <= 0) return;

  // ── First pass: build display lines ───────────────────────────────────────
  type DisplayLine = {
    spans: { text: string; font: string; color: string; w: number }[];
    lineH: number;
    align: TextPara["align"];
    totalW: number;
  };

  const displayLines: DisplayLine[] = [];

  for (const para of paragraphs) {
    if (!para.runs.length) {
      displayLines.push({ spans: [], lineH: 20 * sy, align: para.align, totalW: 0 });
      continue;
    }

    // Current working line
    let curLine: DisplayLine = { spans: [], lineH: 0, align: para.align, totalW: 0 };

    for (const run of para.runs) {
      if (!run.text) continue;
      const fontSize = Math.max(run.size * sy, 6);
      const font     = `${run.italic ? "italic " : ""}${run.bold ? "bold " : ""}${fontSize}px sans-serif`;
      ctx.font = font;
      const lh = fontSize * 1.3;
      curLine.lineH = Math.max(curLine.lineH, lh);

      // Word-wrap the run text
      const words = run.text.split(/(\s+)/);
      for (const word of words) {
        if (!word) continue;
        const wordW = ctx.measureText(word).width;
        if (curLine.totalW + wordW > cw && curLine.spans.length > 0 && word.trim()) {
          displayLines.push(curLine);
          curLine = { spans: [], lineH: lh, align: para.align, totalW: 0 };
        }
        curLine.spans.push({ text: word, font, color: `#${run.color}`, w: wordW });
        curLine.totalW += wordW;
      }
    }
    if (curLine.spans.length > 0 || para.runs.every((r) => !r.text)) {
      displayLines.push(curLine);
    }
  }

  if (!displayLines.length) return;

  // ── Vertical alignment ─────────────────────────────────────────────────────
  const totalH = displayLines.reduce((s, l) => s + l.lineH, 0);
  let curY: number;
  if      (anchor === "ctr") curY = by + (bh - totalH) / 2;
  else if (anchor === "b")   curY = by + bh - ib - totalH;
  else                       curY = by + it;

  // ── Draw ───────────────────────────────────────────────────────────────────
  for (const line of displayLines) {
    if (curY > by + bh) break;
    const lh = line.lineH;
    const baseline = curY + lh * 0.8;

    let lineStartX = cx;
    if (line.align === "ctr")  lineStartX = cx + (cw - line.totalW) / 2;
    else if (line.align === "r") lineStartX = cx + cw - line.totalW;

    let spanX = lineStartX;
    for (const span of line.spans) {
      ctx.font      = span.font;
      ctx.fillStyle = span.color;
      ctx.fillText(span.text, spanX, baseline, cw);
      spanX += span.w;
    }
    curY += lh;
  }
}

// ── PDF assembler ─────────────────────────────────────────────────────────────

async function buildPdf(
  slideUrls: string[],
  opts: PdfOptions
): Promise<Blob> {
  const { jsPDF } = await import("jspdf");

  const [pw, ph]  = PAGE_SIZES[opts.pageSize];
  const isLand    = opts.orientation === "landscape";
  const pageW     = isLand ? ph : pw;
  const pageH     = isLand ? pw : ph;
  const contentW  = pageW - MARGIN_PT * 2;
  const contentH  = pageH - MARGIN_PT * 2;

  const spp = opts.slidesPerPage;
  // Grid: cols × rows
  const [cols, rows] = spp === 1 ? [1, 1] : spp === 2 ? [1, 2] : spp === 4 ? [2, 2] : [2, 3];
  const cellW = contentW / cols;
  const cellH = contentH / rows;
  const slideAspect = CANVAS_W / CANVAS_H;

  const doc = new jsPDF({
    orientation: opts.orientation,
    unit: "pt",
    format: opts.pageSize,
  });

  let firstPage = true;
  let slideIdx  = 0;

  while (slideIdx < slideUrls.length) {
    if (!firstPage) doc.addPage();
    firstPage = false;

    for (let pos = 0; pos < spp && slideIdx < slideUrls.length; pos++, slideIdx++) {
      const col   = pos % cols;
      const row   = Math.floor(pos / cols);
      const cellX = MARGIN_PT + col * cellW;
      const cellY = MARGIN_PT + row * cellH;

      // Fit slide (maintaining aspect ratio) within cell
      let imgW = cellW;
      let imgH = cellW / slideAspect;
      if (imgH > cellH) { imgH = cellH; imgW = cellH * slideAspect; }
      const imgX = cellX + (cellW - imgW) / 2;
      const imgY = cellY + (cellH - imgH) / 2;

      doc.addImage(slideUrls[slideIdx], "JPEG", imgX, imgY, imgW, imgH);

      // Slide number label for multi-slide layouts
      if (spp > 1) {
        doc.setFontSize(6);
        doc.setTextColor(160, 160, 160);
        doc.text(`Slide ${slideIdx + 1}`, imgX, imgY + imgH + 6);
      }
    }
  }

  return doc.output("blob");
}

// ── Download helper ───────────────────────────────────────────────────────────

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
    <div className="flex flex-col gap-1.5 rounded-xl p-4"
      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
      <span className="material-symbols-outlined text-[18px]" style={{ color }}>{icon}</span>
      <p className="text-[20px] font-extrabold leading-none" style={{ color }}>{value}</p>
      <p className="text-[11px] text-[#988d9f] font-semibold uppercase tracking-wide">{label}</p>
    </div>
  );
}

function Chip({
  label, active, onClick,
}: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-3.5 py-1.5 rounded-lg text-[13px] font-semibold transition-all duration-200"
      style={{
        background: active ? "rgba(255,180,171,0.15)" : "rgba(255,255,255,0.05)",
        color:      active ? "#ffb4ab"                : "#988d9f",
        border:     `1px solid ${active ? "rgba(255,180,171,0.4)" : "rgba(255,255,255,0.08)"}`,
      }}
    >
      {label}
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function PowerPointToPdfTool() {
  const [draggingOver, setDraggingOver] = useState(false);
  const [loaded, setLoaded]             = useState<File | null>(null);
  const [slideCount, setSlideCount]     = useState(0);
  const [converting, setConverting]     = useState(false);
  const [progress, setProgress]         = useState<{ cur: number; total: number } | null>(null);
  const [result, setResult]             = useState<(ConvertResult & { blob: Blob }) | null>(null);
  const [notif, setNotif]               = useState<{ type: "success" | "error" | "warning"; msg: string } | null>(null);

  // Options
  const [orientation, setOrientation]     = useState<Orientation>("landscape");
  const [pageSize, setPageSize]           = useState<PageSize>("a4");
  const [slidesPerPage, setSlidesPerPage] = useState<SlidesPerPage>(1);

  const dropRef  = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const notify = useCallback((type: "success" | "error" | "warning", msg: string) => {
    setNotif({ type, msg });
    setTimeout(() => setNotif(null), 8000);
  }, []);

  // ── File handling ─────────────────────────────────────────────────────────

  const handleFile = useCallback(async (file: File) => {
    if (!ACCEPTED_EXT.test(file.name)) {
      notify("error", `"${file.name}" is not a PowerPoint file. Please upload a PPTX or PPT.`);
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      notify("error", `File exceeds the 100 MB limit (${fmtBytes(file.size)}).`);
      return;
    }

    setLoaded(file);
    setResult(null);
    setNotif(null);
    setSlideCount(0);

    try {
      // Quick scan: just count slides to show in the UI before the user clicks Convert
      const JSZip  = (await import("jszip")).default;
      const zip    = await JSZip.loadAsync(await file.arrayBuffer());
      const sCount = Object.keys(zip.files).filter((f) => /^ppt\/slides\/slide\d+\.xml$/i.test(f)).length;
      setSlideCount(sCount || 1);
    } catch {
      setSlideCount(0);
    }
  }, [notify]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDraggingOver(false);
    const f = e.dataTransfer.files[0]; if (f) handleFile(f);
  }, [handleFile]);

  const onDragOver  = useCallback((e: React.DragEvent) => { e.preventDefault(); setDraggingOver(true); }, []);
  const onDragLeave = useCallback((e: React.DragEvent) => {
    if (dropRef.current && !dropRef.current.contains(e.relatedTarget as Node)) setDraggingOver(false);
  }, []);

  // ── Conversion ────────────────────────────────────────────────────────────

  const handleConvert = useCallback(async () => {
    if (!loaded) return;
    setConverting(true);
    setProgress(null);

    try {
      const { slides } = await parsePptx(loaded);
      if (!slides.length) throw new Error("No slides found. The file may be empty or in an unsupported format.");

      const total = slides.length;
      const slideUrls: string[] = [];

      for (let i = 0; i < total; i++) {
        setProgress({ cur: i + 1, total });
        const url = await renderSlide(slides[i]);
        slideUrls.push(url);
      }

      const blob     = await buildPdf(slideUrls, { orientation, pageSize, slidesPerPage });
      const filename = loaded.name.replace(ACCEPTED_EXT, "") + ".pdf";
      const pgCount  = Math.ceil(total / slidesPerPage);

      setResult({ filename, sizeBytes: blob.size, slideCount: total, pageCount: pgCount, blob });
      notify("success", `Converted ${total} slide${total !== 1 ? "s" : ""} into ${pgCount} PDF page${pgCount !== 1 ? "s" : ""}.`);
    } catch (err) {
      notify("error", err instanceof Error ? err.message : "Conversion failed. Please try another file.");
    } finally {
      setConverting(false);
      setProgress(null);
    }
  }, [loaded, orientation, pageSize, slidesPerPage, notify]);

  const handleDownload = useCallback(() => {
    if (!result) return;
    downloadBlob(result.blob, result.filename);
  }, [result]);

  const handleReset = useCallback(() => {
    setLoaded(null); setResult(null); setNotif(null);
    setSlideCount(0); setProgress(null);
    if (inputRef.current) inputRef.current.value = "";
  }, []);

  const progressPct = progress ? Math.round((progress.cur / progress.total) * 100) : 0;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="mb-12 flex flex-col gap-6">

      {/* ── Drop zone ──────────────────────────────────────────────────────── */}
      {!loaded && !converting && (
        <div
          ref={dropRef}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onClick={() => inputRef.current?.click()}
          role="button" tabIndex={0}
          aria-label="Upload PowerPoint — click or drag and drop"
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
            <span className="material-symbols-outlined text-[38px]" style={{ color: "#ffb4ab" }}>
              {draggingOver ? "file_download" : "slideshow"}
            </span>
          </div>
          <div className="text-center">
            <p className="text-[18px] font-bold text-[#e2e2e2] mb-1.5">
              {draggingOver ? "Drop your presentation here" : "Drag & drop your presentation here"}
            </p>
            <p className="text-[14px] text-[#988d9f]">
              or <span className="text-[#ffb4ab] font-semibold">click to browse</span>
              {" — PPTX & PPT · up to 100 MB"}
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            {["Text preserved", "Images included", "Slide backgrounds", "Multi-layout", "No upload"].map((f) => (
              <span key={f} className="px-2.5 py-1 rounded-lg text-[11px] font-semibold"
                style={{ background: "rgba(255,180,171,0.08)", color: "#ffb4ab", border: "1px solid rgba(255,180,171,0.15)" }}>
                {f}
              </span>
            ))}
          </div>
          <input ref={inputRef} type="file" accept=".pptx,.ppt,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.ms-powerpoint"
            className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
            aria-hidden="true" tabIndex={-1} />
        </div>
      )}

      {/* ── File loaded: options + convert ─────────────────────────────────── */}
      {loaded && !converting && !result && (
        <div className="glass-panel rounded-2xl overflow-hidden flex flex-col gap-0">
          {/* File info */}
          <div className="flex items-center gap-4 px-5 py-4 border-b border-[rgba(255,255,255,0.06)]">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: "rgba(255,180,171,0.1)", border: "1px solid rgba(255,180,171,0.2)" }}>
              <span className="material-symbols-outlined text-[22px] text-[#ffb4ab]">slideshow</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-bold text-[#e2e2e2] truncate">{loaded.name}</p>
              <p className="text-[12px] text-[#988d9f]">
                {fmtBytes(loaded.size)}{slideCount > 0 ? ` · ${slideCount} slide${slideCount !== 1 ? "s" : ""}` : ""}
              </p>
            </div>
            <button onClick={handleReset} aria-label="Remove file"
              className="w-8 h-8 rounded-lg flex items-center justify-center opacity-50 hover:opacity-100 transition-opacity flex-shrink-0"
              style={{ background: "rgba(255,255,255,0.05)" }}>
              <span className="material-symbols-outlined text-[16px] text-[#988d9f]">close</span>
            </button>
          </div>

          {/* Options */}
          <div className="px-5 py-5 flex flex-col gap-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Orientation */}
              <div className="flex flex-col gap-2">
                <p className="text-[11px] font-semibold text-[#988d9f] uppercase tracking-wide">Orientation</p>
                <div className="flex gap-2">
                  <Chip label="Landscape" active={orientation === "landscape"} onClick={() => setOrientation("landscape")} />
                  <Chip label="Portrait"  active={orientation === "portrait"}  onClick={() => setOrientation("portrait")} />
                </div>
              </div>
              {/* Page size */}
              <div className="flex flex-col gap-2">
                <p className="text-[11px] font-semibold text-[#988d9f] uppercase tracking-wide">Page Size</p>
                <div className="flex gap-2">
                  <Chip label="A4"     active={pageSize === "a4"}     onClick={() => setPageSize("a4")} />
                  <Chip label="Letter" active={pageSize === "letter"} onClick={() => setPageSize("letter")} />
                </div>
              </div>
              {/* Slides per page */}
              <div className="flex flex-col gap-2">
                <p className="text-[11px] font-semibold text-[#988d9f] uppercase tracking-wide">Slides per Page</p>
                <div className="flex gap-2 flex-wrap">
                  {([1, 2, 4, 6] as SlidesPerPage[]).map((n) => (
                    <Chip key={n} label={`${n}`} active={slidesPerPage === n} onClick={() => setSlidesPerPage(n)} />
                  ))}
                </div>
              </div>
            </div>

            <button
              onClick={handleConvert}
              className="btn-primary w-full text-white font-bold text-[15px] py-3.5 rounded-xl flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-[18px]">picture_as_pdf</span>
              Convert to PDF
            </button>
          </div>
        </div>
      )}

      {/* ── Conversion progress ─────────────────────────────────────────────── */}
      {converting && (
        <div className="glass-panel rounded-2xl p-6 flex flex-col gap-4" aria-live="polite" aria-busy="true">
          <div className="flex items-center gap-4">
            <span className="w-6 h-6 border-2 border-[#ffb4ab]/30 border-t-[#ffb4ab] rounded-full animate-spin flex-shrink-0" />
            <div className="flex-1">
              <p className="text-[15px] font-bold text-[#e2e2e2]">
                {progress ? `Rendering slide ${progress.cur} of ${progress.total}…` : "Parsing presentation…"}
              </p>
              <p className="text-[12px] text-[#988d9f] mt-0.5">
                {progress ? "Rendering slide content to canvas" : "Reading XML and extracting media"}
              </p>
            </div>
          </div>
          {progress && (
            <div>
              <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}
                role="progressbar" aria-valuenow={progressPct} aria-valuemin={0} aria-valuemax={100}>
                <div className="h-full rounded-full transition-all duration-300" style={{ width: `${progressPct}%`, background: "#ffb4ab" }} />
              </div>
              <p className="text-right text-[11px] text-[#988d9f] mt-1">{progressPct}%</p>
            </div>
          )}
        </div>
      )}

      {/* ── Notification ─────────────────────────────────────────────────────── */}
      {notif && (
        <div role="alert" className="flex items-start gap-3 px-5 py-4 rounded-xl text-[14px] font-medium"
          style={{
            background: notif.type === "success" ? "rgba(34,197,94,0.12)" : notif.type === "warning" ? "rgba(250,204,21,0.10)" : "rgba(239,68,68,0.12)",
            border: `1px solid ${notif.type === "success" ? "rgba(34,197,94,0.3)" : notif.type === "warning" ? "rgba(250,204,21,0.3)" : "rgba(239,68,68,0.3)"}`,
            color: notif.type === "success" ? "#22c55e" : notif.type === "warning" ? "#facc15" : "#ef4444",
          }}>
          <span className="material-symbols-outlined text-[20px] flex-shrink-0 mt-0.5">
            {notif.type === "success" ? "check_circle" : notif.type === "warning" ? "warning" : "error"}
          </span>
          <span className="flex-1 leading-relaxed">{notif.msg}</span>
          <button onClick={() => setNotif(null)} aria-label="Dismiss" className="opacity-60 hover:opacity-100 transition-opacity flex-shrink-0">
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
      )}

      {/* ── Result ──────────────────────────────────────────────────────────── */}
      {result && !converting && (
        <div className="flex flex-col gap-4">
          <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))" }}>
            <StatCard icon="slideshow"    label="Slides"    value={String(result.slideCount)} color="#ffb4ab" />
            <StatCard icon="description"  label="PDF pages" value={String(result.pageCount)}  color="#4cd7f6" />
            <StatCard icon="download"     label="File size" value={fmtBytes(result.sizeBytes)} color="#4ade80" />
          </div>

          <div className="glass-panel rounded-2xl overflow-hidden">
            <div className="flex items-center gap-4 px-5 py-4 border-b border-[rgba(255,255,255,0.06)]">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.25)" }}>
                <span className="material-symbols-outlined text-[22px] text-[#22c55e]">check_circle</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-bold text-[#e2e2e2]">PDF ready</p>
                <p className="text-[12px] text-[#988d9f] truncate">{result.filename}</p>
              </div>
            </div>
            <div className="p-5 flex flex-col sm:flex-row gap-3">
              <button onClick={handleDownload}
                className="btn-primary flex-1 text-white font-bold text-[15px] py-3.5 rounded-xl flex items-center justify-center gap-2">
                <span className="material-symbols-outlined text-[18px]">download</span>
                Download PDF
              </button>
              <button onClick={handleReset}
                className="flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl text-[14px] font-semibold text-[#988d9f] hover:text-[#e2e2e2] transition-all"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <span className="material-symbols-outlined text-[16px]">upload_file</span>
                Upload Another File
              </button>
            </div>
          </div>

          <div className="flex items-start gap-3 px-4 py-3.5 rounded-xl text-[13px]"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", color: "#5a4d63" }}>
            <span className="material-symbols-outlined text-[16px] mt-0.5 flex-shrink-0">info</span>
            <span>
              Text, images, and slide backgrounds are preserved. Animations, transitions, charts, and SmartArt are not rendered.
              Custom fonts fall back to system sans-serif. Everything runs in your browser — your file is never uploaded.
            </span>
          </div>
        </div>
      )}

      {/* ── How it works (idle) ─────────────────────────────────────────────── */}
      {!loaded && !converting && !result && (
        <div className="glass-panel rounded-2xl p-6 flex flex-col gap-3">
          <p className="text-[12px] font-semibold text-[#988d9f] uppercase tracking-[0.08em]">How it works</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { icon: "upload_file",   label: "1. Upload Presentation", desc: "Drag & drop or browse for a PPTX or PPT file" },
              { icon: "tune",          label: "2. Choose Layout",        desc: "Pick orientation, page size, and slides per page" },
              { icon: "picture_as_pdf",label: "3. Download PDF",         desc: "Each slide is rendered and assembled into a clean PDF" },
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
