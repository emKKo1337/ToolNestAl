"use client";

import { useState, useRef, useCallback } from "react";
import type { UsernameStyle, UsernamePlatform, UsernameLength } from "@/types/ai";

// ── Constants ─────────────────────────────────────────────────────────────────

const KEYWORD_MAX   = 40;
const INTERESTS_MAX = 150;

// ── Option definitions (outside component) ────────────────────────────────────

interface PlatformOption { id: UsernamePlatform; label: string; icon: string; limit: string }
interface StyleOption    { id: UsernameStyle;    label: string; icon: string; description: string }
interface LengthOption   { id: UsernameLength;   label: string; chars: string }

const PLATFORMS: PlatformOption[] = [
  { id: "instagram", label: "Instagram", icon: "photo_camera",   limit: "≤30"  },
  { id: "tiktok",    label: "TikTok",    icon: "music_note",     limit: "≤24"  },
  { id: "youtube",   label: "YouTube",   icon: "play_circle",    limit: "≤30"  },
  { id: "x",         label: "X",         icon: "close",          limit: "≤15"  },
  { id: "twitch",    label: "Twitch",    icon: "live_tv",        limit: "≤25"  },
  { id: "steam",     label: "Steam",     icon: "sports_esports", limit: "≤32"  },
  { id: "discord",   label: "Discord",   icon: "forum",          limit: "≤32"  },
  { id: "github",    label: "GitHub",    icon: "code",           limit: "≤39"  },
];

const STYLES: StyleOption[] = [
  { id: "professional", label: "Professional", icon: "business_center",        description: "Clean & credible"    },
  { id: "gaming",       label: "Gaming",       icon: "sports_esports",         description: "Bold & edgy"         },
  { id: "minimal",      label: "Minimal",      icon: "remove",                 description: "Short & elegant"     },
  { id: "funny",        label: "Funny",        icon: "sentiment_very_satisfied",description: "Witty & playful"    },
  { id: "tech",         label: "Tech",         icon: "terminal",               description: "Nerdy & clever"      },
  { id: "luxury",       label: "Luxury",       icon: "diamond",                description: "Premium & exclusive" },
];

const LENGTHS: LengthOption[] = [
  { id: "short",  label: "Short",  chars: "< 8 chars"   },
  { id: "medium", label: "Medium", chars: "8–15 chars"  },
  { id: "long",   label: "Long",   chars: "15–25 chars" },
];

// ── Parsed username card type ─────────────────────────────────────────────────

interface UsernameCard {
  username: string;
  style: string;
  alternatives: string[];
}

// ── Parser (outside component) ────────────────────────────────────────────────

function parseUsernameCards(raw: string): UsernameCard[] {
  const blocks = raw.split(/---+/).map((b) => b.trim()).filter(Boolean);
  const cards: UsernameCard[] = [];
  for (const block of blocks) {
    const get = (key: string) => {
      const match = block.match(new RegExp(`^${key}:\\s*(.+)$`, "m"));
      return match ? match[1].trim() : "";
    };
    const username = get("USERNAME");
    if (!username) continue;
    const altsRaw = get("ALTERNATIVES");
    const alternatives = altsRaw
      ? altsRaw.split("|").map((a) => a.trim()).filter(Boolean)
      : [];
    cards.push({ username, style: get("STYLE"), alternatives });
  }
  return cards;
}

// ── Sub-components (outside component) ────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[12px] font-semibold uppercase tracking-[0.06em] mb-2" style={{ color: "#988d9f" }}>
      {children}
    </p>
  );
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className="flex items-center gap-2.5 transition-all"
    >
      <div
        className="w-10 h-5 rounded-full relative transition-all duration-200 flex-shrink-0"
        style={{ background: checked ? "#ddb7ff" : "rgba(255,255,255,0.1)" }}
      >
        <div
          className="absolute top-0.5 w-4 h-4 rounded-full transition-all duration-200"
          style={{
            background: checked ? "#131313" : "#6b5b7a",
            left: checked ? "calc(100% - 18px)" : "2px",
          }}
        />
      </div>
      <span className="text-[13px] font-medium" style={{ color: checked ? "#e2e2e2" : "#6b5b7a" }}>
        {label}
      </span>
    </button>
  );
}

interface UsernameCardProps {
  card: UsernameCard;
  index: number;
  isFav: boolean;
  onFav: () => void;
  copiedUsername: string | null;
  onCopy: (text: string) => void;
}

function UsernameCardItem({ card, index, isFav, onFav, copiedUsername, onCopy }: UsernameCardProps) {
  const isCopiedMain = copiedUsername === card.username;
  return (
    <div
      className="glass-panel rounded-2xl p-4 flex flex-col gap-3 transition-all duration-200"
      style={{ border: isFav ? "1px solid rgba(221,183,255,0.4)" : "1px solid rgba(255,255,255,0.07)" }}
    >
      {/* Header row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
            style={{ background: "rgba(221,183,255,0.12)", color: "#ddb7ff" }}
            aria-hidden="true"
          >
            {index + 1}
          </span>
          <span
            className="text-[15px] font-black tracking-tight truncate font-mono"
            style={{ color: "#f0e8ff" }}
          >
            @{card.username}
          </span>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={onFav}
            aria-label={isFav ? "Remove from favourites" : "Add to favourites"}
            aria-pressed={isFav}
            className="w-7 h-7 rounded-lg flex items-center justify-center transition-all"
            style={{
              background: isFav ? "rgba(251,191,36,0.15)" : "rgba(255,255,255,0.05)",
              border: `1px solid ${isFav ? "rgba(251,191,36,0.4)" : "rgba(255,255,255,0.08)"}`,
            }}
          >
            <span
              className="material-symbols-outlined text-[14px]"
              style={{ color: isFav ? "#fbbf24" : "#6b5b7a", fontVariationSettings: isFav ? "'FILL' 1" : "'FILL' 0" }}
              aria-hidden="true"
            >
              star
            </span>
          </button>
          <button
            onClick={() => onCopy(card.username)}
            aria-label={isCopiedMain ? "Copied!" : `Copy @${card.username}`}
            className="w-7 h-7 rounded-lg flex items-center justify-center transition-all"
            style={{
              background: isCopiedMain ? "rgba(34,197,94,0.13)" : "rgba(255,255,255,0.05)",
              border: `1px solid ${isCopiedMain ? "rgba(34,197,94,0.3)" : "rgba(255,255,255,0.08)"}`,
            }}
          >
            <span
              className="material-symbols-outlined text-[13px]"
              style={{ color: isCopiedMain ? "#22c55e" : "#6b5b7a" }}
              aria-hidden="true"
            >
              {isCopiedMain ? "check" : "content_copy"}
            </span>
          </button>
        </div>
      </div>

      {/* Alternatives */}
      {card.alternatives.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {card.alternatives.map((alt, i) => {
            const isCopiedAlt = copiedUsername === alt;
            return (
              <button
                key={i}
                onClick={() => onCopy(alt)}
                aria-label={isCopiedAlt ? "Copied!" : `Copy @${alt}`}
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-mono font-medium transition-all"
                style={{
                  background: isCopiedAlt ? "rgba(34,197,94,0.08)" : "rgba(221,183,255,0.06)",
                  border: `1px solid ${isCopiedAlt ? "rgba(34,197,94,0.25)" : "rgba(221,183,255,0.15)"}`,
                  color: isCopiedAlt ? "#22c55e" : "#a899b5",
                }}
              >
                <span className="material-symbols-outlined text-[10px]" aria-hidden="true">
                  alternate_email
                </span>
                {alt}
                <span className="material-symbols-outlined text-[10px]" aria-hidden="true">
                  {isCopiedAlt ? "check" : "content_copy"}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function AiUsernameGeneratorTool() {
  // Form state
  const [keyword,           setKeyword]           = useState("");
  const [interests,         setInterests]         = useState("");
  const [platform,          setPlatform]          = useState<UsernamePlatform>("instagram");
  const [style,             setStyle]             = useState<UsernameStyle>("minimal");
  const [length,            setLength]            = useState<UsernameLength>("medium");
  const [allowNumbers,      setAllowNumbers]      = useState(true);
  const [allowSpecialChars, setAllowSpecialChars] = useState(true);

  // UI state
  const [cards,           setCards]           = useState<UsernameCard[]>([]);
  const [favourites,      setFavourites]      = useState<Set<string>>(new Set());
  const [copiedUsername,  setCopiedUsername]  = useState<string | null>(null);
  const [isLoading,       setIsLoading]       = useState(false);
  const [isStreaming,     setIsStreaming]      = useState(false);
  const [errorMsg,        setErrorMsg]        = useState<string | null>(null);
  const [keywordError,    setKeywordError]    = useState(false);

  const abortRef  = useRef<AbortController | null>(null);
  const outputRef = useRef<HTMLDivElement>(null);
  const hasCards  = cards.length > 0;

  // ── Core generate ──────────────────────────────────────────────────────────

  const runGenerate = useCallback(async (fields: {
    keyword: string; interests: string; platform: UsernamePlatform;
    style: UsernameStyle; length: UsernameLength;
    allowNumbers: boolean; allowSpecialChars: boolean;
  }) => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setIsLoading(true);
    setIsStreaming(true);
    setErrorMsg(null);
    setCards([]);

    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task: "generateUsernames",
          payload: {
            keyword:           fields.keyword,
            interests:         fields.interests.trim() || undefined,
            platform:          fields.platform,
            style:             fields.style,
            length:            fields.length,
            allowNumbers:      fields.allowNumbers,
            allowSpecialChars: fields.allowSpecialChars,
            count:             10,
          },
          options: { stream: true },
        }),
        signal: ctrl.signal,
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error((json as { message?: string }).message ?? `Server error ${res.status}`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response stream.");
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        const partial = parseUsernameCards(accumulated);
        if (partial.length > 0) setCards(partial);
      }

      setCards(parseUsernameCards(accumulated));
      setTimeout(() => outputRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 150);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
      setIsStreaming(false);
    }
  }, []);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleGenerate = useCallback(async () => {
    if (!keyword.trim()) { setKeywordError(true); return; }
    setKeywordError(false);
    await runGenerate({ keyword, interests, platform, style, length, allowNumbers, allowSpecialChars });
  }, [keyword, interests, platform, style, length, allowNumbers, allowSpecialChars, runGenerate]);

  const handleRegenerate = useCallback(async () => {
    if (keyword.trim())
      await runGenerate({ keyword, interests, platform, style, length, allowNumbers, allowSpecialChars });
  }, [keyword, interests, platform, style, length, allowNumbers, allowSpecialChars, runGenerate]);

  const handleFav = useCallback((username: string) => {
    setFavourites((prev) => {
      const next = new Set(prev);
      if (next.has(username)) next.delete(username); else next.add(username);
      return next;
    });
  }, []);

  const handleCopy = useCallback(async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedUsername(text);
    setTimeout(() => setCopiedUsername(null), 2000);
  }, []);

  const handleReset = useCallback(() => {
    abortRef.current?.abort();
    setKeyword(""); setInterests(""); setPlatform("instagram");
    setStyle("minimal"); setLength("medium");
    setAllowNumbers(true); setAllowSpecialChars(true);
    setCards([]); setFavourites(new Set());
    setErrorMsg(null); setKeywordError(false);
  }, []);

  const favList       = cards.filter((c) => favourites.has(c.username));
  const activeStyle   = STYLES.find((s) => s.id === style)!;
  const activePlatform = PLATFORMS.find((p) => p.id === platform)!;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="mb-12 flex flex-col gap-8">

      {/* Form */}
      <div className="glass-panel rounded-2xl p-6 flex flex-col gap-5">
        <p className="text-[15px] font-bold" style={{ color: "#e2e2e2" }}>Create your username</p>

        {/* Keyword + Interests */}
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <SectionLabel>Name or Keyword *</SectionLabel>
            <div>
              <input
                type="text"
                value={keyword}
                onChange={(e) => { setKeyword(e.target.value.slice(0, KEYWORD_MAX)); setKeywordError(false); }}
                placeholder="e.g. Nova, Alex, Dragon, Swift…"
                aria-label="Name or keyword"
                aria-invalid={keywordError}
                className="w-full rounded-xl px-4 py-3 text-[14px] placeholder-[#4d4354] focus:outline-none transition-colors"
                style={{
                  background: "rgba(0,0,0,0.25)",
                  color: "#e2e2e2",
                  border: `1px solid ${keywordError ? "rgba(239,68,68,0.6)" : "rgba(255,255,255,0.09)"}`,
                }}
              />
              <div className="flex justify-between items-center mt-1">
                {keywordError
                  ? <p role="alert" className="text-[11px]" style={{ color: "#ef4444" }}>Please enter a name or keyword.</p>
                  : <span />}
                <p className="text-[11px]" style={{ color: "#4d4354" }}>{keyword.length}/{KEYWORD_MAX}</p>
              </div>
            </div>
          </div>

          <div>
            <SectionLabel>Interests (optional)</SectionLabel>
            <div>
              <input
                type="text"
                value={interests}
                onChange={(e) => setInterests(e.target.value.slice(0, INTERESTS_MAX))}
                placeholder="e.g. gaming, fitness, photography, music…"
                aria-label="Interests"
                className="w-full rounded-xl px-4 py-3 text-[14px] placeholder-[#4d4354] focus:outline-none transition-colors"
                style={{ background: "rgba(0,0,0,0.25)", color: "#e2e2e2", border: "1px solid rgba(255,255,255,0.09)" }}
              />
              <p className="text-[11px] mt-1 text-right" style={{ color: "#4d4354" }}>
                {interests.length}/{INTERESTS_MAX}
              </p>
            </div>
          </div>
        </div>

        {/* Platform */}
        <div>
          <SectionLabel>Platform</SectionLabel>
          <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
            {PLATFORMS.map((p) => {
              const isActive = platform === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => setPlatform(p.id)}
                  aria-pressed={isActive}
                  className="flex flex-col items-center gap-1.5 py-3 px-1 rounded-xl text-center transition-all duration-150"
                  style={{
                    background: isActive ? "rgba(221,183,255,0.12)" : "rgba(255,255,255,0.04)",
                    border: `1px solid ${isActive ? "rgba(221,183,255,0.35)" : "rgba(255,255,255,0.07)"}`,
                    color: isActive ? "#ddb7ff" : "#988d9f",
                  }}
                >
                  <span
                    className="material-symbols-outlined text-[20px]"
                    style={{ color: isActive ? "#ddb7ff" : "#6b5b7a", fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0" }}
                    aria-hidden="true"
                  >
                    {p.icon}
                  </span>
                  <p className="text-[10px] font-semibold leading-tight">{p.label}</p>
                  <p className="text-[9px]" style={{ color: isActive ? "rgba(221,183,255,0.55)" : "#4d4354" }}>
                    {p.limit}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Style */}
        <div>
          <SectionLabel>Style</SectionLabel>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {STYLES.map((s) => {
              const isActive = style === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => setStyle(s.id)}
                  aria-pressed={isActive}
                  className="flex flex-col items-center gap-1.5 py-3 px-1 rounded-xl text-center transition-all duration-150"
                  style={{
                    background: isActive ? "rgba(221,183,255,0.12)" : "rgba(255,255,255,0.04)",
                    border: `1px solid ${isActive ? "rgba(221,183,255,0.35)" : "rgba(255,255,255,0.07)"}`,
                    color: isActive ? "#ddb7ff" : "#988d9f",
                  }}
                >
                  <span
                    className="material-symbols-outlined text-[20px]"
                    style={{ color: isActive ? "#ddb7ff" : "#6b5b7a", fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0" }}
                    aria-hidden="true"
                  >
                    {s.icon}
                  </span>
                  <p className="text-[11px] font-semibold leading-tight">{s.label}</p>
                  <p className="text-[10px] leading-tight hidden sm:block" style={{ color: isActive ? "rgba(221,183,255,0.55)" : "#4d4354" }}>
                    {s.description}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Length + Toggles row */}
        <div className="grid sm:grid-cols-2 gap-5">
          <div>
            <SectionLabel>Username Length</SectionLabel>
            <div className="grid grid-cols-3 gap-2">
              {LENGTHS.map((l) => {
                const isActive = length === l.id;
                return (
                  <button
                    key={l.id}
                    onClick={() => setLength(l.id)}
                    aria-pressed={isActive}
                    className="flex flex-col gap-0.5 px-3 py-2.5 rounded-xl text-center transition-all duration-150"
                    style={{
                      background: isActive ? "rgba(221,183,255,0.1)" : "rgba(255,255,255,0.04)",
                      border: `1px solid ${isActive ? "rgba(221,183,255,0.3)" : "rgba(255,255,255,0.06)"}`,
                      color: isActive ? "#ddb7ff" : "#988d9f",
                    }}
                  >
                    <p className="text-[12px] font-semibold">{l.label}</p>
                    <p className="text-[10px]" style={{ color: isActive ? "rgba(221,183,255,0.6)" : "#4d4354" }}>
                      {l.chars}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col justify-center gap-4">
            <SectionLabel>Options</SectionLabel>
            <Toggle checked={allowNumbers}      onChange={setAllowNumbers}      label="Allow numbers (0–9)"          />
            <Toggle checked={allowSpecialChars} onChange={setAllowSpecialChars} label="Allow special chars ( _ . - )" />
          </div>
        </div>

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            onClick={handleGenerate}
            disabled={isLoading}
            aria-label="Generate usernames"
            className="flex-1 py-4 rounded-xl text-[15px] font-bold tracking-[0.02em] transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed"
            style={{
              background: isLoading ? "rgba(221,183,255,0.12)" : "linear-gradient(135deg,#ddb7ff 0%,#4cd7f6 100%)",
              color: isLoading ? "#ddb7ff" : "#131313",
              boxShadow: isLoading ? "none" : "0 0 24px rgba(221,183,255,0.2)",
            }}
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-3">
                <span className="inline-block w-4 h-4 border-2 border-[#ddb7ff] border-t-transparent rounded-full animate-spin" />
                Generating usernames…
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }} aria-hidden="true">
                  alternate_email
                </span>
                Generate Usernames
              </span>
            )}
          </button>

          {hasCards && (
            <button
              onClick={handleRegenerate}
              disabled={isLoading}
              aria-label="Regenerate usernames"
              className="px-5 py-4 rounded-xl transition-all disabled:opacity-40"
              style={{ background: "rgba(255,255,255,0.05)", color: "#988d9f", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">refresh</span>
            </button>
          )}

          <button
            onClick={handleReset}
            aria-label="Reset form"
            className="px-5 py-4 rounded-xl transition-all"
            style={{ background: "rgba(255,255,255,0.04)", color: "#6b5b7a", border: "1px solid rgba(255,255,255,0.07)" }}
          >
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">restart_alt</span>
          </button>
        </div>
      </div>

      {/* Results */}
      <div ref={outputRef} className="flex flex-col gap-6">

        {/* Empty state */}
        {!hasCards && !isLoading && !errorMsg && (
          <div
            className="glass-panel rounded-2xl p-12 flex flex-col items-center justify-center text-center gap-4"
            aria-live="polite"
          >
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: "rgba(221,183,255,0.08)" }}>
              <span className="material-symbols-outlined text-[32px]" style={{ color: "#ddb7ff", fontVariationSettings: "'FILL' 0" }} aria-hidden="true">
                alternate_email
              </span>
            </div>
            <div>
              <p className="text-[16px] font-semibold mb-1" style={{ color: "#e2e2e2" }}>Your usernames will appear here</p>
              <p className="text-[13px] max-w-[280px] leading-relaxed" style={{ color: "#6b5b7a" }}>
                Enter a keyword, pick your platform and click <strong style={{ color: "#9b8da8" }}>Generate Usernames</strong>.
              </p>
            </div>
          </div>
        )}

        {/* Loading skeletons */}
        {isLoading && cards.length === 0 && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="glass-panel rounded-2xl p-4 flex flex-col gap-2.5">
                <div className="h-5 w-3/4 rounded animate-pulse" style={{ background: "rgba(255,255,255,0.08)", animationDelay: `${i * 60}ms` }} />
                <div className="flex gap-1.5 flex-wrap">
                  {[0, 1].map((j) => (
                    <div key={j} className="h-6 w-20 rounded-lg animate-pulse" style={{ background: "rgba(221,183,255,0.05)", animationDelay: `${i * 60 + j * 30 + 40}ms` }} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Username cards */}
        {hasCards && (
          <>
            {/* Meta bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 px-1">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-[13px]" style={{ color: "#988d9f" }}>
                  {cards.length} usernames for{" "}
                  <span style={{ color: "#ddb7ff" }}>{activePlatform.label}</span>
                  {isStreaming && <span className="ml-2 text-[11px]" style={{ color: "#ddb7ff" }}>— streaming…</span>}
                </span>
                <span
                  className="flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full"
                  style={{ background: "rgba(221,183,255,0.1)", color: "#ddb7ff", border: "1px solid rgba(221,183,255,0.2)" }}
                >
                  <span className="material-symbols-outlined text-[12px]" style={{ fontVariationSettings: "'FILL' 1" }} aria-hidden="true">
                    {activeStyle.icon}
                  </span>
                  {activeStyle.label}
                </span>
              </div>
              {favourites.size > 0 && (
                <span className="flex items-center gap-1.5 text-[12px]" style={{ color: "#fbbf24" }}>
                  <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }} aria-hidden="true">star</span>
                  {favourites.size} favourite{favourites.size !== 1 ? "s" : ""}
                </span>
              )}
            </div>

            {/* Grid */}
            <div
              className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3"
              aria-label="Generated usernames"
              aria-live="polite"
            >
              {cards.map((card, i) => (
                <UsernameCardItem
                  key={`${card.username}-${i}`}
                  card={card}
                  index={i}
                  isFav={favourites.has(card.username)}
                  onFav={() => handleFav(card.username)}
                  copiedUsername={copiedUsername}
                  onCopy={handleCopy}
                />
              ))}
            </div>

            {/* Favourites summary */}
            {favList.length > 0 && (
              <div className="glass-panel rounded-2xl p-5 flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px]" style={{ color: "#fbbf24", fontVariationSettings: "'FILL' 1" }} aria-hidden="true">star</span>
                  <p className="text-[14px] font-bold" style={{ color: "#e2e2e2" }}>Your Favourites</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {favList.map((c) => (
                    <button
                      key={c.username}
                      onClick={() => handleCopy(c.username)}
                      aria-label={`Copy @${c.username}`}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-mono font-semibold transition-all hover:opacity-80"
                      style={{ background: "rgba(251,191,36,0.1)", color: "#fbbf24", border: "1px solid rgba(251,191,36,0.25)" }}
                    >
                      @{c.username}
                      <span className="material-symbols-outlined text-[12px]" aria-hidden="true">
                        {copiedUsername === c.username ? "check" : "content_copy"}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <p className="text-[12px] px-1" style={{ color: "#4d4354" }}>
              Always verify username availability directly on the platform before committing.
            </p>
          </>
        )}

        {/* Error state */}
        {errorMsg && !isLoading && (
          <div
            className="glass-panel rounded-2xl p-6 flex flex-col gap-3"
            role="alert"
            style={{ border: "1px solid rgba(239,68,68,0.3)" }}
          >
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]" style={{ color: "#ef4444" }} aria-hidden="true">error</span>
              <p className="text-[14px] font-semibold" style={{ color: "#ef4444" }}>Generation failed</p>
            </div>
            <p className="text-[13px]" style={{ color: "#9b8da8" }}>{errorMsg}</p>
            <button
              onClick={handleRegenerate}
              className="self-start flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-semibold transition-all"
              style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)" }}
            >
              <span className="material-symbols-outlined text-[14px]">refresh</span>
              Try again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
