"use client";

import { useState, useRef, useCallback, useMemo } from "react";
import type { TranslationStyle } from "@/types/ai";

// ── Constants ─────────────────────────────────────────────────────────────────

const LANGUAGES = [
  "Auto Detect",
  "English",
  "Bosnian",
  "Croatian",
  "Serbian",
  "Slovenian",
  "German",
  "French",
  "Spanish",
  "Italian",
] as const;
type Language = (typeof LANGUAGES)[number];

const TARGET_LANGUAGES = LANGUAGES.filter((l) => l !== "Auto Detect") as Exclude<
  Language,
  "Auto Detect"
>[];

interface StyleOption {
  id: TranslationStyle;
  label: string;
  icon: string;
  description: string;
}

const STYLES: StyleOption[] = [
  { id: "standard",     label: "Standard",     icon: "translate",        description: "Accurate & faithful" },
  { id: "professional", label: "Professional",  icon: "business_center",  description: "Business-ready" },
  { id: "formal",       label: "Formal",        icon: "gavel",            description: "Official tone" },
  { id: "casual",       label: "Casual",        icon: "sentiment_satisfied", description: "Conversational" },
  { id: "natural",      label: "Natural",       icon: "water_drop",       description: "Reads natively" },
  { id: "academic",     label: "Academic",      icon: "school",           description: "Scholarly precision" },
];

const MAX_CHARS = 10_000;

// ── Helpers ───────────────────────────────────────────────────────────────────

function textStats(text: string) {
  const trimmed = text.trim();
  const wordCount = trimmed === "" ? 0 : trimmed.split(/\s+/).length;
  const charCount = text.length;
  return { wordCount, charCount };
}

// ── Sub-components ────────────────────────────────────────────────────────────

function LangSelect({
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

export default function AiTranslatorTool() {
  // ── Input state ──────────────────────────────────────────────────────────
  const [inputText, setInputText]           = useState("");
  const [sourceLanguage, setSourceLanguage] = useState<Language>("Auto Detect");
  const [targetLanguage, setTargetLanguage] = useState<Exclude<Language,"Auto Detect">>("Spanish");
  const [style, setStyle]                   = useState<TranslationStyle>("standard");
  const [preserveFormatting, setPreserveFormatting] = useState(false);

  // ── Output state ─────────────────────────────────────────────────────────
  const [translation, setTranslation]     = useState("");
  const [detectedLang, setDetectedLang]   = useState<string | null>(null);
  const [isLoading, setIsLoading]         = useState(false);
  const [errorMsg, setErrorMsg]           = useState<string | null>(null);

  // ── UI state ─────────────────────────────────────────────────────────────
  const [copied, setCopied]         = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [inputError, setInputError] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const outputRef   = useRef<HTMLDivElement>(null);
  const abortRef    = useRef<AbortController | null>(null);

  const inputStats  = useMemo(() => textStats(inputText), [inputText]);
  const outputStats = useMemo(() => textStats(translation), [translation]);
  const hasOutput   = translation.trim().length > 0;
  const charPct     = Math.min(100, (inputText.length / MAX_CHARS) * 100);

  // ── Core generate ─────────────────────────────────────────────────────────

  const translate = useCallback(
    async (params: {
      text: string;
      sourceLanguage: Language;
      targetLanguage: string;
      style: TranslationStyle;
      preserveFormatting: boolean;
    }) => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;

      setIsLoading(true);
      setErrorMsg(null);
      setTranslation("");
      setDetectedLang(null);

      try {
        const res = await fetch("/api/ai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            task: "translate",
            payload: {
              text: params.text,
              targetLanguage: params.targetLanguage,
              sourceLanguage:
                params.sourceLanguage === "Auto Detect" ? undefined : params.sourceLanguage,
              style: params.style,
              preserveFormatting: params.preserveFormatting,
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
          setTranslation(accumulated);
        }

        // Infer detected language from source selection
        if (params.sourceLanguage === "Auto Detect") {
          setDetectedLang("Auto-detected");
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

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleTranslate = useCallback(async () => {
    if (!inputText.trim()) {
      setInputError(true);
      textareaRef.current?.focus();
      return;
    }
    setInputError(false);
    await translate({ text: inputText, sourceLanguage, targetLanguage, style, preserveFormatting });
  }, [inputText, sourceLanguage, targetLanguage, style, preserveFormatting, translate]);

  const handleRegenerate = useCallback(async () => {
    if (!inputText.trim()) return;
    await translate({ text: inputText, sourceLanguage, targetLanguage, style, preserveFormatting });
  }, [inputText, sourceLanguage, targetLanguage, style, preserveFormatting, translate]);

  const handleSwapLanguages = useCallback(() => {
    if (sourceLanguage === "Auto Detect") return;
    const prevSource = sourceLanguage as Exclude<Language, "Auto Detect">;
    const prevTarget = targetLanguage;
    setSourceLanguage(prevTarget as Language);
    setTargetLanguage(prevSource);
    // If we have a translation, swap input/output
    if (translation) {
      setInputText(translation);
      setTranslation("");
      setErrorMsg(null);
    }
  }, [sourceLanguage, targetLanguage, translation]);

  const handleCopy = useCallback(async () => {
    if (!translation) return;
    await navigator.clipboard.writeText(translation);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [translation]);

  const handleDownload = useCallback(() => {
    if (!translation) return;
    const blob = new Blob([translation], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "translation.txt";
    a.click();
    URL.revokeObjectURL(url);
    setDownloaded(true);
    setTimeout(() => setDownloaded(false), 2000);
  }, [translation]);

  const handleClear = useCallback(() => {
    setTranslation("");
    setErrorMsg(null);
    setDetectedLang(null);
  }, []);

  const handleStartOver = useCallback(() => {
    abortRef.current?.abort();
    setInputText("");
    setSourceLanguage("Auto Detect");
    setTargetLanguage("Spanish");
    setStyle("standard");
    setPreserveFormatting(false);
    setTranslation("");
    setErrorMsg(null);
    setDetectedLang(null);
    setInputError(false);
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value.slice(0, MAX_CHARS);
    setInputText(val);
    if (val.trim()) setInputError(false);
  }, []);

  const canSwap = sourceLanguage !== "Auto Detect";
  const activeStyle = STYLES.find((s) => s.id === style)!;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="mb-12 flex flex-col gap-8">

      {/* ── Style selector ── */}
      <div>
        <p className="text-[13px] font-semibold text-[#988d9f] uppercase tracking-[0.06em] mb-3">
          Translation Style
        </p>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {STYLES.map((s) => {
            const isActive = style === s.id;
            return (
              <button
                key={s.id}
                onClick={() => setStyle(s.id)}
                aria-pressed={isActive}
                className="flex flex-col items-center gap-1.5 px-2 py-3 rounded-xl text-center transition-all duration-200"
                style={{
                  background: isActive ? "rgba(221,183,255,0.12)" : "rgba(255,255,255,0.04)",
                  border: `1px solid ${isActive ? "rgba(221,183,255,0.35)" : "rgba(255,255,255,0.07)"}`,
                  color: isActive ? "#ddb7ff" : "#988d9f",
                }}
              >
                <span
                  className="material-symbols-outlined text-[20px]"
                  style={{
                    color: isActive ? "#ddb7ff" : "#6b5b7a",
                    fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0",
                  }}
                  aria-hidden="true"
                >
                  {s.icon}
                </span>
                <p className="text-[11px] font-semibold leading-tight">{s.label}</p>
                <p
                  className="text-[10px] leading-tight hidden sm:block"
                  style={{ color: isActive ? "rgba(221,183,255,0.55)" : "#4d4354" }}
                >
                  {s.description}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Language bar ── */}
      <div className="flex items-end gap-3">
        <div className="flex-1">
          <LangSelect
            id="source-language"
            label="From"
            value={sourceLanguage}
            onChange={(v) => setSourceLanguage(v as Language)}
            options={LANGUAGES}
          />
        </div>

        {/* Swap button */}
        <button
          onClick={handleSwapLanguages}
          disabled={!canSwap}
          aria-label="Swap source and target languages"
          title={canSwap ? "Swap languages" : "Cannot swap when source is Auto Detect"}
          className="mb-0.5 flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-200 flex-shrink-0 disabled:opacity-30 disabled:cursor-not-allowed"
          style={{
            background: canSwap ? "rgba(221,183,255,0.1)" : "rgba(255,255,255,0.04)",
            border: `1px solid ${canSwap ? "rgba(221,183,255,0.25)" : "rgba(255,255,255,0.07)"}`,
          }}
        >
          <span
            className="material-symbols-outlined text-[18px]"
            style={{ color: canSwap ? "#ddb7ff" : "#4d4354" }}
            aria-hidden="true"
          >
            swap_horiz
          </span>
        </button>

        <div className="flex-1">
          <LangSelect
            id="target-language"
            label="To"
            value={targetLanguage}
            onChange={(v) => setTargetLanguage(v as Exclude<Language, "Auto Detect">)}
            options={TARGET_LANGUAGES}
          />
        </div>
      </div>

      {/* ── Main two-column layout ── */}
      <div className="grid lg:grid-cols-2 gap-6 items-start">

        {/* ── LEFT: Input ── */}
        <div className="glass-panel rounded-2xl p-6 flex flex-col gap-5">
          <div className="flex items-center justify-between">
            <p className="text-[15px] font-bold text-[#e2e2e2]">Text to Translate</p>
            <div className="flex items-center gap-3 text-[12px] text-[#6b5b7a]">
              <span>
                <span className="text-[#988d9f] font-medium">
                  {inputStats.wordCount.toLocaleString()}
                </span>{" "}
                words
              </span>
              <span>
                <span
                  className="font-medium"
                  style={{ color: charPct > 90 ? "#ef4444" : "#988d9f" }}
                >
                  {inputStats.charCount.toLocaleString()}
                </span>{" "}
                chars
              </span>
            </div>
          </div>

          {/* Textarea */}
          <div className="flex flex-col gap-1.5">
            <textarea
              ref={textareaRef}
              value={inputText}
              onChange={handleInputChange}
              placeholder="Paste or type the text you want to translate here…"
              rows={12}
              aria-label="Text to translate"
              aria-describedby={inputError ? "input-error" : "char-counter"}
              aria-invalid={inputError}
              className="w-full bg-[rgba(0,0,0,0.25)] rounded-xl px-4 py-3 text-[14px] text-[#e2e2e2] placeholder-[#4d4354] focus:outline-none transition-colors resize-y leading-relaxed"
              style={{
                border: `1px solid ${inputError ? "rgba(239,68,68,0.6)" : "rgba(255,255,255,0.09)"}`,
                minHeight: "240px",
              }}
            />
            {inputError && (
              <p id="input-error" role="alert" className="text-[12px] text-[#ef4444]">
                Please enter some text to translate.
              </p>
            )}
            {/* Char bar */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-1 rounded-full bg-[rgba(255,255,255,0.06)] overflow-hidden">
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

          {/* Preserve formatting toggle */}
          <label className="flex items-center gap-3 cursor-pointer select-none group">
            <div
              onClick={() => setPreserveFormatting((p) => !p)}
              className="relative w-9 h-5 rounded-full transition-colors duration-200 flex-shrink-0"
              style={{
                background: preserveFormatting
                  ? "rgba(221,183,255,0.4)"
                  : "rgba(255,255,255,0.1)",
                border: `1px solid ${preserveFormatting ? "rgba(221,183,255,0.6)" : "rgba(255,255,255,0.15)"}`,
              }}
              role="switch"
              aria-checked={preserveFormatting}
              aria-label="Preserve formatting"
              tabIndex={0}
              onKeyDown={(e) => e.key === " " && setPreserveFormatting((p) => !p)}
            >
              <div
                className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full transition-all duration-200"
                style={{
                  background: preserveFormatting ? "#ddb7ff" : "rgba(255,255,255,0.4)",
                  transform: preserveFormatting ? "translateX(16px)" : "translateX(0)",
                }}
              />
            </div>
            <div>
              <span className="text-[13px] font-semibold text-[#988d9f]">
                Preserve formatting
              </span>
              <span className="text-[12px] text-[#4d4354] ml-2">
                Keep paragraph breaks and lists
              </span>
            </div>
          </label>

          {/* Translate button */}
          <button
            onClick={handleTranslate}
            disabled={isLoading}
            aria-label="Translate text"
            className="relative w-full py-4 rounded-xl text-[15px] font-bold tracking-[0.02em] transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed"
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
                Translating…
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <span
                  className="material-symbols-outlined text-[18px]"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                  aria-hidden="true"
                >
                  translate
                </span>
                Translate
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
              style={{ minHeight: "400px" }}
              aria-live="polite"
              aria-label="Translation output — waiting"
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
                  translate
                </span>
              </div>
              <div>
                <p className="text-[16px] font-semibold text-[#e2e2e2] mb-1">
                  Your translation will appear here
                </p>
                <p className="text-[13px] text-[#6b5b7a] max-w-[260px] leading-relaxed">
                  Enter text on the left, choose the target language, then click{" "}
                  <strong className="text-[#9b8da8]">Translate</strong>.
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
                <div className="h-4 w-44 rounded animate-pulse bg-[rgba(255,255,255,0.07)]" />
              </div>
              <div className="px-6 py-5 flex flex-col gap-3">
                {[92, 78, 88, 64, 80, 72, 84].map((w, i) => (
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
          {(hasOutput || (isLoading && translation)) && (
            <>
              {/* Stats bar */}
              {hasOutput && (
                <div className="flex flex-wrap items-center gap-4 px-1">
                  {[
                    {
                      icon: "text_fields",
                      color: "#ddb7ff",
                      value: `${outputStats.wordCount.toLocaleString()} words`,
                    },
                    {
                      icon: "abc",
                      color: "#adc6ff",
                      value: `${outputStats.charCount.toLocaleString()} chars`,
                    },
                    ...(detectedLang
                      ? [{ icon: "language", color: "#4cd7f6", value: detectedLang }]
                      : []),
                  ].map(({ icon, color, value }) => (
                    <span
                      key={value}
                      className="flex items-center gap-1.5 text-[12px] text-[#988d9f]"
                    >
                      <span
                        className="material-symbols-outlined text-[14px]"
                        style={{ color }}
                        aria-hidden="true"
                      >
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
                aria-label="Translation output"
              >
                {/* Card header */}
                <div
                  className="px-6 py-4 flex items-center gap-3 border-b border-[rgba(255,255,255,0.06)]"
                  style={{ background: "rgba(0,0,0,0.2)" }}
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: "rgba(76,215,246,0.1)" }}
                  >
                    <span
                      className="material-symbols-outlined text-[16px] text-[#4cd7f6]"
                      style={{ fontVariationSettings: "'FILL' 1" }}
                      aria-hidden="true"
                    >
                      translate
                    </span>
                  </div>
                  <div>
                    <p className="text-[14px] font-semibold text-[#e2e2e2]">
                      {sourceLanguage === "Auto Detect" ? "Detected" : sourceLanguage}
                      {" → "}
                      {targetLanguage}
                    </p>
                    <p className="text-[12px] text-[#6b5b7a] mt-0.5">
                      {activeStyle.label} style
                      {preserveFormatting ? " · Formatting preserved" : ""}
                    </p>
                  </div>
                </div>

                {/* Body */}
                <div className="px-6 py-5">
                  <pre className="text-[14px] text-[#cfc2d6] leading-[1.8] whitespace-pre-wrap font-sans">
                    {translation}
                    {isLoading && (
                      <span
                        className="inline-block w-0.5 h-4 bg-[#4cd7f6] ml-0.5 align-middle animate-pulse"
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
                    label="Copy translation"
                    active={copied}
                    activeIcon="check"
                    activeLabel="Copied!"
                  />
                  <ActionButton
                    onClick={handleSwapLanguages}
                    disabled={!canSwap}
                    icon="swap_horiz"
                    label="Swap languages"
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
                <span
                  className="material-symbols-outlined text-[18px] text-[#ef4444]"
                  aria-hidden="true"
                >
                  error
                </span>
                <p className="text-[14px] font-semibold text-[#ef4444]">
                  Translation failed
                </p>
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
