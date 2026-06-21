"use client";

/**
 * Unlock PDF — browser-local password removal
 *
 * Strategy: pdfjs-dist opens the encrypted PDF with the supplied password
 * (supports RC4-40, RC4-128, AES-128, AES-256). Each page is rendered to
 * a high-resolution canvas (2× scale), then embedded as a PNG image into a
 * new pdf-lib document that has no encryption. The result is a clean,
 * shareable PDF without any password or security restrictions.
 */

import { useState, useRef, useCallback } from "react";

const DPR = 2; // render scale for crisp output

function fmt(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1_048_576) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1_048_576).toFixed(2)} MB`;
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

export default function UnlockPdfTool() {
  const [dragging, setDragging]         = useState(false);
  const [pdfFile, setPdfFile]           = useState<File | null>(null);
  const [pageCount, setPageCount]       = useState(0);
  const [encrypted, setEncrypted]       = useState(false);
  const [loading, setLoading]           = useState(false);
  const [processing, setProcessing]     = useState(false);
  const [progress, setProgress]         = useState(0);   // 0–100 during render
  const [done, setDone]                 = useState(false);
  const [resultSize, setResultSize]     = useState(0);
  const [password, setPassword]         = useState("");
  const [showPw, setShowPw]             = useState(false);
  const [notif, setNotif]               = useState<Notif | null>(null);
  const [resultBytes, setResultBytes]   = useState<Uint8Array | null>(null);
  const [resultFilename, setResultFilename] = useState("");

  const inputRef = useRef<HTMLInputElement>(null);
  const dropRef  = useRef<HTMLDivElement>(null);

  const notify = useCallback((type: NotifType, msg: string) => {
    setNotif({ type, msg });
    setTimeout(() => setNotif(null), 9000);
  }, []);

  // ── File ingestion ──────────────────────────────────────────────────────────

  const handleFile = useCallback(async (f: File) => {
    if (f.type !== "application/pdf" && !f.name.toLowerCase().endsWith(".pdf")) {
      notify("error", `"${f.name}" is not a PDF.`); return;
    }
    if (f.size > 200 * 1024 * 1024) {
      notify("error", `File exceeds 200 MB (${fmt(f.size)}).`); return;
    }
    setLoading(true); setDone(false); setNotif(null); setPassword("");
    setResultBytes(null); setResultFilename("");

    try {
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
      const buf = await f.arrayBuffer();

      let isEncrypted = false;
      let pages = 0;

      try {
        const docTask = pdfjs.getDocument({ data: new Uint8Array(buf) });
        const doc     = await docTask.promise;
        pages         = doc.numPages;
      } catch (err: unknown) {
        const e = err as { name?: string };
        if (e?.name === "PasswordException") {
          isEncrypted = true;
        } else {
          notify("error", "Could not read the PDF. It may be corrupted or use an unsupported format.");
          setLoading(false);
          return;
        }
      }

      setEncrypted(isEncrypted);
      setPageCount(pages);
      setPdfFile(f);
    } finally {
      setLoading(false);
    }
  }, [notify]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const f = e.dataTransfer.files[0]; if (f) handleFile(f);
  }, [handleFile]);

  // ── Unlock ──────────────────────────────────────────────────────────────────

  const doUnlock = useCallback(async (pw: string): Promise<{ bytes: Uint8Array; filename: string }> => {
    if (!pdfFile) throw new Error("No file selected.");

    const pdfjs = await import("pdfjs-dist");
    pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

    const rawBuf = await pdfFile.arrayBuffer();

    // Open with password — throws PasswordException on wrong password
    let srcDoc;
    try {
      const task = pdfjs.getDocument({
        data:     new Uint8Array(rawBuf),
        password: pw,
      });
      srcDoc = await task.promise;
    } catch (err: unknown) {
      const e = err as { name?: string; code?: number };
      if (e?.name === "PasswordException") {
        // code 1 = password required, code 2 = wrong password
        if (e.code === 2) throw new Error("WRONG_PASSWORD");
        throw new Error("PASSWORD_REQUIRED");
      }
      throw err;
    }

    const numPages = srcDoc.numPages;
    setPageCount(numPages);

    const { PDFDocument } = await import("pdf-lib");
    const outDoc = await PDFDocument.create();

    // Render each page to canvas and embed as PNG
    for (let i = 1; i <= numPages; i++) {
      const page     = await srcDoc.getPage(i);
      const vp       = page.getViewport({ scale: DPR });

      const canvas      = document.createElement("canvas");
      canvas.width      = Math.round(vp.width);
      canvas.height     = Math.round(vp.height);
      const ctx         = canvas.getContext("2d")!;

      await page.render({ canvasContext: ctx, viewport: vp, canvas }).promise;

      const pngDataUrl = canvas.toDataURL("image/png");
      const base64     = pngDataUrl.split(",")[1];
      const pngBytes   = Uint8Array.from(atob(base64), c => c.charCodeAt(0));

      const pngImage   = await outDoc.embedPng(pngBytes);
      // Page dims in points (1 pt = 1/72 in); original viewport is at DPR×
      const w = vp.width  / DPR;
      const h = vp.height / DPR;
      const outPage = outDoc.addPage([w, h]);
      outPage.drawImage(pngImage, { x: 0, y: 0, width: w, height: h });

      setProgress(Math.round((i / numPages) * 100));
    }

    const bytes    = await outDoc.save();
    const filename = pdfFile.name.replace(/\.pdf$/i, "") + "_unlocked.pdf";
    return { bytes, filename };
  }, [pdfFile]);

  const handleUnlock = useCallback(async () => {
    if (!pdfFile) return;
    setProcessing(true); setProgress(0); setNotif(null);

    try {
      const { bytes, filename } = await doUnlock(password);
      downloadPdf(bytes, filename);
      setResultBytes(bytes);
      setResultFilename(filename);
      setResultSize(bytes.byteLength);
      setDone(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg === "WRONG_PASSWORD") {
        notify("error", "Incorrect password. Please check your password and try again.");
      } else if (msg === "PASSWORD_REQUIRED") {
        notify("error", "This PDF requires a password. Please enter the password to unlock it.");
      } else {
        notify("error", `Could not unlock the PDF: ${msg}`);
      }
    } finally {
      setProcessing(false); setProgress(0);
    }
  }, [pdfFile, password, doUnlock, notify]);

  const handleDownloadAgain = useCallback(() => {
    if (resultBytes && resultFilename) downloadPdf(resultBytes, resultFilename);
  }, [resultBytes, resultFilename]);

  const handleReset = useCallback(() => {
    setPdfFile(null); setPageCount(0); setEncrypted(false);
    setDone(false); setNotif(null); setPassword(""); setShowPw(false);
    setResultBytes(null); setResultFilename(""); setProgress(0);
    if (inputRef.current) inputRef.current.value = "";
  }, []);

  // ── Render ──────────────────────────────────────────────────────────────────

  const canUnlock = !!pdfFile && (!encrypted || password.length > 0);

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
              {dragging ? "file_download" : "lock_open"}
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
            {["Password removal", "All encryption types", "Browser-local", "Large files", "Free"].map(f => (
              <span key={f} className="px-2.5 py-1 rounded-lg text-[11px] font-semibold"
                style={{ background: "rgba(255,180,171,0.08)", color: "#ffb4ab", border: "1px solid rgba(255,180,171,0.15)" }}>{f}</span>
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
          <p className="text-[15px] font-bold text-[#e2e2e2]">Checking PDF…</p>
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
      {pdfFile && !loading && !done && (
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
                  {fmt(pdfFile.size)}{pageCount > 0 ? ` · ${pageCount} page${pageCount !== 1 ? "s" : ""}` : ""}
                </p>
                {encrypted ? (
                  <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{ background: "rgba(250,204,21,0.12)", color: "#facc15", border: "1px solid rgba(250,204,21,0.25)" }}>
                    <span className="material-symbols-outlined text-[11px]">lock</span>Password protected
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{ background: "rgba(74,222,128,0.1)", color: "#4ade80", border: "1px solid rgba(74,222,128,0.2)" }}>
                    <span className="material-symbols-outlined text-[11px]">lock_open</span>Not encrypted
                  </span>
                )}
              </div>
            </div>
            <button onClick={handleReset} aria-label="Remove file"
              className="w-8 h-8 rounded-lg flex items-center justify-center opacity-50 hover:opacity-100 transition-opacity"
              style={{ background: "rgba(255,255,255,0.05)" }}>
              <span className="material-symbols-outlined text-[16px] text-[#988d9f]">close</span>
            </button>
          </div>

          {/* Not encrypted notice */}
          {!encrypted && (
            <div className="flex items-start gap-3 px-4 py-3.5 rounded-xl"
              style={{ background: "rgba(76,215,246,0.07)", border: "1px solid rgba(76,215,246,0.18)", color: "#4cd7f6" }}>
              <span className="material-symbols-outlined text-[18px] flex-shrink-0 mt-0.5">info</span>
              <p className="text-[13px] font-medium leading-relaxed">
                This PDF does not appear to require a password to open. You can still click <strong>Unlock PDF</strong> to
                produce a clean copy with all owner restrictions removed.
              </p>
            </div>
          )}

          {/* Password + action panel */}
          <div className="glass-panel rounded-2xl p-5 flex flex-col gap-5">

            {/* Security notice */}
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl"
              style={{ background: "rgba(250,204,21,0.07)", border: "1px solid rgba(250,204,21,0.18)" }}>
              <span className="material-symbols-outlined text-[20px] text-[#facc15]">shield</span>
              <div>
                <p className="text-[13px] font-bold text-[#facc15]">Only unlock PDFs you own</p>
                <p className="text-[11px] text-[#5a4d63]">Only use this tool on PDFs you own or are authorised to decrypt.</p>
              </div>
            </div>

            {/* Password input */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="unlock-pw"
                className="text-[11px] font-semibold uppercase tracking-wide"
                style={{ color: "#988d9f" }}>
                PDF Password
                {encrypted && (
                  <span className="ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded"
                    style={{ background: "rgba(255,107,107,0.15)", color: "#ff6b6b" }}>REQUIRED</span>
                )}
              </label>
              <div className="relative">
                <input
                  id="unlock-pw"
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && canUnlock && !processing) handleUnlock(); }}
                  placeholder={encrypted ? "Enter the PDF password" : "Leave blank if no password"}
                  autoComplete="current-password"
                  className="w-full pl-3 pr-10 py-2.5 rounded-lg text-[13px] font-medium outline-none focus-visible:ring-2 focus-visible:ring-[#ffb4ab]"
                  style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#e2e2e2" }}
                  aria-required={encrypted}
                />
                <button type="button" onClick={() => setShowPw(s => !s)}
                  aria-label={showPw ? "Hide password" : "Show password"}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 opacity-50 hover:opacity-100 transition-opacity">
                  <span className="material-symbols-outlined text-[18px] text-[#988d9f]">
                    {showPw ? "visibility_off" : "visibility"}
                  </span>
                </button>
              </div>
              <p className="text-[11px] text-[#5a4d63]">
                {encrypted
                  ? "The password is required to open this PDF. It will not be stored or transmitted."
                  : "This PDF has no open password, but may have owner restrictions that will be cleared."}
              </p>
            </div>

            {/* Progress bar */}
            {processing && (
              <div className="flex flex-col gap-2" aria-live="polite" aria-busy="true">
                <div className="flex justify-between items-center">
                  <p className="text-[12px] font-semibold text-[#988d9f]">
                    {progress === 0 ? "Starting…" : `Rendering page ${Math.round(progress * (pageCount || 1) / 100)} of ${pageCount}…`}
                  </p>
                  <p className="text-[12px] font-bold text-[#ffb4ab]">{progress}%</p>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
                  <div className="h-full rounded-full transition-all duration-300"
                    style={{ width: `${progress}%`, background: "linear-gradient(90deg,#ffb4ab,#ff8a80)" }} />
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-col gap-3">
              <button
                onClick={handleUnlock}
                disabled={processing || !canUnlock}
                className="btn-primary w-full text-white font-bold text-[15px] py-3.5 rounded-xl flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed">
                {processing ? (
                  <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Unlocking…</>
                ) : (
                  <><span className="material-symbols-outlined text-[17px]">lock_open</span>Unlock PDF</>
                )}
              </button>
              <button onClick={handleReset} disabled={processing}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-semibold text-[#988d9f] hover:text-[#e2e2e2] transition-all disabled:opacity-40"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <span className="material-symbols-outlined text-[15px]">restart_alt</span>Reset
              </button>
            </div>
          </div>

          {/* How it works */}
          <div className="glass-panel rounded-2xl p-5 flex flex-col gap-3">
            <p className="text-[12px] font-semibold text-[#988d9f] uppercase tracking-[0.08em]">How unlocking works</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { icon: "password",  title: "Enter password", desc: "Supply the PDF's password to decrypt the file. RC4 and AES encryption are both supported." },
                { icon: "key",       title: "Decrypt locally", desc: "The PDF is opened and each page rendered entirely in your browser — nothing is uploaded." },
                { icon: "download",  title: "Download clean copy", desc: "A new PDF without any password protection downloads automatically." },
              ].map(({ icon, title, desc }) => (
                <div key={title} className="flex flex-col gap-2 p-4 rounded-xl"
                  style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
                  <span className="material-symbols-outlined text-[22px] text-[#ffb4ab]">{icon}</span>
                  <p className="text-[13px] font-bold text-[#e2e2e2]">{title}</p>
                  <p className="text-[12px] text-[#5a4d63] leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Done state */}
      {done && (
        <div className="flex flex-col gap-4">
          <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))" }}>
            {[
              { icon: "lock_open",   label: "Protection", value: "Removed",         color: "#ffb4ab" },
              { icon: "description", label: "Pages",      value: String(pageCount), color: "#4cd7f6" },
              { icon: "download",    label: "File size",  value: fmt(resultSize),   color: "#4ade80" },
            ].map(({ icon, label, value, color }) => (
              <div key={label} className="flex flex-col gap-1.5 rounded-xl p-4"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <span className="material-symbols-outlined text-[18px]" style={{ color }}>{icon}</span>
                <p className="text-[20px] font-extrabold leading-none" style={{ color }}>{value}</p>
                <p className="text-[11px] text-[#988d9f] font-semibold uppercase tracking-wide">{label}</p>
              </div>
            ))}
          </div>

          <div className="glass-panel rounded-2xl overflow-hidden">
            <div className="flex items-center gap-4 px-5 py-4 border-b border-[rgba(255,255,255,0.06)]">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.25)" }}>
                <span className="material-symbols-outlined text-[22px] text-[#22c55e]">check_circle</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-bold text-[#e2e2e2]">PDF unlocked — password protection removed</p>
                <p className="text-[12px] text-[#988d9f]">Downloaded automatically · no password needed to open</p>
              </div>
            </div>
            <div className="p-5 flex flex-col sm:flex-row gap-3">
              <button onClick={handleDownloadAgain}
                className="btn-primary flex-1 text-white font-bold text-[15px] py-3.5 rounded-xl flex items-center justify-center gap-2">
                <span className="material-symbols-outlined text-[18px]">download</span>Download Again
              </button>
              <button onClick={handleReset}
                className="flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl text-[14px] font-semibold text-[#988d9f] hover:text-[#e2e2e2] transition-all"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <span className="material-symbols-outlined text-[16px]">upload_file</span>Unlock Another PDF
              </button>
            </div>
          </div>

          <div className="flex items-start gap-3 px-4 py-3.5 rounded-xl text-[13px]"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", color: "#5a4d63" }}>
            <span className="material-symbols-outlined text-[16px] mt-0.5 flex-shrink-0">info</span>
            <span>The unlocked PDF was generated entirely in your browser. No files were uploaded to any server. The original file is unchanged on your device.</span>
          </div>
        </div>
      )}

      {/* How it works (drop zone state) */}
      {!pdfFile && !loading && (
        <div className="glass-panel rounded-2xl p-6 flex flex-col gap-3">
          <p className="text-[12px] font-semibold text-[#988d9f] uppercase tracking-[0.08em]">How it works</p>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            {[
              { icon: "upload_file",  label: "1. Upload",         desc: "Drop your protected PDF — it stays in your browser" },
              { icon: "password",     label: "2. Enter password",  desc: "Type the correct password used to lock the file" },
              { icon: "lock_open",    label: "3. Unlock",          desc: "Each page is decrypted and rendered locally" },
              { icon: "download",     label: "4. Download",        desc: "Save the clean, unprotected PDF to your device" },
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
