"use client";

import { useState, useCallback, useRef, useId } from "react";

type Algorithm = "MD5" | "SHA-1" | "SHA-256" | "SHA-384" | "SHA-512";
type NotifType = "success" | "error";

// ─── Pure-JS MD5 (RFC 1321) ────────────────────────────────────────────────────
function md5(input: string): string {
  function safeAdd(x: number, y: number) { const lsw = (x & 0xffff) + (y & 0xffff); return (((x >> 16) + (y >> 16) + (lsw >> 16)) << 16) | (lsw & 0xffff); }
  function bitRotateLeft(num: number, cnt: number) { return (num << cnt) | (num >>> (32 - cnt)); }
  function md5cmn(q: number, a: number, b: number, x: number, s: number, t: number) { return safeAdd(bitRotateLeft(safeAdd(safeAdd(a, q), safeAdd(x, t)), s), b); }
  function md5ff(a: number, b: number, c: number, d: number, x: number, s: number, t: number) { return md5cmn((b & c) | (~b & d), a, b, x, s, t); }
  function md5gg(a: number, b: number, c: number, d: number, x: number, s: number, t: number) { return md5cmn((b & d) | (c & ~d), a, b, x, s, t); }
  function md5hh(a: number, b: number, c: number, d: number, x: number, s: number, t: number) { return md5cmn(b ^ c ^ d, a, b, x, s, t); }
  function md5ii(a: number, b: number, c: number, d: number, x: number, s: number, t: number) { return md5cmn(c ^ (b | ~d), a, b, x, s, t); }

  const str8 = unescape(encodeURIComponent(input));
  const bytes: number[] = [];
  for (let i = 0; i < str8.length; i++) bytes.push(str8.charCodeAt(i));
  bytes.push(0x80);
  while (bytes.length % 64 !== 56) bytes.push(0);
  const bitLen = (str8.length * 8);
  bytes.push(bitLen & 0xff, (bitLen >> 8) & 0xff, (bitLen >> 16) & 0xff, (bitLen >> 24) & 0xff, 0, 0, 0, 0);

  let a = 0x67452301, b = 0xefcdab89, c = 0x98badcfe, d = 0x10325476;

  for (let i = 0; i < bytes.length; i += 64) {
    const M: number[] = [];
    for (let j = 0; j < 16; j++) M[j] = bytes[i + j * 4] | (bytes[i + j * 4 + 1] << 8) | (bytes[i + j * 4 + 2] << 16) | (bytes[i + j * 4 + 3] << 24);
    const [aa, bb, cc, dd] = [a, b, c, d];
    a = md5ff(a, b, c, d, M[0],  7, -680876936);  b = md5ff(d, a, b, c, M[1], 12, -389564586);  c = md5ff(c, d, a, b, M[2], 17,  606105819);  d = md5ff(b, c, d, a, M[3], 22, -1044525330);
    a = md5ff(a, b, c, d, M[4],  7, -176418897);  b = md5ff(d, a, b, c, M[5], 12,  1200080426);  c = md5ff(c, d, a, b, M[6], 17, -1473231341); d = md5ff(b, c, d, a, M[7], 22, -45705983);
    a = md5ff(a, b, c, d, M[8],  7,  1770035416); b = md5ff(d, a, b, c, M[9], 12, -1958414417);  c = md5ff(c, d, a, b, M[10],17, -42063);      d = md5ff(b, c, d, a, M[11],22, -1990404162);
    a = md5ff(a, b, c, d, M[12], 7,  1804603682); b = md5ff(d, a, b, c, M[13],12, -40341101);    c = md5ff(c, d, a, b, M[14],17, -1502002290); d = md5ff(b, c, d, a, M[15],22,  1236535329);
    a = md5gg(a, b, c, d, M[1],  5, -165796510);  b = md5gg(d, a, b, c, M[6],  9, -1069501632); c = md5gg(c, d, a, b, M[11],14,  643717713);  d = md5gg(b, c, d, a, M[0], 20, -373897302);
    a = md5gg(a, b, c, d, M[5],  5, -701558691);  b = md5gg(d, a, b, c, M[10], 9,  38016083);   c = md5gg(c, d, a, b, M[15],14, -660478335);  d = md5gg(b, c, d, a, M[4], 20, -405537848);
    a = md5gg(a, b, c, d, M[9],  5,  568446438);  b = md5gg(d, a, b, c, M[14], 9, -1019803690); c = md5gg(c, d, a, b, M[3], 14, -187363961);  d = md5gg(b, c, d, a, M[8], 20,  1163531501);
    a = md5gg(a, b, c, d, M[13], 5, -1444681467); b = md5gg(d, a, b, c, M[2],  9, -51403784);   c = md5gg(c, d, a, b, M[7], 14,  1735328473);  d = md5gg(b, c, d, a, M[12],20, -1926607734);
    a = md5hh(a, b, c, d, M[5],  4, -378558);     b = md5hh(d, a, b, c, M[8], 11, -2022574463); c = md5hh(c, d, a, b, M[11],16,  1839030562);  d = md5hh(b, c, d, a, M[14],23, -35309556);
    a = md5hh(a, b, c, d, M[1],  4, -1530992060); b = md5hh(d, a, b, c, M[4], 11,  1272893353); c = md5hh(c, d, a, b, M[7], 16, -155497632);   d = md5hh(b, c, d, a, M[10],23, -1094730640);
    a = md5hh(a, b, c, d, M[13], 4,  681279174);  b = md5hh(d, a, b, c, M[0], 11, -358537222);  c = md5hh(c, d, a, b, M[3], 16, -722521979);   d = md5hh(b, c, d, a, M[6], 23,  76029189);
    a = md5hh(a, b, c, d, M[9],  4, -640364487);  b = md5hh(d, a, b, c, M[12],11, -421815835);  c = md5hh(c, d, a, b, M[15],16,  530742520);   d = md5hh(b, c, d, a, M[2], 23, -995338651);
    a = md5ii(a, b, c, d, M[0],  6, -198630844);  b = md5ii(d, a, b, c, M[7], 10,  1126891415); c = md5ii(c, d, a, b, M[14],15, -1416354905);  d = md5ii(b, c, d, a, M[5], 21, -57434055);
    a = md5ii(a, b, c, d, M[12], 6,  1700485571); b = md5ii(d, a, b, c, M[3], 10, -1894986606); c = md5ii(c, d, a, b, M[10],15, -1051523);     d = md5ii(b, c, d, a, M[1], 21, -2054922799);
    a = md5ii(a, b, c, d, M[8],  6,  1873313359); b = md5ii(d, a, b, c, M[15],10, -30611744);   c = md5ii(c, d, a, b, M[6], 15, -1560198380);  d = md5ii(b, c, d, a, M[13],21,  1309151649);
    a = md5ii(a, b, c, d, M[4],  6, -145523070);  b = md5ii(d, a, b, c, M[11],10, -1120210379); c = md5ii(c, d, a, b, M[2], 15,  718787259);   d = md5ii(b, c, d, a, M[9], 21, -343485551);
    a = safeAdd(a, aa); b = safeAdd(b, bb); c = safeAdd(c, cc); d = safeAdd(d, dd);
  }

  const toHex = (n: number) => ((n & 0xff).toString(16).padStart(2, "0") + ((n >> 8) & 0xff).toString(16).padStart(2, "0") + ((n >> 16) & 0xff).toString(16).padStart(2, "0") + ((n >> 24) & 0xff).toString(16).padStart(2, "0"));
  return toHex(a) + toHex(b) + toHex(c) + toHex(d);
}

// ─── SHA via Web Crypto ───────────────────────────────────────────────────────
async function sha(text: string, algo: Algorithm): Promise<string> {
  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest(algo, enc.encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function hashText(text: string, algo: Algorithm): Promise<string> {
  if (algo === "MD5") return md5(text);
  return sha(text, algo);
}

async function hashFile(file: File, algo: Algorithm): Promise<string> {
  const buf = await file.arrayBuffer();
  if (algo === "MD5") {
    const decoder = new TextDecoder("latin1");
    return md5(decoder.decode(buf));
  }
  const hashBuf = await crypto.subtle.digest(algo, buf);
  return Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

const ALGORITHMS: Algorithm[] = ["MD5", "SHA-1", "SHA-256", "SHA-384", "SHA-512"];

export default function HashGeneratorTool() {
  const uid = useId();
  const [algo,    setAlgo]    = useState<Algorithm>("SHA-256");
  const [input,   setInput]   = useState("");
  const [hashes,  setHashes]  = useState<Partial<Record<Algorithm, string>>>({});
  const [notif,   setNotif]   = useState<{ type: NotifType; msg: string } | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [fileHash, setFileHash] = useState<{ name: string; hash: string; algo: Algorithm } | null>(null);
  const [fileLoading, setFileLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const uploadId = `${uid}-file`;

  const notify = useCallback((type: NotifType, msg: string) => {
    setNotif({ type, msg });
    setTimeout(() => setNotif(null), 4000);
  }, []);

  const handleInput = useCallback((text: string) => {
    setInput(text);
    setFileHash(null);
    if (!text) { setHashes({}); return; }
    async function compute() {
      const result: Partial<Record<Algorithm, string>> = {};
      for (const a of ALGORITHMS) {
        try { result[a] = await hashText(text, a); } catch { result[a] = "error"; }
      }
      setHashes(result);
    }
    compute();
  }, []);

  const handleCopy = useCallback(async (key: string, value: string) => {
    await navigator.clipboard.writeText(value);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  }, []);

  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) { notify("error", "File too large. Max 50 MB."); return; }
    setFileLoading(true);
    setInput("");
    setHashes({});
    const capturedFile = file;

    async function compute() {
      try {
        const hash = await hashFile(capturedFile, algo);
        setFileHash({ name: capturedFile.name, hash, algo });
      } catch {
        notify("error", "Failed to hash file.");
      } finally {
        setFileLoading(false);
        if (fileRef.current) fileRef.current.value = "";
      }
    }
    compute();
  }, [algo, notify]);

  const handleClear = useCallback(() => {
    setInput(""); setHashes({}); setFileHash(null); setNotif(null);
  }, []);

  const isEmpty = !input && !fileHash;

  return (
    <div className="mb-12 flex flex-col gap-4">
      {/* Toolbar */}
      <div className="glass-panel rounded-2xl p-3 flex flex-wrap items-center gap-2"
        style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
        {ALGORITHMS.map(a => (
          <button key={a} onClick={() => setAlgo(a)}
            className="px-3 py-1.5 rounded-xl text-[13px] font-semibold transition-all"
            style={{
              background: algo === a ? "rgba(221,183,255,0.15)" : "rgba(255,255,255,0.04)",
              color: algo === a ? "#ddb7ff" : "#988d9f",
              border: `1px solid ${algo === a ? "rgba(221,183,255,0.3)" : "rgba(255,255,255,0.07)"}`,
            }}>{a}</button>
        ))}
        <div className="w-px h-6 mx-1" style={{ background: "rgba(255,255,255,0.08)" }} />
        <label htmlFor={uploadId}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[13px] font-semibold cursor-pointer transition-all"
          style={{ background: "rgba(76,215,246,0.1)", color: "#4cd7f6", border: "1px solid rgba(76,215,246,0.2)" }}>
          <span className="material-symbols-outlined text-[15px]">attach_file</span>
          Hash File
          <input ref={fileRef} id={uploadId} type="file" className="hidden" onChange={handleFile} />
        </label>
        <div className="w-px h-6 mx-1" style={{ background: "rgba(255,255,255,0.08)" }} />
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

      {/* Input */}
      <div className="glass-panel rounded-2xl overflow-hidden"
        style={{ border: "1px solid rgba(255,255,255,0.07)", position: "relative" }}>
        {!input && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none"
            style={{ color: "#4d4354", zIndex: 1, top: 0 }}>
            <div className="text-center pt-12">
              <span className="material-symbols-outlined text-[40px] block mb-2">tag</span>
              Type text to hash it live, or upload a file
            </div>
          </div>
        )}
        <textarea
          value={input}
          onChange={e => handleInput(e.target.value)}
          placeholder=""
          spellCheck={false}
          className="w-full resize-none bg-transparent text-sm leading-relaxed outline-none p-4"
          style={{ fontFamily: "'JetBrains Mono',Consolas,monospace", color: "#e8dff0", minHeight: "140px" }}
        />
        <div className="px-4 pb-2 text-[11px] font-semibold" style={{ color: "#4d4354" }}>
          <span style={{ color: "#988d9f" }}>{input.length.toLocaleString()}</span> characters &nbsp;
          <span style={{ color: "#988d9f" }}>{new Blob([input]).size.toLocaleString()}</span> bytes
        </div>
      </div>

      {/* File hash result */}
      {fileLoading && (
        <div className="glass-panel rounded-2xl p-4 flex items-center gap-3"
          style={{ border: "1px solid rgba(76,215,246,0.2)", color: "#4cd7f6" }}>
          <span className="material-symbols-outlined text-[20px] animate-spin">hourglass_empty</span>
          Computing hash…
        </div>
      )}
      {fileHash && (
        <div className="glass-panel rounded-2xl p-4 flex flex-col gap-2"
          style={{ border: "1px solid rgba(76,215,246,0.2)" }}>
          <div className="flex items-center gap-2 text-[13px] font-semibold" style={{ color: "#4cd7f6" }}>
            <span className="material-symbols-outlined text-[16px]">insert_drive_file</span>
            {fileHash.name} — {fileHash.algo}
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-[13px] font-mono break-all" style={{ color: "#e8dff0" }}>{fileHash.hash}</code>
            <button onClick={() => handleCopy("file", fileHash.hash)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[12px] font-semibold shrink-0"
              style={{ background: "rgba(255,255,255,0.05)", color: copiedKey === "file" ? "#80e0a0" : "#988d9f", border: "1px solid rgba(255,255,255,0.08)" }}>
              <span className="material-symbols-outlined text-[13px]">{copiedKey === "file" ? "check" : "content_copy"}</span>
              {copiedKey === "file" ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>
      )}

      {/* Hash results */}
      {!isEmpty && Object.keys(hashes).length > 0 && (
        <div className="flex flex-col gap-2">
          {ALGORITHMS.map(a => {
            const h = hashes[a];
            if (!h) return null;
            const isActive = a === algo;
            return (
              <div key={a}
                className="glass-panel rounded-2xl p-4 flex flex-col gap-2 transition-all"
                style={{ border: `1px solid ${isActive ? "rgba(221,183,255,0.3)" : "rgba(255,255,255,0.06)"}` }}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[12px] font-bold uppercase tracking-wider"
                    style={{ color: isActive ? "#ddb7ff" : "#988d9f" }}>{a}</span>
                  <button onClick={() => handleCopy(a, h)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[12px] font-semibold shrink-0"
                    style={{ background: "rgba(255,255,255,0.05)", color: copiedKey === a ? "#80e0a0" : "#988d9f", border: "1px solid rgba(255,255,255,0.08)" }}>
                    <span className="material-symbols-outlined text-[13px]">{copiedKey === a ? "check" : "content_copy"}</span>
                    {copiedKey === a ? "Copied!" : "Copy"}
                  </button>
                </div>
                <code className="text-[13px] font-mono break-all" style={{ color: "#e8dff0" }}>{h}</code>
              </div>
            );
          })}
        </div>
      )}

      {isEmpty && !fileLoading && (
        <button onClick={() => handleInput("ToolNest AI — Hash Generator")}
          className="text-sm font-semibold flex items-center justify-center gap-1.5 hover:opacity-80 transition-opacity"
          style={{ color: "#988d9f" }}>
          <span className="material-symbols-outlined text-[16px]">auto_awesome</span>Try a sample text
        </button>
      )}
    </div>
  );
}
