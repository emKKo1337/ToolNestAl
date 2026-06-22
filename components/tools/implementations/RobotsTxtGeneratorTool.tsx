"use client";

/**
 * Robots.txt Generator
 *
 * Live-generated robots.txt as the user edits.
 *
 * Architecture:
 *   State: websiteUrl, sitemapUrl, host, agents[], presets{}
 *   Derived (useMemo): output string + validation score + issues list
 *
 * Generation rules:
 *   • Each AgentBlock → User-agent + Allow/Disallow rules + optional Crawl-delay
 *   • Preset checkboxes inject extra lines into the * User-agent block at
 *     generation time (never mutate state directly)
 *   • Sitemap appended at the end (from field or auto-generated from websiteUrl)
 *
 * Validation score 0–100:
 *   Has agents (+20), has wildcard (*) (+15), has sitemap (+20),
 *   not blocking all (+20), no duplicates (+15), valid paths (+10)
 *
 * Syntax highlighting: line-by-line regex, HTML-escaped first (safe).
 */

import { useState, useMemo, useCallback } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────
type RuleType = "Allow" | "Disallow";
interface Rule       { id: string; type: RuleType; path: string; }
interface AgentBlock { id: string; agent: string; customAgent: string; rules: Rule[]; crawlDelay: string; }
interface Presets    { allowAll: boolean; blockAll: boolean; blockAdmin: boolean; blockLogin: boolean; blockPrivate: boolean; includeSitemap: boolean; }

// ── Constants ─────────────────────────────────────────────────────────────────
const ACCENT = "#f97316";

const AGENT_OPTIONS = [
  { value: "*",                label: "* — All robots" },
  { value: "Googlebot",        label: "Googlebot" },
  { value: "Bingbot",          label: "Bingbot" },
  { value: "Googlebot-Image",  label: "Googlebot-Image" },
  { value: "Googlebot-News",   label: "Googlebot-News" },
  { value: "Googlebot-Mobile", label: "Googlebot-Mobile" },
  { value: "AdsBot-Google",    label: "AdsBot-Google" },
  { value: "custom",           label: "Custom…" },
];

const PRESET_OPTS: { key: keyof Presets; label: string; icon: string; danger?: boolean; desc: string }[] = [
  { key: "allowAll",       label: "Allow all engines",     icon: "check_circle",          desc: "Adds Allow: / for all bots" },
  { key: "blockAll",       label: "Block entire site",     icon: "block",       danger: true, desc: "Adds Disallow: / for all bots" },
  { key: "blockAdmin",     label: "Block /admin/",         icon: "admin_panel_settings",  desc: "Adds Disallow: /admin/" },
  { key: "blockLogin",     label: "Block /login/",         icon: "lock",                  desc: "Adds Disallow: /login/" },
  { key: "blockPrivate",   label: "Block private dirs",    icon: "folder_off",            desc: "Blocks /private/, /wp-admin/, /wp-login.php" },
  { key: "includeSitemap", label: "Auto-include sitemap",  icon: "map",                   desc: "Appends Sitemap: URL/sitemap.xml" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function uid() { return Math.random().toString(36).slice(2, 9); }
function mkRule(type: RuleType = "Disallow", path = ""): Rule { return { id: uid(), type, path }; }
function mkBlock(): AgentBlock { return { id: uid(), agent: "*", customAgent: "", rules: [], crawlDelay: "" }; }

const DEFAULT_AGENTS: AgentBlock[] = [{
  id: "default-block",
  agent: "*", customAgent: "",
  rules: [mkRule("Allow", "/")],
  crawlDelay: "",
}];

const DEFAULT_PRESETS: Presets = {
  allowAll: false, blockAll: false,
  blockAdmin: false, blockLogin: false, blockPrivate: false,
  includeSitemap: true,
};

// ── Generation ────────────────────────────────────────────────────────────────
function buildOutput(
  websiteUrl: string, sitemapUrl: string, host: string,
  agents: AgentBlock[], p: Presets,
): string {
  const lines: string[] = [];

  const hasPresetRules = p.allowAll || p.blockAll || p.blockAdmin || p.blockLogin || p.blockPrivate;
  const hasWildcard    = agents.some(a => a.agent === "*");
  const blocks         = (hasPresetRules && !hasWildcard)
    ? [{ id: "_auto", agent: "*", customAgent: "", rules: [], crawlDelay: "" } as AgentBlock, ...agents]
    : agents;

  for (const blk of blocks) {
    const name = blk.agent === "custom" ? blk.customAgent.trim() : blk.agent;
    if (!name) continue;

    lines.push(`User-agent: ${name}`);

    if (blk.agent === "*") {
      if (p.allowAll) {
        lines.push("Allow: /");
      } else if (p.blockAll) {
        lines.push("Disallow: /");
      } else {
        blk.rules.forEach(r => lines.push(`${r.type}: ${r.path}`));
        if (p.blockAdmin)   lines.push("Disallow: /admin/");
        if (p.blockLogin)   lines.push("Disallow: /login/");
        if (p.blockPrivate) {
          lines.push("Disallow: /private/");
          lines.push("Disallow: /wp-admin/");
          lines.push("Disallow: /wp-login.php");
        }
      }
    } else {
      blk.rules.forEach(r => lines.push(`${r.type}: ${r.path}`));
    }

    if (blk.crawlDelay) lines.push(`Crawl-delay: ${blk.crawlDelay}`);
    lines.push("");
  }

  const sitemap = sitemapUrl
    || (p.includeSitemap && websiteUrl
        ? `${websiteUrl.replace(/\/+$/, "")}/sitemap.xml`
        : "");
  if (sitemap) lines.push(`Sitemap: ${sitemap}`);
  if (host)    lines.push(`Host: ${host}`);

  return lines.join("\n").trimEnd();
}

// ── Validation ────────────────────────────────────────────────────────────────
interface Issue { level: "error" | "warning" | "info"; text: string; }

function validate(
  agents: AgentBlock[], p: Presets, sitemapUrl: string, websiteUrl: string,
): { score: number; issues: Issue[] } {
  const issues: Issue[] = [];
  let s = 0;

  if (agents.length > 0) s += 20;

  if (agents.some(a => a.agent === "*")) s += 15;
  else issues.push({ level: "info", text: "Add a wildcard (*) User-agent block to set default rules for all bots." });

  const hasSitemap = !!(sitemapUrl || (p.includeSitemap && websiteUrl));
  if (hasSitemap) s += 20;
  else issues.push({ level: "info", text: "Add your Sitemap URL so search engines can discover all your pages." });

  const blockingAll = !p.allowAll && (p.blockAll
    || agents.some(a => a.agent === "*" && a.rules.some(r => r.type === "Disallow" && r.path === "/")));
  if (blockingAll) issues.push({ level: "warning", text: "Disallow: / blocks ALL crawlers — remove it unless you intentionally want to prevent indexing." });
  else s += 20;

  let hasDup = false;
  outer: for (const a of agents) {
    const seen = new Set<string>();
    for (const r of a.rules) {
      const k = `${r.type}:${r.path}`;
      if (seen.has(k)) { hasDup = true; break outer; }
      seen.add(k);
    }
  }
  if (hasDup) issues.push({ level: "error", text: "Duplicate rules detected — remove identical Allow/Disallow entries in the same block." });
  else s += 15;

  const badPaths = agents.flatMap(a => a.rules).filter(r => r.path && !r.path.startsWith("/"));
  if (badPaths.length > 0) issues.push({ level: "error", text: `${badPaths.length} path(s) must start with "/" (e.g. /admin/ not admin/).` });
  else s += 10;

  return { score: Math.min(100, s), issues };
}

// ── Syntax highlight ──────────────────────────────────────────────────────────
function hlRobots(raw: string): string {
  return raw.split("\n").map(line => {
    const s = line.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    if (!s.trim()) return "";
    if (s.trimStart().startsWith("#"))  return `<span style="color:#6a9955">${s}</span>`;
    if (s.startsWith("User-agent:"))    return s.replace(/^(User-agent:)(.*)$/, '<span style="color:#f97316">$1</span><span style="color:#fbd5b5">$2</span>');
    if (s.startsWith("Allow:"))        return s.replace(/^(Allow:)(.*)$/, '<span style="color:#4ade80">$1</span><span style="color:#86efac">$2</span>');
    if (s.startsWith("Disallow:"))     return s.replace(/^(Disallow:)(.*)$/, '<span style="color:#f87171">$1</span><span style="color:#fca5a5">$2</span>');
    if (s.startsWith("Sitemap:"))      return s.replace(/^(Sitemap:)(.*)$/, '<span style="color:#a78bfa">$1</span><span style="color:#c4b5fd">$2</span>');
    if (s.startsWith("Crawl-delay:"))  return s.replace(/^(Crawl-delay:)(.*)$/, '<span style="color:#60a5fa">$1</span><span style="color:#93c5fd">$2</span>');
    if (s.startsWith("Host:"))         return s.replace(/^(Host:)(.*)$/, '<span style="color:#fbbf24">$1</span><span style="color:#fde68a">$2</span>');
    return `<span style="color:#988d9f">${s}</span>`;
  }).join("\n");
}

// ── Shared styles ─────────────────────────────────────────────────────────────
const inputCls  = "w-full rounded-xl px-3 py-2.5 text-[13px] outline-none transition-all bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] focus:border-[rgba(249,115,22,0.4)] text-[#e8dff0] placeholder-[#3d3345]";
const selectCls = "rounded-xl px-2.5 py-2 text-[12px] outline-none transition-all bg-[#1a1525] border border-[rgba(255,255,255,0.08)] focus:border-[rgba(249,115,22,0.4)] text-[#e8dff0] cursor-pointer";
const panelBorder = "1px solid rgba(255,255,255,0.07)";

// ── Component ─────────────────────────────────────────────────────────────────
export default function RobotsTxtGeneratorTool() {
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [sitemapUrl, setSitemapUrl] = useState("");
  const [host,       setHost]       = useState("");
  const [agents,     setAgents]     = useState<AgentBlock[]>(DEFAULT_AGENTS);
  const [presets,    setPresets]    = useState<Presets>(DEFAULT_PRESETS);
  const [copied,     setCopied]     = useState(false);

  // Live output
  const output = useMemo(
    () => buildOutput(websiteUrl, sitemapUrl, host, agents, presets),
    [websiteUrl, sitemapUrl, host, agents, presets],
  );

  // Validation
  const { score, issues } = useMemo(
    () => validate(agents, presets, sitemapUrl, websiteUrl),
    [agents, presets, sitemapUrl, websiteUrl],
  );

  const scoreColor = score >= 71 ? "#22c55e" : score >= 41 ? "#f59e0b" : "#ef4444";
  const scoreLabel = score >= 71 ? "Good" : score >= 41 ? "Needs work" : "Poor";
  const circ = 2 * Math.PI * 34;

  // ── Agent CRUD ─────────────────────────────────────────────────────────────
  const addAgent = useCallback(() => setAgents(p => [...p, mkBlock()]), []);
  const removeAgent = useCallback((id: string) => setAgents(p => p.filter(a => a.id !== id)), []);
  const patchAgent  = useCallback((id: string, patch: Partial<AgentBlock>) =>
    setAgents(p => p.map(a => a.id === id ? { ...a, ...patch } : a)), []);

  // ── Rule CRUD ──────────────────────────────────────────────────────────────
  const addRule = useCallback((agentId: string) =>
    setAgents(p => p.map(a => a.id === agentId
      ? { ...a, rules: [...a.rules, mkRule()] } : a)), []);
  const removeRule = useCallback((agentId: string, ruleId: string) =>
    setAgents(p => p.map(a => a.id === agentId
      ? { ...a, rules: a.rules.filter(r => r.id !== ruleId) } : a)), []);
  const patchRule = useCallback((agentId: string, ruleId: string, patch: Partial<Rule>) =>
    setAgents(p => p.map(a => a.id === agentId
      ? { ...a, rules: a.rules.map(r => r.id === ruleId ? { ...r, ...patch } : r) }
      : a)), []);

  // ── Presets ────────────────────────────────────────────────────────────────
  const togglePreset = useCallback((key: keyof Presets) =>
    setPresets(p => {
      const n = { ...p, [key]: !p[key] };
      if (key === "allowAll" && n.allowAll) n.blockAll = false;
      if (key === "blockAll" && n.blockAll) n.allowAll = false;
      return n;
    }), []);

  // ── Actions ────────────────────────────────────────────────────────────────
  const copy = useCallback(async () => {
    try { await navigator.clipboard.writeText(output); } catch { /* blocked */ }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [output]);

  const download = useCallback(() => {
    const blob = new Blob([output], { type: "text/plain" });
    const url  = URL.createObjectURL(blob);
    Object.assign(document.createElement("a"), { href: url, download: "robots.txt" }).click();
    URL.revokeObjectURL(url);
  }, [output]);

  const reset = useCallback(() => {
    setWebsiteUrl(""); setSitemapUrl(""); setHost("");
    setAgents(DEFAULT_AGENTS);
    setPresets(DEFAULT_PRESETS);
    setCopied(false);
  }, []);

  // ── JSX ────────────────────────────────────────────────────────────────────
  return (
    <div className="mb-12 flex flex-col gap-6">

      {/* ── Website settings ──────────────────────────────────────── */}
      <div className="glass-panel rounded-2xl p-5 flex flex-col gap-4"
        style={{ border: panelBorder }}>
        <div className="flex items-center gap-2 pb-1"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
          <span className="material-symbols-outlined text-[16px]" style={{ color: ACCENT }}>language</span>
          <p className="text-[13px] font-bold" style={{ color: "#e8dff0" }}>Website</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="rt-website" className="text-[11px] font-semibold text-[#988d9f]">Website URL</label>
            <input id="rt-website" type="url" value={websiteUrl}
              onChange={e => setWebsiteUrl(e.target.value)}
              placeholder="https://example.com"
              className={inputCls} aria-label="Website URL" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="rt-sitemap" className="text-[11px] font-semibold text-[#988d9f]">
              Sitemap URL <span className="font-normal text-[#3d3345]">(optional — auto-generated if blank)</span>
            </label>
            <input id="rt-sitemap" type="url" value={sitemapUrl}
              onChange={e => setSitemapUrl(e.target.value)}
              placeholder="https://example.com/sitemap.xml"
              className={inputCls} aria-label="Sitemap URL" />
          </div>
        </div>
      </div>

      {/* ── Quick presets ──────────────────────────────────────────── */}
      <div className="glass-panel rounded-2xl p-5 flex flex-col gap-4"
        style={{ border: panelBorder }}>
        <div className="flex items-center gap-2 pb-1"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
          <span className="material-symbols-outlined text-[16px]" style={{ color: ACCENT }}>bolt</span>
          <p className="text-[13px] font-bold" style={{ color: "#e8dff0" }}>Quick Presets</p>
          <span className="text-[10px] ml-2" style={{ color: "#3d3345" }}>Applied to the * User-agent block</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {PRESET_OPTS.map(({ key, label, icon, danger, desc }) => {
            const active = presets[key];
            const disabled = (key === "blockAdmin" || key === "blockLogin" || key === "blockPrivate" || key === "allowAll")
              && presets.blockAll;
            const accentActive = danger ? "#ef4444" : ACCENT;
            return (
              <button key={key}
                onClick={() => !disabled && togglePreset(key)}
                aria-pressed={active}
                aria-label={label}
                title={desc}
                disabled={disabled}
                className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-left transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                style={{
                  background: active
                    ? (danger ? "rgba(239,68,68,0.12)" : "rgba(249,115,22,0.12)")
                    : "rgba(255,255,255,0.03)",
                  border: `1px solid ${active ? (danger ? "rgba(239,68,68,0.35)" : "rgba(249,115,22,0.35)") : "rgba(255,255,255,0.07)"}`,
                }}>
                <span className="material-symbols-outlined text-[16px]"
                  style={{ color: active ? accentActive : "#988d9f" }}>{icon}</span>
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold leading-tight"
                    style={{ color: active ? accentActive : "#c8c0d0" }}>{label}</p>
                  <p className="text-[9px] leading-tight mt-0.5" style={{ color: "#3d3345" }}>{desc}</p>
                </div>
                {active && (
                  <span className="ml-auto shrink-0 material-symbols-outlined text-[14px]"
                    style={{ color: accentActive }}>check</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── User-agent blocks ─────────────────────────────────────── */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px]" style={{ color: ACCENT }}>robot_2</span>
            <p className="text-[13px] font-bold" style={{ color: "#e8dff0" }}>User-agent Rules</p>
          </div>
          <button onClick={addAgent}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all"
            style={{ background: "rgba(249,115,22,0.1)", color: ACCENT, border: "1px solid rgba(249,115,22,0.22)" }}>
            <span className="material-symbols-outlined text-[14px]">add</span>Add User-agent
          </button>
        </div>

        {agents.map((blk, blkIdx) => (
          <div key={blk.id} className="glass-panel rounded-2xl p-4 flex flex-col gap-3"
            style={{ border: "1px solid rgba(249,115,22,0.12)" }}>
            {/* Block header */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0"
                style={{ background: "rgba(249,115,22,0.1)", color: ACCENT }}>
                #{blkIdx + 1}
              </span>
              <select
                value={blk.agent}
                onChange={e => patchAgent(blk.id, { agent: e.target.value, customAgent: "" })}
                className={`${selectCls} flex-1`}
                aria-label="User-agent">
                {AGENT_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              {blk.agent === "custom" && (
                <input
                  type="text"
                  value={blk.customAgent}
                  onChange={e => patchAgent(blk.id, { customAgent: e.target.value })}
                  placeholder="MyBot"
                  className={`${inputCls} flex-1`}
                  aria-label="Custom user-agent name"
                />
              )}
              {agents.length > 1 && (
                <button onClick={() => removeAgent(blk.id)}
                  aria-label="Remove this user-agent block"
                  className="w-7 h-7 flex items-center justify-center rounded-lg transition-all"
                  style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.18)" }}>
                  <span className="material-symbols-outlined text-[14px] text-red-400">close</span>
                </button>
              )}
            </div>

            {/* Rules */}
            <div className="flex flex-col gap-2">
              {blk.rules.length > 0 && (
                <div className="grid gap-2">
                  {blk.rules.map(rule => (
                    <div key={rule.id} className="flex items-center gap-2">
                      <select
                        value={rule.type}
                        onChange={e => patchRule(blk.id, rule.id, { type: e.target.value as RuleType })}
                        className={selectCls}
                        style={{ color: rule.type === "Allow" ? "#4ade80" : "#f87171", minWidth: 102 }}
                        aria-label="Rule type">
                        <option value="Allow"   style={{ color: "#4ade80" }}>Allow</option>
                        <option value="Disallow" style={{ color: "#f87171" }}>Disallow</option>
                      </select>
                      <input
                        type="text"
                        value={rule.path}
                        onChange={e => patchRule(blk.id, rule.id, { path: e.target.value })}
                        placeholder="/path/"
                        className={inputCls}
                        style={rule.path && !rule.path.startsWith("/")
                          ? { borderColor: "rgba(239,68,68,0.5)" } : undefined}
                        aria-label="Rule path"
                      />
                      <button onClick={() => removeRule(blk.id, rule.id)}
                        aria-label="Remove rule"
                        className="w-7 h-7 flex items-center justify-center rounded-lg shrink-0 transition-all"
                        style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)" }}>
                        <span className="material-symbols-outlined text-[13px] text-red-400">remove</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add rule + crawl-delay row */}
              <div className="flex items-center gap-3 flex-wrap pt-1">
                <button onClick={() => addRule(blk.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold transition-all"
                  style={{ background: "rgba(255,255,255,0.04)", color: "#988d9f", border: "1px solid rgba(255,255,255,0.07)" }}>
                  <span className="material-symbols-outlined text-[13px]">add</span>Add Rule
                </button>
                {blk.rules.length === 0 && (
                  <span className="text-[11px]" style={{ color: "#3d3345" }}>
                    No rules — bot will inherit defaults
                  </span>
                )}
                <div className="flex items-center gap-2 ml-auto">
                  <label htmlFor={`cd-${blk.id}`} className="text-[11px] font-semibold shrink-0"
                    style={{ color: "#988d9f" }}>Crawl-delay:</label>
                  <input
                    id={`cd-${blk.id}`}
                    type="number" min="0" max="86400" step="1"
                    value={blk.crawlDelay}
                    onChange={e => patchAgent(blk.id, { crawlDelay: e.target.value })}
                    placeholder="seconds"
                    className="rounded-xl px-2.5 py-1.5 text-[12px] outline-none bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] focus:border-[rgba(249,115,22,0.4)] text-[#e8dff0] placeholder-[#3d3345] w-24"
                    aria-label="Crawl-delay in seconds"
                  />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Advanced settings ─────────────────────────────────────── */}
      <div className="glass-panel rounded-2xl p-5 flex flex-col gap-4"
        style={{ border: panelBorder }}>
        <div className="flex items-center gap-2 pb-1"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
          <span className="material-symbols-outlined text-[16px]" style={{ color: ACCENT }}>settings</span>
          <p className="text-[13px] font-bold" style={{ color: "#e8dff0" }}>Advanced</p>
        </div>
        <div className="flex flex-col gap-1.5 max-w-sm">
          <label htmlFor="rt-host" className="text-[11px] font-semibold text-[#988d9f]">
            Host directive <span className="font-normal text-[#3d3345]">(optional — Yandex only)</span>
          </label>
          <input id="rt-host" type="text" value={host}
            onChange={e => setHost(e.target.value)}
            placeholder="example.com"
            className={inputCls} aria-label="Host directive" />
        </div>
      </div>

      {/* ── Validation score ──────────────────────────────────────── */}
      <div className="glass-panel rounded-2xl p-5 flex flex-wrap items-start gap-6"
        style={{ border: panelBorder }}>
        {/* Gauge */}
        <div className="flex flex-col items-center gap-1.5 shrink-0">
          <div className="relative w-20 h-20">
            <svg width="80" height="80" viewBox="0 0 80 80" aria-hidden>
              <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="6" />
              <circle cx="40" cy="40" r="34" fill="none"
                stroke={scoreColor} strokeWidth="6"
                strokeDasharray={circ}
                strokeDashoffset={circ * (1 - score / 100)}
                strokeLinecap="round" transform="rotate(-90 40 40)"
                style={{ transition: "stroke-dashoffset 0.4s ease, stroke 0.4s ease" }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[20px] font-black tabular-nums"
                style={{ color: scoreColor, lineHeight: 1 }}>{score}</span>
              <span className="text-[9px] font-bold"
                style={{ color: scoreColor, opacity: 0.7 }}>/ 100</span>
            </div>
          </div>
          <span className="text-[11px] font-bold" style={{ color: scoreColor }}>{scoreLabel}</span>
        </div>

        {/* Issues */}
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-bold mb-2" style={{ color: "#e8dff0" }}>Validation</p>
          {issues.length === 0 ? (
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px] text-green-400">check_circle</span>
              <span className="text-[13px]" style={{ color: "#22c55e" }}>All checks passed — your robots.txt looks great!</span>
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              {issues.map((iss, i) => {
                const ic = iss.level === "error" ? "#ef4444" : iss.level === "warning" ? "#f59e0b" : "#60a5fa";
                const ig = iss.level === "error" ? "error" : iss.level === "warning" ? "warning" : "info";
                return (
                  <li key={i} className="flex items-start gap-2">
                    <span className="material-symbols-outlined text-[14px] mt-0.5 shrink-0"
                      style={{ color: ic }}>{ig}</span>
                    <span className="text-[12px]" style={{ color: "#c8b89f" }}>{iss.text}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* ── Action buttons ────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-3">
        <button onClick={copy}
          className="btn-primary flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm">
          <span className="material-symbols-outlined text-[16px]">
            {copied ? "check" : "content_copy"}
          </span>
          {copied ? "Copied!" : "Copy robots.txt"}
        </button>
        <button onClick={download}
          className="flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm transition-all"
          style={{ background: "rgba(249,115,22,0.09)", color: ACCENT, border: "1px solid rgba(249,115,22,0.22)" }}>
          <span className="material-symbols-outlined text-[15px]">download</span>
          Download robots.txt
        </button>
        <button onClick={reset}
          className="flex items-center gap-2 px-4 py-3 rounded-xl font-semibold text-sm"
          style={{ background: "rgba(255,255,255,0.04)", color: "#988d9f", border: "1px solid rgba(255,255,255,0.07)" }}>
          <span className="material-symbols-outlined text-[14px]">restart_alt</span>Reset
        </button>
      </div>

      {/* ── Live output ───────────────────────────────────────────── */}
      <div className="glass-panel rounded-2xl overflow-hidden"
        style={{ border: "1px solid rgba(249,115,22,0.18)" }}>
        <div className="px-5 py-3 flex items-center justify-between"
          style={{ borderBottom: "1px solid rgba(249,115,22,0.1)", background: "rgba(249,115,22,0.03)" }}>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[14px]" style={{ color: ACCENT }}>robot_2</span>
            <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: ACCENT }}>
              robots.txt — Live Preview
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
              style={{ background: "rgba(249,115,22,0.1)", color: ACCENT }}>Live</span>
            <button onClick={copy}
              className="flex items-center gap-1.5 px-3 py-1 rounded-xl text-[11px] font-bold"
              style={{ background: "rgba(249,115,22,0.1)", color: ACCENT }}>
              <span className="material-symbols-outlined text-[12px]">
                {copied ? "check" : "content_copy"}
              </span>
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>

        {/* Legend */}
        <div className="px-5 py-2 flex flex-wrap gap-x-4 gap-y-1"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.05)", background: "#0d0d14" }}>
          {[
            { label: "User-agent", color: "#f97316" },
            { label: "Allow",      color: "#4ade80" },
            { label: "Disallow",   color: "#f87171" },
            { label: "Sitemap",    color: "#a78bfa" },
            { label: "Crawl-delay", color: "#60a5fa" },
          ].map(({ label, color }) => (
            <span key={label} className="flex items-center gap-1.5 text-[10px] font-semibold">
              <span className="w-2 h-2 rounded-full" style={{ background: color }} />
              <span style={{ color: "#988d9f" }}>{label}</span>
            </span>
          ))}
        </div>

        <pre className="p-5 overflow-x-auto text-[12px] leading-relaxed m-0 min-h-[120px]"
          style={{ fontFamily: "'Cascadia Code','Fira Code','Courier New',monospace", background: "#0d0d14" }}>
          <code dangerouslySetInnerHTML={{ __html: hlRobots(output) }} />
        </pre>
      </div>
    </div>
  );
}
