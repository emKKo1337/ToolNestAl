"use client";

import { useState, useRef, useCallback, useMemo } from "react";

// ── Constants ─────────────────────────────────────────────────────────────────

const LENGTHS = ["Short", "Medium", "Detailed"] as const;
type LengthOption = (typeof LENGTHS)[number];

interface StyleOption {
  id: "paragraph" | "bullet" | "executive" | "key-takeaways";
  label: string;
  icon: string;
  description: string;
}

const STYLES: StyleOption[] = [
  {
    id: "paragraph",
    label: "Paragraph",
    icon: "subject",
    description: "Flowing prose summary",
  },
  {
    id: "bullet",
    label: "Bullet Points",
    icon: "format_list_bulleted",
    description: "Concise list of points",
  },
  {
    id: "executive",
    label: "Executive Summary",
    icon: "business_center",
    description: "Overview + key findings",
  },
  {
    id: "key-takeaways",
    label: "Key Takeaways",
    icon: "lightbulb",
    description: "Numbered insights",
  },
];

const LANGUAGES = [
  "English",
  "Auto Detect",
  "Bosnian",
  "Croatian",
  "Serbian",
  "Slovenian",
  "German",
  "French",
  "Spanish",
  "Italian",
] as const;

const MAX_CHARS = 50_000;

// ── Helpers ───────────────────────────────────────────────────────────────────

function textStats(text: string) {
  const trimmed = text.trim();
  const wordCount = trimmed === "" ? 0 : trimmed.split(/\s+/).length;
  const charCount = text.length;
  const sec = wordCount === 0 ? 0 : Math.max(1, Math.round((wordCount / 225) * 60));
  const readingTime =
    sec < 60 ? `${sec}s read` : `${Math.floor(sec / 60)}m ${sec % 60}s read`;
  return { wordCount, charCount, readingTime };
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SelectField({
  id,
  label,
  value,
  onChange,
  options,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: readonly string[];
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={id}
        className="text-[13px] font-semibold text-[#988d9f] uppercase tracking-[0.06em]"
      >
        {label}
      </label>
      <div className="relative">
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-[rgba(0,0,0,0.3)] border border-[rgba(255,255,255,0.09)] rounded-xl px-4 py-3 pr-10 text-[14px] text-[#e2e2e2] focus:outline-none focus:border-[#ddb7ff] transition-colors appearance-none cursor-pointer"
        >
          {options.map((o) => (
            <option key={o} value={o} className="bg-[#1a1025]">
              {o}
            </option>
          ))}
        </select>
        <span
          className="material-symbols-outlined pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[18px] text-[#6b5b7a]"
          aria-hidden="true"
        >
          expand_more
        </span>
      </div>
    </div>
  );
}

function ActionButton({
  onClick,
  disabled,
  icon,
  label,
  active,
  activeIcon,
  activeLabel,
  activeColor = "#22c55e",
}: {
  onClick: () => void;
  disabled?: boolean;
  icon: string;
  label: string;
  active?: boolean;
  activeIcon?: string;
  activeLabel?: string;
  activeColor?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
      style={{
        background: active ? `${activeColor}22` : "rgba(255,255,255,0.06)",
        color: active ? activeColor : "#988d9f",
        border: `1px solid ${active ? `${activeColor}44` : "rgba(255,255,255,0.08)"}`,
      }}
    >
      <span className="material-symbols-outlined text-[14px]">
        {active && activeIcon ? activeIcon : icon}
      </span>
      {active && activeLabel ? activeLabel : label}
    </button>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function AiTextSummarizerTool() {
  // ── Input state ──────────────────────────────────────────────────────────
  const [inputText, setInputText] = useState("");
  const [style, setStyle] = useState<StyleOption["id"]>("paragraph");
  const [length, setLength] = useState<LengthOption>("Medium");
  const [language, setLanguage] = useState("English");

  // ── Output state ─────────────────────────────────────────────────────────
  const [summary, setSummary] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // ── UI state ─────────────────────────────────────────────────────────────
  const [copied, setCopied] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [inputError, setInputError] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const outputRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const inputStats = useMemo(() => textStats(inputText), [inputText]);
  const outputStats = useMemo(() => textStats(summary), [summary]);
  const hasOutput = summary.trim().length > 0;
  const charPct = Math.min(100, (inputText.length / MAX_CHARS) * 100);

  // ── Core generate ────────────────────────────────────────────────────────

  const generate = useCallback(
    async (params: {
      text: string;
      style: StyleOption["id"];
      length: LengthOption;
      language: string;
    }) => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;

      setIsLoading(true);
      setErrorMsg(null);
      setSummary("");

      const apiLength =
        params.length === "Detailed" ? "long" : params.length.toLowerCase();

      try {
        const res = await fetch("/api/ai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            task: "summarize",
            payload: {
              text: params.text,
              style: params.style,
              length: apiLength,
              language: params.language,
            },
            options: { stream: true },
          }),
          signal: ctrl.signal,
        });

        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          throw new Error(
            (json as { message?: string }).message ?? `Server error ${res.status}`
          );
        }

        const reader = res.body?.getReader();
        if (!reader) throw new Error("No response stream.");

        const decoder = new TextDecoder();
        let accumulated = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          accumulated += decoder.decode(value, { stream: true });
          setSummary(accumulated);
        }

        setTimeout(() => {
          outputRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 100);
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") return;
        setErrorMsg(
          err instanceof Error ? err.message : "Something went wrong. Please try again."
        );
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleGenerate = useCallback(async () => {
    if (!inputText.trim()) {
      setInputError(true);
      textareaRef.current?.focus();
      return;
    }
    setInputError(false);
    await generate({ text: inputText, style, length, language });
  }, [inputText, style, length, language, generate]);

  const handleRegenerate = useCallback(async () => {
    if (!inputText.trim()) return;
    await generate({ text: inputText, style, length, language });
  }, [inputText, style, length, language, generate]);

  const handleCopy = useCallback(async () => {
    if (!summary) return;
    await navigator.clipboard.writeText(summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [summary]);

  const handleDownload = useCallback(() => {
    if (!summary) return;
    const blob = new Blob([summary], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "summary.txt";
    a.click();
    URL.revokeObjectURL(url);
    setDownloaded(true);
    setTimeout(() => setDownloaded(false), 2000);
  }, [summary]);

  const handleClear = useCallback(() => {
    setSummary("");
    setErrorMsg(null);
  }, []);

  const handleStartOver = useCallback(() => {
    abortRef.current?.abort();
    setInputText("");
    setStyle("paragraph");
    setLength("Medium");
    setLanguage("English");
    setSummary("");
    setErrorMsg(null);
    setInputError(false);
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value.slice(0, MAX_CHARS);
    setInputText(val);
    if (val.trim()) setInputError(false);
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="mb-12 flex flex-col gap-8">

      {/* ── Style selector ── */}
      <div>
        <p className="text-[13px] font-semibold text-[#988d9f] uppercase tracking-[0.06em] mb-3">
          Summary Style
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {STYLES.map((s) => {
            const isActive = style === s.id;
            return (
              <button
                key={s.id}
                onClick={() => setStyle(s.id)}
                aria-pressed={isActive}
                className="flex flex-col items-center gap-2 px-3 py-4 rounded-xl text-center transition-all duration-200"
                style={{
                  background: isActive ? "rgba(221,183,255,0.12)" : "rgba(255,255,255,0.04)",
                  border: `1px solid ${isActive ? "rgba(221,183,255,0.35)" : "rgba(255,255,255,0.07)"}`,
                  color: isActive ? "#ddb7ff" : "#988d9f",
                }}
              >
                <span
                  className="material-symbols-outlined text-[22px]"
                  style={{
                    color: isActive ? "#ddb7ff" : "#6b5b7a",
                    fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0",
                  }}
                  aria-hidden="true"
                >
                  {s.icon}
                </span>
                <div>
                  <p className="text-[12px] font-semibold leading-tight">{s.label}</p>
                  <p
                    className="text-[11px] mt-0.5 leading-tight"
                    style={{ color: isActive ? "rgba(221,183,255,0.6)" : "#4d4354" }}
                  >
                    {s.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Main two-column layout ── */}
      <div className="grid lg:grid-cols-2 gap-6 items-start">

        {/* ── LEFT: Input ── */}
        <div className="glass-panel rounded-2xl p-6 flex flex-col gap-5">
          <div className="flex items-center justify-between">
            <p className="text-[15px] font-bold text-[#e2e2e2]">Paste Your Text</p>
            <div className="flex items-center gap-3 text-[12px] text-[#6b5b7a]">
              <span>
                <span className="text-[#988d9f] font-medium">
                  {inputStats.wordCount.toLocaleString()}
                </span>{" "}
                words
              </span>
              <span>
                <span className="text-[#988d9f] font-medium">
                  {inputStats.readingTime}
                </span>
              </span>
            </div>
          </div>

          {/* Textarea */}
          <div className="flex flex-col gap-1.5">
            <textarea
              ref={textareaRef}
              value={inputText}
              onChange={handleInputChange}
              placeholder="Paste an article, document, research paper, report, or any long-form text here…"
              rows={14}
              aria-label="Text to summarize"
              aria-describedby={inputError ? "input-error" : "char-counter"}
              aria-invalid={inputError}
              className="w-full bg-[rgba(0,0,0,0.25)] rounded-xl px-4 py-3 text-[14px] text-[#e2e2e2] placeholder-[#4d4354] focus:outline-none transition-colors resize-y leading-relaxed"
              style={{
                border: `1px solid ${inputError ? "rgba(239,68,68,0.6)" : "rgba(255,255,255,0.09)"}`,
                minHeight: "280px",
              }}
            />
            {inputError && (
              <p id="input-error" role="alert" className="text-[12px] text-[#ef4444]">
                Please paste some text to summarize.
              </p>
            )}
            {/* Character bar */}
            <div className="flex items-center justify-between">
              <div className="flex-1 h-1 rounded-full bg-[rgba(255,255,255,0.06)] mr-3 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${charPct}%`,
                    background:
                      charPct > 90
                        ? "#ef4444"
                        : charPct > 70
                        ? "#f59e0b"
                        : "linear-gradient(90deg, #ddb7ff, #4cd7f6)",
                  }}
                />
              </div>
              <p
                id="char-counter"
                className="text-[11px] tabular-nums flex-shrink-0"
                style={{ color: charPct > 90 ? "#ef4444" : "#4d4354" }}
              >
                {inputText.length.toLocaleString()} / {MAX_CHARS.toLocaleString()}
              </p>
            </div>
          </div>

          {/* Options row */}
          <div className="grid grid-cols-2 gap-4">
            <SelectField
              id="summary-length"
              label="Length"
              value={length}
              onChange={(v) => setLength(v as LengthOption)}
              options={LENGTHS}
            />
            <SelectField
              id="summary-language"
              label="Language"
              value={language}
              onChange={setLanguage}
              options={LANGUAGES}
            />
          </div>

          {/* Generate button */}
          <button
            onClick={handleGenerate}
            disabled={isLoading}
            aria-label="Generate summary"
            className="relative w-full py-4 rounded-xl text-[15px] font-bold tracking-[0.02em] transition-all duration-200 overflow-hidden disabled:opacity-70 disabled:cursor-not-allowed"
            style={{
              background: isLoading
                ? "rgba(221,183,255,0.12)"
                : "linear-gradient(135deg, #ddb7ff 0%, #4cd7f6 100%)",
              color: isLoading ? "#ddb7ff" : "#131313",
              boxShadow: isLoading ? "none" : "0 0 24px rgba(221,183,255,0.2)",
            }}
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-3">
                <span className="inline-block w-4 h-4 border-2 border-[#ddb7ff] border-t-transparent rounded-full animate-spin" />
                Summarizing…
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <span
                  className="material-symbols-outlined text-[18px]"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                  aria-hidden="true"
                >
                  auto_awesome
                </span>
                Generate Summary
              </span>
            )}
          </button>
        </div>

        {/* ── RIGHT: Output ── */}
        <div ref={outputRef} className="flex flex-col gap-4">

          {/* Empty state */}
          {!hasOutput && !isLoading && !errorMsg && (
            <div
              className="glass-panel rounded-2xl p-10 flex flex-col items-center justify-center text-center gap-4"
              style={{ minHeight: "420px" }}
              aria-live="polite"
              aria-label="Output area — waiting for generation"
            >
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center"
                style={{ background: "rgba(221,183,255,0.08)" }}
              >
                <span
                  className="material-symbols-outlined text-[32px] text-[#ddb7ff]"
                  style={{ fontVariationSettings: "'FILL' 0" }}
                  aria-hidden="true"
                >
                  summarize
                </span>
              </div>
              <div>
                <p className="text-[16px] font-semibold text-[#e2e2e2] mb-1">
                  Your summary will appear here
                </p>
                <p className="text-[13px] text-[#6b5b7a] max-w-[260px] leading-relaxed">
                  Paste your text on the left, choose a style and length, then click{" "}
                  <strong className="text-[#9b8da8]">Generate Summary</strong>.
                </p>
              </div>
            </div>
          )}

          {/* Loading skeleton */}
          {isLoading && !hasOutput && (
            <div className="glass-panel rounded-2xl overflow-hidden">
              <div
                className="px-6 py-4 border-b border-[rgba(255,255,255,0.06)]"
                style={{ background: "rgba(0,0,0,0.2)" }}
              >
                <div className="h-4 w-36 rounded animate-pulse bg-[rgba(255,255,255,0.07)]" />
              </div>
              <div className="px-6 py-5 flex flex-col gap-3">
                {[96, 82, 90, 68, 76, 88, 60].map((w, i) => (
                  <div
                    key={i}
                    className="h-3 rounded animate-pulse"
                    style={{
                      width: `${w}%`,
                      background: "rgba(255,255,255,0.06)",
                      animationDelay: `${i * 60}ms`,
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Output card */}
          {(hasOutput || (isLoading && summary)) && (
            <>
              {/* Stats bar */}
              {hasOutput && (
                <div className="flex flex-wrap items-center gap-4 px-1">
                  {[
                    { icon: "schedule", color: "#4cd7f6", value: outputStats.readingTime },
                    { icon: "text_fields", color: "#ddb7ff", value: `${outputStats.wordCount.toLocaleString()} words` },
                    { icon: "abc", color: "#adc6ff", value: `${outputStats.charCount.toLocaleString()} chars` },
                  ].map(({ icon, color, value }) => (
                    <span key={value} className="flex items-center gap-1.5 text-[12px] text-[#988d9f]">
                      <span className="material-symbols-outlined text-[14px]" style={{ color }} aria-hidden="true">
                        {icon}
                      </span>
                      {value}
                    </span>
                  ))}
                </div>
              )}

              {/* Card */}
              <div
                className="glass-panel rounded-2xl overflow-hidden"
                aria-live="polite"
                aria-label="Generated summary"
              >
                {/* Card header */}
                <div
                  className="px-6 py-4 flex items-center gap-3 border-b border-[rgba(255,255,255,0.06)]"
                  style={{ background: "rgba(0,0,0,0.2)" }}
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: "rgba(221,183,255,0.1)" }}
                  >
                    <span
                      className="material-symbols-outlined text-[16px] text-[#ddb7ff]"
                      style={{
                        fontVariationSettings: "'FILL' 1",
                      }}
                      aria-hidden="true"
                    >
                      {STYLES.find((s) => s.id === style)?.icon ?? "summarize"}
                    </span>
                  </div>
                  <div>
                    <p className="text-[14px] font-semibold text-[#e2e2e2]">
                      {STYLES.find((s) => s.id === style)?.label ?? "Summary"}
                    </p>
                    <p className="text-[12px] text-[#6b5b7a] mt-0.5">
                      {length} · {language}
                    </p>
                  </div>
                </div>

                {/* Body */}
                <div className="px-6 py-5">
                  <pre className="text-[14px] text-[#cfc2d6] leading-[1.8] whitespace-pre-wrap font-sans">
                    {summary}
                    {isLoading && (
                      <span
                        className="inline-block w-0.5 h-4 bg-[#ddb7ff] ml-0.5 align-middle animate-pulse"
                        aria-hidden="true"
                      />
                    )}
                  </pre>
                </div>
              </div>

              {/* Action buttons */}
              {hasOutput && !isLoading && (
                <div className="flex flex-wrap gap-2">
                  <ActionButton
                    onClick={handleCopy}
                    icon="content_copy"
                    label="Copy summary"
                    active={copied}
                    activeIcon="check"
                    activeLabel="Copied!"
                  />
                  <ActionButton
                    onClick={handleRegenerate}
                    icon="refresh"
                    label="Regenerate"
                  />
                  <ActionButton
                    onClick={handleDownload}
                    icon="download"
                    label="Download TXT"
                    active={downloaded}
                    activeIcon="check"
                    activeLabel="Saved!"
                  />
                  <ActionButton
                    onClick={handleClear}
                    icon="delete_sweep"
                    label="Clear output"
                  />
                  <ActionButton
                    onClick={handleStartOver}
                    icon="restart_alt"
                    label="Start over"
                  />
                </div>
              )}
            </>
          )}

          {/* Error state */}
          {errorMsg && !isLoading && (
            <div
              className="glass-panel rounded-2xl p-6 flex flex-col gap-3"
              role="alert"
              style={{ border: "1px solid rgba(239,68,68,0.3)" }}
            >
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-[#ef4444]" aria-hidden="true">
                  error
                </span>
                <p className="text-[14px] font-semibold text-[#ef4444]">Summarization failed</p>
              </div>
              <p className="text-[13px] text-[#9b8da8]">{errorMsg}</p>
              <button
                onClick={handleRegenerate}
                className="self-start flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-semibold transition-all"
                style={{
                  background: "rgba(239,68,68,0.1)",
                  color: "#ef4444",
                  border: "1px solid rgba(239,68,68,0.2)",
                }}
              >
                <span className="material-symbols-outlined text-[14px]">refresh</span>
                Try again
              </button>
            </div>
          )}

          {/* Privacy note */}
          <p className="text-[12px] text-[#4d4354] px-1">
            Your text is processed securely and never permanently stored.
          </p>
        </div>
      </div>
    </div>
  );
}
