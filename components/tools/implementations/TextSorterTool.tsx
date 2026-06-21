"use client";

import { useState, useMemo, useRef, useCallback } from "react";

// ── Sorting logic ─────────────────────────────────────────────────────────────

type SortMode =
  | "alpha-asc"
  | "alpha-desc"
  | "length-asc"
  | "length-desc"
  | "reverse"
  | "random";

interface Options {
  mode: SortMode;
  ignoreCase: boolean;
  removeEmpty: boolean;
  removeDupes: boolean;
  trimWhitespace: boolean;
}

function sortLines(text: string, opts: Options): string {
  if (!text) return "";

  let lines = text.split("\n");

  if (opts.trimWhitespace) lines = lines.map((l) => l.trim());
  if (opts.removeEmpty)    lines = lines.filter((l) => l !== "");
  if (opts.removeDupes) {
    const seen = new Set<string>();
    lines = lines.filter((l) => {
      const key = opts.ignoreCase ? l.toLowerCase() : l;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  switch (opts.mode) {
    case "alpha-asc":
      lines = [...lines].sort((a, b) => {
        const x = opts.ignoreCase ? a.toLowerCase() : a;
        const y = opts.ignoreCase ? b.toLowerCase() : b;
        return x.localeCompare(y);
      });
      break;
    case "alpha-desc":
      lines = [...lines].sort((a, b) => {
        const x = opts.ignoreCase ? a.toLowerCase() : a;
        const y = opts.ignoreCase ? b.toLowerCase() : b;
        return y.localeCompare(x);
      });
      break;
    case "length-asc":
      lines = [...lines].sort((a, b) => a.length - b.length);
      break;
    case "length-desc":
      lines = [...lines].sort((a, b) => b.length - a.length);
      break;
    case "reverse":
      lines = [...lines].reverse();
      break;
    case "random":
      lines = [...lines];
      for (let i = lines.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [lines[i], lines[j]] = [lines[j], lines[i]];
      }
      break;
  }

  return lines.join("\n");
}

function getStats(original: string, output: string) {
  const origLines  = original === "" ? 0 : original.split("\n").length;
  const finalLines = output   === "" ? 0 : output.split("\n").length;
  const chars      = output.length;
  const words      = output.trim() === "" ? 0 : output.trim().split(/\s+/).length;
  return { origLines, finalLines, chars, words };
}

// ── Sort mode buttons ─────────────────────────────────────────────────────────

const SORT_MODES: { id: SortMode; label: string; icon: string }[] = [
  { id: "alpha-asc",   label: "A → Z",                  icon: "sort_by_alpha" },
  { id: "alpha-desc",  label: "Z → A",                  icon: "sort_by_alpha" },
  { id: "length-asc",  label: "Shortest → Longest",     icon: "height" },
  { id: "length-desc", label: "Longest → Shortest",     icon: "height" },
  { id: "reverse",     label: "Reverse Order",           icon: "swap_vert" },
  { id: "random",      label: "Random Shuffle",          icon: "shuffle" },
];

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

export default function TextSorterTool() {
  const [input, setInput]               = useState("");
  const [output, setOutput]             = useState("");
  const [hasRun, setHasRun]             = useState(false);
  const [mode, setMode]                 = useState<SortMode>("alpha-asc");
  const [ignoreCase, setIgnoreCase]     = useState(false);
  const [removeEmpty, setRemoveEmpty]   = useState(false);
  const [removeDupes, setRemoveDupes]   = useState(false);
  const [trimWhitespace, setTrimWhitespace] = useState(false);
  const [copied, setCopied]             = useState(false);
  const [swapped, setSwapped]           = useState(false);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef  = useRef<HTMLInputElement>(null);

  const opts: Options = { mode, ignoreCase, removeEmpty, removeDupes, trimWhitespace };

  const stats = useMemo(
    () => getStats(input, hasRun ? output : ""),
    [input, output, hasRun]
  );

  // ── Process ──────────────────────────────────────────────────────────────

  const handleSort = useCallback(() => {
    setOutput(sortLines(input, opts));
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
    a.download = `sorted-${mode}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [output, mode]);

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

      {/* ── Sort mode ────────────────────────────────────────────────────── */}
      <div className="glass-panel rounded-2xl p-5">
        <p className="text-[12px] font-semibold text-[#988d9f] uppercase tracking-[0.08em] mb-3">
          Sort Order
        </p>
        <div
          className="grid gap-2"
          style={{ gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))" }}
          role="group"
          aria-label="Sorting mode"
        >
          {SORT_MODES.map((m) => {
            const active = mode === m.id;
            return (
              <button
                key={m.id}
                onClick={() => { setMode(m.id); setHasRun(false); }}
                aria-pressed={active}
                className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-[13px] font-semibold transition-all text-left"
                style={{
                  background: active ? "rgba(74,222,128,0.12)" : "rgba(255,255,255,0.04)",
                  color:  active ? "#4ade80" : "#988d9f",
                  border: `1px solid ${active ? "rgba(74,222,128,0.35)" : "rgba(255,255,255,0.08)"}`,
                }}
              >
                <span className="material-symbols-outlined text-[16px] shrink-0" aria-hidden="true">
                  {m.icon}
                </span>
                {m.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Additional options ────────────────────────────────────────────── */}
      <div className="glass-panel rounded-2xl p-5">
        <p className="text-[12px] font-semibold text-[#988d9f] uppercase tracking-[0.08em] mb-4">
          Options
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Toggle
            id="ignore-case"
            label="Ignore case when sorting"
            checked={ignoreCase}
            onChange={(v) => { setIgnoreCase(v); setHasRun(false); }}
          />
          <Toggle
            id="remove-empty"
            label="Remove empty lines before sorting"
            checked={removeEmpty}
            onChange={(v) => { setRemoveEmpty(v); setHasRun(false); }}
          />
          <Toggle
            id="remove-dupes"
            label="Remove duplicate lines before sorting"
            checked={removeDupes}
            onChange={(v) => { setRemoveDupes(v); setHasRun(false); }}
          />
          <Toggle
            id="trim-ws"
            label="Trim whitespace before sorting"
            checked={trimWhitespace}
            onChange={(v) => { setTrimWhitespace(v); setHasRun(false); }}
          />
        </div>
      </div>

      {/* ── Input ────────────────────────────────────────────────────────── */}
      <div className="glass-panel rounded-2xl p-5 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <label htmlFor="ts-input" className="text-[15px] font-semibold text-[#e2e2e2]">
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
          id="ts-input"
          ref={inputRef}
          value={input}
          onChange={(e) => { setInput(e.target.value); setHasRun(false); }}
          placeholder={"Paste or type your text here…\nEach line will be sorted independently."}
          rows={10}
          className="bg-[rgba(0,0,0,0.25)] border border-[rgba(255,255,255,0.08)] rounded-xl px-4 py-3 text-[15px] text-[#e2e2e2] placeholder-[#4d4354] focus:outline-none focus:border-[#4ade80] transition-colors resize-y leading-relaxed w-full"
          aria-label="Text to sort"
          spellCheck={false}
        />

        <button
          onClick={handleSort}
          disabled={!input.trim()}
          className="self-start flex items-center gap-2 px-5 py-2.5 rounded-xl text-[14px] font-bold transition-all disabled:opacity-40"
          style={{
            background: input.trim() ? "rgba(74,222,128,0.15)" : "rgba(255,255,255,0.04)",
            color: input.trim() ? "#4ade80" : "#988d9f",
            border: `1px solid ${input.trim() ? "rgba(74,222,128,0.4)" : "rgba(255,255,255,0.08)"}`,
          }}
        >
          <span className="material-symbols-outlined text-[18px]">sort</span>
          Sort Text
        </button>
      </div>

      {/* ── Output ───────────────────────────────────────────────────────── */}
      <div className="glass-panel rounded-2xl p-5 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-[15px] font-semibold text-[#e2e2e2]">Output</span>
            {hasRun && output && (
              <span
                className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                style={{
                  background: "rgba(74,222,128,0.12)",
                  color: "#4ade80",
                  border: "1px solid rgba(74,222,128,0.25)",
                }}
              >
                {SORT_MODES.find((m) => m.id === mode)?.label}
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
          placeholder="Sorted output will appear here after clicking Sort Text…"
          rows={10}
          className="bg-[rgba(0,0,0,0.25)] border border-[rgba(255,255,255,0.08)] rounded-xl px-4 py-3 text-[15px] text-[#e2e2e2] placeholder-[#4d4354] focus:outline-none focus:border-[#4ade80] transition-colors resize-y leading-relaxed w-full"
          aria-label="Sorted output"
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
        <Stat label="Original Lines" value={input === "" ? 0 : input.split("\n").length} color="#988d9f" />
        <Stat label="Final Lines"    value={hasRun ? stats.finalLines : 0} color="#4ade80" />
        <Stat label="Characters"     value={hasRun ? stats.chars : 0}      color="#4cd7f6" />
        <Stat label="Words"          value={hasRun ? stats.words : 0}      color="#adc6ff" />
      </div>
    </div>
  );
}
