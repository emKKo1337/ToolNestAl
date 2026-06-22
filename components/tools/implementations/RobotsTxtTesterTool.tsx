"use client";

import { useState, useMemo, useCallback, useRef } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────
interface RobotsRule {
  type: "Allow" | "Disallow";
  path: string;
  line: number;
}

interface RobotsGroup {
  userAgents: string[];
  rules: RobotsRule[];
  crawlDelay: number | null;
  startLine: number;
}

interface RobotsSyntaxIssue {
  severity: "error" | "warning" | "info";
  line: number;
  message: string;
  fix?: string;
}

interface ParsedRobots {
  groups: RobotsGroup[];
  sitemaps: { url: string; line: number }[];
  issues: RobotsSyntaxIssue[];
  rawLines: string[];
  score: number;
  recommendations: string[];
  stats: {
    allowRules: number;
    disallowRules: number;
    userAgents: number;
    sitemaps: number;
    crawlDelay: number | null;
  };
}

interface TestResult {
  url: string;
  userAgent: string;
  allowed: boolean;
  matchingRule: RobotsRule | null;
  matchingGroup: string[];
  reason: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────
const ACCENT = "#f97316";

const KNOWN_DIRECTIVES = new Set(["user-agent", "allow", "disallow", "crawl-delay", "sitemap", "host", "clean-param", "request-rate", "visit-time", "noindex"]);
const VALID_UA_PATTERNS = /^[a-zA-Z0-9*_\-. ]+$/;

const KNOWN_BOTS: Record<string, string[]> = {
  "Googlebot":        ["googlebot", "google"],
  "Googlebot-Image":  ["googlebot-image"],
  "Googlebot-News":   ["googlebot-news"],
  "Googlebot-Mobile": ["googlebot-mobile"],
  "Bingbot":          ["bingbot", "msnbot"],
  "DuckDuckBot":      ["duckduckbot"],
  "YandexBot":        ["yandexbot", "yandex"],
  "Baiduspider":      ["baiduspider", "baidu"],
  "AhrefsBot":        ["ahrefsbot"],
  "SemrushBot":       ["semrushbot"],
  "*":                ["*"],
};

// ── Parser ────────────────────────────────────────────────────────────────────
function parseRobots(text: string): ParsedRobots {
  const rawLines = text.split(/\r?\n/);
  const issues: RobotsSyntaxIssue[] = [];
  const groups: RobotsGroup[] = [];
  const sitemaps: { url: string; line: number }[] = [];

  let currentUserAgents: string[] = [];
  let currentRules: RobotsRule[] = [];
  let currentDelay: number | null = null;
  let currentStart = 0;
  let inGroup = false;
  const seenUAPairs = new Set<string>();
  const seenRules = new Set<string>();

  const pushGroup = () => {
    if (currentUserAgents.length > 0) {
      groups.push({ userAgents: currentUserAgents, rules: currentRules, crawlDelay: currentDelay, startLine: currentStart });
    }
    currentUserAgents = [];
    currentRules = [];
    currentDelay = null;
    inGroup = false;
  };

  for (let i = 0; i < rawLines.length; i++) {
    const lineNum = i + 1;
    const raw = rawLines[i];
    const stripped = raw.split("#")[0]?.trim() ?? "";

    if (!stripped) {
      if (inGroup && currentRules.length > 0) pushGroup();
      continue;
    }

    const colonIdx = stripped.indexOf(":");
    if (colonIdx === -1) {
      issues.push({ severity: "warning", line: lineNum, message: `Line ${lineNum}: unrecognised content — "${stripped.slice(0, 60)}". Directives must be in "Key: Value" format.`, fix: "Remove or correct this line." });
      continue;
    }

    const key   = stripped.slice(0, colonIdx).trim().toLowerCase();
    const value = stripped.slice(colonIdx + 1).trim();

    if (!KNOWN_DIRECTIVES.has(key)) {
      issues.push({ severity: "info", line: lineNum, message: `Line ${lineNum}: unknown directive "${stripped.slice(0, colonIdx)}" — will be ignored by crawlers.` });
    }

    if (key === "user-agent") {
      if (inGroup && currentRules.length > 0) pushGroup();
      if (!value) {
        issues.push({ severity: "error", line: lineNum, message: `Line ${lineNum}: User-agent directive has an empty value.`, fix: "Specify a user agent name or use * for all bots." });
      } else if (!VALID_UA_PATTERNS.test(value)) {
        issues.push({ severity: "warning", line: lineNum, message: `Line ${lineNum}: unusual characters in User-agent "${value}".` });
      }
      if (!inGroup) {
        currentStart = lineNum;
        inGroup = true;
      }
      currentUserAgents.push(value);
    } else if (key === "allow" || key === "disallow") {
      if (!inGroup) {
        issues.push({ severity: "error", line: lineNum, message: `Line ${lineNum}: ${key} rule appears before any User-agent directive.`, fix: "Add a User-agent line before this rule." });
      }
      const pairKey = `${key}:${value}`;
      if (seenRules.has(pairKey)) {
        issues.push({ severity: "warning", line: lineNum, message: `Line ${lineNum}: duplicate ${key} rule "${value}".`, fix: "Remove the duplicate rule." });
      }
      seenRules.add(pairKey);
      currentRules.push({ type: key === "allow" ? "Allow" : "Disallow", path: value, line: lineNum });
    } else if (key === "crawl-delay") {
      const d = parseFloat(value);
      if (isNaN(d) || d < 0) {
        issues.push({ severity: "error", line: lineNum, message: `Line ${lineNum}: invalid Crawl-delay "${value}" — must be a non-negative number.`, fix: 'Use a numeric value like "1" or "0.5".' });
      } else {
        if (d > 30) issues.push({ severity: "warning", line: lineNum, message: `Line ${lineNum}: Crawl-delay of ${d}s is very high — may significantly slow crawling.`, fix: "Keep Crawl-delay under 10 seconds; use Google Search Console for Googlebot." });
        currentDelay = d;
      }
    } else if (key === "sitemap") {
      if (!value) {
        issues.push({ severity: "error", line: lineNum, message: `Line ${lineNum}: Sitemap directive is empty.`, fix: "Provide a full URL to your sitemap.xml." });
      } else {
        try { new URL(value); }
        catch {
          issues.push({ severity: "error", line: lineNum, message: `Line ${lineNum}: Sitemap URL "${value}" is not a valid absolute URL.`, fix: "Use a full URL like https://example.com/sitemap.xml." });
        }
        const dupeKey = `sitemap:${value}`;
        if (seenUAPairs.has(dupeKey)) {
          issues.push({ severity: "warning", line: lineNum, message: `Line ${lineNum}: duplicate Sitemap "${value}".`, fix: "Remove the duplicate Sitemap entry." });
        }
        seenUAPairs.add(dupeKey);
        sitemaps.push({ url: value, line: lineNum });
      }
    }
  }
  if (inGroup) pushGroup();

  // Aggregate stats
  let allowCount = 0, disallowCount = 0, crawlDelayGlobal: number | null = null;
  const uaSet = new Set<string>();
  for (const g of groups) {
    g.userAgents.forEach(ua => uaSet.add(ua.toLowerCase()));
    for (const r of g.rules) {
      if (r.type === "Allow") allowCount++;
      else disallowCount++;
    }
    if (g.crawlDelay !== null && crawlDelayGlobal === null) crawlDelayGlobal = g.crawlDelay;
  }

  // SEO checks
  const homepageBlocked = isUrlBlocked("/", "*", groups);
  const cssBlocked      = isUrlBlocked("/css/style.css", "*", groups) || isUrlBlocked("/assets/main.css", "*", groups);
  const jsBlocked       = isUrlBlocked("/js/app.js", "*", groups)    || isUrlBlocked("/assets/main.js", "*", groups);
  const imgBlocked      = isUrlBlocked("/images/photo.jpg", "*", groups);

  if (homepageBlocked) issues.push({ severity: "error", line: 0, message: "The homepage (/) appears to be blocked for all crawlers.", fix: "Remove or narrow the Disallow rule blocking /." });
  if (cssBlocked)      issues.push({ severity: "warning", line: 0, message: "CSS files may be blocked — Google needs to render your pages to assess quality.", fix: "Allow crawlers to access /css/ and /assets/ directories." });
  if (jsBlocked)       issues.push({ severity: "warning", line: 0, message: "JavaScript files may be blocked — Googlebot renders JavaScript; blocking it hurts indexing.", fix: "Allow crawlers to access /js/ and /assets/ directories." });
  if (imgBlocked)      issues.push({ severity: "info", line: 0, message: "Image directories may be blocked — this prevents images from appearing in Google Image Search." });
  if (sitemaps.length === 0) issues.push({ severity: "warning", line: 0, message: "No Sitemap directive found.", fix: "Add 'Sitemap: https://yourdomain.com/sitemap.xml' to help search engines discover all your pages." });

  // Score
  let score = 100;
  const errorCount = issues.filter(i => i.severity === "error").length;
  const warnCount  = issues.filter(i => i.severity === "warning").length;
  score -= Math.min(40, errorCount * 10);
  score -= Math.min(30, warnCount * 5);
  if (homepageBlocked) score -= 25;
  score = Math.max(0, Math.min(100, score));

  // Recommendations
  const recs: string[] = [];
  if (homepageBlocked)             recs.push("Unblock the homepage — blocking / prevents your entire site from being indexed.");
  if (cssBlocked || jsBlocked)     recs.push("Allow access to CSS and JavaScript files — Google needs to render pages to properly assess content quality and mobile-friendliness.");
  if (sitemaps.length === 0)       recs.push("Add a Sitemap directive pointing to your sitemap.xml to help crawlers discover all your pages efficiently.");
  if (errorCount > 0)              recs.push(`Fix ${errorCount} syntax error${errorCount > 1 ? "s" : ""} — invalid robots.txt directives are silently ignored by crawlers.`);
  if (warnCount > 0)               recs.push(`Review ${warnCount} warning${warnCount > 1 ? "s" : ""} — duplicate and overly broad rules can cause unintended blocking.`);
  if ((crawlDelayGlobal ?? 0) > 10) recs.push("Reduce Crawl-delay — values above 10 seconds significantly reduce how often Googlebot crawls your site.");
  if (recs.length === 0)           recs.push("robots.txt looks good — no critical issues detected. You are ready to submit to Google Search Console.");

  return {
    groups, sitemaps, issues, rawLines, score, recommendations: recs,
    stats: { allowRules: allowCount, disallowRules: disallowCount, userAgents: uaSet.size, sitemaps: sitemaps.length, crawlDelay: crawlDelayGlobal },
  };
}

// ── Rule matching (Google longest-match algorithm) ────────────────────────────
function pathMatches(pattern: string, urlPath: string): boolean {
  if (!pattern) return true; // empty pattern matches everything (Disallow: = allow all)
  // Escape regex special chars except * and $
  const escaped = pattern
    .replace(/[.+?^{}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*")
    .replace(/\$$/,  "$");
  try {
    const re = new RegExp("^" + escaped);
    return re.test(urlPath);
  } catch { return false; }
}

function isUrlBlocked(url: string, userAgent: string, groups: RobotsGroup[]): boolean {
  // Derive path from URL (if it's a full URL, extract path+query)
  let path = url;
  try {
    const u = new URL(url.startsWith("http") ? url : `https://example.com${url}`);
    path = u.pathname + u.search;
  } catch { /* keep as is */ }

  const uaLower = userAgent.toLowerCase();

  // Find matching groups (specific UA first, then *)
  const specificGroups = groups.filter(g => g.userAgents.some(ua => ua.toLowerCase() === uaLower));
  const wildcardGroups = groups.filter(g => g.userAgents.includes("*"));
  const candidates = specificGroups.length > 0 ? specificGroups : wildcardGroups;
  if (candidates.length === 0) return false;

  // Collect all matching rules from applicable groups
  let bestLen = -1;
  let bestAllowed = true; // default: allowed

  for (const group of candidates) {
    for (const rule of group.rules) {
      if (pathMatches(rule.path, path)) {
        const len = rule.path.replace(/[*$]/g, "").length;
        if (len > bestLen || (len === bestLen && rule.type === "Allow")) {
          bestLen = len;
          bestAllowed = rule.type === "Allow";
        }
      }
    }
  }
  // Disallow: (empty) = allow all
  if (bestLen === -1) return false;
  return !bestAllowed;
}

function testUrl(url: string, userAgent: string, groups: RobotsGroup[]): TestResult {
  let path = url;
  try {
    const u = new URL(url.startsWith("http") ? url : `https://example.com${url.startsWith("/") ? url : "/" + url}`);
    path = u.pathname + u.search;
  } catch { /* keep as is */ }

  const uaLower = userAgent.toLowerCase();
  const specificGroups = groups.filter(g => g.userAgents.some(ua => ua.toLowerCase() === uaLower));
  const wildcardGroups = groups.filter(g => g.userAgents.includes("*"));
  const candidates     = specificGroups.length > 0 ? specificGroups : wildcardGroups;

  if (candidates.length === 0) {
    return { url, userAgent, allowed: true, matchingRule: null, matchingGroup: ["*"], reason: "No matching User-agent group found — default: allowed." };
  }

  let bestLen  = -1;
  let bestRule: RobotsRule | null = null;
  let bestGroup: string[] = [];
  let bestAllowed = true;

  for (const group of candidates) {
    for (const rule of group.rules) {
      if (pathMatches(rule.path, path)) {
        const len = rule.path.replace(/[*$]/g, "").length;
        if (len > bestLen || (len === bestLen && rule.type === "Allow")) {
          bestLen = len;
          bestRule = rule;
          bestGroup = group.userAgents;
          bestAllowed = rule.type === "Allow";
        }
      }
    }
  }

  if (bestRule === null) {
    return { url, userAgent, allowed: true, matchingRule: null, matchingGroup: candidates[0]?.userAgents ?? [], reason: "No matching rule — default: allowed." };
  }

  const reason = bestAllowed
    ? `Allowed by ${bestRule.type}: ${bestRule.path || "(empty)"} on line ${bestRule.line}.`
    : `Blocked by ${bestRule.type}: ${bestRule.path} on line ${bestRule.line}.`;

  return { url, userAgent, allowed: bestAllowed, matchingRule: bestRule, matchingGroup: bestGroup, reason };
}

// ── Syntax highlighter ────────────────────────────────────────────────────────
function RobotsHighlight({ lines, issueLines }: { lines: string[]; issueLines: Set<number> }) {
  return (
    <pre className="text-[11px] font-mono overflow-x-auto p-4 rounded-xl leading-[1.7]"
      style={{ background: "rgba(0,0,0,0.35)", color: "#e2e8f0", whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
      {lines.map((line, i) => {
        const lineNum = i + 1;
        const hasIssue = issueLines.has(lineNum);
        const stripped = line.split("#")[0]?.trim() ?? "";
        const comment  = line.includes("#") ? line.slice(line.indexOf("#")) : "";
        const colonIdx = stripped.indexOf(":");
        const key      = colonIdx >= 0 ? stripped.slice(0, colonIdx).trim().toLowerCase() : "";
        const value    = colonIdx >= 0 ? stripped.slice(colonIdx + 1).trim() : "";

        let keyColor = "#e2e8f0";
        let valColor = "#e2e8f0";
        if (key === "user-agent")  { keyColor = "#c4b5fd"; valColor = "#fde68a"; }
        else if (key === "allow")  { keyColor = "#86efac"; valColor = "#86efac"; }
        else if (key === "disallow") { keyColor = "#fca5a5"; valColor = "#fca5a5"; }
        else if (key === "sitemap")  { keyColor = "#67e8f9"; valColor = "#67e8f9"; }
        else if (key === "crawl-delay") { keyColor = "#fdba74"; valColor = "#fdba74"; }

        return (
          <span key={i} className="flex"
            style={hasIssue ? { background: "rgba(239,68,68,0.08)", borderLeft: "2px solid #ef4444" } : {}}>
            <span className="select-none w-10 shrink-0 text-right pr-3 opacity-30 tabular-nums">{lineNum}</span>
            {!stripped
              ? <span style={{ color: "#3d3345" }}>{line || " "}</span>
              : (
                <span>
                  {colonIdx >= 0
                    ? (<><span style={{ color: keyColor }}>{stripped.slice(0, colonIdx + 1)}</span><span style={{ color: valColor }}>{" " + value}</span></>)
                    : <span>{stripped}</span>
                  }
                  {comment && <span style={{ color: "#4a5568" }}>{" " + comment}</span>}
                </span>
              )
            }
          </span>
        );
      })}
    </pre>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────
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

function StatCard({ icon, label, value, color }: { icon: string; label: string; value: string | number; color?: string }) {
  return (
    <div className="glass-panel rounded-2xl p-4 flex flex-col gap-1.5"
      style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
      <span className="material-symbols-outlined text-[20px]" style={{ color: color ?? ACCENT }}>{icon}</span>
      <p className="text-[22px] font-black tabular-nums leading-tight" style={{ color: "#e8dff0" }}>{value}</p>
      <p className="text-[11px] font-bold" style={{ color: "#988d9f" }}>{label}</p>
    </div>
  );
}

function IssueLine({ issue }: { issue: RobotsSyntaxIssue }) {
  const c  = issue.severity === "error" ? "#ef4444" : issue.severity === "warning" ? "#f59e0b" : "#60a5fa";
  const ic = issue.severity === "error" ? "error" : issue.severity === "warning" ? "warning" : "info";
  return (
    <div className="flex items-start gap-2.5 py-2.5" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
      <span className="material-symbols-outlined text-[14px] mt-0.5 shrink-0" style={{ color: c }}>{ic}</span>
      <div className="flex-1 min-w-0">
        <span className="text-[12px]" style={{ color: "#c8b89f" }}>{issue.message}</span>
        {issue.fix && <p className="text-[11px] mt-0.5" style={{ color: "#60a5fa" }}>Fix: {issue.fix}</p>}
      </div>
      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md shrink-0 capitalize"
        style={{ background: `${c}18`, color: c }}>{issue.severity}</span>
    </div>
  );
}

type InputMode = "url" | "paste" | "upload";

// ── Main ──────────────────────────────────────────────────────────────────────
export default function RobotsTxtTesterTool() {
  const [mode,       setMode]       = useState<InputMode>("url");
  const [urlInput,   setUrlInput]   = useState("");
  const [textInput,  setTextInput]  = useState("");
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState("");
  const [parsed,     setParsed]     = useState<ParsedRobots | null>(null);
  const [rawText,    setRawText]    = useState("");
  const [testUrl2,   setTestUrl2]   = useState("");
  const [testUa,     setTestUa]     = useState("Googlebot");
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [copied,     setCopied]     = useState(false);
  const [showRaw,    setShowRaw]    = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);

  const scoreColor = parsed
    ? parsed.score >= 71 ? "#22c55e" : parsed.score >= 41 ? "#f59e0b" : "#ef4444"
    : "#988d9f";
  const scoreLabel = parsed
    ? parsed.score >= 71 ? "Healthy" : parsed.score >= 41 ? "Needs work" : "Poor"
    : "";

  const issueLines = useMemo(() => {
    const s = new Set<number>();
    parsed?.issues.forEach(i => { if (i.line > 0) s.add(i.line); });
    return s;
  }, [parsed]);

  const process = useCallback((text: string) => {
    setRawText(text);
    setParsed(parseRobots(text));
    setTestResult(null);
  }, []);

  const fetchUrl = useCallback(async () => {
    const trimmed = urlInput.trim();
    if (!trimmed) { setError("Please enter a website URL."); return; }
    setError(""); setParsed(null); setTestResult(null); setLoading(true);
    try {
      const encoded = encodeURIComponent(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
      const res = await fetch(`/api/fetch-robots?url=${encoded}`);
      const data = await res.json() as { text?: string; error?: string };
      if (data.error) { setError(data.error); return; }
      if (!data.text) { setError("Empty robots.txt."); return; }
      process(data.text);
    } catch {
      setError("Network error — please try again.");
    } finally {
      setLoading(false);
    }
  }, [urlInput, process]);

  const validatePaste = useCallback(() => {
    if (!textInput.trim()) { setError("Please paste robots.txt content."); return; }
    setError("");
    process(textInput.trim());
  }, [textInput, process]);

  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => { setError(""); process(ev.target?.result as string); };
    reader.readAsText(file);
    e.target.value = "";
  }, [process]);

  const runTest = useCallback(() => {
    if (!parsed || !testUrl2.trim()) return;
    const path = testUrl2.trim().startsWith("/") ? testUrl2.trim() : "/" + testUrl2.trim();
    const uaLower = testUa === "Custom" ? "custom" : testUa.toLowerCase();
    const result = testUrl(path, uaLower === "custom" ? "*" : uaLower, parsed.groups);
    setTestResult({ ...result, userAgent: testUa });
  }, [parsed, testUrl2, testUa]);

  const reset = useCallback(() => {
    setUrlInput(""); setTextInput(""); setParsed(null); setRawText(""); setError(""); setTestResult(null); setTestUrl2("");
  }, []);

  // ── Exports ───────────────────────────────────────────────────────────────
  const exportJson = useCallback(() => {
    if (!parsed) return;
    const blob = new Blob([JSON.stringify({ ...parsed, rawText }, null, 2)], { type: "application/json" });
    const u = URL.createObjectURL(blob);
    Object.assign(document.createElement("a"), { href: u, download: "robots-txt-analysis.json" }).click();
    URL.revokeObjectURL(u);
  }, [parsed, rawText]);

  const exportTxt = useCallback(() => {
    if (!parsed) return;
    const lines = [
      "Robots.txt Analysis",
      `Score: ${parsed.score}/100 — ${scoreLabel}`,
      `Allow rules: ${parsed.stats.allowRules} | Disallow rules: ${parsed.stats.disallowRules}`,
      `User-agents: ${parsed.stats.userAgents} | Sitemaps: ${parsed.stats.sitemaps}`,
      parsed.stats.crawlDelay !== null ? `Crawl-delay: ${parsed.stats.crawlDelay}s` : "",
      "",
      "=== ISSUES ===",
      ...parsed.issues.map(i => `[${i.severity.toUpperCase()}] Line ${i.line}: ${i.message}${i.fix ? " — Fix: " + i.fix : ""}`),
      "",
      "=== RECOMMENDATIONS ===",
      ...parsed.recommendations,
      "",
      "=== SITEMAPS ===",
      ...parsed.sitemaps.map(s => `Line ${s.line}: ${s.url}`),
      "",
      "=== RAW ROBOTS.TXT ===",
      rawText,
    ].filter(l => l !== undefined);
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const u = URL.createObjectURL(blob);
    Object.assign(document.createElement("a"), { href: u, download: "robots-txt-analysis.txt" }).click();
    URL.revokeObjectURL(u);
  }, [parsed, rawText, scoreLabel]);

  const exportPdf = useCallback(() => {
    if (!parsed) return;
    const issueRows = parsed.issues.map(i => {
      const c = i.severity === "error" ? "#dc2626" : i.severity === "warning" ? "#d97706" : "#2563eb";
      return `<tr><td style="color:${c};font-weight:700">${i.severity}</td><td>${i.line || "—"}</td><td>${i.message}</td><td style="font-size:11px;color:#555">${i.fix ?? ""}</td></tr>`;
    }).join("");
    const groupRows = parsed.groups.map(g =>
      `<tr><td>${g.userAgents.join(", ")}</td><td>${g.rules.filter(r => r.type === "Allow").length}</td><td>${g.rules.filter(r => r.type === "Disallow").length}</td><td>${g.crawlDelay ?? "—"}</td></tr>`
    ).join("");
    const html = `<!DOCTYPE html><html><head><title>Robots.txt Analysis</title>
<style>body{font-family:system-ui,sans-serif;max-width:900px;margin:2rem auto;color:#111;font-size:13px}
h1{font-size:18px}h2{font-size:14px;margin-top:20px;border-bottom:1px solid #ddd;padding-bottom:4px}
.score{font-size:34px;font-weight:900;color:${scoreColor}}
.chips{display:flex;gap:10px;flex-wrap:wrap;margin:8px 0}.chip{background:#f5f5f5;border-radius:6px;padding:4px 10px;font-size:12px}.chip b{display:block;font-size:16px}
table{width:100%;border-collapse:collapse;margin-top:8px}
th,td{text-align:left;padding:4px 6px;border-bottom:1px solid #eee;font-size:11px;vertical-align:top}
th{font-weight:700;color:#555;background:#fafafa}
pre{background:#f8f9fa;padding:12px;border-radius:6px;font-size:11px;white-space:pre-wrap;word-break:break-all}
ul li{margin-bottom:4px;font-size:12px}
</style></head><body>
<h1>Robots.txt Analysis Report</h1>
<div class="score">${parsed.score}<span style="font-size:15px;font-weight:400;color:#555"> / 100 — ${scoreLabel}</span></div>
<div class="chips">
<div class="chip"><b>${parsed.stats.allowRules}</b>Allow Rules</div>
<div class="chip"><b>${parsed.stats.disallowRules}</b>Disallow Rules</div>
<div class="chip"><b>${parsed.stats.userAgents}</b>User Agents</div>
<div class="chip"><b>${parsed.stats.sitemaps}</b>Sitemaps</div>
${parsed.stats.crawlDelay !== null ? `<div class="chip"><b>${parsed.stats.crawlDelay}s</b>Crawl-delay</div>` : ""}
</div>
${issueRows ? `<h2>Issues</h2><table><thead><tr><th>Level</th><th>Line</th><th>Message</th><th>Fix</th></tr></thead><tbody>${issueRows}</tbody></table>` : "<h2>Issues</h2><p style='color:#16a34a'>No issues found.</p>"}
<h2>Recommendations</h2><ul>${parsed.recommendations.map(r => `<li>${r}</li>`).join("")}</ul>
<h2>User-agent Groups</h2><table><thead><tr><th>User-agent(s)</th><th>Allow</th><th>Disallow</th><th>Crawl-delay</th></tr></thead><tbody>${groupRows}</tbody></table>
${parsed.sitemaps.length > 0 ? `<h2>Sitemaps</h2><ul>${parsed.sitemaps.map(s => `<li>Line ${s.line}: ${s.url}</li>`).join("")}</ul>` : ""}
<h2>Raw robots.txt</h2><pre>${rawText.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</pre>
</body></html>`;
    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); w.print(); }
  }, [parsed, rawText, scoreColor, scoreLabel]);

  const copyResults = useCallback(async () => {
    if (!parsed) return;
    const lines = [
      `Robots.txt Score: ${parsed.score}/100`,
      `Allow: ${parsed.stats.allowRules} | Disallow: ${parsed.stats.disallowRules} | UAs: ${parsed.stats.userAgents}`,
      ...parsed.recommendations,
    ];
    try { await navigator.clipboard.writeText(lines.join("\n")); } catch { /* blocked */ }
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  }, [parsed]);

  const inputCls = "flex-1 rounded-xl px-3 py-2.5 text-[13px] outline-none transition-all bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] focus:border-[rgba(249,115,22,0.4)] text-[#e8dff0] placeholder-[#3d3345]";
  const tabActive   = { background: "rgba(249,115,22,0.12)", color: ACCENT, border: "1px solid rgba(249,115,22,0.3)" };
  const tabInactive = { background: "rgba(255,255,255,0.03)", color: "#988d9f", border: "1px solid rgba(255,255,255,0.07)" };

  return (
    <div className="mb-12 flex flex-col gap-6">

      {/* ── Input ────────────────────────────────────────────────────────── */}
      <div className="glass-panel rounded-2xl p-5 flex flex-col gap-4"
        style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
        <PanelHeader icon="robot_2" title="Test & Validate Robots.txt" />

        {/* Mode tabs */}
        <div className="flex gap-2 flex-wrap">
          {([["url", "link", "Website URL"], ["paste", "code", "Paste Content"], ["upload", "upload_file", "Upload File"]] as const).map(([m, icon, label]) => (
            <button key={m} onClick={() => { setMode(m); setError(""); }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-semibold transition-all"
              style={mode === m ? tabActive : tabInactive}>
              <span className="material-symbols-outlined text-[13px]">{icon}</span>{label}
            </button>
          ))}
        </div>

        {mode === "url" && (
          <div className="flex gap-3 flex-wrap sm:flex-nowrap">
            <input type="url" value={urlInput} onChange={e => setUrlInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && fetchUrl()}
              placeholder="https://example.com" aria-label="Website URL"
              className={inputCls} />
            <button onClick={fetchUrl} disabled={loading}
              className="btn-primary flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm shrink-0 disabled:opacity-60">
              <span className="material-symbols-outlined text-[15px]">{loading ? "hourglass_top" : "search"}</span>
              {loading ? "Fetching…" : "Fetch & Validate"}
            </button>
          </div>
        )}

        {mode === "paste" && (
          <>
            <textarea value={textInput} onChange={e => setTextInput(e.target.value)}
              placeholder={"User-agent: *\nDisallow: /admin/\nAllow: /\n\nSitemap: https://example.com/sitemap.xml"}
              rows={10} aria-label="Paste robots.txt content"
              className="w-full rounded-xl px-3 py-3 text-[12px] font-mono outline-none transition-all bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] focus:border-[rgba(249,115,22,0.4)] text-[#e8dff0] placeholder-[#3d3345] resize-y" />
            <div className="flex gap-3 justify-between flex-wrap">
              <button onClick={() => setTextInput("")}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-semibold transition-all"
                style={tabInactive}>
                <span className="material-symbols-outlined text-[13px]">clear</span>Clear
              </button>
              <button onClick={validatePaste}
                className="btn-primary flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm">
                <span className="material-symbols-outlined text-[15px]">robot_2</span>Validate Robots.txt
              </button>
            </div>
          </>
        )}

        {mode === "upload" && (
          <>
            <input ref={fileRef} type="file" accept=".txt" onChange={handleFile} className="hidden" aria-label="Upload robots.txt" />
            <button onClick={() => fileRef.current?.click()}
              className="w-full flex flex-col items-center gap-3 px-6 py-10 rounded-2xl cursor-pointer transition-all"
              style={{ border: "2px dashed rgba(249,115,22,0.3)", background: "rgba(249,115,22,0.04)" }}>
              <span className="material-symbols-outlined text-[48px]" style={{ color: ACCENT }}>upload_file</span>
              <p className="text-[13px] font-semibold" style={{ color: "#e8dff0" }}>Click to upload robots.txt</p>
              <p className="text-[11px]" style={{ color: "#3d3345" }}>Parsed entirely in your browser — never uploaded to a server</p>
            </button>
          </>
        )}

        {error && (
          <div className="flex items-start gap-2 px-4 py-3 rounded-xl"
            style={{ background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.2)" }}>
            <span className="material-symbols-outlined text-[15px] mt-0.5 shrink-0 text-red-400">error</span>
            <p className="text-[13px]" style={{ color: "#fca5a5" }}>{error}</p>
          </div>
        )}
      </div>

      {/* ── Results ──────────────────────────────────────────────────────── */}
      {parsed && (
        <>
          {/* Score + recs + actions */}
          <div className="glass-panel rounded-2xl p-5 flex flex-wrap items-start gap-6"
            style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
            <div className="flex flex-col items-center gap-1.5 shrink-0">
              <div className="relative w-24 h-24">
                <svg width="96" height="96" viewBox="0 0 96 96" aria-label={`Score ${parsed.score}/100`}>
                  <circle cx="48" cy="48" r="40" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="7" />
                  <circle cx="48" cy="48" r="40" fill="none"
                    stroke={scoreColor} strokeWidth="7"
                    strokeDasharray={2 * Math.PI * 40}
                    strokeDashoffset={2 * Math.PI * 40 * (1 - parsed.score / 100)}
                    strokeLinecap="round" transform="rotate(-90 48 48)"
                    style={{ transition: "stroke-dashoffset 0.6s ease, stroke 0.4s ease" }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-[26px] font-black tabular-nums" style={{ color: scoreColor, lineHeight: 1 }}>{parsed.score}</span>
                  <span className="text-[9px] font-bold" style={{ color: scoreColor, opacity: 0.7 }}>/ 100</span>
                </div>
              </div>
              <span className="text-[11px] font-bold" style={{ color: scoreColor }}>{scoreLabel}</span>
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-bold mb-3" style={{ color: "#e8dff0" }}>Recommendations</p>
              <ul className="flex flex-col gap-2 max-h-44 overflow-y-auto pr-1">
                {parsed.recommendations.map((rec, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="material-symbols-outlined text-[13px] mt-0.5 shrink-0" style={{ color: ACCENT }}>arrow_forward</span>
                    <span className="text-[12px] leading-relaxed" style={{ color: "#c8b89f" }}>{rec}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex flex-wrap gap-2 w-full pt-4" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
              <button onClick={copyResults}
                className="btn-primary flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm">
                <span className="material-symbols-outlined text-[14px]">{copied ? "check" : "content_copy"}</span>
                {copied ? "Copied!" : "Copy Results"}
              </button>
              {[
                { label: "JSON", icon: "data_object", fn: exportJson, accent: true },
                { label: "TXT",  icon: "description", fn: exportTxt,  accent: false },
                { label: "PDF",  icon: "print",       fn: exportPdf,  accent: false },
              ].map(({ label, icon, fn, accent }) => (
                <button key={label} onClick={fn}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all"
                  style={accent
                    ? { background: "rgba(249,115,22,0.09)", color: ACCENT, border: "1px solid rgba(249,115,22,0.22)" }
                    : { background: "rgba(255,255,255,0.04)", color: "#c8c0d0", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <span className="material-symbols-outlined text-[13px]">{icon}</span>{label}
                </button>
              ))}
              <button onClick={reset}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all ml-auto"
                style={{ background: "rgba(255,255,255,0.03)", color: "#988d9f", border: "1px solid rgba(255,255,255,0.07)" }}>
                <span className="material-symbols-outlined text-[13px]">restart_alt</span>Reset
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard icon="check_circle"  label="Allow Rules"     value={parsed.stats.allowRules}    color="#22c55e" />
            <StatCard icon="cancel"        label="Disallow Rules"  value={parsed.stats.disallowRules} color={parsed.stats.disallowRules > 0 ? "#ef4444" : "#22c55e"} />
            <StatCard icon="manage_accounts" label="User-agents"   value={parsed.stats.userAgents}    color="#a78bfa" />
            <StatCard icon="map"           label="Sitemaps"        value={parsed.stats.sitemaps}      color={parsed.stats.sitemaps === 0 ? "#f59e0b" : "#22c55e"} />
            {parsed.stats.crawlDelay !== null && (
              <StatCard icon="timer" label="Crawl-delay" value={`${parsed.stats.crawlDelay}s`}
                color={(parsed.stats.crawlDelay ?? 0) > 10 ? "#f59e0b" : "#e8dff0"} />
            )}
          </div>

          {/* URL Tester */}
          <div className="glass-panel rounded-2xl p-5 flex flex-col gap-4"
            style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
            <PanelHeader icon="travel_explore" title="Test a URL" />
            <div className="flex gap-3 flex-wrap sm:flex-nowrap items-end">
              <div className="flex-1 flex flex-col gap-1">
                <label className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "#988d9f" }}>URL or Path to Test</label>
                <input type="text" value={testUrl2} onChange={e => setTestUrl2(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && runTest()}
                  placeholder="/page-path or https://example.com/page" aria-label="URL to test"
                  className="rounded-xl px-3 py-2.5 text-[13px] outline-none transition-all bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] focus:border-[rgba(249,115,22,0.4)] text-[#e8dff0] placeholder-[#3d3345]" />
              </div>
              <div className="flex flex-col gap-1 shrink-0">
                <label className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "#988d9f" }}>User Agent</label>
                <select value={testUa} onChange={e => setTestUa(e.target.value)} aria-label="User agent to test"
                  className="rounded-xl px-3 py-2.5 text-[13px] outline-none bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] text-[#e8dff0] cursor-pointer">
                  {Object.keys(KNOWN_BOTS).map(ua => <option key={ua} value={ua}>{ua}</option>)}
                </select>
              </div>
              <button onClick={runTest} disabled={!testUrl2.trim()}
                className="btn-primary flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm shrink-0 disabled:opacity-50">
                <span className="material-symbols-outlined text-[15px]">search</span>Test URL
              </button>
            </div>

            {testResult && (
              <div className="flex items-start gap-3 px-4 py-4 rounded-xl"
                style={{
                  background: testResult.allowed ? "rgba(34,197,94,0.07)" : "rgba(239,68,68,0.07)",
                  border: `1px solid ${testResult.allowed ? "rgba(34,197,94,0.25)" : "rgba(239,68,68,0.25)"}`,
                }}>
                <span className="material-symbols-outlined text-[28px] shrink-0"
                  style={{ color: testResult.allowed ? "#22c55e" : "#ef4444" }}>
                  {testResult.allowed ? "check_circle" : "cancel"}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-black" style={{ color: testResult.allowed ? "#22c55e" : "#ef4444" }}>
                    {testResult.allowed ? "Allowed" : "Blocked"} for {testResult.userAgent}
                  </p>
                  <p className="text-[12px] mt-1" style={{ color: "#c8b89f" }}>{testResult.reason}</p>
                  {testResult.matchingRule && (
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-md"
                        style={{ background: testResult.matchingRule.type === "Allow" ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)", color: testResult.matchingRule.type === "Allow" ? "#22c55e" : "#ef4444" }}>
                        {testResult.matchingRule.type}: {testResult.matchingRule.path || "(empty)"}
                      </span>
                      <span className="text-[11px]" style={{ color: "#3d3345" }}>Line {testResult.matchingRule.line}</span>
                      <span className="text-[11px]" style={{ color: "#3d3345" }}>User-agent: {testResult.matchingGroup.join(", ")}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Issues */}
          <div className="glass-panel rounded-2xl p-5 flex flex-col gap-0"
            style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
            <div className="mb-3">
              <PanelHeader icon="report" title="Syntax Issues"
                badge={`${parsed.issues.length} issue${parsed.issues.length !== 1 ? "s" : ""}`} />
            </div>
            {parsed.issues.length === 0
              ? (
                <div className="flex items-center gap-2 py-4">
                  <span className="material-symbols-outlined text-[20px]" style={{ color: "#22c55e" }}>check_circle</span>
                  <p className="text-[13px]" style={{ color: "#22c55e" }}>No syntax issues found.</p>
                </div>
              )
              : parsed.issues.map((iss, i) => <IssueLine key={i} issue={iss} />)
            }
          </div>

          {/* User-agent groups */}
          {parsed.groups.length > 0 && (
            <div className="glass-panel rounded-2xl p-5 flex flex-col gap-4"
              style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
              <PanelHeader icon="manage_accounts" title="User-agent Groups" badge={`${parsed.groups.length}`} />
              <div className="flex flex-col gap-3">
                {parsed.groups.map((g, gi) => (
                  <div key={gi} className="rounded-xl p-4 flex flex-col gap-2"
                    style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                    <div className="flex items-center gap-2 flex-wrap">
                      {g.userAgents.map(ua => (
                        <span key={ua} className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                          style={{ background: "rgba(196,181,253,0.12)", color: "#c4b5fd" }}>{ua}</span>
                      ))}
                      {g.crawlDelay !== null && (
                        <span className="ml-auto text-[11px]" style={{ color: "#988d9f" }}>Crawl-delay: {g.crawlDelay}s</span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {g.rules.map((r, ri) => (
                        <span key={ri}
                          className="text-[11px] font-mono px-2 py-0.5 rounded-md"
                          style={{
                            background: r.type === "Allow" ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)",
                            color: r.type === "Allow" ? "#86efac" : "#fca5a5",
                            border: `1px solid ${r.type === "Allow" ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)"}`,
                          }}>
                          {r.type}: {r.path || "(empty)"}
                        </span>
                      ))}
                      {g.rules.length === 0 && (
                        <span className="text-[11px]" style={{ color: "#3d3345" }}>No Allow/Disallow rules</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sitemaps */}
          {parsed.sitemaps.length > 0 && (
            <div className="glass-panel rounded-2xl p-5 flex flex-col gap-3"
              style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
              <PanelHeader icon="map" title="Sitemap Directives" badge={`${parsed.sitemaps.length}`} />
              {parsed.sitemaps.map((s, i) => (
                <div key={i} className="flex items-center gap-3 py-2"
                  style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                  <span className="text-[10px] tabular-nums" style={{ color: "#3d3345" }}>L{s.line}</span>
                  <a href={s.url} target="_blank" rel="noopener noreferrer"
                    className="text-[12px] font-mono hover:underline flex-1 break-all" style={{ color: "#67e8f9" }}>
                    {s.url}
                  </a>
                </div>
              ))}
            </div>
          )}

          {/* Syntax-highlighted view */}
          {rawText && (
            <div className="glass-panel rounded-2xl p-5 flex flex-col gap-3"
              style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
              <div className="flex items-center justify-between">
                <PanelHeader icon="code" title="robots.txt" badge={`${parsed.rawLines.length} lines`} />
                <button onClick={() => setShowRaw(v => !v)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all"
                  style={tabInactive}>
                  {showRaw ? "Collapse" : "Expand"}
                </button>
              </div>
              {showRaw && <RobotsHighlight lines={parsed.rawLines} issueLines={issueLines} />}
              {!showRaw && (
                <button onClick={() => setShowRaw(true)}
                  className="text-[12px] py-3 rounded-xl transition-all"
                  style={{ background: "rgba(255,255,255,0.03)", color: "#988d9f", border: "1px solid rgba(255,255,255,0.06)" }}>
                  Click to view syntax-highlighted robots.txt
                </button>
              )}
            </div>
          )}
        </>
      )}

      {/* ── Empty state ───────────────────────────────────────────────── */}
      {!parsed && !loading && (
        <div className="glass-panel rounded-2xl p-8 flex flex-col items-center gap-4 text-center"
          style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
          <span className="material-symbols-outlined text-[48px]" style={{ color: "#3d3345" }}>robot_2</span>
          <p className="text-[14px] font-semibold" style={{ color: "#988d9f" }}>Enter a website URL, paste or upload robots.txt</p>
          <p className="text-[12px] max-w-md" style={{ color: "#3d3345" }}>
            Validates syntax, detects duplicate rules and tests whether specific URLs are allowed or blocked — using Google&apos;s longest-match path algorithm.
          </p>
          <div className="flex flex-wrap justify-center gap-2 mt-1">
            {["Syntax Validation", "URL Testing", "Googlebot", "Wildcard Patterns", "Crawl-delay", "Score 0–100"].map(f => (
              <span key={f} className="text-[11px] font-semibold px-3 py-1 rounded-full"
                style={{ background: "rgba(249,115,22,0.07)", color: "#988d9f", border: "1px solid rgba(249,115,22,0.15)" }}>{f}</span>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
