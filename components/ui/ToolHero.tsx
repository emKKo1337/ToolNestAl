"use client";

import HeartButton from "@/components/ui/HeartButton";

interface ToolHeroProps {
  slug: string;
  name: string;
  shortDescription: string;
  icon: string;
  iconColor: string;
  bgColor?: string;
  badge?: string;
}

export default function ToolHero({
  slug,
  name,
  shortDescription,
  icon,
  iconColor,
  bgColor = "rgba(221,183,255,0.1)",
  badge,
}: ToolHeroProps) {
  return (
    <div className="flex flex-col items-start gap-6 mb-10">
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: bgColor }}>
          <span className="material-symbols-outlined text-[32px]" style={{ color: iconColor, fontVariationSettings: "'FILL' 1" }} aria-hidden="true">{icon}</span>
        </div>
        {badge && (
          <span className="px-3 py-1 rounded-full text-[11px] font-semibold tracking-[0.08em] uppercase bg-[rgba(76,215,246,0.1)] text-[#4cd7f6] border border-[rgba(76,215,246,0.2)]">{badge}</span>
        )}
        <HeartButton slug={slug} name={name} size="lg" className="ml-auto" />
      </div>
      <div>
        <h1 className="text-[40px] md:text-[52px] font-extrabold leading-[1.1] tracking-[-0.03em] text-[#e2e2e2] mb-3">{name}</h1>
        <p className="text-[18px] leading-[28px] text-[#cfc2d6] max-w-2xl">{shortDescription}</p>
      </div>
    </div>
  );
}
