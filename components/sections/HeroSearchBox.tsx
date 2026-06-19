"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { tools, categories } from "@/lib/tools";
import { useFavorites } from "@/lib/favorites";

const searchTags = [
  "AI Chat",
  "Remove Background",
  "PDF to Word",
  "QR Generator",
  "Resume Builder",
  "Password Generator",
];

interface SearchResult {
  slug: string;
  name: string;
  shortDescription: string;
  icon: string;
  iconColor: string;
  categorySlug: string;
  categoryName: string;
  href: string;
  matchedOn: string;
}

function highlight(text: string, query: string): React.ReactNode {
  if (!query) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark
        style={{ background: "rgba(221,183,255,0.3)", color: "#ddb7ff", borderRadius: "2px" }}
      >
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  );
}

function searchTools(raw: string): SearchResult[] {
  const q = raw.trim().toLowerCase();
  if (!q) return [];

  const categoryMap = Object.fromEntries(categories.map((c) => [c.slug, c.name]));

  const results: SearchResult[] = [];
  for (const tool of tools) {
    const catName = categoryMap[tool.categorySlug] ?? tool.categorySlug;

    const nameMatch = tool.name.toLowerCase().includes(q);
    const shortMatch = tool.shortDescription.toLowerCase().includes(q);
    const descMatch = tool.description.toLowerCase().includes(q);
    const kwMatch = tool.keywords.some((k) => k.toLowerCase().includes(q));
    const catMatch = catName.toLowerCase().includes(q);

    if (nameMatch || shortMatch || descMatch || kwMatch || catMatch) {
      const matchedOn = nameMatch
        ? "name"
        : kwMatch
        ? "keyword"
        : shortMatch
        ? "shortDescription"
        : catMatch
        ? "category"
        : "description";

      results.push({
        slug: tool.slug,
        name: tool.name,
        shortDescription: tool.shortDescription,
        icon: tool.icon,
        iconColor: tool.iconColor,
        categorySlug: tool.categorySlug,
        categoryName: catName,
        href: `/${tool.categorySlug}/${tool.slug}`,
        matchedOn,
      });
    }
  }

  const rank: Record<string, number> = { name: 0, keyword: 1, shortDescription: 2, category: 3, description: 4 };
  results.sort((a, b) => rank[a.matchedOn] - rank[b.matchedOn]);

  return results.slice(0, 8);
}

export default function HeroSearchBox() {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 150);
    return () => clearTimeout(timer);
  }, [query]);

  const results = useMemo(() => searchTools(debouncedQuery), [debouncedQuery]);
  const { isFavorite } = useFavorites();

  useEffect(() => {
    setOpen(debouncedQuery.trim().length > 0);
    setActiveIndex(-1);
  }, [debouncedQuery]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const navigate = useCallback(
    (href: string) => {
      setOpen(false);
      setQuery("");
      router.push(href);
    },
    [router]
  );

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIndex >= 0 && results[activeIndex]) {
        navigate(results[activeIndex].href);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
      setActiveIndex(-1);
      inputRef.current?.blur();
    }
  }

  useEffect(() => {
    if (activeIndex < 0 || !listRef.current) return;
    const item = listRef.current.children[activeIndex] as HTMLElement | null;
    item?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  return (
    <>
      {/* Search Bar */}
      <div className="w-full max-w-3xl relative mb-8" ref={containerRef}>
        <div
          className="glass-panel search-focus rounded-2xl flex items-center px-6 py-4 transition-all duration-300 w-full relative z-10"
          style={{ background: "rgba(19,19,19,0.8)" }}
        >
          <span
            className="material-symbols-outlined text-[#988d9f] mr-4 text-[28px]"
            aria-hidden="true"
          >
            search
          </span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            onFocus={() => { if (debouncedQuery.trim()) setOpen(true); }}
            placeholder="Search any tool..."
            aria-label="Search tools"
            aria-autocomplete="list"
            aria-controls={open ? "search-results" : undefined}
            aria-activedescendant={
              open && activeIndex >= 0 ? `search-result-${activeIndex}` : undefined
            }
            className="bg-transparent border-none text-[24px] leading-[32px] font-normal text-[#e2e2e2] w-full placeholder-[#4d4354] focus:ring-0 focus:outline-none h-12"
          />
          {query && (
            <button
              onClick={() => { setQuery(""); setOpen(false); inputRef.current?.focus(); }}
              className="material-symbols-outlined text-[#988d9f] hover:text-[#e2e2e2] transition-colors mr-2 text-[20px]"
              aria-label="Clear search"
            >
              close
            </button>
          )}
          <button
            className="btn-primary text-white p-3 rounded-xl ml-2 flex items-center justify-center hover:scale-105 transition-transform"
            aria-label="Search"
            onClick={() => {
              if (results[0]) navigate(results[0].href);
            }}
          >
            <span className="material-symbols-outlined text-[24px]" aria-hidden="true">
              arrow_forward
            </span>
          </button>
        </div>

        {/* Dropdown */}
        {open && (
          <div
            className="absolute top-full left-0 right-0 mt-2 rounded-2xl border border-white/10 overflow-hidden"
            style={{
              background: "rgba(19,19,19,0.97)",
              backdropFilter: "blur(24px)",
              WebkitBackdropFilter: "blur(24px)",
              boxShadow: "0 16px 48px rgba(0,0,0,0.5)",
              zIndex: 50,
            }}
            role="listbox"
            id="search-results"
            aria-label="Search results"
          >
            {results.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 px-6 text-center gap-3">
                <span
                  className="material-symbols-outlined text-[36px]"
                  style={{ color: "#988d9f" }}
                  aria-hidden="true"
                >
                  search_off
                </span>
                <p className="text-[#988d9f] text-[15px]">
                  No tools found for <span className="text-[#ddb7ff]">&ldquo;{debouncedQuery.trim()}&rdquo;</span>
                </p>
                <p className="text-[#6b5b7a] text-[13px]">Try a different keyword or browse by category below.</p>
              </div>
            ) : (
              <ul ref={listRef} role="listbox">
                {results.map((r, i) => (
                  <li
                    key={r.slug}
                    id={`search-result-${i}`}
                    role="option"
                    aria-selected={i === activeIndex}
                    onMouseEnter={() => setActiveIndex(i)}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      navigate(r.href);
                    }}
                    className="flex items-center gap-4 px-5 py-3.5 cursor-pointer transition-colors border-b border-white/5 last:border-0"
                    style={{
                      background: i === activeIndex ? "rgba(221,183,255,0.08)" : "transparent",
                    }}
                  >
                    <span
                      className="material-symbols-outlined text-[22px] shrink-0"
                      style={{ color: r.iconColor, fontVariationSettings: "'FILL' 1" }}
                      aria-hidden="true"
                    >
                      {r.icon}
                    </span>
                    <div className="flex flex-col min-w-0 flex-1 text-left">
                      <span className="text-[15px] font-semibold text-[#e2e2e2] truncate">
                        {highlight(r.name, debouncedQuery.trim())}
                      </span>
                      <span className="text-[12px] text-[#988d9f] truncate">
                        {highlight(r.shortDescription, debouncedQuery.trim())}
                      </span>
                    </div>
                    <span
                      className="text-[11px] font-medium px-2.5 py-1 rounded-full shrink-0 hidden sm:block"
                      style={{ background: "rgba(255,255,255,0.06)", color: "#8a7a96" }}
                    >
                      {r.categoryName}
                    </span>
                    {isFavorite(r.slug) && (
                      <span
                        className="material-symbols-outlined text-[16px] shrink-0"
                        style={{ color: "#ff6482", fontVariationSettings: "'FILL' 1" }}
                        aria-label="Favorited"
                      >
                        favorite
                      </span>
                    )}
                    {i === activeIndex && (
                      <span
                        className="material-symbols-outlined text-[16px] shrink-0"
                        style={{ color: "#ddb7ff" }}
                        aria-hidden="true"
                      >
                        arrow_forward
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* Search Tags */}
      <div
        className="flex flex-wrap justify-center gap-3"
        role="list"
        aria-label="Popular searches"
      >
        {searchTags.map((tag) => (
          <button
            key={tag}
            role="listitem"
            onClick={() => {
              setQuery(tag);
              inputRef.current?.focus();
            }}
            className="px-4 py-2 rounded-full glass-panel text-[12px] font-semibold tracking-[0.05em] text-[#cfc2d6] hover:text-[#ddb7ff] hover:border-[#ddb7ff]/50 cursor-pointer transition-colors"
          >
            {tag}
          </button>
        ))}
      </div>
    </>
  );
}
