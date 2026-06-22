"use client";

import { useState, useMemo, useCallback, useRef } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────
type InputMode = "url" | "text";
type NgramSize = 1 | 2 | 3 | 4;
type SortKey   = "frequency" | "density" | "alpha" | "first";
type SortDir   = "asc" | "desc";

interface Filters {
  ignoreStopWords: boolean;
  ignoreNumbers:   boolean;
  ignoreShort:     boolean;
  minLength:       number;
  customIgnore:    string;  // comma-separated
}

interface NgramRow {
  phrase:    string;
  frequency: number;
  density:   number;   // percent
  firstPos:  number;   // 1-based word index
  lastPos:   number;
}

interface Recommendation { level: "error" | "warning" | "info"; text: string; }

// ── Stop words ────────────────────────────────────────────────────────────────
const STOP = new Set([
  "a","about","above","after","again","against","all","am","an","and","any","are","aren't",
  "as","at","be","because","been","before","being","below","between","both","but","by",
  "can","can't","cannot","could","couldn't","did","didn't","do","does","doesn't","doing",
  "don't","down","during","each","few","for","from","further","get","got","had","hadn't",
  "has","hasn't","have","haven't","having","he","he'd","he'll","he's","her","here","here's",
  "hers","herself","him","himself","his","how","how's","i","i'd","i'll","i'm","i've","if",
  "in","into","is","isn't","it","it's","its","itself","let","let's","me","more","most",
  "mustn't","my","myself","no","nor","not","of","off","on","once","only","or","other",
  "ought","our","ours","ourselves","out","over","own","same","shan't","she","she'd","she'll",
  "she's","should","shouldn't","so","some","such","than","that","that's","the","their","theirs",
  "them","themselves","then","there","there's","these","they","they'd","they'll","they're",
  "they've","this","those","through","to","too","under","until","up","very","was","wasn't",
  "we","we'd","we'll","we're","we've","were","weren't","what","what's","when","when's","where",
  "where's","which","while","who","who's","whom","why","why's","will","with","won't","would",
  "wouldn't","you","you'd","you'll","you're","you've","your","yours","yourself","yourselves",
  "also","just","like","make","use","used","using","one","two","three","new","may","well",
  "us","its","we","by","at","or","an","as","on","if","in","to","of","is","it","be","he",
  "vs","via","per","ie","eg","etc","and/or",
]);

// ── Text processing ───────────────────────────────────────────────────────────
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s'-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
}

function applyFilters(tokens: string[], filters: Filters): string[] {
  const customSet = new Set(
    filters.customIgnore.split(",").map(s => s.trim().toLowerCase()).filter(Boolean),
  );
  return tokens.filter(t => {
    if (filters.ignoreStopWords && STOP.has(t)) return false;
    if (filters.ignoreNumbers && /^\d+$/.test(t)) return false;
    if (filters.ignoreShort && t.length < filters.minLength) return false;
    if (customSet.has(t)) return false;
    return true;
  });
}

function buildNgrams(tokens: string[], size: NgramSize): NgramRow[] {
  if (tokens.length === 0) return [];
  const freq = new Map<string, { count: number; first: number; last: number }>();
  for (let i = 0; i <= tokens.length - size; i++) {
    const phrase = tokens.slice(i, i + size).join(" ");
    const existing = freq.get(phrase);
    if (existing) {
      existing.count++;
      existing.last = i + 1;
    } else {
      freq.set(phrase, { count: 1, first: i + 1, last: i + 1 });
    }
  }
  const total = tokens.length;
  return Array.from(freq.entries())
    .map(([phrase, { count, first, last }]) => ({
      phrase,
      frequency: count,
      density: parseFloat(((count / total) * 100).toFixed(2)),
      firstPos: first,
      lastPos: last,
    }))
    .filter(r => r.frequency > 1 || size === 1);
}

function scoreContent(
  tokens: string[],
  rows: NgramRow[],
  rawWordCount: number,
): { score: number; recommendations: Recommendation[] } {
  const recs: Recommendation[] = [];
  let score = 100;

  if (rawWordCount < 50) {
    recs.push({ level: "error", text: "Very short content (< 50 words) — too little text to perform meaningful keyword analysis." });
    score -= 40;
  } else if (rawWordCount < 200) {
    recs.push({ level: "warning", text: `Short content (${rawWordCount} words) — pages with fewer than 300 words often struggle to rank. Consider expanding the content.` });
    score -= 15;
  } else if (rawWordCount >= 600) {
    recs.push({ level: "info", text: `Content length is good (${rawWordCount} words).` });
  } else {
    score += 0;
  }

  if (tokens.length === 0) {
    recs.push({ level: "warning", text: "No keywords remain after filtering — relax the filters to see results." });
    return { score: Math.max(0, score), recommendations: recs };
  }

  const top = rows.slice(0, 5);
  if (top.length > 0) {
    const topDensity = top[0].density;
    if (topDensity > 6) {
      recs.push({ level: "error", text: `Top keyword "${top[0].phrase}" density is ${topDensity}% — this is likely keyword stuffing. Keep primary keyword density below 3%.` });
      score -= 30;
    } else if (topDensity > 3) {
      recs.push({ level: "warning", text: `Top keyword "${top[0].phrase}" density is ${topDensity}% — this may be over-optimised. Ideal range is 1–2.5%.` });
      score -= 15;
    } else if (topDensity < 0.5 && rawWordCount >= 200) {
      recs.push({ level: "warning", text: `Top keyword density is only ${topDensity}% — consider using your primary keyword more naturally throughout the content.` });
      score -= 10;
    } else {
      recs.push({ level: "info", text: `Top keyword "${top[0].phrase}" density is ${topDensity}% — within the healthy 0.5–3% range.` });
    }
  }

  const uniqueRatio = tokens.length > 0 ? (new Set(tokens).size / tokens.length) : 0;
  if (uniqueRatio > 0.7) {
    recs.push({ level: "info", text: `Good vocabulary diversity (${Math.round(uniqueRatio * 100)}% unique terms) — signals natural, non-stuffed content.` });
  } else if (uniqueRatio < 0.4) {
    recs.push({ level: "warning", text: `Low vocabulary diversity (${Math.round(uniqueRatio * 100)}% unique terms) — content may be repetitive.` });
    score -= 10;
  }

  if (rows.length > 0 && top[0]?.frequency === 1) {
    recs.push({ level: "info", text: "All keywords appear exactly once — add a few more repetitions of your primary keyword to signal relevance." });
    score -= 5;
  }

  return { score: Math.min(100, Math.max(0, score)), recommendations: recs };
}

// ── Constants ─────────────────────────────────────────────────────────────────
const ACCENT = "#f97316";
const PAGE_SIZE = 25;
const DENSITY_COLORS = ["#f97316", "#60a5fa", "#a78bfa", "#34d399", "#f472b6", "#fbbf24", "#94a3b8", "#e879f9", "#22d3ee", "#fb923c"];

const DEFAULT_FILTERS: Filters = {
  ignoreStopWords: true,
  ignoreNumbers:   true,
  ignoreShort:     true,
  minLength:       3,
  customIgnore:    "",
};

// ── Sub-components (outside main to prevent remounting) ───────────────────────
function PanelHeader({ icon, title, badge }: { icon: string; title: string; badge?: string }) {
  return (
    <div className="flex items-center gap-2 pb-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
      <span className="material-symbols-outlined text-[16px]" style={{ color: ACCENT }}>{icon}</span>
      <p className="text-[13px] font-bold" style={{ color: "#e8dff0" }}>{title}</p>
      {badge && (
        <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full"
          style={{ background: "rgba(249,115,22,0.1)", color: ACCENT }}>{badge}</span>
      )}
    </div>
  );
}

function Toggle({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-start gap-3 cursor-pointer">
      <div className="relative mt-0.5 shrink-0">
        <input type="checkbox" className="sr-only" checked={checked} onChange={e => onChange(e.target.checked)} />
        <div className="w-9 h-5 rounded-full transition-all"
          style={{ background: checked ? "rgba(249,115,22,0.25)" : "rgba(255,255,255,0.06)", border: `1px solid ${checked ? "rgba(249,115,22,0.5)" : "rgba(255,255,255,0.12)"}` }} />
        <div className="absolute top-0.5 w-4 h-4 rounded-full transition-all"
          style={{ left: checked ? "18px" : "2px", background: checked ? ACCENT : "rgba(255,255,255,0.3)" }} />
      </div>
      <div>
        <p className="text-[13px] font-semibold" style={{ color: "#e8dff0" }}>{label}</p>
        {hint && <p className="text-[11px] mt-0.5" style={{ color: "#988d9f" }}>{hint}</p>}
      </div>
    </label>
  );
}

function SortHeader({ label, sortKey, current, dir, onSort }: { label: string; sortKey: SortKey; current: SortKey; dir: SortDir; onSort: (k: SortKey) => void }) {
  const active = current === sortKey;
  return (
    <button onClick={() => onSort(sortKey)} className="flex items-center gap-1 font-bold text-[11px] uppercase tracking-wider transition-all"
      style={{ color: active ? ACCENT : "#988d9f" }}>
      {label}
      <span className="material-symbols-outlined text-[13px]">
        {active ? (dir === "asc" ? "arrow_upward" : "arrow_downward") : "unfold_more"}
      </span>
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function KeywordDensityCheckerTool() {
  const [inputMode, setInputMode] = useState<InputMode>("url");
  const [url,       setUrl]       = useState("");
  const [pasteText, setPasteText] = useState("");
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState("");
  const [rawText,   setRawText]   = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [fetchedAt, setFetchedAt] = useState("");

  const [filters,   setFilters]   = useState<Filters>(DEFAULT_FILTERS);
  const [ngramSize, setNgramSize] = useState<NgramSize>(1);
  const [sortKey,   setSortKey]   = useState<SortKey>("frequency");
  const [sortDir,   setSortDir]   = useState<SortDir>("desc");
  const [search,    setSearch]    = useState("");
  const [page,      setPage]      = useState(1);
  const [copied,    setCopied]    = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const setFilter = useCallback(<K extends keyof Filters>(k: K, v: Filters[K]) =>
    setFilters(p => ({ ...p, [k]: v })), []);

  // ── Analysis pipeline ─────────────────────────────────────────────────────
  const activeText = rawText || (inputMode === "text" ? pasteText : "");

  const allTokens = useMemo(() => tokenize(activeText), [activeText]);
  const filteredTokens = useMemo(() => applyFilters(allTokens, filters), [allTokens, filters]);

  const allRows = useMemo(
    () => buildNgrams(filteredTokens, ngramSize).sort((a, b) => b.frequency - a.frequency),
    [filteredTokens, ngramSize],
  );

  const { score, recommendations } = useMemo(
    () => scoreContent(filteredTokens, allRows, allTokens.length),
    [filteredTokens, allRows, allTokens],
  );

  const scoreColor = score >= 71 ? "#22c55e" : score >= 41 ? "#f59e0b" : "#ef4444";
  const scoreLabel = score >= 71 ? "Good" : score >= 41 ? "Needs work" : "Poor";

  const stats = useMemo(() => ({
    totalWords:  allTokens.length,
    uniqueWords: new Set(allTokens).size,
    readingTime: Math.max(1, Math.round(allTokens.length / 200)),
    totalFiltered: filteredTokens.length,
    uniqueFiltered: new Set(filteredTokens).size,
  }), [allTokens, filteredTokens]);

  // Search + sort
  const displayRows = useMemo(() => {
    let rows = allRows;
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(r => r.phrase.includes(q));
    }
    return [...rows].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "frequency") cmp = a.frequency - b.frequency;
      else if (sortKey === "density") cmp = a.density - b.density;
      else if (sortKey === "alpha")   cmp = a.phrase.localeCompare(b.phrase);
      else if (sortKey === "first")   cmp = a.firstPos - b.firstPos;
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [allRows, search, sortKey, sortDir]);

  const paginated = useMemo(() => displayRows.slice(0, page * PAGE_SIZE), [displayRows, page]);
  const hasMore = displayRows.length > page * PAGE_SIZE;

  const top10 = useMemo(() => allRows.slice(0, 10), [allRows]);
  const maxFreq = top10[0]?.frequency ?? 1;

  const handleSort = useCallback((k: SortKey) => {
    setSortKey(prev => {
      if (prev === k) setSortDir(d => d === "asc" ? "desc" : "asc");
      else { setSortDir("desc"); }
      return k;
    });
    setPage(1);
  }, []);

  // ── Fetch URL ─────────────────────────────────────────────────────────────
  const analyze = useCallback(async () => {
    if (inputMode === "text") {
      if (!pasteText.trim()) { setError("Please paste some text."); return; }
      setRawText(""); setSourceUrl(""); setFetchedAt(""); setError("");
      setPage(1); setSearch("");
      return;
    }
    const trimmed = url.trim();
    if (!trimmed) { setError("Please enter a URL."); return; }
    setError(""); setLoading(true); setRawText(""); setPage(1); setSearch("");
    try {
      const encoded = encodeURIComponent(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
      const res = await fetch(`/api/analyze-keywords?url=${encoded}`);
      const data = await res.json() as { text?: string; url?: string; fetchedAt?: string; error?: string };
      if (data.error) { setError(data.error); }
      else {
        setRawText(data.text ?? "");
        setSourceUrl(data.url ?? trimmed);
        setFetchedAt(data.fetchedAt ?? "");
      }
    } catch {
      setError("Network error — please try again.");
    } finally {
      setLoading(false);
    }
  }, [inputMode, url, pasteText]);

  const handleKey = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") analyze();
  }, [analyze]);

  const reset = useCallback(() => {
    setUrl(""); setPasteText(""); setRawText(""); setSourceUrl(""); setFetchedAt("");
    setError(""); setCopied(false); setSearch(""); setPage(1);
    setFilters(DEFAULT_FILTERS); setNgramSize(1); setSortKey("frequency"); setSortDir("desc");
  }, []);

  const hasResults = activeText.trim().length > 0 && allRows.length > 0;

  // ── Exports ───────────────────────────────────────────────────────────────
  const exportCsv = useCallback(() => {
    const header = "Phrase,Frequency,Density (%),First Position,Last Position\n";
    const rows   = allRows.map(r => `"${r.phrase}",${r.frequency},${r.density},${r.firstPos},${r.lastPos}`).join("\n");
    const blob   = new Blob([header + rows], { type: "text/csv" });
    const u      = URL.createObjectURL(blob);
    Object.assign(document.createElement("a"), { href: u, download: "keyword-density.csv" }).click();
    URL.revokeObjectURL(u);
  }, [allRows]);

  const exportJson = useCallback(() => {
    const data = { source: sourceUrl || "pasted text", fetchedAt, score, stats, ngrams: allRows };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const u    = URL.createObjectURL(blob);
    Object.assign(document.createElement("a"), { href: u, download: "keyword-density.json" }).click();
    URL.revokeObjectURL(u);
  }, [sourceUrl, fetchedAt, score, stats, allRows]);

  const exportTxt = useCallback(() => {
    const lines = [
      `Keyword Density Analysis`,
      sourceUrl ? `Source: ${sourceUrl}` : "Source: pasted text",
      `Score: ${score}/100`,
      `Total words: ${stats.totalWords}  |  Unique: ${stats.uniqueWords}  |  Reading time: ~${stats.readingTime} min`,
      "",
      "=== TOP KEYWORDS ===",
      ...allRows.slice(0, 50).map(r => `${r.phrase.padEnd(40)} ${r.frequency}x  ${r.density}%  pos ${r.firstPos}`),
      "",
      "=== RECOMMENDATIONS ===",
      ...recommendations.map(r => `[${r.level.toUpperCase()}] ${r.text}`),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const u    = URL.createObjectURL(blob);
    Object.assign(document.createElement("a"), { href: u, download: "keyword-density.txt" }).click();
    URL.revokeObjectURL(u);
  }, [sourceUrl, score, stats, allRows, recommendations]);

  const exportPdf = useCallback(() => {
    const topRows = allRows.slice(0, 30).map(r =>
      `<tr><td>${r.phrase}</td><td style="text-align:center">${r.frequency}</td><td style="text-align:center">${r.density}%</td><td style="text-align:center">${r.firstPos}</td></tr>`
    ).join("");
    const recHtml = recommendations.map(r =>
      `<div class="rec rec-${r.level}">[${r.level.toUpperCase()}] ${r.text}</div>`
    ).join("");
    const html = `<!DOCTYPE html><html><head><title>Keyword Density — ${sourceUrl || "pasted text"}</title>
<style>body{font-family:system-ui,sans-serif;max-width:800px;margin:2rem auto;color:#111;font-size:14px}
h1{font-size:20px}h2{font-size:15px;margin-top:24px;border-bottom:1px solid #ddd;padding-bottom:4px}
.score{font-size:36px;font-weight:900;color:${scoreColor}}
.stats{display:flex;flex-wrap:wrap;gap:12px;margin-top:8px}
.stat{background:#f5f5f5;border-radius:6px;padding:8px 14px;text-align:center}
.stat b{display:block;font-size:18px}.stat span{font-size:11px;color:#555}
table{width:100%;border-collapse:collapse;margin-top:8px}
th,td{text-align:left;padding:5px 8px;border-bottom:1px solid #eee;font-size:12px}
th{font-weight:700;color:#555;background:#fafafa}
.rec{padding:4px 8px;border-radius:4px;margin-bottom:4px;font-size:13px}
.rec-error{background:#fee2e2;color:#991b1b}.rec-warning{background:#fef9c3;color:#854d0e}.rec-info{background:#eff6ff;color:#1e40af}
</style></head><body>
<h1>Keyword Density Analysis</h1>
<p style="color:#555">${sourceUrl || "Pasted text"}</p>
<div class="score">${score}<span style="font-size:16px;font-weight:400;color:#555"> / 100 ${scoreLabel}</span></div>
<h2>Statistics</h2>
<div class="stats">
<div class="stat"><b>${stats.totalWords}</b><span>Total Words</span></div>
<div class="stat"><b>${stats.uniqueWords}</b><span>Unique Words</span></div>
<div class="stat"><b>~${stats.readingTime} min</b><span>Reading Time</span></div>
<div class="stat"><b>${allRows.length}</b><span>Keywords Found</span></div>
</div>
<h2>Top 30 Keywords</h2>
<table><thead><tr><th>Phrase</th><th>Frequency</th><th>Density</th><th>First Position</th></tr></thead>
<tbody>${topRows}</tbody></table>
<h2>Recommendations</h2>${recHtml}
</body></html>`;
    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); w.print(); }
  }, [sourceUrl, score, scoreLabel, scoreColor, stats, allRows, recommendations]);

  const copyResults = useCallback(async () => {
    const lines = [
      `Keyword Density — Score: ${score}/100`,
      `Total words: ${stats.totalWords}`,
      "",
      ...allRows.slice(0, 20).map(r => `${r.phrase}: ${r.frequency}x (${r.density}%)`),
    ];
    try { await navigator.clipboard.writeText(lines.join("\n")); } catch { /* blocked */ }
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  }, [score, stats, allRows]);

  // ── Render ────────────────────────────────────────────────────────────────
  const inputCls = "w-full rounded-xl px-3 py-2.5 text-[13px] outline-none transition-all bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] focus:border-[rgba(249,115,22,0.4)] text-[#e8dff0] placeholder-[#3d3345]";
  const selectCls = "rounded-xl px-2.5 py-2 text-[13px] outline-none transition-all cursor-pointer bg-[#1a1525] border border-[rgba(255,255,255,0.08)] focus:border-[rgba(249,115,22,0.4)] text-[#e8dff0]";

  return (
    <div className="mb-12 flex flex-col gap-6">

      {/* ── Input panel ───────────────────────────────────── */}
      <div className="glass-panel rounded-2xl p-5 flex flex-col gap-4" style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
        <PanelHeader icon="manage_search" title="Analyze Content" />

        {/* Mode tabs */}
        <div className="flex rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.08)", width: "fit-content" }}>
          {(["url", "text"] as InputMode[]).map(m => (
            <button key={m} onClick={() => { setInputMode(m); setError(""); }}
              className="px-4 py-2 text-[12px] font-bold transition-all"
              style={inputMode === m
                ? { background: "rgba(249,115,22,0.15)", color: ACCENT }
                : { background: "transparent", color: "#988d9f" }}>
              {m === "url" ? "Website URL" : "Paste Text"}
            </button>
          ))}
        </div>

        {inputMode === "url" ? (
          <div className="flex gap-3 flex-wrap sm:flex-nowrap">
            <input type="url" value={url} onChange={e => setUrl(e.target.value)} onKeyDown={handleKey}
              placeholder="https://example.com" aria-label="Website URL"
              className={inputCls} style={{ flex: 1 }} />
            <button onClick={analyze} disabled={loading}
              className="btn-primary flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm shrink-0 disabled:opacity-60">
              <span className="material-symbols-outlined text-[16px]">{loading ? "hourglass_top" : "search"}</span>
              {loading ? "Analyzing…" : "Analyze"}
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <textarea ref={textareaRef} value={pasteText} onChange={e => setPasteText(e.target.value)}
              placeholder="Paste your content here…" rows={7} aria-label="Content to analyze"
              className={`${inputCls} resize-y min-h-[120px]`} />
            <div className="flex gap-3 flex-wrap">
              <button onClick={analyze}
                className="btn-primary flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm">
                <span className="material-symbols-outlined text-[16px]">analytics</span>Analyze
              </button>
              <span className="text-[11px] self-center" style={{ color: "#3d3345" }}>
                {pasteText.split(/\s+/).filter(Boolean).length} words
              </span>
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 px-4 py-3 rounded-xl"
            style={{ background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.2)" }}>
            <span className="material-symbols-outlined text-[15px] mt-0.5 shrink-0 text-red-400">error</span>
            <p className="text-[13px]" style={{ color: "#fca5a5" }}>{error}</p>
          </div>
        )}
        {loading && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl"
            style={{ background: "rgba(249,115,22,0.06)", border: "1px solid rgba(249,115,22,0.15)" }}>
            <div className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin shrink-0"
              style={{ borderColor: `${ACCENT} transparent ${ACCENT} ${ACCENT}` }} />
            <p className="text-[13px]" style={{ color: ACCENT }}>Fetching and extracting page content…</p>
          </div>
        )}
      </div>

      {/* ── Filters + ngram ───────────────────────────────── */}
      {(activeText || hasResults) && (
        <div className="glass-panel rounded-2xl p-5 flex flex-col gap-5" style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
          <PanelHeader icon="tune" title="Filters" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Toggle label="Ignore Stop Words" hint="Filter common words (the, is, and…)" checked={filters.ignoreStopWords} onChange={v => { setFilter("ignoreStopWords", v); setPage(1); }} />
            <Toggle label="Ignore Numbers"    hint="Skip purely numeric tokens"          checked={filters.ignoreNumbers}   onChange={v => { setFilter("ignoreNumbers",   v); setPage(1); }} />
            <Toggle label="Ignore Short Words" hint={`Skip words shorter than minimum`}  checked={filters.ignoreShort}     onChange={v => { setFilter("ignoreShort",     v); setPage(1); }} />
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold" style={{ color: "#988d9f" }}>Min Word Length</label>
              <input type="number" min={1} max={10} value={filters.minLength}
                onChange={e => { setFilter("minLength", Math.max(1, parseInt(e.target.value) || 1)); setPage(1); }}
                className={inputCls} style={{ width: "100px" }} disabled={!filters.ignoreShort} />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold" style={{ color: "#988d9f" }}>Custom Ignore List <span className="font-normal" style={{ color: "#3d3345" }}>(comma-separated)</span></label>
            <input value={filters.customIgnore} onChange={e => { setFilter("customIgnore", e.target.value); setPage(1); }}
              placeholder="brand, company, click, read…" className={inputCls} />
          </div>

          {/* N-gram size */}
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-[12px] font-bold" style={{ color: "#988d9f" }}>Phrase length:</span>
            {([1, 2, 3, 4] as NgramSize[]).map(n => (
              <button key={n} onClick={() => { setNgramSize(n); setPage(1); setSearch(""); }}
                className="px-3 py-1.5 rounded-xl text-[12px] font-bold transition-all"
                style={ngramSize === n
                  ? { background: "rgba(249,115,22,0.15)", color: ACCENT, border: "1px solid rgba(249,115,22,0.3)" }
                  : { background: "rgba(255,255,255,0.04)", color: "#988d9f", border: "1px solid rgba(255,255,255,0.08)" }}>
                {n === 1 ? "1 word" : `${n} words`}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Results ───────────────────────────────────────── */}
      {hasResults && (
        <>
          {/* Score + recommendations */}
          <div className="glass-panel rounded-2xl p-5 flex flex-wrap items-start gap-6"
            style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
            <div className="flex flex-col items-center gap-1.5 shrink-0">
              <div className="relative w-24 h-24">
                <svg width="96" height="96" viewBox="0 0 96 96" aria-label={`Score ${score}/100`}>
                  <circle cx="48" cy="48" r="40" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="7" />
                  <circle cx="48" cy="48" r="40" fill="none"
                    stroke={scoreColor} strokeWidth="7"
                    strokeDasharray={2 * Math.PI * 40}
                    strokeDashoffset={2 * Math.PI * 40 * (1 - score / 100)}
                    strokeLinecap="round" transform="rotate(-90 48 48)"
                    style={{ transition: "stroke-dashoffset 0.6s ease, stroke 0.4s ease" }} />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-[26px] font-black tabular-nums" style={{ color: scoreColor, lineHeight: 1 }}>{score}</span>
                  <span className="text-[9px] font-bold" style={{ color: scoreColor, opacity: 0.7 }}>/ 100</span>
                </div>
              </div>
              <span className="text-[11px] font-bold" style={{ color: scoreColor }}>{scoreLabel}</span>
              <span className="text-[10px]" style={{ color: "#3d3345" }}>Optimization</span>
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-bold mb-3" style={{ color: "#e8dff0" }}>Recommendations</p>
              <ul className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-1">
                {recommendations.map((rec, i) => {
                  const ic = rec.level === "error" ? "#ef4444" : rec.level === "warning" ? "#f59e0b" : "#60a5fa";
                  const ig = rec.level === "error" ? "error" : rec.level === "warning" ? "warning" : "info";
                  return (
                    <li key={i} className="flex items-start gap-2">
                      <span className="material-symbols-outlined text-[14px] mt-0.5 shrink-0" style={{ color: ic }}>{ig}</span>
                      <span className="text-[12px] leading-relaxed" style={{ color: "#c8b89f" }}>{rec.text}</span>
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* Export actions */}
            <div className="flex flex-wrap gap-2 w-full pt-4" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
              <button onClick={copyResults} className="btn-primary flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm">
                <span className="material-symbols-outlined text-[15px]">{copied ? "check" : "content_copy"}</span>
                {copied ? "Copied!" : "Copy"}
              </button>
              <button onClick={exportCsv} className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all"
                style={{ background: "rgba(249,115,22,0.09)", color: ACCENT, border: "1px solid rgba(249,115,22,0.22)" }}>
                <span className="material-symbols-outlined text-[14px]">table_chart</span>CSV
              </button>
              <button onClick={exportJson} className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all"
                style={{ background: "rgba(255,255,255,0.04)", color: "#c8c0d0", border: "1px solid rgba(255,255,255,0.08)" }}>
                <span className="material-symbols-outlined text-[14px]">data_object</span>JSON
              </button>
              <button onClick={exportTxt} className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all"
                style={{ background: "rgba(255,255,255,0.04)", color: "#c8c0d0", border: "1px solid rgba(255,255,255,0.08)" }}>
                <span className="material-symbols-outlined text-[14px]">description</span>TXT
              </button>
              <button onClick={exportPdf} className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all"
                style={{ background: "rgba(255,255,255,0.04)", color: "#c8c0d0", border: "1px solid rgba(255,255,255,0.08)" }}>
                <span className="material-symbols-outlined text-[14px]">print</span>PDF
              </button>
              <button onClick={reset} className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all ml-auto"
                style={{ background: "rgba(255,255,255,0.03)", color: "#988d9f", border: "1px solid rgba(255,255,255,0.07)" }}>
                <span className="material-symbols-outlined text-[14px]">restart_alt</span>Reset
              </button>
            </div>
          </div>

          {/* Stats cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { icon: "format_list_numbered", label: "Total Words",   value: stats.totalWords,    color: ACCENT },
              { icon: "spellcheck",           label: "Unique Words",  value: stats.uniqueWords,   color: "#60a5fa" },
              { icon: "schedule",             label: "Reading Time",  value: `~${stats.readingTime}m`, color: "#a78bfa" },
              { icon: "tag",                  label: "Keywords Found", value: allRows.length,     color: "#34d399" },
            ].map(({ icon, label, value, color }) => (
              <div key={label} className="glass-panel rounded-2xl p-4 flex flex-col gap-1.5"
                style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
                <span className="material-symbols-outlined text-[20px]" style={{ color }}>{icon}</span>
                <p className="text-[22px] font-black tabular-nums" style={{ color: "#e8dff0" }}>{value}</p>
                <p className="text-[11px] font-bold" style={{ color: "#988d9f" }}>{label}</p>
              </div>
            ))}
          </div>

          {/* Top 10 bar chart */}
          {top10.length > 0 && (
            <div className="glass-panel rounded-2xl p-5 flex flex-col gap-4"
              style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
              <PanelHeader icon="bar_chart" title="Top Keywords" badge={`${ngramSize === 1 ? "single words" : `${ngramSize}-word phrases`}`} />
              <div className="flex flex-col gap-2.5">
                {top10.map((row, i) => {
                  const pct = (row.frequency / maxFreq) * 100;
                  const color = DENSITY_COLORS[i % DENSITY_COLORS.length];
                  return (
                    <div key={row.phrase} className="flex items-center gap-3">
                      <span className="text-[10px] font-black tabular-nums w-5 shrink-0" style={{ color: "#3d3345" }}>{i + 1}</span>
                      <span className="text-[12px] font-mono w-36 sm:w-48 shrink-0 truncate" style={{ color: "#e8dff0" }}
                        title={row.phrase}>{row.phrase}</span>
                      <div className="flex-1 h-4 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                        <div className="h-full rounded-full transition-all flex items-center px-2"
                          style={{ width: `${pct}%`, background: `${color}55`, border: `1px solid ${color}88`, minWidth: "32px" }}>
                        </div>
                      </div>
                      <span className="text-[11px] font-bold tabular-nums w-8 text-right shrink-0" style={{ color }}>{row.frequency}x</span>
                      <span className="text-[10px] tabular-nums w-14 text-right shrink-0" style={{ color: "#3d3345" }}>{row.density}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Keyword table */}
          <div className="glass-panel rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
            <div className="px-5 py-4 flex items-center justify-between flex-wrap gap-3">
              <PanelHeader icon="table_chart" title="Keyword Table" badge={`${displayRows.length} rows`} />
              <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
                placeholder="Search keywords…" aria-label="Search keywords"
                className="rounded-xl px-3 py-2 text-[12px] outline-none transition-all bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] focus:border-[rgba(249,115,22,0.4)] text-[#e8dff0] placeholder-[#3d3345]"
                style={{ width: "200px" }} />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px]">
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}>
                    <th className="text-left px-4 py-2.5 w-8">
                      <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "#988d9f" }}>#</span>
                    </th>
                    <th className="text-left px-3 py-2.5">
                      <SortHeader label="Keyword" sortKey="alpha" current={sortKey} dir={sortDir} onSort={handleSort} />
                    </th>
                    <th className="text-left px-3 py-2.5">
                      <SortHeader label="Frequency" sortKey="frequency" current={sortKey} dir={sortDir} onSort={handleSort} />
                    </th>
                    <th className="text-left px-3 py-2.5">
                      <SortHeader label="Density" sortKey="density" current={sortKey} dir={sortDir} onSort={handleSort} />
                    </th>
                    <th className="text-left px-3 py-2.5">
                      <SortHeader label="First" sortKey="first" current={sortKey} dir={sortDir} onSort={handleSort} />
                    </th>
                    <th className="text-left px-3 py-2.5">
                      <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "#988d9f" }}>Bar</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((row, i) => {
                    const pct = (row.frequency / maxFreq) * 100;
                    const color = DENSITY_COLORS[i % DENSITY_COLORS.length];
                    const densityWarn = row.density > 5;
                    const isSearchMatch = search && row.phrase.includes(search.toLowerCase());
                    return (
                      <tr key={row.phrase}
                        style={{
                          borderBottom: "1px solid rgba(255,255,255,0.04)",
                          background: isSearchMatch ? "rgba(249,115,22,0.05)" : undefined,
                        }}
                        className="hover:bg-[rgba(255,255,255,0.015)] transition-colors">
                        <td className="px-4 py-2.5 text-[11px] tabular-nums" style={{ color: "#3d3345" }}>{i + 1}</td>
                        <td className="px-3 py-2.5 text-[13px] font-mono" style={{ color: "#e8dff0" }}>{row.phrase}</td>
                        <td className="px-3 py-2.5 text-[13px] font-bold tabular-nums" style={{ color: color }}>{row.frequency}</td>
                        <td className="px-3 py-2.5 text-[12px] font-bold tabular-nums" style={{ color: densityWarn ? "#ef4444" : "#988d9f" }}>
                          {row.density}%
                          {densityWarn && <span className="ml-1 text-[9px] font-bold px-1 py-0.5 rounded" style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444" }}>HIGH</span>}
                        </td>
                        <td className="px-3 py-2.5 text-[12px] tabular-nums" style={{ color: "#3d3345" }}>#{row.firstPos}</td>
                        <td className="px-3 py-2.5 w-32">
                          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                            <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {hasMore && (
              <div className="px-5 py-3 flex justify-center" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                <button onClick={() => setPage(p => p + 1)}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl text-[12px] font-bold transition-all"
                  style={{ background: "rgba(249,115,22,0.09)", color: ACCENT, border: "1px solid rgba(249,115,22,0.22)" }}>
                  <span className="material-symbols-outlined text-[14px]">expand_more</span>
                  Load more ({displayRows.length - page * PAGE_SIZE} remaining)
                </button>
              </div>
            )}
            {displayRows.length === 0 && (
              <p className="text-[13px] py-6 text-center" style={{ color: "#3d3345" }}>
                {search ? `No keywords matching "${search}".` : "No keywords found with current filters."}
              </p>
            )}
          </div>

          {fetchedAt && (
            <p className="text-center text-[11px]" style={{ color: "#3d3345" }}>
              Analyzed {new Date(fetchedAt).toLocaleString()} &mdash; {sourceUrl}
            </p>
          )}
        </>
      )}

      {/* Empty state */}
      {!hasResults && !loading && (
        <div className="glass-panel rounded-2xl p-8 flex flex-col items-center gap-4 text-center"
          style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
          <span className="material-symbols-outlined text-[48px]" style={{ color: "#3d3345" }}>analytics</span>
          <p className="text-[14px] font-semibold" style={{ color: "#988d9f" }}>Enter a URL or paste text above to start</p>
          <p className="text-[12px] max-w-md" style={{ color: "#3d3345" }}>
            Analyzes single-word, two-word, three-word and four-word phrases. Filters stop words, detects keyword stuffing and over-optimization, and scores your content from 0 to 100.
          </p>
          <div className="flex flex-wrap justify-center gap-2 mt-1">
            {["1–4 Word Phrases", "Stop Word Filter", "Density %", "Stuffing Detection", "Sortable Table", "CSV / JSON Export"].map(f => (
              <span key={f} className="text-[11px] font-semibold px-3 py-1 rounded-full"
                style={{ background: "rgba(249,115,22,0.07)", color: "#988d9f", border: "1px solid rgba(249,115,22,0.15)" }}>{f}</span>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
