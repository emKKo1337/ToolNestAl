import Link from "next/link";
import { tools } from "@/lib/tools";

export function ToolCard({
  slug,
  customTitle,
  customDescription,
}: {
  slug: string;
  customTitle?: string;
  customDescription?: string;
}) {
  const tool = tools.find((t) => t.slug === slug);
  if (!tool) return null;

  return (
    <div
      className="glass-panel rounded-2xl p-5 my-8 flex items-start gap-4"
      style={{ borderColor: "rgba(221,183,255,0.2)" }}
    >
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden"
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
        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#ddb7ff] mb-1">
          Try this Tool
        </p>
        <h4 className="text-[16px] font-bold text-[#e2e2e2] mb-1 leading-snug">
          {customTitle ?? tool.name}
        </h4>
        <p className="text-[13px] leading-[20px] text-[#7a6d84] mb-3">
          {customDescription ?? tool.shortDescription}
        </p>
        <Link
          href={`/${tool.categorySlug}/${tool.slug}`}
          className="btn-primary text-white text-[13px] font-semibold px-4 py-2 rounded-xl inline-flex items-center gap-1.5"
        >
          <span
            className="material-symbols-outlined text-[14px]"
            aria-hidden="true"
          >
            open_in_new
          </span>
          Use {tool.name} — Free
        </Link>
      </div>
    </div>
  );
}
