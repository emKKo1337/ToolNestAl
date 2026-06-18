"use client";

import { useState, useCallback } from "react";

const SETS = {
  uppercase: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  lowercase: "abcdefghijklmnopqrstuvwxyz",
  numbers: "0123456789",
  symbols: "!@#$%^&*()_+-=[]{}|;:,.<>?",
};

function generatePassword(
  length: number,
  opts: { uppercase: boolean; lowercase: boolean; numbers: boolean; symbols: boolean }
): string {
  let charset = "";
  if (opts.uppercase) charset += SETS.uppercase;
  if (opts.lowercase) charset += SETS.lowercase;
  if (opts.numbers) charset += SETS.numbers;
  if (opts.symbols) charset += SETS.symbols;
  if (!charset) return "";
  const arr = new Uint32Array(length);
  crypto.getRandomValues(arr);
  return Array.from(arr, (v) => charset[v % charset.length]).join("");
}

function calcStrength(pw: string, opts: { uppercase: boolean; lowercase: boolean; numbers: boolean; symbols: boolean }) {
  if (!pw) return { pct: 0, label: "—", color: "#4d4354" };
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (pw.length >= 20) score++;
  if (opts.uppercase && opts.lowercase) score++;
  if (opts.numbers) score++;
  if (opts.symbols) score++;
  const pct = Math.round((score / 6) * 100);
  if (score <= 2) return { pct, label: "Weak", color: "#ef4444" };
  if (score <= 3) return { pct, label: "Fair", color: "#f59e0b" };
  if (score <= 4) return { pct, label: "Good", color: "#3b82f6" };
  if (score <= 5) return { pct, label: "Strong", color: "#4cd7f6" };
  return { pct: 100, label: "Very Strong", color: "#22c55e" };
}

export default function PasswordGeneratorTool() {
  const [length, setLength] = useState(16);
  const [opts, setOpts] = useState({ uppercase: true, lowercase: true, numbers: true, symbols: false });
  const [password, setPassword] = useState<string>(() =>
    generatePassword(16, { uppercase: true, lowercase: true, numbers: true, symbols: false })
  );
  const [history, setHistory] = useState<string[]>(() => {
    const initial = generatePassword(16, { uppercase: true, lowercase: true, numbers: true, symbols: false });
    return [initial];
  });
  const [copied, setCopied] = useState(false);
  const [count, setCount] = useState(1);
  const [bulk, setBulk] = useState<string[]>([]);
  const [bulkCopied, setBulkCopied] = useState(false);
  const [error, setError] = useState("");

  const activeCount = Object.values(opts).filter(Boolean).length;

  const generate = useCallback(() => {
    if (activeCount === 0) {
      setError("Select at least one character type.");
      return;
    }
    setError("");
    const pw = generatePassword(length, opts);
    setPassword(pw);
    setHistory((h) => [pw, ...h].slice(0, 5));
  }, [length, opts, activeCount]);

  const handleCopy = async (text: string, setter: (v: boolean) => void) => {
    try {
      await navigator.clipboard.writeText(text);
      setter(true);
      setTimeout(() => setter(false), 2000);
    } catch {
      setError("Clipboard access denied.");
    }
  };

  const generateBulk = () => {
    if (activeCount === 0) { setError("Select at least one character type."); return; }
    setError("");
    setBulk(Array.from({ length: count }, () => generatePassword(length, opts)));
  };

  const strength = calcStrength(password, opts);

  const toggle = (key: keyof typeof opts) =>
    setOpts((o) => ({ ...o, [key]: !o[key] }));

  const charOptions = [
    { key: "uppercase" as const, label: "A–Z", desc: "Uppercase" },
    { key: "lowercase" as const, label: "a–z", desc: "Lowercase" },
    { key: "numbers" as const, label: "0–9", desc: "Numbers" },
    { key: "symbols" as const, label: "!@#", desc: "Symbols" },
  ];

  return (
    <div className="mb-12 flex flex-col gap-6">
      {/* Main card */}
      <div className="glass-panel rounded-2xl p-6 md:p-8">

        {/* Password display */}
        <div className="relative mb-6">
          <div
            className="glass-panel rounded-xl px-5 py-4 flex items-center gap-4 min-h-[64px]"
            style={{ background: "rgba(0,0,0,0.3)" }}
          >
            <span
              className="flex-1 font-mono text-[18px] md:text-[22px] tracking-[0.08em] text-[#e2e2e2] break-all select-all leading-snug"
              aria-live="polite"
              aria-label="Generated password"
            >
              {password || <span className="text-[#4d4354]">Click Generate…</span>}
            </span>
            <button
              onClick={() => handleCopy(password, setCopied)}
              disabled={!password}
              aria-label="Copy password"
              className="flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-semibold transition-all duration-200 disabled:opacity-40"
              style={{
                background: copied ? "rgba(34,197,94,0.2)" : "rgba(221,183,255,0.15)",
                color: copied ? "#22c55e" : "#ddb7ff",
                border: `1px solid ${copied ? "rgba(34,197,94,0.3)" : "rgba(221,183,255,0.2)"}`,
              }}
            >
              <span className="material-symbols-outlined text-[16px]">{copied ? "check" : "content_copy"}</span>
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>

        {/* Strength bar */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <span className="text-[13px] text-[#988d9f] font-medium">Password Strength</span>
            <span className="text-[13px] font-bold" style={{ color: strength.color }}>{strength.label}</span>
          </div>
          <div className="h-2 rounded-full bg-[rgba(255,255,255,0.08)] overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500 ease-out"
              style={{ width: `${strength.pct}%`, backgroundColor: strength.color }}
            />
          </div>
        </div>

        {/* Length slider */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-3">
            <label className="text-[15px] font-semibold text-[#e2e2e2]">Length</label>
            <span className="px-3 py-1 rounded-lg text-[15px] font-bold text-[#ddb7ff] bg-[rgba(221,183,255,0.1)]">{length}</span>
          </div>
          <input
            type="range"
            min={4}
            max={128}
            value={length}
            onChange={(e) => setLength(Number(e.target.value))}
            className="w-full h-2 rounded-full appearance-none cursor-pointer"
            style={{ accentColor: "#ddb7ff" }}
            aria-label={`Password length: ${length}`}
          />
          <div className="flex justify-between text-[11px] text-[#4d4354] mt-1">
            <span>4</span><span>64</span><span>128</span>
          </div>
        </div>

        {/* Character type toggles */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {charOptions.map(({ key, label, desc }) => (
            <button
              key={key}
              onClick={() => toggle(key)}
              aria-pressed={opts[key]}
              className="flex flex-col items-center gap-1 py-3 px-2 rounded-xl border text-center transition-all duration-200"
              style={{
                background: opts[key] ? "rgba(221,183,255,0.12)" : "rgba(255,255,255,0.03)",
                borderColor: opts[key] ? "rgba(221,183,255,0.4)" : "rgba(255,255,255,0.08)",
                color: opts[key] ? "#ddb7ff" : "#988d9f",
              }}
            >
              <span className="text-[16px] font-bold font-mono">{label}</span>
              <span className="text-[11px]">{desc}</span>
            </button>
          ))}
        </div>

        {error && (
          <p className="text-[13px] text-[#ef4444] mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px]">error</span>
            {error}
          </p>
        )}

        {/* Generate button */}
        <button
          onClick={generate}
          className="btn-primary w-full text-white font-bold text-[16px] py-4 rounded-xl flex items-center justify-center gap-2"
        >
          <span className="material-symbols-outlined text-[20px]">refresh</span>
          Generate Password
        </button>
      </div>

      {/* Bulk generation */}
      <div className="glass-panel rounded-2xl p-6 md:p-8">
        <h3 className="text-[18px] font-bold text-[#e2e2e2] mb-4">Bulk Generation</h3>
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="flex items-center gap-3 flex-1">
            <label className="text-[14px] text-[#988d9f] whitespace-nowrap">Count:</label>
            <input
              type="number"
              min={1}
              max={100}
              value={count}
              onChange={(e) => setCount(Math.min(100, Math.max(1, Number(e.target.value))))}
              className="bg-[rgba(0,0,0,0.3)] border border-[rgba(255,255,255,0.1)] rounded-lg px-3 py-2 text-[#e2e2e2] text-[15px] w-24 focus:outline-none focus:border-[#ddb7ff]"
              aria-label="Number of passwords to generate"
            />
          </div>
          <button
            onClick={generateBulk}
            className="btn-primary text-white font-semibold text-[14px] px-6 py-2 rounded-xl flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-[16px]">list</span>
            Generate {count}
          </button>
          {bulk.length > 0 && (
            <button
              onClick={() => handleCopy(bulk.join("\n"), setBulkCopied)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-[14px] font-semibold transition-all"
              style={{
                background: bulkCopied ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.05)",
                color: bulkCopied ? "#22c55e" : "#cfc2d6",
                border: "1px solid rgba(255,255,255,0.1)",
              }}
            >
              <span className="material-symbols-outlined text-[16px]">{bulkCopied ? "check" : "content_copy"}</span>
              {bulkCopied ? "Copied!" : "Copy All"}
            </button>
          )}
        </div>
        {bulk.length > 0 && (
          <div className="rounded-xl overflow-hidden border border-[rgba(255,255,255,0.08)]" style={{ background: "rgba(0,0,0,0.3)" }}>
            <div className="max-h-[240px] overflow-y-auto">
              {bulk.map((pw, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between px-4 py-2 border-b border-[rgba(255,255,255,0.05)] last:border-0 hover:bg-white/5 transition-colors gap-3"
                >
                  <span className="font-mono text-[13px] text-[#cfc2d6] truncate">{pw}</span>
                  <button
                    onClick={() => handleCopy(pw, () => {})}
                    aria-label={`Copy password ${i + 1}`}
                    className="text-[#988d9f] hover:text-[#ddb7ff] transition-colors flex-shrink-0"
                  >
                    <span className="material-symbols-outlined text-[16px]">content_copy</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* History */}
      {history.length > 1 && (
        <div className="glass-panel rounded-2xl p-6">
          <h3 className="text-[16px] font-bold text-[#e2e2e2] mb-3">Recent Passwords</h3>
          <div className="flex flex-col gap-2">
            {history.slice(1).map((pw, i) => (
              <div key={i} className="flex items-center justify-between gap-3 py-2 border-b border-[rgba(255,255,255,0.05)] last:border-0">
                <span className="font-mono text-[13px] text-[#988d9f] truncate">{pw}</span>
                <button
                  onClick={() => handleCopy(pw, () => {})}
                  aria-label="Copy this password"
                  className="text-[#988d9f] hover:text-[#ddb7ff] transition-colors flex-shrink-0"
                >
                  <span className="material-symbols-outlined text-[16px]">content_copy</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
