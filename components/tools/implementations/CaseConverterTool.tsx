"use client";

import { useState, useMemo, useRef, useCallback } from "react";

// ── Case conversion helpers ───────────────────────────────────────────────────

function wordsFrom(text: string): string[] {
  return text
    .trim()
    .split(/[\s\-_/\\]+/)
    .flatMap((w) => w.split(/(?<=[a-z])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])/))
    .filter(Boolean);
}

const CONVERTERS: Record<string, (text: string) => string> = {
  upper: (t) => t.toUpperCase(),
  lower: (t) => t.toLowerCase(),
  title: (t) =>
    t.replace(/\S+/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()),
  sentence: (t) =>
    t.toLowerCase().replace(/(^\s*\w|[.!?]\s+\w)/g, (c) => c.toUpperCase()),
  capitalize: (t) =>
    t.replace(/\b\w/g, (c) => c.toUpperCase()),
  camel: (t) => {
    const words = wordsFrom(t);
    if (!words.length) return t;
    return (
      words[0].toLowerCase() +
      words
        .slice(1)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join("")
    );
  },
  pascal: (t) =>
    wordsFrom(t)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join("") || t,
  snake: (t) =>
    wordsFrom(t)
      .map((w) => w.toLowerCase())
      .join("_") || t,
  kebab: (t) =>
    wordsFrom(t)
      .map((w) => w.toLowerCase())
      .join("-") || t,
  constant: (t) =>
    wordsFrom(t)
      .map((w) => w.toUpperCase())
      .join("_") || t,
};

const CASES = [
  { id: "upper",      label: "UPPERCASE",          icon: "arrow_upward" },
  { id: "lower",      label: "lowercase",           icon: "arrow_downward" },
  { id: "title",      label: "Title Case",          icon: "title" },
  { id: "sentence",   label: "Sentence case",       icon: "format_quote" },
  { id: "capitalize", label: "Capitalize Words",    icon: "format_size" },
  { id: "camel",      label: "camelCase",           icon: "code" },
  { id: "pascal",     label: "PascalCase",          icon: "layers" },
  { id: "snake",      label: "snake_case",          icon: "remove" },
  { id: "kebab",      label: "kebab-case",          icon: "horizontal_rule" },
  { id: "constant",   label: "CONSTANT_CASE",       icon: "priority_high" },
] as const;

type CaseId = (typeof CASES)[number]["id"];

// ── Stats ─────────────────────────────────────────────────────────────────────

function getStats(text: string) {
  return {
    chars:       text.length,
    charsNoSp:   text.replace(/\s/g, "").length,
    words:       text.trim() === "" ? 0 : text.trim().split(/\s+/).length,
    lines:       text === "" ? 0 : text.split("\n").length,
  };
}

// ── Stat chip ─────────────────────────────────────────────────────────────────

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="glass-panel rounded-xl px-4 py-3 flex flex-col gap-0.5 min-w-[100px]">
      <span className="text-[11px] font-semibold text-[#988d9f] uppercase tracking-[0.06em]">
        {label}
      </span>
      <span className="text-[22px] font-extrabold leading-none tracking-tight text-[#4ade80]">
        {value.toLocaleString()}
      </span>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function CaseConverterTool() {
  const [input, setInput]         = useState("");
  const [activeCase, setActiveCase] = useState<CaseId>("upper");
  const [copied, setCopied]       = useState(false);
  const [swapped, setSwapped]     = useState(false);

  const inputRef  = useRef<HTMLTextAreaElement>(null);
  const fileRef   = useRef<HTMLInputElement>(null);

  const output = useMemo(
    () => (input ? CONVERTERS[activeCase](input) : ""),
    [input, activeCase]
  );

  const stats = useMemo(() => getStats(output), [output]);

  // ── Actions ────────────────────────────────────────────────────────────────

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
    a.download = `converted-${activeCase}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [output, activeCase]);

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

  // ── Button style helpers ───────────────────────────────────────────────────

  const actionBtnStyle = {
    background: "rgba(255,255,255,0.06)",
    color: "#988d9f",
    border: "1px solid rgba(255,255,255,0.08)",
  } as const;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="mb-12 flex flex-col gap-5">

      {/* ── Input ────────────────────────────────────────────────────────────── */}
      <div className="glass-panel rounded-2xl p-5 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <label
            htmlFor="case-input"
            className="text-[15px] font-semibold text-[#e2e2e2]"
          >
            Input Text
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handlePaste}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all"
              style={actionBtnStyle}
            >
              <span className="material-symbols-outlined text-[14px]">content_paste</span>
              Paste
            </button>
            <button
              onClick={() => fileRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all"
              style={actionBtnStyle}
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
              style={actionBtnStyle}
            >
              <span className="material-symbols-outlined text-[14px]">delete_sweep</span>
              Clear
            </button>
          </div>
        </div>

        <textarea
          id="case-input"
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Paste or type your text here… the output updates instantly."
          rows={8}
          className="bg-[rgba(0,0,0,0.25)] border border-[rgba(255,255,255,0.08)] rounded-xl px-4 py-3 text-[15px] text-[#e2e2e2] placeholder-[#4d4354] focus:outline-none focus:border-[#4ade80] transition-colors resize-y leading-relaxed w-full"
          aria-label="Text to convert"
          spellCheck={false}
        />
      </div>

      {/* ── Conversion buttons ────────────────────────────────────────────────── */}
      <div className="glass-panel rounded-2xl p-5">
        <p className="text-[12px] font-semibold text-[#988d9f] uppercase tracking-[0.08em] mb-3">
          Select Conversion
        </p>
        <div
          className="grid gap-2"
          style={{ gridTemplateColumns: "repeat(auto-fill, minmax(148px, 1fr))" }}
          role="group"
          aria-label="Case conversion options"
        >
          {CASES.map((c) => {
            const isActive = activeCase === c.id;
            return (
              <button
                key={c.id}
                onClick={() => setActiveCase(c.id)}
                aria-pressed={isActive}
                className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-[13px] font-semibold transition-all text-left"
                style={{
                  background: isActive
                    ? "rgba(74,222,128,0.12)"
                    : "rgba(255,255,255,0.04)",
                  color:  isActive ? "#4ade80" : "#988d9f",
                  border: `1px solid ${isActive ? "rgba(74,222,128,0.35)" : "rgba(255,255,255,0.08)"}`,
                }}
              >
                <span
                  className="material-symbols-outlined text-[16px] shrink-0"
                  aria-hidden="true"
                >
                  {c.icon}
                </span>
                {c.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Output ───────────────────────────────────────────────────────────── */}
      <div className="glass-panel rounded-2xl p-5 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-[15px] font-semibold text-[#e2e2e2]">
              Output
            </span>
            {output && (
              <span
                className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                style={{
                  background: "rgba(74,222,128,0.12)",
                  color: "#4ade80",
                  border: "1px solid rgba(74,222,128,0.25)",
                }}
              >
                {CASES.find((c) => c.id === activeCase)?.label}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleSwap}
              disabled={!output}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all disabled:opacity-40"
              style={actionBtnStyle}
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
                color:  copied ? "#22c55e" : "#988d9f",
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
              style={actionBtnStyle}
            >
              <span className="material-symbols-outlined text-[14px]">download</span>
              Download TXT
            </button>
          </div>
        </div>

        <textarea
          readOnly
          value={output}
          placeholder="Converted text will appear here…"
          rows={8}
          className="bg-[rgba(0,0,0,0.25)] border border-[rgba(255,255,255,0.08)] rounded-xl px-4 py-3 text-[15px] text-[#e2e2e2] placeholder-[#4d4354] focus:outline-none focus:border-[#4ade80] transition-colors resize-y leading-relaxed w-full"
          aria-label="Converted text output"
          aria-live="polite"
          spellCheck={false}
        />
      </div>

      {/* ── Stats ────────────────────────────────────────────────────────────── */}
      <div
        className="grid gap-3"
        style={{ gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))" }}
        aria-label="Output statistics"
      >
        <Stat label="Characters"       value={stats.chars} />
        <Stat label="No Spaces"        value={stats.charsNoSp} />
        <Stat label="Words"            value={stats.words} />
        <Stat label="Lines"            value={stats.lines} />
      </div>
    </div>
  );
}
