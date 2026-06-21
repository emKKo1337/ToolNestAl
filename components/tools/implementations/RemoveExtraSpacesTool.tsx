"use client";

import { useState, useMemo, useRef, useCallback } from "react";

// ── Core logic ────────────────────────────────────────────────────────────────

interface Options {
  collapseSpaces: boolean;
  trimLeading: boolean;
  trimTrailing: boolean;
  removeTabs: boolean;
  preserveLineBreaks: boolean;
}

function removeExtraSpaces(text: string, opts: Options): string {
  if (!text) return "";

  const processLine = (line: string): string => {
    let s = line;
    if (opts.removeTabs)     s = s.replace(/\t+/g, " ");
    if (opts.collapseSpaces) s = s.replace(/ {2,}/g, " ");
    if (opts.trimLeading)    s = s.trimStart();
    if (opts.trimTrailing)   s = s.trimEnd();
    return s;
  };

  if (opts.preserveLineBreaks) {
    return text.split("\n").map(processLine).join("\n");
  }
  // Collapse into single line then process
  return processLine(text.replace(/\n+/g, " "));
}

function getStats(original: string, output: string) {
  const origChars  = original.length;
  const finalChars = output.length;
  const removed    = Math.max(0, origChars - finalChars);
  const words      = output.trim() === "" ? 0 : output.trim().split(/\s+/).length;
  const lines      = output === "" ? 0 : output.split("\n").length;
  return { origChars, finalChars, removed, words, lines };
}

// ── Stat chip ─────────────────────────────────────────────────────────────────

function Stat({ label, value, color = "#4ade80" }: { label: string; value: number; color?: string }) {
  return (
    <div className="glass-panel rounded-xl px-4 py-3 flex flex-col gap-0.5">
      <span className="text-[11px] font-semibold text-[#988d9f] uppercase tracking-[0.06em]">
        {label}
      </span>
      <span className="text-[22px] font-extrabold leading-none tracking-tight" style={{ color }}>
        {value.toLocaleString()}
      </span>
    </div>
  );
}

// ── Toggle ────────────────────────────────────────────────────────────────────

function Toggle({
  id,
  label,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label htmlFor={id} className="flex items-center gap-3 cursor-pointer select-none group">
      <div className="relative shrink-0">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only"
        />
        <div
          className="w-10 h-5 rounded-full transition-colors duration-200"
          style={{ background: checked ? "rgba(74,222,128,0.35)" : "rgba(255,255,255,0.1)" }}
        />
        <div
          className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full shadow transition-all duration-200"
          style={{
            background: checked ? "#4ade80" : "#988d9f",
            transform: checked ? "translateX(20px)" : "translateX(0)",
          }}
        />
      </div>
      <span className="text-[14px] text-[#c4b5cf] group-hover:text-[#e2e2e2] transition-colors">
        {label}
      </span>
    </label>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function RemoveExtraSpacesTool() {
  const [input, setInput]                   = useState("");
  const [output, setOutput]                 = useState("");
  const [hasRun, setHasRun]                 = useState(false);
  const [collapseSpaces, setCollapseSpaces] = useState(true);
  const [trimLeading, setTrimLeading]       = useState(true);
  const [trimTrailing, setTrimTrailing]     = useState(true);
  const [removeTabs, setRemoveTabs]         = useState(true);
  const [preserveLineBreaks, setPreserveLineBreaks] = useState(true);
  const [copied, setCopied]                 = useState(false);
  const [swapped, setSwapped]               = useState(false);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef  = useRef<HTMLInputElement>(null);

  const opts: Options = { collapseSpaces, trimLeading, trimTrailing, removeTabs, preserveLineBreaks };

  const stats = useMemo(
    () => getStats(input, hasRun ? output : ""),
    [input, output, hasRun]
  );

  // ── Process ──────────────────────────────────────────────────────────────

  const handleRemove = useCallback(() => {
    setOutput(removeExtraSpaces(input, opts));
    setHasRun(true);
  }, [input, opts]);

  // ── Clipboard / file ─────────────────────────────────────────────────────

  const handlePaste = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      setInput(text);
      setHasRun(false);
      inputRef.current?.focus();
    } catch {
      inputRef.current?.focus();
    }
  }, []);

  const handleClear = useCallback(() => {
    setInput("");
    setOutput("");
    setHasRun(false);
    inputRef.current?.focus();
  }, []);

  const handleSwap = useCallback(() => {
    if (!output) return;
    setInput(output);
    setOutput("");
    setHasRun(false);
    setSwapped((s) => !s);
    setTimeout(() => setSwapped((s) => !s), 700);
  }, [output]);

  const handleCopy = useCallback(async () => {
    if (!output) return;
    await navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [output]);

  const handleDownload = useCallback(() => {
    if (!output) return;
    const blob = new Blob([output], { type: "text/plain;charset=utf-8" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = "cleaned-spaces.txt";
    a.click();
    URL.revokeObjectURL(url);
  }, [output]);

  const handleUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setInput(ev.target?.result as string ?? "");
      setHasRun(false);
    };
    reader.readAsText(file, "utf-8");
    e.target.value = "";
  }, []);

  const btnBase = {
    background: "rgba(255,255,255,0.06)",
    color: "#988d9f",
    border: "1px solid rgba(255,255,255,0.08)",
  } as const;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="mb-12 flex flex-col gap-5">

      {/* ── Options ──────────────────────────────────────────────────────── */}
      <div className="glass-panel rounded-2xl p-5">
        <p className="text-[12px] font-semibold text-[#988d9f] uppercase tracking-[0.08em] mb-4">
          Options
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Toggle
            id="collapse-spaces"
            label="Replace multiple spaces with a single space"
            checked={collapseSpaces}
            onChange={(v) => { setCollapseSpaces(v); setHasRun(false); }}
          />
          <Toggle
            id="trim-leading"
            label="Trim leading spaces"
            checked={trimLeading}
            onChange={(v) => { setTrimLeading(v); setHasRun(false); }}
          />
          <Toggle
            id="trim-trailing"
            label="Trim trailing spaces"
            checked={trimTrailing}
            onChange={(v) => { setTrimTrailing(v); setHasRun(false); }}
          />
          <Toggle
            id="remove-tabs"
            label="Remove extra tabs"
            checked={removeTabs}
            onChange={(v) => { setRemoveTabs(v); setHasRun(false); }}
          />
          <Toggle
            id="preserve-line-breaks"
            label="Preserve line breaks"
            checked={preserveLineBreaks}
            onChange={(v) => { setPreserveLineBreaks(v); setHasRun(false); }}
          />
        </div>
      </div>

      {/* ── Input ────────────────────────────────────────────────────────── */}
      <div className="glass-panel rounded-2xl p-5 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <label htmlFor="res-input" className="text-[15px] font-semibold text-[#e2e2e2]">
            Input Text
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handlePaste}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all"
              style={btnBase}
            >
              <span className="material-symbols-outlined text-[14px]">content_paste</span>
              Paste
            </button>
            <button
              onClick={() => fileRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all"
              style={btnBase}
            >
              <span className="material-symbols-outlined text-[14px]">upload_file</span>
              Upload TXT
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".txt,text/plain"
              onChange={handleUpload}
              className="hidden"
              aria-label="Upload a TXT file"
            />
            <button
              onClick={handleClear}
              disabled={!input}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all disabled:opacity-40"
              style={btnBase}
            >
              <span className="material-symbols-outlined text-[14px]">delete_sweep</span>
              Clear
            </button>
          </div>
        </div>

        <textarea
          id="res-input"
          ref={inputRef}
          value={input}
          onChange={(e) => { setInput(e.target.value); setHasRun(false); }}
          placeholder={"Paste or type your text here…\nExtra spaces and tabs will be removed."}
          rows={10}
          className="bg-[rgba(0,0,0,0.25)] border border-[rgba(255,255,255,0.08)] rounded-xl px-4 py-3 text-[15px] text-[#e2e2e2] placeholder-[#4d4354] focus:outline-none focus:border-[#4ade80] transition-colors resize-y leading-relaxed w-full"
          aria-label="Text to clean"
          spellCheck={false}
        />

        <button
          onClick={handleRemove}
          disabled={!input.trim()}
          className="self-start flex items-center gap-2 px-5 py-2.5 rounded-xl text-[14px] font-bold transition-all disabled:opacity-40"
          style={{
            background: input.trim() ? "rgba(74,222,128,0.15)" : "rgba(255,255,255,0.04)",
            color: input.trim() ? "#4ade80" : "#988d9f",
            border: `1px solid ${input.trim() ? "rgba(74,222,128,0.4)" : "rgba(255,255,255,0.08)"}`,
          }}
        >
          <span className="material-symbols-outlined text-[18px]">space_bar</span>
          Remove Extra Spaces
        </button>
      </div>

      {/* ── Output ───────────────────────────────────────────────────────── */}
      <div className="glass-panel rounded-2xl p-5 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-[15px] font-semibold text-[#e2e2e2]">Output</span>
            {hasRun && stats.removed > 0 && (
              <span
                className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                style={{
                  background: "rgba(74,222,128,0.12)",
                  color: "#4ade80",
                  border: "1px solid rgba(74,222,128,0.25)",
                }}
              >
                {stats.removed.toLocaleString()} chars removed
              </span>
            )}
            {hasRun && stats.removed === 0 && input && (
              <span
                className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                style={{
                  background: "rgba(76,215,246,0.12)",
                  color: "#4cd7f6",
                  border: "1px solid rgba(76,215,246,0.25)",
                }}
              >
                No extra spaces found
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleSwap}
              disabled={!output}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all disabled:opacity-40"
              style={btnBase}
              title="Move output back to input"
            >
              <span
                className="material-symbols-outlined text-[14px] transition-transform duration-300"
                style={{ transform: swapped ? "rotate(180deg)" : "rotate(0deg)" }}
                aria-hidden="true"
              >
                swap_vert
              </span>
              Swap
            </button>
            <button
              onClick={handleCopy}
              disabled={!output}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all disabled:opacity-40"
              style={{
                background: copied ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.06)",
                color: copied ? "#22c55e" : "#988d9f",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <span className="material-symbols-outlined text-[14px]">
                {copied ? "check" : "content_copy"}
              </span>
              {copied ? "Copied!" : "Copy"}
            </button>
            <button
              onClick={handleDownload}
              disabled={!output}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all disabled:opacity-40"
              style={btnBase}
            >
              <span className="material-symbols-outlined text-[14px]">download</span>
              Download TXT
            </button>
          </div>
        </div>

        <textarea
          readOnly
          value={output}
          placeholder="Cleaned output will appear here after clicking Remove Extra Spaces…"
          rows={10}
          className="bg-[rgba(0,0,0,0.25)] border border-[rgba(255,255,255,0.08)] rounded-xl px-4 py-3 text-[15px] text-[#e2e2e2] placeholder-[#4d4354] focus:outline-none focus:border-[#4ade80] transition-colors resize-y leading-relaxed w-full"
          aria-label="Cleaned output"
          aria-live="polite"
          spellCheck={false}
        />
      </div>

      {/* ── Stats ────────────────────────────────────────────────────────── */}
      <div
        className="grid gap-3"
        style={{ gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))" }}
        aria-label="Output statistics"
      >
        <Stat label="Original Chars" value={input.length}                  color="#988d9f" />
        <Stat label="Final Chars"    value={hasRun ? stats.finalChars : 0} color="#4ade80" />
        <Stat label="Removed"        value={hasRun ? stats.removed : 0}    color="#ffb4ab" />
        <Stat label="Words"          value={hasRun ? stats.words : 0}      color="#4cd7f6" />
        <Stat label="Lines"          value={hasRun ? stats.lines : 0}      color="#adc6ff" />
      </div>
    </div>
  );
}
