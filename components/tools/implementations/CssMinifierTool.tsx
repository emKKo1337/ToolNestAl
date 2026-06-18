"use client";

import { useState, useRef, useCallback, useEffect, useId } from "react";

// ─── Types ─────────────────────────────────────────────────────────────────────
type NotifType = "success" | "error" | "info";
type TabSide   = "input" | "output";
type Mode      = "minify" | "beautify";

interface MinifyOptions {
  removeComments:   boolean;
  optimizeColors:   boolean;
  optimizeZeros:    boolean;
}

interface Stats {
  originalSize: number;
  outputSize:   number;
  savedBytes:   number;
  reduction:    number;
}

// ─── Pure-JS CSS processor ─────────────────────────────────────────────────────

function stripComments(css: string): string {
  // Remove /* ... */ block comments, preserving strings
  return css.replace(/("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|(\/\*[\s\S]*?\*\/)/g, (_, str) => str || "");
}

function optimizeHexColors(css: string): string {
  // #rrggbb → #rgb where r1===r2, g1===g2, b1===b2
  return css.replace(/#([0-9a-fA-F])\1([0-9a-fA-F])\2([0-9a-fA-F])\3\b/g, "#$1$2$3");
}

function optimizeZeroValues(css: string): string {
  // 0px / 0em / 0rem / 0% etc → 0
  return css
    .replace(/\b0(px|em|rem|%|vw|vh|vmin|vmax|ch|ex|cm|mm|in|pt|pc)\b/g, "0")
    // 0.5 → .5
    .replace(/\b0(\.\d)/g, "$1");
}

function minifyCss(css: string, opts: MinifyOptions): string {
  let result = opts.removeComments ? stripComments(css) : css;

  // Remove whitespace around special characters
  result = result
    .replace(/\s*([{}:;,>~+])\s*/g, "$1")
    // Remove trailing semicolons before }
    .replace(/;}/g, "}")
    // Collapse multiple spaces/newlines to single space
    .replace(/\s+/g, " ")
    .trim();

  if (opts.optimizeColors)  result = optimizeHexColors(result);
  if (opts.optimizeZeros)   result = optimizeZeroValues(result);

  return result;
}

function beautifyCss(css: string): string {
  // Strip comments first for clean output, then re-format
  let result = css;

  // Normalise whitespace
  result = result.replace(/\s+/g, " ").trim();

  // Add newlines + indentation
  result = result
    // { on same line, newline after
    .replace(/\s*\{\s*/g, " {\n  ")
    // ; → ;\n  (inside rule)
    .replace(/;\s*/g, ";\n  ")
    // clean up trailing spaces before }
    .replace(/\s*}\s*/g, "\n}\n")
    // remove trailing spaces on each line
    .split("\n")
    .map(l => l.trimEnd())
    .join("\n")
    // collapse runs of blank lines to one
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return result;
}

function validateCss(css: string): string | null {
  // Basic structural check: balanced braces
  let depth = 0;
  let inString: string | null = null;
  let inComment = false;

  for (let i = 0; i < css.length; i++) {
    const ch = css[i];
    const next = css[i + 1];

    if (inComment) {
      if (ch === "*" && next === "/") { inComment = false; i++; }
      continue;
    }
    if (inString) {
      if (ch === "\\" ) { i++; continue; }
      if (ch === inString) inString = null;
      continue;
    }
    if (ch === "/" && next === "*") { inComment = true; i++; continue; }
    if (ch === '"' || ch === "'") { inString = ch; continue; }
    if (ch === "{") depth++;
    if (ch === "}") {
      depth--;
      if (depth < 0) return "Unexpected closing brace — check your CSS for mismatched { }";
    }
  }

  if (inComment) return "Unclosed comment — missing closing */";
  if (depth > 0) return `Unclosed rule block — ${depth} opening brace${depth > 1 ? "s" : ""} without matching }`;
  return null;
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

function downloadFile(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/css;charset=utf-8" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ─── CodeMirror hook (CSS flavour) ────────────────────────────────────────────
function useCssEditor(
  containerRef: React.RefObject<HTMLDivElement | null>,
  initialValue: string,
  onChange: (val: string) => void,
  readOnly = false,
) {
  const viewRef = useRef<{ view: import("@codemirror/view").EditorView } | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function mount() {
      const {
        EditorView, keymap, drawSelection, highlightActiveLine,
        lineNumbers, highlightActiveLineGutter,
      } = await import("@codemirror/view");
      const { EditorState }                               = await import("@codemirror/state");
      const { defaultKeymap, historyKeymap, history }     = await import("@codemirror/commands");
      const { css }                                       = await import("@codemirror/lang-css");
      const { syntaxHighlighting, defaultHighlightStyle } = await import("@codemirror/language");

      if (cancelled || !containerRef.current) return;

      const theme = EditorView.theme({
        "&": {
          backgroundColor: "transparent",
          color: "#e8dff0",
          height: "100%",
          fontSize: "13px",
          fontFamily: "'JetBrains Mono','Fira Code','Cascadia Code',Consolas,monospace",
        },
        ".cm-scroller":  { overflow: "auto", height: "100%" },
        ".cm-content":   { padding: "12px 0", caretColor: "#ddb7ff", minHeight: "320px" },
        ".cm-line":      { padding: "0 16px" },
        ".cm-cursor":    { borderLeftColor: "#ddb7ff" },
        ".cm-activeLine":       { backgroundColor: "rgba(221,183,255,0.05)" },
        ".cm-activeLineGutter": { backgroundColor: "rgba(221,183,255,0.08)" },
        ".cm-gutters":  { backgroundColor: "rgba(0,0,0,0.2)", borderRight: "1px solid rgba(255,255,255,0.06)", color: "#4d4354" },
        ".cm-lineNumbers .cm-gutterElement": { padding: "0 8px" },
        ".cm-selectionBackground, ::selection": { backgroundColor: "rgba(221,183,255,0.2) !important" },
        "&.cm-focused .cm-selectionBackground": { backgroundColor: "rgba(221,183,255,0.2)" },
      }, { dark: true });

      const extensions = [
        lineNumbers(),
        highlightActiveLineGutter(),
        highlightActiveLine(),
        drawSelection(),
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        css(),
        theme,
        EditorView.lineWrapping,
        ...(readOnly
          ? [EditorState.readOnly.of(true)]
          : [
              history(),
              keymap.of([...defaultKeymap, ...historyKeymap]),
              EditorView.updateListener.of((u) => {
                if (u.docChanged) onChange(u.state.doc.toString());
              }),
            ]),
      ];

      const state = EditorState.create({ doc: initialValue, extensions });
      const view  = new EditorView({ state, parent: containerRef.current });
      viewRef.current = { view };
    }

    mount();
    return () => {
      cancelled = true;
      viewRef.current?.view.destroy();
      viewRef.current = null;
    };
  }, [readOnly]); // eslint-disable-line react-hooks/exhaustive-deps

  const setValue = useCallback((text: string) => {
    const v = viewRef.current?.view;
    if (!v || v.state.doc.toString() === text) return;
    v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: text } });
  }, []);

  return { setValue };
}

// ─── Toggle option row ─────────────────────────────────────────────────────────
function OptionToggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none">
      <span
        onClick={() => onChange(!checked)}
        className="relative w-8 h-4 rounded-full transition-colors shrink-0"
        style={{ background: checked ? "rgba(221,183,255,0.5)" : "rgba(255,255,255,0.1)", cursor: "pointer" }}
        role="switch"
        aria-checked={checked}
        tabIndex={0}
        onKeyDown={e => { if (e.key === " " || e.key === "Enter") onChange(!checked); }}
      >
        <span
          className="absolute top-0.5 left-0.5 w-3 h-3 rounded-full transition-transform"
          style={{ background: checked ? "#ddb7ff" : "#4d4354", transform: checked ? "translateX(16px)" : "translateX(0)" }}
        />
      </span>
      <span className="text-[13px] font-medium" style={{ color: "#988d9f" }}>{label}</span>
    </label>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────
export default function CssMinifierTool() {
  const uid = useId();

  const [input,   setInput]   = useState("");
  const [output,  setOutput]  = useState("");
  const [stats,   setStats]   = useState<Stats | null>(null);
  const [error,   setError]   = useState<string | null>(null);
  const [tab,     setTab]     = useState<TabSide>("input");
  const [mode,    setMode]    = useState<Mode>("minify");
  const [notif,   setNotif]   = useState<{ type: NotifType; message: string } | null>(null);
  const [copied,  setCopied]  = useState(false);

  const [opts, setOpts] = useState<MinifyOptions>({
    removeComments: true,
    optimizeColors: true,
    optimizeZeros:  true,
  });

  const inputContainerRef  = useRef<HTMLDivElement>(null);
  const outputContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef       = useRef<HTMLInputElement>(null);
  const uploadId           = `${uid}-upload`;

  const notify = useCallback((type: NotifType, msg: string) => {
    setNotif({ type, message: msg });
    if (type !== "info") setTimeout(() => setNotif(null), 5000);
  }, []);

  const handleInputChange = useCallback((text: string) => {
    setInput(text);
    setOutput("");
    setStats(null);
    setError(null);
  }, []);

  const { setValue: setInputValue  } = useCssEditor(inputContainerRef,  input, handleInputChange, false);
  const { setValue: setOutputValue } = useCssEditor(outputContainerRef, "",    () => {},           true);

  // Sync output editor when output state changes
  useEffect(() => {
    async function sync() { setOutputValue(output); }
    sync();
  }, [output, setOutputValue]);

  // ── Process ───────────────────────────────────────────────────────────────
  const doProcess = useCallback((targetMode: Mode) => {
    if (!input.trim()) { notify("error", "Paste some CSS first."); return; }

    async function run() {
      try {
        const validationErr = validateCss(input);
        if (validationErr) {
          setError(validationErr);
          notify("error", "CSS has errors — see details below.");
          return;
        }

        const result = targetMode === "minify"
          ? minifyCss(input, opts)
          : beautifyCss(input);

        const origSize = new Blob([input]).size;
        const outSize  = new Blob([result]).size;
        const saved    = origSize - outSize;

        setOutput(result);
        setStats({
          originalSize: origSize,
          outputSize:   outSize,
          savedBytes:   saved,
          reduction:    origSize > 0 ? (saved / origSize) * 100 : 0,
        });
        setTab("output");
        setError(null);
        notify("success", targetMode === "minify" ? "CSS minified successfully." : "CSS beautified successfully.");
      } catch (e) {
        setError(`Processing failed: ${(e as Error).message}`);
        notify("error", "Processing failed. Check the error message below.");
      }
    }
    run();
  }, [input, opts, notify]);

  const doMinify   = useCallback(() => { setMode("minify");   doProcess("minify"); },   [doProcess]);
  const doBeautify = useCallback(() => { setMode("beautify"); doProcess("beautify"); }, [doProcess]);

  // ── Copy ──────────────────────────────────────────────────────────────────
  const doCopy = useCallback(async () => {
    if (!output) { notify("error", "Process CSS first."); return; }
    await navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [output, notify]);

  // ── Download ──────────────────────────────────────────────────────────────
  const doDownload = useCallback(() => {
    if (!output) { notify("error", "Process CSS first."); return; }
    const filename = mode === "minify" ? "minified.css" : "beautified.css";
    downloadFile(output, filename);
    notify("success", `Downloaded ${filename}.`);
  }, [output, mode, notify]);

  // ── Upload ────────────────────────────────────────────────────────────────
  const doUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { notify("error", "File too large. Max 10 MB."); return; }
    const reader = new FileReader();
    reader.onload = ev => {
      const text = ev.target?.result as string;
      setInputValue(text);
      handleInputChange(text);
      setTab("input");
    };
    reader.readAsText(file, "utf-8");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [setInputValue, handleInputChange, notify]);

  // ── Clear / Reset ─────────────────────────────────────────────────────────
  const doClear = useCallback(() => {
    setInputValue(""); handleInputChange("");
    setOutputValue("");
    setOutput(""); setStats(null); setError(null); setNotif(null); setTab("input");
  }, [setInputValue, setOutputValue, handleInputChange]);

  const doReset = useCallback(() => {
    doClear();
    setMode("minify");
    setOpts({ removeComments: true, optimizeColors: true, optimizeZeros: true });
  }, [doClear]);

  const setOpt = useCallback(<K extends keyof MinifyOptions>(key: K, val: MinifyOptions[K]) => {
    setOpts(o => ({ ...o, [key]: val }));
  }, []);

  const isEmpty = !input.trim();

  // ─── Stats accent per mode ───────────────────────────────────────────────
  const outputLabel = mode === "minify" ? "Minified size" : "Beautified size";
  const savingsPositive = stats ? stats.savedBytes > 0 : false;

  return (
    <div className="mb-12 flex flex-col gap-4">

      {/* Toolbar */}
      <div className="glass-panel rounded-2xl p-3 flex flex-wrap items-center gap-2"
        style={{ border: "1px solid rgba(255,255,255,0.06)" }}>

        {/* Minify */}
        <button onClick={doMinify} disabled={isEmpty}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[13px] font-bold transition-all"
          style={{
            background: "rgba(221,183,255,0.15)", color: "#ddb7ff",
            border: "1px solid rgba(221,183,255,0.3)",
            opacity: isEmpty ? 0.5 : 1, cursor: isEmpty ? "not-allowed" : "pointer",
          }}>
          <span className="material-symbols-outlined text-[16px]">compress</span>
          Minify CSS
        </button>

        {/* Beautify */}
        <button onClick={doBeautify} disabled={isEmpty}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[13px] font-bold transition-all"
          style={{
            background: "rgba(76,215,246,0.1)", color: "#4cd7f6",
            border: "1px solid rgba(76,215,246,0.2)",
            opacity: isEmpty ? 0.5 : 1, cursor: isEmpty ? "not-allowed" : "pointer",
          }}>
          <span className="material-symbols-outlined text-[16px]">format_indent_increase</span>
          Beautify CSS
        </button>

        <div className="w-px h-6 mx-1" style={{ background: "rgba(255,255,255,0.08)" }} />

        {/* Copy output */}
        <button onClick={doCopy}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[13px] font-semibold transition-all"
          style={{ background: "rgba(255,255,255,0.05)", color: copied ? "#80e0a0" : "#988d9f", border: "1px solid rgba(255,255,255,0.08)" }}>
          <span className="material-symbols-outlined text-[15px]">{copied ? "check" : "content_copy"}</span>
          {copied ? "Copied!" : "Copy Output"}
        </button>

        {/* Download */}
        <button onClick={doDownload}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[13px] font-semibold transition-all"
          style={{ background: "rgba(255,255,255,0.05)", color: "#988d9f", border: "1px solid rgba(255,255,255,0.08)" }}>
          <span className="material-symbols-outlined text-[15px]">download</span>
          Download
        </button>

        {/* Upload */}
        <label htmlFor={uploadId}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[13px] font-semibold cursor-pointer transition-all"
          style={{ background: "rgba(255,255,255,0.05)", color: "#988d9f", border: "1px solid rgba(255,255,255,0.08)" }}>
          <span className="material-symbols-outlined text-[15px]">upload_file</span>
          Upload .css
          <input ref={fileInputRef} id={uploadId} type="file" accept=".css,text/css"
            className="hidden" onChange={doUpload} />
        </label>

        <div className="w-px h-6 mx-1" style={{ background: "rgba(255,255,255,0.08)" }} />

        {/* Clear */}
        <button onClick={doClear}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[13px] font-semibold transition-all"
          style={{ background: "rgba(255,100,100,0.08)", color: "#ff8080", border: "1px solid rgba(255,100,100,0.15)" }}>
          <span className="material-symbols-outlined text-[15px]">delete_sweep</span>
          Clear
        </button>

        {/* Reset */}
        <button onClick={doReset}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[13px] font-semibold transition-all"
          style={{ background: "rgba(255,100,100,0.05)", color: "#ff8080", border: "1px solid rgba(255,100,100,0.1)" }}>
          <span className="material-symbols-outlined text-[15px]">refresh</span>
          Reset
        </button>
      </div>

      {/* Options (minify only) */}
      <div className="glass-panel rounded-2xl p-4 flex flex-wrap gap-x-6 gap-y-3"
        style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
        <span className="text-[11px] font-bold uppercase tracking-wider self-center mr-2 shrink-0"
          style={{ color: "#4d4354" }}>Minify options</span>
        <OptionToggle label="Remove comments"   checked={opts.removeComments} onChange={v => setOpt("removeComments", v)} />
        <OptionToggle label="Optimize colors"   checked={opts.optimizeColors} onChange={v => setOpt("optimizeColors", v)} />
        <OptionToggle label="Optimize zeros"    checked={opts.optimizeZeros}  onChange={v => setOpt("optimizeZeros", v)} />
      </div>

      {/* Notification */}
      {notif && (
        <div className="flex items-start gap-3 p-3 rounded-2xl text-sm font-medium"
          style={{
            background: notif.type === "error" ? "rgba(255,100,100,0.1)" : notif.type === "success" ? "rgba(100,220,150,0.1)" : "rgba(221,183,255,0.1)",
            border: `1px solid ${notif.type === "error" ? "rgba(255,100,100,0.25)" : notif.type === "success" ? "rgba(100,220,150,0.25)" : "rgba(221,183,255,0.25)"}`,
            color: notif.type === "error" ? "#ff8080" : notif.type === "success" ? "#80e0a0" : "#ddb7ff",
          }}>
          <span className="material-symbols-outlined text-[16px] mt-0.5 shrink-0">
            {notif.type === "error" ? "error" : notif.type === "success" ? "check_circle" : "info"}
          </span>
          <span>{notif.message}</span>
          <button onClick={() => setNotif(null)} className="ml-auto opacity-60 hover:opacity-100">
            <span className="material-symbols-outlined text-[14px]">close</span>
          </button>
        </div>
      )}

      {/* Error detail */}
      {error && (
        <div className="flex items-start gap-3 p-3 rounded-2xl text-sm"
          style={{ background: "rgba(255,100,100,0.08)", border: "1px solid rgba(255,100,100,0.2)", color: "#ff8080" }}>
          <span className="material-symbols-outlined text-[16px] mt-0.5 shrink-0">bug_report</span>
          <pre className="whitespace-pre-wrap break-all text-[12px] leading-relaxed font-mono">{error}</pre>
        </div>
      )}

      {/* Stats */}
      {stats && (
        <div className="flex flex-wrap gap-3">
          {[
            { label: "Original size",  value: formatBytes(stats.originalSize), accent: "#988d9f" },
            { label: outputLabel,      value: formatBytes(stats.outputSize),   accent: "#4cd7f6" },
            { label: "Bytes saved",    value: savingsPositive ? formatBytes(stats.savedBytes) : `+${formatBytes(-stats.savedBytes)}`, accent: savingsPositive ? "#80e0a0" : "#ff8080" },
            { label: "Reduction",      value: savingsPositive ? `${stats.reduction.toFixed(1)}%` : `+${(-stats.reduction).toFixed(1)}%`, accent: "#ddb7ff" },
          ].map(({ label, value, accent }) => (
            <div key={label}
              className="glass-panel rounded-xl px-4 py-2 flex flex-col gap-0.5"
              style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
              <span className="text-base font-bold tabular-nums" style={{ color: accent }}>{value}</span>
              <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "#988d9f" }}>{label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Tab switcher */}
      <div className="flex rounded-xl overflow-hidden self-start" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
        {(["input", "output"] as TabSide[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className="flex items-center gap-1.5 px-4 py-2 text-[13px] font-semibold transition-all"
            style={{
              background: tab === t ? "rgba(221,183,255,0.15)" : "rgba(255,255,255,0.03)",
              color: tab === t ? "#ddb7ff" : "#988d9f",
            }}>
            <span className="material-symbols-outlined text-[14px]">
              {t === "input" ? "css" : mode === "minify" ? "compress" : "format_indent_increase"}
            </span>
            {t === "input" ? "Input CSS" : mode === "minify" ? "Minified Output" : "Beautified Output"}
          </button>
        ))}
      </div>

      {/* Input editor */}
      <div style={{ display: tab === "input" ? "block" : "none" }}>
        <div className="glass-panel rounded-2xl overflow-hidden"
          style={{ border: "1px solid rgba(255,255,255,0.07)", minHeight: "420px", position: "relative" }}>
          {isEmpty && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-10"
              style={{ color: "#4d4354" }}>
              <div className="text-center">
                <span className="material-symbols-outlined text-[40px] block mb-2">css</span>
                Paste or upload your CSS here
              </div>
            </div>
          )}
          <div ref={inputContainerRef} style={{ minHeight: "420px" }} />
        </div>
      </div>

      {/* Output editor (read-only) */}
      <div style={{ display: tab === "output" ? "block" : "none" }}>
        <div className="glass-panel rounded-2xl overflow-hidden"
          style={{
            border: `1px solid ${output ? "rgba(100,220,150,0.2)" : "rgba(255,255,255,0.07)"}`,
            minHeight: "420px",
            position: "relative",
          }}>
          {!output && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-10"
              style={{ color: "#4d4354" }}>
              <div className="text-center">
                <span className="material-symbols-outlined text-[40px] block mb-2">compress</span>
                Output CSS will appear here
              </div>
            </div>
          )}
          <div ref={outputContainerRef} style={{ minHeight: "420px" }} />
        </div>
      </div>

      {/* Sample button */}
      {isEmpty && (
        <button
          onClick={() => {
            const sample = `/* Navigation styles */
body {
  margin: 0px;
  padding: 0px;
  font-family: sans-serif;
  background-color: #ffffff;
  color: #333333;
}

/* Header */
.header {
  display:     flex;
  align-items: center;
  padding:     16px   32px;
  background:  #131313;
  border-bottom: 1px solid #222222;
}

.hero {
  padding: 80px 0px 80px 0px;
  background: linear-gradient(135deg, #aabbcc, #ddeeff);
}

h1, h2, h3 {
  margin-top: 0em;
  margin-bottom: 0.5em;
  color: #111111;
}

/* Responsive */
@media (max-width: 768px) {
  .header { padding: 12px 16px; }
  .hero   { padding: 40px 0px; }
}`;
            setInputValue(sample);
            handleInputChange(sample);
          }}
          className="text-sm font-semibold flex items-center justify-center gap-1.5 transition-opacity hover:opacity-80"
          style={{ color: "#988d9f" }}
        >
          <span className="material-symbols-outlined text-[16px]">auto_awesome</span>
          Load sample CSS
        </button>
      )}
    </div>
  );
}
