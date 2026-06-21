"use client";

import { useState, useRef, useCallback } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface MetaFields {
  title:        string;
  author:       string;
  subject:      string;
  keywords:     string;
  creator:      string;
  producer:     string;
  creationDate: string; // ISO string or empty
  modDate:      string; // ISO string or empty
}

const EMPTY_META: MetaFields = {
  title: "", author: "", subject: "", keywords: "",
  creator: "", producer: "", creationDate: "", modDate: "",
};

const FIELD_LABELS: { key: keyof MetaFields; label: string; icon: string; editable: boolean; placeholder: string }[] = [
  { key: "title",        label: "Title",             icon: "title",        editable: true,  placeholder: "Document title" },
  { key: "author",       label: "Author",            icon: "person",       editable: true,  placeholder: "Author name" },
  { key: "subject",      label: "Subject",           icon: "subject",      editable: true,  placeholder: "Document subject" },
  { key: "keywords",     label: "Keywords",          icon: "label",        editable: true,  placeholder: "keyword1, keyword2, …" },
  { key: "creator",      label: "Creator",           icon: "edit",         editable: true,  placeholder: "Creating application" },
  { key: "producer",     label: "Producer",          icon: "settings",     editable: true,  placeholder: "PDF producer" },
  { key: "creationDate", label: "Creation Date",     icon: "calendar_today", editable: true, placeholder: "YYYY-MM-DDTHH:MM" },
  { key: "modDate",      label: "Modified Date",     icon: "update",       editable: true,  placeholder: "YYYY-MM-DDTHH:MM" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1_048_576) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1_048_576).toFixed(2)} MB`;
}

function fmtDate(d: Date | undefined): string {
  if (!d || isNaN(d.getTime())) return "";
  // Format as local datetime-local input value
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function downloadPdf(data: Uint8Array, filename: string) {
  const blob = new Blob([data.buffer as ArrayBuffer], { type: "application/pdf" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

type NotifType = "success" | "error";
interface Notif { type: NotifType; msg: string }

// ── Component ─────────────────────────────────────────────────────────────────

export default function PdfMetadataEditorTool() {
  const [dragging, setDragging]     = useState(false);
  const [pdfFile, setPdfFile]       = useState<File | null>(null);
  const [pageCount, setPageCount]   = useState(0);
  const [loading, setLoading]       = useState(false);
  const [processing, setProcessing] = useState(false);
  const [done, setDone]             = useState(false);
  const [notif, setNotif]           = useState<Notif | null>(null);

  // original values read from the PDF
  const [original, setOriginal]     = useState<MetaFields>(EMPTY_META);
  // current edited values
  const [fields, setFields]         = useState<MetaFields>(EMPTY_META);

  const inputRef = useRef<HTMLInputElement>(null);
  const dropRef  = useRef<HTMLDivElement>(null);

  const notify = useCallback((type: NotifType, msg: string) => {
    setNotif({ type, msg });
    setTimeout(() => setNotif(null), 8000);
  }, []);

  // ── File ingestion ────────────────────────────────────────────────────────

  const handleFile = useCallback(async (f: File) => {
    if (f.type !== "application/pdf" && !f.name.toLowerCase().endsWith(".pdf")) {
      notify("error", `"${f.name}" is not a PDF.`); return;
    }
    if (f.size > 200 * 1024 * 1024) {
      notify("error", `File exceeds 200 MB (${fmt(f.size)}).`); return;
    }
    setLoading(true); setDone(false); setNotif(null);

    try {
      const { PDFDocument } = await import("pdf-lib");
      const buf = await f.arrayBuffer();
      const doc = await PDFDocument.load(buf, { ignoreEncryption: true });

      const meta: MetaFields = {
        title:        doc.getTitle()            ?? "",
        author:       doc.getAuthor()           ?? "",
        subject:      doc.getSubject()          ?? "",
        keywords:     doc.getKeywords()         ?? "",
        creator:      doc.getCreator()          ?? "",
        producer:     doc.getProducer()         ?? "",
        creationDate: fmtDate(doc.getCreationDate()),
        modDate:      fmtDate(doc.getModificationDate()),
      };

      // Count pages via pdfjs for accuracy
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        const pdfjsDoc = await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise;
        setPageCount(pdfjsDoc.numPages);
      } catch {
        setPageCount(doc.getPageCount());
      }

      setOriginal(meta);
      setFields(meta);
      setPdfFile(f);
    } catch (err: unknown) {
      notify("error", err instanceof Error ? err.message : "Could not read the PDF.");
    } finally {
      setLoading(false);
    }
  }, [notify]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const f = e.dataTransfer.files[0]; if (f) handleFile(f);
  }, [handleFile]);

  // ── Field helpers ─────────────────────────────────────────────────────────

  const setField = useCallback(<K extends keyof MetaFields>(k: K, v: string) =>
    setFields(p => ({ ...p, [k]: v })), []);

  const clearField = useCallback((k: keyof MetaFields) =>
    setFields(p => ({ ...p, [k]: "" })), []);

  const removeAll = useCallback(() => setFields(EMPTY_META), []);

  const restoreOriginal = useCallback(() => setFields(original), [original]);

  // dirty check
  const isDirty = (Object.keys(fields) as (keyof MetaFields)[]).some(k => fields[k] !== original[k]);

  // ── Save / Download ───────────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    if (!pdfFile) return;
    setProcessing(true); setNotif(null);

    try {
      const { PDFDocument } = await import("pdf-lib");
      const buf = await pdfFile.arrayBuffer();
      const doc = await PDFDocument.load(buf, { ignoreEncryption: true });

      // Apply each field (empty string → remove the entry)
      fields.title        ? doc.setTitle(fields.title)           : doc.setTitle("");
      fields.author       ? doc.setAuthor(fields.author)         : doc.setAuthor("");
      fields.subject      ? doc.setSubject(fields.subject)       : doc.setSubject("");
      fields.keywords     ? doc.setKeywords([fields.keywords])   : doc.setKeywords([]);
      fields.creator      ? doc.setCreator(fields.creator)       : doc.setCreator("");
      fields.producer     ? doc.setProducer(fields.producer)     : doc.setProducer("");

      if (fields.creationDate) {
        const d = new Date(fields.creationDate);
        if (!isNaN(d.getTime())) doc.setCreationDate(d);
      } else {
        doc.setCreationDate(new Date(0)); // epoch → effectively removes it
      }
      if (fields.modDate) {
        const d = new Date(fields.modDate);
        if (!isNaN(d.getTime())) doc.setModificationDate(d);
      } else {
        doc.setModificationDate(new Date(0));
      }

      const bytes    = await doc.save({ useObjectStreams: false });
      const filename = pdfFile.name.replace(/\.pdf$/i, "") + "_metadata.pdf";
      downloadPdf(bytes, filename);
      setDone(true);
    } catch (err: unknown) {
      notify("error", err instanceof Error ? err.message : "Failed to save metadata.");
    } finally {
      setProcessing(false);
    }
  }, [pdfFile, fields, notify]);

  const handleReset = useCallback(() => {
    setPdfFile(null); setPageCount(0); setDone(false); setNotif(null);
    setOriginal(EMPTY_META); setFields(EMPTY_META);
    if (inputRef.current) inputRef.current.value = "";
  }, []);

  // ── Count non-empty fields ────────────────────────────────────────────────

  const filledOriginal = (Object.values(original) as string[]).filter(Boolean).length;
  const filledEdited   = (Object.values(fields)   as string[]).filter(Boolean).length;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="mb-12 flex flex-col gap-6">

      {/* Drop zone */}
      {!pdfFile && (
        <div ref={dropRef}
          onDrop={onDrop}
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={e => { if (dropRef.current && !dropRef.current.contains(e.relatedTarget as Node)) setDragging(false); }}
          onClick={() => inputRef.current?.click()}
          role="button" tabIndex={0} aria-label="Upload PDF"
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
              {dragging ? "file_download" : "edit_document"}
            </span>
          </div>
          <div className="text-center">
            <p className="text-[18px] font-bold text-[#e2e2e2] mb-1.5">
              {dragging ? "Drop your PDF here" : "Drag & drop your PDF here"}
            </p>
            <p className="text-[14px] text-[#988d9f]">
              or <span className="text-[#ffb4ab] font-semibold">click to browse</span>
              {" — PDF only · up to 200 MB"}
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            {["View metadata", "Edit fields", "Remove all", "Browser-local", "Free"].map(tag => (
              <span key={tag} className="px-2.5 py-1 rounded-lg text-[11px] font-semibold"
                style={{ background: "rgba(255,180,171,0.08)", color: "#ffb4ab", border: "1px solid rgba(255,180,171,0.15)" }}>{tag}</span>
            ))}
          </div>
          <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="sr-only"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
            aria-hidden="true" tabIndex={-1} />
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="glass-panel rounded-2xl p-6 flex items-center gap-3" aria-live="polite" aria-busy="true">
          <span className="w-6 h-6 border-2 border-[#ffb4ab]/30 border-t-[#ffb4ab] rounded-full animate-spin flex-shrink-0" />
          <p className="text-[15px] font-bold text-[#e2e2e2]">Reading PDF metadata…</p>
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

      {/* Editor */}
      {pdfFile && !loading && (
        <div className="flex flex-col gap-5">

          {/* File header */}
          <div className="glass-panel rounded-2xl px-5 py-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: "rgba(255,180,171,0.1)", border: "1px solid rgba(255,180,171,0.2)" }}>
              <span className="material-symbols-outlined text-[18px] text-[#ffb4ab]">picture_as_pdf</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-bold text-[#e2e2e2] truncate">{pdfFile.name}</p>
              <div className="flex items-center gap-2 flex-wrap mt-0.5">
                <p className="text-[11px] text-[#5a4d63]">
                  {fmt(pdfFile.size)} · {pageCount} page{pageCount !== 1 ? "s" : ""}
                </p>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                  style={{ background: "rgba(255,180,171,0.1)", color: "#ffb4ab", border: "1px solid rgba(255,180,171,0.2)" }}>
                  {filledOriginal} field{filledOriginal !== 1 ? "s" : ""} found
                </span>
              </div>
            </div>
            <button onClick={handleReset} aria-label="Remove file"
              className="w-8 h-8 rounded-lg flex items-center justify-center opacity-50 hover:opacity-100 transition-opacity"
              style={{ background: "rgba(255,255,255,0.05)" }}>
              <span className="material-symbols-outlined text-[16px] text-[#988d9f]">close</span>
            </button>
          </div>

          {/* Done banner */}
          {done && (
            <div className="flex items-center gap-3 px-5 py-4 rounded-xl"
              style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.25)" }}>
              <span className="material-symbols-outlined text-[20px] text-[#22c55e]">check_circle</span>
              <div className="flex-1">
                <p className="text-[13px] font-bold text-[#22c55e]">PDF downloaded with updated metadata</p>
                <p className="text-[11px] text-[#988d9f]">Edit more fields or upload another file below.</p>
              </div>
            </div>
          )}

          <div className="flex flex-col lg:flex-row gap-5 items-start">

            {/* Metadata form */}
            <div className="flex-1 min-w-0 glass-panel rounded-2xl p-5 flex flex-col gap-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px] text-[#ffb4ab]">edit_document</span>
                  <p className="text-[13px] font-bold text-[#e2e2e2]">Metadata Fields</p>
                  {isDirty && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={{ background: "rgba(250,204,21,0.12)", color: "#facc15", border: "1px solid rgba(250,204,21,0.25)" }}>
                      Unsaved changes
                    </span>
                  )}
                </div>
                <button onClick={restoreOriginal} disabled={!isDirty}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all disabled:opacity-30"
                  style={{ background: "rgba(255,255,255,0.05)", color: "#988d9f", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <span className="material-symbols-outlined text-[13px]">undo</span>Restore original
                </button>
              </div>

              <div className="flex flex-col gap-3">
                {FIELD_LABELS.map(({ key, label, icon, placeholder }) => {
                  const changed = fields[key] !== original[key];
                  const isDate  = key === "creationDate" || key === "modDate";
                  return (
                    <div key={key} className="flex flex-col gap-1">
                      <div className="flex items-center justify-between">
                        <label htmlFor={`field-${key}`}
                          className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide"
                          style={{ color: changed ? "#facc15" : "#988d9f" }}>
                          <span className="material-symbols-outlined text-[13px]">{icon}</span>
                          {label}
                          {changed && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded ml-1"
                              style={{ background: "rgba(250,204,21,0.12)", color: "#facc15" }}>EDITED</span>
                          )}
                        </label>
                        {fields[key] && (
                          <button onClick={() => clearField(key)}
                            aria-label={`Clear ${label}`}
                            className="flex items-center gap-1 text-[10px] font-semibold opacity-50 hover:opacity-100 transition-opacity"
                            style={{ color: "#ef4444" }}>
                            <span className="material-symbols-outlined text-[12px]">close</span>Clear
                          </button>
                        )}
                      </div>
                      <input
                        id={`field-${key}`}
                        type={isDate ? "datetime-local" : "text"}
                        value={fields[key]}
                        onChange={e => setField(key, e.target.value)}
                        placeholder={placeholder}
                        className="w-full px-3 py-2.5 rounded-lg text-[13px] font-medium outline-none focus-visible:ring-2 focus-visible:ring-[#ffb4ab] transition-all"
                        style={{
                          background: changed ? "rgba(250,204,21,0.05)" : "rgba(255,255,255,0.05)",
                          border: `1px solid ${changed ? "rgba(250,204,21,0.3)" : "rgba(255,255,255,0.08)"}`,
                          color: "#e2e2e2",
                          colorScheme: "dark",
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Sidebar: summary + actions */}
            <div className="w-full lg:w-[280px] flex-shrink-0 flex flex-col gap-4">

              {/* Change summary */}
              <div className="glass-panel rounded-2xl p-5 flex flex-col gap-3">
                <p className="text-[12px] font-bold text-[#ffb4ab] uppercase tracking-wide">Summary</p>
                <div className="flex flex-col gap-2">
                  {[
                    { label: "Fields in original", value: String(filledOriginal), color: "#988d9f" },
                    { label: "Fields after edit",  value: String(filledEdited),   color: "#e2e2e2" },
                    { label: "Fields changed", value: String((Object.keys(fields) as (keyof MetaFields)[]).filter(k => fields[k] !== original[k]).length), color: isDirty ? "#facc15" : "#988d9f" },
                    { label: "Pages",              value: String(pageCount),       color: "#4cd7f6" },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="flex items-center justify-between">
                      <p className="text-[12px] text-[#5a4d63]">{label}</p>
                      <p className="text-[13px] font-bold" style={{ color }}>{value}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="glass-panel rounded-2xl p-5 flex flex-col gap-3">
                <p className="text-[12px] font-bold text-[#ffb4ab] uppercase tracking-wide">Actions</p>

                <button onClick={handleSave} disabled={processing}
                  className="btn-primary w-full text-white font-bold text-[14px] py-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed">
                  {processing ? (
                    <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Saving…</>
                  ) : (
                    <><span className="material-symbols-outlined text-[16px]">download</span>Save &amp; Download</>
                  )}
                </button>

                <button onClick={removeAll} disabled={processing || filledEdited === 0}
                  className="w-full text-[14px] font-semibold py-3 rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-30"
                  style={{ background: "rgba(239,68,68,0.08)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)" }}>
                  <span className="material-symbols-outlined text-[16px]">delete_sweep</span>Remove All Metadata
                </button>

                <button onClick={handleReset} disabled={processing}
                  className="w-full text-[13px] font-semibold py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-30"
                  style={{ background: "rgba(255,255,255,0.04)", color: "#988d9f", border: "1px solid rgba(255,255,255,0.07)" }}>
                  <span className="material-symbols-outlined text-[14px]">upload_file</span>Upload New File
                </button>
              </div>

              {/* Privacy note */}
              <div className="flex items-start gap-2.5 px-4 py-3.5 rounded-xl"
                style={{ background: "rgba(76,215,246,0.06)", border: "1px solid rgba(76,215,246,0.15)" }}>
                <span className="material-symbols-outlined text-[16px] text-[#4cd7f6] mt-0.5 flex-shrink-0">shield</span>
                <p className="text-[11px] leading-relaxed" style={{ color: "#5a4d63" }}>
                  Your PDF never leaves your device. All metadata editing happens entirely in your browser using pdf-lib.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* How it works */}
      {!pdfFile && !loading && (
        <div className="glass-panel rounded-2xl p-6 flex flex-col gap-3">
          <p className="text-[12px] font-semibold text-[#988d9f] uppercase tracking-[0.08em]">How it works</p>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            {[
              { icon: "upload_file",    label: "1. Upload",  desc: "Drop your PDF — it stays in your browser" },
              { icon: "info",           label: "2. View",    desc: "All embedded metadata is read and displayed" },
              { icon: "edit_document",  label: "3. Edit",    desc: "Update any field or clear metadata in one click" },
              { icon: "download",       label: "4. Download", desc: "Save the PDF with your updated metadata" },
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
