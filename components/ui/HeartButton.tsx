"use client";

import { useCallback, useRef } from "react";
import { useFavorites } from "@/lib/favorites";
import { useToast } from "@/components/ui/Toast";

interface HeartButtonProps {
  slug: string;
  name: string;
  /** visual size variant */
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeMap = {
  sm: "w-7 h-7 text-[16px]",
  md: "w-9 h-9 text-[20px]",
  lg: "w-10 h-10 text-[22px]",
};

export default function HeartButton({ slug, name, size = "md", className = "" }: HeartButtonProps) {
  const { isFavorite, toggle } = useFavorites();
  const { show } = useToast();
  const btnRef = useRef<HTMLButtonElement>(null);
  const active = isFavorite(slug);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();  // stop Link navigation on card clicks
      e.stopPropagation();
      toggle(slug);
      if (btnRef.current) {
        btnRef.current.classList.remove("heart-pop");
        // Force reflow so the animation re-triggers even on rapid clicks
        void btnRef.current.offsetWidth;
        btnRef.current.classList.add("heart-pop");
      }
      show(
        active ? `Removed from Favorites` : `Added to Favorites`,
        active ? "heart_broken" : "favorite"
      );
    },
    [slug, active, toggle, show]
  );

  return (
    <button
      ref={btnRef}
      onClick={handleClick}
      aria-label={active ? `Remove ${name} from favorites` : `Add ${name} to favorites`}
      aria-pressed={active}
      className={`flex items-center justify-center rounded-xl transition-colors duration-200 ${sizeMap[size]} ${className}`}
      style={{
        background: active ? "rgba(255,100,130,0.12)" : "rgba(255,255,255,0.06)",
        border: `1px solid ${active ? "rgba(255,100,130,0.35)" : "rgba(255,255,255,0.1)"}`,
      }}
    >
      <span
        className="material-symbols-outlined leading-none"
        style={{
          fontSize: "inherit",
          color: active ? "#ff6482" : "#988d9f",
          fontVariationSettings: active ? "'FILL' 1" : "'FILL' 0",
          transition: "color 0.2s, font-variation-settings 0.2s",
        }}
        aria-hidden="true"
      >
        favorite
      </span>
    </button>
  );
}
