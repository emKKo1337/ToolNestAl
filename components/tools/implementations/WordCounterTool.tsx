"use client";

import { useState, useMemo, useRef } from "react";

function analyze(text: string) {
  const words = text.trim() === "" ? 0 : text.trim().split(/\s+/).length;
  const chars = text.length;
  const charsNoSpaces = text.replace(/\s/g, "").length;
  const sentences = text.trim() === "" ? 0 : (text.match(/[^.!?]*[.!?]+/g) ?? []).length || (text.trim().length > 0 ? 1 : 0);
  const paragraphs = text.trim() === "" ? 0 : text.split(/\n\s*\n/).filter((p) => p.trim().length > 0).length || (text.trim().length > 0 ? 1 : 0);
  const readingTime = words === 0 ? 0 : Math.max(1, Math.ceil(words / 225));
  const uniqueWords = text.trim() === "" ? 0 : new Set(text.toLowerCase().match(/\b\w+\b/g) ?? []).size;
  return { words, chars, charsNoSpaces, sentences, paragraphs, readingTime, uniqueWords };
}

const LIMITS = [
  { label: "Twitter / X", limit: 280 },
  { label: "Meta description", limit: 155 },
  { label: "LinkedIn post", limit: 3000 },
  { label: "Custom", limit: -1 },
];

interface StatCardProps {
  value: number | string;
  label: string;
  icon: string;
  color: string;
}

function StatCard({ value, label, icon, color }: StatCardProps) {
  return (
    <div className="glass-panel rounded-xl p-4 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span className="material-symbols-outlined text-[18px]" style={{ color }} aria-hidden="true">{icon}</span>
        <span className="text-[12px] font-semibold text-[#988d9f] uppercase tracking-[0.06em]">{label}</span>
      </div>
      <span className="text-[28px] font-extrabold leading-none tracking-tight" style={{ color }}>
        {value}
      </span>
    </div>
  );
}

export default function WordCounterTool() {
  const [text, setText] = useState("");
  const [limitIdx, setLimitIdx] = useState(0);
  const [customLimit, setCustomLimit] = useState(500);
  const [copied, setCopied] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const stats = useMemo(() => analyze(text), [text]);

  const activeLimit = LIMITS[limitIdx].limit === -1 ? customLimit : LIMITS[limitIdx].limit;
  const isLimited = LIMITS[limitIdx].limit !== -1 || limitIdx === LIMITS.length - 1;
  const pct = isLimited ? Math.min(100, (stats.chars / activeLimit) * 100) : 0;
  const overLimit = isLimited && stats.chars > activeLimit;

  const limitColor = overLimit ? "#ef4444" : pct > 80 ? "#f59e0b" : "#4cd7f6";

  const handleCopy = async () => {
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClear = () => { setText(""); textareaRef.current?.focus(); };

  return (
    <div className="mb-12 flex flex-col gap-6">
      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard value={stats.words.toLocaleString()} label="Words" icon="text_fields" color="#ddb7ff" />
        <StatCard value={stats.chars.toLocaleString()} label="Characters" icon="abc" color="#4cd7f6" />
        <StatCard value={stats.sentences.toLocaleString()} label="Sentences" icon="format_list_numbered" color="#adc6ff" />
        <StatCard value={stats.paragraphs.toLocaleString()} label="Paragraphs" icon="segment" color="#ffb4ab" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <StatCard value={stats.charsNoSpaces.toLocaleString()} label="No Spaces" icon="space_bar" color="#988d9f" />
        <StatCard value={stats.uniqueWords.toLocaleString()} label="Unique Words" icon="fingerprint" color="#4cd7f6" />
        <StatCard
          value={stats.readingTime === 0 ? "—" : `${stats.readingTime} min`}
          label="Read Time"
          icon="schedule"
          color="#22c55e"
        />
      </div>

      {/* Textarea */}
      <div className="glass-panel rounded-2xl p-5 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <label htmlFor="word-counter-input" className="text-[15px] font-semibold text-[#e2e2e2]">
            Your Text
          </label>
          <div className="flex gap-2">
            <button
              onClick={handleCopy}
              disabled={!text}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all disabled:opacity-40"
              style={{
                background: copied ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.06)",
                color: copied ? "#22c55e" : "#988d9f",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <span className="material-symbols-outlined text-[14px]">{copied ? "check" : "content_copy"}</span>
              {copied ? "Copied!" : "Copy"}
            </button>
            <button
              onClick={handleClear}
              disabled={!text}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all disabled:opacity-40"
              style={{ background: "rgba(255,255,255,0.06)", color: "#988d9f", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              <span className="material-symbols-outlined text-[14px]">delete_sweep</span>
              Clear
            </button>
          </div>
        </div>
        <textarea
          id="word-counter-input"
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste or type your text here… statistics update in real time."
          rows={10}
          className="bg-[rgba(0,0,0,0.25)] border border-[rgba(255,255,255,0.08)] rounded-xl px-4 py-3 text-[15px] text-[#e2e2e2] placeholder-[#4d4354] focus:outline-none focus:border-[#ddb7ff] transition-colors resize-y leading-relaxed"
          aria-label="Text input for word counting"
        />
      </div>

      {/* Character limit */}
      <div className="glass-panel rounded-2xl p-5">
        <p className="text-[13px] font-semibold text-[#988d9f] uppercase tracking-[0.08em] mb-3">Character Limit</p>
        <div className="flex flex-wrap gap-2 mb-4">
          {LIMITS.map((l, i) => (
            <button
              key={l.label}
              onClick={() => setLimitIdx(i)}
              aria-pressed={limitIdx === i}
              className="px-3 py-2 rounded-lg text-[13px] font-semibold transition-all"
              style={{
                background: limitIdx === i ? "rgba(76,215,246,0.12)" : "rgba(255,255,255,0.04)",
                color: limitIdx === i ? "#4cd7f6" : "#988d9f",
                border: `1px solid ${limitIdx === i ? "rgba(76,215,246,0.3)" : "rgba(255,255,255,0.08)"}`,
              }}
            >
              {l.label}{l.limit !== -1 ? ` (${l.limit})` : ""}
            </button>
          ))}
        </div>
        {limitIdx === LIMITS.length - 1 && (
          <div className="flex items-center gap-3 mb-4">
            <label className="text-[13px] text-[#988d9f]">Custom limit:</label>
            <input
              type="number"
              min={1}
              value={customLimit}
              onChange={(e) => setCustomLimit(Math.max(1, Number(e.target.value)))}
              className="bg-[rgba(0,0,0,0.3)] border border-[rgba(255,255,255,0.1)] rounded-lg px-3 py-2 text-[#e2e2e2] text-[14px] w-28 focus:outline-none focus:border-[#4cd7f6]"
              aria-label="Custom character limit"
            />
          </div>
        )}
        <div className="flex justify-between items-center mb-2">
          <span className="text-[13px]" style={{ color: limitColor }}>
            {stats.chars.toLocaleString()} / {activeLimit.toLocaleString()} characters
          </span>
          <span className="text-[12px] font-bold" style={{ color: limitColor }}>
            {overLimit ? `${(stats.chars - activeLimit).toLocaleString()} over` : `${(activeLimit - stats.chars).toLocaleString()} remaining`}
          </span>
        </div>
        <div className="h-2.5 rounded-full bg-[rgba(255,255,255,0.08)] overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{ width: `${pct}%`, backgroundColor: limitColor }}
          />
        </div>
      </div>
    </div>
  );
}
