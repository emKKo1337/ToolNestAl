"use client";

import { useState, useCallback } from "react";

type NotifType = "success" | "error";

function base64urlDecode(str: string): string {
  const b64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
  return decodeURIComponent(
    atob(b64 + pad)
      .split("")
      .map(c => "%" + c.charCodeAt(0).toString(16).padStart(2, "0"))
      .join("")
  );
}

interface JwtParts {
  header:    Record<string, unknown>;
  payload:   Record<string, unknown>;
  signature: string;
}

function decodeJwt(token: string): JwtParts {
  const parts = token.trim().split(".");
  if (parts.length !== 3) throw new Error("Invalid JWT — expected 3 parts separated by dots.");
  const header  = JSON.parse(base64urlDecode(parts[0]));
  const payload = JSON.parse(base64urlDecode(parts[1]));
  return { header, payload, signature: parts[2] };
}

function formatTs(ts: unknown): string {
  if (typeof ts !== "number") return String(ts);
  const d = new Date(ts * 1000);
  return `${d.toUTCString()} (${d.toISOString()})`;
}

function isExpired(exp: unknown): boolean {
  if (typeof exp !== "number") return false;
  return Date.now() > exp * 1000;
}

function JsonBlock({ data }: { data: Record<string, unknown> }) {
  return (
    <pre className="text-[13px] leading-relaxed overflow-x-auto p-4 rounded-xl"
      style={{ fontFamily: "'JetBrains Mono',Consolas,monospace", background: "rgba(0,0,0,0.25)", color: "#e8dff0" }}>
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}

function CopyBtn({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = useCallback(async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [text]);
  return (
    <button onClick={copy}
      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[12px] font-semibold transition-all"
      style={{ background: "rgba(255,255,255,0.05)", color: copied ? "#80e0a0" : "#988d9f", border: "1px solid rgba(255,255,255,0.08)" }}>
      <span className="material-symbols-outlined text-[13px]">{copied ? "check" : "content_copy"}</span>
      {copied ? "Copied!" : label}
    </button>
  );
}

export default function JwtDecoderTool() {
  const [token,   setToken]   = useState("");
  const [decoded, setDecoded] = useState<JwtParts | null>(null);
  const [error,   setError]   = useState<string | null>(null);
  const [notif,   setNotif]   = useState<{ type: NotifType; msg: string } | null>(null);

  const handleInput = useCallback((text: string) => {
    setToken(text);
    setError(null);
    setDecoded(null);
    if (!text.trim()) return;
    try {
      setDecoded(decodeJwt(text));
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  const handleClear = useCallback(() => { setToken(""); setDecoded(null); setError(null); setNotif(null); }, []);

  const isEmpty = !token.trim();
  const exp = decoded ? decoded.payload["exp"] : null;
  const iat = decoded ? decoded.payload["iat"] : null;
  const tokenExpired = decoded ? isExpired(decoded.payload["exp"]) : false;

  return (
    <div className="mb-12 flex flex-col gap-4">
      {/* Toolbar */}
      <div className="glass-panel rounded-2xl p-3 flex flex-wrap items-center gap-2"
        style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
        <span className="flex items-center gap-1.5 text-[13px] font-semibold" style={{ color: "#ddb7ff" }}>
          <span className="material-symbols-outlined text-[16px]">vpn_key</span>
          JWT Decoder — no signature verification
        </span>
        <div className="flex-1" />
        <button onClick={handleClear}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[13px] font-semibold transition-all"
          style={{ background: "rgba(255,100,100,0.08)", color: "#ff8080", border: "1px solid rgba(255,100,100,0.15)" }}>
          <span className="material-symbols-outlined text-[15px]">delete_sweep</span>Clear
        </button>
      </div>

      {notif && (
        <div className="flex items-start gap-3 p-3 rounded-2xl text-sm font-medium"
          style={{ background: "rgba(255,100,100,0.1)", border: "1px solid rgba(255,100,100,0.25)", color: "#ff8080" }}>
          <span className="material-symbols-outlined text-[16px] mt-0.5 shrink-0">error</span>
          <span>{notif.msg}</span>
          <button onClick={() => setNotif(null)} className="ml-auto opacity-60 hover:opacity-100">
            <span className="material-symbols-outlined text-[14px]">close</span>
          </button>
        </div>
      )}

      {/* Token input */}
      <div className="glass-panel rounded-2xl overflow-hidden"
        style={{ border: `1px solid ${error ? "rgba(255,100,100,0.35)" : decoded ? "rgba(100,220,150,0.25)" : "rgba(255,255,255,0.07)"}` }}>
        <textarea
          value={token}
          onChange={e => handleInput(e.target.value)}
          placeholder="Paste your JWT here — e.g. eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyIn0.signature"
          spellCheck={false}
          className="w-full resize-none bg-transparent text-sm leading-relaxed outline-none p-4"
          style={{ fontFamily: "'JetBrains Mono',Consolas,monospace", color: "#e8dff0", minHeight: "100px", wordBreak: "break-all" }}
        />
        {error && (
          <div className="px-4 py-2 border-t flex items-center gap-2 text-[12px] font-semibold"
            style={{ borderColor: "rgba(255,100,100,0.2)", background: "rgba(255,100,100,0.07)", color: "#ff8080" }}>
            <span className="material-symbols-outlined text-[14px]">error</span>{error}
          </div>
        )}
      </div>

      {/* Decoded output */}
      {decoded && (
        <div className="flex flex-col gap-4">
          {/* Token info strip */}
          <div className="flex flex-wrap gap-3">
            {[
              { label: "Algorithm", value: String(decoded.header["alg"] ?? "—") },
              { label: "Type",      value: String(decoded.header["typ"] ?? "—") },
              { label: "Expires",   value: typeof exp === "number" ? formatTs(exp).split(" (")[0] : "—",
                accent: typeof exp === "number" ? (tokenExpired ? "#ff8080" : "#80e0a0") : "#988d9f" },
              { label: "Status",    value: typeof exp === "number" ? (tokenExpired ? "Expired" : "Valid") : "No expiry",
                accent: typeof exp === "number" ? (tokenExpired ? "#ff8080" : "#80e0a0") : "#988d9f" },
            ].map(({ label, value, accent = "#ddb7ff" }) => (
              <div key={label} className="glass-panel rounded-xl px-4 py-2 flex flex-col gap-0.5"
                style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
                <span className="text-sm font-bold tabular-nums" style={{ color: accent }}>{value}</span>
                <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "#988d9f" }}>{label}</span>
              </div>
            ))}
          </div>

          {/* Human-readable timestamps */}
          {(typeof exp === "number" || typeof iat === "number") && (
            <div className="glass-panel rounded-2xl p-4 flex flex-col gap-2"
              style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
              <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "#4d4354" }}>Timestamps</span>
              {typeof iat === "number" && (
                <div className="flex flex-col gap-0.5">
                  <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#988d9f" }}>Issued At (iat)</span>
                  <span className="text-[13px] font-mono" style={{ color: "#e8dff0" }}>{formatTs(iat)}</span>
                </div>
              )}
              {typeof exp === "number" && (
                <div className="flex flex-col gap-0.5">
                  <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#988d9f" }}>Expires (exp)</span>
                  <span className="text-[13px] font-mono" style={{ color: tokenExpired ? "#ff8080" : "#80e0a0" }}>{formatTs(exp)}</span>
                </div>
              )}
            </div>
          )}

          {/* Header */}
          <div className="glass-panel rounded-2xl p-4 flex flex-col gap-3"
            style={{ border: "1px solid rgba(221,183,255,0.15)" }}>
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-bold uppercase tracking-wider" style={{ color: "#ddb7ff" }}>Header</span>
              <CopyBtn text={JSON.stringify(decoded.header, null, 2)} label="Copy JSON" />
            </div>
            <JsonBlock data={decoded.header} />
          </div>

          {/* Payload */}
          <div className="glass-panel rounded-2xl p-4 flex flex-col gap-3"
            style={{ border: "1px solid rgba(76,215,246,0.15)" }}>
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-bold uppercase tracking-wider" style={{ color: "#4cd7f6" }}>Payload</span>
              <CopyBtn text={JSON.stringify(decoded.payload, null, 2)} label="Copy JSON" />
            </div>
            <JsonBlock data={decoded.payload} />
          </div>

          {/* Signature */}
          <div className="glass-panel rounded-2xl p-4 flex flex-col gap-3"
            style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-bold uppercase tracking-wider" style={{ color: "#988d9f" }}>Signature (not verified)</span>
              <CopyBtn text={decoded.signature} label="Copy" />
            </div>
            <code className="text-[13px] font-mono break-all" style={{ color: "#4d4354" }}>{decoded.signature}</code>
          </div>
        </div>
      )}

      {isEmpty && (
        <button onClick={() => handleInput("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyXzEyMyIsIm5hbWUiOiJKb2huIERvZSIsImVtYWlsIjoiam9obkBleGFtcGxlLmNvbSIsInJvbGUiOiJhZG1pbiIsImlhdCI6MTcxNjIzOTAyMiwiZXhwIjoxNzE2MzI1NDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c")}
          className="text-sm font-semibold flex items-center justify-center gap-1.5 hover:opacity-80 transition-opacity"
          style={{ color: "#988d9f" }}>
          <span className="material-symbols-outlined text-[16px]">auto_awesome</span>Load sample JWT
        </button>
      )}
    </div>
  );
}
