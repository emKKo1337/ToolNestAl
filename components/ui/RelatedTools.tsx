"use client";

import Link from "next/link";
import type { Tool } from "@/lib/tools";
import HeartButton from "@/components/ui/HeartButton";

export default function RelatedTools({ tools }: { tools: Tool[] }) {
  if (tools.length === 0) return null;
  return (
    <section aria-labelledby="related-heading">
      <h2
        id="related-heading"
        className="text-[24px] font-bold leading-[32px] tracking-[-0.02em] text-[#e2e2e2] mb-5"
      >
        Related Tools
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        {tools.map((tool) => (
          <div
            key={tool.slug}
            className="glass-panel glass-panel-hover rounded-xl p-4 flex items-start gap-3 group"
          >
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
              style={{ backgroundColor: `${tool.iconColor}18` }}
            >
              <span
                className="material-symbols-outlined text-[18px]"
                style={{ color: tool.iconColor, fontVariationSettings: "'FILL' 1" }}
                aria-hidden="true"
              >
                {tool.icon}
              </span>
            </div>
            <Link href={`/${tool.categorySlug}/${tool.slug}`} className="flex-1 min-w-0">
              <p className="text-[14px] font-semibold text-[#e2e2e2] group-hover:text-[#ddb7ff] transition-colors duration-200 leading-snug">
                {tool.name}
              </p>
              <p className="text-[12px] text-[#6b5b7a] mt-0.5 line-clamp-2 leading-snug">
                {tool.shortDescription}
              </p>
            </Link>
            <HeartButton slug={tool.slug} name={tool.name} size="sm" />
          </div>
        ))}
      </div>
    </section>
  );
}
