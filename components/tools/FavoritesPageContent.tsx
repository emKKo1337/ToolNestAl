"use client";

import Link from "next/link";
import { useFavorites } from "@/lib/favorites";
import { useToast } from "@/components/ui/Toast";
import { tools, categories } from "@/lib/tools";

const categoryMap = Object.fromEntries(categories.map((c) => [c.slug, c.name]));

export default function FavoritesPageContent() {
  const { favorites, toggle } = useFavorites();
  const { show } = useToast();

  const favoriteTools = tools.filter((t) => favorites.has(t.slug));

  function handleRemove(slug: string) {
    toggle(slug);
    show("Removed from Favorites", "heart_broken");
  }

  return (
    <div className="pt-28 pb-24 px-4 md:px-[48px] max-w-[1280px] mx-auto w-full">
      {/* Page header */}
      <div className="flex flex-col items-start gap-4 mb-12">
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center"
          style={{ background: "rgba(255,100,130,0.12)" }}
        >
          <span
            className="material-symbols-outlined text-[28px]"
            style={{ color: "#ff6482", fontVariationSettings: "'FILL' 1" }}
            aria-hidden="true"
          >
            favorite
          </span>
        </div>
        <div>
          <h1 className="text-[36px] md:text-[48px] font-extrabold leading-[1.1] tracking-[-0.03em] text-[#e2e2e2] mb-2">
            My Favorites
          </h1>
          <p className="text-[17px] leading-[28px] text-[#9b8da8]">
            {favoriteTools.length === 0
              ? "Save tools you use frequently for quick access."
              : `${favoriteTools.length} saved tool${favoriteTools.length !== 1 ? "s" : ""}`}
          </p>
        </div>
      </div>

      {/* Empty state */}
      {favoriteTools.length === 0 && (
        <div className="glass-panel rounded-3xl flex flex-col items-center justify-center py-20 px-8 text-center gap-5">
          <div
            className="w-20 h-20 rounded-2xl flex items-center justify-center"
            style={{ background: "rgba(255,100,130,0.1)" }}
          >
            <span
              className="material-symbols-outlined text-[40px]"
              style={{ color: "#ff6482", fontVariationSettings: "'FILL' 1" }}
              aria-hidden="true"
            >
              favorite
            </span>
          </div>
          <div>
            <p className="text-[22px] font-bold text-[#e2e2e2] mb-2">No favorite tools yet.</p>
            <p className="text-[15px] text-[#7a6d84] max-w-xs leading-snug">
              Click the{" "}
              <span
                className="material-symbols-outlined text-[15px] align-middle"
                style={{ color: "#ff6482", fontVariationSettings: "'FILL' 1" }}
                aria-hidden="true"
              >
                favorite
              </span>{" "}
              icon on any tool card to save it here.
            </p>
          </div>
          <Link
            href="/"
            className="btn-primary text-white font-semibold px-7 py-2.5 rounded-xl text-[14px] flex items-center gap-2 mt-1"
          >
            <span className="material-symbols-outlined text-[17px]" aria-hidden="true">explore</span>
            Browse Tools
          </Link>
        </div>
      )}

      {/* Tool grid */}
      {favoriteTools.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {favoriteTools.map((tool) => (
            <div
              key={tool.slug}
              className="glass-panel rounded-2xl p-5 flex flex-col gap-3 transition-colors duration-200"
              style={{ borderColor: "rgba(255,100,130,0.12)" }}
            >
              {/* Icon + name */}
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden"
                  style={{ backgroundColor: `${tool.iconColor}18` }}
                >
                  <span
                    className="material-symbols-outlined text-[20px]"
                    style={{ color: tool.iconColor, fontVariationSettings: "'FILL' 1" }}
                    aria-hidden="true"
                  >
                    {tool.icon}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-[15px] font-bold text-[#e2e2e2] leading-snug truncate">{tool.name}</h2>
                  <p className="text-[11px] text-[#6b5b7a] mt-0.5 font-medium uppercase tracking-[0.06em]">
                    {categoryMap[tool.categorySlug] ?? tool.categorySlug}
                  </p>
                </div>
              </div>

              <p className="text-[13px] leading-[21px] text-[#7a6d84] line-clamp-2">{tool.shortDescription}</p>

              {/* Actions */}
              <div className="flex items-center gap-2 mt-auto pt-1">
                <Link
                  href={`/${tool.categorySlug}/${tool.slug}`}
                  className="btn-primary text-white text-[12px] font-semibold px-4 py-2 rounded-xl flex items-center gap-1.5 flex-1 justify-center"
                >
                  <span className="material-symbols-outlined text-[14px]" aria-hidden="true">open_in_new</span>
                  Open Tool
                </Link>
                <button
                  onClick={() => handleRemove(tool.slug)}
                  aria-label={`Remove ${tool.name} from favorites`}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-semibold transition-all duration-200 hover:bg-[rgba(255,100,130,0.18)]"
                  style={{
                    background: "rgba(255,100,130,0.09)",
                    border: "1px solid rgba(255,100,130,0.2)",
                    color: "#ff6482",
                  }}
                >
                  <span
                    className="material-symbols-outlined text-[14px]"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                    aria-hidden="true"
                  >
                    heart_broken
                  </span>
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
