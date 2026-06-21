"use client";

import { useState, useCallback, useMemo } from "react";

// ── Lorem corpus ──────────────────────────────────────────────────────────────

const WORDS = [
  "lorem","ipsum","dolor","sit","amet","consectetur","adipiscing","elit","sed","do",
  "eiusmod","tempor","incididunt","ut","labore","et","dolore","magna","aliqua","enim",
  "ad","minim","veniam","quis","nostrud","exercitation","ullamco","laboris","nisi","aliquip",
  "ex","ea","commodo","consequat","duis","aute","irure","in","reprehenderit","voluptate",
  "velit","esse","cillum","fugiat","nulla","pariatur","excepteur","sint","occaecat","cupidatat",
  "non","proident","sunt","culpa","qui","officia","deserunt","mollit","anim","id","est",
  "laborum","at","vero","eos","accusamus","iusto","odio","dignissimos","ducimus","blanditiis",
  "praesentium","voluptatum","deleniti","atque","corrupti","quos","dolores","quas","molestias",
  "excepturi","similique","culpae","harum","rerum","facilis","expedita","distinctio","nam",
  "libero","tempore","cum","soluta","nobis","eligendi","optio","cumque","nihil","impedit",
  "minus","quod","maxime","placeat","facere","possimus","omnis","voluptas","assumenda",
  "repellendus","temporibus","autem","quibusdam","officiis","debitis","rerum","necessitatibus",
  "saepe","eveniet","voluptates","repudiandae","recusandae","itaque","earum","hic","tenetur",
  "sapiente","delectus","reiciendis","maiores","alias","perferendis","doloribus","asperiores",
];

const LOREM_START = "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.";

function rng(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

function pickWords(count: number, rand: () => number): string[] {
  const result: string[] = [];
  for (let i = 0; i < count; i++) {
    result.push(WORDS[Math.floor(rand() * WORDS.length)]);
  }
  return result;
}

function makeSentence(wordCount: number, rand: () => number, capitalise: boolean): string {
  const words = pickWords(wordCount, rand);
  if (capitalise) words[0] = words[0].charAt(0).toUpperCase() + words[0].slice(1);
  return words.join(" ") + ".";
}

function makeParagraph(sentenceCount: number, rand: () => number): string {
  const sentences: string[] = [];
  for (let i = 0; i < sentenceCount; i++) {
    const wordCount = 6 + Math.floor(rand() * 12); // 6–17 words per sentence
    sentences.push(makeSentence(wordCount, rand, true));
  }
  return sentences.join(" ");
}

// ── Generator ─────────────────────────────────────────────────────────────────

type Mode = "words" | "sentences" | "paragraphs";

interface GenOptions {
  mode: Mode;
  count: number;
  startWithLorem: boolean;
  randomise: boolean;
  htmlOutput: boolean;
}

function generate(opts: GenOptions): string {
  const seed = opts.randomise ? Date.now() : 42;
  const rand = rng(seed);

  const n = Math.max(1, Math.min(opts.count, 999));

  if (opts.mode === "words") {
    const words = opts.startWithLorem
      ? ["Lorem", "ipsum", ...pickWords(Math.max(0, n - 2), rand)]
      : pickWords(n, rand);
    const text = words.slice(0, n).join(" ") + ".";
    return opts.htmlOutput ? `<p>${text}</p>` : text;
  }

  if (opts.mode === "sentences") {
    const sentences: string[] = [];
    for (let i = 0; i < n; i++) {
      const wordCount = 6 + Math.floor(rand() * 12);
      sentences.push(makeSentence(wordCount, rand, true));
    }
    if (opts.startWithLorem && sentences.length > 0) {
      sentences[0] = LOREM_START;
    }
    const text = sentences.join(" ");
    return opts.htmlOutput ? `<p>${text}</p>` : text;
  }

  // paragraphs
  const paragraphs: string[] = [];
  for (let i = 0; i < n; i++) {
    const sentCount = 3 + Math.floor(rand() * 5); // 3–7 sentences per paragraph
    paragraphs.push(makeParagraph(sentCount, rand));
  }
  if (opts.startWithLorem && paragraphs.length > 0) {
    paragraphs[0] = LOREM_START + " " + paragraphs[0];
  }

  if (opts.htmlOutput) {
    return paragraphs.map((p) => `<p>${p}</p>`).join("\n\n");
  }
  return paragraphs.join("\n\n");
}

// ── Stats ─────────────────────────────────────────────────────────────────────

function getStats(text: string) {
  if (!text) return { chars: 0, words: 0, paragraphs: 0 };
  const stripped = text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return {
    chars: text.length,
    words: stripped === "" ? 0 : stripped.split(" ").length,
    paragraphs: text.split(/\n\n+/).filter(Boolean).length || (text ? 1 : 0),
  };
}

// ── Stat chip ─────────────────────────────────────────────────────────────────

function Stat({ label, value, color = "#4ade80" }: { label: string; value: number; color?: string }) {
  return (
    <div className="glass-panel rounded-xl px-4 py-3 flex flex-col gap-0.5">
      <span className="text-[11px] font-semibold text-[#988d9f] uppercase tracking-[0.06em]">
        {label}
      </span>
      <span className="text-[22px] font-extrabold leading-none tracking-tight" style={{ color }}>
        {value.toLocaleString()}
      </span>
    </div>
  );
}

// ── Toggle ────────────────────────────────────────────────────────────────────

function Toggle({
  id,
  label,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label htmlFor={id} className="flex items-center gap-3 cursor-pointer select-none group">
      <div className="relative shrink-0">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only"
        />
        <div
          className="w-10 h-5 rounded-full transition-colors duration-200"
          style={{ background: checked ? "rgba(74,222,128,0.35)" : "rgba(255,255,255,0.1)" }}
        />
        <div
          className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full shadow transition-all duration-200"
          style={{
            background: checked ? "#4ade80" : "#988d9f",
            transform: checked ? "translateX(20px)" : "translateX(0)",
          }}
        />
      </div>
      <span className="text-[14px] text-[#c4b5cf] group-hover:text-[#e2e2e2] transition-colors">
        {label}
      </span>
    </label>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

const MODES: { value: Mode; label: string }[] = [
  { value: "words",      label: "Words"      },
  { value: "sentences",  label: "Sentences"  },
  { value: "paragraphs", label: "Paragraphs" },
];

export default function LoremIpsumGeneratorTool() {
  const [mode, setMode]                       = useState<Mode>("paragraphs");
  const [count, setCount]                     = useState(3);
  const [startWithLorem, setStartWithLorem]   = useState(true);
  const [randomise, setRandomise]             = useState(false);
  const [htmlOutput, setHtmlOutput]           = useState(false);
  const [output, setOutput]                   = useState("");
  const [hasGenerated, setHasGenerated]       = useState(false);
  const [copied, setCopied]                   = useState(false);

  const stats = useMemo(() => getStats(output), [output]);

  const btnBase = {
    background: "rgba(255,255,255,0.06)",
    color: "#988d9f",
    border: "1px solid rgba(255,255,255,0.08)",
  } as const;

  const handleGenerate = useCallback(() => {
    const result = generate({ mode, count, startWithLorem, randomise, htmlOutput });
    setOutput(result);
    setHasGenerated(true);
  }, [mode, count, startWithLorem, randomise, htmlOutput]);

  const handleCopy = useCallback(async () => {
    if (!output) return;
    await navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [output]);

  const handleClear = useCallback(() => {
    setOutput("");
    setHasGenerated(false);
  }, []);

  const handleDownload = useCallback(() => {
    if (!output) return;
    const ext  = htmlOutput ? "html" : "txt";
    const mime = htmlOutput ? "text/html;charset=utf-8" : "text/plain;charset=utf-8";
    const blob = new Blob([output], { type: mime });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `lorem-ipsum.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  }, [output, htmlOutput]);

  const defaultCount: Record<Mode, number> = { words: 50, sentences: 5, paragraphs: 3 };

  const handleModeChange = (m: Mode) => {
    setMode(m);
    setCount(defaultCount[m]);
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="mb-12 flex flex-col gap-5">

      {/* ── Controls ─────────────────────────────────────────────────────── */}
      <div className="glass-panel rounded-2xl p-5 flex flex-col gap-5">

        {/* Mode selector */}
        <div className="flex flex-col gap-2">
          <span className="text-[12px] font-semibold text-[#988d9f] uppercase tracking-[0.08em]">
            Generate
          </span>
          <div className="flex flex-wrap gap-2">
            {MODES.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => handleModeChange(value)}
                aria-pressed={mode === value}
                className="px-5 py-2.5 rounded-xl text-[14px] font-bold transition-all"
                style={{
                  background: mode === value ? "rgba(74,222,128,0.12)" : "rgba(255,255,255,0.04)",
                  color: mode === value ? "#4ade80" : "#988d9f",
                  border: `1px solid ${mode === value ? "rgba(74,222,128,0.35)" : "rgba(255,255,255,0.08)"}`,
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Count input */}
        <div className="flex items-center gap-4">
          <label
            htmlFor="lip-count"
            className="text-[13px] font-semibold text-[#988d9f] uppercase tracking-[0.06em] shrink-0"
          >
            Number of {mode.charAt(0).toUpperCase() + mode.slice(1)}
          </label>
          <input
            id="lip-count"
            type="number"
            min={1}
            max={999}
            value={count}
            onChange={(e) => setCount(Math.max(1, Math.min(999, parseInt(e.target.value, 10) || 1)))}
            className="w-24 bg-[rgba(0,0,0,0.3)] border border-[rgba(255,255,255,0.08)] rounded-xl px-4 py-2.5 text-[16px] font-bold text-[#e2e2e2] text-center focus:outline-none focus:border-[#4ade80] transition-colors"
            aria-label={`Number of ${mode}`}
          />
        </div>

        {/* Options */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Toggle
            id="start-lorem"
            label='Start with "Lorem ipsum…"'
            checked={startWithLorem}
            onChange={setStartWithLorem}
          />
          <Toggle
            id="randomise"
            label="Randomised Lorem Ipsum"
            checked={randomise}
            onChange={setRandomise}
          />
          <Toggle
            id="html-output"
            label="HTML output (<p> tags)"
            checked={htmlOutput}
            onChange={setHtmlOutput}
          />
          <Toggle
            id="plain-output"
            label="Plain text output"
            checked={!htmlOutput}
            onChange={(v) => setHtmlOutput(!v)}
          />
        </div>

        {/* Generate button */}
        <button
          onClick={handleGenerate}
          className="self-start flex items-center gap-2 px-6 py-3 rounded-xl text-[15px] font-bold transition-all"
          style={{
            background: "rgba(74,222,128,0.15)",
            color: "#4ade80",
            border: "1px solid rgba(74,222,128,0.4)",
          }}
          aria-label="Generate Lorem Ipsum text"
        >
          <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
          Generate
        </button>
      </div>

      {/* ── Output ───────────────────────────────────────────────────────── */}
      <div className="glass-panel rounded-2xl p-5 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-[15px] font-semibold text-[#e2e2e2]">Output</span>
            {output && (
              <span
                className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                style={{
                  background: "rgba(74,222,128,0.12)",
                  color: "#4ade80",
                  border: "1px solid rgba(74,222,128,0.25)",
                }}
              >
                {htmlOutput ? "HTML" : "Plain text"}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleCopy}
              disabled={!output}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all disabled:opacity-40"
              style={{
                background: copied ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.06)",
                color: copied ? "#22c55e" : "#988d9f",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <span className="material-symbols-outlined text-[14px]">
                {copied ? "check" : "content_copy"}
              </span>
              {copied ? "Copied!" : "Copy"}
            </button>
            <button
              onClick={handleDownload}
              disabled={!output}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all disabled:opacity-40"
              style={btnBase}
            >
              <span className="material-symbols-outlined text-[14px]">download</span>
              Download {htmlOutput ? "HTML" : "TXT"}
            </button>
            <button
              onClick={handleClear}
              disabled={!output}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all disabled:opacity-40"
              style={btnBase}
            >
              <span className="material-symbols-outlined text-[14px]">delete_sweep</span>
              Clear
            </button>
          </div>
        </div>

        <textarea
          readOnly
          value={output}
          placeholder="Click Generate to create Lorem Ipsum text…"
          rows={12}
          className="bg-[rgba(0,0,0,0.25)] border border-[rgba(255,255,255,0.08)] rounded-xl px-4 py-3 text-[15px] text-[#e2e2e2] placeholder-[#4d4354] focus:outline-none focus:border-[#4ade80] transition-colors resize-y leading-relaxed w-full font-mono"
          aria-label="Generated Lorem Ipsum text"
          aria-live="polite"
          spellCheck={false}
        />
      </div>

      {/* ── Stats ────────────────────────────────────────────────────────── */}
      <div
        className="grid gap-3"
        style={{ gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))" }}
        aria-label="Statistics"
      >
        <Stat label="Characters"  value={hasGenerated ? stats.chars      : 0} color="#988d9f" />
        <Stat label="Words"       value={hasGenerated ? stats.words      : 0} color="#adc6ff" />
        <Stat label="Paragraphs"  value={hasGenerated ? stats.paragraphs : 0} color="#4ade80" />
      </div>
    </div>
  );
}
