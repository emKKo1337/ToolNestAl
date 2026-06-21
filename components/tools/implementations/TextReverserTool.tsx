"use client";

import { useState, useMemo, useRef, useCallback } from "react";

// ── Core logic ────────────────────────────────────────────────────────────────

type Mode = "characters" | "words" | "lines";

interface Options {
  mode: Mode;
  preserveLineBreaks: boolean;
  eachLineIndividually: boolean;
}

function reverseChars(str: string): string {
  // Spread handles Unicode surrogate pairs correctly
  return [...str].reverse().join("");
}

function reverseWords(str: string): string {
  return str.split(/(\s+)/).reverse().join("");
}

function reverseLines(str: string): string {
  return str.split("\n").reverse().join("\n");
}

function reverseText(text: string, opts: Options): string {
  if (!text) return "";

  if (opts.mode === "lines") {
    return reverseLines(text);
  }

  if (opts.eachLineIndividually) {
    const lines = text.split("\n");
    const reversed = lines.map((line) =>
      opts.mode === "characters" ? reverseChars(line) : reverseWords(line)
    );
    return opts.preserveLineBreaks ? reversed.join("\n") : reversed.join(" ");
  }

  // Whole-text reversal
  if (opts.preserveLineBreaks && opts.mode === "characters") {
    // Reverse chars within each line, keep line order
    return text
      .split("\n")
      .map((line) => reverseChars(line))
      .join("\n");
  }

  if (opts.mode === "characters") return reverseChars(text);
  return reverseWords(text);
}

function getStats(text: string) {
  return {
    chars: text.length,
    words: text.trim() === "" ? 0 : text.trim().split(/\s+/).length,
    lines: text === "" ? 0 : text.split("\n").length,
  };
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

// ── Mode button ───────────────────────────────────────────────────────────────

const MODES: { value: Mode; label: string; icon: string }[] = [
  { value: "characters", label: "Reverse Characters", icon: "text_rotate_vertical" },
  { value: "words",      label: "Reverse Words",      icon: "wrap_text"            },
  { value: "lines",      label: "Reverse Lines",      icon: "sort"                 },
];

// ── Main component ────────────────────────────────────────────────────────────

export default function TextReverserTool() {
  const [input, setInput]                         = useState("");
  const [mode, setMode]                           = useState<Mode>("characters");
  const [preserveLineBreaks, setPreserveLineBreaks] = useState(true);
  const [eachLine, setEachLine]                   = useState(false);
  const [copied, setCopied]                       = useState(false);
  const [swapped, setSwapped]                     = useState(false);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef  = useRef<HTMLInputElement>(null);

  const opts: Options = { mode, preserveLineBreaks, eachLineIndividually: eachLine };

  const output = useMemo(() => reverseText(input, opts), [input, mode, preserveLineBreaks, eachLine]);

  const inputStats  = useMemo(() => getStats(input),  [input]);
  const outputStats = useMemo(() => getStats(output), [output]);

  // ── Actions ───────────────────────────────────────────────────────────────

  const handlePaste = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      setInput(text);
      inputRef.current?.focus();
    } catch {
      inputRef.current?.focus();
    }
  }, []);

  const handleClear = useCallback(() => {
    setInput("");
    inputRef.current?.focus();
  }, []);

  const handleSwap = useCallback(() => {
    if (!output) return;
    setInput(output);
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
    a.download = "reversed-text.txt";
    a.click();
    URL.revokeObjectURL(url);
  }, [output]);

  const handleUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setInput(ev.target?.result as string ?? "");
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

      {/* ── Mode + Options ───────────────────────────────────────────────── */}
      <div className="glass-panel rounded-2xl p-5 flex flex-col gap-5">

        {/* Mode picker */}
        <div className="flex flex-col gap-2">
          <p className="text-[12px] font-semibold text-[#988d9f] uppercase tracking-[0.08em]">
            Reverse Mode
          </p>
          <div className="flex flex-wrap gap-2">
            {MODES.map(({ value, label, icon }) => (
              <button
                key={value}
                onClick={() => setMode(value)}
                aria-pressed={mode === value}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-bold transition-all"
                style={{
                  background: mode === value ? "rgba(74,222,128,0.12)" : "rgba(255,255,255,0.04)",
                  color: mode === value ? "#4ade80" : "#988d9f",
                  border: `1px solid ${mode === value ? "rgba(74,222,128,0.35)" : "rgba(255,255,255,0.08)"}`,
                }}
              >
                <span className="material-symbols-outlined text-[16px]">{icon}</span>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Options — hidden for "lines" mode where they don't apply */}
        {mode !== "lines" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Toggle
              id="preserve-lb"
              label="Preserve line breaks"
              checked={preserveLineBreaks}
              onChange={setPreserveLineBreaks}
            />
            <Toggle
              id="each-line"
              label="Reverse each line individually"
              checked={eachLine}
              onChange={setEachLine}
            />
          </div>
        )}
      </div>

      {/* ── Input ────────────────────────────────────────────────────────── */}
      <div className="glass-panel rounded-2xl p-5 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <label htmlFor="tr-input" className="text-[15px] font-semibold text-[#e2e2e2]">
            Input Text
          </label>
          <div className="flex flex-wrap gap-2">
            <button onClick={handlePaste} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all" style={btnBase}>
              <span className="material-symbols-outlined text-[14px]">content_paste</span>Paste
            </button>
            <button onClick={() => fileRef.current?.click()} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all" style={btnBase}>
              <span className="material-symbols-outlined text-[14px]">upload_file</span>Upload TXT
            </button>
            <input ref={fileRef} type="file" accept=".txt,text/plain" onChange={handleUpload} className="hidden" aria-label="Upload a TXT file" />
            <button onClick={handleClear} disabled={!input} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all disabled:opacity-40" style={btnBase}>
              <span className="material-symbols-outlined text-[14px]">delete_sweep</span>Clear
            </button>
          </div>
        </div>

        <textarea
          id="tr-input"
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Paste or type your text here — reversed output appears instantly below…"
          rows={10}
          className="bg-[rgba(0,0,0,0.25)] border border-[rgba(255,255,255,0.08)] rounded-xl px-4 py-3 text-[15px] text-[#e2e2e2] placeholder-[#4d4354] focus:outline-none focus:border-[#4ade80] transition-colors resize-y leading-relaxed w-full"
          aria-label="Text to reverse"
          spellCheck={false}
        />

        {/* Input quick stats */}
        {input && (
          <p className="text-[12px] text-[#5a4d63]">
            {inputStats.chars.toLocaleString()} chars &middot; {inputStats.words.toLocaleString()} words &middot; {inputStats.lines.toLocaleString()} {inputStats.lines === 1 ? "line" : "lines"}
          </p>
        )}
      </div>

      {/* ── Output ───────────────────────────────────────────────────────── */}
      <div className="glass-panel rounded-2xl p-5 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <span className="text-[15px] font-semibold text-[#e2e2e2]">Reversed Output</span>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleSwap}
              disabled={!output}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all disabled:opacity-40"
              style={btnBase}
              title="Use output as new input"
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
          placeholder="Reversed text will appear here…"
          rows={10}
          className="bg-[rgba(0,0,0,0.25)] border border-[rgba(255,255,255,0.08)] rounded-xl px-4 py-3 text-[15px] text-[#e2e2e2] placeholder-[#4d4354] focus:outline-none focus:border-[#4ade80] transition-colors resize-y leading-relaxed w-full"
          aria-label="Reversed output"
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
        <Stat label="Characters" value={outputStats.chars}  color="#4ade80" />
        <Stat label="Words"      value={outputStats.words}  color="#4cd7f6" />
        <Stat label="Lines"      value={outputStats.lines}  color="#adc6ff" />
      </div>
    </div>
  );
}
