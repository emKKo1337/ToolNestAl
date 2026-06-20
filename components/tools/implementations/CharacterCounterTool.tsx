"use client";

import { useState, useMemo, useRef, useCallback } from "react";

function analyze(text: string) {
  const chars = text.length;
  const charsNoSpaces = text.replace(/\s/g, "").length;
  const trimmed = text.trim();
  const words = trimmed === "" ? 0 : trimmed.split(/\s+/).length;
  const sentences =
    trimmed === ""
      ? 0
      : (text.match(/[^.!?]*[.!?]+/g) ?? []).length || (trimmed.length > 0 ? 1 : 0);
  const paragraphs =
    trimmed === ""
      ? 0
      : text.split(/\n\s*\n/).filter((p) => p.trim().length > 0).length ||
        (trimmed.length > 0 ? 1 : 0);
  const readingTimeSec = words === 0 ? 0 : Math.round((words / 225) * 60);
  const speakingTimeSec = words === 0 ? 0 : Math.round((words / 130) * 60);
  const allWords = text.toLowerCase().match(/\b\w+\b/g) ?? [];
  const avgWordLen =
    allWords.length === 0
      ? 0
      : allWords.reduce((s, w) => s + w.length, 0) / allWords.length;
  const avgSentenceLen = sentences === 0 ? 0 : words / sentences;

  return {
    chars,
    charsNoSpaces,
    words,
    sentences,
    paragraphs,
    readingTimeSec,
    speakingTimeSec,
    avgWordLen,
    avgSentenceLen,
  };
}

function fmtTime(totalSec: number): string {
  if (totalSec === 0) return "—";
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  if (m === 0) return `${s}s`;
  if (s === 0) return `${m} min`;
  return `${m} min ${s}s`;
}

interface StatCardProps {
  value: string;
  label: string;
  icon: string;
  color: string;
}

function StatCard({ value, label, icon, color }: StatCardProps) {
  return (
    <div className="glass-panel rounded-xl p-4 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span
          className="material-symbols-outlined text-[18px]"
          style={{ color }}
          aria-hidden="true"
        >
          {icon}
        </span>
        <span className="text-[12px] font-semibold text-[#988d9f] uppercase tracking-[0.06em]">
          {label}
        </span>
      </div>
      <span
        className="text-[26px] font-extrabold leading-none tracking-tight"
        style={{ color }}
      >
        {value}
      </span>
    </div>
  );
}

export default function CharacterCounterTool() {
  const [text, setText] = useState("");
  const [copied, setCopied] = useState(false);
  const [pasted, setPasted] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const stats = useMemo(() => analyze(text), [text]);

  const handleCopy = useCallback(async () => {
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [text]);

  const handlePaste = useCallback(async () => {
    try {
      const clip = await navigator.clipboard.readText();
      setText(clip);
      setPasted(true);
      setTimeout(() => setPasted(false), 2000);
      textareaRef.current?.focus();
    } catch {
      textareaRef.current?.focus();
    }
  }, []);

  const handleClear = useCallback(() => {
    setText("");
    textareaRef.current?.focus();
  }, []);

  const handleDownload = useCallback(() => {
    if (!text) return;
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "text.txt";
    a.click();
    URL.revokeObjectURL(url);
    setDownloaded(true);
    setTimeout(() => setDownloaded(false), 2000);
  }, [text]);

  return (
    <div className="mb-12 flex flex-col gap-6">
      {/* Primary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          value={stats.chars.toLocaleString()}
          label="Characters"
          icon="abc"
          color="#ddb7ff"
        />
        <StatCard
          value={stats.charsNoSpaces.toLocaleString()}
          label="No Spaces"
          icon="space_bar"
          color="#4cd7f6"
        />
        <StatCard
          value={stats.words.toLocaleString()}
          label="Words"
          icon="text_fields"
          color="#adc6ff"
        />
        <StatCard
          value={stats.sentences.toLocaleString()}
          label="Sentences"
          icon="format_list_numbered"
          color="#ffb4ab"
        />
      </div>

      {/* Secondary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          value={stats.paragraphs.toLocaleString()}
          label="Paragraphs"
          icon="segment"
          color="#22c55e"
        />
        <StatCard
          value={fmtTime(stats.readingTimeSec)}
          label="Reading Time"
          icon="schedule"
          color="#f59e0b"
        />
        <StatCard
          value={fmtTime(stats.speakingTimeSec)}
          label="Speaking Time"
          icon="record_voice_over"
          color="#ddb7ff"
        />
        <StatCard
          value={
            stats.avgWordLen === 0
              ? "—"
              : stats.avgWordLen.toFixed(1)
          }
          label="Avg Word Len"
          icon="straighten"
          color="#4cd7f6"
        />
      </div>

      {/* Avg sentence length — solo card on its own row so grid stays balanced */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          value={
            stats.avgSentenceLen === 0
              ? "—"
              : stats.avgSentenceLen.toFixed(1)
          }
          label="Avg Sentence"
          icon="short_text"
          color="#988d9f"
        />
      </div>

      {/* Textarea panel */}
      <div className="glass-panel rounded-2xl p-5 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <label
            htmlFor="character-counter-input"
            className="text-[15px] font-semibold text-[#e2e2e2]"
          >
            Your Text
          </label>

          <div className="flex flex-wrap gap-2">
            {/* Paste */}
            <button
              onClick={handlePaste}
              aria-label="Paste text from clipboard"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all"
              style={{
                background: pasted
                  ? "rgba(34,197,94,0.15)"
                  : "rgba(255,255,255,0.06)",
                color: pasted ? "#22c55e" : "#988d9f",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <span className="material-symbols-outlined text-[14px]">
                {pasted ? "check" : "content_paste"}
              </span>
              {pasted ? "Pasted!" : "Paste"}
            </button>

            {/* Copy */}
            <button
              onClick={handleCopy}
              disabled={!text}
              aria-label="Copy text to clipboard"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all disabled:opacity-40"
              style={{
                background: copied
                  ? "rgba(34,197,94,0.15)"
                  : "rgba(255,255,255,0.06)",
                color: copied ? "#22c55e" : "#988d9f",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <span className="material-symbols-outlined text-[14px]">
                {copied ? "check" : "content_copy"}
              </span>
              {copied ? "Copied!" : "Copy"}
            </button>

            {/* Download */}
            <button
              onClick={handleDownload}
              disabled={!text}
              aria-label="Download text as TXT file"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all disabled:opacity-40"
              style={{
                background: downloaded
                  ? "rgba(34,197,94,0.15)"
                  : "rgba(255,255,255,0.06)",
                color: downloaded ? "#22c55e" : "#988d9f",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <span className="material-symbols-outlined text-[14px]">
                {downloaded ? "check" : "download"}
              </span>
              {downloaded ? "Saved!" : "Download TXT"}
            </button>

            {/* Clear */}
            <button
              onClick={handleClear}
              disabled={!text}
              aria-label="Clear all text"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all disabled:opacity-40"
              style={{
                background: "rgba(255,255,255,0.06)",
                color: "#988d9f",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <span className="material-symbols-outlined text-[14px]">
                delete_sweep
              </span>
              Clear
            </button>
          </div>
        </div>

        <textarea
          id="character-counter-input"
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste or type your text here… all statistics update in real time."
          rows={12}
          className="bg-[rgba(0,0,0,0.25)] border border-[rgba(255,255,255,0.08)] rounded-xl px-4 py-3 text-[15px] text-[#e2e2e2] placeholder-[#4d4354] focus:outline-none focus:border-[#ddb7ff] transition-colors resize-y leading-relaxed"
          aria-label="Text input for character counting"
          aria-describedby="cc-live-stats"
        />

        {/* Live SR announcement */}
        <p id="cc-live-stats" className="sr-only" aria-live="polite" aria-atomic="true">
          {text.trim()
            ? `${stats.chars} characters, ${stats.words} words, ${stats.sentences} sentences`
            : "No text entered"}
        </p>

        <p className="text-[12px] text-[#4d4354]">
          All processing happens locally in your browser — your text is never uploaded anywhere.
        </p>
      </div>
    </div>
  );
}
