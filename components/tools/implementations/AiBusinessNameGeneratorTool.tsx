"use client";

import { useState, useRef, useCallback } from "react";
import type { BusinessNameStyle, BusinessNameLength } from "@/types/ai";

// ── Constants ─────────────────────────────────────────────────────────────────

const DESC_MAX = 400;
const KEYWORDS_MAX = 150;

const INDUSTRIES = [
  "Technology", "E-commerce", "Health & Wellness", "Finance & Fintech",
  "Food & Beverage", "Fashion & Apparel", "Real Estate", "Education",
  "Marketing & Media", "Travel & Hospitality", "Legal & Consulting",
  "Beauty & Cosmetics", "Sports & Fitness", "Entertainment", "Other",
];

// ── Option definitions (outside component) ────────────────────────────────────

interface StyleOption { id: BusinessNameStyle; label: string; icon: string; description: string }
interface LengthOption { id: BusinessNameLength; label: string; example: string }

const STYLES: StyleOption[] = [
  { id: "modern",       label: "Modern",       icon: "electric_bolt",   description: "Fresh & tech-inspired" },
  { id: "professional", label: "Professional", icon: "business_center", description: "Trustworthy & credible" },
  { id: "luxury",       label: "Luxury",       icon: "diamond",         description: "Premium & exclusive" },
  { id: "creative",     label: "Creative",     icon: "palette",         description: "Playful & original" },
  { id: "minimal",      label: "Minimal",      icon: "remove",          description: "Clean & simple" },
];

const LENGTHS: LengthOption[] = [
  { id: "short",  label: "Short",  example: "e.g. Uber, Zip, Arc" },
  { id: "medium", label: "Medium", example: "e.g. Notion, Stripe" },
  { id: "long",   label: "Long",   example: "e.g. HubSpot, Mailchimp" },
];

// ── Parsed name card type ─────────────────────────────────────────────────────

interface NameCard {
  name: string;
  explanation: string;
  tagline: string;
  style: string;
}

// ── Parser (outside component) ────────────────────────────────────────────────

function parseNameCards(raw: string): NameCard[] {
  const blocks = raw.split(/---+/).map((b) => b.trim()).filter(Boolean);
  const cards: NameCard[] = [];
  for (const block of blocks) {
    const get = (key: string) => {
      const match = block.match(new RegExp(`^${key}:\\s*(.+)$`, "m"));
      return match ? match[1].trim() : "";
    };
    const name = get("NAME");
    if (!name) continue;
    cards.push({
      name,
      explanation: get("EXPLANATION"),
      tagline:     get("TAGLINE"),
      style:       get("STYLE"),
    });
  }
  return cards;
}

function slugifyName(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

// ── Sub-components (defined outside to prevent remounting) ────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[12px] font-semibold uppercase tracking-[0.06em] mb-2" style={{ color: "#988d9f" }}>
      {children}
    </p>
  );
}

function DomainBadge({ tld, name }: { tld: string; name: string }) {
  const slug = slugifyName(name);
  const domain = `${slug}${tld}`;
  const searchUrl = `https://www.namecheap.com/domains/registration/results/?domain=${domain}`;
  return (
    <a
      href={searchUrl}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Check ${domain} availability`}
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-mono font-semibold transition-all hover:opacity-80"
      style={{ background: "rgba(76,215,246,0.08)", color: "#4cd7f6", border: "1px solid rgba(76,215,246,0.2)" }}
    >
      <span className="material-symbols-outlined text-[10px]" aria-hidden="true">language</span>
      {domain}
    </a>
  );
}

interface NameCardProps {
  card: NameCard;
  isFav: boolean;
  onFav: () => void;
  onCopy: () => void;
  copied: boolean;
  index: number;
}

function NameCardItem({ card, isFav, onFav, onCopy, copied, index }: NameCardProps) {
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
          <h3 className="text-[20px] font-black tracking-tight truncate" style={{ color: "#f0e8ff" }}>
            {card.name}
          </h3>
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
            onClick={onCopy}
            aria-label={copied ? "Copied!" : "Copy name"}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-all"
            style={{
              background: copied ? "rgba(34,197,94,0.13)" : "rgba(255,255,255,0.05)",
              border: `1px solid ${copied ? "rgba(34,197,94,0.3)" : "rgba(255,255,255,0.08)"}`,
            }}
          >
            <span
              className="material-symbols-outlined text-[14px]"
              style={{ color: copied ? "#22c55e" : "#6b5b7a" }}
              aria-hidden="true"
            >
              {copied ? "check" : "content_copy"}
            </span>
          </button>
        </div>
      </div>

      {/* Tagline */}
      {card.tagline && (
        <p className="text-[13px] italic leading-snug" style={{ color: "#a899b5" }}>
          &ldquo;{card.tagline}&rdquo;
        </p>
      )}

      {/* Explanation */}
      {card.explanation && (
        <p className="text-[13px] leading-relaxed" style={{ color: "#988d9f" }}>
          {card.explanation}
        </p>
      )}

      {/* Domain hints */}
      <div className="flex flex-wrap gap-1.5 pt-1">
        {[".com", ".net", ".ai"].map((tld) => (
          <DomainBadge key={tld} tld={tld} name={card.name} />
        ))}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function AiBusinessNameGeneratorTool() {
  // Form state
  const [description, setDescription] = useState("");
  const [industry,    setIndustry]    = useState("Technology");
  const [keywords,    setKeywords]    = useState("");
  const [style,       setStyle]       = useState<BusinessNameStyle>("modern");
  const [length,      setLength]      = useState<BusinessNameLength>("medium");

  // UI state
  const [rawOutput,  setRawOutput]  = useState("");
  const [cards,      setCards]      = useState<NameCard[]>([]);
  const [favourites, setFavourites] = useState<Set<string>>(new Set());
  const [copiedName, setCopiedName] = useState<string | null>(null);
  const [isLoading,  setIsLoading]  = useState(false);
  const [isStreaming,setIsStreaming] = useState(false);
  const [errorMsg,   setErrorMsg]   = useState<string | null>(null);
  const [descError,  setDescError]  = useState(false);

  const abortRef  = useRef<AbortController | null>(null);
  const outputRef = useRef<HTMLDivElement>(null);

  // ── Core generate call ─────────────────────────────────────────────────────

  const runGenerate = useCallback(async (fields: {
    description: string; industry: string; keywords: string;
    style: BusinessNameStyle; length: BusinessNameLength;
  }) => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setIsLoading(true);
    setIsStreaming(true);
    setErrorMsg(null);
    setRawOutput("");
    setCards([]);

    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task: "generateBusinessNames",
          payload: {
            description: fields.description,
            industry:    fields.industry,
            keywords:    fields.keywords.trim() || undefined,
            style:       fields.style,
            length:      fields.length,
            count:       6,
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
        setRawOutput(accumulated);
        // Parse incrementally so cards appear as they stream in
        const partial = parseNameCards(accumulated);
        if (partial.length > 0) setCards(partial);
      }

      // Final parse on complete output
      setCards(parseNameCards(accumulated));
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
    if (!description.trim()) { setDescError(true); return; }
    setDescError(false);
    await runGenerate({ description, industry, keywords, style, length });
  }, [description, industry, keywords, style, length, runGenerate]);

  const handleRegenerate = useCallback(async () => {
    if (description.trim()) await runGenerate({ description, industry, keywords, style, length });
  }, [description, industry, keywords, style, length, runGenerate]);

  const handleFav = useCallback((name: string) => {
    setFavourites((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  }, []);

  const handleCopyName = useCallback(async (name: string) => {
    await navigator.clipboard.writeText(name);
    setCopiedName(name);
    setTimeout(() => setCopiedName(null), 2000);
  }, []);

  const handleReset = useCallback(() => {
    abortRef.current?.abort();
    setDescription(""); setIndustry("Technology"); setKeywords("");
    setStyle("modern"); setLength("medium");
    setRawOutput(""); setCards([]); setFavourites(new Set());
    setErrorMsg(null); setDescError(false);
  }, []);

  const hasCards   = cards.length > 0;
  const favList    = cards.filter((c) => favourites.has(c.name));
  const activeStyle = STYLES.find((s) => s.id === style)!;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="mb-12 flex flex-col gap-8">

      {/* Form */}
      <div className="glass-panel rounded-2xl p-6 flex flex-col gap-5">
        <p className="text-[15px] font-bold" style={{ color: "#e2e2e2" }}>Tell us about your business</p>

        {/* Description + Industry row */}
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <SectionLabel>Business Description *</SectionLabel>
            <div className="flex flex-col gap-1">
              <textarea
                value={description}
                onChange={(e) => { setDescription(e.target.value.slice(0, DESC_MAX)); setDescError(false); }}
                placeholder="e.g. An AI-powered platform that helps small businesses automate their customer support…"
                rows={4}
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

          <div className="flex flex-col gap-4">
            {/* Industry */}
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
                  <option key={ind} value={ind} style={{ background: "#1a1220" }}>
                    {ind}
                  </option>
                ))}
              </select>
            </div>

            {/* Keywords */}
            <div>
              <SectionLabel>Keywords (optional)</SectionLabel>
              <div>
                <input
                  type="text"
                  value={keywords}
                  onChange={(e) => setKeywords(e.target.value.slice(0, KEYWORDS_MAX))}
                  placeholder="e.g. flow, smart, spark, connect…"
                  aria-label="Keywords"
                  className="w-full rounded-xl px-4 py-3 text-[14px] placeholder-[#4d4354] focus:outline-none transition-colors"
                  style={{ background: "rgba(0,0,0,0.25)", color: "#e2e2e2", border: "1px solid rgba(255,255,255,0.09)" }}
                />
                <p className="text-[11px] mt-1 text-right" style={{ color: keywords.length > KEYWORDS_MAX * 0.9 ? "#f59e0b" : "#4d4354" }}>
                  {keywords.length}/{KEYWORDS_MAX}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Brand Style */}
        <div>
          <SectionLabel>Brand Style</SectionLabel>
          <div className="grid grid-cols-5 gap-2">
            {STYLES.map((s) => {
              const isActive = style === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => setStyle(s.id)}
                  aria-pressed={isActive}
                  className="flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl text-center transition-all duration-150"
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

        {/* Name Length */}
        <div>
          <SectionLabel>Name Length</SectionLabel>
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
            aria-label="Generate business names"
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
                Generating names…
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }} aria-hidden="true">
                  storefront
                </span>
                Generate Names
              </span>
            )}
          </button>

          {hasCards && (
            <button
              onClick={handleRegenerate}
              disabled={isLoading}
              aria-label="Regenerate names"
              className="px-5 py-4 rounded-xl text-[14px] font-semibold transition-all disabled:opacity-40"
              style={{ background: "rgba(255,255,255,0.05)", color: "#988d9f", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">refresh</span>
            </button>
          )}

          <button
            onClick={handleReset}
            aria-label="Reset form"
            className="px-5 py-4 rounded-xl text-[14px] font-semibold transition-all"
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
                storefront
              </span>
            </div>
            <div>
              <p className="text-[16px] font-semibold mb-1" style={{ color: "#e2e2e2" }}>Your business names will appear here</p>
              <p className="text-[13px] max-w-[280px] leading-relaxed" style={{ color: "#6b5b7a" }}>
                Fill in your business details above and click <strong style={{ color: "#9b8da8" }}>Generate Names</strong>.
              </p>
            </div>
          </div>
        )}

        {/* Loading skeletons (while waiting for first card) */}
        {isLoading && cards.length === 0 && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="glass-panel rounded-2xl p-5 flex flex-col gap-3">
                <div className="h-6 w-3/5 rounded animate-pulse" style={{ background: "rgba(255,255,255,0.08)", animationDelay: `${i * 80}ms` }} />
                <div className="h-3 w-4/5 rounded animate-pulse" style={{ background: "rgba(255,255,255,0.05)", animationDelay: `${i * 80 + 40}ms` }} />
                <div className="h-3 w-full rounded animate-pulse" style={{ background: "rgba(255,255,255,0.04)", animationDelay: `${i * 80 + 80}ms` }} />
                <div className="flex gap-1.5 mt-1">
                  {[".com", ".net", ".ai"].map((t) => (
                    <div key={t} className="h-5 w-16 rounded animate-pulse" style={{ background: "rgba(76,215,246,0.05)" }} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Name cards grid */}
        {hasCards && (
          <>
            {/* Meta bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 px-1">
              <div className="flex items-center gap-3">
                <span className="text-[13px]" style={{ color: "#988d9f" }}>
                  {cards.length} names generated
                  {isStreaming && (
                    <span className="ml-2 text-[11px]" style={{ color: "#ddb7ff" }}>— streaming…</span>
                  )}
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

            {/* Cards grid */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4" aria-label="Generated business names" aria-live="polite">
              {cards.map((card, i) => (
                <NameCardItem
                  key={`${card.name}-${i}`}
                  card={card}
                  index={i}
                  isFav={favourites.has(card.name)}
                  onFav={() => handleFav(card.name)}
                  onCopy={() => handleCopyName(card.name)}
                  copied={copiedName === card.name}
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
                    <span
                      key={c.name}
                      className="px-3 py-1.5 rounded-lg text-[13px] font-semibold"
                      style={{ background: "rgba(251,191,36,0.1)", color: "#fbbf24", border: "1px solid rgba(251,191,36,0.25)" }}
                    >
                      {c.name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Footer note */}
            <p className="text-[12px] px-1" style={{ color: "#4d4354" }}>
              Domain availability links open Namecheap search. Always verify trademark availability before registering.
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
