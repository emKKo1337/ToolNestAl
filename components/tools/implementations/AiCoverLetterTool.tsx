"use client";

import { useState, useRef, useCallback } from "react";
import type { CoverLetterTone } from "@/types/ai";

// ── Constants ─────────────────────────────────────────────────────────────────

const SKILLS_MAX = 300;

// ── Tone options (outside component) ─────────────────────────────────────────

interface ToneOption {
  id: CoverLetterTone;
  label: string;
  icon: string;
  description: string;
}

const TONES: ToneOption[] = [
  { id: "professional", label: "Professional", icon: "business_center", description: "Formal & polished" },
  { id: "friendly",     label: "Friendly",     icon: "handshake",        description: "Warm & approachable" },
  { id: "confident",    label: "Confident",    icon: "bolt",             description: "Bold & assertive" },
];

// ── Sub-components (defined outside to prevent remounting) ────────────────────

function FieldLabel({ label, required }: { label: string; required?: boolean }) {
  return (
    <label className="block text-[12px] font-semibold uppercase tracking-[0.06em] mb-1.5" style={{ color: "#988d9f" }}>
      {label}
      {required && <span className="ml-1" style={{ color: "#ddb7ff" }}>*</span>}
    </label>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
  hasError,
  id,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  hasError?: boolean;
  id: string;
}) {
  return (
    <input
      id={id}
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      aria-invalid={hasError}
      className="w-full rounded-xl px-4 py-3 text-[14px] placeholder-[#4d4354] focus:outline-none transition-colors"
      style={{
        background: "rgba(0,0,0,0.25)",
        color: "#e2e2e2",
        border: `1px solid ${hasError ? "rgba(239,68,68,0.6)" : "rgba(255,255,255,0.09)"}`,
      }}
    />
  );
}

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

export default function AiCoverLetterTool() {
  // Form state
  const [jobTitle,          setJobTitle]          = useState("");
  const [companyName,       setCompanyName]       = useState("");
  const [applicantName,     setApplicantName]     = useState("");
  const [yearsOfExperience, setYearsOfExperience] = useState("");
  const [skills,            setSkills]            = useState("");
  const [additionalInfo,    setAdditionalInfo]    = useState("");
  const [tone,              setTone]              = useState<CoverLetterTone>("professional");

  // UI state
  const [output,    setOutput]    = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg,  setErrorMsg]  = useState<string | null>(null);
  const [copied,    setCopied]    = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [errors,    setErrors]    = useState<Record<string, boolean>>({});

  const abortRef    = useRef<AbortController | null>(null);
  const outputRef   = useRef<HTMLDivElement>(null);
  const hasOutput   = output.trim().length > 0;
  const activeTone  = TONES.find((t) => t.id === tone)!;

  // ── Validation ─────────────────────────────────────────────────────────────

  function validate() {
    const e: Record<string, boolean> = {};
    if (!jobTitle.trim())      e.jobTitle = true;
    if (!companyName.trim())   e.companyName = true;
    if (!applicantName.trim()) e.applicantName = true;
    if (!skills.trim())        e.skills = true;
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  // ── Core generate call ─────────────────────────────────────────────────────

  const runGenerate = useCallback(async (fields: {
    jobTitle: string; companyName: string; applicantName: string;
    yearsOfExperience: string; skills: string; additionalInfo: string;
    tone: CoverLetterTone;
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
          task: "coverLetter",
          payload: {
            jobTitle:          fields.jobTitle,
            companyName:       fields.companyName,
            applicantName:     fields.applicantName,
            yearsOfExperience: fields.yearsOfExperience || "Not specified",
            skills:            fields.skills,
            tone:              fields.tone,
            additionalInfo:    fields.additionalInfo || undefined,
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

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleGenerate = useCallback(async () => {
    if (!validate()) return;
    await runGenerate({ jobTitle, companyName, applicantName, yearsOfExperience, skills, additionalInfo, tone });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobTitle, companyName, applicantName, yearsOfExperience, skills, additionalInfo, tone, runGenerate]);

  const handleRegenerate = useCallback(async () => {
    await runGenerate({ jobTitle, companyName, applicantName, yearsOfExperience, skills, additionalInfo, tone });
  }, [jobTitle, companyName, applicantName, yearsOfExperience, skills, additionalInfo, tone, runGenerate]);

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
    Object.assign(document.createElement("a"), { href: url, download: "cover-letter.txt" }).click();
    URL.revokeObjectURL(url);
    setDownloaded(true);
    setTimeout(() => setDownloaded(false), 2000);
  }, [output]);

  const handleReset = useCallback(() => {
    abortRef.current?.abort();
    setJobTitle(""); setCompanyName(""); setApplicantName("");
    setYearsOfExperience(""); setSkills(""); setAdditionalInfo("");
    setTone("professional"); setOutput(""); setErrorMsg(null); setErrors({});
  }, []);

  const wordCount = output.trim() ? output.trim().split(/\s+/).length : 0;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="mb-12 flex flex-col gap-8">

      {/* Form + Output grid */}
      <div className="grid lg:grid-cols-2 gap-6 items-start">

        {/* Left — form */}
        <div className="glass-panel rounded-2xl p-6 flex flex-col gap-5">
          <p className="text-[15px] font-bold" style={{ color: "#e2e2e2" }}>Job Details</p>

          {/* Row: Job title + Company */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <FieldLabel label="Job Title" required />
              <TextInput id="jobTitle" value={jobTitle} onChange={(v) => { setJobTitle(v); setErrors((e) => ({ ...e, jobTitle: false })); }} placeholder="e.g. Software Engineer" hasError={errors.jobTitle} />
              {errors.jobTitle && <p role="alert" className="text-[11px] mt-1" style={{ color: "#ef4444" }}>Required</p>}
            </div>
            <div>
              <FieldLabel label="Company Name" required />
              <TextInput id="companyName" value={companyName} onChange={(v) => { setCompanyName(v); setErrors((e) => ({ ...e, companyName: false })); }} placeholder="e.g. Acme Corp" hasError={errors.companyName} />
              {errors.companyName && <p role="alert" className="text-[11px] mt-1" style={{ color: "#ef4444" }}>Required</p>}
            </div>
          </div>

          {/* Row: Applicant name + Years */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <FieldLabel label="Your Name" required />
              <TextInput id="applicantName" value={applicantName} onChange={(v) => { setApplicantName(v); setErrors((e) => ({ ...e, applicantName: false })); }} placeholder="e.g. Jane Smith" hasError={errors.applicantName} />
              {errors.applicantName && <p role="alert" className="text-[11px] mt-1" style={{ color: "#ef4444" }}>Required</p>}
            </div>
            <div>
              <FieldLabel label="Years of Experience" />
              <TextInput id="yearsExp" value={yearsOfExperience} onChange={setYearsOfExperience} placeholder="e.g. 5" />
            </div>
          </div>

          {/* Skills */}
          <div>
            <FieldLabel label="Key Skills" required />
            <div className="flex flex-col gap-1">
              <textarea
                value={skills}
                onChange={(e) => {
                  const v = e.target.value.slice(0, SKILLS_MAX);
                  setSkills(v);
                  setErrors((er) => ({ ...er, skills: false }));
                }}
                placeholder="e.g. React, TypeScript, Node.js, team leadership, agile…"
                rows={3}
                aria-label="Key skills"
                aria-invalid={errors.skills}
                className="w-full rounded-xl px-4 py-3 text-[14px] placeholder-[#4d4354] focus:outline-none transition-colors resize-none leading-relaxed"
                style={{
                  background: "rgba(0,0,0,0.25)",
                  color: "#e2e2e2",
                  border: `1px solid ${errors.skills ? "rgba(239,68,68,0.6)" : "rgba(255,255,255,0.09)"}`,
                }}
              />
              <div className="flex items-center justify-between">
                {errors.skills
                  ? <p role="alert" className="text-[11px]" style={{ color: "#ef4444" }}>Required</p>
                  : <span />}
                <p className="text-[11px]" style={{ color: skills.length > SKILLS_MAX * 0.9 ? "#f59e0b" : "#4d4354" }}>
                  {skills.length}/{SKILLS_MAX}
                </p>
              </div>
            </div>
          </div>

          {/* Tone selector */}
          <div>
            <FieldLabel label="Tone" />
            <div className="grid grid-cols-3 gap-2">
              {TONES.map((t) => {
                const isActive = tone === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setTone(t.id)}
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
                      {t.icon}
                    </span>
                    <p className="text-[12px] font-semibold leading-tight">{t.label}</p>
                    <p className="text-[10px] leading-tight" style={{ color: isActive ? "rgba(221,183,255,0.6)" : "#4d4354" }}>
                      {t.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Additional info */}
          <div>
            <FieldLabel label="Additional Info (Optional)" />
            <textarea
              value={additionalInfo}
              onChange={(e) => setAdditionalInfo(e.target.value.slice(0, 500))}
              placeholder="Specific achievements, job posting requirements, or anything else to highlight…"
              rows={3}
              aria-label="Additional information"
              className="w-full rounded-xl px-4 py-3 text-[14px] placeholder-[#4d4354] focus:outline-none transition-colors resize-none leading-relaxed"
              style={{ background: "rgba(0,0,0,0.25)", color: "#e2e2e2", border: "1px solid rgba(255,255,255,0.09)" }}
            />
          </div>

          {/* Generate button */}
          <button
            onClick={handleGenerate}
            disabled={isLoading}
            aria-label="Generate cover letter"
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
                Writing your cover letter…
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }} aria-hidden="true">
                  description
                </span>
                Generate Cover Letter
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

        {/* Right — output */}
        <div ref={outputRef} className="flex flex-col gap-4">

          {/* Empty state */}
          {!hasOutput && !isLoading && !errorMsg && (
            <div
              className="glass-panel rounded-2xl p-10 flex flex-col items-center justify-center text-center gap-4"
              style={{ minHeight: "480px" }}
              aria-live="polite"
            >
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: "rgba(221,183,255,0.08)" }}>
                <span className="material-symbols-outlined text-[32px]" style={{ color: "#ddb7ff", fontVariationSettings: "'FILL' 0" }} aria-hidden="true">
                  description
                </span>
              </div>
              <div>
                <p className="text-[16px] font-semibold mb-1" style={{ color: "#e2e2e2" }}>Your cover letter will appear here</p>
                <p className="text-[13px] max-w-[260px] leading-relaxed" style={{ color: "#6b5b7a" }}>
                  Fill in the details on the left and click <strong style={{ color: "#9b8da8" }}>Generate Cover Letter</strong>.
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
                {[85, 92, 70, 88, 76, 94, 60, 80, 88, 65].map((w, i) => (
                  <div key={i} className="h-3 rounded animate-pulse" style={{ width: `${w}%`, background: "rgba(255,255,255,0.06)", animationDelay: `${i * 55}ms` }} />
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
                  <span className="flex items-center gap-1.5 text-[12px]" style={{ color: "#988d9f" }}>
                    <span className="material-symbols-outlined text-[14px]" style={{ color: "#ddb7ff" }} aria-hidden="true">text_fields</span>
                    {wordCount.toLocaleString()} words
                  </span>
                  <span className="flex items-center gap-1.5 text-[12px]" style={{ color: "#988d9f" }}>
                    <span className="material-symbols-outlined text-[14px]" style={{ color: "#adc6ff" }} aria-hidden="true">abc</span>
                    {output.length.toLocaleString()} chars
                  </span>
                  <span
                    className="flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full"
                    style={{ background: "rgba(221,183,255,0.1)", color: "#ddb7ff", border: "1px solid rgba(221,183,255,0.2)" }}
                  >
                    <span className="material-symbols-outlined text-[12px]" style={{ fontVariationSettings: "'FILL' 1" }} aria-hidden="true">
                      {activeTone.icon}
                    </span>
                    {activeTone.label}
                  </span>
                </div>
              )}

              {/* Card */}
              <div className="glass-panel rounded-2xl overflow-hidden" aria-live="polite" aria-label="Generated cover letter">
                <div className="px-6 py-4 flex items-center gap-3 border-b border-[rgba(255,255,255,0.06)]" style={{ background: "rgba(0,0,0,0.2)" }}>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "rgba(221,183,255,0.1)" }}>
                    <span className="material-symbols-outlined text-[16px]" style={{ color: "#ddb7ff", fontVariationSettings: "'FILL' 1" }} aria-hidden="true">description</span>
                  </div>
                  <div>
                    <p className="text-[14px] font-semibold" style={{ color: "#e2e2e2" }}>Cover Letter</p>
                    <p className="text-[12px] mt-0.5" style={{ color: "#6b5b7a" }}>
                      {jobTitle} · {companyName} · {activeTone.label} tone
                    </p>
                  </div>
                </div>
                <div className="px-6 py-5">
                  <pre className="text-[14px] leading-[1.85] whitespace-pre-wrap font-sans" style={{ color: "#cfc2d6" }}>
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
                  <ActionBtn onClick={handleCopy}       icon="content_copy" label="Copy"         active={copied}     activeIcon="check" activeLabel="Copied!" />
                  <ActionBtn onClick={handleRegenerate} icon="refresh"      label="Regenerate" />
                  <ActionBtn onClick={handleDownload}   icon="download"     label="Download TXT" active={downloaded} activeIcon="check" activeLabel="Saved!"  />
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
            Your information is processed securely and never permanently stored.
          </p>
        </div>
      </div>
    </div>
  );
}
