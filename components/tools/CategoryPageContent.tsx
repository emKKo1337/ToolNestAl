"use client";

import Link from "next/link";
import type { ToolCategory, Tool } from "@/lib/tools";
import Breadcrumb from "@/components/ui/Breadcrumb";
import HeartButton from "@/components/ui/HeartButton";

const SITE_URL = "https://toolnest.ai";

export default function CategoryPageContent({ category, tools }: { category: ToolCategory; tools: Tool[] }) {
  const itemListData = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: category.name,
    description: category.description,
    url: `${SITE_URL}/${category.slug}`,
    numberOfItems: tools.length,
    itemListElement: tools.map((tool, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: tool.name,
      description: tool.shortDescription,
      url: `${SITE_URL}/${tool.categorySlug}/${tool.slug}`,
    })),
  };

  const breadcrumbData = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: category.name, item: `${SITE_URL}/${category.slug}` },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListData) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbData) }} />
      <div className="pt-32 pb-24 px-4 md:px-[48px] max-w-[1280px] mx-auto w-full">
      <Breadcrumb items={[{ label: "Home", href: "/" }, { label: category.name }]} />

      {/* Page header */}
      <div className="flex flex-col items-start gap-4 mb-12">
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center"
          style={{ backgroundColor: category.bgColor }}
        >
          <span
            className="material-symbols-outlined text-[28px]"
            style={{ color: category.iconColor, fontVariationSettings: "'FILL' 1" }}
            aria-hidden="true"
          >
            {category.icon}
          </span>
        </div>
        <div>
          <h1 className="text-[36px] md:text-[48px] font-extrabold leading-[1.1] tracking-[-0.03em] text-[#e2e2e2] mb-3">
            {category.name}
          </h1>
          <p className="text-[17px] leading-[28px] text-[#9b8da8] max-w-2xl">{category.description}</p>
        </div>
      </div>

      {/* Tool grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {tools.map((tool) => (
          <div
            key={tool.slug}
            className="glass-panel glass-panel-hover rounded-2xl p-5 flex flex-col gap-3 group"
          >
            {/* Header row */}
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
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
              <h2 className="text-[16px] font-bold text-[#e2e2e2] group-hover:text-[#ddb7ff] transition-colors duration-200 leading-snug flex-1">
                {tool.name}
              </h2>
              <HeartButton slug={tool.slug} name={tool.name} size="sm" />
            </div>

            <p className="text-[13px] leading-[21px] text-[#7a6d84] line-clamp-2">{tool.shortDescription}</p>

            <Link
              href={`/${category.slug}/${tool.slug}`}
              className="flex items-center gap-1 text-[#ddb7ff] text-[12px] font-semibold mt-auto pt-1 w-fit transition-opacity hover:opacity-75"
              aria-label={`Open ${tool.name}`}
            >
              Try it free
              <span className="material-symbols-outlined text-[15px]" aria-hidden="true">arrow_forward</span>
            </Link>
          </div>
        ))}
      </div>
    </div>
    </>
  );
}
