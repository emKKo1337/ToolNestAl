"use client";

import Link from "next/link";
import type { Tool } from "@/lib/tools";
import HeartButton from "@/components/ui/HeartButton";

export default function RelatedTools({ tools }: { tools: Tool[] }) {
  if (tools.length === 0) return null;
  return (
    <section aria-labelledby="related-heading">
      <h2 id="related-heading" className="text-[28px] font-bold leading-[36px] tracking-[-0.02em] text-[#e2e2e2] mb-6">Related Tools</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {tools.map((tool) => (
          <div key={tool.slug} className="glass-panel glass-panel-hover rounded-xl p-5 flex items-start gap-4 group relative">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${tool.iconColor}18` }}>
              <span className="material-symbols-outlined text-[20px]" style={{ color: tool.iconColor, fontVariationSettings: "'FILL' 1" }} aria-hidden="true">{tool.icon}</span>
            </div>
            <div className="flex-1 min-w-0">
              <Link href={`/${tool.categorySlug}/${tool.slug}`}>
                <p className="text-[15px] font-semibold text-[#e2e2e2] group-hover:text-[#ddb7ff] transition-colors">{tool.name}</p>
                <p className="text-[13px] text-[#988d9f] mt-1 line-clamp-2">{tool.shortDescription}</p>
              </Link>
            </div>
            <HeartButton slug={tool.slug} name={tool.name} size="sm" />
          </div>
        ))}
      </div>
    </section>
  );
}
