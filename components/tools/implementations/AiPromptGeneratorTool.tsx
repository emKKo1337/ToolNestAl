"use client";

import { useState, useRef, useCallback } from "react";
import type {
  PromptCategory,
  PromptAIModel,
  PromptTone,
  PromptLength,
} from "@/types/ai";

// ── Constants ─────────────────────────────────────────────────────────────────

const GOAL_MAX = 500;
const EXISTING_MAX = 1000;

// ── Option definitions (outside component) ────────────────────────────────────

interface CategoryOption { id: PromptCategory; label: string; icon: string }
interface ModelOption    { id: PromptAIModel;  label: string; icon: string }
interface ToneOption     { id: PromptTone;     label: string }
interface LengthOption   { id: PromptLength;   label: string; description: string }

const CATEGORIES: CategoryOption[] = [
  { id: "writing",          label: "Writing",        icon: "edit_note" },
  { id: "coding",           label: "Coding",         icon: "code" },
  { id: "marketing",        label: "Marketing",      icon: "campaign" },
  { id: "seo",              label: "SEO",            icon: "travel_explore" },
  { id: "business",         label: "Business",       icon: "business_center" },
  { id: "education",        label: "Education",      icon: "school" },
  { id: "social-media",     label: "Social Media",   icon: "thumb_up" },
  { id: "image-generation", label: "Image Gen",      icon: "image" },
];

const MODELS: ModelOption[] = [
  { id: "chatgpt",          label: "ChatGPT",         icon: "smart_toy" },
  { id: "claude",           label: "Claude",          icon: "psychology" },
  { id: "gemini",           label: "Gemini",          icon: "auto_awesome" },
  { id: "grok",             label: "Grok",            icon: "bolt" },
  { id: "midjourney",       label: "Midjourney",      icon: "palette" },
  { id: "stable-diffusion", label: "Stable Diff.",    icon: "brush" },
  { id: "any",              label: "Any Model",       icon: "hub" },
];

const TONES: ToneOption[] = [
  { id: "professional", label: "Professional" },
  { id: "casual",       label: "Casual" },
  { id: "creative",     label: "Creative" },
  { id: "technical",    label: "Technical" },
  { id: "persuasive",   label: "Persuasive" },
];

const LENGTHS: LengthOption[] = [
  { id: "short",    label: "Short",    description: "1–3 sentences" },
  { id: "medium",   label: "Medium",   description: "4–8 sentences" },
  { id: "detailed", label: "Detailed", description: "Comprehensive" },
];

// ── Sub-components (defined outside component to prevent remounting) ───────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[12px] font-semibold uppercase tracking-[0.06em] mb-2" style={{ color: "#988d9f" }}>
      {children}
    </p>
  );
}

function ActionBtn({
  onClick, disabled, icon, label, active, activeIcon, activeLabel,
}: {
  onClick: () => void; disabled?: boolean; icon: string; label: string;
  active?: boolean; activeIcon?: string; activeLabel?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
      style={{
        background: active ? "rgba(34,197,94,0.13)" : "rgba(255,255,255,0.06)",
        color:      active ? "#22c55e"               : "#988d9f",
        border:     `1px solid ${active ? "rgba(34,197,94,0.3)" : "rgba(255,255,255,0.08)"}`,
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

export default function AiPromptGeneratorTool() {
  // Form state
  const [goal,           setGoal]           = useState("");
  const [category,       setCategory]       = useState<PromptCategory>("writing");
  const [model,          setModel]          = useState<PromptAIModel>("chatgpt");
  const [tone,           setTone]           = useState<PromptTone>("professional");
  const [length,         setLength]         = useState<PromptLength>("medium");
  const [existingPrompt, setExistingPrompt] = useState("");
  const [showImprove,    setShowImprove]    = useState(false);

  // UI state
  const [output,     setOutput]     = useState("");
  const [isLoading,  setIsLoading]  = useState(false);
  const [errorMsg,   setErrorMsg]   = useState<string | null>(null);
  const [goalError,  setGoalError]  = useState(false);
  const [copied,     setCopied]     = useState(false);
  const [downloaded, setDownloaded] = useState(false);

  const abortRef  = useRef<AbortController | null>(null);
  const outputRef = useRef<HTMLDivElement>(null);
  const hasOutput = output.trim().length > 0;

  // ── Core generate call ─────────────────────────────────────────────────────

  const runGenerate = useCallback(async (fields: {
    goal: string; category: PromptCategory; model: PromptAIModel;
    tone: PromptTone; length: PromptLength; existingPrompt?: string;
  }) => {
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
          task: "generatePrompt",
          payload: {
            goal:          fields.goal,
            category:      fields.category,
            model:         fields.model,
            tone:          fields.tone,
            length:        fields.length,
            existingPrompt: fields.existingPrompt?.trim() || undefined,
          },
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

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleGenerate = useCallback(async () => {
    if (!goal.trim()) { setGoalError(true); return; }
    setGoalError(false);
    await runGenerate({ goal, category, model, tone, length, existingPrompt });
  }, [goal, category, model, tone, length, existingPrompt, runGenerate]);

  const handleRegenerate = useCallback(async () => {
    if (goal.trim()) await runGenerate({ goal, category, model, tone, length, existingPrompt });
  }, [goal, category, model, tone, length, existingPrompt, runGenerate]);

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
    Object.assign(document.createElement("a"), { href: url, download: "prompt.txt" }).click();
    URL.revokeObjectURL(url);
    setDownloaded(true);
    setTimeout(() => setDownloaded(false), 2000);
  }, [output]);

  const handleUseAsExisting = useCallback(() => {
    if (!output) return;
    setExistingPrompt(output);
    setShowImprove(true);
    setOutput("");
    setErrorMsg(null);
  }, [output]);

  const handleReset = useCallback(() => {
    abortRef.current?.abort();
    setGoal(""); setCategory("writing"); setModel("chatgpt");
    setTone("professional"); setLength("medium");
    setExistingPrompt(""); setShowImprove(false);
    setOutput(""); setErrorMsg(null); setGoalError(false);
  }, []);

  const activeCat    = CATEGORIES.find((c) => c.id === category)!;
  const activeModel  = MODELS.find((m) => m.id === model)!;
  const activeLength = LENGTHS.find((l) => l.id === length)!;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="mb-12 flex flex-col gap-8">

      {/* Two-column layout */}
      <div className="grid lg:grid-cols-2 gap-6 items-start">

        {/* LEFT — form */}
        <div className="glass-panel rounded-2xl p-6 flex flex-col gap-5">

          {/* Goal */}
          <div>
            <SectionLabel>What do you want the prompt to do? *</SectionLabel>
            <textarea
              value={goal}
              onChange={(e) => { setGoal(e.target.value.slice(0, GOAL_MAX)); setGoalError(false); }}
              placeholder="e.g. Write a blog post intro about AI tools for small businesses…"
              rows={4}
              aria-label="Prompt goal"
              aria-invalid={goalError}
              className="w-full rounded-xl px-4 py-3 text-[14px] placeholder-[#4d4354] focus:outline-none transition-colors resize-none leading-relaxed"
              style={{
                background: "rgba(0,0,0,0.25)",
                color: "#e2e2e2",
                border: `1px solid ${goalError ? "rgba(239,68,68,0.6)" : "rgba(255,255,255,0.09)"}`,
              }}
            />
            <div className="flex justify-between items-center mt-1">
              {goalError
                ? <p role="alert" className="text-[11px]" style={{ color: "#ef4444" }}>Please describe your prompt goal.</p>
                : <span />}
              <p className="text-[11px]" style={{ color: goal.length > GOAL_MAX * 0.9 ? "#f59e0b" : "#4d4354" }}>
                {goal.length}/{GOAL_MAX}
              </p>
            </div>
          </div>

          {/* Category */}
          <div>
            <SectionLabel>Category</SectionLabel>
            <div className="grid grid-cols-4 gap-2">
              {CATEGORIES.map((c) => {
                const isActive = category === c.id;
                return (
                  <button
                    key={c.id}
                    onClick={() => setCategory(c.id)}
                    aria-pressed={isActive}
                    className="flex flex-col items-center gap-1 py-2.5 px-1 rounded-xl text-center transition-all duration-150"
                    style={{
                      background: isActive ? "rgba(221,183,255,0.12)" : "rgba(255,255,255,0.04)",
                      border: `1px solid ${isActive ? "rgba(221,183,255,0.35)" : "rgba(255,255,255,0.07)"}`,
                      color: isActive ? "#ddb7ff" : "#988d9f",
                    }}
                  >
                    <span
                      className="material-symbols-outlined text-[18px]"
                      style={{ color: isActive ? "#ddb7ff" : "#6b5b7a", fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0" }}
                      aria-hidden="true"
                    >
                      {c.icon}
                    </span>
                    <p className="text-[10px] font-semibold leading-tight">{c.label}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* AI Model */}
          <div>
            <SectionLabel>Target AI Model</SectionLabel>
            <div className="grid grid-cols-4 gap-2">
              {MODELS.map((m) => {
                const isActive = model === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => setModel(m.id)}
                    aria-pressed={isActive}
                    className="flex flex-col items-center gap-1 py-2.5 px-1 rounded-xl text-center transition-all duration-150"
                    style={{
                      background: isActive ? "rgba(221,183,255,0.12)" : "rgba(255,255,255,0.04)",
                      border: `1px solid ${isActive ? "rgba(221,183,255,0.35)" : "rgba(255,255,255,0.07)"}`,
                      color: isActive ? "#ddb7ff" : "#988d9f",
                    }}
                  >
                    <span
                      className="material-symbols-outlined text-[18px]"
                      style={{ color: isActive ? "#ddb7ff" : "#6b5b7a", fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0" }}
                      aria-hidden="true"
                    >
                      {m.icon}
                    </span>
                    <p className="text-[10px] font-semibold leading-tight">{m.label}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tone + Length row */}
          <div className="grid sm:grid-cols-2 gap-4">
            {/* Tone */}
            <div>
              <SectionLabel>Tone</SectionLabel>
              <div className="flex flex-col gap-1.5">
                {TONES.map((t) => {
                  const isActive = tone === t.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => setTone(t.id)}
                      aria-pressed={isActive}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-left transition-all duration-150"
                      style={{
                        background: isActive ? "rgba(221,183,255,0.1)" : "rgba(255,255,255,0.03)",
                        border: `1px solid ${isActive ? "rgba(221,183,255,0.3)" : "rgba(255,255,255,0.06)"}`,
                        color: isActive ? "#ddb7ff" : "#988d9f",
                      }}
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                        style={{ background: isActive ? "#ddb7ff" : "#3d3044" }}
                      />
                      <p className="text-[12px] font-semibold">{t.label}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Length */}
            <div>
              <SectionLabel>Prompt Length</SectionLabel>
              <div className="flex flex-col gap-1.5">
                {LENGTHS.map((l) => {
                  const isActive = length === l.id;
                  return (
                    <button
                      key={l.id}
                      onClick={() => setLength(l.id)}
                      aria-pressed={isActive}
                      className="flex items-center justify-between px-3 py-2 rounded-xl text-left transition-all duration-150"
                      style={{
                        background: isActive ? "rgba(221,183,255,0.1)" : "rgba(255,255,255,0.03)",
                        border: `1px solid ${isActive ? "rgba(221,183,255,0.3)" : "rgba(255,255,255,0.06)"}`,
                        color: isActive ? "#ddb7ff" : "#988d9f",
                      }}
                    >
                      <p className="text-[12px] font-semibold">{l.label}</p>
                      <p className="text-[10px]" style={{ color: isActive ? "rgba(221,183,255,0.6)" : "#4d4354" }}>
                        {l.description}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Improve existing prompt toggle */}
          <div>
            <button
              onClick={() => setShowImprove((v) => !v)}
              className="flex items-center gap-2 text-[13px] font-semibold transition-colors"
              style={{ color: showImprove ? "#ddb7ff" : "#988d9f" }}
              aria-expanded={showImprove}
            >
              <span
                className="material-symbols-outlined text-[16px]"
                style={{ color: showImprove ? "#ddb7ff" : "#6b5b7a", fontVariationSettings: showImprove ? "'FILL' 1" : "'FILL' 0" }}
                aria-hidden="true"
              >
                {showImprove ? "expand_less" : "add_circle"}
              </span>
              {showImprove ? "Hide: Improve existing prompt" : "Improve an existing prompt"}
            </button>

            {showImprove && (
              <div className="mt-3 flex flex-col gap-1">
                <textarea
                  value={existingPrompt}
                  onChange={(e) => setExistingPrompt(e.target.value.slice(0, EXISTING_MAX))}
                  placeholder="Paste your existing prompt here to get an improved version…"
                  rows={4}
                  aria-label="Existing prompt to improve"
                  className="w-full rounded-xl px-4 py-3 text-[14px] placeholder-[#4d4354] focus:outline-none transition-colors resize-none leading-relaxed"
                  style={{ background: "rgba(0,0,0,0.25)", color: "#e2e2e2", border: "1px solid rgba(255,255,255,0.09)" }}
                />
                <p className="text-[11px] text-right" style={{ color: existingPrompt.length > EXISTING_MAX * 0.9 ? "#f59e0b" : "#4d4354" }}>
                  {existingPrompt.length}/{EXISTING_MAX}
                </p>
              </div>
            )}
          </div>

          {/* Generate button */}
          <button
            onClick={handleGenerate}
            disabled={isLoading}
            aria-label="Generate prompt"
            className="w-full py-4 rounded-xl text-[15px] font-bold tracking-[0.02em] transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed"
            style={{
              background: isLoading ? "rgba(221,183,255,0.12)" : "linear-gradient(135deg,#ddb7ff 0%,#4cd7f6 100%)",
              color: isLoading ? "#ddb7ff" : "#131313",
              boxShadow: isLoading ? "none" : "0 0 24px rgba(221,183,255,0.2)",
            }}
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-3">
                <span className="inline-block w-4 h-4 border-2 border-[#ddb7ff] border-t-transparent rounded-full animate-spin" />
                Generating prompt…
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }} aria-hidden="true">
                  auto_awesome
                </span>
                {showImprove && existingPrompt.trim() ? "Improve Prompt" : "Generate Prompt"}
              </span>
            )}
          </button>

          <button
            onClick={handleReset}
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-[13px] font-semibold transition-all"
            style={{ background: "rgba(255,255,255,0.04)", color: "#6b5b7a", border: "1px solid rgba(255,255,255,0.07)" }}
            aria-label="Reset form"
          >
            <span className="material-symbols-outlined text-[14px]" aria-hidden="true">restart_alt</span>
            Reset
          </button>
        </div>

        {/* RIGHT — output */}
        <div ref={outputRef} className="flex flex-col gap-4">

          {/* Empty state */}
          {!hasOutput && !isLoading && !errorMsg && (
            <div
              className="glass-panel rounded-2xl p-10 flex flex-col items-center justify-center text-center gap-4"
              style={{ minHeight: "460px" }}
              aria-live="polite"
            >
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: "rgba(221,183,255,0.08)" }}>
                <span className="material-symbols-outlined text-[32px]" style={{ color: "#ddb7ff", fontVariationSettings: "'FILL' 0" }} aria-hidden="true">
                  auto_awesome
                </span>
              </div>
              <div>
                <p className="text-[16px] font-semibold mb-1" style={{ color: "#e2e2e2" }}>
                  Your optimised prompt will appear here
                </p>
                <p className="text-[13px] max-w-[260px] leading-relaxed" style={{ color: "#6b5b7a" }}>
                  Describe your goal, pick a model and click{" "}
                  <strong style={{ color: "#9b8da8" }}>Generate Prompt</strong>.
                </p>
              </div>
            </div>
          )}

          {/* Loading skeleton */}
          {isLoading && !hasOutput && (
            <div className="glass-panel rounded-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-[rgba(255,255,255,0.06)]" style={{ background: "rgba(0,0,0,0.2)" }}>
                <div className="h-4 w-44 rounded animate-pulse" style={{ background: "rgba(255,255,255,0.07)" }} />
              </div>
              <div className="px-6 py-5 flex flex-col gap-3">
                {[88, 72, 95, 64, 80].map((w, i) => (
                  <div key={i} className="h-3 rounded animate-pulse" style={{ width: `${w}%`, background: "rgba(255,255,255,0.06)", animationDelay: `${i * 60}ms` }} />
                ))}
              </div>
            </div>
          )}

          {/* Output card */}
          {(hasOutput || (isLoading && output)) && (
            <>
              {/* Stats */}
              {hasOutput && (
                <div className="flex flex-wrap items-center gap-3 px-1">
                  <span
                    className="flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full"
                    style={{ background: "rgba(221,183,255,0.1)", color: "#ddb7ff", border: "1px solid rgba(221,183,255,0.2)" }}
                  >
                    <span className="material-symbols-outlined text-[12px]" style={{ fontVariationSettings: "'FILL' 1" }} aria-hidden="true">
                      {activeModel.icon}
                    </span>
                    {activeModel.label}
                  </span>
                  <span
                    className="flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full"
                    style={{ background: "rgba(76,215,246,0.08)", color: "#4cd7f6", border: "1px solid rgba(76,215,246,0.2)" }}
                  >
                    <span className="material-symbols-outlined text-[12px]" style={{ fontVariationSettings: "'FILL' 1" }} aria-hidden="true">
                      {activeCat.icon}
                    </span>
                    {activeCat.label}
                  </span>
                  <span className="text-[12px]" style={{ color: "#988d9f" }}>
                    {output.trim().split(/\s+/).length} words · {activeLength.label}
                  </span>
                </div>
              )}

              {/* Card */}
              <div className="glass-panel rounded-2xl overflow-hidden" aria-live="polite" aria-label="Generated prompt">
                <div className="px-6 py-4 flex items-center gap-3 border-b border-[rgba(255,255,255,0.06)]" style={{ background: "rgba(0,0,0,0.2)" }}>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "rgba(221,183,255,0.1)" }}>
                    <span className="material-symbols-outlined text-[16px]" style={{ color: "#ddb7ff", fontVariationSettings: "'FILL' 1" }} aria-hidden="true">
                      auto_awesome
                    </span>
                  </div>
                  <div>
                    <p className="text-[14px] font-semibold" style={{ color: "#e2e2e2" }}>Generated Prompt</p>
                    <p className="text-[12px] mt-0.5" style={{ color: "#6b5b7a" }}>
                      Ready to use with {activeModel.label}
                    </p>
                  </div>
                </div>
                <div className="px-6 py-5">
                  <pre className="text-[14px] leading-[1.8] whitespace-pre-wrap font-sans" style={{ color: "#cfc2d6" }}>
                    {output}
                    {isLoading && (
                      <span className="inline-block w-0.5 h-4 ml-0.5 align-middle animate-pulse" style={{ background: "#ddb7ff" }} aria-hidden="true" />
                    )}
                  </pre>
                </div>
              </div>

              {/* Action buttons */}
              {hasOutput && !isLoading && (
                <div className="flex flex-wrap gap-2">
                  <ActionBtn onClick={handleCopy}          icon="content_copy" label="Copy"          active={copied}     activeIcon="check" activeLabel="Copied!" />
                  <ActionBtn onClick={handleRegenerate}    icon="refresh"      label="Regenerate" />
                  <ActionBtn onClick={handleDownload}      icon="download"     label="Download TXT" active={downloaded} activeIcon="check" activeLabel="Saved!"  />
                  <ActionBtn onClick={handleUseAsExisting} icon="edit"         label="Improve this prompt" />
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
                <p className="text-[14px] font-semibold" style={{ color: "#ef4444" }}>Generation failed</p>
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
            Your prompts are processed securely and never permanently stored.
          </p>
        </div>
      </div>
    </div>
  );
}
