"use client";

import { useState, useRef, useCallback, useEffect, useId } from "react";

// ─── Types ─────────────────────────────────────────────────────────────────────
type NotifType = "success" | "error" | "info";
type TabSide   = "input" | "output";

interface MinifyOptions {
  removeComments:         boolean;
  collapseWhitespace:     boolean;
  collapseInlineWhitespace: boolean;
  removeOptionalTags:     boolean;
  preserveConditional:    boolean;
}

interface Stats {
  originalSize:  number;
  minifiedSize:  number;
  savedBytes:    number;
  reduction:     number;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────
function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

function downloadFile(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/html;charset=utf-8" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function runMinify(html: string, opts: MinifyOptions): string {
  let result = html;

  // Remove / preserve comments
  if (opts.removeComments) {
    if (opts.preserveConditional) {
      // Strip normal comments but keep <!--[if ...]>…<![endif]-->
      result = result.replace(/<!--(?!\[)[\s\S]*?-->/g, "");
    } else {
      result = result.replace(/<!--[\s\S]*?-->/g, "");
    }
  }

  // Collapse whitespace between tags
  if (opts.collapseWhitespace) {
    result = result.replace(/>\s+</g, "><");
    // Collapse leading/trailing whitespace inside text nodes
    result = result.replace(/\s{2,}/g, " ");
  }

  // Collapse inline whitespace (within text)
  if (opts.collapseInlineWhitespace) {
    result = result
      .replace(/[ \t]+/g, " ")
      .replace(/\n\s*/g, "\n")
      .replace(/\n+/g, " ");
  }

  // Remove optional tags: html, head, body, tbody, colgroup, tfoot, thead
  if (opts.removeOptionalTags) {
    result = result.replace(/<\/?(html|head|body|tbody|colgroup|tfoot|thead)(\s[^>]*)?>(\s*)/gi, "");
  }

  // Always: trim and normalise doctype
  result = result
    .replace(/<!DOCTYPE\s+html(\s+[^>]*)?>/gi, "<!DOCTYPE html>")
    .trim();

  return result;
}

// ─── CodeMirror hook (HTML flavour) ───────────────────────────────────────────
function useHtmlEditor(
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
      const { EditorState }                              = await import("@codemirror/state");
      const { defaultKeymap, historyKeymap, history }    = await import("@codemirror/commands");
      const { html }                                     = await import("@codemirror/lang-html");
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
        ".cm-gutters":          { backgroundColor: "rgba(0,0,0,0.2)", borderRight: "1px solid rgba(255,255,255,0.06)", color: "#4d4354" },
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
        html(),
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
    if (!v) return;
    if (v.state.doc.toString() === text) return;
    v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: text } });
  }, []);

  return { setValue };
}

// ─── Toggle option row ─────────────────────────────────────────────────────────
function OptionToggle({
  label, checked, onChange, disabled,
}: { label: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none"
      style={{ opacity: disabled ? 0.4 : 1 }}>
      <span
        onClick={() => !disabled && onChange(!checked)}
        className="relative w-8 h-4 rounded-full transition-colors shrink-0"
        style={{
          background: checked ? "rgba(221,183,255,0.5)" : "rgba(255,255,255,0.1)",
          cursor: disabled ? "not-allowed" : "pointer",
        }}
        role="switch"
        aria-checked={checked}
        tabIndex={disabled ? -1 : 0}
        onKeyDown={e => { if (!disabled && (e.key === " " || e.key === "Enter")) onChange(!checked); }}
      >
        <span
          className="absolute top-0.5 left-0.5 w-3 h-3 rounded-full transition-transform"
          style={{
            background: checked ? "#ddb7ff" : "#4d4354",
            transform: checked ? "translateX(16px)" : "translateX(0)",
          }}
        />
      </span>
      <span className="text-[13px] font-medium" style={{ color: "#988d9f" }}>{label}</span>
    </label>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────
export default function HtmlMinifierTool() {
  const uid = useId();

  const [input,   setInput]   = useState("");
  const [output,  setOutput]  = useState("");
  const [stats,   setStats]   = useState<Stats | null>(null);
  const [error,   setError]   = useState<string | null>(null);
  const [tab,     setTab]     = useState<TabSide>("input");
  const [notif,   setNotif]   = useState<{ type: NotifType; message: string } | null>(null);
  const [copied,  setCopied]  = useState(false);
  const [busy,    setBusy]    = useState(false);

  const [opts, setOpts] = useState<MinifyOptions>({
    removeComments:           true,
    collapseWhitespace:       true,
    collapseInlineWhitespace: true,
    removeOptionalTags:       false,
    preserveConditional:      false,
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
    // Clear stale output when input changes
    setOutput("");
    setStats(null);
    setError(null);
  }, []);

  const { setValue: setInputValue }  = useHtmlEditor(inputContainerRef,  input, handleInputChange, false);
  const { setValue: setOutputValue } = useHtmlEditor(outputContainerRef, "",    () => {},           true);

  // Sync output editor when output state changes
  useEffect(() => {
    async function sync() { setOutputValue(output); }
    sync();
  }, [output, setOutputValue]);

  // ── Minify ────────────────────────────────────────────────────────────────
  const doMinify = useCallback(() => {
    if (!input.trim()) { notify("error", "Paste some HTML first."); return; }
    setBusy(true);
    setError(null);

    async function run() {
      try {
        const result   = runMinify(input, opts);
        const origSize = new Blob([input]).size;
        const minSize  = new Blob([result]).size;
        setOutput(result);
        setStats({
          originalSize: origSize,
          minifiedSize: minSize,
          savedBytes:   origSize - minSize,
          reduction:    origSize > 0 ? ((origSize - minSize) / origSize) * 100 : 0,
        });
        setTab("output");
        notify("success", "HTML minified successfully.");
      } catch (e) {
        setError(`Minification failed: ${(e as Error).message}`);
        notify("error", "Minification failed. Check the error message below.");
      } finally {
        setBusy(false);
      }
    }
    run();
  }, [input, opts, notify]);

  // ── Copy output ───────────────────────────────────────────────────────────
  const doCopy = useCallback(async () => {
    if (!output) { notify("error", "Minify first to get output."); return; }
    await navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [output, notify]);

  // ── Download ──────────────────────────────────────────────────────────────
  const doDownload = useCallback(() => {
    if (!output) { notify("error", "Minify first to get output."); return; }
    downloadFile(output, "minified.html");
    notify("success", "Downloaded minified.html.");
  }, [output, notify]);

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
    setInputValue("");
    handleInputChange("");
    setOutput("");
    setOutputValue("");
    setStats(null);
    setError(null);
    setNotif(null);
    setTab("input");
  }, [setInputValue, setOutputValue, handleInputChange]);

  const doReset = useCallback(() => {
    doClear();
    setOpts({
      removeComments:           true,
      collapseWhitespace:       true,
      collapseInlineWhitespace: true,
      removeOptionalTags:       false,
      preserveConditional:      false,
    });
  }, [doClear]);

  const setOpt = useCallback(<K extends keyof MinifyOptions>(key: K, val: MinifyOptions[K]) => {
    setOpts(o => ({ ...o, [key]: val }));
  }, []);

  const isEmpty = !input.trim();

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="mb-12 flex flex-col gap-4">

      {/* Toolbar */}
      <div className="glass-panel rounded-2xl p-3 flex flex-wrap items-center gap-2"
        style={{ border: "1px solid rgba(255,255,255,0.06)" }}>

        {/* Minify */}
        <button onClick={doMinify} disabled={busy || isEmpty}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[13px] font-bold transition-all"
          style={{
            background: "rgba(221,183,255,0.15)",
            color: "#ddb7ff",
            border: "1px solid rgba(221,183,255,0.3)",
            opacity: busy || isEmpty ? 0.5 : 1,
            cursor: busy || isEmpty ? "not-allowed" : "pointer",
          }}>
          <span className="material-symbols-outlined text-[16px]">{busy ? "hourglass_empty" : "compress"}</span>
          {busy ? "Minifying…" : "Minify HTML"}
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
          Upload .html
          <input ref={fileInputRef} id={uploadId} type="file" accept=".html,.htm,text/html"
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

      {/* Options panel */}
      <div className="glass-panel rounded-2xl p-4 flex flex-wrap gap-x-6 gap-y-3"
        style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
        <span className="text-[11px] font-bold uppercase tracking-wider self-center mr-2 shrink-0"
          style={{ color: "#4d4354" }}>Options</span>
        <OptionToggle label="Remove comments"             checked={opts.removeComments}           onChange={v => setOpt("removeComments", v)} />
        <OptionToggle label="Collapse whitespace"         checked={opts.collapseWhitespace}       onChange={v => setOpt("collapseWhitespace", v)} />
        <OptionToggle label="Collapse inline whitespace"  checked={opts.collapseInlineWhitespace} onChange={v => setOpt("collapseInlineWhitespace", v)} />
        <OptionToggle label="Remove optional tags"        checked={opts.removeOptionalTags}       onChange={v => setOpt("removeOptionalTags", v)} />
        <OptionToggle
          label="Preserve conditional comments"
          checked={opts.preserveConditional}
          onChange={v => setOpt("preserveConditional", v)}
          disabled={!opts.removeComments}
        />
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
            { label: "Minified size",  value: formatBytes(stats.minifiedSize), accent: "#4cd7f6" },
            { label: "Bytes saved",    value: formatBytes(stats.savedBytes),   accent: "#80e0a0" },
            { label: "Reduction",      value: `${stats.reduction.toFixed(1)}%`, accent: "#ddb7ff" },
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
              {t === "input" ? "code" : "compress"}
            </span>
            {t === "input" ? "Input HTML" : "Minified Output"}
          </button>
        ))}
      </div>

      {/* Input editor */}
      <div style={{ display: tab === "input" ? "block" : "none" }}>
        <div
          className="glass-panel rounded-2xl overflow-hidden"
          style={{ border: "1px solid rgba(255,255,255,0.07)", minHeight: "420px", position: "relative" }}
        >
          {isEmpty && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-10"
              style={{ color: "#4d4354" }}>
              <div className="text-center">
                <span className="material-symbols-outlined text-[40px] block mb-2">html</span>
                Paste or upload your HTML here
              </div>
            </div>
          )}
          <div ref={inputContainerRef} style={{ minHeight: "420px" }} />
        </div>
      </div>

      {/* Output editor (read-only) */}
      <div style={{ display: tab === "output" ? "block" : "none" }}>
        <div
          className="glass-panel rounded-2xl overflow-hidden"
          style={{
            border: `1px solid ${output ? "rgba(100,220,150,0.2)" : "rgba(255,255,255,0.07)"}`,
            minHeight: "420px",
            position: "relative",
          }}
        >
          {!output && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-10"
              style={{ color: "#4d4354" }}>
              <div className="text-center">
                <span className="material-symbols-outlined text-[40px] block mb-2">compress</span>
                Minified HTML will appear here
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
            const sample = `<!DOCTYPE html>
<html lang="en">
  <head>
    <!-- Page meta -->
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Sample Page</title>
    <style>
      body {
        margin: 0;
        font-family: sans-serif;
        background: #131313;
        color: #e8dff0;
      }
    </style>
  </head>
  <body>
    <!-- Main content -->
    <header>
      <h1>Hello, ToolNest AI!</h1>
    </header>
    <main>
      <p>This is a   sample   HTML file with   extra whitespace.</p>
    </main>
  </body>
</html>`;
            setInputValue(sample);
            handleInputChange(sample);
          }}
          className="text-sm font-semibold flex items-center justify-center gap-1.5 transition-opacity hover:opacity-80"
          style={{ color: "#988d9f" }}
        >
          <span className="material-symbols-outlined text-[16px]">auto_awesome</span>
          Load sample HTML
        </button>
      )}
    </div>
  );
}
