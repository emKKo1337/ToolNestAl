import Link from "next/link";
import type { ToolCategory, Tool } from "@/lib/tools";
import Breadcrumb from "@/components/ui/Breadcrumb";

export default function CategoryPageContent({ category, tools }: { category: ToolCategory; tools: Tool[] }) {
  return (
    <div className="pt-32 pb-24 px-4 md:px-[48px] max-w-[1280px] mx-auto w-full">
      <Breadcrumb items={[{ label: "Home", href: "/" }, { label: category.name }]} />
      <div className="flex flex-col items-start gap-4 mb-14">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: category.bgColor }}>
          <span className="material-symbols-outlined text-[32px]" style={{ color: category.iconColor, fontVariationSettings: "'FILL' 1" }} aria-hidden="true">{category.icon}</span>
        </div>
        <div>
          <h1 className="text-[40px] md:text-[52px] font-extrabold leading-[1.1] tracking-[-0.03em] text-[#e2e2e2] mb-3">{category.name}</h1>
          <p className="text-[18px] leading-[28px] text-[#cfc2d6] max-w-2xl">{category.description}</p>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {tools.map((tool) => (
          <Link key={tool.slug} href={`/${category.slug}/${tool.slug}`} className="glass-panel glass-panel-hover rounded-2xl p-6 flex flex-col gap-4 group" aria-label={`Open ${tool.name}`}>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${tool.iconColor}18` }}>
                <span className="material-symbols-outlined text-[24px]" style={{ color: tool.iconColor, fontVariationSettings: "'FILL' 1" }} aria-hidden="true">{tool.icon}</span>
              </div>
              <h2 className="text-[18px] font-bold text-[#e2e2e2] group-hover:text-[#ddb7ff] transition-colors leading-tight">{tool.name}</h2>
            </div>
            <p className="text-[14px] leading-[22px] text-[#988d9f]">{tool.shortDescription}</p>
            <div className="flex items-center gap-1 text-[#ddb7ff] text-[13px] font-semibold mt-auto">
              Try it free <span className="material-symbols-outlined text-[16px]" aria-hidden="true">arrow_forward</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
