"use client";

/**
 * Protect PDF — browser-local PDF password protection
 *
 * Encryption: PDF Standard Security Handler Rev 3, RC4-128
 * No external crypto library — pure-JS MD5 + RC4.
 *
 * Algorithm (PDF spec §3.5.2 Revision 3):
 *   O  = ownerKey(ownerPw, userPw)                  32 bytes
 *   ek = encKey(userPw, O, P, fileId)               16 bytes
 *   U  = userKey(ek, fileId)                         32 bytes
 *   Per-object key: MD5(ek + objNum[3LE] + genNum[2LE]).slice(0, keyLen+5 min 16)
 *   Each string & stream encrypted with RC4(perObjKey, plaintext)
 *
 * Processing flow:
 *   1. pdf-lib normalises existing PDF → save({ useObjectStreams: false })
 *      → canonical format with plain xref table, readable object structure
 *   2. Parse all "N M obj … endobj" blocks
 *   3. Encrypt literal strings (…) and hex strings <…> inside each block
 *      using per-object RC4 key; output encrypted bytes as hex strings
 *   4. Encrypt stream data (binary) with the same per-object key
 *   5. Prepend %PDF-1.4 header, write all encrypted objects sequentially,
 *      build new xref table from recorded byte offsets,
 *      write trailer with /Encrypt ref, /ID and /Root
 *
 * Permission flags (bit positions, 1-indexed per PDF spec):
 *   3 = print   4 = modify   5 = copy   6 = annotate   9 = fill forms
 *   Bits 1,2,7,8 = 0 (reserved).  Bits 13-32 = 1 (reserved).
 */

import { useState, useRef, useCallback } from "react";

// ── PDF Standard Password Padding ────────────────────────────────────────────

const PDF_PAD = new Uint8Array([
  0x28,0xBF,0x4E,0x5E, 0x4E,0x75,0x8A,0x41,
  0x64,0x00,0x4E,0x56, 0xFF,0xFA,0x01,0x08,
  0x2E,0x2E,0x00,0xB6, 0xD0,0x68,0x3E,0x80,
  0x2F,0x0C,0xA9,0xFE, 0x64,0x53,0x69,0x7A,
]);

// ── Pure-JS MD5 ───────────────────────────────────────────────────────────────

function md5(input: Uint8Array): Uint8Array {
  const T = new Int32Array(64);
  for (let i = 0; i < 64; i++) T[i] = (Math.abs(Math.sin(i + 1)) * 0x100000000) | 0;
  const r = [
    7,12,17,22, 7,12,17,22, 7,12,17,22, 7,12,17,22,
    5, 9,14,20, 5, 9,14,20, 5, 9,14,20, 5, 9,14,20,
    4,11,16,23, 4,11,16,23, 4,11,16,23, 4,11,16,23,
    6,10,15,21, 6,10,15,21, 6,10,15,21, 6,10,15,21,
  ];
  const len   = input.length;
  const padLen = (55 - len % 64 + 64) % 64;
  const msg   = new Uint8Array(len + 1 + padLen + 8);
  msg.set(input);
  msg[len] = 0x80;
  const dv = new DataView(msg.buffer, msg.byteOffset);
  dv.setUint32(msg.length - 8, (len * 8) >>> 0, true);
  dv.setUint32(msg.length - 4, ((len / 0x20000000) | 0), true);

  let a = 0x67452301, b = 0xEFCDAB89, c = 0x98BADCFE, d = 0x10325476;

  for (let i = 0; i < msg.length; i += 64) {
    const M = new Int32Array(16);
    for (let j = 0; j < 16; j++) M[j] = dv.getInt32(i + j * 4, true);
    let A = a, B = b, C = c, D = d;
    for (let j = 0; j < 64; j++) {
      let f: number, g: number;
      if      (j < 16) { f = (B & C) | (~B & D);  g = j; }
      else if (j < 32) { f = (D & B) | (~D & C);  g = (5 * j + 1) % 16; }
      else if (j < 48) { f = B ^ C ^ D;             g = (3 * j + 5) % 16; }
      else             { f = C ^ (B | ~D);           g = (7 * j) % 16; }
      const s = (A + f + T[j] + M[g]) | 0;
      A = D; D = C; C = B;
      B = (B + ((s << r[j]) | (s >>> (32 - r[j])))) | 0;
    }
    a = (a + A) | 0; b = (b + B) | 0; c = (c + C) | 0; d = (d + D) | 0;
  }

  const out = new Uint8Array(16);
  const ov  = new DataView(out.buffer);
  ov.setInt32(0, a, true); ov.setInt32(4, b, true);
  ov.setInt32(8, c, true); ov.setInt32(12, d, true);
  return out;
}

// ── Pure-JS RC4 ───────────────────────────────────────────────────────────────

function rc4(key: Uint8Array, data: Uint8Array): Uint8Array {
  const S = new Uint8Array(256);
  for (let i = 0; i < 256; i++) S[i] = i;
  let j = 0;
  for (let i = 0; i < 256; i++) {
    j = (j + S[i] + key[i % key.length]) & 0xFF;
    const tmp = S[i]; S[i] = S[j]; S[j] = tmp;
  }
  const out = new Uint8Array(data.length);
  let x = 0, y = 0;
  for (let k = 0; k < data.length; k++) {
    x = (x + 1) & 0xFF;
    y = (y + S[x]) & 0xFF;
    const tmp = S[x]; S[x] = S[y]; S[y] = tmp;
    out[k] = data[k] ^ S[(S[x] + S[y]) & 0xFF];
  }
  return out;
}

// ── PDF Encryption Key Derivation ─────────────────────────────────────────────

function padPw(pw: string): Uint8Array {
  const encoded = new TextEncoder().encode(pw).slice(0, 32);
  const out = new Uint8Array(32);
  out.set(encoded);
  out.set(PDF_PAD.slice(0, 32 - encoded.length), encoded.length);
  return out;
}

function computeO(ownerPw: string, userPw: string): Uint8Array {
  let key = md5(padPw(ownerPw));
  for (let i = 0; i < 50; i++) key = md5(key);
  let data = padPw(userPw);
  data = rc4(key.slice(0, 16), data);
  for (let i = 1; i <= 19; i++) {
    const xk = new Uint8Array(16);
    for (let k = 0; k < 16; k++) xk[k] = key[k] ^ i;
    data = rc4(xk, data);
  }
  return data;
}

function computeEK(userPw: string, O: Uint8Array, P: number, fileId: Uint8Array): Uint8Array {
  const inp = new Uint8Array(32 + 32 + 4 + 16);
  inp.set(padPw(userPw), 0);
  inp.set(O, 32);
  const dv = new DataView(inp.buffer, inp.byteOffset + 64);
  dv.setInt32(0, P, true);
  inp.set(fileId, 68);
  let key = md5(inp);
  for (let i = 0; i < 50; i++) key = md5(key.slice(0, 16));
  return key.slice(0, 16);
}

function computeU(ek: Uint8Array, fileId: Uint8Array): Uint8Array {
  const inp = new Uint8Array(32 + 16);
  inp.set(PDF_PAD, 0);
  inp.set(fileId, 32);
  let data = rc4(ek, md5(inp));
  for (let i = 1; i <= 19; i++) {
    const xk = new Uint8Array(16);
    for (let k = 0; k < 16; k++) xk[k] = ek[k] ^ i;
    data = rc4(xk, data);
  }
  const U = new Uint8Array(32);
  U.set(data.slice(0, 16));
  return U;
}

function perObjKey(ek: Uint8Array, objNum: number, genNum: number): Uint8Array {
  const inp = new Uint8Array(ek.length + 5);
  inp.set(ek);
  inp[ek.length]     =  objNum        & 0xFF;
  inp[ek.length + 1] = (objNum >>  8) & 0xFF;
  inp[ek.length + 2] = (objNum >> 16) & 0xFF;
  inp[ek.length + 3] =  genNum        & 0xFF;
  inp[ek.length + 4] = (genNum >>  8) & 0xFF;
  return md5(inp).slice(0, Math.min(ek.length + 5, 16));
}

// ── Permission Flags ──────────────────────────────────────────────────────────

interface PermissionsOpts {
  allowPrinting:    boolean;
  allowCopying:     boolean;
  allowEditing:     boolean;
  allowAnnotations: boolean;
  allowForms:       boolean;
}

function permFlags(p: PermissionsOpts): number {
  // Base: bits 1,2,7,8 = 0; bits 13-32 = 1 → -3904 (0xFFFFF0C0)
  let f = -3904;
  if (p.allowPrinting)    f |= 4;    // bit 3
  if (p.allowEditing)     f |= 8;    // bit 4
  if (p.allowCopying)     f |= 16;   // bit 5
  if (p.allowAnnotations) f |= 32;   // bit 6
  if (p.allowForms)       f |= 256;  // bit 9
  return f;
}

// ── String Encryptor (within PDF object body text) ────────────────────────────
// Encrypts literal (…) and hex <…> strings; outputs encrypted bytes as hex strings.
// Skips dict delimiters << and >>; skips PDF names /Name.

function encryptStringsInBody(body: string, key: Uint8Array): string {
  const out: string[] = [];
  let i = 0;
  while (i < body.length) {
    const ch = body[i];

    // Hex string <hexdata> — but not << (dict start)
    if (ch === '<' && body[i + 1] !== '<') {
      const end = body.indexOf('>', i + 1);
      if (end !== -1) {
        const hexContent = body.slice(i + 1, end).replace(/\s/g, '');
        // Pad to even length
        const hex = hexContent.length % 2 ? hexContent + '0' : hexContent;
        const bytes = new Uint8Array(hex.length / 2);
        for (let k = 0; k < bytes.length; k++)
          bytes[k] = parseInt(hex.slice(k * 2, k * 2 + 2), 16);
        const enc = rc4(key, bytes);
        out.push('<');
        for (const b of enc) out.push(b.toString(16).padStart(2, '0').toUpperCase());
        out.push('>');
        i = end + 1;
        continue;
      }
    }

    // Dict delimiters << and >>
    if (ch === '<' && body[i + 1] === '<') { out.push('<<'); i += 2; continue; }
    if (ch === '>' && body[i + 1] === '>') { out.push('>>'); i += 2; continue; }

    // Literal string (…)
    if (ch === '(') {
      let depth = 1;
      let j = i + 1;
      const bytes: number[] = [];
      while (j < body.length && depth > 0) {
        const c = body[j];
        if (c === '\\') {
          j++;
          const esc = body[j];
          if      (esc === 'n')  { bytes.push(0x0A); j++; }
          else if (esc === 'r')  { bytes.push(0x0D); j++; }
          else if (esc === 't')  { bytes.push(0x09); j++; }
          else if (esc === 'b')  { bytes.push(0x08); j++; }
          else if (esc === 'f')  { bytes.push(0x0C); j++; }
          else if (esc === '(')  { bytes.push(0x28); j++; }
          else if (esc === ')')  { bytes.push(0x29); j++; }
          else if (esc === '\\') { bytes.push(0x5C); j++; }
          else if (esc >= '0' && esc <= '7') {
            let oct = esc;
            if (j + 1 < body.length && body[j + 1] >= '0' && body[j + 1] <= '7') {
              j++; oct += body[j];
              if (j + 1 < body.length && body[j + 1] >= '0' && body[j + 1] <= '7') {
                j++; oct += body[j];
              }
            }
            bytes.push(parseInt(oct, 8)); j++;
          } else { bytes.push(body.charCodeAt(j)); j++; }
        } else if (c === '(') { depth++; bytes.push(0x28); j++; }
        else if (c === ')')  { depth--; if (depth > 0) bytes.push(0x29); j++; }
        else { bytes.push(body.charCodeAt(j)); j++; }
      }
      const enc = rc4(key, new Uint8Array(bytes));
      out.push('<');
      for (const b of enc) out.push(b.toString(16).padStart(2, '0').toUpperCase());
      out.push('>');
      i = j;
      continue;
    }

    out.push(ch);
    i++;
  }
  return out.join('');
}

// ── Main PDF Encryption Function ──────────────────────────────────────────────

function hexStr(b: Uint8Array): string {
  return Array.from(b).map(x => x.toString(16).padStart(2, '0').toUpperCase()).join('');
}

async function encryptPdf(
  file: File,
  userPw: string,
  ownerPw: string,
  perms: PermissionsOpts,
): Promise<Uint8Array> {
  const { PDFDocument } = await import('pdf-lib');
  const buf = await file.arrayBuffer();
  const doc = await PDFDocument.load(buf, { ignoreEncryption: true });
  // Normalise to canonical, parseable format
  const rawBytes = await doc.save({ useObjectStreams: false });

  // Convert bytes → latin1 string (preserves all 0-255 values)
  const text = Array.from(rawBytes).map(b => String.fromCharCode(b)).join('');

  // ── Compute encryption parameters ────────────────────────────────────────

  const fileId = crypto.getRandomValues(new Uint8Array(16));
  const P  = permFlags(perms);
  const O  = computeO(ownerPw || userPw, userPw);
  const ek = computeEK(userPw, O, P, fileId);
  const U  = computeU(ek, fileId);

  // ── Parse all "N M obj … endobj" blocks ──────────────────────────────────

  const objRegex = /(\d+) (\d+) obj\n/g;
  const objects: Array<{ num: number; gen: number; start: number; headerEnd: number }> = [];
  let m: RegExpExecArray | null;
  while ((m = objRegex.exec(text)) !== null) {
    objects.push({
      num:       parseInt(m[1]),
      gen:       parseInt(m[2]),
      start:     m.index,
      headerEnd: m.index + m[0].length,
    });
  }

  // ── Find /Root reference from the trailer ────────────────────────────────

  const trailerMatch = /\/Root\s+(\d+)\s+\d+\s+R/.exec(text);
  const rootNum = trailerMatch ? parseInt(trailerMatch[1]) : 2;

  // ── Encrypt each object and collect output parts ──────────────────────────

  const outputParts: string[] = [];
  const newOffsets  = new Map<number, number>();
  // Header: %PDF-1.4 + comment with high bytes (marks as binary)
  const header = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
  outputParts.push(header);
  let bytePos = header.length;

  for (let idx = 0; idx < objects.length; idx++) {
    const obj     = objects[idx];
    const nextStart = idx + 1 < objects.length ? objects[idx + 1].start : text.length;
    // Full object text from "N M obj\n" to end of "endobj\n"
    const fullText  = text.slice(obj.start, nextStart);
    // Body = everything after the header line
    const body      = text.slice(obj.headerEnd, nextStart);
    // Find endobj in body
    const endobjPos = body.lastIndexOf('\nendobj');
    const content   = endobjPos !== -1 ? body.slice(0, endobjPos) : body;

    const ok = perObjKey(ek, obj.num, obj.gen);

    // Detect stream
    const sMatch = /\nstream\r?\n/.exec(content);
    let processedContent: string;

    if (sMatch) {
      const dictPart    = content.slice(0, sMatch.index);
      const streamStart = sMatch.index + sMatch[0].length;
      const streamEnd   = content.lastIndexOf('\nendstream');
      const streamText  = content.slice(streamStart, streamEnd !== -1 ? streamEnd : content.length);

      // Encrypt stream bytes (binary-safe via charCodeAt)
      const sb = new Uint8Array(streamText.length);
      for (let k = 0; k < streamText.length; k++) sb[k] = streamText.charCodeAt(k) & 0xFF;
      const encStream = rc4(ok, sb);

      // Stream length doesn't change (RC4 = same length), so /Length is still correct.
      // But encrypt strings inside the dict part.
      const encDict = encryptStringsInBody(dictPart, ok);
      const encStreamStr = Array.from(encStream).map(b => String.fromCharCode(b)).join('');

      processedContent = encDict + sMatch[0] + encStreamStr + '\nendstream';
    } else {
      processedContent = encryptStringsInBody(content, ok);
    }

    const objOut = `${obj.num} ${obj.gen} obj\n${processedContent}\nendobj\n`;
    newOffsets.set(obj.num, bytePos);
    outputParts.push(objOut);
    bytePos += objOut.length;
  }

  // ── Add Encrypt dict (NOT encrypted) ─────────────────────────────────────

  const encryptObjNum = Math.max(...newOffsets.keys()) + 1;
  const encryptObj =
    `${encryptObjNum} 0 obj\n` +
    `<<\n/Filter /Standard\n/V 2\n/R 3\n/Length 128\n` +
    `/P ${P}\n/O <${hexStr(O)}>\n/U <${hexStr(U)}>\n` +
    `>>\nendobj\n`;
  newOffsets.set(encryptObjNum, bytePos);
  outputParts.push(encryptObj);
  bytePos += encryptObj.length;

  // ── Build xref table ──────────────────────────────────────────────────────

  const xrefOffset = bytePos;
  const allNums    = [0, ...Array.from(newOffsets.keys()).sort((a, b) => a - b)];
  const xrefLines  = ['xref\n'];

  // Write object 0 (free list head) as single subsection
  xrefLines.push('0 1\n');
  xrefLines.push('0000000000 65535 f \n');

  // Write each object as its own subsection (always valid per PDF spec)
  for (const num of allNums.slice(1)) {
    const off = newOffsets.get(num)!;
    xrefLines.push(`${num} 1\n`);
    xrefLines.push(`${String(off).padStart(10, '0')} 00000 n \n`);
  }

  const xrefStr = xrefLines.join('');
  outputParts.push(xrefStr);

  // ── Trailer ───────────────────────────────────────────────────────────────

  const fid = hexStr(fileId);
  const totalObjs = encryptObjNum + 1;
  const trailer =
    `trailer\n<<\n/Size ${totalObjs}\n` +
    `/Root ${rootNum} 0 R\n` +
    `/Encrypt ${encryptObjNum} 0 R\n` +
    `/ID [<${fid}><${fid}>]\n` +
    `>>\nstartxref\n${xrefOffset}\n%%EOF`;
  outputParts.push(trailer);

  // ── Assemble final bytes ──────────────────────────────────────────────────

  const final = outputParts.join('');
  const result = new Uint8Array(final.length);
  for (let i = 0; i < final.length; i++) result[i] = final.charCodeAt(i) & 0xFF;
  return result;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1_048_576) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1_048_576).toFixed(2)} MB`;
}

function downloadPdf(data: Uint8Array, filename: string) {
  const blob = new Blob([data.buffer as ArrayBuffer], { type: 'application/pdf' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ── Password strength ─────────────────────────────────────────────────────────

type StrengthLevel = 0 | 1 | 2 | 3 | 4 | 5;

function scorePassword(pw: string): StrengthLevel {
  if (!pw) return 0;
  const len = pw.length;
  const classes = [/[A-Z]/, /[a-z]/, /[0-9]/, /[^A-Za-z0-9]/].filter(r => r.test(pw)).length;
  if (len < 6)  return 1;
  if (len < 8)  return classes >= 2 ? 2 : 1;
  if (len < 10) return classes >= 3 ? 3 : 2;
  if (len < 12) return (classes >= 3 && /[^A-Za-z0-9]/.test(pw)) ? 4 : 3;
  return classes === 4 ? 5 : 4;
}

const SL = ['', 'Weak', 'Fair', 'Good', 'Strong', 'Very Strong'] as const;
const SC = ['transparent', '#ef4444', '#f97316', '#facc15', '#4ade80', '#4cd7f6'] as const;

// ── State ─────────────────────────────────────────────────────────────────────

interface ProtectState {
  userPw:      string;
  confirmPw:   string;
  ownerPw:     string;
  showUser:    boolean;
  showConfirm: boolean;
  showOwner:   boolean;
  perms:       PermissionsOpts;
}

const DEF_PERMS: PermissionsOpts = {
  allowPrinting:    true,
  allowCopying:     false,
  allowEditing:     false,
  allowAnnotations: false,
  allowForms:       false,
};

const DEF: ProtectState = {
  userPw: '', confirmPw: '', ownerPw: '',
  showUser: false, showConfirm: false, showOwner: false,
  perms: DEF_PERMS,
};

type NotifType = 'success' | 'error';
interface Notif { type: NotifType; msg: string }

// ── Sub-components ────────────────────────────────────────────────────────────

function FL({ children, id }: { children: React.ReactNode; id?: string }) {
  return (
    <label htmlFor={id} className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: '#988d9f' }}>
      {children}
    </label>
  );
}

function PwField({ id, label, value, show, onToggle, onChange, placeholder, hint, strength }: {
  id: string; label: string; value: string; show: boolean;
  onToggle: () => void; onChange: (v: string) => void;
  placeholder?: string; hint?: string; strength?: StrengthLevel;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <FL id={id}>{label}</FL>
      <div className="relative">
        <input id={id} type={show ? 'text' : 'password'} value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder} autoComplete="new-password"
          className="w-full pl-3 pr-10 py-2.5 rounded-lg text-[13px] font-medium outline-none focus-visible:ring-2 focus-visible:ring-[#ffb4ab]"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#e2e2e2' }}
          aria-describedby={hint ? `${id}-hint` : undefined}
        />
        <button type="button" onClick={onToggle} aria-label={show ? 'Hide password' : 'Show password'}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 opacity-50 hover:opacity-100 transition-opacity">
          <span className="material-symbols-outlined text-[18px] text-[#988d9f]">
            {show ? 'visibility_off' : 'visibility'}
          </span>
        </button>
      </div>
      {strength !== undefined && value.length > 0 && (
        <div className="flex items-center gap-2 mt-0.5">
          <div className="flex gap-1 flex-1">
            {([1,2,3,4,5] as StrengthLevel[]).map(lvl => (
              <div key={lvl} className="h-1 flex-1 rounded-full transition-all duration-300"
                style={{ background: (strength >= lvl) ? SC[strength] : 'rgba(255,255,255,0.1)' }} />
            ))}
          </div>
          <span className="text-[11px] font-bold min-w-[70px] text-right"
            style={{ color: SC[strength] }}>{SL[strength]}</span>
        </div>
      )}
      {hint && <p id={`${id}-hint`} className="text-[11px]" style={{ color: hint.startsWith('⚠') ? '#f97316' : hint.startsWith('✓') ? '#4ade80' : '#5a4d63' }}>{hint}</p>}
    </div>
  );
}

function PermToggle({ label, icon, hint, checked, onChange }: {
  label: string; icon: string; hint?: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-3 cursor-pointer py-1.5">
      <div role="switch" aria-checked={checked} tabIndex={0}
        onClick={() => onChange(!checked)}
        onKeyDown={e => { if (e.key === ' ' || e.key === 'Enter') onChange(!checked); }}
        className="relative w-10 h-6 rounded-full transition-all duration-200 flex-shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-[#ffb4ab]"
        style={{ background: checked ? '#4ade80' : 'rgba(255,255,255,0.1)', border: `1px solid ${checked ? '#4ade80' : 'rgba(255,255,255,0.15)'}` }}>
        <span className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full transition-all duration-200"
          style={{ background: checked ? '#131313' : '#988d9f', transform: checked ? 'translateX(16px)' : 'translateX(0)' }} />
      </div>
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <span className="material-symbols-outlined text-[16px] flex-shrink-0"
          style={{ color: checked ? '#4ade80' : '#5a4d63' }}>{icon}</span>
        <div>
          <p className="text-[13px] font-semibold text-[#e2e2e2] leading-tight">{label}</p>
          {hint && <p className="text-[11px] mt-0.5" style={{ color: '#5a4d63' }}>{hint}</p>}
        </div>
      </div>
      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
        style={{ background: checked ? 'rgba(74,222,128,0.12)' : 'rgba(255,107,107,0.1)', color: checked ? '#4ade80' : '#ff6b6b' }}>
        {checked ? 'ALLOW' : 'DENY'}
      </span>
    </label>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function ProtectPdfTool() {
  const [dragging, setDragging]     = useState(false);
  const [pdfFile, setPdfFile]       = useState<File | null>(null);
  const [pageCount, setPageCount]   = useState(0);
  const [loading, setLoading]       = useState(false);
  const [processing, setProcessing] = useState(false);
  const [done, setDone]             = useState(false);
  const [resultSize, setResultSize] = useState(0);
  const [state, setState]           = useState<ProtectState>(DEF);
  const [notif, setNotif]           = useState<Notif | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const dropRef  = useRef<HTMLDivElement>(null);

  const notify = useCallback((type: NotifType, msg: string) => {
    setNotif({ type, msg });
    setTimeout(() => setNotif(null), 8000);
  }, []);

  const set = useCallback(<K extends keyof ProtectState>(k: K, v: ProtectState[K]) =>
    setState(p => ({ ...p, [k]: v })), []);

  const setPerm = useCallback(<K extends keyof PermissionsOpts>(k: K, v: boolean) =>
    setState(p => ({ ...p, perms: { ...p.perms, [k]: v } })), []);

  // ── File ingestion ──────────────────────────────────────────────────────────

  const handleFile = useCallback(async (f: File) => {
    if (f.type !== 'application/pdf' && !f.name.toLowerCase().endsWith('.pdf')) {
      notify('error', `"${f.name}" is not a PDF.`); return;
    }
    if (f.size > 200 * 1024 * 1024) {
      notify('error', `File exceeds 200 MB (${fmt(f.size)}).`); return;
    }
    setLoading(true); setDone(false); setNotif(null);
    try {
      const pdfjs = await import('pdfjs-dist');
      pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
      const buf = await f.arrayBuffer();
      const doc = await pdfjs.getDocument({ data: buf }).promise;
      setPageCount(doc.numPages);
      setPdfFile(f);
    } catch {
      notify('error', 'Could not read the PDF. It may be corrupted.');
    } finally { setLoading(false); }
  }, [notify]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const f = e.dataTransfer.files[0]; if (f) handleFile(f);
  }, [handleFile]);

  // ── Validation ──────────────────────────────────────────────────────────────

  const strength = scorePassword(state.userPw);
  const errors: string[] = [];
  if (!state.userPw) errors.push('User password is required.');
  if (state.userPw.length > 0 && state.userPw.length < 4) errors.push('Password must be at least 4 characters.');
  if (state.userPw && state.confirmPw !== state.userPw) errors.push('Passwords do not match.');
  if (state.ownerPw && state.ownerPw === state.userPw) errors.push('Owner password must differ from user password.');
  const canProtect = !!pdfFile && errors.length === 0;

  // ── Process ─────────────────────────────────────────────────────────────────

  const handleProtect = useCallback(async () => {
    if (!pdfFile || !canProtect) return;
    setProcessing(true);
    try {
      const bytes    = await encryptPdf(pdfFile, state.userPw, state.ownerPw, state.perms);
      const filename = pdfFile.name.replace(/\.pdf$/i, '') + '_protected.pdf';
      downloadPdf(bytes, filename);
      setResultSize(bytes.byteLength);
      setDone(true);
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'Failed to encrypt the PDF. Please try again.');
    } finally { setProcessing(false); }
  }, [pdfFile, canProtect, state, notify]);

  const handleReset = useCallback(() => {
    setPdfFile(null); setPageCount(0); setDone(false); setNotif(null);
    setState(DEF);
    if (inputRef.current) inputRef.current.value = '';
  }, []);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="mb-12 flex flex-col gap-6">

      {/* Drop zone */}
      {!pdfFile && (
        <div ref={dropRef}
          onDrop={onDrop}
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={e => { if (dropRef.current && !dropRef.current.contains(e.relatedTarget as Node)) setDragging(false); }}
          onClick={() => inputRef.current?.click()}
          role="button" tabIndex={0} aria-label="Upload PDF"
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click(); }}
          className="glass-panel rounded-2xl flex flex-col items-center justify-center gap-5 cursor-pointer transition-all duration-300 select-none outline-none focus-visible:ring-2 focus-visible:ring-[#ffb4ab]"
          style={{ padding: '64px 40px', border: `2px dashed ${dragging ? '#ffb4ab' : 'rgba(255,255,255,0.12)'}`, background: dragging ? 'rgba(255,180,171,0.06)' : undefined, transform: dragging ? 'scale(1.01)' : 'scale(1)' }}>
          <div className="w-20 h-20 rounded-2xl flex items-center justify-center transition-all duration-300"
            style={{ background: dragging ? 'rgba(255,180,171,0.2)' : 'rgba(255,180,171,0.1)', border: `1px solid ${dragging ? 'rgba(255,180,171,0.45)' : 'rgba(255,180,171,0.2)'}` }}>
            <span className="material-symbols-outlined text-[38px]" style={{ color: '#ffb4ab' }}>
              {dragging ? 'file_download' : 'lock'}
            </span>
          </div>
          <div className="text-center">
            <p className="text-[18px] font-bold text-[#e2e2e2] mb-1.5">
              {dragging ? 'Drop your PDF here' : 'Drag & drop your PDF here'}
            </p>
            <p className="text-[14px] text-[#988d9f]">
              or <span className="text-[#ffb4ab] font-semibold">click to browse</span>
              {' — PDF only · up to 200 MB'}
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            {['Password protection', 'RC4-128 encryption', 'Permission controls', 'Browser-local', 'Free'].map(f => (
              <span key={f} className="px-2.5 py-1 rounded-lg text-[11px] font-semibold"
                style={{ background: 'rgba(255,180,171,0.08)', color: '#ffb4ab', border: '1px solid rgba(255,180,171,0.15)' }}>{f}</span>
            ))}
          </div>
          <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="sr-only"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }}
            aria-hidden="true" tabIndex={-1} />
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="glass-panel rounded-2xl p-6 flex items-center gap-3" aria-live="polite" aria-busy="true">
          <span className="w-6 h-6 border-2 border-[#ffb4ab]/30 border-t-[#ffb4ab] rounded-full animate-spin flex-shrink-0" />
          <p className="text-[15px] font-bold text-[#e2e2e2]">Loading PDF…</p>
        </div>
      )}

      {/* Notification */}
      {notif && (
        <div role="alert" className="flex items-start gap-3 px-5 py-4 rounded-xl text-[14px] font-medium"
          style={{ background: notif.type === 'success' ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)', border: `1px solid ${notif.type === 'success' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`, color: notif.type === 'success' ? '#22c55e' : '#ef4444' }}>
          <span className="material-symbols-outlined text-[20px] flex-shrink-0 mt-0.5">{notif.type === 'success' ? 'check_circle' : 'error'}</span>
          <span className="flex-1 leading-relaxed">{notif.msg}</span>
          <button onClick={() => setNotif(null)} aria-label="Dismiss" className="opacity-60 hover:opacity-100 transition-opacity">
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
      )}

      {/* Editor */}
      {pdfFile && !loading && !done && (
        <div className="flex flex-col gap-5">

          {/* File header */}
          <div className="glass-panel rounded-2xl px-5 py-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(255,180,171,0.1)', border: '1px solid rgba(255,180,171,0.2)' }}>
              <span className="material-symbols-outlined text-[18px] text-[#ffb4ab]">picture_as_pdf</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-bold text-[#e2e2e2] truncate">{pdfFile.name}</p>
              <p className="text-[11px] text-[#5a4d63]">{fmt(pdfFile.size)} · {pageCount} page{pageCount !== 1 ? 's' : ''}</p>
            </div>
            <button onClick={handleReset} aria-label="Remove file"
              className="w-8 h-8 rounded-lg flex items-center justify-center opacity-50 hover:opacity-100 transition-opacity"
              style={{ background: 'rgba(255,255,255,0.05)' }}>
              <span className="material-symbols-outlined text-[16px] text-[#988d9f]">close</span>
            </button>
          </div>

          <div className="flex flex-col lg:flex-row gap-5 items-start">

            {/* Password panel */}
            <div className="glass-panel rounded-2xl p-5 flex flex-col gap-5 w-full lg:w-[400px] flex-shrink-0">

              {/* Encryption badge */}
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl"
                style={{ background: 'rgba(76,215,246,0.08)', border: '1px solid rgba(76,215,246,0.18)' }}>
                <span className="material-symbols-outlined text-[20px] text-[#4cd7f6]">shield</span>
                <div>
                  <p className="text-[13px] font-bold text-[#4cd7f6]">RC4-128 encryption</p>
                  <p className="text-[11px] text-[#5a4d63]">PDF Standard Security Handler Rev 3 · browser-only</p>
                </div>
              </div>

              {/* User password */}
              <div className="flex flex-col gap-3">
                <p className="text-[13px] font-bold text-[#e2e2e2]">
                  <span className="material-symbols-outlined text-[14px] mr-1.5 align-middle text-[#ffb4ab]">lock</span>
                  User Password
                  <span className="ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded"
                    style={{ background: 'rgba(255,107,107,0.15)', color: '#ff6b6b' }}>REQUIRED</span>
                </p>
                <PwField id="user-pw" label="Password" value={state.userPw}
                  show={state.showUser} onToggle={() => set('showUser', !state.showUser)}
                  onChange={v => set('userPw', v)} placeholder="Enter a strong password"
                  strength={strength} hint="Required to open the PDF" />
                <PwField id="confirm-pw" label="Confirm password" value={state.confirmPw}
                  show={state.showConfirm} onToggle={() => set('showConfirm', !state.showConfirm)}
                  onChange={v => set('confirmPw', v)} placeholder="Re-enter your password"
                  hint={
                    state.confirmPw && state.confirmPw !== state.userPw ? '⚠ Passwords do not match'
                    : state.confirmPw && state.confirmPw === state.userPw ? '✓ Passwords match'
                    : undefined
                  } />
              </div>

              <div className="h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />

              {/* Owner password */}
              <div className="flex flex-col gap-2">
                <p className="text-[13px] font-bold text-[#e2e2e2]">
                  <span className="material-symbols-outlined text-[14px] mr-1.5 align-middle text-[#4cd7f6]">admin_panel_settings</span>
                  Owner Password
                  <span className="ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded"
                    style={{ background: 'rgba(255,255,255,0.07)', color: '#5a4d63' }}>OPTIONAL</span>
                </p>
                <PwField id="owner-pw" label="Owner password" value={state.ownerPw}
                  show={state.showOwner} onToggle={() => set('showOwner', !state.showOwner)}
                  onChange={v => set('ownerPw', v)} placeholder="Leave blank to auto-generate"
                  hint="Required to change permissions or remove protection" />
              </div>

              {/* Validation errors */}
              {errors.length > 0 && state.userPw.length > 0 && (
                <div className="flex flex-col gap-1.5 px-4 py-3 rounded-xl"
                  style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                  {errors.map(e => (
                    <p key={e} className="text-[12px] font-medium flex items-center gap-2" style={{ color: '#ef4444' }}>
                      <span className="material-symbols-outlined text-[14px]">error</span>{e}
                    </p>
                  ))}
                </div>
              )}

              <div className="h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />

              <button onClick={handleProtect} disabled={processing || !canProtect}
                className="btn-primary w-full text-white font-bold text-[15px] py-3.5 rounded-xl flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed">
                {processing ? (
                  <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Encrypting…</>
                ) : (
                  <><span className="material-symbols-outlined text-[17px]">lock</span>Protect PDF</>
                )}
              </button>

              <button onClick={handleReset}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-semibold text-[#988d9f] hover:text-[#e2e2e2] transition-all"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <span className="material-symbols-outlined text-[15px]">restart_alt</span>Reset
              </button>
            </div>

            {/* Permissions + tips */}
            <div className="flex-1 min-w-0 flex flex-col gap-5">
              <div className="glass-panel rounded-2xl p-5 flex flex-col gap-2">
                <div className="flex items-center gap-2 mb-3">
                  <span className="material-symbols-outlined text-[18px] text-[#ffb4ab]">tune</span>
                  <p className="text-[13px] font-bold text-[#e2e2e2]">Permission Controls</p>
                </div>
                <p className="text-[12px] mb-4" style={{ color: '#5a4d63' }}>
                  Choose which actions are allowed when the PDF is opened with the user password.
                  Recipients need the owner password to override these restrictions.
                </p>
                <div className="flex flex-col divide-y" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                  <PermToggle label="Allow Printing" icon="print" hint="High-resolution printing"
                    checked={state.perms.allowPrinting} onChange={v => setPerm('allowPrinting', v)} />
                  <PermToggle label="Allow Copying Text" icon="content_copy" hint="Select and copy text"
                    checked={state.perms.allowCopying} onChange={v => setPerm('allowCopying', v)} />
                  <PermToggle label="Allow Editing" icon="edit" hint="Modify document content"
                    checked={state.perms.allowEditing} onChange={v => setPerm('allowEditing', v)} />
                  <PermToggle label="Allow Annotations" icon="comment" hint="Add comments and annotations"
                    checked={state.perms.allowAnnotations} onChange={v => setPerm('allowAnnotations', v)} />
                  <PermToggle label="Allow Form Filling" icon="edit_document" hint="Fill interactive form fields"
                    checked={state.perms.allowForms} onChange={v => setPerm('allowForms', v)} />
                </div>
              </div>

              <div className="glass-panel rounded-2xl p-5 flex flex-col gap-3">
                <p className="text-[12px] font-bold text-[#ffb4ab] uppercase tracking-wide">Password Tips</p>
                {[
                  { icon: 'check_circle', text: 'Use at least 8 characters for better security', color: '#4ade80' },
                  { icon: 'check_circle', text: 'Mix uppercase, lowercase, numbers and symbols', color: '#4ade80' },
                  { icon: 'warning',      text: 'Store your password safely — it cannot be recovered', color: '#facc15' },
                  { icon: 'info',         text: 'The owner password controls permission overrides', color: '#4cd7f6' },
                ].map(({ icon, text, color }) => (
                  <div key={text} className="flex items-start gap-2.5">
                    <span className="material-symbols-outlined text-[15px] mt-0.5 flex-shrink-0" style={{ color }}>{icon}</span>
                    <p className="text-[12px] leading-relaxed" style={{ color: '#988d9f' }}>{text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Done state */}
      {done && (
        <div className="flex flex-col gap-4">
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))' }}>
            {[
              { icon: 'lock',        label: 'Protection', value: 'Active',          color: '#ffb4ab' },
              { icon: 'description', label: 'Pages',      value: String(pageCount), color: '#4cd7f6' },
              { icon: 'download',    label: 'File size',  value: fmt(resultSize),   color: '#4ade80' },
            ].map(({ icon, label, value, color }) => (
              <div key={label} className="flex flex-col gap-1.5 rounded-xl p-4"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <span className="material-symbols-outlined text-[18px]" style={{ color }}>{icon}</span>
                <p className="text-[20px] font-extrabold leading-none" style={{ color }}>{value}</p>
                <p className="text-[11px] text-[#988d9f] font-semibold uppercase tracking-wide">{label}</p>
              </div>
            ))}
          </div>

          <div className="glass-panel rounded-2xl overflow-hidden">
            <div className="flex items-center gap-4 px-5 py-4 border-b border-[rgba(255,255,255,0.06)]">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.25)' }}>
                <span className="material-symbols-outlined text-[22px] text-[#22c55e]">check_circle</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-bold text-[#e2e2e2]">PDF protected with RC4-128 encryption</p>
                <p className="text-[12px] text-[#988d9f]">Downloaded automatically · keep your password safe</p>
              </div>
            </div>
            <div className="p-5 flex flex-col sm:flex-row gap-3">
              <button onClick={handleProtect} disabled={processing}
                className="btn-primary flex-1 text-white font-bold text-[15px] py-3.5 rounded-xl flex items-center justify-center gap-2 disabled:opacity-40">
                <span className="material-symbols-outlined text-[18px]">download</span>Download Again
              </button>
              <button onClick={handleReset}
                className="flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl text-[14px] font-semibold text-[#988d9f] hover:text-[#e2e2e2] transition-all"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <span className="material-symbols-outlined text-[16px]">upload_file</span>Protect Another PDF
              </button>
            </div>
          </div>

          <div className="flex items-start gap-3 px-4 py-3.5 rounded-xl text-[13px]"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', color: '#5a4d63' }}>
            <span className="material-symbols-outlined text-[16px] mt-0.5 flex-shrink-0">info</span>
            <span>Your PDF was encrypted using the PDF Standard Security Handler (RC4-128) in your browser. No files were uploaded to any server. Store your password securely — it cannot be recovered if lost.</span>
          </div>
        </div>
      )}

      {/* How it works */}
      {!pdfFile && !loading && (
        <div className="glass-panel rounded-2xl p-6 flex flex-col gap-3">
          <p className="text-[12px] font-semibold text-[#988d9f] uppercase tracking-[0.08em]">How it works</p>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            {[
              { icon: 'upload_file',  label: '1. Upload',       desc: 'Drop your PDF — it stays in your browser' },
              { icon: 'password',     label: '2. Set password', desc: 'Enter a user password and confirm it' },
              { icon: 'tune',         label: '3. Permissions',  desc: 'Choose which actions to allow or deny' },
              { icon: 'lock',         label: '4. Protect',      desc: 'Download your RC4-128 encrypted PDF' },
            ].map(({ icon, label, desc }) => (
              <div key={label} className="flex flex-col gap-2 p-4 rounded-xl"
                style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                <span className="material-symbols-outlined text-[22px] text-[#ffb4ab]">{icon}</span>
                <p className="text-[13px] font-bold text-[#e2e2e2]">{label}</p>
                <p className="text-[12px] text-[#5a4d63] leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
