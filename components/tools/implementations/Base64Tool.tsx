"use client";

import { useState, useRef, useCallback, useEffect, useId } from "react";

// ─── Types ─────────────────────────────────────────────────────────────────────
type Mode     = "encode" | "decode";
type NotifType = "success" | "error" | "info";

// ─── Helpers ───────────────────────────────────────────────────────────────────
function encodeBase64(text: string): string {
  return btoa(unescape(encodeURIComponent(text)));
}

function decodeBase64(b64: string): string {
  return decodeURIComponent(escape(atob(b64)));
}

function isValidBase64(s: string): boolean {
  if (!s) return false;
  const cleaned = s.replace(/\s/g, "");
  if (cleaned.length % 4 !== 0) return false;
  return /^[A-Za-z0-9+/]*={0,2}$/.test(cleaned);
}

function detectMode(text: string): Mode {
  return isValidBase64(text.trim()) ? "decode" : "encode";
}

function byteSize(text: string): number {
  return new Blob([text]).size;
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

function downloadTxt(content: string, filename = "output.txt") {
  const blob = new Blob([content], { type: "text/plain" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ─── Copy button ───────────────────────────────────────────────────────────────
function CopyBtn({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = useCallback(async () => {
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [text]);

  return (
    <button
      onClick={copy}
      title={label}
      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[12px] font-semibold transition-all"
      style={{ background: "rgba(255,255,255,0.05)", color: copied ? "#80e0a0" : "#988d9f", border: "1px solid rgba(255,255,255,0.08)" }}
    >
      <span className="material-symbols-outlined text-[13px]">{copied ? "check" : "content_copy"}</span>
      {copied ? "Copied!" : label}
    </button>
  );
}

// ─── Textarea panel ────────────────────────────────────────────────────────────
interface PanelProps {
  id: string;
  label: string;
  accent: string;
  value: string;
  readOnly?: boolean;
  placeholder?: string;
  onChange?: (v: string) => void;
  errorMsg?: string | null;
  charCount: number;
  byteCount: number;
  onClear?: () => void;
  onDownload?: () => void;
}

function Panel({ id, label, accent, value, readOnly, placeholder, onChange, errorMsg, charCount, byteCount, onClear, onDownload }: PanelProps) {
  const borderColor = errorMsg
    ? "rgba(255,100,100,0.35)"
    : value
      ? `${accent}33`
      : "rgba(255,255,255,0.07)";

  return (
    <div className="flex flex-col gap-2 flex-1 min-w-0">
      {/* Label row */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-semibold uppercase tracking-wider" style={{ color: accent }}>{label}</span>
        <div className="flex items-center gap-1.5">
          <CopyBtn text={value} label="Copy" />
          {onDownload && (
            <button
              onClick={onDownload}
              title="Download as .txt"
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[12px] font-semibold transition-all"
              style={{ background: "rgba(255,255,255,0.05)", color: "#988d9f", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              <span className="material-symbols-outlined text-[13px]">download</span>
              Download
            </button>
          )}
          {onClear && (
            <button
              onClick={onClear}
              title="Clear"
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[12px] font-semibold transition-all"
              style={{ background: "rgba(255,100,100,0.08)", color: "#ff8080", border: "1px solid rgba(255,100,100,0.15)" }}
            >
              <span className="material-symbols-outlined text-[13px]">close</span>
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Textarea */}
      <div
        className="glass-panel rounded-2xl overflow-hidden flex flex-col"
        style={{ border: `1px solid ${borderColor}`, minHeight: "260px" }}
      >
        <textarea
          id={id}
          value={value}
          readOnly={readOnly}
          placeholder={placeholder}
          onChange={e => onChange?.(e.target.value)}
          spellCheck={false}
          className="flex-1 w-full resize-none bg-transparent text-sm leading-relaxed outline-none p-4"
          style={{
            fontFamily: "'JetBrains Mono','Fira Code',Consolas,monospace",
            color: "#e8dff0",
            minHeight: "260px",
          }}
        />
        {/* Error */}
        {errorMsg && (
          <div className="px-4 py-2 border-t flex items-center gap-2 text-[12px] font-semibold"
            style={{ borderColor: "rgba(255,100,100,0.2)", background: "rgba(255,100,100,0.07)", color: "#ff8080" }}>
            <span className="material-symbols-outlined text-[14px]">error</span>
            {errorMsg}
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="flex items-center gap-3 text-[11px] font-semibold" style={{ color: "#4d4354" }}>
        <span><span style={{ color: "#988d9f" }}>{charCount.toLocaleString()}</span> chars</span>
        <span><span style={{ color: "#988d9f" }}>{formatBytes(byteCount)}</span></span>
      </div>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────
export default function Base64Tool() {
  const uid = useId();

  const [mode,    setMode]    = useState<Mode>("encode");
  const [input,   setInput]   = useState("");
  const [output,  setOutput]  = useState("");
  const [error,   setError]   = useState<string | null>(null);
  const [notif,   setNotif]   = useState<{ type: NotifType; message: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadId     = `${uid}-upload`;

  const notify = useCallback((type: NotifType, msg: string) => {
    setNotif({ type, message: msg });
    if (type !== "info") setTimeout(() => setNotif(null), 5000);
  }, []);

  // ── Convert whenever input or mode changes ─────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    async function convert() {
      if (!input.trim()) {
        if (!cancelled) { setOutput(""); setError(null); }
        return;
      }
      try {
        const result = mode === "encode" ? encodeBase64(input) : decodeBase64(input.replace(/\s/g, ""));
        if (!cancelled) { setOutput(result); setError(null); }
      } catch {
        if (!cancelled) {
          setOutput("");
          setError(
            mode === "decode"
              ? "Invalid Base64 — cannot decode. Make sure the input is valid Base64-encoded text."
              : "Encoding failed. Check your input."
          );
        }
      }
    }
    convert();
    return () => { cancelled = true; };
  }, [input, mode]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleInputChange = useCallback((text: string) => {
    setInput(text);
  }, []);

  const handleAutoDetect = useCallback(() => {
    if (!input.trim()) { notify("info", "Enter some text first."); return; }
    const detected = detectMode(input.trim());
    setMode(detected);
    notify("success", `Auto-detected: ${detected === "encode" ? "plain text → Encode mode" : "Base64 → Decode mode"}.`);
  }, [input, notify]);

  const handleSwap = useCallback(() => {
    if (!output) { notify("error", "Nothing to swap."); return; }
    setInput(output);
    setMode(m => m === "encode" ? "decode" : "encode");
  }, [output, notify]);

  const handleClear = useCallback(() => {
    setInput(""); setOutput(""); setError(null); setNotif(null);
  }, []);

  const handleReset = useCallback(() => {
    setInput(""); setOutput(""); setError(null); setNotif(null); setMode("encode");
  }, []);

  const handleUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { notify("error", "File too large. Max 5 MB."); return; }
    const reader = new FileReader();
    reader.onload = ev => {
      const text = ev.target?.result as string;
      setInput(text);
    };
    reader.readAsText(file, "utf-8");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [notify]);

  const handleDownloadOutput = useCallback(() => {
    if (!output) { notify("error", "Nothing to download."); return; }
    downloadTxt(output, mode === "encode" ? "encoded.txt" : "decoded.txt");
    notify("success", `Downloaded ${mode === "encode" ? "encoded.txt" : "decoded.txt"}.`);
  }, [output, mode, notify]);

  // ── Derived ────────────────────────────────────────────────────────────────
  const isEmpty = !input.trim();

  return (
    <div className="mb-12 flex flex-col gap-4">

      {/* Toolbar */}
      <div className="glass-panel rounded-2xl p-3 flex flex-wrap items-center gap-2"
        style={{ border: "1px solid rgba(255,255,255,0.06)" }}>

        {/* Mode toggle */}
        <div className="flex rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
          {(["encode", "decode"] as Mode[]).map(m => (
            <button key={m} onClick={() => setMode(m)}
              className="flex items-center gap-1.5 px-3.5 py-2 text-[13px] font-semibold transition-all"
              style={{
                background: mode === m ? "rgba(221,183,255,0.15)" : "rgba(255,255,255,0.03)",
                color: mode === m ? "#ddb7ff" : "#988d9f",
              }}>
              <span className="material-symbols-outlined text-[14px]">
                {m === "encode" ? "lock" : "lock_open"}
              </span>
              {m === "encode" ? "Encode" : "Decode"}
            </button>
          ))}
        </div>

        <div className="w-px h-6 mx-1" style={{ background: "rgba(255,255,255,0.08)" }} />

        {/* Auto-detect */}
        <button onClick={handleAutoDetect}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[13px] font-semibold transition-all"
          style={{ background: "rgba(76,215,246,0.1)", color: "#4cd7f6", border: "1px solid rgba(76,215,246,0.2)" }}>
          <span className="material-symbols-outlined text-[15px]">auto_awesome</span>
          Auto-detect
        </button>

        {/* Swap */}
        <button onClick={handleSwap}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[13px] font-semibold transition-all"
          style={{ background: "rgba(221,183,255,0.1)", color: "#ddb7ff", border: "1px solid rgba(221,183,255,0.2)" }}>
          <span className="material-symbols-outlined text-[15px]">swap_horiz</span>
          Swap
        </button>

        <div className="w-px h-6 mx-1" style={{ background: "rgba(255,255,255,0.08)" }} />

        {/* Upload */}
        <label htmlFor={uploadId}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[13px] font-semibold cursor-pointer transition-all"
          style={{ background: "rgba(255,255,255,0.05)", color: "#988d9f", border: "1px solid rgba(255,255,255,0.08)" }}>
          <span className="material-symbols-outlined text-[15px]">upload_file</span>
          Upload .txt
          <input ref={fileInputRef} id={uploadId} type="file" accept=".txt,text/plain,text/*"
            className="hidden" onChange={handleUpload} />
        </label>

        <div className="w-px h-6 mx-1" style={{ background: "rgba(255,255,255,0.08)" }} />

        {/* Reset */}
        <button onClick={handleReset}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[13px] font-semibold transition-all"
          style={{ background: "rgba(255,100,100,0.08)", color: "#ff8080", border: "1px solid rgba(255,100,100,0.15)" }}>
          <span className="material-symbols-outlined text-[15px]">refresh</span>
          Reset
        </button>
      </div>

      {/* Notification */}
      {notif && (
        <div className="flex items-start gap-3 p-3 rounded-2xl text-sm font-medium"
          style={{
            background: notif.type === "error" ? "rgba(255,100,100,0.1)" : notif.type === "success" ? "rgba(100,220,150,0.1)" : "rgba(221,183,255,0.1)",
            border: `1px solid ${notif.type === "error" ? "rgba(255,100,100,0.25)" : notif.type === "success" ? "rgba(100,220,150,0.25)" : "rgba(221,183,255,0.25)"}`,
            color: notif.type === "error" ? "#ff8080" : notif.type === "success" ? "#80e0a0" : "#ddb7ff",
          }}>
          <span className="material-symbols-outlined text-[16px] mt-0.5 shrink-0">
            {notif.type === "error" ? "error" : notif.type === "success" ? "check_circle" : "info"}
          </span>
          <span>{notif.message}</span>
          <button onClick={() => setNotif(null)} className="ml-auto opacity-60 hover:opacity-100">
            <span className="material-symbols-outlined text-[14px]">close</span>
          </button>
        </div>
      )}

      {/* Split editor */}
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Input */}
        <Panel
          id={`${uid}-input`}
          label={mode === "encode" ? "Plain Text" : "Base64"}
          accent={mode === "encode" ? "#4cd7f6" : "#ddb7ff"}
          value={input}
          placeholder={
            mode === "encode"
              ? "Type or paste plain text here…"
              : "Paste Base64-encoded string here…"
          }
          onChange={handleInputChange}
          charCount={input.length}
          byteCount={byteSize(input)}
          onClear={handleClear}
        />

        {/* Divider with arrow */}
        <div className="flex lg:flex-col items-center justify-center gap-2 py-2 lg:py-0 lg:px-1">
          <div className="hidden lg:block w-px flex-1" style={{ background: "rgba(255,255,255,0.06)" }} />
          <div className="flex items-center justify-center w-8 h-8 rounded-full shrink-0"
            style={{ background: "rgba(221,183,255,0.1)", border: "1px solid rgba(221,183,255,0.2)" }}>
            <span className="material-symbols-outlined text-[16px] lg:rotate-90" style={{ color: "#ddb7ff" }}>
              arrow_forward
            </span>
          </div>
          <div className="hidden lg:block w-px flex-1" style={{ background: "rgba(255,255,255,0.06)" }} />
        </div>

        {/* Output */}
        <Panel
          id={`${uid}-output`}
          label={mode === "encode" ? "Base64" : "Plain Text"}
          accent={mode === "encode" ? "#ddb7ff" : "#4cd7f6"}
          value={output}
          readOnly
          placeholder={
            mode === "encode"
              ? "Base64-encoded output will appear here…"
              : "Decoded plain text will appear here…"
          }
          errorMsg={isEmpty ? null : error}
          charCount={output.length}
          byteCount={byteSize(output)}
          onDownload={handleDownloadOutput}
        />
      </div>

      {/* Stats row */}
      {!isEmpty && !error && output && (
        <div className="flex flex-wrap gap-3">
          {[
            { label: "Input chars",  value: input.length.toLocaleString() },
            { label: "Output chars", value: output.length.toLocaleString() },
            { label: "Input size",   value: formatBytes(byteSize(input)) },
            { label: "Output size",  value: formatBytes(byteSize(output)) },
            { label: "Ratio",        value: input.length ? `${((output.length / input.length) * 100).toFixed(0)}%` : "—" },
          ].map(({ label, value }) => (
            <div key={label}
              className="glass-panel rounded-xl px-4 py-2 flex flex-col gap-0.5"
              style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
              <span className="text-base font-bold tabular-nums" style={{ color: "#ddb7ff" }}>{value}</span>
              <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "#988d9f" }}>{label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Sample buttons */}
      {isEmpty && (
        <div className="flex flex-wrap gap-3 justify-center">
          <button
            onClick={() => { setMode("encode"); setInput("Hello, ToolNest AI! 🚀\nThis is a Unicode string — 日本語もOK!"); }}
            className="text-sm font-semibold flex items-center gap-1.5 transition-opacity hover:opacity-80"
            style={{ color: "#4cd7f6" }}
          >
            <span className="material-symbols-outlined text-[16px]">auto_awesome</span>
            Try encoding sample text
          </button>
          <button
            onClick={() => { setMode("decode"); setInput("SGVsbG8sIFRvb2xOZXN0IEFJISB46dKa"); }}
            className="text-sm font-semibold flex items-center gap-1.5 transition-opacity hover:opacity-80"
            style={{ color: "#ddb7ff" }}
          >
            <span className="material-symbols-outlined text-[16px]">auto_awesome</span>
            Try decoding sample Base64
          </button>
        </div>
      )}
    </div>
  );
}
