"use client";

import { useState, useCallback, useMemo } from "react";
import { load as yamlLoad, dump as yamlDump } from "js-yaml";

// ── Constants ──────────────────────────────────────────────────────────────────
const ACCENT = "#adc6ff";

type ConvertMode = "json-to-yaml" | "yaml-to-json" | "auto";
type InputFormat = "json" | "yaml" | "unknown";

const SAMPLE_JSON = `{
  "name": "ToolNest AI",
  "version": "2.0.0",
  "features": [
    "JSON Formatter",
    "YAML Converter",
    "Developer Tools"
  ],
  "meta": {
    "author": "ToolNest",
    "license": "MIT",
    "active": true,
    "count": 42
  }
}`;

const SAMPLE_YAML = `name: ToolNest AI
version: 2.0.0
features:
  - JSON Formatter
  - YAML Converter
  - Developer Tools
meta:
  author: ToolNest
  license: MIT
  active: true
  count: 42
`;

// ── Helpers ────────────────────────────────────────────────────────────────────
function detectFormat(text: string): InputFormat {
  const trimmed = text.trim();
  if (!trimmed) return "unknown";
  try { JSON.parse(trimmed); return "json"; } catch { /* not JSON */ }
  try { yamlLoad(trimmed); return "yaml"; } catch { /* not YAML either */ }
  return "unknown";
}

interface ConvertResult {
  output: string;
  error: string;
  detectedInput: InputFormat;
  outputFormat: InputFormat;
}

function convert(input: string, mode: ConvertMode): ConvertResult {
  const trimmed = input.trim();
  if (!trimmed) return { output: "", error: "", detectedInput: "unknown", outputFormat: "unknown" };

  const detected = mode === "auto" ? detectFormat(trimmed) : (mode === "json-to-yaml" ? "json" : "yaml");

  if (detected === "unknown") {
    return { output: "", error: "Unable to parse input — check for syntax errors.", detectedInput: "unknown", outputFormat: "unknown" };
  }

  try {
    if (detected === "json") {
      const parsed = JSON.parse(trimmed);
      const yaml = yamlDump(parsed, { indent: 2, lineWidth: -1 });
      return { output: yaml, error: "", detectedInput: "json", outputFormat: "yaml" };
    } else {
      const parsed = yamlLoad(trimmed);
      const json = JSON.stringify(parsed, null, 2);
      return { output: json, error: "", detectedInput: "yaml", outputFormat: "json" };
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Conversion failed.";
    return { output: "", error: msg, detectedInput: detected, outputFormat: "unknown" };
  }
}

function minifyJson(text: string): string {
  try { return JSON.stringify(JSON.parse(text)); }
  catch { return text; }
}

function download(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  Object.assign(document.createElement("a"), { href: url, download: filename }).click();
  URL.revokeObjectURL(url);
}

// ── Sub-components ─────────────────────────────────────────────────────────────
function FormatBadge({ format }: { format: InputFormat }) {
  if (format === "unknown") return null;
  const isJson = format === "json";
  return (
    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider"
      style={{
        background: isJson ? "rgba(173,198,255,0.12)" : "rgba(128,224,160,0.12)",
        color: isJson ? ACCENT : "#80e0a0",
        border: `1px solid ${isJson ? "rgba(173,198,255,0.25)" : "rgba(128,224,160,0.25)"}`,
      }}>
      {format}
    </span>
  );
}

function StatusBar({ error, inputEmpty, outputFormat }: {
  error: string; inputEmpty: boolean; outputFormat: InputFormat;
}) {
  if (inputEmpty) return null;
  if (error) {
    return (
      <div className="flex items-start gap-2 px-3 py-2 rounded-xl text-[12px]"
        style={{ background: "rgba(255,100,100,0.08)", border: "1px solid rgba(255,100,100,0.2)", color: "#ff8080" }}>
        <span className="material-symbols-outlined text-[14px] mt-0.5 shrink-0">error</span>
        <span className="break-all leading-relaxed">{error}</span>
      </div>
    );
  }
  if (outputFormat !== "unknown") {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-[12px]"
        style={{ background: "rgba(128,224,160,0.08)", border: "1px solid rgba(128,224,160,0.2)", color: "#80e0a0" }}>
        <span className="material-symbols-outlined text-[14px]">check_circle</span>
        Converted to {outputFormat.toUpperCase()} successfully
      </div>
    );
  }
  return null;
}

// ── Main ───────────────────────────────────────────────────────────────────────
export default function JsonYamlConverterTool() {
  const [input,    setInput]    = useState("");
  const [mode,     setMode]     = useState<ConvertMode>("auto");
  const [copied,   setCopied]   = useState(false);
  const [minified, setMinified] = useState(false);

  const result = useMemo(() => convert(input, mode), [input, mode]);

  const displayOutput = useMemo(() => {
    if (!result.output) return "";
    if (minified && result.outputFormat === "json") return minifyJson(result.output);
    return result.output;
  }, [result.output, result.outputFormat, minified]);

  const inputEmpty  = !input.trim();
  const outputEmpty = !displayOutput.trim();

  const inputFormatLabel: InputFormat = useMemo(() => {
    if (mode === "json-to-yaml") return inputEmpty ? "unknown" : "json";
    if (mode === "yaml-to-json") return inputEmpty ? "unknown" : "yaml";
    return inputEmpty ? "unknown" : result.detectedInput;
  }, [mode, inputEmpty, result.detectedInput]);

  const doCopy = useCallback(async () => {
    if (outputEmpty) return;
    try { await navigator.clipboard.writeText(displayOutput); } catch { /* blocked */ }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [displayOutput, outputEmpty]);

  const doDownloadJson = useCallback(() => {
    const src = result.outputFormat === "json" ? displayOutput : input;
    if (!src.trim()) return;
    try {
      const obj = JSON.parse(src.trim());
      download(JSON.stringify(obj, null, 2), "output.json", "application/json");
    } catch {
      download(src, "output.json", "application/json");
    }
  }, [result.outputFormat, displayOutput, input]);

  const doDownloadYaml = useCallback(() => {
    const src = result.outputFormat === "yaml" ? displayOutput : input;
    if (!src.trim()) return;
    download(src, "output.yaml", "text/yaml");
  }, [result.outputFormat, displayOutput, input]);

  const doSwap = useCallback(() => {
    if (outputEmpty) return;
    setInput(displayOutput);
    setMinified(false);
    if (mode === "json-to-yaml") setMode("yaml-to-json");
    else if (mode === "yaml-to-json") setMode("json-to-yaml");
  }, [outputEmpty, displayOutput, mode]);

  const doReset = useCallback(() => {
    setInput("");
    setMinified(false);
    setCopied(false);
  }, []);

  const loadSample = useCallback((fmt: "json" | "yaml") => {
    setInput(fmt === "json" ? SAMPLE_JSON : SAMPLE_YAML);
    setMinified(false);
    setMode(fmt === "json" ? "json-to-yaml" : "yaml-to-json");
  }, []);

  const AREA_STYLE: React.CSSProperties = {
    fontFamily: "'JetBrains Mono','Fira Code','Cascadia Code',Consolas,monospace",
    fontSize: "13px",
    lineHeight: "1.6",
    resize: "none",
    outline: "none",
    background: "transparent",
    color: "#e8dff0",
    width: "100%",
    minHeight: "360px",
    padding: "14px 16px",
  };

  const modeOptions: { value: ConvertMode; label: string; icon: string }[] = [
    { value: "auto",         label: "Auto Detect", icon: "auto_awesome"    },
    { value: "json-to-yaml", label: "JSON → YAML", icon: "arrow_forward"   },
    { value: "yaml-to-json", label: "YAML → JSON", icon: "arrow_back"      },
  ];

  const inputLines  = input  ? input.split("\n").length  : 0;
  const outputLines = displayOutput ? displayOutput.split("\n").length : 0;

  return (
    <div className="mb-12 flex flex-col gap-4">

      {/* ── Mode selector + actions ─────────────────────────────── */}
      <div className="glass-panel rounded-2xl p-3 flex flex-wrap items-center gap-2"
        style={{ border: "1px solid rgba(255,255,255,0.06)" }}>

        {/* Mode tabs */}
        {modeOptions.map(({ value, label, icon }) => (
          <button key={value} onClick={() => setMode(value)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[13px] font-semibold transition-all"
            style={mode === value
              ? { background: "rgba(173,198,255,0.15)", color: ACCENT, border: "1px solid rgba(173,198,255,0.3)" }
              : { background: "rgba(255,255,255,0.04)", color: "#988d9f", border: "1px solid rgba(255,255,255,0.07)" }
            }>
            <span className="material-symbols-outlined text-[14px]">{icon}</span>
            {label}
          </button>
        ))}

        <div className="w-px h-6 mx-1" style={{ background: "rgba(255,255,255,0.08)" }} />

        {/* Swap */}
        <button onClick={doSwap} disabled={outputEmpty}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[13px] font-semibold transition-all disabled:opacity-40"
          style={{ background: "rgba(255,255,255,0.04)", color: "#988d9f", border: "1px solid rgba(255,255,255,0.07)" }}
          title="Swap input and output">
          <span className="material-symbols-outlined text-[14px]">swap_horiz</span>
          Swap
        </button>

        {/* Minify toggle (only relevant when output is JSON) */}
        {result.outputFormat === "json" && !outputEmpty && (
          <button onClick={() => setMinified(v => !v)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[13px] font-semibold transition-all"
            style={minified
              ? { background: "rgba(76,215,246,0.12)", color: "#4cd7f6", border: "1px solid rgba(76,215,246,0.25)" }
              : { background: "rgba(255,255,255,0.04)", color: "#988d9f", border: "1px solid rgba(255,255,255,0.07)" }
            }>
            <span className="material-symbols-outlined text-[14px]">compress</span>
            {minified ? "Minified" : "Minify"}
          </button>
        )}

        <div className="flex-1" />

        {/* Copy output */}
        <button onClick={doCopy} disabled={outputEmpty}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[13px] font-semibold transition-all disabled:opacity-40"
          style={{ background: "rgba(255,255,255,0.04)", color: copied ? "#80e0a0" : "#988d9f", border: "1px solid rgba(255,255,255,0.07)" }}>
          <span className="material-symbols-outlined text-[14px]">{copied ? "check" : "content_copy"}</span>
          {copied ? "Copied!" : "Copy"}
        </button>

        {/* Download JSON */}
        <button onClick={doDownloadJson} disabled={inputEmpty}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[13px] font-semibold transition-all disabled:opacity-40"
          style={{ background: "rgba(255,255,255,0.04)", color: "#988d9f", border: "1px solid rgba(255,255,255,0.07)" }}>
          <span className="material-symbols-outlined text-[14px]">download</span>
          .json
        </button>

        {/* Download YAML */}
        <button onClick={doDownloadYaml} disabled={inputEmpty}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[13px] font-semibold transition-all disabled:opacity-40"
          style={{ background: "rgba(255,255,255,0.04)", color: "#988d9f", border: "1px solid rgba(255,255,255,0.07)" }}>
          <span className="material-symbols-outlined text-[14px]">download</span>
          .yaml
        </button>

        <div className="w-px h-6 mx-1" style={{ background: "rgba(255,255,255,0.08)" }} />

        {/* Reset */}
        <button onClick={doReset}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[13px] font-semibold transition-all"
          style={{ background: "rgba(255,100,100,0.07)", color: "#ff8080", border: "1px solid rgba(255,100,100,0.15)" }}>
          <span className="material-symbols-outlined text-[14px]">restart_alt</span>
          Reset
        </button>
      </div>

      {/* ── Editor panels ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Input */}
        <div className="glass-panel rounded-2xl overflow-hidden flex flex-col"
          style={{ border: "1px solid rgba(255,255,255,0.06)", minHeight: 420 }}>
          <div className="flex items-center justify-between px-4 py-2.5"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.05)", background: "rgba(255,255,255,0.02)" }}>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[14px]" style={{ color: "#988d9f" }}>edit_note</span>
              <span className="text-[12px] font-semibold" style={{ color: "#988d9f" }}>Input</span>
              <FormatBadge format={inputFormatLabel} />
            </div>
            {inputLines > 0 && (
              <span className="text-[10px]" style={{ color: "#4d4354" }}>{inputLines} lines</span>
            )}
          </div>
          <div className="relative flex-1">
            {inputEmpty && (
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none gap-2"
                style={{ color: "#4d4354" }}>
                <span className="material-symbols-outlined text-[36px]">data_object</span>
                <span className="text-[13px]">Paste JSON or YAML here</span>
                <div className="flex gap-2 pointer-events-auto mt-1">
                  {(["json", "yaml"] as const).map(fmt => (
                    <button key={fmt} onClick={() => loadSample(fmt)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all"
                      style={{ background: "rgba(173,198,255,0.08)", color: ACCENT, border: "1px solid rgba(173,198,255,0.2)" }}>
                      <span className="material-symbols-outlined text-[12px]">auto_awesome</span>
                      Sample {fmt.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder=""
              spellCheck={false}
              aria-label="Input — paste JSON or YAML here"
              style={{ ...AREA_STYLE, caretColor: ACCENT }}
            />
          </div>
        </div>

        {/* Output */}
        <div className="glass-panel rounded-2xl overflow-hidden flex flex-col"
          style={{
            border: `1px solid ${result.error && !inputEmpty ? "rgba(255,100,100,0.25)" : "rgba(255,255,255,0.06)"}`,
            minHeight: 420,
          }}>
          <div className="flex items-center justify-between px-4 py-2.5"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.05)", background: "rgba(255,255,255,0.02)" }}>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[14px]" style={{ color: "#988d9f" }}>output</span>
              <span className="text-[12px] font-semibold" style={{ color: "#988d9f" }}>Output</span>
              <FormatBadge format={result.outputFormat} />
            </div>
            {outputLines > 0 && (
              <span className="text-[10px]" style={{ color: "#4d4354" }}>{outputLines} lines</span>
            )}
          </div>
          <div className="relative flex-1">
            {outputEmpty && (
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none"
                style={{ color: result.error && !inputEmpty ? "#ff8080" : "#4d4354" }}>
                {result.error && !inputEmpty ? (
                  <>
                    <span className="material-symbols-outlined text-[36px]">error</span>
                    <span className="text-[12px] mt-1">Fix the error to see output</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[36px]">compare_arrows</span>
                    <span className="text-[13px] mt-1">Converted output appears here</span>
                  </>
                )}
              </div>
            )}
            <textarea
              readOnly
              value={displayOutput}
              spellCheck={false}
              aria-label="Converted output"
              style={{ ...AREA_STYLE, color: "#c8e0b0", cursor: "text" }}
            />
          </div>
        </div>
      </div>

      {/* ── Status bar ─────────────────────────────────────────── */}
      <StatusBar error={result.error} inputEmpty={inputEmpty} outputFormat={result.outputFormat} />

      {/* ── Stats ──────────────────────────────────────────────── */}
      {!inputEmpty && !result.error && (
        <div className="flex flex-wrap gap-3">
          {[
            { label: "Input size",  value: `${(new Blob([input]).size / 1024).toFixed(1)} KB` },
            { label: "Output size", value: `${(new Blob([displayOutput]).size / 1024).toFixed(1)} KB` },
            { label: "Input lines",  value: inputLines.toLocaleString()  },
            { label: "Output lines", value: outputLines.toLocaleString() },
          ].map(({ label, value }) => (
            <div key={label} className="glass-panel rounded-xl px-4 py-2 flex flex-col gap-0.5"
              style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
              <span className="text-base font-bold tabular-nums" style={{ color: ACCENT }}>{value}</span>
              <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "#988d9f" }}>{label}</span>
            </div>
          ))}
        </div>
      )}

    </div>
  );
}
