"use client";

import { useState, useRef, useCallback } from "react";
import type { SloganTone, SloganLength } from "@/types/ai";

// ── Constants ─────────────────────────────────────────────────────────────────

const DESC_MAX      = 350;
const KEYWORDS_MAX  = 150;

const INDUSTRIES = [
  "Technology", "E-commerce", "Health & Wellness", "Finance & Fintech",
  "Food & Beverage", "Fashion & Apparel", "Real Estate", "Education",
  "Marketing & Media", "Travel & Hospitality", "Legal & Consulting",
  "Beauty & Cosmetics", "Sports & Fitness", "Entertainment", "Other",
];

// ── Option definitions (outside component) ────────────────────────────────────

interface ToneOption   { id: SloganTone;   label: string; icon: string; description: string }
interface LengthOption { id: SloganLength; label: string; example: string }

const TONES: ToneOption[] = [
  { id: "professional", label: "Professional", icon: "business_center", description: "Credible & trustworthy"  },
  { id: "creative",     label: "Creative",     icon: "auto_awesome",    description: "Clever & unexpected"     },
  { id: "luxury",       label: "Luxury",       icon: "diamond",         description: "Refined & aspirational"  },
  { id: "fun",          label: "Fun",          icon: "sentiment_very_satisfied", description: "Playful & witty" },
  { id: "modern",       label: "Modern",       icon: "electric_bolt",   description: "Sleek & forward-thinking"},
];

const LENGTHS: LengthOption[] = [
  { id: "short",  label: "Short",  example: "2–4 words" },
  { id: "medium", label: "Medium", example: "5–8 words" },
  { id: "long",   label: "Long",   example: "9–14 words" },
];

// ── Parsed slogan card type ────────────────────────────────────────────────────

interface SloganCard {
  slogan: string;
  explanation: string;
  tone: string;
  alternatives: string[];
}

// ── Parser (outside component) ────────────────────────────────────────────────

function parseSloganCards(raw: string): SloganCard[] {
  const blocks = raw.split(/---+/).map((b) => b.trim()).filter(Boolean);
  const cards: SloganCard[] = [];
  for (const block of blocks) {
    const get = (key: string) => {
      const match = block.match(new RegExp(`^${key}:\\s*(.+)$`, "m"));
      return match ? match[1].trim() : "";
    };
    const slogan = get("SLOGAN");
    if (!slogan) continue;
    const altsRaw = get("ALTERNATIVES");
    const alternatives = altsRaw
      ? altsRaw.split("|").map((a) => a.trim()).filter(Boolean)
      : [];
    cards.push({ slogan, explanation: get("EXPLANATION"), tone: get("TONE"), alternatives });
  }
  return cards;
}

// ── Sub-components (defined outside to prevent remounting) ────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[12px] font-semibold uppercase tracking-[0.06em] mb-2" style={{ color: "#988d9f" }}>
      {children}
    </p>
  );
}

interface SloganCardProps {
  card: SloganCard;
  index: number;
  isFav: boolean;
  onFav: () => void;
  copiedSlogan: string | null;
  onCopy: (text: string) => void;
}

function SloganCardItem({ card, index, isFav, onFav, copiedSlogan, onCopy }: SloganCardProps) {
  const isCopiedMain = copiedSlogan === card.slogan;
  return (
    <div
      className="glass-panel rounded-2xl p-5 flex flex-col gap-3 transition-all duration-200"
      style={{ border: isFav ? "1px solid rgba(221,183,255,0.4)" : "1px solid rgba(255,255,255,0.07)" }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold"
            style={{ background: "rgba(221,183,255,0.12)", color: "#ddb7ff" }}
            aria-hidden="true"
          >
            {index + 1}
          </span>
          <span className="material-symbols-outlined text-[16px] flex-shrink-0" style={{ color: "#ddb7ff", fontVariationSettings: "'FILL' 0" }} aria-hidden="true">
            format_quote
          </span>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            onClick={onFav}
            aria-label={isFav ? "Remove from favourites" : "Add to favourites"}
            aria-pressed={isFav}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-all"
            style={{
              background: isFav ? "rgba(251,191,36,0.15)" : "rgba(255,255,255,0.05)",
              border: `1px solid ${isFav ? "rgba(251,191,36,0.4)" : "rgba(255,255,255,0.08)"}`,
            }}
          >
            <span
              className="material-symbols-outlined text-[16px]"
              style={{ color: isFav ? "#fbbf24" : "#6b5b7a", fontVariationSettings: isFav ? "'FILL' 1" : "'FILL' 0" }}
              aria-hidden="true"
            >
              star
            </span>
          </button>
          <button
            onClick={() => onCopy(card.slogan)}
            aria-label={isCopiedMain ? "Copied!" : "Copy slogan"}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-all"
            style={{
              background: isCopiedMain ? "rgba(34,197,94,0.13)" : "rgba(255,255,255,0.05)",
              border: `1px solid ${isCopiedMain ? "rgba(34,197,94,0.3)" : "rgba(255,255,255,0.08)"}`,
            }}
          >
            <span
              className="material-symbols-outlined text-[14px]"
              style={{ color: isCopiedMain ? "#22c55e" : "#6b5b7a" }}
              aria-hidden="true"
            >
              {isCopiedMain ? "check" : "content_copy"}
            </span>
          </button>
        </div>
      </div>

      {/* Main slogan */}
      <p className="text-[18px] font-black leading-snug tracking-tight" style={{ color: "#f0e8ff" }}>
        {card.slogan}
      </p>

      {/* Explanation */}
      {card.explanation && (
        <p className="text-[13px] leading-relaxed" style={{ color: "#988d9f" }}>
          {card.explanation}
        </p>
      )}

      {/* Alternatives */}
      {card.alternatives.length > 0 && (
        <div className="flex flex-col gap-1.5 pt-1 border-t border-[rgba(255,255,255,0.05)]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.05em]" style={{ color: "#6b5b7a" }}>
            Alternatives
          </p>
          {card.alternatives.map((alt, i) => {
            const isCopiedAlt = copiedSlogan === alt;
            return (
              <button
                key={i}
                onClick={() => onCopy(alt)}
                aria-label={isCopiedAlt ? "Copied!" : `Copy alternative: ${alt}`}
                className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-left transition-all hover:opacity-90 w-full"
                style={{
                  background: isCopiedAlt ? "rgba(34,197,94,0.08)" : "rgba(221,183,255,0.05)",
                  border: `1px solid ${isCopiedAlt ? "rgba(34,197,94,0.25)" : "rgba(221,183,255,0.12)"}`,
                }}
              >
                <span className="text-[13px] font-medium" style={{ color: isCopiedAlt ? "#22c55e" : "#cfc2d6" }}>
                  {alt}
                </span>
                <span
                  className="material-symbols-outlined text-[12px] flex-shrink-0"
                  style={{ color: isCopiedAlt ? "#22c55e" : "#4d4354" }}
                  aria-hidden="true"
                >
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

export default function AiSloganGeneratorTool() {
  // Form state
  const [businessName, setBusinessName] = useState("");
  const [description,  setDescription]  = useState("");
  const [industry,     setIndustry]     = useState("Technology");
  const [keywords,     setKeywords]     = useState("");
  const [tone,         setTone]         = useState<SloganTone>("professional");
  const [length,       setLength]       = useState<SloganLength>("medium");

  // UI state
  const [cards,       setCards]       = useState<SloganCard[]>([]);
  const [favourites,  setFavourites]  = useState<Set<string>>(new Set());
  const [copiedSlogan,setCopiedSlogan]= useState<string | null>(null);
  const [isLoading,   setIsLoading]   = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [errorMsg,    setErrorMsg]    = useState<string | null>(null);
  const [nameError,   setNameError]   = useState(false);
  const [descError,   setDescError]   = useState(false);

  const abortRef  = useRef<AbortController | null>(null);
  const outputRef = useRef<HTMLDivElement>(null);
  const hasCards  = cards.length > 0;

  // ── Core generate ──────────────────────────────────────────────────────────

  const runGenerate = useCallback(async (fields: {
    businessName: string; description: string; industry: string;
    keywords: string; tone: SloganTone; length: SloganLength;
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
          task: "generateSlogans",
          payload: {
            businessName: fields.businessName,
            description:  fields.description,
            industry:     fields.industry,
            keywords:     fields.keywords.trim() || undefined,
            tone:         fields.tone,
            length:       fields.length,
            count:        6,
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
        const partial = parseSloganCards(accumulated);
        if (partial.length > 0) setCards(partial);
      }

      setCards(parseSloganCards(accumulated));
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
    let valid = true;
    if (!businessName.trim()) { setNameError(true); valid = false; }
    if (!description.trim())  { setDescError(true); valid = false; }
    if (!valid) return;
    setNameError(false); setDescError(false);
    await runGenerate({ businessName, description, industry, keywords, tone, length });
  }, [businessName, description, industry, keywords, tone, length, runGenerate]);

  const handleRegenerate = useCallback(async () => {
    if (businessName.trim() && description.trim())
      await runGenerate({ businessName, description, industry, keywords, tone, length });
  }, [businessName, description, industry, keywords, tone, length, runGenerate]);

  const handleFav = useCallback((slogan: string) => {
    setFavourites((prev) => {
      const next = new Set(prev);
      if (next.has(slogan)) next.delete(slogan); else next.add(slogan);
      return next;
    });
  }, []);

  const handleCopy = useCallback(async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedSlogan(text);
    setTimeout(() => setCopiedSlogan(null), 2000);
  }, []);

  const handleReset = useCallback(() => {
    abortRef.current?.abort();
    setBusinessName(""); setDescription(""); setIndustry("Technology");
    setKeywords(""); setTone("professional"); setLength("medium");
    setCards([]); setFavourites(new Set());
    setErrorMsg(null); setNameError(false); setDescError(false);
  }, []);

  const favList     = cards.filter((c) => favourites.has(c.slogan));
  const activeTone  = TONES.find((t) => t.id === tone)!;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="mb-12 flex flex-col gap-8">

      {/* Form */}
      <div className="glass-panel rounded-2xl p-6 flex flex-col gap-5">
        <p className="text-[15px] font-bold" style={{ color: "#e2e2e2" }}>Tell us about your brand</p>

        {/* Business name + description row */}
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <SectionLabel>Business Name *</SectionLabel>
            <input
              type="text"
              value={businessName}
              onChange={(e) => { setBusinessName(e.target.value); setNameError(false); }}
              placeholder="e.g. BrandFlow"
              aria-label="Business name"
              aria-invalid={nameError}
              className="w-full rounded-xl px-4 py-3 text-[14px] placeholder-[#4d4354] focus:outline-none transition-colors"
              style={{
                background: "rgba(0,0,0,0.25)",
                color: "#e2e2e2",
                border: `1px solid ${nameError ? "rgba(239,68,68,0.6)" : "rgba(255,255,255,0.09)"}`,
              }}
            />
            {nameError && <p role="alert" className="text-[11px] mt-1" style={{ color: "#ef4444" }}>Required</p>}
          </div>

          <div className="flex flex-col gap-4">
            <div>
              <SectionLabel>Industry</SectionLabel>
              <select
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                aria-label="Industry"
                className="w-full rounded-xl px-4 py-3 text-[14px] focus:outline-none transition-colors appearance-none cursor-pointer"
                style={{ background: "rgba(0,0,0,0.25)", color: "#e2e2e2", border: "1px solid rgba(255,255,255,0.09)" }}
              >
                {INDUSTRIES.map((ind) => (
                  <option key={ind} value={ind} style={{ background: "#1a1220" }}>{ind}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Description */}
        <div>
          <SectionLabel>Business Description *</SectionLabel>
          <div className="flex flex-col gap-1">
            <textarea
              value={description}
              onChange={(e) => { setDescription(e.target.value.slice(0, DESC_MAX)); setDescError(false); }}
              placeholder="e.g. A premium coffee subscription service that delivers single-origin beans directly from farmers to your door…"
              rows={3}
              aria-label="Business description"
              aria-invalid={descError}
              className="w-full rounded-xl px-4 py-3 text-[14px] placeholder-[#4d4354] focus:outline-none transition-colors resize-none leading-relaxed"
              style={{
                background: "rgba(0,0,0,0.25)",
                color: "#e2e2e2",
                border: `1px solid ${descError ? "rgba(239,68,68,0.6)" : "rgba(255,255,255,0.09)"}`,
              }}
            />
            <div className="flex justify-between">
              {descError
                ? <p role="alert" className="text-[11px]" style={{ color: "#ef4444" }}>Please describe your business.</p>
                : <span />}
              <p className="text-[11px]" style={{ color: description.length > DESC_MAX * 0.9 ? "#f59e0b" : "#4d4354" }}>
                {description.length}/{DESC_MAX}
              </p>
            </div>
          </div>
        </div>

        {/* Keywords */}
        <div>
          <SectionLabel>Keywords (optional)</SectionLabel>
          <div>
            <input
              type="text"
              value={keywords}
              onChange={(e) => setKeywords(e.target.value.slice(0, KEYWORDS_MAX))}
              placeholder="e.g. authentic, bold, community, craft…"
              aria-label="Keywords"
              className="w-full rounded-xl px-4 py-3 text-[14px] placeholder-[#4d4354] focus:outline-none transition-colors"
              style={{ background: "rgba(0,0,0,0.25)", color: "#e2e2e2", border: "1px solid rgba(255,255,255,0.09)" }}
            />
            <p className="text-[11px] mt-1 text-right" style={{ color: keywords.length > KEYWORDS_MAX * 0.9 ? "#f59e0b" : "#4d4354" }}>
              {keywords.length}/{KEYWORDS_MAX}
            </p>
          </div>
        </div>

        {/* Tone */}
        <div>
          <SectionLabel>Tone</SectionLabel>
          <div className="grid grid-cols-5 gap-2">
            {TONES.map((t) => {
              const isActive = tone === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTone(t.id)}
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
                    {t.icon}
                  </span>
                  <p className="text-[11px] font-semibold leading-tight">{t.label}</p>
                  <p className="text-[10px] leading-tight hidden sm:block" style={{ color: isActive ? "rgba(221,183,255,0.55)" : "#4d4354" }}>
                    {t.description}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Length */}
        <div>
          <SectionLabel>Slogan Length</SectionLabel>
          <div className="grid grid-cols-3 gap-2">
            {LENGTHS.map((l) => {
              const isActive = length === l.id;
              return (
                <button
                  key={l.id}
                  onClick={() => setLength(l.id)}
                  aria-pressed={isActive}
                  className="flex flex-col gap-0.5 px-4 py-3 rounded-xl text-left transition-all duration-150"
                  style={{
                    background: isActive ? "rgba(221,183,255,0.1)" : "rgba(255,255,255,0.04)",
                    border: `1px solid ${isActive ? "rgba(221,183,255,0.3)" : "rgba(255,255,255,0.06)"}`,
                    color: isActive ? "#ddb7ff" : "#988d9f",
                  }}
                >
                  <p className="text-[13px] font-semibold">{l.label}</p>
                  <p className="text-[11px]" style={{ color: isActive ? "rgba(221,183,255,0.6)" : "#4d4354" }}>
                    {l.example}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            onClick={handleGenerate}
            disabled={isLoading}
            aria-label="Generate slogans"
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
                Generating slogans…
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }} aria-hidden="true">
                  format_quote
                </span>
                Generate Slogans
              </span>
            )}
          </button>

          {hasCards && (
            <button
              onClick={handleRegenerate}
              disabled={isLoading}
              aria-label="Regenerate slogans"
              className="px-5 py-4 rounded-xl text-[14px] font-semibold transition-all disabled:opacity-40"
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
                format_quote
              </span>
            </div>
            <div>
              <p className="text-[16px] font-semibold mb-1" style={{ color: "#e2e2e2" }}>Your slogans will appear here</p>
              <p className="text-[13px] max-w-[280px] leading-relaxed" style={{ color: "#6b5b7a" }}>
                Fill in your brand details above and click <strong style={{ color: "#9b8da8" }}>Generate Slogans</strong>.
              </p>
            </div>
          </div>
        )}

        {/* Loading skeletons */}
        {isLoading && cards.length === 0 && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="glass-panel rounded-2xl p-5 flex flex-col gap-3">
                <div className="h-5 w-4/5 rounded animate-pulse" style={{ background: "rgba(255,255,255,0.08)", animationDelay: `${i * 80}ms` }} />
                <div className="h-3 w-full  rounded animate-pulse" style={{ background: "rgba(255,255,255,0.05)", animationDelay: `${i * 80 + 40}ms` }} />
                <div className="h-3 w-3/4  rounded animate-pulse" style={{ background: "rgba(255,255,255,0.04)", animationDelay: `${i * 80 + 80}ms` }} />
                <div className="flex flex-col gap-1.5 mt-1 pt-2 border-t border-[rgba(255,255,255,0.04)]">
                  {[0, 1].map((j) => (
                    <div key={j} className="h-8 rounded-lg animate-pulse" style={{ background: "rgba(221,183,255,0.04)", animationDelay: `${i * 80 + j * 40 + 120}ms` }} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Slogan cards grid */}
        {hasCards && (
          <>
            {/* Meta bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 px-1">
              <div className="flex items-center gap-3">
                <span className="text-[13px]" style={{ color: "#988d9f" }}>
                  {cards.length} slogans generated
                  {isStreaming && <span className="ml-2 text-[11px]" style={{ color: "#ddb7ff" }}>— streaming…</span>}
                </span>
                <span
                  className="flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full"
                  style={{ background: "rgba(221,183,255,0.1)", color: "#ddb7ff", border: "1px solid rgba(221,183,255,0.2)" }}
                >
                  <span className="material-symbols-outlined text-[12px]" style={{ fontVariationSettings: "'FILL' 1" }} aria-hidden="true">
                    {activeTone.icon}
                  </span>
                  {activeTone.label}
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
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4" aria-label="Generated slogans" aria-live="polite">
              {cards.map((card, i) => (
                <SloganCardItem
                  key={`${card.slogan}-${i}`}
                  card={card}
                  index={i}
                  isFav={favourites.has(card.slogan)}
                  onFav={() => handleFav(card.slogan)}
                  copiedSlogan={copiedSlogan}
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
                      key={c.slogan}
                      onClick={() => handleCopy(c.slogan)}
                      aria-label={`Copy: ${c.slogan}`}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-semibold transition-all hover:opacity-80"
                      style={{ background: "rgba(251,191,36,0.1)", color: "#fbbf24", border: "1px solid rgba(251,191,36,0.25)" }}
                    >
                      {c.slogan}
                      <span className="material-symbols-outlined text-[12px]" aria-hidden="true">
                        {copiedSlogan === c.slogan ? "check" : "content_copy"}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <p className="text-[12px] px-1" style={{ color: "#4d4354" }}>
              Slogans are AI-generated. We recommend a trademark search before commercial use.
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
