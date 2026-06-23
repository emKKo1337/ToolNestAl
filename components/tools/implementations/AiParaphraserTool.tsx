"use client";

import { useState, useRef, useCallback, useMemo } from "react";
import type { ParaphraseMode } from "@/types/ai";

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_CHARS = 5_000;

interface ModeOption {
  id: ParaphraseMode;
  label: string;
  icon: string;
  description: string;
}

const MODES: ModeOption[] = [
  { id: "standard",  label: "Standard",  icon: "edit_note",        description: "Faithful rewrite" },
  { id: "fluent",    label: "Fluent",    icon: "water",            description: "Natural & smooth" },
  { id: "creative",  label: "Creative",  icon: "palette",          description: "Vivid & varied" },
  { id: "academic",  label: "Academic",  icon: "school",           description: "Formal & scholarly" },
  { id: "shorten",   label: "Shorten",   icon: "compress",         description: "Concise version" },
  { id: "expand",    label: "Expand",    icon: "open_in_full",     description: "Detailed version" },
];

// ── Sub-components (defined outside main to prevent remounting) ───────────────

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
      <span className="material-symbols-outlined text-[14px]" aria-hidden="true">
        {active && activeIcon ? activeIcon : icon}
      </span>
      {active && activeLabel ? activeLabel : label}
    </button>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function AiParaphraserTool() {
  const [inputText, setInputText]   = useState("");
  const [mode, setMode]             = useState<ParaphraseMode>("standard");
  const [output, setOutput]         = useState("");
  const [isLoading, setIsLoading]   = useState(false);
  const [errorMsg, setErrorMsg]     = useState<string | null>(null);
  const [copied, setCopied]         = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [inputError, setInputError] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const outputRef   = useRef<HTMLDivElement>(null);
  const abortRef    = useRef<AbortController | null>(null);

  const charPct  = Math.min(100, (inputText.length / MAX_CHARS) * 100);
  const hasOutput = output.trim().length > 0;

  const outputWordCount = useMemo(
    () => (output.trim() ? output.trim().split(/\s+/).length : 0),
    [output]
  );
  const inputWordCount = useMemo(
    () => (inputText.trim() ? inputText.trim().split(/\s+/).length : 0),
    [inputText]
  );

  // ── Core paraphrase ──────────────────────────────────────────────────────

  const runParaphrase = useCallback(async (text: string, selectedMode: ParaphraseMode) => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setIsLoading(true);
    setErrorMsg(null);
    setOutput("");

    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task: "paraphrase",
          payload: { text, mode: selectedMode },
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
        setOutput(accumulated);
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
  }, []);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleParaphrase = useCallback(async () => {
    if (!inputText.trim()) {
      setInputError(true);
      textareaRef.current?.focus();
      return;
    }
    setInputError(false);
    await runParaphrase(inputText, mode);
  }, [inputText, mode, runParaphrase]);

  const handleRegenerate = useCallback(async () => {
    if (!inputText.trim()) return;
    await runParaphrase(inputText, mode);
  }, [inputText, mode, runParaphrase]);

  const handleCopy = useCallback(async () => {
    if (!output) return;
    await navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [output]);

  const handleDownload = useCallback(() => {
    if (!output) return;
    const blob = new Blob([output], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "paraphrased.txt";
    a.click();
    URL.revokeObjectURL(url);
    setDownloaded(true);
    setTimeout(() => setDownloaded(false), 2000);
  }, [output]);

  const handleUseOutput = useCallback(() => {
    if (!output) return;
    setInputText(output);
    setOutput("");
    setErrorMsg(null);
    textareaRef.current?.focus();
  }, [output]);

  const handleReset = useCallback(() => {
    abortRef.current?.abort();
    setInputText("");
    setMode("standard");
    setOutput("");
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

      {/* ── Mode selector ── */}
      <div>
        <p className="text-[13px] font-semibold text-[#988d9f] uppercase tracking-[0.06em] mb-3">
          Rewrite Mode
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {MODES.map((m) => {
            const isActive = mode === m.id;
            return (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
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
                  {m.icon}
                </span>
                <div>
                  <p className="text-[12px] font-semibold leading-tight">{m.label}</p>
                  <p
                    className="text-[11px] mt-0.5 leading-tight"
                    style={{ color: isActive ? "rgba(221,183,255,0.6)" : "#4d4354" }}
                  >
                    {m.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Two-column layout ── */}
      <div className="grid lg:grid-cols-2 gap-6 items-start">

        {/* ── LEFT: Input ── */}
        <div className="glass-panel rounded-2xl p-6 flex flex-col gap-5">
          <div className="flex items-center justify-between">
            <p className="text-[15px] font-bold text-[#e2e2e2]">Original Text</p>
            <span className="text-[12px] text-[#6b5b7a]">
              <span className="text-[#988d9f] font-medium">{inputWordCount.toLocaleString()}</span> words
            </span>
          </div>

          <div className="flex flex-col gap-1.5">
            <textarea
              ref={textareaRef}
              value={inputText}
              onChange={handleInputChange}
              placeholder="Paste or type the text you want to paraphrase…"
              rows={14}
              aria-label="Text to paraphrase"
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
                Please enter some text to paraphrase.
              </p>
            )}
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

          <button
            onClick={handleParaphrase}
            disabled={isLoading}
            aria-label="Paraphrase text"
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
                Paraphrasing…
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
                Paraphrase
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
                  draw
                </span>
              </div>
              <div>
                <p className="text-[16px] font-semibold text-[#e2e2e2] mb-1">
                  Your rewritten text will appear here
                </p>
                <p className="text-[13px] text-[#6b5b7a] max-w-[260px] leading-relaxed">
                  Paste your text on the left, choose a mode, then click{" "}
                  <strong className="text-[#9b8da8]">Paraphrase</strong>.
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
                {[94, 80, 88, 72, 82, 90, 64].map((w, i) => (
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
          {(hasOutput || (isLoading && output)) && (
            <>
              {/* Stats bar */}
              {hasOutput && (
                <div className="flex flex-wrap items-center gap-4 px-1">
                  {[
                    { icon: "text_fields", color: "#ddb7ff", value: `${outputWordCount.toLocaleString()} words` },
                    { icon: "abc",         color: "#adc6ff", value: `${output.length.toLocaleString()} chars` },
                    {
                      icon: "compare_arrows",
                      color: "#4cd7f6",
                      value: inputWordCount > 0
                        ? `${outputWordCount > inputWordCount ? "+" : ""}${outputWordCount - inputWordCount} words vs original`
                        : "",
                    },
                  ].filter((s) => s.value).map(({ icon, color, value }) => (
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
                aria-label="Paraphrased output"
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
                      style={{ fontVariationSettings: "'FILL' 1" }}
                      aria-hidden="true"
                    >
                      {MODES.find((m) => m.id === mode)?.icon ?? "draw"}
                    </span>
                  </div>
                  <div>
                    <p className="text-[14px] font-semibold text-[#e2e2e2]">
                      {MODES.find((m) => m.id === mode)?.label ?? "Paraphrased"} Version
                    </p>
                    <p className="text-[12px] text-[#6b5b7a] mt-0.5">
                      {MODES.find((m) => m.id === mode)?.description}
                    </p>
                  </div>
                </div>

                {/* Body */}
                <div className="px-6 py-5">
                  <pre className="text-[14px] text-[#cfc2d6] leading-[1.8] whitespace-pre-wrap font-sans">
                    {output}
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
                    label="Copy"
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
                    onClick={handleUseOutput}
                    icon="input"
                    label="Use as input"
                  />
                  <ActionButton
                    onClick={handleReset}
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
                <p className="text-[14px] font-semibold text-[#ef4444]">Paraphrasing failed</p>
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

          <p className="text-[12px] text-[#4d4354] px-1">
            Your text is processed securely and never permanently stored.
          </p>
        </div>
      </div>
    </div>
  );
}
