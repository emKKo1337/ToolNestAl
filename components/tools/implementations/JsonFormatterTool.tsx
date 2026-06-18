"use client";

import { useState, useRef, useCallback, useEffect, useId } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────
type TabView   = "raw" | "tree";
type NotifType = "success" | "error" | "info";

interface JsonError { message: string; line: number | null; col: number | null }

// ─── Helpers ──────────────────────────────────────────────────────────────────
function parseJson(text: string): { value: unknown; error: JsonError | null } {
  if (!text.trim()) return { value: null, error: null };
  try {
    return { value: JSON.parse(text), error: null };
  } catch (e) {
    const msg = (e as SyntaxError).message;
    // Extract line/col from the error message (V8 format: "... at position N")
    const posMatch = msg.match(/position (\d+)/);
    if (posMatch) {
      const pos = parseInt(posMatch[1], 10);
      const before = text.slice(0, pos);
      const line   = (before.match(/\n/g) ?? []).length + 1;
      const col    = pos - before.lastIndexOf("\n");
      return { value: null, error: { message: msg, line, col } };
    }
    return { value: null, error: { message: msg, line: null, col: null } };
  }
}

function beautify(text: string): string | null {
  try { return JSON.stringify(JSON.parse(text), null, 2); }
  catch { return null; }
}

function minify(text: string): string | null {
  try { return JSON.stringify(JSON.parse(text)); }
  catch { return null; }
}

function downloadJson(content: string, filename = "formatted.json") {
  const blob = new Blob([content], { type: "application/json" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ─── JSON Tree renderer ───────────────────────────────────────────────────────
function JsonTree({ data, depth = 0 }: { data: unknown; depth?: number }) {
  const [open, setOpen] = useState(depth < 2);

  if (data === null) {
    return <span style={{ color: "#988d9f" }}>null</span>;
  }

  if (typeof data === "boolean") {
    return <span style={{ color: "#ff8080" }}>{data ? "true" : "false"}</span>;
  }

  if (typeof data === "number") {
    return <span style={{ color: "#80e0a0" }}>{data}</span>;
  }

  if (typeof data === "string") {
    return <span style={{ color: "#4cd7f6" }}>&quot;{data}&quot;</span>;
  }

  const isArray   = Array.isArray(data);
  const entries   = Object.entries(data as Record<string, unknown>);
  const openBracket  = isArray ? "[" : "{";
  const closeBracket = isArray ? "]" : "}";
  const summary      = `${entries.length} ${isArray ? (entries.length === 1 ? "item" : "items") : (entries.length === 1 ? "key" : "keys")}`;

  if (entries.length === 0) {
    return <span style={{ color: "#988d9f" }}>{openBracket}{closeBracket}</span>;
  }

  return (
    <span>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        className="transition-colors"
        style={{ color: "#ddb7ff", fontFamily: "inherit" }}
        aria-expanded={open}
      >
        <span style={{ color: "#988d9f" }}>{openBracket}</span>
        {!open && (
          <span style={{ color: "#4d4354", fontSize: "0.85em" }}>
            {" "}{summary}{" "}
          </span>
        )}
        <span
          className="inline-flex items-center justify-center w-3.5 h-3.5 rounded text-[9px] font-bold ml-0.5 transition-transform"
          style={{
            background: "rgba(221,183,255,0.15)",
            color: "#ddb7ff",
            transform: open ? "rotate(90deg)" : "rotate(0deg)",
            verticalAlign: "middle",
          }}
        >▶</span>
      </button>

      {open && (
        <span>
          <br />
          {entries.map(([k, v], i) => (
            <span key={k} style={{ display: "block", paddingLeft: `${(depth + 1) * 20}px` }}>
              {!isArray && (
                <span style={{ color: "#ddb7ff" }}>&quot;{k}&quot;</span>
              )}
              {!isArray && <span style={{ color: "#988d9f" }}>: </span>}
              <JsonTree data={v} depth={depth + 1} />
              {i < entries.length - 1 && <span style={{ color: "#988d9f" }}>,</span>}
            </span>
          ))}
          <span style={{ paddingLeft: `${depth * 20}px`, display: "block", color: "#988d9f" }}>
            {closeBracket}
          </span>
        </span>
      )}

      {!open && <span style={{ color: "#988d9f" }}>{closeBracket}</span>}
    </span>
  );
}

// ─── CodeMirror editor (mounted imperatively to avoid SSR) ────────────────────
function useCodeMirror(
  containerRef: React.RefObject<HTMLDivElement | null>,
  initialValue: string,
  onChange: (val: string) => void,
) {
  const viewRef = useRef<{ view: import("@codemirror/view").EditorView } | null>(null);

  // Mount
  useEffect(() => {
    let cancelled = false;

    async function mount() {
      const { EditorView, keymap, drawSelection, highlightActiveLine, lineNumbers, highlightActiveLineGutter } = await import("@codemirror/view");
      const { EditorState }       = await import("@codemirror/state");
      const { defaultKeymap, historyKeymap, history } = await import("@codemirror/commands");
      const { json }              = await import("@codemirror/lang-json");
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
        ".cm-content":   { padding: "12px 0", caretColor: "#ddb7ff", minHeight: "300px" },
        ".cm-line":      { padding: "0 16px" },
        ".cm-cursor":    { borderLeftColor: "#ddb7ff" },
        ".cm-activeLine":           { backgroundColor: "rgba(221,183,255,0.05)" },
        ".cm-activeLineGutter":     { backgroundColor: "rgba(221,183,255,0.08)" },
        ".cm-gutters":   { backgroundColor: "rgba(0,0,0,0.2)", borderRight: "1px solid rgba(255,255,255,0.06)", color: "#4d4354" },
        ".cm-lineNumbers .cm-gutterElement": { padding: "0 8px" },
        ".cm-selectionBackground, ::selection": { backgroundColor: "rgba(221,183,255,0.2) !important" },
        "&.cm-focused .cm-selectionBackground": { backgroundColor: "rgba(221,183,255,0.2)" },
        // JSON syntax colours
        ".tok-string":    { color: "#4cd7f6" },
        ".tok-number":    { color: "#80e0a0" },
        ".tok-bool":      { color: "#ff8080" },
        ".tok-null":      { color: "#988d9f" },
        ".tok-propertyName": { color: "#ddb7ff" },
        ".tok-punctuation":  { color: "#988d9f" },
        ".tok-bracket":      { color: "#988d9f" },
      }, { dark: true });

      const state = EditorState.create({
        doc: initialValue,
        extensions: [
          lineNumbers(),
          highlightActiveLineGutter(),
          highlightActiveLine(),
          drawSelection(),
          history(),
          syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
          keymap.of([...defaultKeymap, ...historyKeymap]),
          json(),
          theme,
          EditorView.updateListener.of((update) => {
            if (update.docChanged) onChange(update.state.doc.toString());
          }),
          EditorView.lineWrapping,
        ],
      });

      const view = new EditorView({ state, parent: containerRef.current });
      viewRef.current = { view };
    }

    mount();
    return () => {
      cancelled = true;
      viewRef.current?.view.destroy();
      viewRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Expose setter for programmatic updates
  const setValue = useCallback((text: string) => {
    const v = viewRef.current?.view;
    if (!v) return;
    const cur = v.state.doc.toString();
    if (cur === text) return;
    v.dispatch({
      changes: { from: 0, to: v.state.doc.length, insert: text },
    });
  }, []);

  return { setValue };
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function JsonFormatterTool() {
  const uid = useId();

  const [raw,     setRaw]     = useState("");
  const [parsed,  setParsed]  = useState<unknown>(null);
  const [error,   setError]   = useState<JsonError | null>(null);
  const [tabView, setTabView] = useState<TabView>("raw");
  const [notif,   setNotif]   = useState<{ type: NotifType; message: string } | null>(null);
  const [copied,  setCopied]  = useState(false);

  const editorContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef       = useRef<HTMLInputElement>(null);

  const notify = useCallback((type: NotifType, msg: string) => {
    setNotif({ type, message: msg });
    if (type !== "info") setTimeout(() => setNotif(null), 5000);
  }, []);

  // ── Validate on every change ──────────────────────────────────────────────
  const handleChange = useCallback((text: string) => {
    setRaw(text);
    if (!text.trim()) { setParsed(null); setError(null); return; }
    const { value, error: err } = parseJson(text);
    setParsed(value);
    setError(err);
  }, []);

  const { setValue } = useCodeMirror(editorContainerRef, raw, handleChange);

  // ── Actions ───────────────────────────────────────────────────────────────
  const doBeautify = useCallback(() => {
    const result = beautify(raw);
    if (result === null) { notify("error", "Cannot beautify invalid JSON."); return; }
    setValue(result);
    handleChange(result);
    notify("success", "JSON beautified.");
  }, [raw, setValue, handleChange, notify]);

  const doMinify = useCallback(() => {
    const result = minify(raw);
    if (result === null) { notify("error", "Cannot minify invalid JSON."); return; }
    setValue(result);
    handleChange(result);
    notify("success", "JSON minified.");
  }, [raw, setValue, handleChange, notify]);

  const doCopy = useCallback(async () => {
    if (!raw.trim()) { notify("error", "Nothing to copy."); return; }
    await navigator.clipboard.writeText(raw);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [raw, notify]);

  const doDownload = useCallback(() => {
    if (!raw.trim()) { notify("error", "Nothing to download."); return; }
    downloadJson(raw);
    notify("success", "Downloaded formatted.json.");
  }, [raw, notify]);

  const doUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith(".json") && file.type !== "application/json") {
      notify("error", "Upload a .json file."); return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setValue(text);
      handleChange(text);
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [setValue, handleChange, notify]);

  const doClear = useCallback(() => {
    setValue("");
    handleChange("");
    setParsed(null);
    setError(null);
    setNotif(null);
  }, [setValue, handleChange]);

  // ── Derived ───────────────────────────────────────────────────────────────
  const isEmpty   = !raw.trim();
  const isValid   = !isEmpty && error === null;
  const isInvalid = !isEmpty && error !== null;

  const uploadId = `${uid}-upload`;

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="mb-12 flex flex-col gap-4">

      {/* Toolbar */}
      <div className="glass-panel rounded-2xl p-3 flex flex-wrap items-center gap-2"
        style={{ border: "1px solid rgba(255,255,255,0.06)" }}>

        {/* Beautify / Minify */}
        <button onClick={doBeautify}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[13px] font-semibold transition-all"
          style={{ background: "rgba(221,183,255,0.12)", color: "#ddb7ff", border: "1px solid rgba(221,183,255,0.25)" }}>
          <span className="material-symbols-outlined text-[15px]">format_indent_increase</span>
          Beautify
        </button>
        <button onClick={doMinify}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[13px] font-semibold transition-all"
          style={{ background: "rgba(76,215,246,0.1)", color: "#4cd7f6", border: "1px solid rgba(76,215,246,0.2)" }}>
          <span className="material-symbols-outlined text-[15px]">compress</span>
          Minify
        </button>

        <div className="w-px h-6 mx-1" style={{ background: "rgba(255,255,255,0.08)" }} />

        {/* Copy */}
        <button onClick={doCopy}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[13px] font-semibold transition-all"
          style={{ background: "rgba(255,255,255,0.05)", color: copied ? "#80e0a0" : "#988d9f", border: "1px solid rgba(255,255,255,0.08)" }}>
          <span className="material-symbols-outlined text-[15px]">{copied ? "check" : "content_copy"}</span>
          {copied ? "Copied!" : "Copy"}
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
          Upload
          <input ref={fileInputRef} id={uploadId} type="file" accept=".json,application/json"
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

        {/* Spacer */}
        <div className="flex-1" />

        {/* View toggle */}
        <div className="flex rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
          {(["raw", "tree"] as TabView[]).map((v) => (
            <button key={v} onClick={() => setTabView(v)}
              className="flex items-center gap-1.5 px-3 py-2 text-[12px] font-semibold transition-all"
              style={{
                background: tabView === v ? "rgba(221,183,255,0.15)" : "rgba(255,255,255,0.03)",
                color: tabView === v ? "#ddb7ff" : "#988d9f",
              }}>
              <span className="material-symbols-outlined text-[14px]">
                {v === "raw" ? "code" : "account_tree"}
              </span>
              {v === "raw" ? "Raw" : "Tree"}
            </button>
          ))}
        </div>
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

      {/* Validation status bar */}
      {!isEmpty && (
        <div
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold"
          style={{
            background: isValid ? "rgba(100,220,150,0.08)" : "rgba(255,100,100,0.08)",
            border: `1px solid ${isValid ? "rgba(100,220,150,0.2)" : "rgba(255,100,100,0.2)"}`,
            color: isValid ? "#80e0a0" : "#ff8080",
          }}
        >
          <span className="material-symbols-outlined text-[14px]">
            {isValid ? "check_circle" : "error"}
          </span>
          {isValid
            ? "Valid JSON"
            : error
              ? `${error.message}${error.line ? ` (line ${error.line}, col ${error.col})` : ""}`
              : "Invalid JSON"
          }
        </div>
      )}

      {/* Editor / Tree */}
      {tabView === "raw" && (
        <div
          className="glass-panel rounded-2xl overflow-hidden"
          style={{
            border: `1px solid ${isInvalid ? "rgba(255,100,100,0.3)" : isValid ? "rgba(100,220,150,0.2)" : "rgba(255,255,255,0.06)"}`,
            minHeight: "420px",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Editor placeholder text */}
          {isEmpty && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none"
              style={{ color: "#4d4354", fontSize: "14px", zIndex: 1, padding: "20px" }}>
              <div className="text-center">
                <span className="material-symbols-outlined text-[40px] block mb-2">data_object</span>
                Paste or type JSON here, or upload a .json file
              </div>
            </div>
          )}
          <div
            ref={editorContainerRef}
            className="flex-1"
            style={{ minHeight: "420px", position: "relative" }}
          />
        </div>
      )}

      {tabView === "tree" && (
        <div
          className="glass-panel rounded-2xl overflow-auto"
          style={{
            border: "1px solid rgba(255,255,255,0.06)",
            minHeight: "420px",
            maxHeight: "640px",
            padding: "16px",
          }}
        >
          {isEmpty ? (
            <div className="h-full flex items-center justify-center" style={{ color: "#4d4354" }}>
              <div className="text-center">
                <span className="material-symbols-outlined text-[40px] block mb-2">account_tree</span>
                Parse valid JSON to view its tree structure
              </div>
            </div>
          ) : isInvalid ? (
            <div className="h-full flex items-center justify-center" style={{ color: "#ff8080" }}>
              <div className="text-center">
                <span className="material-symbols-outlined text-[40px] block mb-2">error</span>
                Fix the JSON errors to view the tree
              </div>
            </div>
          ) : (
            <pre
              className="text-sm leading-relaxed"
              style={{ fontFamily: "'JetBrains Mono','Fira Code',Consolas,monospace", color: "#e8dff0" }}
            >
              <JsonTree data={parsed} depth={0} />
            </pre>
          )}
        </div>
      )}

      {/* Stats footer */}
      {isValid && parsed !== null && (
        <div className="flex flex-wrap gap-3">
          {[
            { label: "Characters", value: raw.length.toLocaleString() },
            { label: "Lines", value: (raw.match(/\n/g)?.length ?? 0 + 1).toLocaleString() },
            { label: "Keys", value: typeof parsed === "object" && parsed !== null
              ? Object.keys(parsed as Record<string, unknown>).length.toLocaleString()
              : "—" },
            { label: "Size", value: `${(new Blob([raw]).size / 1024).toFixed(1)} KB` },
          ].map(({ label, value }) => (
            <div key={label}
              className="glass-panel rounded-xl px-4 py-2 flex flex-col gap-0.5"
              style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
              <span className="text-base font-bold tabular-nums" style={{ color: "#ddb7ff" }}>{value}</span>
              <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "#988d9f" }}>{label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Sample JSON button */}
      {isEmpty && (
        <button
          onClick={() => {
            const sample = JSON.stringify({
              name: "ToolNest AI",
              version: "1.0.0",
              features: ["JSON Formatter", "PDF Tools", "Image Tools"],
              meta: { author: "ToolNest", license: "MIT", active: true, count: 42 },
            }, null, 2);
            setValue(sample);
            handleChange(sample);
          }}
          className="text-sm font-semibold flex items-center justify-center gap-1.5 transition-opacity hover:opacity-80"
          style={{ color: "#988d9f" }}
        >
          <span className="material-symbols-outlined text-[16px]">auto_awesome</span>
          Load sample JSON
        </button>
      )}
    </div>
  );
}
