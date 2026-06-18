"use client";

import { useState, useCallback, useId } from "react";

type Mode      = "encode" | "decode";
type NotifType = "success" | "error" | "info";

function encodeUrl(text: string): string  { return encodeURIComponent(text); }
function decodeUrl(text: string): string  { return decodeURIComponent(text); }

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  return `${(n / 1024).toFixed(1)} KB`;
}

function CopyBtn({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = useCallback(async () => {
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [text]);
  return (
    <button onClick={copy} title={label}
      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[12px] font-semibold transition-all"
      style={{ background: "rgba(255,255,255,0.05)", color: copied ? "#80e0a0" : "#988d9f", border: "1px solid rgba(255,255,255,0.08)" }}>
      <span className="material-symbols-outlined text-[13px]">{copied ? "check" : "content_copy"}</span>
      {copied ? "Copied!" : label}
    </button>
  );
}

export default function UrlEncoderTool() {
  const uid = useId();
  const [mode,   setMode]   = useState<Mode>("encode");
  const [input,  setInput]  = useState("");
  const [output, setOutput] = useState("");
  const [error,  setError]  = useState<string | null>(null);
  const [notif,  setNotif]  = useState<{ type: NotifType; message: string } | null>(null);

  const notify = useCallback((type: NotifType, msg: string) => {
    setNotif({ type, message: msg });
    setTimeout(() => setNotif(null), 4000);
  }, []);

  const handleInput = useCallback((text: string) => {
    setInput(text);
    setError(null);
    if (!text) { setOutput(""); return; }
    try {
      setOutput(mode === "encode" ? encodeUrl(text) : decodeUrl(text));
    } catch {
      setError(mode === "decode" ? "Invalid URL encoding — contains malformed percent sequences." : "Encoding failed.");
      setOutput("");
    }
  }, [mode]);

  const switchMode = useCallback((m: Mode) => {
    setMode(m);
    setError(null);
    if (!input) return;
    try {
      setOutput(m === "encode" ? encodeUrl(input) : decodeUrl(input));
    } catch {
      setError(m === "decode" ? "Invalid URL encoding." : "Encoding failed.");
      setOutput("");
    }
  }, [input]);

  const handleSwap = useCallback(() => {
    if (!output) { notify("error", "Nothing to swap."); return; }
    setInput(output);
    const newMode: Mode = mode === "encode" ? "decode" : "encode";
    setMode(newMode);
    setError(null);
    try {
      setOutput(newMode === "encode" ? encodeUrl(output) : decodeUrl(output));
    } catch {
      setError("Cannot convert swapped text."); setOutput("");
    }
  }, [output, mode, notify]);

  const handleClear = useCallback(() => { setInput(""); setOutput(""); setError(null); setNotif(null); }, []);
  const handleReset = useCallback(() => { setInput(""); setOutput(""); setError(null); setNotif(null); setMode("encode"); }, []);

  const isEmpty = !input;

  return (
    <div className="mb-12 flex flex-col gap-4">
      {/* Toolbar */}
      <div className="glass-panel rounded-2xl p-3 flex flex-wrap items-center gap-2"
        style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="flex rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
          {(["encode", "decode"] as Mode[]).map(m => (
            <button key={m} onClick={() => switchMode(m)}
              className="flex items-center gap-1.5 px-3.5 py-2 text-[13px] font-semibold transition-all"
              style={{ background: mode === m ? "rgba(221,183,255,0.15)" : "rgba(255,255,255,0.03)", color: mode === m ? "#ddb7ff" : "#988d9f" }}>
              <span className="material-symbols-outlined text-[14px]">{m === "encode" ? "lock" : "lock_open"}</span>
              {m === "encode" ? "Encode" : "Decode"}
            </button>
          ))}
        </div>
        <div className="w-px h-6 mx-1" style={{ background: "rgba(255,255,255,0.08)" }} />
        <button onClick={handleSwap}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[13px] font-semibold transition-all"
          style={{ background: "rgba(221,183,255,0.1)", color: "#ddb7ff", border: "1px solid rgba(221,183,255,0.2)" }}>
          <span className="material-symbols-outlined text-[15px]">swap_horiz</span>Swap
        </button>
        <div className="w-px h-6 mx-1" style={{ background: "rgba(255,255,255,0.08)" }} />
        <button onClick={handleClear}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[13px] font-semibold transition-all"
          style={{ background: "rgba(255,100,100,0.08)", color: "#ff8080", border: "1px solid rgba(255,100,100,0.15)" }}>
          <span className="material-symbols-outlined text-[15px]">delete_sweep</span>Clear
        </button>
        <button onClick={handleReset}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[13px] font-semibold transition-all"
          style={{ background: "rgba(255,100,100,0.05)", color: "#ff8080", border: "1px solid rgba(255,100,100,0.1)" }}>
          <span className="material-symbols-outlined text-[15px]">refresh</span>Reset
        </button>
      </div>

      {/* Notification */}
      {notif && (
        <div className="flex items-start gap-3 p-3 rounded-2xl text-sm font-medium"
          style={{ background: "rgba(255,100,100,0.1)", border: "1px solid rgba(255,100,100,0.25)", color: "#ff8080" }}>
          <span className="material-symbols-outlined text-[16px] mt-0.5 shrink-0">error</span>
          <span>{notif.message}</span>
          <button onClick={() => setNotif(null)} className="ml-auto opacity-60 hover:opacity-100">
            <span className="material-symbols-outlined text-[14px]">close</span>
          </button>
        </div>
      )}

      {/* Split panels */}
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Input */}
        <div className="flex flex-col gap-2 flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-semibold uppercase tracking-wider"
              style={{ color: mode === "encode" ? "#4cd7f6" : "#ddb7ff" }}>
              {mode === "encode" ? "Plain URL / Text" : "Encoded URL"}
            </span>
            <div className="flex gap-1.5">
              <CopyBtn text={input} label="Copy" />
            </div>
          </div>
          <div className="glass-panel rounded-2xl overflow-hidden flex flex-col"
            style={{ border: `1px solid ${error ? "rgba(255,100,100,0.35)" : "rgba(255,255,255,0.07)"}`, minHeight: "220px" }}>
            <textarea
              id={`${uid}-input`}
              value={input}
              onChange={e => handleInput(e.target.value)}
              placeholder={mode === "encode" ? "Type or paste plain text / URL…" : "Paste percent-encoded URL…"}
              spellCheck={false}
              className="flex-1 w-full resize-none bg-transparent text-sm leading-relaxed outline-none p-4"
              style={{ fontFamily: "'JetBrains Mono',Consolas,monospace", color: "#e8dff0", minHeight: "220px" }}
            />
            {error && (
              <div className="px-4 py-2 border-t flex items-center gap-2 text-[12px] font-semibold"
                style={{ borderColor: "rgba(255,100,100,0.2)", background: "rgba(255,100,100,0.07)", color: "#ff8080" }}>
                <span className="material-symbols-outlined text-[14px]">error</span>{error}
              </div>
            )}
          </div>
          <div className="text-[11px] font-semibold" style={{ color: "#4d4354" }}>
            <span style={{ color: "#988d9f" }}>{input.length.toLocaleString()}</span> chars &nbsp;
            <span style={{ color: "#988d9f" }}>{formatBytes(new Blob([input]).size)}</span>
          </div>
        </div>

        {/* Arrow */}
        <div className="flex lg:flex-col items-center justify-center gap-2 py-2 lg:py-0 lg:px-1">
          <div className="hidden lg:block w-px flex-1" style={{ background: "rgba(255,255,255,0.06)" }} />
          <div className="flex items-center justify-center w-8 h-8 rounded-full shrink-0"
            style={{ background: "rgba(221,183,255,0.1)", border: "1px solid rgba(221,183,255,0.2)" }}>
            <span className="material-symbols-outlined text-[16px] lg:rotate-90" style={{ color: "#ddb7ff" }}>arrow_forward</span>
          </div>
          <div className="hidden lg:block w-px flex-1" style={{ background: "rgba(255,255,255,0.06)" }} />
        </div>

        {/* Output */}
        <div className="flex flex-col gap-2 flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-semibold uppercase tracking-wider"
              style={{ color: mode === "encode" ? "#ddb7ff" : "#4cd7f6" }}>
              {mode === "encode" ? "Encoded URL" : "Decoded Text"}
            </span>
            <CopyBtn text={output} label="Copy" />
          </div>
          <div className="glass-panel rounded-2xl overflow-hidden flex flex-col"
            style={{ border: "1px solid rgba(255,255,255,0.07)", minHeight: "220px" }}>
            <textarea
              value={output}
              readOnly
              placeholder={mode === "encode" ? "Encoded output will appear here…" : "Decoded output will appear here…"}
              className="flex-1 w-full resize-none bg-transparent text-sm leading-relaxed outline-none p-4"
              style={{ fontFamily: "'JetBrains Mono',Consolas,monospace", color: "#e8dff0", minHeight: "220px" }}
            />
          </div>
          <div className="text-[11px] font-semibold" style={{ color: "#4d4354" }}>
            <span style={{ color: "#988d9f" }}>{output.length.toLocaleString()}</span> chars &nbsp;
            <span style={{ color: "#988d9f" }}>{formatBytes(new Blob([output]).size)}</span>
          </div>
        </div>
      </div>

      {/* Sample */}
      {isEmpty && (
        <div className="flex flex-wrap gap-3 justify-center">
          <button onClick={() => { switchMode("encode"); handleInput("https://example.com/search?q=hello world&lang=en&page=1"); }}
            className="text-sm font-semibold flex items-center gap-1.5 hover:opacity-80 transition-opacity"
            style={{ color: "#4cd7f6" }}>
            <span className="material-symbols-outlined text-[16px]">auto_awesome</span>Try encoding a URL
          </button>
          <button onClick={() => { switchMode("decode"); handleInput("https%3A%2F%2Fexample.com%2Fsearch%3Fq%3Dhello%20world%26lang%3Den"); }}
            className="text-sm font-semibold flex items-center gap-1.5 hover:opacity-80 transition-opacity"
            style={{ color: "#ddb7ff" }}>
            <span className="material-symbols-outlined text-[16px]">auto_awesome</span>Try decoding a URL
          </button>
        </div>
      )}
    </div>
  );
}
