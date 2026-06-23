"use client";

import { useState, useRef, useCallback } from "react";
import type {
  ProductDescriptionTone,
  ProductDescriptionLength,
  ProductPlatform,
} from "@/types/ai";

// ── Constants ─────────────────────────────────────────────────────────────────

const FEATURES_MAX  = 500;
const AUDIENCE_MAX  = 150;

// ── Option definitions (outside component) ────────────────────────────────────

interface PlatformOption { id: ProductPlatform;           label: string; icon: string; description: string }
interface ToneOption     { id: ProductDescriptionTone;    label: string; icon: string }
interface LengthOption   { id: ProductDescriptionLength;  label: string; words: string }

const PLATFORMS: PlatformOption[] = [
  { id: "shopify",     label: "Shopify",     icon: "storefront",     description: "Brand & lifestyle"  },
  { id: "woocommerce", label: "WooCommerce", icon: "shopping_cart",  description: "SEO-first"          },
  { id: "amazon",      label: "Amazon",      icon: "local_shipping", description: "Keywords & bullets" },
  { id: "etsy",        label: "Etsy",        icon: "favorite",       description: "Handmade & story"   },
  { id: "ebay",        label: "eBay",        icon: "sell",           description: "Specs & value"      },
  { id: "general",     label: "General",     icon: "public",         description: "Any platform"       },
];

const TONES: ToneOption[] = [
  { id: "professional", label: "Professional", icon: "business_center" },
  { id: "luxury",       label: "Luxury",       icon: "diamond"         },
  { id: "friendly",     label: "Friendly",     icon: "handshake"       },
  { id: "sales",        label: "Sales",        icon: "trending_up"     },
];

const LENGTHS: LengthOption[] = [
  { id: "short",  label: "Short",  words: "60–100 words"  },
  { id: "medium", label: "Medium", words: "150–250 words" },
  { id: "long",   label: "Long",   words: "350–500 words" },
];

const PRODUCT_CATEGORIES = [
  "Electronics", "Fashion & Apparel", "Home & Garden", "Beauty & Personal Care",
  "Sports & Outdoors", "Toys & Games", "Books & Media", "Food & Grocery",
  "Health & Wellness", "Automotive", "Tools & Hardware", "Jewellery & Watches",
  "Baby & Kids", "Pet Supplies", "Art & Crafts", "Office Supplies", "Other",
];

// ── Parsed output type ────────────────────────────────────────────────────────

interface ProductOutput {
  title: string;
  description: string;
  bullets: string[];
  meta: string;
  keywords: string[];
}

// ── Parser (outside component) ────────────────────────────────────────────────

function parseProductOutput(raw: string): ProductOutput | null {
  const getLine = (key: string): string => {
    const match = raw.match(new RegExp(`^${key}:\\s*(.+)$`, "m"));
    return match ? match[1].trim() : "";
  };

  const title = getLine("TITLE");
  if (!title) return null;

  const descMatch = raw.match(/^DESCRIPTION:\s*([\s\S]*?)(?=^BULLETS:|^META:|^KEYWORDS:|$)/m);
  const description = descMatch ? descMatch[1].trim() : "";

  const bulletsMatch = raw.match(/^BULLETS:\s*([\s\S]*?)(?=^META:|^KEYWORDS:|$)/m);
  const bullets = bulletsMatch
    ? bulletsMatch[1].split("\n").map((l) => l.replace(/^-\s*/, "").trim()).filter(Boolean)
    : [];

  const meta = getLine("META");

  const kwLine = getLine("KEYWORDS");
  const keywords = kwLine ? kwLine.split(",").map((k) => k.trim()).filter(Boolean) : [];

  return { title, description, bullets, meta, keywords };
}

// ── Sub-components (outside component) ────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[12px] font-semibold uppercase tracking-[0.06em] mb-2" style={{ color: "#988d9f" }}>
      {children}
    </p>
  );
}

function CopyBtn({
  text, copiedKey, thisKey, onCopy, size = "sm",
}: {
  text: string; copiedKey: string | null; thisKey: string;
  onCopy: (text: string, key: string) => void; size?: "sm" | "xs";
}) {
  const isCopied = copiedKey === thisKey;
  return (
    <button
      onClick={() => onCopy(text, thisKey)}
      aria-label={isCopied ? "Copied!" : "Copy"}
      className={`flex items-center gap-1 rounded-lg font-semibold transition-all ${size === "sm" ? "px-3 py-1.5 text-[12px]" : "px-2 py-1 text-[11px]"}`}
      style={{
        background: isCopied ? "rgba(34,197,94,0.13)" : "rgba(255,255,255,0.06)",
        color:      isCopied ? "#22c55e"               : "#988d9f",
        border:     `1px solid ${isCopied ? "rgba(34,197,94,0.3)" : "rgba(255,255,255,0.08)"}`,
      }}
    >
      <span className="material-symbols-outlined" style={{ fontSize: size === "sm" ? "14px" : "12px" }} aria-hidden="true">
        {isCopied ? "check" : "content_copy"}
      </span>
      {isCopied ? "Copied!" : "Copy"}
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function AiProductDescriptionTool() {
  const [productName,      setProductName]      = useState("");
  const [category,         setCategory]         = useState("Electronics");
  const [features,         setFeatures]         = useState("");
  const [targetAudience,   setTargetAudience]   = useState("");
  const [platform,         setPlatform]         = useState<ProductPlatform>("shopify");
  const [tone,             setTone]             = useState<ProductDescriptionTone>("professional");
  const [length,           setLength]           = useState<ProductDescriptionLength>("medium");

  const [output,           setOutput]           = useState<ProductOutput | null>(null);
  const [rawOutput,        setRawOutput]        = useState("");
  const [isLoading,        setIsLoading]        = useState(false);
  const [isStreaming,      setIsStreaming]      = useState(false);
  const [errorMsg,         setErrorMsg]         = useState<string | null>(null);
  const [nameError,        setNameError]        = useState(false);
  const [featuresError,    setFeaturesError]    = useState(false);
  const [copiedKey,        setCopiedKey]        = useState<string | null>(null);

  const abortRef  = useRef<AbortController | null>(null);
  const outputRef = useRef<HTMLDivElement>(null);

  const runGenerate = useCallback(async (fields: {
    productName: string; category: string; features: string; targetAudience: string;
    platform: ProductPlatform; tone: ProductDescriptionTone; length: ProductDescriptionLength;
  }) => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setIsLoading(true); setIsStreaming(true);
    setErrorMsg(null); setOutput(null); setRawOutput("");

    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task: "generateProductDescription",
          payload: {
            productName:    fields.productName,
            category:       fields.category,
            features:       fields.features,
            targetAudience: fields.targetAudience.trim() || undefined,
            tone:           fields.tone,
            length:         fields.length,
            platform:       fields.platform,
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
        const partial = parseProductOutput(accumulated);
        if (partial) setOutput(partial);
      }

      const final = parseProductOutput(accumulated);
      if (final) setOutput(final);
      setTimeout(() => outputRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 150);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setIsLoading(false); setIsStreaming(false);
    }
  }, []);

  const handleGenerate = useCallback(async () => {
    let valid = true;
    if (!productName.trim()) { setNameError(true);     valid = false; }
    if (!features.trim())    { setFeaturesError(true); valid = false; }
    if (!valid) return;
    setNameError(false); setFeaturesError(false);
    await runGenerate({ productName, category, features, targetAudience, platform, tone, length });
  }, [productName, category, features, targetAudience, platform, tone, length, runGenerate]);

  const handleRegenerate = useCallback(async () => {
    if (productName.trim() && features.trim())
      await runGenerate({ productName, category, features, targetAudience, platform, tone, length });
  }, [productName, category, features, targetAudience, platform, tone, length, runGenerate]);

  const handleCopy = useCallback(async (text: string, key: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  }, []);

  const handleCopyAll = useCallback(async () => {
    if (!output) return;
    const full = [
      `TITLE\n${output.title}`,
      `\nDESCRIPTION\n${output.description}`,
      `\nKEY FEATURES\n${output.bullets.map((b) => `• ${b}`).join("\n")}`,
      `\nMETA DESCRIPTION\n${output.meta}`,
      `\nSEO KEYWORDS\n${output.keywords.join(", ")}`,
    ].join("\n");
    await handleCopy(full, "all");
  }, [output, handleCopy]);

  const handleReset = useCallback(() => {
    abortRef.current?.abort();
    setProductName(""); setCategory("Electronics"); setFeatures("");
    setTargetAudience(""); setPlatform("shopify"); setTone("professional"); setLength("medium");
    setOutput(null); setRawOutput(""); setErrorMsg(null);
    setNameError(false); setFeaturesError(false);
  }, []);

  const hasOutput      = Boolean(output);
  const activePlatform = PLATFORMS.find((p) => p.id === platform)!;
  const activeTone     = TONES.find((t) => t.id === tone)!;

  return (
    <div className="mb-12 flex flex-col gap-8">
      <div className="grid lg:grid-cols-2 gap-6 items-start">

        {/* LEFT — form */}
        <div className="glass-panel rounded-2xl p-6 flex flex-col gap-5">
          <p className="text-[15px] font-bold" style={{ color: "#e2e2e2" }}>Product details</p>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <SectionLabel>Product Name *</SectionLabel>
              <input
                type="text"
                value={productName}
                onChange={(e) => { setProductName(e.target.value); setNameError(false); }}
                placeholder="e.g. ProFlow Ergonomic Chair"
                aria-label="Product name"
                aria-invalid={nameError}
                className="w-full rounded-xl px-4 py-3 text-[14px] placeholder-[#4d4354] focus:outline-none transition-colors"
                style={{ background: "rgba(0,0,0,0.25)", color: "#e2e2e2", border: `1px solid ${nameError ? "rgba(239,68,68,0.6)" : "rgba(255,255,255,0.09)"}` }}
              />
              {nameError && <p role="alert" className="text-[11px] mt-1" style={{ color: "#ef4444" }}>Required</p>}
            </div>

            <div>
              <SectionLabel>Category</SectionLabel>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                aria-label="Product category"
                className="w-full rounded-xl px-4 py-3 text-[14px] focus:outline-none transition-colors appearance-none cursor-pointer"
                style={{ background: "rgba(0,0,0,0.25)", color: "#e2e2e2", border: "1px solid rgba(255,255,255,0.09)" }}
              >
                {PRODUCT_CATEGORIES.map((c) => (
                  <option key={c} value={c} style={{ background: "#1a1220" }}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <SectionLabel>Key Features & Details *</SectionLabel>
            <div className="flex flex-col gap-1">
              <textarea
                value={features}
                onChange={(e) => { setFeatures(e.target.value.slice(0, FEATURES_MAX)); setFeaturesError(false); }}
                placeholder="e.g. Lumbar support, adjustable armrests, breathable mesh, 5-year warranty, available in black and grey…"
                rows={5}
                aria-label="Key features"
                aria-invalid={featuresError}
                className="w-full rounded-xl px-4 py-3 text-[14px] placeholder-[#4d4354] focus:outline-none transition-colors resize-none leading-relaxed"
                style={{ background: "rgba(0,0,0,0.25)", color: "#e2e2e2", border: `1px solid ${featuresError ? "rgba(239,68,68,0.6)" : "rgba(255,255,255,0.09)"}` }}
              />
              <div className="flex justify-between items-center">
                {featuresError
                  ? <p role="alert" className="text-[11px]" style={{ color: "#ef4444" }}>Please describe your product features.</p>
                  : <span />}
                <p className="text-[11px]" style={{ color: features.length > FEATURES_MAX * 0.9 ? "#f59e0b" : "#4d4354" }}>
                  {features.length}/{FEATURES_MAX}
                </p>
              </div>
            </div>
          </div>

          <div>
            <SectionLabel>Target Audience (optional)</SectionLabel>
            <input
              type="text"
              value={targetAudience}
              onChange={(e) => setTargetAudience(e.target.value.slice(0, AUDIENCE_MAX))}
              placeholder="e.g. Remote workers, home office professionals, ages 25–45…"
              aria-label="Target audience"
              className="w-full rounded-xl px-4 py-3 text-[14px] placeholder-[#4d4354] focus:outline-none transition-colors"
              style={{ background: "rgba(0,0,0,0.25)", color: "#e2e2e2", border: "1px solid rgba(255,255,255,0.09)" }}
            />
          </div>

          {/* Platform */}
          <div>
            <SectionLabel>Platform</SectionLabel>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
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
                    <span className="material-symbols-outlined text-[20px]" style={{ color: isActive ? "#ddb7ff" : "#6b5b7a", fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0" }} aria-hidden="true">{p.icon}</span>
                    <p className="text-[11px] font-semibold leading-tight">{p.label}</p>
                    <p className="text-[10px] leading-tight hidden sm:block" style={{ color: isActive ? "rgba(221,183,255,0.55)" : "#4d4354" }}>{p.description}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tone + Length */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <SectionLabel>Tone</SectionLabel>
              <div className="grid grid-cols-2 gap-2">
                {TONES.map((t) => {
                  const isActive = tone === t.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => setTone(t.id)}
                      aria-pressed={isActive}
                      className="flex flex-col items-center gap-1 py-2.5 px-2 rounded-xl text-center transition-all duration-150"
                      style={{
                        background: isActive ? "rgba(221,183,255,0.12)" : "rgba(255,255,255,0.04)",
                        border: `1px solid ${isActive ? "rgba(221,183,255,0.35)" : "rgba(255,255,255,0.07)"}`,
                        color: isActive ? "#ddb7ff" : "#988d9f",
                      }}
                    >
                      <span className="material-symbols-outlined text-[18px]" style={{ color: isActive ? "#ddb7ff" : "#6b5b7a", fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0" }} aria-hidden="true">{t.icon}</span>
                      <p className="text-[11px] font-semibold leading-tight">{t.label}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <SectionLabel>Description Length</SectionLabel>
              <div className="flex flex-col gap-2">
                {LENGTHS.map((l) => {
                  const isActive = length === l.id;
                  return (
                    <button
                      key={l.id}
                      onClick={() => setLength(l.id)}
                      aria-pressed={isActive}
                      className="flex items-center justify-between px-3 py-2.5 rounded-xl transition-all duration-150"
                      style={{
                        background: isActive ? "rgba(221,183,255,0.1)" : "rgba(255,255,255,0.04)",
                        border: `1px solid ${isActive ? "rgba(221,183,255,0.3)" : "rgba(255,255,255,0.06)"}`,
                        color: isActive ? "#ddb7ff" : "#988d9f",
                      }}
                    >
                      <p className="text-[12px] font-semibold">{l.label}</p>
                      <p className="text-[11px]" style={{ color: isActive ? "rgba(221,183,255,0.6)" : "#4d4354" }}>{l.words}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <button
            onClick={handleGenerate}
            disabled={isLoading}
            aria-label="Generate product description"
            className="w-full py-4 rounded-xl text-[15px] font-bold tracking-[0.02em] transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed"
            style={{
              background: isLoading ? "rgba(221,183,255,0.12)" : "linear-gradient(135deg,#ddb7ff 0%,#4cd7f6 100%)",
              color: isLoading ? "#ddb7ff" : "#131313",
              boxShadow: isLoading ? "none" : "0 0 24px rgba(221,183,255,0.2)",
            }}
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-3">
                <span className="inline-block w-4 h-4 border-2 border-[#ddb7ff] border-t-transparent rounded-full animate-spin" />
                Writing description…
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }} aria-hidden="true">inventory_2</span>
                Generate Description
              </span>
            )}
          </button>

          <button
            onClick={handleReset}
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-[13px] font-semibold transition-all"
            style={{ background: "rgba(255,255,255,0.04)", color: "#6b5b7a", border: "1px solid rgba(255,255,255,0.07)" }}
            aria-label="Reset form"
          >
            <span className="material-symbols-outlined text-[14px]" aria-hidden="true">restart_alt</span>
            Reset
          </button>
        </div>

        {/* RIGHT — output */}
        <div ref={outputRef} className="flex flex-col gap-4">

          {!hasOutput && !isLoading && !errorMsg && (
            <div className="glass-panel rounded-2xl p-12 flex flex-col items-center justify-center text-center gap-4" style={{ minHeight: "480px" }} aria-live="polite">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: "rgba(221,183,255,0.08)" }}>
                <span className="material-symbols-outlined text-[32px]" style={{ color: "#ddb7ff", fontVariationSettings: "'FILL' 0" }} aria-hidden="true">inventory_2</span>
              </div>
              <div>
                <p className="text-[16px] font-semibold mb-1" style={{ color: "#e2e2e2" }}>Your product description will appear here</p>
                <p className="text-[13px] max-w-[280px] leading-relaxed" style={{ color: "#6b5b7a" }}>
                  Fill in your product details and click <strong style={{ color: "#9b8da8" }}>Generate Description</strong>.
                </p>
              </div>
            </div>
          )}

          {isLoading && !hasOutput && (
            <div className="glass-panel rounded-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-[rgba(255,255,255,0.06)]" style={{ background: "rgba(0,0,0,0.2)" }}>
                <div className="h-4 w-48 rounded animate-pulse" style={{ background: "rgba(255,255,255,0.07)" }} />
              </div>
              <div className="px-6 py-5 flex flex-col gap-4">
                <div className="h-5 w-4/5 rounded animate-pulse" style={{ background: "rgba(255,255,255,0.09)" }} />
                {[92, 88, 96, 72, 85].map((w, i) => (
                  <div key={i} className="h-3 rounded animate-pulse" style={{ width: `${w}%`, background: "rgba(255,255,255,0.06)", animationDelay: `${i * 55}ms` }} />
                ))}
                <div className="flex flex-col gap-2 mt-2">
                  {[0,1,2,3,4].map((i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <div className="w-2 h-2 rounded-full flex-shrink-0 animate-pulse" style={{ background: "rgba(221,183,255,0.3)" }} />
                      <div className="h-3 rounded animate-pulse" style={{ width: `${[80,70,88,65,75][i]}%`, background: "rgba(255,255,255,0.05)", animationDelay: `${i * 60}ms` }} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {hasOutput && output && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 px-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "rgba(221,183,255,0.1)", color: "#ddb7ff", border: "1px solid rgba(221,183,255,0.2)" }}>
                    <span className="material-symbols-outlined text-[12px]" style={{ fontVariationSettings: "'FILL' 1" }} aria-hidden="true">{activePlatform.icon}</span>
                    {activePlatform.label}
                  </span>
                  <span className="flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "rgba(76,215,246,0.08)", color: "#4cd7f6", border: "1px solid rgba(76,215,246,0.2)" }}>
                    <span className="material-symbols-outlined text-[12px]" style={{ fontVariationSettings: "'FILL' 1" }} aria-hidden="true">{activeTone.icon}</span>
                    {activeTone.label}
                  </span>
                  {isStreaming && <span className="text-[11px]" style={{ color: "#ddb7ff" }}>streaming…</span>}
                </div>
                <div className="flex gap-2">
                  <CopyBtn text={rawOutput} copiedKey={copiedKey} thisKey="all" onCopy={handleCopyAll} />
                  <button onClick={handleRegenerate} disabled={isLoading} aria-label="Regenerate" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all disabled:opacity-40" style={{ background: "rgba(255,255,255,0.06)", color: "#988d9f", border: "1px solid rgba(255,255,255,0.08)" }}>
                    <span className="material-symbols-outlined text-[14px]" aria-hidden="true">refresh</span>
                    Regenerate
                  </button>
                </div>
              </div>

              {output.title && (
                <div className="glass-panel rounded-2xl overflow-hidden">
                  <div className="px-5 py-3 flex items-center justify-between border-b border-[rgba(255,255,255,0.06)]" style={{ background: "rgba(0,0,0,0.2)" }}>
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[15px]" style={{ color: "#ddb7ff" }} aria-hidden="true">title</span>
                      <p className="text-[13px] font-semibold" style={{ color: "#e2e2e2" }}>Product Title</p>
                      <span className="text-[11px]" style={{ color: "#4d4354" }}>{output.title.length} chars</span>
                    </div>
                    <CopyBtn text={output.title} copiedKey={copiedKey} thisKey="title" onCopy={handleCopy} size="xs" />
                  </div>
                  <div className="px-5 py-4">
                    <p className="text-[15px] font-bold" style={{ color: "#f0e8ff" }}>{output.title}</p>
                  </div>
                </div>
              )}

              {output.description && (
                <div className="glass-panel rounded-2xl overflow-hidden">
                  <div className="px-5 py-3 flex items-center justify-between border-b border-[rgba(255,255,255,0.06)]" style={{ background: "rgba(0,0,0,0.2)" }}>
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[15px]" style={{ color: "#ddb7ff" }} aria-hidden="true">article</span>
                      <p className="text-[13px] font-semibold" style={{ color: "#e2e2e2" }}>Product Description</p>
                      <span className="text-[11px]" style={{ color: "#4d4354" }}>{output.description.trim().split(/\s+/).length} words</span>
                    </div>
                    <CopyBtn text={output.description} copiedKey={copiedKey} thisKey="desc" onCopy={handleCopy} size="xs" />
                  </div>
                  <div className="px-5 py-4">
                    <p className="text-[14px] leading-[1.8] whitespace-pre-wrap" style={{ color: "#cfc2d6" }}>
                      {output.description}
                      {isStreaming && !output.bullets.length && (
                        <span className="inline-block w-0.5 h-4 ml-0.5 align-middle animate-pulse" style={{ background: "#ddb7ff" }} aria-hidden="true" />
                      )}
                    </p>
                  </div>
                </div>
              )}

              {output.bullets.length > 0 && (
                <div className="glass-panel rounded-2xl overflow-hidden">
                  <div className="px-5 py-3 flex items-center justify-between border-b border-[rgba(255,255,255,0.06)]" style={{ background: "rgba(0,0,0,0.2)" }}>
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[15px]" style={{ color: "#ddb7ff" }} aria-hidden="true">checklist</span>
                      <p className="text-[13px] font-semibold" style={{ color: "#e2e2e2" }}>Key Features</p>
                    </div>
                    <CopyBtn text={output.bullets.map((b) => `• ${b}`).join("\n")} copiedKey={copiedKey} thisKey="bullets" onCopy={handleCopy} size="xs" />
                  </div>
                  <div className="px-5 py-4 flex flex-col gap-2">
                    {output.bullets.map((bullet, i) => (
                      <div key={i} className="flex items-start gap-2.5">
                        <span className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center mt-0.5" style={{ background: "rgba(221,183,255,0.12)" }} aria-hidden="true">
                          <span className="material-symbols-outlined text-[11px]" style={{ color: "#ddb7ff", fontVariationSettings: "'FILL' 1" }}>check</span>
                        </span>
                        <p className="text-[14px] leading-relaxed" style={{ color: "#cfc2d6" }}>{bullet}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {output.meta && (
                <div className="glass-panel rounded-2xl overflow-hidden">
                  <div className="px-5 py-3 flex items-center justify-between border-b border-[rgba(255,255,255,0.06)]" style={{ background: "rgba(0,0,0,0.2)" }}>
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[15px]" style={{ color: "#4cd7f6" }} aria-hidden="true">travel_explore</span>
                      <p className="text-[13px] font-semibold" style={{ color: "#e2e2e2" }}>Meta Description</p>
                      <span className="text-[11px]" style={{ color: output.meta.length > 160 ? "#ef4444" : output.meta.length > 140 ? "#22c55e" : "#4d4354" }}>
                        {output.meta.length}/160 chars
                      </span>
                    </div>
                    <CopyBtn text={output.meta} copiedKey={copiedKey} thisKey="meta" onCopy={handleCopy} size="xs" />
                  </div>
                  <div className="px-5 py-4">
                    <p className="text-[13px] leading-relaxed" style={{ color: "#a899b5" }}>{output.meta}</p>
                  </div>
                </div>
              )}

              {output.keywords.length > 0 && (
                <div className="glass-panel rounded-2xl overflow-hidden">
                  <div className="px-5 py-3 flex items-center justify-between border-b border-[rgba(255,255,255,0.06)]" style={{ background: "rgba(0,0,0,0.2)" }}>
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[15px]" style={{ color: "#4cd7f6" }} aria-hidden="true">tag</span>
                      <p className="text-[13px] font-semibold" style={{ color: "#e2e2e2" }}>SEO Keywords</p>
                      <span className="text-[11px]" style={{ color: "#4d4354" }}>{output.keywords.length} keywords</span>
                    </div>
                    <CopyBtn text={output.keywords.join(", ")} copiedKey={copiedKey} thisKey="keywords" onCopy={handleCopy} size="xs" />
                  </div>
                  <div className="px-5 py-4 flex flex-wrap gap-2">
                    {output.keywords.map((kw, i) => (
                      <button
                        key={i}
                        onClick={() => handleCopy(kw, `kw-${i}`)}
                        aria-label={`Copy keyword: ${kw}`}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[12px] font-medium transition-all"
                        style={{
                          background: copiedKey === `kw-${i}` ? "rgba(34,197,94,0.1)" : "rgba(76,215,246,0.06)",
                          color:      copiedKey === `kw-${i}` ? "#22c55e"              : "#4cd7f6",
                          border:     `1px solid ${copiedKey === `kw-${i}` ? "rgba(34,197,94,0.25)" : "rgba(76,215,246,0.2)"}`,
                        }}
                      >
                        <span className="material-symbols-outlined text-[11px]" aria-hidden="true">{copiedKey === `kw-${i}` ? "check" : "tag"}</span>
                        {kw}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <p className="text-[12px] px-1" style={{ color: "#4d4354" }}>
                AI-generated copy. Review before publishing and verify SEO performance in your analytics.
              </p>
            </>
          )}

          {errorMsg && !isLoading && (
            <div className="glass-panel rounded-2xl p-6 flex flex-col gap-3" role="alert" style={{ border: "1px solid rgba(239,68,68,0.3)" }}>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]" style={{ color: "#ef4444" }} aria-hidden="true">error</span>
                <p className="text-[14px] font-semibold" style={{ color: "#ef4444" }}>Generation failed</p>
              </div>
              <p className="text-[13px]" style={{ color: "#9b8da8" }}>{errorMsg}</p>
              <button onClick={handleRegenerate} className="self-start flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-semibold transition-all" style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)" }}>
                <span className="material-symbols-outlined text-[14px]">refresh</span>
                Try again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
