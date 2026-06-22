"use client";

import { useState, useRef, useCallback, useEffect, useId } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────
type NotifType = "success" | "error" | "info";

interface ValidationError {
  line:    number | null;
  col:     number | null;
  message: string;
  raw:     string;
}

interface ValidationResult {
  valid:    boolean;
  errors:   ValidationError[];
  doc:      Document | null;
}

// ─── XML helpers ──────────────────────────────────────────────────────────────
function extractErrors(errEl: Element, _src: string): ValidationError[] {
  const raw  = errEl.textContent ?? "";
  const msgs = raw.split(/\n/).map(l => l.trim()).filter(Boolean);

  const errors: ValidationError[] = [];
  for (const msg of msgs) {
    if (msg.startsWith("<")) continue;               // skip embedded XML
    const lineM = msg.match(/[Ll]ine[:\s#]*(\d+)/);
    const colM  = msg.match(/[Cc]ol(?:umn)?[:\s#]*(\d+)/);
    const line  = lineM ? Number(lineM[1]) : null;
    const col   = colM  ? Number(colM[1])  : null;
    // Normalise the human-readable part
    const clean = msg
      .replace(/error on line \d+(, column \d+)?:/i, "")
      .replace(/at line \d+(, column \d+)?/i, "")
      .replace(/\[.*?\]/g, "")
      .trim();
    if (clean) errors.push({ line, col, message: clean || msg, raw: msg });
  }

  // If we couldn't parse individual lines, return one consolidated error
  if (errors.length === 0) {
    const lineM = raw.match(/[Ll]ine[:\s#]*(\d+)/);
    const colM  = raw.match(/[Cc]ol(?:umn)?[:\s#]*(\d+)/);
    errors.push({
      line: lineM ? Number(lineM[1]) : null,
      col:  colM  ? Number(colM[1])  : null,
      message: raw.replace(/\s+/g, " ").trim(),
      raw,
    });
  }
  return errors;
}

function validateXml(text: string): ValidationResult {
  if (!text.trim()) return { valid: false, errors: [], doc: null };
  const parser = new DOMParser();
  const doc    = parser.parseFromString(text, "application/xml");
  const errEl  = doc.querySelector("parsererror");
  if (errEl) {
    return { valid: false, errors: extractErrors(errEl, text), doc: null };
  }
  return { valid: true, errors: [], doc };
}

// Minimal XML beautifier (same logic as XmlFormatterTool)
function escXml(s: string)  { return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }
function escAttr(s: string) { return s.replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/</g,"&lt;"); }

function serializeNode(node: Node, indent: string, depth: number): string {
  const pad = indent.repeat(depth);
  if (node.nodeType === Node.TEXT_NODE) {
    const text = (node.textContent ?? "").replace(/[\r\n]/g, " ").trim();
    return text ? `${pad}${escXml(text)}` : "";
  }
  if (node.nodeType === Node.CDATA_SECTION_NODE)
    return `${pad}<![CDATA[${node.textContent ?? ""}]]>`;
  if (node.nodeType === Node.COMMENT_NODE)
    return `${pad}<!--${node.textContent ?? ""}-->`;
  if (node.nodeType === Node.PROCESSING_INSTRUCTION_NODE) {
    const pi = node as ProcessingInstruction;
    return `${pad}<?${pi.target} ${pi.data}?>`;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return "";

  const el    = node as Element;
  const tag   = el.tagName;
  const attrs = Array.from(el.attributes).map(a => ` ${a.name}="${escAttr(a.value)}"`).join("");
  const children = Array.from(el.childNodes)
    .map(c => serializeNode(c, indent, depth + 1))
    .filter(s => s !== "");

  if (children.length === 0) return `${pad}<${tag}${attrs}/>`;
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

function prettyPrint(text: string): string | null {
  const { doc } = validateXml(text);
  if (!doc) return null;
  const indent = "  ";
  const lines: string[] = [];
  const decl = text.trim().match(/^<\?xml[^?>]*\?>/i);
  if (decl) lines.push(decl[0]);
  for (const child of Array.from(doc.childNodes)) {
    if (child.nodeType === Node.PROCESSING_INSTRUCTION_NODE &&
        (child as ProcessingInstruction).target.toLowerCase() === "xml") continue;
    const s = serializeNode(child, indent, 0);
    if (s) lines.push(s);
  }
  return lines.join("\n");
}

function downloadFile(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ─── CodeMirror editor (lazy, reuses existing @codemirror/lang-html) ─────────
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
      const { EditorState }                               = await import("@codemirror/state");
      const { defaultKeymap, historyKeymap, history }    = await import("@codemirror/commands");
      const { html }                                      = await import("@codemirror/lang-html");
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
        ".cm-content":   { padding: "12px 0", caretColor: "#adc6ff", minHeight: "300px" },
        ".cm-line":      { padding: "0 16px" },
        ".cm-cursor":    { borderLeftColor: "#adc6ff" },
        ".cm-activeLine":       { backgroundColor: "rgba(173,198,255,0.04)" },
        ".cm-activeLineGutter": { backgroundColor: "rgba(173,198,255,0.07)" },
        ".cm-gutters":          { backgroundColor: "rgba(0,0,0,0.2)", borderRight: "1px solid rgba(255,255,255,0.06)", color: "#4d4354" },
        ".cm-lineNumbers .cm-gutterElement": { padding: "0 8px" },
        ".cm-selectionBackground, ::selection": { backgroundColor: "rgba(173,198,255,0.18) !important" },
        "&.cm-focused .cm-selectionBackground": { backgroundColor: "rgba(173,198,255,0.18)" },
        ".tok-tagName":         { color: "#adc6ff" },
        ".tok-angleBracket":    { color: "#6e8aaf" },
        ".tok-attributeName":   { color: "#80e0a0" },
        ".tok-attributeValue":  { color: "#4cd7f6" },
        ".tok-string":          { color: "#4cd7f6" },
        ".tok-comment":         { color: "#4d4354", fontStyle: "italic" },
        ".tok-processingInstruction": { color: "#ddb7ff" },
        ".tok-meta":            { color: "#ddb7ff" },
        ".tok-punctuation":     { color: "#6e8aaf" },
        ".tok-content":         { color: "#c8b89f" },
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
          EditorView.updateListener.of(update => {
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

// ─── Error card ───────────────────────────────────────────────────────────────
function ErrorCard({ err, index }: { err: ValidationError; index: number }) {
  return (
    <div
      className="flex items-start gap-3 px-4 py-3 rounded-xl"
      style={{ background: "rgba(255,100,100,0.06)", border: "1px solid rgba(255,100,100,0.18)" }}
    >
      <div
        className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5"
        style={{ background: "rgba(255,100,100,0.15)" }}
      >
        <span className="text-[11px] font-black" style={{ color: "#ff8080" }}>{index + 1}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] leading-relaxed" style={{ color: "#fca5a5" }}>
          {err.message}
        </p>
        {(err.line !== null || err.col !== null) && (
          <div className="flex gap-2 mt-1.5 flex-wrap">
            {err.line !== null && (
              <span
                className="text-[10px] font-bold px-2 py-0.5 rounded-md"
                style={{ background: "rgba(255,100,100,0.12)", color: "#ff8080" }}
              >
                Line {err.line}
              </span>
            )}
            {err.col !== null && (
              <span
                className="text-[10px] font-bold px-2 py-0.5 rounded-md"
                style={{ background: "rgba(255,100,100,0.12)", color: "#ff8080" }}
              >
                Col {err.col}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function XmlValidatorTool() {
  const uid = useId();

  const [raw,     setRaw]     = useState("");
  const [result,  setResult]  = useState<ValidationResult | null>(null);
  const [notif,   setNotif]   = useState<{ type: NotifType; message: string } | null>(null);
  const [copied,  setCopied]  = useState(false);

  const editorContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef       = useRef<HTMLInputElement>(null);

  const notify = useCallback((type: NotifType, msg: string) => {
    setNotif({ type, message: msg });
    setTimeout(() => setNotif(null), 5000);
  }, []);

  // ── Validate on every change ──────────────────────────────────────────────
  const handleChange = useCallback((text: string) => {
    setRaw(text);
    if (!text.trim()) { setResult(null); return; }
    setResult(validateXml(text));
  }, []);

  const { setValue } = useCodeMirror(editorContainerRef, raw, handleChange);

  // ── Actions ───────────────────────────────────────────────────────────────
  const doPrettyPrint = useCallback(() => {
    const formatted = prettyPrint(raw);
    if (formatted === null) { notify("error", "Cannot pretty print — fix XML errors first."); return; }
    setValue(formatted);
    handleChange(formatted);
    notify("success", "XML pretty printed.");
  }, [raw, setValue, handleChange, notify]);

  const doCopy = useCallback(async () => {
    if (!raw.trim()) { notify("error", "Nothing to copy."); return; }
    await navigator.clipboard.writeText(raw);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [raw, notify]);

  const doDownloadXml = useCallback(() => {
    if (!raw.trim()) { notify("error", "Nothing to download."); return; }
    downloadFile(raw, "document.xml", "application/xml");
    notify("success", "Downloaded document.xml.");
  }, [raw, notify]);

  const doExportReport = useCallback(() => {
    if (!result) { notify("error", "Validate some XML first."); return; }
    const report = {
      validatedAt: new Date().toISOString(),
      valid:  result.valid,
      errors: result.errors.map(e => ({ line: e.line, column: e.col, message: e.message })),
      summary: result.valid
        ? "XML is well-formed and valid."
        : `${result.errors.length} error${result.errors.length === 1 ? "" : "s"} found.`,
    };
    downloadFile(JSON.stringify(report, null, 2), "validation-report.json", "application/json");
    notify("success", "Exported validation-report.json.");
  }, [result, notify]);

  const doExportTxt = useCallback(() => {
    if (!result) { notify("error", "Validate some XML first."); return; }
    const lines = [
      `XML Validation Report`,
      `Generated: ${new Date().toLocaleString()}`,
      `Status: ${result.valid ? "VALID" : "INVALID"}`,
      "",
      result.valid
        ? "✓ XML is well-formed and valid."
        : `${result.errors.length} error${result.errors.length === 1 ? "" : "s"} found:`,
      "",
      ...result.errors.map((e, i) =>
        `[${i + 1}] ${e.message}${e.line !== null ? ` (line ${e.line}${e.col !== null ? `, col ${e.col}` : ""})` : ""}`
      ),
    ];
    downloadFile(lines.join("\n"), "validation-report.txt", "text/plain");
    notify("success", "Exported validation-report.txt.");
  }, [result, notify]);

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
    setResult(null);
    setNotif(null);
  }, [setValue, handleChange]);

  // ── Derived ───────────────────────────────────────────────────────────────
  const isEmpty   = !raw.trim();
  const isValid   = result?.valid === true;
  const isInvalid = result?.valid === false;
  const lineCount = raw ? raw.split("\n").length : 0;
  const sizeKb    = raw ? (new Blob([raw]).size / 1024).toFixed(1) : "0";

  let elementCount = 0;
  if (isValid && result?.doc) {
    elementCount = result.doc.querySelectorAll("*").length;
  }

  const uploadId = `${uid}-upload`;

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="mb-12 flex flex-col gap-4">

      {/* Toolbar */}
      <div
        className="glass-panel rounded-2xl p-3 flex flex-wrap items-center gap-2"
        style={{ border: "1px solid rgba(255,255,255,0.06)" }}
      >
        {/* Pretty Print */}
        <button
          onClick={doPrettyPrint}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[13px] font-semibold transition-all"
          style={{ background: "rgba(173,198,255,0.12)", color: "#adc6ff", border: "1px solid rgba(173,198,255,0.25)" }}
        >
          <span className="material-symbols-outlined text-[15px]">format_indent_increase</span>
          Pretty Print
        </button>

        <div className="w-px h-6 mx-1" style={{ background: "rgba(255,255,255,0.08)" }} />

        {/* Copy */}
        <button
          onClick={doCopy}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[13px] font-semibold transition-all"
          style={{ background: "rgba(255,255,255,0.05)", color: copied ? "#80e0a0" : "#988d9f", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          <span className="material-symbols-outlined text-[15px]">{copied ? "check" : "content_copy"}</span>
          {copied ? "Copied!" : "Copy XML"}
        </button>

        {/* Download XML */}
        <button
          onClick={doDownloadXml}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[13px] font-semibold transition-all"
          style={{ background: "rgba(255,255,255,0.05)", color: "#988d9f", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          <span className="material-symbols-outlined text-[15px]">download</span>
          Download XML
        </button>

        {/* Upload */}
        <label
          htmlFor={uploadId}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[13px] font-semibold cursor-pointer transition-all"
          style={{ background: "rgba(255,255,255,0.05)", color: "#988d9f", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          <span className="material-symbols-outlined text-[15px]">upload_file</span>
          Upload XML
          <input
            ref={fileInputRef} id={uploadId} type="file"
            accept=".xml,application/xml,text/xml"
            className="hidden" onChange={doUpload}
          />
        </label>

        <div className="w-px h-6 mx-1" style={{ background: "rgba(255,255,255,0.08)" }} />

        {/* Export report */}
        <button
          onClick={doExportTxt}
          disabled={!result}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[13px] font-semibold transition-all disabled:opacity-40"
          style={{ background: "rgba(255,255,255,0.05)", color: "#988d9f", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          <span className="material-symbols-outlined text-[15px]">description</span>
          Export TXT
        </button>

        <button
          onClick={doExportReport}
          disabled={!result}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[13px] font-semibold transition-all disabled:opacity-40"
          style={{ background: "rgba(255,255,255,0.05)", color: "#988d9f", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          <span className="material-symbols-outlined text-[15px]">data_object</span>
          Export JSON
        </button>

        <div className="w-px h-6 mx-1" style={{ background: "rgba(255,255,255,0.08)" }} />

        {/* Reset */}
        <button
          onClick={doClear}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[13px] font-semibold transition-all"
          style={{ background: "rgba(255,100,100,0.08)", color: "#ff8080", border: "1px solid rgba(255,100,100,0.15)" }}
        >
          <span className="material-symbols-outlined text-[15px]">delete_sweep</span>
          Reset
        </button>
      </div>

      {/* Notification */}
      {notif && (
        <div
          className="flex items-start gap-3 p-3 rounded-2xl text-sm font-medium"
          style={{
            background: notif.type === "error" ? "rgba(255,100,100,0.1)" : notif.type === "success" ? "rgba(100,220,150,0.1)" : "rgba(173,198,255,0.1)",
            border: `1px solid ${notif.type === "error" ? "rgba(255,100,100,0.25)" : notif.type === "success" ? "rgba(100,220,150,0.25)" : "rgba(173,198,255,0.25)"}`,
            color:  notif.type === "error" ? "#ff8080" : notif.type === "success" ? "#80e0a0" : "#adc6ff",
          }}
        >
          <span className="material-symbols-outlined text-[16px] mt-0.5 shrink-0">
            {notif.type === "error" ? "error" : notif.type === "success" ? "check_circle" : "info"}
          </span>
          <span className="flex-1">{notif.message}</span>
          <button onClick={() => setNotif(null)} className="opacity-60 hover:opacity-100">
            <span className="material-symbols-outlined text-[14px]">close</span>
          </button>
        </div>
      )}

      {/* Validation summary banner */}
      {result && (
        <div
          className="flex items-center gap-3 px-5 py-4 rounded-2xl"
          style={{
            background: isValid ? "rgba(34,197,94,0.07)" : "rgba(255,100,100,0.07)",
            border: `1px solid ${isValid ? "rgba(34,197,94,0.25)" : "rgba(255,100,100,0.25)"}`,
          }}
        >
          <span
            className="material-symbols-outlined text-[28px] shrink-0"
            style={{ color: isValid ? "#22c55e" : "#ff8080", fontVariationSettings: "'FILL' 1" }}
          >
            {isValid ? "verified" : "cancel"}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-[15px] font-bold" style={{ color: isValid ? "#22c55e" : "#ff8080" }}>
              {isValid ? "Valid XML" : `Invalid XML — ${result.errors.length} error${result.errors.length === 1 ? "" : "s"} found`}
            </p>
            <p className="text-[12px] mt-0.5" style={{ color: "#988d9f" }}>
              {isValid
                ? "Document is well-formed and parses successfully."
                : "Fix the errors below before using this XML in production."}
            </p>
          </div>
          {/* Quick stats */}
          <div className="flex gap-3 shrink-0 flex-wrap justify-end">
            <div className="flex flex-col items-end">
              <span className="text-[18px] font-black tabular-nums" style={{ color: isValid ? "#22c55e" : "#ff8080" }}>
                {isValid ? "0" : result.errors.length}
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "#988d9f" }}>
                {result.errors.length === 1 ? "Error" : "Errors"}
              </span>
            </div>
            {isValid && elementCount > 0 && (
              <div className="flex flex-col items-end">
                <span className="text-[18px] font-black tabular-nums" style={{ color: "#adc6ff" }}>{elementCount}</span>
                <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "#988d9f" }}>Elements</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Editor */}
      <div
        className="glass-panel rounded-2xl overflow-hidden relative"
        style={{
          border: `1px solid ${isInvalid ? "rgba(255,100,100,0.3)" : isValid ? "rgba(34,197,94,0.2)" : "rgba(255,255,255,0.06)"}`,
          minHeight: "420px",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {isEmpty && (
          <div
            className="absolute inset-0 flex items-center justify-center pointer-events-none select-none"
            style={{ color: "#4d4354", zIndex: 1 }}
          >
            <div className="text-center px-6">
              <span className="material-symbols-outlined text-[40px] block mb-2">task_alt</span>
              Paste or type XML here to validate, or upload a .xml file
            </div>
          </div>
        )}
        <div
          ref={editorContainerRef}
          className="flex-1"
          style={{ minHeight: "420px", position: "relative" }}
        />
      </div>

      {/* Error list */}
      {isInvalid && result.errors.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-[12px] font-bold uppercase tracking-wider px-1" style={{ color: "#ff8080" }}>
            Validation Errors ({result.errors.length})
          </p>
          {result.errors.map((err, i) => (
            <ErrorCard key={i} err={err} index={i} />
          ))}
        </div>
      )}

      {/* Stats footer */}
      {!isEmpty && (
        <div className="flex flex-wrap gap-3">
          {[
            { label: "Lines",    value: lineCount.toLocaleString(),    show: true },
            { label: "Size",     value: `${sizeKb} KB`,                show: true },
            { label: "Status",   value: isEmpty ? "—" : isValid ? "Valid" : "Invalid", show: !isEmpty, color: isValid ? "#22c55e" : "#ff8080" },
            { label: "Elements", value: elementCount.toLocaleString(), show: isValid && elementCount > 0 },
          ].filter(s => s.show).map(({ label, value, color }) => (
            <div
              key={label}
              className="glass-panel rounded-xl px-4 py-2 flex flex-col gap-0.5"
              style={{ border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <span className="text-base font-bold tabular-nums" style={{ color: color ?? "#adc6ff" }}>{value}</span>
              <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "#988d9f" }}>{label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Sample XML */}
      {isEmpty && (
        <button
          onClick={() => {
            const sample = `<?xml version="1.0" encoding="UTF-8"?>
<library>
  <book isbn="978-0-06-112008-4">
    <title>To Kill a Mockingbird</title>
    <author>Harper Lee</author>
    <year>1960</year>
    <genre>Fiction</genre>
  </book>
  <book isbn="978-0-7432-7356-5">
    <title>1984</title>
    <author>George Orwell</author>
    <year>1949</year>
    <genre>Dystopian Fiction</genre>
  </book>
</library>`;
            setValue(sample);
            handleChange(sample);
          }}
          className="text-sm font-semibold flex items-center justify-center gap-1.5 transition-opacity hover:opacity-80"
          style={{ color: "#988d9f" }}
        >
          <span className="material-symbols-outlined text-[16px]">auto_awesome</span>
          Load sample valid XML
        </button>
      )}
    </div>
  );
}
