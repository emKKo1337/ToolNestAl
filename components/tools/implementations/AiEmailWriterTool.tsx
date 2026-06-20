"use client";

import { useState, useRef, useCallback } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Template {
  id: string;
  label: string;
  icon: string;
  purpose: string;
  tone: string;
  length: string;
  placeholder: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const TEMPLATES: Template[] = [
  {
    id: "job-application",
    label: "Job Application",
    icon: "work",
    purpose: "Apply for a job position",
    tone: "Professional",
    length: "Medium",
    placeholder:
      "Include the job title, company name, your key qualifications, and why you are the right fit.",
  },
  {
    id: "business-proposal",
    label: "Business Proposal",
    icon: "handshake",
    purpose: "Send a business proposal or partnership offer",
    tone: "Persuasive",
    length: "Long",
    placeholder:
      "Describe the proposal, the value you offer, expected outcomes, and next steps.",
  },
  {
    id: "thank-you",
    label: "Thank You",
    icon: "favorite",
    purpose: "Send a thank you email",
    tone: "Friendly",
    length: "Short",
    placeholder:
      "Mention what you are grateful for and any specific details you want to include.",
  },
  {
    id: "meeting-request",
    label: "Meeting Request",
    icon: "calendar_month",
    purpose: "Request a meeting or call",
    tone: "Professional",
    length: "Short",
    placeholder:
      "Include the meeting purpose, your availability, preferred format (video/in-person), and duration.",
  },
  {
    id: "follow-up",
    label: "Follow Up",
    icon: "replay",
    purpose: "Follow up on a previous conversation or application",
    tone: "Polite",
    length: "Short",
    placeholder:
      "Reference the previous conversation, what you are following up on, and the desired response.",
  },
  {
    id: "complaint",
    label: "Complaint",
    icon: "report_problem",
    purpose: "File a formal complaint",
    tone: "Formal",
    length: "Medium",
    placeholder:
      "Describe the issue clearly, when it happened, what you expected, and the resolution you seek.",
  },
  {
    id: "apology",
    label: "Apology",
    icon: "sentiment_dissatisfied",
    purpose: "Send a sincere apology",
    tone: "Empathetic",
    length: "Medium",
    placeholder:
      "Explain what happened, take responsibility, and describe the steps you will take to make it right.",
  },
  {
    id: "invitation",
    label: "Invitation",
    icon: "celebration",
    purpose: "Invite someone to an event or occasion",
    tone: "Friendly",
    length: "Short",
    placeholder:
      "Include the event name, date, time, location, and any RSVP instructions.",
  },
  {
    id: "customer-support",
    label: "Customer Support",
    icon: "support_agent",
    purpose: "Respond to a customer support request",
    tone: "Empathetic",
    length: "Medium",
    placeholder:
      "Describe the customer's issue, the solution you are providing, and any next steps.",
  },
  {
    id: "custom",
    label: "Custom Email",
    icon: "edit_note",
    purpose: "",
    tone: "Professional",
    length: "Medium",
    placeholder:
      "Describe what you want this email to say, including the purpose, key points, and desired outcome.",
  },
];

const TONES = [
  "Professional",
  "Friendly",
  "Formal",
  "Persuasive",
  "Casual",
  "Polite",
  "Empathetic",
  "Urgent",
] as const;

const LENGTHS = ["Short", "Medium", "Long"] as const;

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

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseEmail(raw: string) {
  const lines = raw.split("\n");
  const subjectIdx = lines.findIndex((l) =>
    l.trim().toUpperCase().startsWith("SUBJECT:")
  );
  if (subjectIdx !== -1) {
    return {
      subject: lines[subjectIdx].replace(/^SUBJECT:\s*/i, "").trim(),
      body: lines.slice(subjectIdx + 1).join("\n").trimStart(),
    };
  }
  return { subject: "", body: raw.trimStart() };
}

function emailStats(text: string) {
  const wordCount =
    text.trim() === "" ? 0 : text.trim().split(/\s+/).length;
  const charCount = text.length;
  const sec = wordCount === 0 ? 0 : Math.max(1, Math.round((wordCount / 225) * 60));
  const readingTime =
    sec < 60 ? `${sec}s` : `${Math.floor(sec / 60)}m ${sec % 60}s`;
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

export default function AiEmailWriterTool() {
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [recipient, setRecipient] = useState("");
  const [purpose, setPurpose] = useState("");
  const [tone, setTone] = useState<string>("Professional");
  const [length, setLength] = useState<string>("Medium");
  const [language, setLanguage] = useState<string>("English");
  const [additionalInstructions, setAdditionalInstructions] = useState("");

  const [completion, setCompletion] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [purposeError, setPurposeError] = useState(false);
  const [copied, setCopied] = useState(false);
  const [downloaded, setDownloaded] = useState(false);

  const purposeRef = useRef<HTMLInputElement>(null);
  const outputRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const { subject, body } = parseEmail(completion);
  const stats = emailStats(completion);
  const hasOutput = completion.trim().length > 0;

  const generate = useCallback(
    async (params: {
      recipient: string;
      purpose: string;
      tone: string;
      length: string;
      language: string;
      additionalInstructions: string;
    }) => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;

      setIsLoading(true);
      setErrorMsg(null);
      setCompletion("");

      try {
        const res = await fetch("/api/ai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            task: "generateEmail",
            payload: {
              recipient: params.recipient,
              purpose: params.purpose,
              tone: params.tone,
              length: params.length.toLowerCase(),
              language: params.language,
              additionalInstructions: params.additionalInstructions,
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
          setCompletion(accumulated);
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

  const handleTemplateSelect = useCallback((tpl: Template) => {
    setSelectedTemplate(tpl.id);
    if (tpl.purpose) setPurpose(tpl.purpose);
    setTone(tpl.tone);
    setLength(tpl.length);
    setAdditionalInstructions("");
    setPurposeError(false);
    setCompletion("");
    setErrorMsg(null);
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!purpose.trim()) {
      setPurposeError(true);
      purposeRef.current?.focus();
      return;
    }
    setPurposeError(false);
    await generate({ recipient, purpose, tone, length, language, additionalInstructions });
  }, [purpose, recipient, tone, length, language, additionalInstructions, generate]);

  const handleRegenerate = useCallback(async () => {
    await generate({ recipient, purpose, tone, length, language, additionalInstructions });
  }, [purpose, recipient, tone, length, language, additionalInstructions, generate]);

  const handleCopy = useCallback(async () => {
    if (!completion) return;
    await navigator.clipboard.writeText(completion);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [completion]);

  const handleDownload = useCallback(() => {
    if (!completion) return;
    const blob = new Blob([completion], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "email.txt";
    a.click();
    URL.revokeObjectURL(url);
    setDownloaded(true);
    setTimeout(() => setDownloaded(false), 2000);
  }, [completion]);

  const handleClearOutput = useCallback(() => {
    setCompletion("");
    setErrorMsg(null);
  }, []);

  const handleStartOver = useCallback(() => {
    abortRef.current?.abort();
    setSelectedTemplate(null);
    setRecipient("");
    setPurpose("");
    setTone("Professional");
    setLength("Medium");
    setLanguage("English");
    setAdditionalInstructions("");
    setCompletion("");
    setErrorMsg(null);
    setPurposeError(false);
  }, []);

  const currentPlaceholder =
    selectedTemplate
      ? (TEMPLATES.find((t) => t.id === selectedTemplate)?.placeholder ?? "Describe what you want this email to say...")
      : "Describe what you want this email to say...";

  return (
    <div className="mb-12 flex flex-col gap-8">

      {/* ── Template grid ── */}
      <div>
        <p className="text-[13px] font-semibold text-[#988d9f] uppercase tracking-[0.06em] mb-3">
          Quick Templates
        </p>
        <div
          className="grid gap-2.5"
          style={{ gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))" }}
        >
          {TEMPLATES.map((tpl) => {
            const isActive = selectedTemplate === tpl.id;
            return (
              <button
                key={tpl.id}
                onClick={() => handleTemplateSelect(tpl)}
                aria-pressed={isActive}
                className="flex flex-col items-center gap-2 px-3 py-4 rounded-xl text-center transition-all duration-200"
                style={{
                  background: isActive
                    ? "rgba(221,183,255,0.12)"
                    : "rgba(255,255,255,0.04)",
                  border: `1px solid ${
                    isActive ? "rgba(221,183,255,0.35)" : "rgba(255,255,255,0.07)"
                  }`,
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
                  {tpl.icon}
                </span>
                <span className="text-[12px] font-semibold leading-tight">{tpl.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Two-column layout ── */}
      <div className="grid lg:grid-cols-2 gap-6 items-start">

        {/* ── LEFT: Input form ── */}
        <div className="glass-panel rounded-2xl p-6 flex flex-col gap-5">
          <p className="text-[15px] font-bold text-[#e2e2e2]">Email Details</p>

          {/* Recipient */}
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="email-recipient"
              className="text-[13px] font-semibold text-[#988d9f] uppercase tracking-[0.06em]"
            >
              Recipient{" "}
              <span className="normal-case font-normal tracking-normal text-[#6b5b7a]">
                (optional)
              </span>
            </label>
            <input
              id="email-recipient"
              type="text"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder="e.g. Hiring Manager, John Smith, Customer Support"
              className="bg-[rgba(0,0,0,0.25)] border border-[rgba(255,255,255,0.09)] rounded-xl px-4 py-3 text-[14px] text-[#e2e2e2] placeholder-[#4d4354] focus:outline-none focus:border-[#ddb7ff] transition-colors"
            />
          </div>

          {/* Purpose */}
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="email-purpose"
              className="text-[13px] font-semibold text-[#988d9f] uppercase tracking-[0.06em]"
            >
              Email Purpose{" "}
              <span className="text-[#ef4444] normal-case font-normal tracking-normal">*</span>
            </label>
            <input
              id="email-purpose"
              ref={purposeRef}
              type="text"
              value={purpose}
              onChange={(e) => {
                setPurpose(e.target.value);
                if (e.target.value.trim()) setPurposeError(false);
              }}
              placeholder="e.g. Follow up on a job application submitted last week"
              aria-required="true"
              aria-describedby={purposeError ? "purpose-error" : undefined}
              aria-invalid={purposeError}
              className="bg-[rgba(0,0,0,0.25)] rounded-xl px-4 py-3 text-[14px] text-[#e2e2e2] placeholder-[#4d4354] focus:outline-none transition-colors"
              style={{
                border: `1px solid ${
                  purposeError ? "rgba(239,68,68,0.6)" : "rgba(255,255,255,0.09)"
                }`,
              }}
            />
            {purposeError && (
              <p id="purpose-error" role="alert" className="text-[12px] text-[#ef4444]">
                Please describe what this email should be about.
              </p>
            )}
          </div>

          {/* Tone + Length */}
          <div className="grid grid-cols-2 gap-4">
            <SelectField
              id="email-tone"
              label="Tone"
              value={tone}
              onChange={setTone}
              options={TONES}
            />
            <SelectField
              id="email-length"
              label="Length"
              value={length}
              onChange={setLength}
              options={LENGTHS}
            />
          </div>

          {/* Language */}
          <SelectField
            id="email-language"
            label="Language"
            value={language}
            onChange={setLanguage}
            options={LANGUAGES}
          />

          {/* Additional instructions */}
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="email-instructions"
              className="text-[13px] font-semibold text-[#988d9f] uppercase tracking-[0.06em]"
            >
              Additional Instructions
            </label>
            <textarea
              id="email-instructions"
              value={additionalInstructions}
              onChange={(e) => setAdditionalInstructions(e.target.value)}
              placeholder={currentPlaceholder}
              rows={5}
              className="bg-[rgba(0,0,0,0.25)] border border-[rgba(255,255,255,0.09)] rounded-xl px-4 py-3 text-[14px] text-[#e2e2e2] placeholder-[#4d4354] focus:outline-none focus:border-[#ddb7ff] transition-colors resize-y leading-relaxed"
            />
          </div>

          {/* Generate button */}
          <button
            onClick={handleGenerate}
            disabled={isLoading}
            aria-label="Generate email"
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
                Generating email…
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
                Generate Email
              </span>
            )}
          </button>
        </div>

        {/* ── RIGHT: Output ── */}
        <div ref={outputRef} className="flex flex-col gap-4">

          {/* Empty state */}
          {!hasOutput && !isLoading && !errorMsg && (
            <div
              className="glass-panel rounded-2xl p-10 flex flex-col items-center justify-center text-center gap-4 min-h-[420px]"
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
                  mail
                </span>
              </div>
              <div>
                <p className="text-[16px] font-semibold text-[#e2e2e2] mb-1">
                  Your email will appear here
                </p>
                <p className="text-[13px] text-[#6b5b7a] max-w-[260px] leading-relaxed">
                  Select a template or fill in the details on the left, then click{" "}
                  <strong className="text-[#9b8da8]">Generate Email</strong>.
                </p>
              </div>
            </div>
          )}

          {/* Loading skeleton (before first chunk arrives) */}
          {isLoading && !hasOutput && (
            <div className="glass-panel rounded-2xl overflow-hidden">
              <div
                className="px-6 py-4 border-b border-[rgba(255,255,255,0.06)]"
                style={{ background: "rgba(0,0,0,0.2)" }}
              >
                <div className="h-4 w-48 rounded animate-pulse bg-[rgba(255,255,255,0.07)]" />
              </div>
              <div className="px-6 py-5 flex flex-col gap-3">
                {[100, 88, 94, 72, 84, 60, 78, 90].map((w, i) => (
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

          {/* Email preview card */}
          {(hasOutput || (isLoading && completion)) && (
            <>
              {/* Stats bar */}
              {hasOutput && (
                <div className="flex flex-wrap items-center gap-4 px-1">
                  {[
                    { icon: "schedule", color: "#4cd7f6", value: stats.readingTime, unit: "read" },
                    { icon: "text_fields", color: "#ddb7ff", value: stats.wordCount.toLocaleString(), unit: "words" },
                    { icon: "abc", color: "#adc6ff", value: stats.charCount.toLocaleString(), unit: "chars" },
                  ].map(({ icon, color, value, unit }) => (
                    <span key={unit} className="flex items-center gap-1.5 text-[12px] text-[#6b5b7a]">
                      <span className="material-symbols-outlined text-[14px]" style={{ color }} aria-hidden="true">
                        {icon}
                      </span>
                      <span className="text-[#988d9f] font-medium">{value}</span> {unit}
                    </span>
                  ))}
                </div>
              )}

              {/* Card */}
              <div
                className="glass-panel rounded-2xl overflow-hidden"
                aria-live="polite"
                aria-label="Generated email preview"
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
                      mail
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    {subject ? (
                      <p className="text-[14px] font-semibold text-[#e2e2e2] truncate">
                        {subject}
                      </p>
                    ) : (
                      <div className="h-4 w-40 rounded bg-[rgba(255,255,255,0.07)] animate-pulse" />
                    )}
                    {recipient && (
                      <p className="text-[12px] text-[#6b5b7a] truncate mt-0.5">
                        To: {recipient}
                      </p>
                    )}
                  </div>
                </div>

                {/* Body */}
                <div className="px-6 py-5">
                  <pre className="text-[14px] text-[#cfc2d6] leading-[1.8] whitespace-pre-wrap font-sans">
                    {body}
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
                    label="Copy email"
                    active={copied}
                    activeIcon="check"
                    activeLabel="Copied!"
                  />
                  <ActionButton
                    onClick={handleRegenerate}
                    icon="refresh"
                    label="Regenerate email"
                  />
                  <ActionButton
                    onClick={handleDownload}
                    icon="download"
                    label="Download as TXT"
                    active={downloaded}
                    activeIcon="check"
                    activeLabel="Saved!"
                  />
                  <ActionButton
                    onClick={handleClearOutput}
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
                <p className="text-[14px] font-semibold text-[#ef4444]">Generation failed</p>
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
