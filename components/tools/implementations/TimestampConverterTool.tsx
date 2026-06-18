"use client";

import { useState, useCallback, useEffect, useId } from "react";

type Unit = "seconds" | "milliseconds";

function detectUnit(ts: number): Unit {
  return ts > 1e12 ? "milliseconds" : "seconds";
}

function tsToDate(ts: number, unit: Unit): Date {
  return new Date(unit === "seconds" ? ts * 1000 : ts);
}

function padZ(n: number, len = 2) { return String(n).padStart(len, "0"); }

function localDatetimeValue(d: Date): string {
  return `${d.getFullYear()}-${padZ(d.getMonth() + 1)}-${padZ(d.getDate())}T${padZ(d.getHours())}:${padZ(d.getMinutes())}:${padZ(d.getSeconds())}`;
}

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = useCallback(async () => {
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [text]);
  return (
    <button onClick={copy}
      className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold transition-all shrink-0"
      style={{ background: "rgba(255,255,255,0.05)", color: copied ? "#80e0a0" : "#988d9f", border: "1px solid rgba(255,255,255,0.08)" }}>
      <span className="material-symbols-outlined text-[12px]">{copied ? "check" : "content_copy"}</span>
      {copied ? "OK" : "Copy"}
    </button>
  );
}

function ResultRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl"
      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] font-bold uppercase tracking-wider mb-0.5" style={{ color: "#4d4354" }}>{label}</div>
        <div className="text-[13px] font-mono break-all" style={{ color: "#e8dff0" }}>{value}</div>
      </div>
      <CopyBtn text={value} />
    </div>
  );
}

export default function TimestampConverterTool() {
  const uid = useId();
  const [tsInput,    setTsInput]    = useState("");
  const [unit,       setUnit]       = useState<Unit>("seconds");
  const [dateInput,  setDateInput]  = useState("");
  const [tsResults,  setTsResults]  = useState<Record<string, string> | null>(null);
  const [dateResults,setDateResults]= useState<Record<string, string> | null>(null);
  const [tsError,    setTsError]    = useState<string | null>(null);
  const [dateError,  setDateError]  = useState<string | null>(null);
  const [now,        setNow]        = useState<number>(0);

  useEffect(() => {
    async function init() { setNow(Math.floor(Date.now() / 1000)); }
    init();
  }, []);

  const handleTsInput = useCallback((raw: string, u: Unit) => {
    setTsInput(raw);
    setTsResults(null);
    setTsError(null);
    const n = Number(raw.trim());
    if (!raw.trim()) return;
    if (isNaN(n)) { setTsError("Not a valid number."); return; }
    const d = tsToDate(n, u);
    if (isNaN(d.getTime())) { setTsError("Timestamp out of range."); return; }
    setTsResults({
      "UTC":       d.toUTCString(),
      "ISO 8601":  d.toISOString(),
      "Local":     d.toLocaleString(),
      "Seconds":   String(Math.floor(d.getTime() / 1000)),
      "Milliseconds": String(d.getTime()),
    });
  }, []);

  const handleDateInput = useCallback((raw: string) => {
    setDateInput(raw);
    setDateResults(null);
    setDateError(null);
    if (!raw) return;
    const d = new Date(raw);
    if (isNaN(d.getTime())) { setDateError("Invalid date/time."); return; }
    const secs = Math.floor(d.getTime() / 1000);
    setDateResults({
      "Unix (seconds)":      String(secs),
      "Unix (milliseconds)": String(d.getTime()),
      "UTC":                 d.toUTCString(),
      "ISO 8601":            d.toISOString(),
      "Local":               d.toLocaleString(),
    });
  }, []);

  const handleUnitChange = useCallback((u: Unit) => {
    setUnit(u);
    if (tsInput) handleTsInput(tsInput, u);
  }, [tsInput, handleTsInput]);

  const handleNow = useCallback(() => {
    const secs = Math.floor(Date.now() / 1000);
    const u: Unit = "seconds";
    setUnit(u);
    setTsInput(String(secs));
    handleTsInput(String(secs), u);
  }, [handleTsInput]);

  const handleDateNow = useCallback(() => {
    const d = new Date();
    const val = localDatetimeValue(d);
    setDateInput(val);
    handleDateInput(val);
  }, [handleDateInput]);

  return (
    <div className="mb-12 flex flex-col gap-6">

      {/* Current timestamp display */}
      {now > 0 && (
        <div className="glass-panel rounded-2xl p-4 flex flex-wrap items-center gap-3"
          style={{ border: "1px solid rgba(221,183,255,0.15)" }}>
          <span className="material-symbols-outlined text-[20px]" style={{ color: "#ddb7ff" }}>schedule</span>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "#4d4354" }}>Current Unix Timestamp</div>
            <div className="text-[16px] font-bold font-mono" style={{ color: "#ddb7ff" }}>{now.toLocaleString()}</div>
          </div>
          <CopyBtn text={String(now)} />
          <div className="flex-1" />
          <button onClick={handleNow}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[13px] font-semibold transition-all"
            style={{ background: "rgba(221,183,255,0.1)", color: "#ddb7ff", border: "1px solid rgba(221,183,255,0.2)" }}>
            <span className="material-symbols-outlined text-[15px]">my_location</span>Use current time
          </button>
        </div>
      )}

      {/* Timestamp → Date */}
      <div className="glass-panel rounded-2xl p-5 flex flex-col gap-4"
        style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]" style={{ color: "#4cd7f6" }}>pin</span>
          <span className="text-[14px] font-bold" style={{ color: "#4cd7f6" }}>Unix Timestamp → Human Date</span>
        </div>

        <div className="flex flex-wrap gap-3">
          <input
            id={`${uid}-ts`}
            type="number"
            value={tsInput}
            onChange={e => handleTsInput(e.target.value, unit)}
            placeholder="Enter Unix timestamp…"
            className="flex-1 min-w-48 rounded-xl px-3 py-2.5 text-sm font-mono outline-none transition-all"
            style={{ background: "rgba(255,255,255,0.05)", border: `1px solid ${tsError ? "rgba(255,100,100,0.4)" : "rgba(255,255,255,0.1)"}`, color: "#e8dff0" }}
          />
          {/* Unit toggle */}
          <div className="flex rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
            {(["seconds", "milliseconds"] as Unit[]).map(u => (
              <button key={u} onClick={() => handleUnitChange(u)}
                className="px-3 py-2 text-[12px] font-semibold transition-all"
                style={{ background: unit === u ? "rgba(76,215,246,0.15)" : "rgba(255,255,255,0.03)", color: unit === u ? "#4cd7f6" : "#988d9f" }}>
                {u === "seconds" ? "sec" : "ms"}
              </button>
            ))}
          </div>
          <button onClick={() => { const u = detectUnit(Number(tsInput)); setUnit(u); handleTsInput(tsInput, u); }}
            title="Auto-detect unit"
            className="flex items-center gap-1 px-3 py-2 rounded-xl text-[12px] font-semibold transition-all"
            style={{ background: "rgba(255,255,255,0.05)", color: "#988d9f", border: "1px solid rgba(255,255,255,0.08)" }}>
            <span className="material-symbols-outlined text-[14px]">auto_awesome</span>Auto
          </button>
        </div>

        {tsError && (
          <div className="flex items-center gap-2 text-[12px] font-semibold" style={{ color: "#ff8080" }}>
            <span className="material-symbols-outlined text-[14px]">error</span>{tsError}
          </div>
        )}

        {tsResults && (
          <div className="flex flex-col gap-2">
            {Object.entries(tsResults).map(([label, value]) => (
              <ResultRow key={label} label={label} value={value} />
            ))}
          </div>
        )}
      </div>

      {/* Date → Timestamp */}
      <div className="glass-panel rounded-2xl p-5 flex flex-col gap-4"
        style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]" style={{ color: "#ddb7ff" }}>calendar_today</span>
          <span className="text-[14px] font-bold" style={{ color: "#ddb7ff" }}>Human Date → Unix Timestamp</span>
        </div>

        <div className="flex flex-wrap gap-3">
          <input
            id={`${uid}-date`}
            type="datetime-local"
            value={dateInput}
            onChange={e => handleDateInput(e.target.value)}
            className="flex-1 min-w-48 rounded-xl px-3 py-2.5 text-sm font-mono outline-none transition-all"
            style={{ background: "rgba(255,255,255,0.05)", border: `1px solid ${dateError ? "rgba(255,100,100,0.4)" : "rgba(255,255,255,0.1)"}`, color: "#e8dff0", colorScheme: "dark" }}
          />
          <button onClick={handleDateNow}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-semibold transition-all"
            style={{ background: "rgba(221,183,255,0.1)", color: "#ddb7ff", border: "1px solid rgba(221,183,255,0.2)" }}>
            <span className="material-symbols-outlined text-[14px]">my_location</span>Now
          </button>
        </div>

        {dateError && (
          <div className="flex items-center gap-2 text-[12px] font-semibold" style={{ color: "#ff8080" }}>
            <span className="material-symbols-outlined text-[14px]">error</span>{dateError}
          </div>
        )}

        {dateResults && (
          <div className="flex flex-col gap-2">
            {Object.entries(dateResults).map(([label, value]) => (
              <ResultRow key={label} label={label} value={value} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
