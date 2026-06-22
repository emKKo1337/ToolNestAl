"use client";

import { useState, useRef, useCallback, useEffect, useId } from "react";
import { format as sqlFormat } from "sql-formatter";

// ─── Types ────────────────────────────────────────────────────────────────────
type SqlDialect     = "auto" | "mysql" | "postgresql" | "sqlite" | "tsql" | "plsql";
type KeywordCase    = "upper" | "lower" | "preserve";
type IndentStyle    = "2" | "4" | "tab";
type NotifType      = "success" | "error" | "info";

// ─── Dialect metadata ─────────────────────────────────────────────────────────
const DIALECTS: { value: SqlDialect; label: string; badge: string }[] = [
  { value: "auto",       label: "Auto Detect",  badge: "AUTO"  },
  { value: "mysql",      label: "MySQL",         badge: "MySQL" },
  { value: "postgresql", label: "PostgreSQL",    badge: "PG"    },
  { value: "sqlite",     label: "SQLite",        badge: "SQLite"},
  { value: "tsql",       label: "SQL Server",    badge: "T-SQL" },
  { value: "plsql",      label: "Oracle",        badge: "PL/SQL"},
];

// ─── Auto-detect heuristics ───────────────────────────────────────────────────
function detectDialect(sql: string): Exclude<SqlDialect, "auto"> {
  const u = sql.toUpperCase();
  if (/\bAUTO_INCREMENT\b|\bENGINE\s*=|\bTINYINT\b|\bMEDIUMINT\b/.test(u)) return "mysql";
  if (/\bSERIAL\b|\bILIKE\b|\bRETURNING\b|\$\$|\bPGSQL\b/.test(u))          return "postgresql";
  if (/\bAUTOINCREMENT\b|\bBEGIN TRANSACTION\b/.test(u) &&
      !/\bIDENTITY\s*\(/.test(u))                                              return "sqlite";
  if (/\bNVARCHAR\b|\bNOCOUNT\b|\bIDENTITY\s*\(|\bTOP\s+\d+\b|\bGO\b/.test(u)) return "tsql";
  if (/\bROWNUM\b|\bNVL\s*\(|\bVARCHAR2\b|\bCONNECT BY\b|\bNUMBER\s*\(/.test(u)) return "plsql";
  return "sql" as Exclude<SqlDialect, "auto">;
}

// ─── Format helpers ───────────────────────────────────────────────────────────
function resolveDialect(sql: string, dialect: SqlDialect): Exclude<SqlDialect, "auto"> {
  return dialect === "auto" ? detectDialect(sql) : dialect;
}

// sql-formatter uses 'sql' for generic Standard SQL
type FmtLang = "mysql" | "postgresql" | "sqlite" | "tsql" | "plsql" | "sql";
function toFmtLang(d: Exclude<SqlDialect, "auto">): FmtLang {
  return (d as FmtLang);
}

function beautifySql(
  sql: string,
  dialect: SqlDialect,
  keywordCase: KeywordCase,
  indent: IndentStyle,
): { result: string; usedDialect: Exclude<SqlDialect, "auto"> } {
  const used = resolveDialect(sql, dialect);
  const tabWidth = indent === "tab" ? 2 : Number(indent);
  const useTabs  = indent === "tab";
  const result = sqlFormat(sql, {
    language:    toFmtLang(used),
    tabWidth,
    useTabs,
    keywordCase: keywordCase === "preserve" ? undefined : keywordCase,
    linesBetweenQueries: 2,
  });
  return { result, usedDialect: used };
}

function minifySql(sql: string): string {
  return sql
    .replace(/--[^\n]*/g, "")           // strip line comments
    .replace(/\/\*[\s\S]*?\*\//g, "")   // strip block comments
    .replace(/\s+/g, " ")               // collapse whitespace
    .trim();
}

function countStatements(sql: string): number {
  // count semicolons not inside strings as a rough statement count
  const cleaned = sql.replace(/'[^']*'/g, "''").replace(/"[^"]*"/g, '""');
  const semis   = (cleaned.match(/;/g) ?? []).length;
  return semis || 1;
}

function downloadFile(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url  = URL.createObjectURL(blob);
  Object.assign(document.createElement("a"), { href: url, download: filename }).click();
  URL.revokeObjectURL(url);
}

// ─── CodeMirror editor ────────────────────────────────────────────────────────
function useCodeMirror(
  containerRef: React.RefObject<HTMLDivElement | null>,
  initialValue: string,
  onChange: (val: string) => void,
  dialect: SqlDialect,
) {
  const viewRef     = useRef<{ view: import("@codemirror/view").EditorView } | null>(null);
  const dialectRef  = useRef(dialect);
  dialectRef.current = dialect;

  useEffect(() => {
    let cancelled = false;

    async function mount() {
      const {
        EditorView, keymap, drawSelection,
        highlightActiveLine, lineNumbers, highlightActiveLineGutter,
      } = await import("@codemirror/view");
      const { EditorState }                                = await import("@codemirror/state");
      const { defaultKeymap, historyKeymap, history }     = await import("@codemirror/commands");
      const { sql, MySQL, PostgreSQL, SQLite, MSSQL, StandardSQL } = await import("@codemirror/lang-sql");
      const { syntaxHighlighting, defaultHighlightStyle } = await import("@codemirror/language");

      if (cancelled || !containerRef.current) return;

      function getDialectLang() {
        const d = dialectRef.current;
        if (d === "mysql")      return sql({ dialect: MySQL });
        if (d === "postgresql") return sql({ dialect: PostgreSQL });
        if (d === "sqlite")     return sql({ dialect: SQLite });
        if (d === "tsql")       return sql({ dialect: MSSQL });
        return sql({ dialect: StandardSQL });
      }

      const theme = EditorView.theme({
        "&": {
          backgroundColor: "transparent",
          color: "#e8dff0",
          height: "100%",
          fontSize: "13px",
          fontFamily: "'JetBrains Mono','Fira Code','Cascadia Code',Consolas,monospace",
        },
        ".cm-scroller":  { overflow: "auto", height: "100%" },
        ".cm-content":   { padding: "12px 0", caretColor: "#adc6ff", minHeight: "320px" },
        ".cm-line":      { padding: "0 16px" },
        ".cm-cursor":    { borderLeftColor: "#adc6ff" },
        ".cm-activeLine":       { backgroundColor: "rgba(173,198,255,0.04)" },
        ".cm-activeLineGutter": { backgroundColor: "rgba(173,198,255,0.07)" },
        ".cm-gutters":          {
          backgroundColor: "rgba(0,0,0,0.2)",
          borderRight: "1px solid rgba(255,255,255,0.06)",
          color: "#4d4354",
        },
        ".cm-lineNumbers .cm-gutterElement": { padding: "0 8px" },
        ".cm-selectionBackground, ::selection": { backgroundColor: "rgba(173,198,255,0.18) !important" },
        "&.cm-focused .cm-selectionBackground": { backgroundColor: "rgba(173,198,255,0.18)" },
        // SQL token colours
        ".tok-keyword":        { color: "#adc6ff", fontWeight: "600" },
        ".tok-typeName":       { color: "#80e0a0" },
        ".tok-number":         { color: "#80e0a0" },
        ".tok-string":         { color: "#4cd7f6" },
        ".tok-string2":        { color: "#4cd7f6" },
        ".tok-comment":        { color: "#4d4354", fontStyle: "italic" },
        ".tok-variableName":   { color: "#ddb7ff" },
        ".tok-operator":       { color: "#c8b89f" },
        ".tok-punctuation":    { color: "#6e8aaf" },
        ".tok-name":           { color: "#e8dff0" },
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
          getDialectLang(),
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

// ─── Sub-components ───────────────────────────────────────────────────────────
function DialectBadge({ dialect }: { dialect: Exclude<SqlDialect, "auto"> | null }) {
  if (!dialect) return null;
  const meta = DIALECTS.find(d => d.value === dialect);
  if (!meta || dialect === ("sql" as SqlDialect)) return null;
  return (
    <span
      className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider"
      style={{
        background: "rgba(173,198,255,0.12)",
        color: "#adc6ff",
        border: "1px solid rgba(173,198,255,0.25)",
      }}
    >
      {meta.badge}
    </span>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function SqlFormatterTool() {
  const uid = useId();

  const [raw,          setRaw]          = useState("");
  const [dialect,      setDialect]      = useState<SqlDialect>("auto");
  const [keywordCase,  setKeywordCase]  = useState<KeywordCase>("upper");
  const [indentStyle,  setIndentStyle]  = useState<IndentStyle>("2");
  const [usedDialect,  setUsedDialect]  = useState<Exclude<SqlDialect, "auto"> | null>(null);
  const [notif,        setNotif]        = useState<{ type: NotifType; message: string } | null>(null);
  const [copied,       setCopied]       = useState(false);
  const [formatError,  setFormatError]  = useState<string | null>(null);

  const editorContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef       = useRef<HTMLInputElement>(null);

  const notify = useCallback((type: NotifType, msg: string) => {
    setNotif({ type, message: msg });
    if (type !== "info") setTimeout(() => setNotif(null), 5000);
  }, []);

  const handleChange = useCallback((text: string) => {
    setRaw(text);
    setFormatError(null);
  }, []);

  const { setValue } = useCodeMirror(editorContainerRef, raw, handleChange, dialect);

  // ── Actions ───────────────────────────────────────────────────────────────
  const doBeautify = useCallback(() => {
    if (!raw.trim()) { notify("error", "Paste a SQL query first."); return; }
    try {
      const { result, usedDialect: ud } = beautifySql(raw, dialect, keywordCase, indentStyle);
      setValue(result);
      handleChange(result);
      setUsedDialect(ud);
      setFormatError(null);
      notify("success", `SQL formatted${dialect === "auto" ? ` (detected: ${DIALECTS.find(d => d.value === ud)?.label ?? ud})` : ""}.`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Formatting failed.";
      setFormatError(msg);
      notify("error", `Formatting error: ${msg}`);
    }
  }, [raw, dialect, keywordCase, indentStyle, setValue, handleChange, notify]);

  const doMinify = useCallback(() => {
    if (!raw.trim()) { notify("error", "Paste a SQL query first."); return; }
    const result = minifySql(raw);
    setValue(result);
    handleChange(result);
    setUsedDialect(null);
    notify("success", "SQL minified.");
  }, [raw, setValue, handleChange, notify]);

  const doCopy = useCallback(async () => {
    if (!raw.trim()) { notify("error", "Nothing to copy."); return; }
    await navigator.clipboard.writeText(raw);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [raw, notify]);

  const doDownload = useCallback(() => {
    if (!raw.trim()) { notify("error", "Nothing to download."); return; }
    downloadFile(raw, "query.sql", "text/plain");
    notify("success", "Downloaded query.sql.");
  }, [raw, notify]);

  const doUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext !== "sql" && ext !== "txt" && !file.type.startsWith("text/")) {
      notify("error", "Please upload a .sql or .txt file.");
      return;
    }
    const reader = new FileReader();
    reader.onload = ev => {
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
    setUsedDialect(null);
    setFormatError(null);
    setNotif(null);
  }, [setValue, handleChange]);

  // ── Derived ───────────────────────────────────────────────────────────────
  const isEmpty   = !raw.trim();
  const lineCount = raw ? raw.split("\n").length : 0;
  const sizeKb    = raw ? (new Blob([raw]).size / 1024).toFixed(1) : "0";
  const stmtCount = isEmpty ? 0 : countStatements(raw);

  const uploadId = `${uid}-upload`;

  const INDENT_OPTIONS: { value: IndentStyle; label: string }[] = [
    { value: "2",   label: "2 spaces" },
    { value: "4",   label: "4 spaces" },
    { value: "tab", label: "Tabs"     },
  ];

  const KEYWORD_OPTIONS: { value: KeywordCase; label: string }[] = [
    { value: "upper",    label: "UPPER"    },
    { value: "lower",    label: "lower"    },
    { value: "preserve", label: "Preserve" },
  ];

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="mb-12 flex flex-col gap-4">

      {/* ── Top toolbar ──────────────────────────────────────────── */}
      <div
        className="glass-panel rounded-2xl p-3 flex flex-wrap items-center gap-2"
        style={{ border: "1px solid rgba(255,255,255,0.06)" }}
      >
        {/* Beautify */}
        <button
          onClick={doBeautify}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[13px] font-semibold transition-all"
          style={{ background: "rgba(173,198,255,0.12)", color: "#adc6ff", border: "1px solid rgba(173,198,255,0.25)" }}
        >
          <span className="material-symbols-outlined text-[15px]">format_indent_increase</span>
          Beautify
        </button>

        {/* Minify */}
        <button
          onClick={doMinify}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[13px] font-semibold transition-all"
          style={{ background: "rgba(76,215,246,0.1)", color: "#4cd7f6", border: "1px solid rgba(76,215,246,0.2)" }}
        >
          <span className="material-symbols-outlined text-[15px]">compress</span>
          Minify
        </button>

        <div className="w-px h-6 mx-1" style={{ background: "rgba(255,255,255,0.08)" }} />

        {/* Dialect selector */}
        <div className="relative">
          <select
            value={dialect}
            onChange={e => setDialect(e.target.value as SqlDialect)}
            aria-label="SQL dialect"
            className="appearance-none text-[12px] font-semibold pl-3 pr-7 py-2 rounded-xl cursor-pointer outline-none transition-all"
            style={{
              background: "rgba(255,255,255,0.05)",
              color: "#e8dff0",
              border: "1px solid rgba(255,255,255,0.1)",
            }}
          >
            {DIALECTS.map(d => (
              <option key={d.value} value={d.value} style={{ background: "#1e1a24" }}>
                {d.label}
              </option>
            ))}
          </select>
          <span
            className="material-symbols-outlined text-[14px] absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ color: "#988d9f" }}
          >
            expand_more
          </span>
        </div>

        {/* Keyword case */}
        <div className="flex rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
          {KEYWORD_OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setKeywordCase(value)}
              className="px-3 py-2 text-[11px] font-semibold transition-all"
              style={{
                background: keywordCase === value ? "rgba(173,198,255,0.15)" : "rgba(255,255,255,0.03)",
                color:      keywordCase === value ? "#adc6ff"                : "#988d9f",
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Indent */}
        <div className="flex rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
          {INDENT_OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setIndentStyle(value)}
              className="px-3 py-2 text-[11px] font-semibold transition-all"
              style={{
                background: indentStyle === value ? "rgba(173,198,255,0.15)" : "rgba(255,255,255,0.03)",
                color:      indentStyle === value ? "#adc6ff"                : "#988d9f",
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="w-px h-6 mx-1" style={{ background: "rgba(255,255,255,0.08)" }} />

        {/* Copy */}
        <button
          onClick={doCopy}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[13px] font-semibold transition-all"
          style={{
            background: "rgba(255,255,255,0.05)",
            color: copied ? "#80e0a0" : "#988d9f",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <span className="material-symbols-outlined text-[15px]">{copied ? "check" : "content_copy"}</span>
          {copied ? "Copied!" : "Copy"}
        </button>

        {/* Download */}
        <button
          onClick={doDownload}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[13px] font-semibold transition-all"
          style={{ background: "rgba(255,255,255,0.05)", color: "#988d9f", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          <span className="material-symbols-outlined text-[15px]">download</span>
          Download
        </button>

        {/* Upload */}
        <label
          htmlFor={uploadId}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[13px] font-semibold cursor-pointer transition-all"
          style={{ background: "rgba(255,255,255,0.05)", color: "#988d9f", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          <span className="material-symbols-outlined text-[15px]">upload_file</span>
          Upload
          <input
            ref={fileInputRef}
            id={uploadId}
            type="file"
            accept=".sql,.txt,text/plain"
            className="hidden"
            onChange={doUpload}
          />
        </label>

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

      {/* Dialect detection badge */}
      {usedDialect && (
        <div
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold w-fit"
          style={{ background: "rgba(173,198,255,0.08)", border: "1px solid rgba(173,198,255,0.18)", color: "#adc6ff" }}
        >
          <span className="material-symbols-outlined text-[14px]">language</span>
          Formatted as: <DialectBadge dialect={usedDialect} />
          <span style={{ color: "#988d9f", fontWeight: 400 }}>
            {DIALECTS.find(d => d.value === usedDialect)?.label ?? usedDialect}
          </span>
        </div>
      )}

      {/* Format error */}
      {formatError && (
        <div
          className="flex items-start gap-2 px-4 py-3 rounded-xl text-[12px]"
          style={{ background: "rgba(255,100,100,0.07)", border: "1px solid rgba(255,100,100,0.2)", color: "#fca5a5" }}
        >
          <span className="material-symbols-outlined text-[14px] mt-0.5 shrink-0">error</span>
          <span className="break-all leading-relaxed">{formatError}</span>
        </div>
      )}

      {/* Editor */}
      <div
        className="glass-panel rounded-2xl overflow-hidden relative"
        style={{
          border: "1px solid rgba(255,255,255,0.06)",
          minHeight: "440px",
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
              <span className="material-symbols-outlined text-[40px] block mb-2">table</span>
              Paste or type SQL here, or upload a .sql file
            </div>
          </div>
        )}
        <div
          ref={editorContainerRef}
          className="flex-1"
          style={{ minHeight: "440px", position: "relative" }}
        />
      </div>

      {/* Stats */}
      {!isEmpty && (
        <div className="flex flex-wrap gap-3">
          {[
            { label: "Lines",      value: lineCount.toLocaleString()  },
            { label: "Characters", value: raw.length.toLocaleString() },
            { label: "Size",       value: `${sizeKb} KB`             },
            { label: "Statements", value: stmtCount.toLocaleString() },
          ].map(({ label, value }) => (
            <div
              key={label}
              className="glass-panel rounded-xl px-4 py-2 flex flex-col gap-0.5"
              style={{ border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <span className="text-base font-bold tabular-nums" style={{ color: "#adc6ff" }}>{value}</span>
              <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "#988d9f" }}>{label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Sample SQL */}
      {isEmpty && (
        <button
          onClick={() => {
            const sample = `-- E-commerce order summary query
SELECT
  u.id AS user_id,
  u.email,
  COUNT(o.id) AS total_orders,
  SUM(o.total_amount) AS lifetime_value,
  MAX(o.created_at) AS last_order_date
FROM users u
LEFT JOIN orders o ON o.user_id = u.id
WHERE u.created_at >= '2024-01-01'
  AND u.status = 'active'
GROUP BY u.id, u.email
HAVING COUNT(o.id) > 0
ORDER BY lifetime_value DESC
LIMIT 100;`;
            setValue(sample);
            handleChange(sample);
          }}
          className="text-sm font-semibold flex items-center justify-center gap-1.5 transition-opacity hover:opacity-80"
          style={{ color: "#988d9f" }}
        >
          <span className="material-symbols-outlined text-[16px]">auto_awesome</span>
          Load sample SQL
        </button>
      )}
    </div>
  );
}
