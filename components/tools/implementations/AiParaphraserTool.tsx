"use client";

import { useState, useRef, useCallback, useMemo } from "react";
import type { ParaphraseMode } from "@/types/ai";

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_CHARS = 5_000;

// ── Mode definitions (outside component to prevent recreating on each render) ─

interface ModeOption {
  id: ParaphraseMode;
  label: string;
  icon: string;
  description: string;
}

const MODES: ModeOption[] = [
  { id: "standard", label: "Standard", icon: "edit_note",    description: "Faithful rewrite"   },
  { id: "fluent",   label: "Fluent",   icon: "water",        description: "Natural & smooth"   },
  { id: "creative", label: "Creative", icon: "palette",      description: "Vivid & varied"     },
  { id: "academic", label: "Academic", icon: "school",       description: "Formal & scholarly" },
  { id: "shorten",  label: "Shorten",  icon: "compress",     description: "Concise version"    },
  { id: "expand",   label: "Expand",   icon: "open_in_full", description: "Detailed version"   },
];

// ── Sub-components (outside component to prevent remounting) ──────────────────

function ActionBtn({
  onClick,
  disabled,
  icon,
  label,
  active,
  activeIcon,
  activeLabel,
}: {
  onClick: () => void;
  disabled?: boolean;
  icon: string;
  label: string;
  active?: boolean;
  activeIcon?: string;
  activeLabel?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
      style={{
        background: active ? "rgba(34,197,94,0.13)" : "rgba(255,255,255,0.06)",
        color: active ? "#22c55e" : "#988d9f",
        border: `1px solid ${active ? "rgba(34,197,94,0.3)" : "rgba(255,255,255,0.08)"}`,
      }}
    >
      <span className="material-symbols-outlined text-[14px]" aria-hidden="true">
        {active && activeIcon ? activeIcon : icon}
      </span>
      {active && activeLabel ? activeLabel : label}
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function AiParaphraserTool() {
  const [inputText,  setInputText]  = useState("");
  const [mode,       setMode]       = useState<ParaphraseMode>("standard");
  const [output,     setOutput]     = useState("");
  const [isLoading,  setIsLoading]  = useState(false);
  const [errorMsg,   setErrorMsg]   = useState<string | null>(null);
  const [copied,     setCopied]     = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [inputError, setInputError] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const outputRef   = useRef<HTMLDivElement>(null);
  const abortRef    = useRef<AbortController | null>(null);

  const charPct        = Math.min(100, (inputText.length / MAX_CHARS) * 100);
  const hasOutput      = output.trim().length > 0;
  const inputWordCount = useMemo(() => (inputText.trim() ? inputText.trim().split(/\s+/).length : 0), [inputText]);
  const outputWordCount = useMemo(() => (output.trim() ? output.trim().split(/\s+/).length : 0), [output]);

  // ── Core paraphrase call ──────────────────────────────────────────────────

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
        throw new Error((json as { message?: string }).message ?? `Server error ${res.status}`);
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

      setTimeout(() => outputRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong. Please try again.");
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
    if (inputText.trim()) await runParaphrase(inputText, mode);
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
    Object.assign(document.createElement("a"), { href: url, download: "paraphrased.txt" }).click();
    URL.revokeObjectURL(url);
    setDownloaded(true);
    setTimeout(() => setDownloaded(false), 2000);
  }, [output]);

  const handleUseAsInput = useCallback(() => {
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

  const activeMode = MODES.find((m) => m.id === mode)!;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="mb-12 flex flex-col gap-8">

      {/* Mode selector */}
      <div>
        <p className="text-[13px] font-semibold uppercase tracking-[0.06em] mb-3" style={{ color: "#988d9f" }}>
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

      {/* Two-column layout */}
      <div className="grid lg:grid-cols-2 gap-6 items-start">

        {/* Input panel */}
        <div className="glass-panel rounded-2xl p-6 flex flex-col gap-5">
          <div className="flex items-center justify-between">
            <p className="text-[15px] font-bold" style={{ color: "#e2e2e2" }}>Original Text</p>
            <span className="text-[12px]" style={{ color: "#6b5b7a" }}>
              <span className="font-medium" style={{ color: "#988d9f" }}>{inputWordCount.toLocaleString()}</span> words
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
              aria-invalid={inputError}
              className="w-full rounded-xl px-4 py-3 text-[14px] placeholder-[#4d4354] focus:outline-none transition-colors resize-y leading-relaxed"
              style={{
                background: "rgba(0,0,0,0.25)",
                color: "#e2e2e2",
                border: `1px solid ${inputError ? "rgba(239,68,68,0.6)" : "rgba(255,255,255,0.09)"}`,
                minHeight: "280px",
              }}
            />
            {inputError && (
              <p role="alert" className="text-[12px]" style={{ color: "#ef4444" }}>
                Please enter some text to paraphrase.
              </p>
            )}

            {/* Char progress */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${charPct}%`,
                    background: charPct > 90 ? "#ef4444" : charPct > 70 ? "#f59e0b" : "linear-gradient(90deg,#ddb7ff,#4cd7f6)",
                  }}
                />
              </div>
              <p
                className="text-[11px] tabular-nums flex-shrink-0"
                style={{ color: charPct > 90 ? "#ef4444" : "#4d4354" }}
              >
                {inputText.length.toLocaleString()} / {MAX_CHARS.toLocaleString()}
              </p>
            </div>
          </div>

          {/* Paraphrase button */}
          <button
            onClick={handleParaphrase}
            disabled={isLoading}
            aria-label="Paraphrase text"
            className="relative w-full py-4 rounded-xl text-[15px] font-bold tracking-[0.02em] transition-all duration-200 overflow-hidden disabled:opacity-70 disabled:cursor-not-allowed"
            style={{
              background: isLoading ? "rgba(221,183,255,0.12)" : "linear-gradient(135deg,#ddb7ff 0%,#4cd7f6 100%)",
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
                <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }} aria-hidden="true">
                  auto_awesome
                </span>
                Paraphrase
              </span>
            )}
          </button>
        </div>

        {/* Output panel */}
        <div ref={outputRef} className="flex flex-col gap-4">

          {/* Empty state */}
          {!hasOutput && !isLoading && !errorMsg && (
            <div
              className="glass-panel rounded-2xl p-10 flex flex-col items-center justify-center text-center gap-4"
              style={{ minHeight: "420px" }}
              aria-live="polite"
            >
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center"
                style={{ background: "rgba(221,183,255,0.08)" }}
              >
                <span
                  className="material-symbols-outlined text-[32px]"
                  style={{ color: "#ddb7ff", fontVariationSettings: "'FILL' 0" }}
                  aria-hidden="true"
                >
                  draw
                </span>
              </div>
              <div>
                <p className="text-[16px] font-semibold mb-1" style={{ color: "#e2e2e2" }}>
                  Your rewritten text will appear here
                </p>
                <p className="text-[13px] max-w-[260px] leading-relaxed" style={{ color: "#6b5b7a" }}>
                  Paste your text, choose a mode, then click{" "}
                  <strong style={{ color: "#9b8da8" }}>Paraphrase</strong>.
                </p>
              </div>
            </div>
          )}

          {/* Loading skeleton */}
          {isLoading && !hasOutput && (
            <div className="glass-panel rounded-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-[rgba(255,255,255,0.06)]" style={{ background: "rgba(0,0,0,0.2)" }}>
                <div className="h-4 w-36 rounded animate-pulse" style={{ background: "rgba(255,255,255,0.07)" }} />
              </div>
              <div className="px-6 py-5 flex flex-col gap-3">
                {[94, 80, 88, 72, 82, 90, 64].map((w, i) => (
                  <div
                    key={i}
                    className="h-3 rounded animate-pulse"
                    style={{ width: `${w}%`, background: "rgba(255,255,255,0.06)", animationDelay: `${i * 60}ms` }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Output card */}
          {(hasOutput || (isLoading && output)) && (
            <>
              {/* Stats */}
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
                    <span key={value} className="flex items-center gap-1.5 text-[12px]" style={{ color: "#988d9f" }}>
                      <span className="material-symbols-outlined text-[14px]" style={{ color }} aria-hidden="true">{icon}</span>
                      {value}
                    </span>
                  ))}
                </div>
              )}

              {/* Card */}
              <div className="glass-panel rounded-2xl overflow-hidden" aria-live="polite" aria-label="Paraphrased output">
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
                      className="material-symbols-outlined text-[16px]"
                      style={{ color: "#ddb7ff", fontVariationSettings: "'FILL' 1" }}
                      aria-hidden="true"
                    >
                      {activeMode.icon}
                    </span>
                  </div>
                  <div>
                    <p className="text-[14px] font-semibold" style={{ color: "#e2e2e2" }}>
                      {activeMode.label} Version
                    </p>
                    <p className="text-[12px] mt-0.5" style={{ color: "#6b5b7a" }}>
                      {activeMode.description}
                    </p>
                  </div>
                </div>

                {/* Body */}
                <div className="px-6 py-5">
                  <pre className="text-[14px] leading-[1.8] whitespace-pre-wrap font-sans" style={{ color: "#cfc2d6" }}>
                    {output}
                    {isLoading && (
                      <span
                        className="inline-block w-0.5 h-4 ml-0.5 align-middle animate-pulse"
                        style={{ background: "#ddb7ff" }}
                        aria-hidden="true"
                      />
                    )}
                  </pre>
                </div>
              </div>

              {/* Action buttons */}
              {hasOutput && !isLoading && (
                <div className="flex flex-wrap gap-2">
                  <ActionBtn onClick={handleCopy}        icon="content_copy" label="Copy"         active={copied}     activeIcon="check" activeLabel="Copied!" />
                  <ActionBtn onClick={handleRegenerate}  icon="refresh"      label="Regenerate" />
                  <ActionBtn onClick={handleDownload}    icon="download"     label="Download TXT" active={downloaded} activeIcon="check" activeLabel="Saved!"  />
                  <ActionBtn onClick={handleUseAsInput}  icon="input"        label="Use as input" />
                  <ActionBtn onClick={handleReset}       icon="restart_alt"  label="Start over"   />
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
                <span className="material-symbols-outlined text-[18px]" style={{ color: "#ef4444" }} aria-hidden="true">error</span>
                <p className="text-[14px] font-semibold" style={{ color: "#ef4444" }}>Paraphrasing failed</p>
              </div>
              <p className="text-[13px]" style={{ color: "#9b8da8" }}>{errorMsg}</p>
              <button
                onClick={handleRegenerate}
                className="self-start flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-semibold transition-all"
                style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)" }}
              >
                <span className="material-symbols-outlined text-[14px]">refresh</span>
                Try again
              </button>
            </div>
          )}

          <p className="text-[12px] px-1" style={{ color: "#4d4354" }}>
            Your text is processed securely and never permanently stored.
          </p>
        </div>
      </div>
    </div>
  );
}
