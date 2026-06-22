"use client";

import { useState, useRef, useCallback, useEffect, useId } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────
type IndentStyle = "2" | "4" | "tab";
type NotifType   = "success" | "error" | "info";

interface XmlError { message: string; line: number | null; col: number | null }

// ─── Pure XML helpers (no external deps — browser DOMParser) ─────────────────

function parseXml(text: string): { doc: Document | null; error: XmlError | null } {
  if (!text.trim()) return { doc: null, error: null };
  const parser = new DOMParser();
  const doc    = parser.parseFromString(text, "application/xml");
  const errEl  = doc.querySelector("parsererror");
  if (errEl) {
    const raw  = errEl.textContent ?? "Unknown XML error";
    // Firefox / Chrome embed location differently — try to pull line/col
    const lineM = raw.match(/[Ll]ine\s*[:#]?\s*(\d+)/);
    const colM  = raw.match(/[Cc]ol(?:umn)?\s*[:#]?\s*(\d+)/);
    // Condense multi-line parsererror text to first meaningful sentence
    const msg = raw.replace(/\s+/g, " ").trim().split(":").slice(0, 2).join(":").trim();
    return {
      doc: null,
      error: {
        message: msg || raw.trim(),
        line: lineM ? Number(lineM[1]) : null,
        col:  colM  ? Number(colM[1])  : null,
      },
    };
  }
  return { doc, error: null };
}

function indentUnit(style: IndentStyle): string {
  if (style === "tab") return "\t";
  return " ".repeat(Number(style));
}

function serializeNode(node: Node, indent: string, depth: number): string {
  const pad = indent.repeat(depth);

  if (node.nodeType === Node.TEXT_NODE) {
    const text = (node.textContent ?? "").replace(/[\r\n]/g, " ").trim();
    return text ? `${pad}${escXml(text)}` : "";
  }

  if (node.nodeType === Node.CDATA_SECTION_NODE) {
    return `${pad}<![CDATA[${node.textContent ?? ""}]]>`;
  }

  if (node.nodeType === Node.COMMENT_NODE) {
    return `${pad}<!--${node.textContent ?? ""}-->`;
  }

  if (node.nodeType === Node.PROCESSING_INSTRUCTION_NODE) {
    const pi = node as ProcessingInstruction;
    return `${pad}<?${pi.target} ${pi.data}?>`;
  }

  if (node.nodeType !== Node.ELEMENT_NODE) return "";

  const el    = node as Element;
  const tag   = el.tagName;
  const attrs = Array.from(el.attributes)
    .map(a => ` ${a.name}="${escAttr(a.value)}"`)
    .join("");

  const children = Array.from(el.childNodes)
    .map(c => serializeNode(c, indent, depth + 1))
    .filter(s => s !== "");

  if (children.length === 0) return `${pad}<${tag}${attrs}/>`;

  // Single text child — keep on one line
  if (
    children.length === 1 &&
    el.childNodes.length === 1 &&
    el.childNodes[0].nodeType === Node.TEXT_NODE
  ) {
    const text = (el.childNodes[0].textContent ?? "").replace(/[\r\n]/g, " ").trim();
    return `${pad}<${tag}${attrs}>${escXml(text)}</${tag}>`;
  }

  return `${pad}<${tag}${attrs}>\n${children.join("\n")}\n${pad}</${tag}>`;
}

function escXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
function escAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}

function beautifyXml(text: string, style: IndentStyle): string | null {
  const { doc, error } = parseXml(text);
  if (error || !doc) return null;

  const indent = indentUnit(style);
  const lines: string[] = [];

  // XML declaration
  const decl = text.trim().match(/^<\?xml[^?>]*\?>/i);
  if (decl) lines.push(decl[0]);

  // Serialize each top-level node (skip xml-declaration PI already captured)
  for (const child of Array.from(doc.childNodes)) {
    if (child.nodeType === Node.PROCESSING_INSTRUCTION_NODE &&
        (child as ProcessingInstruction).target.toLowerCase() === "xml") continue;
    const serialized = serializeNode(child, indent, 0);
    if (serialized) lines.push(serialized);
  }

  return lines.join("\n");
}

function minifyXml(text: string): string | null {
  const { doc, error } = parseXml(text);
  if (error || !doc) return null;
  // Use XMLSerializer then strip inter-tag whitespace
  const raw = new XMLSerializer().serializeToString(doc);
  return raw.replace(/>\s+</g, "><").trim();
}

function downloadXml(content: string, filename = "formatted.xml") {
  const blob = new Blob([content], { type: "application/xml" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ─── CodeMirror editor (lazy — avoids SSR, reuses existing CM packages) ──────
function useCodeMirror(
  containerRef: React.RefObject<HTMLDivElement | null>,
  initialValue: string,
  onChange: (val: string) => void,
) {
  const viewRef = useRef<{ view: import("@codemirror/view").EditorView } | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function mount() {
      const {
        EditorView, keymap, drawSelection,
        highlightActiveLine, lineNumbers, highlightActiveLineGutter,
      } = await import("@codemirror/view");
      const { EditorState }                                          = await import("@codemirror/state");
      const { defaultKeymap, historyKeymap, history }               = await import("@codemirror/commands");
      const { html }                                                 = await import("@codemirror/lang-html");
      const { syntaxHighlighting, defaultHighlightStyle }           = await import("@codemirror/language");

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
        ".cm-content":   { padding: "12px 0", caretColor: "#adc6ff", minHeight: "300px" },
        ".cm-line":      { padding: "0 16px" },
        ".cm-cursor":    { borderLeftColor: "#adc6ff" },
        ".cm-activeLine":         { backgroundColor: "rgba(173,198,255,0.04)" },
        ".cm-activeLineGutter":   { backgroundColor: "rgba(173,198,255,0.07)" },
        ".cm-gutters":            { backgroundColor: "rgba(0,0,0,0.2)", borderRight: "1px solid rgba(255,255,255,0.06)", color: "#4d4354" },
        ".cm-lineNumbers .cm-gutterElement": { padding: "0 8px" },
        ".cm-selectionBackground, ::selection": { backgroundColor: "rgba(173,198,255,0.18) !important" },
        "&.cm-focused .cm-selectionBackground": { backgroundColor: "rgba(173,198,255,0.18)" },
        // XML / HTML token colours
        ".tok-tagName":    { color: "#adc6ff" },
        ".tok-angleBracket": { color: "#6e8aaf" },
        ".tok-attributeName":  { color: "#80e0a0" },
        ".tok-attributeValue": { color: "#4cd7f6" },
        ".tok-string":     { color: "#4cd7f6" },
        ".tok-comment":    { color: "#4d4354", fontStyle: "italic" },
        ".tok-processingInstruction": { color: "#ddb7ff" },
        ".tok-meta":       { color: "#ddb7ff" },
        ".tok-punctuation":  { color: "#6e8aaf" },
        ".tok-content":    { color: "#c8b89f" },
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
          html({ matchClosingTags: true, autoCloseTags: true }),
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

  const setValue = useCallback((text: string) => {
    const v = viewRef.current?.view;
    if (!v) return;
    if (v.state.doc.toString() === text) return;
    v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: text } });
  }, []);

  return { setValue };
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function XmlFormatterTool() {
  const uid = useId();

  const [raw,        setRaw]        = useState("");
  const [error,      setError]      = useState<XmlError | null>(null);
  const [indentStyle, setIndentStyle] = useState<IndentStyle>("2");
  const [notif,      setNotif]      = useState<{ type: NotifType; message: string } | null>(null);
  const [copied,     setCopied]     = useState(false);

  const editorContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef       = useRef<HTMLInputElement>(null);

  const notify = useCallback((type: NotifType, msg: string) => {
    setNotif({ type, message: msg });
    if (type !== "info") setTimeout(() => setNotif(null), 5000);
  }, []);

  // ── Validate on every change ──────────────────────────────────────────────
  const handleChange = useCallback((text: string) => {
    setRaw(text);
    if (!text.trim()) { setError(null); return; }
    const { error: err } = parseXml(text);
    setError(err);
  }, []);

  const { setValue } = useCodeMirror(editorContainerRef, raw, handleChange);

  // ── Actions ───────────────────────────────────────────────────────────────
  const doBeautify = useCallback(() => {
    const result = beautifyXml(raw, indentStyle);
    if (result === null) { notify("error", "Cannot beautify — fix XML errors first."); return; }
    setValue(result);
    handleChange(result);
    notify("success", "XML formatted.");
  }, [raw, indentStyle, setValue, handleChange, notify]);

  const doMinify = useCallback(() => {
    const result = minifyXml(raw);
    if (result === null) { notify("error", "Cannot minify — fix XML errors first."); return; }
    setValue(result);
    handleChange(result);
    notify("success", "XML minified.");
  }, [raw, setValue, handleChange, notify]);

  const doCopy = useCallback(async () => {
    if (!raw.trim()) { notify("error", "Nothing to copy."); return; }
    await navigator.clipboard.writeText(raw);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [raw, notify]);

  const doDownload = useCallback(() => {
    if (!raw.trim()) { notify("error", "Nothing to download."); return; }
    downloadXml(raw);
    notify("success", "Downloaded formatted.xml.");
  }, [raw, notify]);

  const doUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext !== "xml" && file.type !== "application/xml" && file.type !== "text/xml") {
      notify("error", "Please upload a .xml file."); return;
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
    setError(null);
    setNotif(null);
  }, [setValue, handleChange]);

  // ── Derived ───────────────────────────────────────────────────────────────
  const isEmpty   = !raw.trim();
  const isValid   = !isEmpty && error === null;
  const isInvalid = !isEmpty && error !== null;

  const lineCount = raw ? raw.split("\n").length : 0;
  const sizeKb    = raw ? (new Blob([raw]).size / 1024).toFixed(1) : "0";

  // Count elements in valid XML
  let elementCount = 0;
  let attrCount    = 0;
  if (isValid) {
    const { doc } = parseXml(raw);
    if (doc) {
      elementCount = doc.querySelectorAll("*").length;
      doc.querySelectorAll("*").forEach(el => { attrCount += el.attributes.length; });
    }
  }

  const uploadId = `${uid}-upload`;

  const INDENT_OPTIONS: { value: IndentStyle; label: string }[] = [
    { value: "2",   label: "2 spaces" },
    { value: "4",   label: "4 spaces" },
    { value: "tab", label: "Tabs" },
  ];

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="mb-12 flex flex-col gap-4">

      {/* Toolbar */}
      <div className="glass-panel rounded-2xl p-3 flex flex-wrap items-center gap-2"
        style={{ border: "1px solid rgba(255,255,255,0.06)" }}>

        {/* Beautify */}
        <button onClick={doBeautify}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[13px] font-semibold transition-all"
          style={{ background: "rgba(173,198,255,0.12)", color: "#adc6ff", border: "1px solid rgba(173,198,255,0.25)" }}>
          <span className="material-symbols-outlined text-[15px]">format_indent_increase</span>
          Beautify
        </button>

        {/* Minify */}
        <button onClick={doMinify}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[13px] font-semibold transition-all"
          style={{ background: "rgba(76,215,246,0.1)", color: "#4cd7f6", border: "1px solid rgba(76,215,246,0.2)" }}>
          <span className="material-symbols-outlined text-[15px]">compress</span>
          Minify
        </button>

        {/* Indent selector */}
        <div className="flex rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
          {INDENT_OPTIONS.map(({ value, label }) => (
            <button key={value} onClick={() => setIndentStyle(value)}
              className="px-3 py-2 text-[11px] font-semibold transition-all"
              style={{
                background: indentStyle === value ? "rgba(173,198,255,0.15)" : "rgba(255,255,255,0.03)",
                color:      indentStyle === value ? "#adc6ff"                : "#988d9f",
              }}>
              {label}
            </button>
          ))}
        </div>

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
          <input
            ref={fileInputRef} id={uploadId} type="file"
            accept=".xml,application/xml,text/xml"
            className="hidden" onChange={doUpload}
          />
        </label>

        <div className="w-px h-6 mx-1" style={{ background: "rgba(255,255,255,0.08)" }} />

        {/* Clear */}
        <button onClick={doClear}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[13px] font-semibold transition-all"
          style={{ background: "rgba(255,100,100,0.08)", color: "#ff8080", border: "1px solid rgba(255,100,100,0.15)" }}>
          <span className="material-symbols-outlined text-[15px]">delete_sweep</span>
          Reset
        </button>
      </div>

      {/* Notification */}
      {notif && (
        <div className="flex items-start gap-3 p-3 rounded-2xl text-sm font-medium"
          style={{
            background: notif.type === "error" ? "rgba(255,100,100,0.1)" : notif.type === "success" ? "rgba(100,220,150,0.1)" : "rgba(173,198,255,0.1)",
            border: `1px solid ${notif.type === "error" ? "rgba(255,100,100,0.25)" : notif.type === "success" ? "rgba(100,220,150,0.25)" : "rgba(173,198,255,0.25)"}`,
            color:  notif.type === "error" ? "#ff8080" : notif.type === "success" ? "#80e0a0" : "#adc6ff",
          }}>
          <span className="material-symbols-outlined text-[16px] mt-0.5 shrink-0">
            {notif.type === "error" ? "error" : notif.type === "success" ? "check_circle" : "info"}
          </span>
          <span className="flex-1">{notif.message}</span>
          <button onClick={() => setNotif(null)} className="opacity-60 hover:opacity-100">
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
            color:  isValid ? "#80e0a0" : "#ff8080",
          }}
        >
          <span className="material-symbols-outlined text-[14px]">
            {isValid ? "check_circle" : "error"}
          </span>
          {isValid
            ? "Valid XML"
            : error
              ? `${error.message}${error.line ? ` (line ${error.line}${error.col ? `, col ${error.col}` : ""})` : ""}`
              : "Invalid XML"
          }
        </div>
      )}

      {/* Editor */}
      <div
        className="glass-panel rounded-2xl overflow-hidden relative"
        style={{
          border: `1px solid ${isInvalid ? "rgba(255,100,100,0.3)" : isValid ? "rgba(100,220,150,0.2)" : "rgba(255,255,255,0.06)"}`,
          minHeight: "420px",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {isEmpty && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none"
            style={{ color: "#4d4354", fontSize: "14px", zIndex: 1 }}>
            <div className="text-center px-6">
              <span className="material-symbols-outlined text-[40px] block mb-2">code</span>
              Paste or type XML here, or upload a .xml file
            </div>
          </div>
        )}
        <div
          ref={editorContainerRef}
          className="flex-1"
          style={{ minHeight: "420px", position: "relative" }}
        />
      </div>

      {/* Stats footer */}
      {!isEmpty && (
        <div className="flex flex-wrap gap-3">
          {[
            { label: "Lines",    value: lineCount.toLocaleString(),    show: true },
            { label: "Size",     value: `${sizeKb} KB`,                show: true },
            { label: "Elements", value: elementCount.toLocaleString(), show: isValid },
            { label: "Attributes", value: attrCount.toLocaleString(),  show: isValid },
          ].filter(s => s.show).map(({ label, value }) => (
            <div key={label}
              className="glass-panel rounded-xl px-4 py-2 flex flex-col gap-0.5"
              style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
              <span className="text-base font-bold tabular-nums" style={{ color: "#adc6ff" }}>{value}</span>
              <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "#988d9f" }}>{label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Sample XML button */}
      {isEmpty && (
        <button
          onClick={() => {
            const sample = `<?xml version="1.0" encoding="UTF-8"?>
<catalog>
  <book id="bk101">
    <author>Gambardella, Matthew</author>
    <title>XML Developer's Guide</title>
    <genre>Computer</genre>
    <price>44.95</price>
    <publish_date>2000-10-01</publish_date>
    <description>An in-depth look at creating applications with XML.</description>
  </book>
  <book id="bk102">
    <author>Ralls, Kim</author>
    <title>Midnight Rain</title>
    <genre>Fantasy</genre>
    <price>5.95</price>
    <publish_date>2000-12-16</publish_date>
    <description>A former architect battles corporate zombies.</description>
  </book>
</catalog>`;
            setValue(sample);
            handleChange(sample);
          }}
          className="text-sm font-semibold flex items-center justify-center gap-1.5 transition-opacity hover:opacity-80"
          style={{ color: "#988d9f" }}
        >
          <span className="material-symbols-outlined text-[16px]">auto_awesome</span>
          Load sample XML
        </button>
      )}
    </div>
  );
}
