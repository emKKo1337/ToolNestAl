"use client";

import { useState, useCallback, useEffect, useRef, useId } from "react";

// ─── Helpers ───────────────────────────────────────────────────────────────────
function generateUuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // RFC 4122 v4 fallback
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function generateBatch(count: number): string[] {
  return Array.from({ length: count }, generateUuid);
}

function downloadFile(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

type NotifType = "success" | "error" | "info";

// ─── Main component ────────────────────────────────────────────────────────────
export default function UuidGeneratorTool() {
  const uid = useId();

  const [count,    setCount]    = useState(10);
  const [uuids,    setUuids]    = useState<string[]>([]);
  const [filter,   setFilter]   = useState("");
  const [notif,    setNotif]    = useState<{ type: NotifType; message: string } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);

  const countInputId = `${uid}-count`;
  const filterInputId = `${uid}-filter`;
  const prevCountRef = useRef(count);

  const notify = useCallback((type: NotifType, msg: string) => {
    setNotif({ type, message: msg });
    if (type !== "info") setTimeout(() => setNotif(null), 4000);
  }, []);

  const generate = useCallback(() => {
    setUuids(generateBatch(count));
    setFilter("");
  }, [count]);

  // Auto-generate on mount
  useEffect(() => {
    async function init() { setUuids(generateBatch(10)); }
    init();
  }, []);

  const handleCountChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Math.min(1000, Math.max(1, parseInt(e.target.value, 10) || 1));
    setCount(val);
    prevCountRef.current = val;
  }, []);

  const handleReset = useCallback(() => {
    setCount(10);
    setFilter("");
    setNotif(null);
    setUuids(generateBatch(10));
  }, []);

  const handleCopySingle = useCallback(async (uuid: string) => {
    await navigator.clipboard.writeText(uuid);
    setCopiedId(uuid);
    setTimeout(() => setCopiedId(null), 2000);
  }, []);

  const handleCopyAll = useCallback(async () => {
    if (!uuids.length) { notify("error", "Nothing to copy."); return; }
    await navigator.clipboard.writeText(uuids.join("\n"));
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  }, [uuids, notify]);

  const handleDownloadTxt = useCallback(() => {
    if (!uuids.length) { notify("error", "Generate UUIDs first."); return; }
    downloadFile(uuids.join("\n"), "uuids.txt", "text/plain");
    notify("success", `Downloaded ${uuids.length} UUIDs as uuids.txt.`);
  }, [uuids, notify]);

  const handleDownloadCsv = useCallback(() => {
    if (!uuids.length) { notify("error", "Generate UUIDs first."); return; }
    const csv = "index,uuid\n" + uuids.map((u, i) => `${i + 1},${u}`).join("\n");
    downloadFile(csv, "uuids.csv", "text/csv");
    notify("success", `Downloaded ${uuids.length} UUIDs as uuids.csv.`);
  }, [uuids, notify]);

  // Filtered list
  const filtered = filter.trim()
    ? uuids.filter(u => u.includes(filter.trim().toLowerCase()))
    : uuids;

  return (
    <div className="mb-12 flex flex-col gap-4">

      {/* Controls */}
      <div className="glass-panel rounded-2xl p-4 flex flex-wrap items-end gap-4"
        style={{ border: "1px solid rgba(255,255,255,0.06)" }}>

        {/* Count input */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor={countInputId}
            className="text-[11px] font-semibold uppercase tracking-wider"
            style={{ color: "#988d9f" }}>
            Count (1–1000)
          </label>
          <input
            id={countInputId}
            type="number"
            min={1}
            max={1000}
            value={count}
            onChange={handleCountChange}
            className="rounded-xl px-3 py-2 text-sm font-mono w-28 outline-none transition-all"
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "#e8dff0",
            }}
          />
        </div>

        {/* Quick presets */}
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "#988d9f" }}>
            Quick
          </span>
          <div className="flex gap-1.5">
            {[1, 10, 50, 100].map(n => (
              <button
                key={n}
                onClick={() => { setCount(n); setUuids(generateBatch(n)); setFilter(""); }}
                className="px-3 py-2 rounded-xl text-[13px] font-semibold transition-all"
                style={{
                  background: count === n ? "rgba(221,183,255,0.15)" : "rgba(255,255,255,0.05)",
                  color: count === n ? "#ddb7ff" : "#988d9f",
                  border: `1px solid ${count === n ? "rgba(221,183,255,0.25)" : "rgba(255,255,255,0.08)"}`,
                }}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <div className="w-px h-10 self-end" style={{ background: "rgba(255,255,255,0.08)" }} />

        {/* Generate */}
        <button
          onClick={generate}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-bold transition-all"
          style={{ background: "rgba(221,183,255,0.15)", color: "#ddb7ff", border: "1px solid rgba(221,183,255,0.3)" }}
        >
          <span className="material-symbols-outlined text-[16px]">refresh</span>
          Regenerate
        </button>

        {/* Copy all */}
        <button
          onClick={handleCopyAll}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-semibold transition-all"
          style={{ background: "rgba(76,215,246,0.1)", color: copiedAll ? "#80e0a0" : "#4cd7f6", border: "1px solid rgba(76,215,246,0.2)" }}
        >
          <span className="material-symbols-outlined text-[16px]">{copiedAll ? "check" : "content_copy"}</span>
          {copiedAll ? "Copied!" : "Copy All"}
        </button>

        {/* Download TXT */}
        <button
          onClick={handleDownloadTxt}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-semibold transition-all"
          style={{ background: "rgba(255,255,255,0.05)", color: "#988d9f", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          <span className="material-symbols-outlined text-[16px]">download</span>
          TXT
        </button>

        {/* Download CSV */}
        <button
          onClick={handleDownloadCsv}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-semibold transition-all"
          style={{ background: "rgba(255,255,255,0.05)", color: "#988d9f", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          <span className="material-symbols-outlined text-[16px]">table_chart</span>
          CSV
        </button>

        <div className="w-px h-10 self-end" style={{ background: "rgba(255,255,255,0.08)" }} />

        {/* Reset */}
        <button
          onClick={handleReset}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-semibold transition-all"
          style={{ background: "rgba(255,100,100,0.08)", color: "#ff8080", border: "1px solid rgba(255,100,100,0.15)" }}
        >
          <span className="material-symbols-outlined text-[16px]">delete_sweep</span>
          Reset
        </button>
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

      {/* Stats bar */}
      {uuids.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex gap-3 flex-wrap">
            {[
              { label: "Generated", value: uuids.length.toLocaleString() },
              { label: "Showing",   value: filtered.length.toLocaleString() },
              { label: "Version",   value: "v4 (RFC 4122)" },
              { label: "Source",    value: typeof crypto !== "undefined" && typeof crypto.randomUUID === "function" ? "crypto.randomUUID()" : "Math.random fallback" },
            ].map(({ label, value }) => (
              <div key={label} className="glass-panel rounded-xl px-3 py-1.5 flex flex-col gap-0"
                style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
                <span className="text-sm font-bold tabular-nums" style={{ color: "#ddb7ff" }}>{value}</span>
                <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "#988d9f" }}>{label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search / filter */}
      {uuids.length > 0 && (
        <div className="relative">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[16px] pointer-events-none"
            style={{ color: "#4d4354" }}>
            search
          </span>
          <input
            id={filterInputId}
            type="text"
            value={filter}
            onChange={e => setFilter(e.target.value)}
            placeholder="Filter UUIDs…"
            className="w-full rounded-xl pl-9 pr-4 py-2.5 text-sm outline-none transition-all"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              color: "#e8dff0",
            }}
          />
          {filter && (
            <button
              onClick={() => setFilter("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 opacity-60 hover:opacity-100"
            >
              <span className="material-symbols-outlined text-[16px]" style={{ color: "#988d9f" }}>close</span>
            </button>
          )}
        </div>
      )}

      {/* UUID list */}
      {uuids.length > 0 && (
        <div className="glass-panel rounded-2xl overflow-hidden"
          style={{ border: "1px solid rgba(255,255,255,0.06)" }}>

          {/* Header */}
          <div className="flex items-center px-4 py-2.5 border-b"
            style={{ borderColor: "rgba(255,255,255,0.06)", background: "rgba(0,0,0,0.2)" }}>
            <span className="text-[11px] font-bold uppercase tracking-wider w-10 shrink-0" style={{ color: "#4d4354" }}>#</span>
            <span className="text-[11px] font-bold uppercase tracking-wider flex-1" style={{ color: "#4d4354" }}>UUID</span>
            <span className="text-[11px] font-bold uppercase tracking-wider w-16 text-right" style={{ color: "#4d4354" }}>Copy</span>
          </div>

          {/* Rows — virtualize for large lists */}
          <div className="overflow-y-auto" style={{ maxHeight: "480px" }}>
            {filtered.length === 0 ? (
              <div className="flex items-center justify-center py-12" style={{ color: "#4d4354" }}>
                <span className="material-symbols-outlined text-[32px] mr-2">search_off</span>
                No UUIDs match your filter.
              </div>
            ) : (
              filtered.map((uuid, i) => (
                <div
                  key={uuid}
                  className="flex items-center px-4 py-2.5 transition-colors group"
                  style={{
                    borderBottom: i < filtered.length - 1 ? "1px solid rgba(255,255,255,0.04)" : undefined,
                    background: copiedId === uuid ? "rgba(100,220,150,0.06)" : undefined,
                  }}
                >
                  <span className="w-10 shrink-0 text-[12px] tabular-nums" style={{ color: "#4d4354" }}>
                    {i + 1}
                  </span>
                  <span
                    className="flex-1 text-[13px] font-mono select-all"
                    style={{ color: "#e8dff0", letterSpacing: "0.02em" }}
                  >
                    {highlightFilter(uuid, filter)}
                  </span>
                  <button
                    onClick={() => handleCopySingle(uuid)}
                    className="w-16 flex justify-end items-center gap-1 text-[11px] font-semibold opacity-0 group-hover:opacity-100 transition-all"
                    style={{ color: copiedId === uuid ? "#80e0a0" : "#988d9f" }}
                  >
                    <span className="material-symbols-outlined text-[13px]">
                      {copiedId === uuid ? "check" : "content_copy"}
                    </span>
                    {copiedId === uuid ? "OK" : "Copy"}
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Highlight matching filter text ───────────────────────────────────────────
function highlightFilter(uuid: string, filter: string): React.ReactNode {
  if (!filter.trim()) return uuid;
  const q = filter.trim().toLowerCase();
  const idx = uuid.toLowerCase().indexOf(q);
  if (idx === -1) return uuid;
  return (
    <>
      {uuid.slice(0, idx)}
      <mark style={{ background: "rgba(221,183,255,0.25)", color: "#ddb7ff", borderRadius: "2px" }}>
        {uuid.slice(idx, idx + q.length)}
      </mark>
      {uuid.slice(idx + q.length)}
    </>
  );
}
