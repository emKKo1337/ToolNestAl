"use client";

import { useState, useMemo, useRef, useCallback } from "react";

// ── Core logic ────────────────────────────────────────────────────────────────

interface Options {
  matchCase: boolean;
  wholeWord: boolean;
  useRegex: boolean;
}

function buildRegex(find: string, opts: Options, global: boolean): RegExp | null {
  if (!find) return null;
  try {
    let pattern = opts.useRegex ? find : find.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (opts.wholeWord) pattern = `\\b${pattern}\\b`;
    const flags = [global ? "g" : "", opts.matchCase ? "" : "i"].filter(Boolean).join("");
    return new RegExp(pattern, flags || undefined);
  } catch {
    return null;
  }
}

function countMatches(text: string, find: string, opts: Options): number {
  if (!text || !find) return 0;
  const re = buildRegex(find, opts, true);
  if (!re) return 0;
  return (text.match(re) ?? []).length;
}

function replaceAll(text: string, find: string, replace: string, opts: Options): string {
  const re = buildRegex(find, opts, true);
  if (!re) return text;
  return text.replace(re, replace);
}

function replaceFirst(text: string, find: string, replace: string, opts: Options): string {
  const re = buildRegex(find, opts, false);
  if (!re) return text;
  return text.replace(re, replace);
}

function getStats(text: string) {
  return {
    chars: text.length,
    words: text.trim() === "" ? 0 : text.trim().split(/\s+/).length,
    lines: text === "" ? 0 : text.split("\n").length,
  };
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

export default function FindAndReplaceTool() {
  const [input, setInput]           = useState("");
  const [output, setOutput]         = useState("");
  const [hasRun, setHasRun]         = useState(false);
  const [find, setFind]             = useState("");
  const [replace, setReplace]       = useState("");
  const [matchCase, setMatchCase]   = useState(false);
  const [wholeWord, setWholeWord]   = useState(false);
  const [useRegex, setUseRegex]     = useState(false);
  const [replacements, setReplacements] = useState(0);
  const [copied, setCopied]         = useState(false);
  const [swapped, setSwapped]       = useState(false);
  const [regexError, setRegexError] = useState(false);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef  = useRef<HTMLInputElement>(null);

  const opts: Options = { matchCase, wholeWord, useRegex };

  // Live match count
  const matchCount = useMemo(() => {
    try {
      setRegexError(false);
      return countMatches(input, find, opts);
    } catch {
      setRegexError(true);
      return 0;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input, find, matchCase, wholeWord, useRegex]);

  const outputStats = useMemo(() => getStats(hasRun ? output : ""), [output, hasRun]);

  // ── Replace actions ───────────────────────────────────────────────────────

  const handleReplaceAll = useCallback(() => {
    if (!find) return;
    const result = replaceAll(input, find, replace, opts);
    const count  = countMatches(input, find, opts);
    setOutput(result);
    setReplacements(count);
    setHasRun(true);
  }, [input, find, replace, opts]);

  const handleReplaceFirst = useCallback(() => {
    if (!find) return;
    const base   = hasRun ? output : input;
    const result = replaceFirst(base, find, replace, opts);
    setOutput(result);
    setReplacements((n) => n + (result !== base ? 1 : 0));
    setHasRun(true);
  }, [input, output, find, replace, opts, hasRun]);

  const handleFind = useCallback(() => {
    // Just triggers a re-render — matchCount updates live
    setHasRun(false);
  }, []);

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
    setReplacements(0);
    inputRef.current?.focus();
  }, []);

  const handleSwap = useCallback(() => {
    if (!output) return;
    setInput(output);
    setOutput("");
    setHasRun(false);
    setReplacements(0);
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
    a.download = "replaced-text.txt";
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
      setReplacements(0);
    };
    reader.readAsText(file, "utf-8");
    e.target.value = "";
  }, []);

  const btnBase = {
    background: "rgba(255,255,255,0.06)",
    color: "#988d9f",
    border: "1px solid rgba(255,255,255,0.08)",
  } as const;

  const canReplace = !!find && !!input;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="mb-12 flex flex-col gap-5">

      {/* ── Find / Replace fields ────────────────────────────────────────── */}
      <div className="glass-panel rounded-2xl p-5 flex flex-col gap-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Find */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="far-find" className="text-[13px] font-semibold text-[#988d9f] uppercase tracking-[0.06em]">
              Find
            </label>
            <div className="relative">
              <input
                id="far-find"
                type="text"
                value={find}
                onChange={(e) => { setFind(e.target.value); setHasRun(false); }}
                onKeyDown={(e) => e.key === "Enter" && handleReplaceAll()}
                placeholder={useRegex ? "Regular expression…" : "Text to find…"}
                className="w-full bg-[rgba(0,0,0,0.3)] border rounded-xl px-4 py-3 text-[15px] text-[#e2e2e2] placeholder-[#4d4354] focus:outline-none transition-colors pr-20"
                style={{
                  borderColor: regexError
                    ? "rgba(255,100,100,0.5)"
                    : find && matchCount > 0
                    ? "rgba(74,222,128,0.4)"
                    : "rgba(255,255,255,0.08)",
                }}
                aria-label="Search term"
                aria-invalid={regexError}
                spellCheck={false}
              />
              {/* Match badge */}
              {find && !regexError && (
                <span
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-bold px-2 py-0.5 rounded-full"
                  style={{
                    background: matchCount > 0 ? "rgba(74,222,128,0.15)" : "rgba(255,255,255,0.06)",
                    color: matchCount > 0 ? "#4ade80" : "#988d9f",
                  }}
                >
                  {matchCount.toLocaleString()} {matchCount === 1 ? "match" : "matches"}
                </span>
              )}
              {regexError && (
                <span
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-bold px-2 py-0.5 rounded-full"
                  style={{ background: "rgba(255,100,100,0.15)", color: "#f87171" }}
                >
                  Invalid regex
                </span>
              )}
            </div>
          </div>

          {/* Replace */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="far-replace" className="text-[13px] font-semibold text-[#988d9f] uppercase tracking-[0.06em]">
              Replace With
            </label>
            <input
              id="far-replace"
              type="text"
              value={replace}
              onChange={(e) => setReplace(e.target.value)}
              placeholder={useRegex ? "Replacement (use $1, $2 for groups)…" : "Replacement text…"}
              className="w-full bg-[rgba(0,0,0,0.3)] border border-[rgba(255,255,255,0.08)] rounded-xl px-4 py-3 text-[15px] text-[#e2e2e2] placeholder-[#4d4354] focus:outline-none focus:border-[#4ade80] transition-colors"
              aria-label="Replacement text"
              spellCheck={false}
            />
          </div>
        </div>

        {/* Options */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
          <Toggle id="match-case"  label="Match case"               checked={matchCase}  onChange={(v) => { setMatchCase(v);  setHasRun(false); }} />
          <Toggle id="whole-word"  label="Match whole word"         checked={wholeWord}  onChange={(v) => { setWholeWord(v);  setHasRun(false); }} />
          <Toggle id="use-regex"   label="Use regular expressions"  checked={useRegex}   onChange={(v) => { setUseRegex(v);   setHasRun(false); }} />
        </div>

        {/* Action row */}
        <div className="flex flex-wrap gap-2 pt-1">
          <button
            onClick={handleFind}
            disabled={!find || !input}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-bold transition-all disabled:opacity-40"
            style={btnBase}
          >
            <span className="material-symbols-outlined text-[16px]">search</span>
            Find
          </button>
          <button
            onClick={handleReplaceFirst}
            disabled={!canReplace || matchCount === 0}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-bold transition-all disabled:opacity-40"
            style={btnBase}
          >
            <span className="material-symbols-outlined text-[16px]">find_replace</span>
            Replace
          </button>
          <button
            onClick={handleReplaceAll}
            disabled={!canReplace || matchCount === 0}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-bold transition-all disabled:opacity-40"
            style={{
              background: canReplace && matchCount > 0 ? "rgba(74,222,128,0.15)" : "rgba(255,255,255,0.04)",
              color: canReplace && matchCount > 0 ? "#4ade80" : "#988d9f",
              border: `1px solid ${canReplace && matchCount > 0 ? "rgba(74,222,128,0.4)" : "rgba(255,255,255,0.08)"}`,
            }}
          >
            <span className="material-symbols-outlined text-[16px]">published_with_changes</span>
            Replace All
          </button>
        </div>
      </div>

      {/* ── Input ────────────────────────────────────────────────────────── */}
      <div className="glass-panel rounded-2xl p-5 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <label htmlFor="far-input" className="text-[15px] font-semibold text-[#e2e2e2]">
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
          id="far-input"
          ref={inputRef}
          value={input}
          onChange={(e) => { setInput(e.target.value); setHasRun(false); setReplacements(0); }}
          placeholder={"Paste or type your text here…"}
          rows={10}
          className="bg-[rgba(0,0,0,0.25)] border border-[rgba(255,255,255,0.08)] rounded-xl px-4 py-3 text-[15px] text-[#e2e2e2] placeholder-[#4d4354] focus:outline-none focus:border-[#4ade80] transition-colors resize-y leading-relaxed w-full"
          aria-label="Text to search"
          spellCheck={false}
        />
      </div>

      {/* ── Output ───────────────────────────────────────────────────────── */}
      <div className="glass-panel rounded-2xl p-5 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-[15px] font-semibold text-[#e2e2e2]">Output</span>
            {hasRun && replacements > 0 && (
              <span
                className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                style={{
                  background: "rgba(74,222,128,0.12)",
                  color: "#4ade80",
                  border: "1px solid rgba(74,222,128,0.25)",
                }}
              >
                {replacements.toLocaleString()} replaced
              </span>
            )}
            {hasRun && replacements === 0 && input && (
              <span
                className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                style={{
                  background: "rgba(76,215,246,0.12)",
                  color: "#4cd7f6",
                  border: "1px solid rgba(76,215,246,0.25)",
                }}
              >
                No matches found
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
          placeholder="Result will appear here after replacing…"
          rows={10}
          className="bg-[rgba(0,0,0,0.25)] border border-[rgba(255,255,255,0.08)] rounded-xl px-4 py-3 text-[15px] text-[#e2e2e2] placeholder-[#4d4354] focus:outline-none focus:border-[#4ade80] transition-colors resize-y leading-relaxed w-full"
          aria-label="Output after replacement"
          aria-live="polite"
          spellCheck={false}
        />
      </div>

      {/* ── Stats ────────────────────────────────────────────────────────── */}
      <div
        className="grid gap-3"
        style={{ gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))" }}
        aria-label="Statistics"
      >
        <Stat label="Matches Found"  value={matchCount}                       color="#4ade80" />
        <Stat label="Replaced"       value={hasRun ? replacements : 0}        color="#ffb4ab" />
        <Stat label="Characters"     value={hasRun ? outputStats.chars : 0}   color="#4cd7f6" />
        <Stat label="Words"          value={hasRun ? outputStats.words : 0}   color="#adc6ff" />
        <Stat label="Lines"          value={hasRun ? outputStats.lines : 0}   color="#988d9f" />
      </div>
    </div>
  );
}
