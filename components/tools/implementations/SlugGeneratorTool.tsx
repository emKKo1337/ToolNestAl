"use client";

import { useState, useMemo, useRef, useCallback } from "react";

// ── Accent map ────────────────────────────────────────────────────────────────

const ACCENT_MAP: Record<string, string> = {
  à:"a",á:"a",â:"a",ã:"a",ä:"a",å:"a",æ:"ae",
  ç:"c",č:"c",ć:"c",
  è:"e",é:"e",ê:"e",ë:"e",ě:"e",
  ì:"i",í:"i",î:"i",ï:"i",
  ñ:"n",ň:"n",
  ò:"o",ó:"o",ô:"o",õ:"o",ö:"o",ø:"o",
  ř:"r",
  š:"s",ś:"s",
  ù:"u",ú:"u",û:"u",ü:"u",ů:"u",
  ý:"y",ÿ:"y",
  ž:"z",ź:"z",ż:"z",
  ß:"ss",þ:"th",ð:"d",
};

function removeAccents(str: string): string {
  return str
    .split("")
    .map((c) => ACCENT_MAP[c] ?? ACCENT_MAP[c.toLowerCase()] ?? c)
    .join("");
}

// ── Core logic ────────────────────────────────────────────────────────────────

interface Options {
  lowercase: boolean;
  removeAccentsOpt: boolean;
  removeSpecial: boolean;
  removePunctuation: boolean;
  separator: "-" | "_";
  collapseMultiple: boolean;
  trimSeparators: boolean;
}

function generateSlug(text: string, opts: Options): string {
  if (!text.trim()) return "";

  let s = text;

  if (opts.lowercase)           s = s.toLowerCase();
  if (opts.removeAccentsOpt)    s = removeAccents(s);
  if (opts.removePunctuation)   s = s.replace(/[!"#%&'()*+,./:;<=>?@[\\\]^`{|}~]/g, " ");
  if (opts.removeSpecial)       s = s.replace(/[^a-zA-Z0-9\s\-_]/g, " ");

  // Replace whitespace runs with the separator
  s = s.replace(/\s+/g, opts.separator);

  if (opts.collapseMultiple) {
    const sep = opts.separator === "-" ? "-" : "_";
    s = s.replace(new RegExp(`[${sep}]+`, "g"), sep);
  }

  if (opts.trimSeparators) {
    const sep = opts.separator === "-" ? "-" : "_";
    s = s.replace(new RegExp(`^[${sep}]+|[${sep}]+$`, "g"), "");
  }

  return s;
}

function getStats(input: string, slug: string) {
  const inputWords = input.trim() === "" ? 0 : input.trim().split(/\s+/).length;
  const inputChars = input.length;
  const slugLength = slug.length;
  return { inputWords, inputChars, slugLength };
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

export default function SlugGeneratorTool() {
  const [input, setInput]                     = useState("");
  const [lowercase, setLowercase]             = useState(true);
  const [removeAccentsOpt, setRemoveAccents]  = useState(true);
  const [removeSpecial, setRemoveSpecial]     = useState(true);
  const [removePunctuation, setRemovePunctuation] = useState(true);
  const [separator, setSeparator]             = useState<"-" | "_">("-");
  const [collapseMultiple, setCollapseMultiple] = useState(true);
  const [trimSeparators, setTrimSeparators]   = useState(true);
  const [copied, setCopied]                   = useState(false);
  const [swapped, setSwapped]                 = useState(false);

  const inputRef = useRef<HTMLTextAreaElement>(null);

  const opts: Options = {
    lowercase, removeAccentsOpt, removeSpecial, removePunctuation,
    separator, collapseMultiple, trimSeparators,
  };

  // Live generation
  const slug = useMemo(() => generateSlug(input, opts), [input, lowercase, removeAccentsOpt, removeSpecial, removePunctuation, separator, collapseMultiple, trimSeparators]);

  const stats = useMemo(() => getStats(input, slug), [input, slug]);

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
    if (!slug) return;
    setInput(slug);
    setSwapped((s) => !s);
    setTimeout(() => setSwapped((s) => !s), 700);
  }, [slug]);

  const handleCopy = useCallback(async () => {
    if (!slug) return;
    await navigator.clipboard.writeText(slug);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [slug]);

  const handleDownload = useCallback(() => {
    if (!slug) return;
    const blob = new Blob([slug], { type: "text/plain;charset=utf-8" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = "slug.txt";
    a.click();
    URL.revokeObjectURL(url);
  }, [slug]);

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

        {/* Separator picker */}
        <div className="flex items-center gap-3 mb-5">
          <span className="text-[13px] font-semibold text-[#988d9f] uppercase tracking-[0.06em] shrink-0">
            Separator
          </span>
          <div className="flex gap-2">
            {(["-", "_"] as const).map((sep) => (
              <button
                key={sep}
                onClick={() => setSeparator(sep)}
                aria-pressed={separator === sep}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[13px] font-bold transition-all font-mono"
                style={{
                  background: separator === sep ? "rgba(74,222,128,0.12)" : "rgba(255,255,255,0.04)",
                  color: separator === sep ? "#4ade80" : "#988d9f",
                  border: `1px solid ${separator === sep ? "rgba(74,222,128,0.35)" : "rgba(255,255,255,0.08)"}`,
                }}
              >
                {sep === "-" ? "Hyphen  (-)" : "Underscore (_)"}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Toggle id="lowercase"         label="Lowercase output"                     checked={lowercase}         onChange={setLowercase} />
          <Toggle id="remove-accents"    label="Remove accents (é → e, ü → u)"       checked={removeAccentsOpt}  onChange={setRemoveAccents} />
          <Toggle id="remove-special"    label="Remove special characters"            checked={removeSpecial}     onChange={setRemoveSpecial} />
          <Toggle id="remove-punct"      label="Remove punctuation"                   checked={removePunctuation} onChange={setRemovePunctuation} />
          <Toggle id="collapse-multiple" label="Collapse multiple separators into one" checked={collapseMultiple} onChange={setCollapseMultiple} />
          <Toggle id="trim-separators"   label="Trim leading / trailing separators"   checked={trimSeparators}    onChange={setTrimSeparators} />
        </div>
      </div>

      {/* ── Input ────────────────────────────────────────────────────────── */}
      <div className="glass-panel rounded-2xl p-5 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <label htmlFor="sg-input" className="text-[15px] font-semibold text-[#e2e2e2]">
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
          id="sg-input"
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type or paste text here… the slug is generated instantly."
          rows={6}
          className="bg-[rgba(0,0,0,0.25)] border border-[rgba(255,255,255,0.08)] rounded-xl px-4 py-3 text-[15px] text-[#e2e2e2] placeholder-[#4d4354] focus:outline-none focus:border-[#4ade80] transition-colors resize-y leading-relaxed w-full"
          aria-label="Text to slugify"
          spellCheck={false}
        />
      </div>

      {/* ── Slug output ───────────────────────────────────────────────────── */}
      <div className="glass-panel rounded-2xl p-5 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-[15px] font-semibold text-[#e2e2e2]">Generated Slug</span>
            {slug && (
              <span
                className="text-[11px] font-semibold px-2 py-0.5 rounded-full font-mono"
                style={{
                  background: "rgba(74,222,128,0.12)",
                  color: "#4ade80",
                  border: "1px solid rgba(74,222,128,0.25)",
                }}
              >
                {stats.slugLength} chars
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleSwap}
              disabled={!slug}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all disabled:opacity-40"
              style={btnBase}
              title="Use slug as input"
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
              disabled={!slug}
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
              disabled={!slug}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all disabled:opacity-40"
              style={btnBase}
            >
              <span className="material-symbols-outlined text-[14px]">download</span>
              Download TXT
            </button>
          </div>
        </div>

        {/* Slug display — monospace, prominent */}
        <div
          className="rounded-xl px-4 py-4 min-h-[56px] flex items-center break-all"
          style={{
            background: "rgba(0,0,0,0.3)",
            border: slug
              ? "1px solid rgba(74,222,128,0.25)"
              : "1px solid rgba(255,255,255,0.06)",
          }}
          aria-live="polite"
          aria-label="Generated slug"
        >
          {slug ? (
            <span
              className="font-mono text-[16px] leading-relaxed tracking-wide select-all"
              style={{ color: "#4ade80" }}
            >
              {slug}
            </span>
          ) : (
            <span className="text-[15px]" style={{ color: "#4d4354" }}>
              Your slug will appear here…
            </span>
          )}
        </div>

        {/* URL preview */}
        {slug && (
          <p
            className="text-[12px] font-mono leading-relaxed break-all"
            style={{ color: "#5a4d63" }}
            aria-label="URL preview"
          >
            https://example.com/<span style={{ color: "#988d9f" }}>{slug}</span>
          </p>
        )}
      </div>

      {/* ── Stats ────────────────────────────────────────────────────────── */}
      <div
        className="grid gap-3"
        style={{ gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))" }}
        aria-label="Statistics"
      >
        <Stat label="Input Chars"  value={stats.inputChars}  color="#988d9f" />
        <Stat label="Input Words"  value={stats.inputWords}  color="#adc6ff" />
        <Stat label="Slug Length"  value={stats.slugLength}  color="#4ade80" />
      </div>
    </div>
  );
}
