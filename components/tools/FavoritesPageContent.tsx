"use client";

import Link from "next/link";
import { useFavorites } from "@/lib/favorites";
import { useToast } from "@/components/ui/Toast";
import { tools } from "@/lib/tools";
import { categories } from "@/lib/tools";

const categoryMap = Object.fromEntries(categories.map((c) => [c.slug, c.name]));

export default function FavoritesPageContent() {
  const { favorites, toggle } = useFavorites();
  const { show } = useToast();

  const favoriteTools = tools.filter((t) => favorites.has(t.slug));

  function handleRemove(slug: string) {
    toggle(slug);
    show(`Removed from Favorites`, "heart_broken");
  }

  return (
    <div className="pt-32 pb-24 px-4 md:px-[48px] max-w-[1280px] mx-auto w-full">
      {/* Page header */}
      <div className="flex flex-col items-start gap-3 mb-12">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center"
          style={{ background: "rgba(255,100,130,0.12)" }}
        >
          <span
            className="material-symbols-outlined text-[32px]"
            style={{ color: "#ff6482", fontVariationSettings: "'FILL' 1" }}
            aria-hidden="true"
          >
            favorite
          </span>
        </div>
        <div>
          <h1 className="text-[40px] md:text-[52px] font-extrabold leading-[1.1] tracking-[-0.03em] text-[#e2e2e2] mb-3">
            My Favorites
          </h1>
          <p className="text-[18px] leading-[28px] text-[#cfc2d6]">
            {favoriteTools.length === 0
              ? "Your saved tools will appear here."
              : `${favoriteTools.length} saved tool${favoriteTools.length !== 1 ? "s" : ""}`}
          </p>
        </div>
      </div>

      {/* Empty state */}
      {favoriteTools.length === 0 && (
        <div className="glass-panel rounded-3xl flex flex-col items-center justify-center py-24 px-8 text-center gap-6">
          <span
            className="material-symbols-outlined text-[64px]"
            style={{ color: "#ff6482", fontVariationSettings: "'FILL' 1" }}
            aria-hidden="true"
          >
            favorite
          </span>
          <div>
            <p className="text-[24px] font-bold text-[#e2e2e2] mb-2">No favorite tools yet.</p>
            <p className="text-[16px] text-[#988d9f] max-w-sm">
              Browse tools and click the{" "}
              <span
                className="material-symbols-outlined text-[16px] align-middle"
                style={{ color: "#ff6482", fontVariationSettings: "'FILL' 1" }}
                aria-hidden="true"
              >
                favorite
              </span>{" "}
              icon to save your favorites here.
            </p>
          </div>
          <Link
            href="/"
            className="btn-primary text-white font-semibold px-8 py-3 rounded-xl text-[15px] flex items-center gap-2 mt-2"
          >
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">explore</span>
            Browse Tools
          </Link>
        </div>
      )}

      {/* Tool grid */}
      {favoriteTools.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {favoriteTools.map((tool) => (
            <div
              key={tool.slug}
              className="glass-panel rounded-2xl p-6 flex flex-col gap-4"
              style={{ borderColor: "rgba(255,100,130,0.15)" }}
            >
              {/* Icon + name + category */}
              <div className="flex items-center gap-4">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: `${tool.iconColor}18` }}
                >
                  <span
                    className="material-symbols-outlined text-[24px]"
                    style={{ color: tool.iconColor, fontVariationSettings: "'FILL' 1" }}
                    aria-hidden="true"
                  >
                    {tool.icon}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-[17px] font-bold text-[#e2e2e2] leading-tight truncate">{tool.name}</h2>
                  <p className="text-[12px] text-[#988d9f] mt-0.5">{categoryMap[tool.categorySlug] ?? tool.categorySlug}</p>
                </div>
              </div>

              {/* Description */}
              <p className="text-[14px] leading-[22px] text-[#988d9f] line-clamp-2">{tool.shortDescription}</p>

              {/* Actions */}
              <div className="flex items-center gap-3 mt-auto">
                <Link
                  href={`/${tool.categorySlug}/${tool.slug}`}
                  className="btn-primary text-white text-[13px] font-semibold px-4 py-2 rounded-xl flex items-center gap-1.5 flex-1 justify-center"
                >
                  <span className="material-symbols-outlined text-[16px]" aria-hidden="true">open_in_new</span>
                  Open Tool
                </Link>
                <button
                  onClick={() => handleRemove(tool.slug)}
                  aria-label={`Remove ${tool.name} from favorites`}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[13px] font-semibold transition-colors duration-200"
                  style={{
                    background: "rgba(255,100,130,0.10)",
                    border: "1px solid rgba(255,100,130,0.25)",
                    color: "#ff6482",
                  }}
                >
                  <span
                    className="material-symbols-outlined text-[16px]"
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
