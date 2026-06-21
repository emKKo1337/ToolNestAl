"use client";

import { useState, useMemo, useRef, useCallback } from "react";

// ── Stop-words (omitted from keyword frequency) ───────────────────────────────

const STOP = new Set([
  "a","an","the","and","or","but","if","in","on","at","to","for","of","with",
  "by","from","up","about","into","through","during","is","are","was","were",
  "be","been","being","have","has","had","do","does","did","will","would",
  "could","should","may","might","must","shall","can","that","this","these",
  "those","it","its","i","you","he","she","we","they","me","him","her","us",
  "them","my","your","his","our","their","what","which","who","whom","when",
  "where","why","how","all","both","each","few","more","most","other","some",
  "such","no","not","only","same","so","than","too","very","s","t","just",
  "don","as","then","now","here","there","also","any","been","after","before",
  "while","out","off","over","under","again","further","once","own","between",
]);

// ── Analysis engine ───────────────────────────────────────────────────────────

interface Stats {
  chars: number;
  charsNoSpaces: number;
  words: number;
  uniqueWords: number;
  sentences: number;
  paragraphs: number;
  lines: number;
  readingTimeSec: number;
  speakingTimeSec: number;
  avgWordLength: number;
  avgSentenceLength: number;
  longestWord: string;
  shortestWord: string;
  longestSentence: string;
  topKeywords: { word: string; count: number; density: number }[];
  fleschScore: number;
  readingLevel: string;
  difficulty: string;
}

const EMPTY: Stats = {
  chars: 0, charsNoSpaces: 0, words: 0, uniqueWords: 0,
  sentences: 0, paragraphs: 0, lines: 0,
  readingTimeSec: 0, speakingTimeSec: 0,
  avgWordLength: 0, avgSentenceLength: 0,
  longestWord: "—", shortestWord: "—", longestSentence: "—",
  topKeywords: [], fleschScore: 0,
  readingLevel: "—", difficulty: "—",
};

function syllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!w) return 0;
  if (w.length <= 3) return 1;
  const count = w
    .replace(/(?:[^laeiouy]|ed|[^laeiouy]e)$/, "")
    .replace(/^y/, "")
    .match(/[aeiouy]{1,2}/g);
  return Math.max(1, count ? count.length : 1);
}

function fleschLevel(score: number): { level: string; difficulty: string } {
  if (score >= 90) return { level: "5th grade",       difficulty: "Very Easy"    };
  if (score >= 80) return { level: "6th grade",       difficulty: "Easy"         };
  if (score >= 70) return { level: "7th grade",       difficulty: "Fairly Easy"  };
  if (score >= 60) return { level: "8th–9th grade",   difficulty: "Standard"     };
  if (score >= 50) return { level: "10th–12th grade", difficulty: "Fairly Hard"  };
  if (score >= 30) return { level: "College",         difficulty: "Difficult"    };
  return               { level: "College graduate",   difficulty: "Very Difficult" };
}

function analyse(text: string): Stats {
  if (!text.trim()) return EMPTY;

  // Basic counts
  const chars        = text.length;
  const charsNoSpaces = text.replace(/\s/g, "").length;
  const lines        = text.split("\n").length;
  const paragraphs   = text.split(/\n\s*\n/).filter((p) => p.trim()).length || 1;

  // Words
  const wordMatches = text.match(/\b\w+(?:'\w+)?\b/g) ?? [];
  const words       = wordMatches.length;
  const uniqueWords = new Set(wordMatches.map((w) => w.toLowerCase())).size;

  // Sentences — split on .!? followed by whitespace or end-of-string
  const sentenceMatches = text
    .split(/(?<=[.!?])\s+|(?<=[.!?])$/)
    .map((s) => s.trim())
    .filter(Boolean);
  const sentences = sentenceMatches.length;

  // Reading / speaking time
  const readingTimeSec  = Math.ceil((words / 238) * 60);
  const speakingTimeSec = Math.ceil((words / 130) * 60);

  // Word metrics
  const wordLengths = wordMatches.map((w) => w.replace(/'/g, "").length);
  const avgWordLength = words
    ? parseFloat((wordLengths.reduce((a, b) => a + b, 0) / words).toFixed(1))
    : 0;
  const avgSentenceLength = sentences
    ? parseFloat((words / sentences).toFixed(1))
    : 0;
  const sortedByLen = [...wordMatches].sort((a, b) => b.length - a.length);
  const longestWord  = sortedByLen[0] ?? "—";
  const shortestWord = sortedByLen[sortedByLen.length - 1] ?? "—";
  const longestSentence = [...sentenceMatches].sort((a, b) => b.length - a.length)[0] ?? "—";

  // Keyword frequency
  const freq = new Map<string, number>();
  for (const w of wordMatches) {
    const lw = w.toLowerCase();
    if (!STOP.has(lw) && lw.length > 2) {
      freq.set(lw, (freq.get(lw) ?? 0) + 1);
    }
  }
  const topKeywords = [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word, count]) => ({
      word,
      count,
      density: words ? parseFloat(((count / words) * 100).toFixed(2)) : 0,
    }));

  // Flesch Reading Ease
  let totalSyl = 0;
  for (const w of wordMatches) totalSyl += syllables(w);
  const fleschScore =
    sentences && words
      ? parseFloat(
          (206.835 - 1.015 * (words / sentences) - 84.6 * (totalSyl / words)).toFixed(1)
        )
      : 0;
  const clamped = Math.max(0, Math.min(100, fleschScore));
  const { level: readingLevel, difficulty } = fleschLevel(clamped);

  return {
    chars, charsNoSpaces, words, uniqueWords, sentences, paragraphs, lines,
    readingTimeSec, speakingTimeSec, avgWordLength, avgSentenceLength,
    longestWord, shortestWord, longestSentence,
    topKeywords, fleschScore: clamped, readingLevel, difficulty,
  };
}

function fmtTime(sec: number): string {
  if (sec === 0) return "0 sec";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m === 0) return `${s} sec`;
  if (s === 0) return `${m} min`;
  return `${m} min ${s} sec`;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[11px] font-bold text-[#988d9f] uppercase tracking-[0.1em] mb-3">
      {children}
    </h3>
  );
}

function StatCard({
  label,
  value,
  color = "#e2e2e2",
  mono = false,
}: {
  label: string;
  value: string | number;
  color?: string;
  mono?: boolean;
}) {
  return (
    <div className="glass-panel rounded-xl px-4 py-3 flex flex-col gap-0.5">
      <span className="text-[11px] font-semibold text-[#988d9f] uppercase tracking-[0.06em] leading-tight">
        {label}
      </span>
      <span
        className={`text-[20px] font-extrabold leading-tight tracking-tight truncate ${mono ? "font-mono" : ""}`}
        style={{ color }}
        title={typeof value === "string" ? value : undefined}
      >
        {value}
      </span>
    </div>
  );
}

function DifficultyBar({ score }: { score: number }) {
  const pct = Math.max(0, Math.min(100, score));
  // Green (easy) → yellow → red (hard). Reversed: high score = easy.
  const hue = Math.round((pct / 100) * 120); // 0=red,120=green
  const barColor = `hsl(${hue},80%,52%)`;
  return (
    <div className="mt-3">
      <div className="flex justify-between text-[11px] text-[#988d9f] mb-1">
        <span>Very Difficult</span>
        <span>Very Easy</span>
      </div>
      <div
        className="w-full h-2 rounded-full overflow-hidden"
        style={{ background: "rgba(255,255,255,0.08)" }}
        role="meter"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Flesch score ${pct}`}
      >
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${pct}%`, background: barColor }}
        />
      </div>
      <p className="text-right text-[11px] mt-1" style={{ color: barColor }}>
        {pct.toFixed(1)} / 100
      </p>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function TextStatisticsTool() {
  const [input, setInput] = useState("");
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef  = useRef<HTMLInputElement>(null);

  const stats = useMemo(() => analyse(input), [input]);
  const hasText = input.trim().length > 0;

  const btnBase = {
    background: "rgba(255,255,255,0.06)",
    color: "#988d9f",
    border: "1px solid rgba(255,255,255,0.08)",
  } as const;

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

  const handleCopy = useCallback(async () => {
    if (!input) return;
    await navigator.clipboard.writeText(input);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [input]);

  const handleDownload = useCallback(() => {
    if (!input) return;
    const blob = new Blob([input], { type: "text/plain;charset=utf-8" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = "text-statistics.txt";
    a.click();
    URL.revokeObjectURL(url);
  }, [input]);

  const handleUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setInput(ev.target?.result as string ?? "");
    reader.readAsText(file, "utf-8");
    e.target.value = "";
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="mb-12 flex flex-col gap-5">

      {/* ── Input ──────────────────────────────────────────────────────────── */}
      <div className="glass-panel rounded-2xl p-5 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <label htmlFor="ts-input" className="text-[15px] font-semibold text-[#e2e2e2]">
            Your Text
          </label>
          <div className="flex flex-wrap gap-2">
            <button onClick={handlePaste} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all" style={btnBase}>
              <span className="material-symbols-outlined text-[14px]">content_paste</span>Paste
            </button>
            <button onClick={() => fileRef.current?.click()} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all" style={btnBase}>
              <span className="material-symbols-outlined text-[14px]">upload_file</span>Upload TXT
            </button>
            <input ref={fileRef} type="file" accept=".txt,text/plain" onChange={handleUpload} className="hidden" aria-label="Upload a TXT file" />
            <button onClick={handleCopy} disabled={!input} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all disabled:opacity-40" style={{ background: copied ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.06)", color: copied ? "#22c55e" : "#988d9f", border: "1px solid rgba(255,255,255,0.08)" }}>
              <span className="material-symbols-outlined text-[14px]">{copied ? "check" : "content_copy"}</span>{copied ? "Copied!" : "Copy"}
            </button>
            <button onClick={handleDownload} disabled={!input} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all disabled:opacity-40" style={btnBase}>
              <span className="material-symbols-outlined text-[14px]">download</span>Download
            </button>
            <button onClick={handleClear} disabled={!input} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all disabled:opacity-40" style={btnBase}>
              <span className="material-symbols-outlined text-[14px]">delete_sweep</span>Clear
            </button>
          </div>
        </div>
        <textarea
          id="ts-input"
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Paste or type your text here — statistics update instantly…"
          rows={10}
          className="bg-[rgba(0,0,0,0.25)] border border-[rgba(255,255,255,0.08)] rounded-xl px-4 py-3 text-[15px] text-[#e2e2e2] placeholder-[#4d4354] focus:outline-none focus:border-[#4ade80] transition-colors resize-y leading-relaxed w-full"
          aria-label="Text to analyse"
          spellCheck={false}
        />
      </div>

      {/* ── Basic Statistics ────────────────────────────────────────────────── */}
      <div className="glass-panel rounded-2xl p-5">
        <SectionTitle>Basic Statistics</SectionTitle>
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))" }}>
          <StatCard label="Characters"              value={hasText ? stats.chars.toLocaleString()        : "—"} color="#4ade80" />
          <StatCard label="Chars (no spaces)"       value={hasText ? stats.charsNoSpaces.toLocaleString(): "—"} color="#4ade80" />
          <StatCard label="Words"                   value={hasText ? stats.words.toLocaleString()        : "—"} color="#4cd7f6" />
          <StatCard label="Unique Words"            value={hasText ? stats.uniqueWords.toLocaleString()  : "—"} color="#4cd7f6" />
          <StatCard label="Sentences"               value={hasText ? stats.sentences.toLocaleString()    : "—"} color="#adc6ff" />
          <StatCard label="Paragraphs"              value={hasText ? stats.paragraphs.toLocaleString()   : "—"} color="#adc6ff" />
          <StatCard label="Lines"                   value={hasText ? stats.lines.toLocaleString()        : "—"} color="#988d9f" />
        </div>
      </div>

      {/* ── Reading ─────────────────────────────────────────────────────────── */}
      <div className="glass-panel rounded-2xl p-5">
        <SectionTitle>Reading</SectionTitle>
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))" }}>
          <StatCard label="Reading Time"  value={hasText ? fmtTime(stats.readingTimeSec)  : "—"} color="#ffb4ab" />
          <StatCard label="Speaking Time" value={hasText ? fmtTime(stats.speakingTimeSec) : "—"} color="#ffb4ab" />
        </div>
      </div>

      {/* ── Writing Metrics ─────────────────────────────────────────────────── */}
      <div className="glass-panel rounded-2xl p-5">
        <SectionTitle>Writing Metrics</SectionTitle>
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))" }}>
          <StatCard label="Avg Word Length"     value={hasText ? `${stats.avgWordLength} chars`   : "—"} color="#4ade80" />
          <StatCard label="Avg Sentence Length" value={hasText ? `${stats.avgSentenceLength} words`: "—"} color="#4ade80" />
          <StatCard label="Longest Word"        value={hasText ? stats.longestWord   : "—"} color="#4cd7f6" mono />
          <StatCard label="Shortest Word"       value={hasText ? stats.shortestWord  : "—"} color="#4cd7f6" mono />
        </div>
        {hasText && stats.longestSentence !== "—" && (
          <div className="mt-3 rounded-xl px-4 py-3" style={{ background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <p className="text-[11px] font-semibold text-[#988d9f] uppercase tracking-[0.06em] mb-1">Longest Sentence</p>
            <p className="text-[13px] text-[#c4b5cf] leading-relaxed line-clamp-4">{stats.longestSentence}</p>
          </div>
        )}
      </div>

      {/* ── Keyword Analysis ────────────────────────────────────────────────── */}
      <div className="glass-panel rounded-2xl p-5">
        <SectionTitle>Keyword Analysis — Top 10 Most Frequent Words</SectionTitle>
        {!hasText || stats.topKeywords.length === 0 ? (
          <p className="text-[14px] text-[#4d4354]">No content words found yet.</p>
        ) : (
          <div className="flex flex-col gap-2" role="list" aria-label="Top keywords">
            {stats.topKeywords.map(({ word, count, density }, i) => {
              const maxCount = stats.topKeywords[0].count;
              const barPct   = maxCount ? (count / maxCount) * 100 : 0;
              return (
                <div key={word} className="flex items-center gap-3" role="listitem">
                  <span className="text-[11px] font-bold w-5 text-right shrink-0" style={{ color: "#5a4d63" }}>
                    {i + 1}
                  </span>
                  <span className="font-mono text-[14px] font-semibold w-28 shrink-0 truncate" style={{ color: "#e2e2e2" }}>
                    {word}
                  </span>
                  <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{ width: `${barPct}%`, background: "rgba(74,222,128,0.6)" }}
                    />
                  </div>
                  <span className="text-[12px] font-bold w-8 text-right shrink-0" style={{ color: "#4ade80" }}>
                    {count}
                  </span>
                  <span className="text-[11px] w-14 text-right shrink-0" style={{ color: "#988d9f" }}>
                    {density}%
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Readability ─────────────────────────────────────────────────────── */}
      <div className="glass-panel rounded-2xl p-5">
        <SectionTitle>Readability</SectionTitle>
        <div className="grid gap-3 mb-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))" }}>
          <StatCard label="Est. Reading Level" value={hasText ? stats.readingLevel : "—"} color="#ddb7ff" />
          <StatCard label="Difficulty"         value={hasText ? stats.difficulty   : "—"} color="#ddb7ff" />
        </div>
        {hasText && <DifficultyBar score={stats.fleschScore} />}
        <p className="text-[11px] text-[#5a4d63] mt-3 leading-relaxed">
          Based on the Flesch Reading Ease formula. Higher scores = easier to read.
        </p>
      </div>
    </div>
  );
}
