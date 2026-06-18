"use client";

import { useState, useCallback, useId } from "react";

type Flag = "g" | "i" | "m" | "s";

interface MatchResult {
  match:   string;
  index:   number;
  groups:  (string | undefined)[];
  namedGroups: Record<string, string | undefined> | null;
}

function runRegex(pattern: string, flags: Set<Flag>, testStr: string): { matches: MatchResult[]; error: string | null } {
  if (!pattern) return { matches: [], error: null };
  let re: RegExp;
  const flagStr = Array.from(flags).join("") + (flags.has("g") ? "" : "g");
  try {
    re = new RegExp(pattern, flagStr);
  } catch (e) {
    return { matches: [], error: (e as Error).message };
  }
  const matches: MatchResult[] = [];
  let m: RegExpExecArray | null;
  let safetyCount = 0;
  while ((m = re.exec(testStr)) !== null && safetyCount++ < 1000) {
    matches.push({
      match:  m[0],
      index:  m.index,
      groups: m.slice(1),
      namedGroups: m.groups ? { ...m.groups } : null,
    });
    if (m[0].length === 0) re.lastIndex++;
  }
  return { matches, error: null };
}

function buildHighlightedSegments(text: string, matches: MatchResult[]): { text: string; highlight: boolean }[] {
  if (!matches.length) return [{ text, highlight: false }];
  const segs: { text: string; highlight: boolean }[] = [];
  let cursor = 0;
  for (const m of matches) {
    if (m.index > cursor) segs.push({ text: text.slice(cursor, m.index), highlight: false });
    segs.push({ text: text.slice(m.index, m.index + m.match.length), highlight: true });
    cursor = m.index + m.match.length;
    if (m.match.length === 0) { cursor++; if (cursor > text.length) break; }
  }
  if (cursor < text.length) segs.push({ text: text.slice(cursor), highlight: false });
  return segs;
}

const FLAG_DESCRIPTIONS: Record<Flag, string> = {
  g: "Global — find all matches",
  i: "Case insensitive",
  m: "Multiline — ^ and $ match line boundaries",
  s: "Dot-all — . matches newlines",
};

export default function RegexTesterTool() {
  const uid = useId();
  const [pattern,  setPattern]  = useState("");
  const [flags,    setFlags]    = useState<Set<Flag>>(new Set<Flag>(["g"]));
  const [testStr,  setTestStr]  = useState("");
  const [result,   setResult]   = useState<{ matches: MatchResult[]; error: string | null }>({ matches: [], error: null });

  const recompute = useCallback((p: string, f: Set<Flag>, s: string) => {
    setResult(runRegex(p, f, s));
  }, []);

  const handlePattern = useCallback((v: string) => {
    setPattern(v);
    recompute(v, flags, testStr);
  }, [flags, testStr, recompute]);

  const handleTestStr = useCallback((v: string) => {
    setTestStr(v);
    recompute(pattern, flags, v);
  }, [pattern, flags, recompute]);

  const toggleFlag = useCallback((f: Flag) => {
    setFlags(prev => {
      const next = new Set(prev);
      if (next.has(f)) { next.delete(f); } else { next.add(f); }
      recompute(pattern, next, testStr);
      return next;
    });
  }, [pattern, testStr, recompute]);

  const handleClear = useCallback(() => {
    setPattern(""); setTestStr(""); setFlags(new Set<Flag>(["g"])); setResult({ matches: [], error: null });
  }, []);

  const segments = result.error || !testStr ? null : buildHighlightedSegments(testStr, result.matches);
  const isEmpty  = !pattern && !testStr;

  return (
    <div className="mb-12 flex flex-col gap-4">
      {/* Toolbar */}
      <div className="glass-panel rounded-2xl p-3 flex flex-wrap items-center gap-2"
        style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
        <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "#4d4354" }}>Flags</span>
        {(["g", "i", "m", "s"] as Flag[]).map(f => (
          <button
            key={f}
            onClick={() => toggleFlag(f)}
            title={FLAG_DESCRIPTIONS[f]}
            className="px-3 py-1.5 rounded-xl text-[13px] font-bold font-mono transition-all"
            style={{
              background: flags.has(f) ? "rgba(221,183,255,0.15)" : "rgba(255,255,255,0.04)",
              color: flags.has(f) ? "#ddb7ff" : "#988d9f",
              border: `1px solid ${flags.has(f) ? "rgba(221,183,255,0.3)" : "rgba(255,255,255,0.07)"}`,
            }}
          >{f}</button>
        ))}
        <div className="flex-1" />
        <button onClick={handleClear}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[13px] font-semibold transition-all"
          style={{ background: "rgba(255,100,100,0.08)", color: "#ff8080", border: "1px solid rgba(255,100,100,0.15)" }}>
          <span className="material-symbols-outlined text-[15px]">delete_sweep</span>Clear
        </button>
      </div>

      {/* Regex input */}
      <div className="glass-panel rounded-2xl overflow-hidden"
        style={{ border: `1px solid ${result.error ? "rgba(255,100,100,0.4)" : result.matches.length > 0 ? "rgba(100,220,150,0.25)" : "rgba(255,255,255,0.07)"}` }}>
        <div className="flex items-center px-4 py-2 border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
          <span className="text-[12px] font-bold uppercase tracking-wider" style={{ color: "#988d9f" }}>Regular Expression</span>
        </div>
        <div className="flex items-center px-4 py-3 gap-2">
          <span className="text-[18px] font-mono font-bold shrink-0" style={{ color: "#4d4354" }}>/</span>
          <input
            id={`${uid}-pattern`}
            type="text"
            value={pattern}
            onChange={e => handlePattern(e.target.value)}
            placeholder="Enter regex pattern…"
            spellCheck={false}
            className="flex-1 bg-transparent text-[15px] font-mono outline-none"
            style={{ color: result.error ? "#ff8080" : "#e8dff0" }}
          />
          <span className="text-[18px] font-mono font-bold shrink-0" style={{ color: "#4d4354" }}>
            /{Array.from(flags).join("")}
          </span>
        </div>
        {result.error && (
          <div className="px-4 py-2 border-t flex items-center gap-2 text-[12px] font-semibold"
            style={{ borderColor: "rgba(255,100,100,0.2)", background: "rgba(255,100,100,0.07)", color: "#ff8080" }}>
            <span className="material-symbols-outlined text-[14px]">error</span>{result.error}
          </div>
        )}
      </div>

      {/* Test string */}
      <div className="glass-panel rounded-2xl overflow-hidden"
        style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
        <div className="flex items-center px-4 py-2 border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
          <span className="text-[12px] font-bold uppercase tracking-wider" style={{ color: "#988d9f" }}>Test String</span>
          <div className="ml-auto text-[11px] font-semibold" style={{ color: "#4d4354" }}>
            {testStr.length.toLocaleString()} chars
          </div>
        </div>
        <textarea
          id={`${uid}-test`}
          value={testStr}
          onChange={e => handleTestStr(e.target.value)}
          placeholder="Enter the string to test against…"
          spellCheck={false}
          className="w-full resize-none bg-transparent text-sm leading-relaxed outline-none p-4"
          style={{ fontFamily: "'JetBrains Mono',Consolas,monospace", color: "#e8dff0", minHeight: "160px" }}
        />
      </div>

      {/* Match stats */}
      {pattern && testStr && !result.error && (
        <div className="flex flex-wrap gap-3">
          {[
            { label: "Matches",        value: result.matches.length.toLocaleString(), accent: result.matches.length > 0 ? "#80e0a0" : "#ff8080" },
            { label: "Capture groups", value: result.matches[0] ? String(result.matches[0].groups.length) : "0", accent: "#ddb7ff" },
            { label: "Pattern length", value: String(pattern.length), accent: "#4cd7f6" },
          ].map(({ label, value, accent }) => (
            <div key={label} className="glass-panel rounded-xl px-4 py-2 flex flex-col gap-0.5"
              style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
              <span className="text-base font-bold tabular-nums" style={{ color: accent }}>{value}</span>
              <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "#988d9f" }}>{label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Highlighted preview */}
      {segments && result.matches.length > 0 && (
        <div className="glass-panel rounded-2xl p-4 flex flex-col gap-2"
          style={{ border: "1px solid rgba(100,220,150,0.2)" }}>
          <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "#4d4354" }}>
            Match Preview
          </span>
          <div className="text-[13px] font-mono leading-loose whitespace-pre-wrap break-all"
            style={{ color: "#e8dff0" }}>
            {segments.map((seg, i) =>
              seg.highlight ? (
                <mark key={i} style={{ background: "rgba(128,224,160,0.25)", color: "#80e0a0", borderRadius: "3px", padding: "1px 0" }}>
                  {seg.text}
                </mark>
              ) : (
                <span key={i}>{seg.text}</span>
              )
            )}
          </div>
        </div>
      )}

      {/* Match list */}
      {result.matches.length > 0 && (
        <div className="glass-panel rounded-2xl overflow-hidden"
          style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="flex items-center px-4 py-2.5 border-b"
            style={{ borderColor: "rgba(255,255,255,0.06)", background: "rgba(0,0,0,0.2)" }}>
            <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "#4d4354" }}>
              {result.matches.length} Match{result.matches.length !== 1 ? "es" : ""}
            </span>
          </div>
          <div className="overflow-y-auto" style={{ maxHeight: "320px" }}>
            {result.matches.slice(0, 200).map((m, i) => (
              <div key={i} className="px-4 py-3 flex flex-col gap-1 transition-colors"
                style={{ borderBottom: i < result.matches.length - 1 ? "1px solid rgba(255,255,255,0.04)" : undefined }}>
                <div className="flex items-center gap-3">
                  <span className="text-[11px] tabular-nums shrink-0" style={{ color: "#4d4354" }}>#{i + 1}</span>
                  <code className="text-[13px] font-mono flex-1" style={{ color: "#80e0a0" }}>&quot;{m.match}&quot;</code>
                  <span className="text-[11px]" style={{ color: "#4d4354" }}>index {m.index}</span>
                </div>
                {m.groups.some(g => g !== undefined) && (
                  <div className="flex flex-wrap gap-2 pl-8">
                    {m.groups.map((g, gi) => (
                      <span key={gi} className="text-[11px] font-mono px-2 py-0.5 rounded"
                        style={{ background: "rgba(221,183,255,0.1)", color: "#ddb7ff" }}>
                        ${gi + 1}: {g !== undefined ? `"${g}"` : "undefined"}
                      </span>
                    ))}
                    {m.namedGroups && Object.entries(m.namedGroups).map(([k, v]) => (
                      <span key={k} className="text-[11px] font-mono px-2 py-0.5 rounded"
                        style={{ background: "rgba(76,215,246,0.1)", color: "#4cd7f6" }}>
                        {k}: {v !== undefined ? `"${v}"` : "undefined"}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {result.matches.length > 200 && (
              <div className="px-4 py-3 text-[12px] text-center" style={{ color: "#4d4354" }}>
                … and {result.matches.length - 200} more matches
              </div>
            )}
          </div>
        </div>
      )}

      {isEmpty && (
        <button
          onClick={() => {
            handlePattern("\\b\\w{4}\\b");
            handleTestStr("The quick brown fox jumps over the lazy dogs near the deep blue lake");
          }}
          className="text-sm font-semibold flex items-center justify-center gap-1.5 hover:opacity-80 transition-opacity"
          style={{ color: "#988d9f" }}>
          <span className="material-symbols-outlined text-[16px]">auto_awesome</span>Load sample
        </button>
      )}
    </div>
  );
}
