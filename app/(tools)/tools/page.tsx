import type { Metadata } from "next";
import Link from "next/link";
import { tools, categories } from "@/lib/tools";
import Breadcrumb from "@/components/ui/Breadcrumb";
import HeartButton from "@/components/ui/HeartButton";

const SITE_URL = "https://www.toolnestai.net";
const OG_IMAGE  = `${SITE_URL}/og-image.png`;

export const metadata: Metadata = {
  title: `All Tools — ${tools.length}+ Free Online Tools | ToolNest AI`,
  description: `Browse all ${tools.length}+ free online tools on ToolNest AI — AI tools, PDF tools, image editors, developer utilities, text tools, and more. No sign-up required.`,
  alternates: { canonical: `${SITE_URL}/tools` },
  openGraph: {
    type: "website",
    url: `${SITE_URL}/tools`,
    siteName: "ToolNest AI",
    locale: "en_US",
    title: `All Tools — ${tools.length}+ Free Online Tools | ToolNest AI`,
    description: `Browse all ${tools.length}+ free online tools on ToolNest AI. No sign-up required.`,
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: "All Tools | ToolNest AI" }],
  },
  twitter: {
    card: "summary_large_image",
    site: "@toolnestai",
    creator: "@toolnestai",
    title: `All Tools — ${tools.length}+ Free Online Tools | ToolNest AI`,
    description: `Browse all ${tools.length}+ free online tools on ToolNest AI. No sign-up required.`,
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: "All Tools | ToolNest AI" }],
  },
};

export default function AllToolsPage() {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "All Tools — ToolNest AI",
    url: `${SITE_URL}/tools`,
    numberOfItems: tools.length,
    itemListElement: tools.map((tool, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: tool.name,
      description: tool.shortDescription,
      url: `${SITE_URL}/${tool.categorySlug}/${tool.slug}`,
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <div className="pt-32 pb-24 px-4 md:px-[48px] max-w-[1280px] mx-auto w-full">
        <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "All Tools" }]} />

        {/* Page header */}
        <div className="flex flex-col items-start gap-3 mb-12">
          <h1 className="text-[36px] md:text-[48px] font-extrabold leading-[1.1] tracking-[-0.03em] text-[#e2e2e2]">
            All Tools
          </h1>
          <p className="text-[17px] leading-[28px] text-[#9b8da8] max-w-2xl">
            {tools.length}+ free online tools across every category — no sign-up, no limits.
          </p>
        </div>

        {/* One section per category */}
        <div className="flex flex-col gap-16">
          {categories.map((cat) => {
            const catTools = tools.filter((t) => t.categorySlug === cat.slug);
            if (!catTools.length) return null;
            return (
              <section key={cat.slug} aria-labelledby={`cat-${cat.slug}`}>
                {/* Category heading */}
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{ backgroundColor: cat.bgColor }}
                    >
                      <span
                        className="material-symbols-outlined text-[20px]"
                        style={{ color: cat.iconColor, fontVariationSettings: "'FILL' 1" }}
                        aria-hidden="true"
                      >
                        {cat.icon}
                      </span>
                    </div>
                    <h2
                      id={`cat-${cat.slug}`}
                      className="text-[20px] font-bold text-[#e2e2e2] tracking-tight"
                    >
                      {cat.name}
                    </h2>
                    <span
                      className="text-[12px] font-semibold px-2.5 py-0.5 rounded-full"
                      style={{ background: cat.bgColor, color: cat.iconColor }}
                    >
                      {catTools.length}
                    </span>
                  </div>
                  <Link
                    href={`/${cat.slug}`}
                    className="text-[13px] font-semibold flex items-center gap-0.5 transition-opacity hover:opacity-75"
                    style={{ color: cat.iconColor }}
                  >
                    View all
                    <span className="material-symbols-outlined text-[14px]" aria-hidden="true">
                      arrow_forward
                    </span>
                  </Link>
                </div>

                {/* Tool grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {catTools.map((tool) => (
                    <div
                      key={tool.slug}
                      className="glass-panel glass-panel-hover rounded-2xl p-5 flex flex-col gap-3 group"
                    >
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
                        <h3 className="text-[16px] font-bold text-[#e2e2e2] group-hover:text-[#ddb7ff] transition-colors duration-200 leading-snug flex-1">
                          {tool.name}
                        </h3>
                        <HeartButton slug={tool.slug} name={tool.name} size="sm" />
                      </div>
                      <p className="text-[13px] leading-[21px] text-[#7a6d84] line-clamp-2">
                        {tool.shortDescription}
                      </p>
                      <Link
                        href={`/${tool.categorySlug}/${tool.slug}`}
                        className="flex items-center gap-1 text-[#ddb7ff] text-[12px] font-semibold mt-auto pt-1 w-fit transition-opacity hover:opacity-75"
                        aria-label={`Open ${tool.name}`}
                      >
                        Try it free
                        <span className="material-symbols-outlined text-[15px]" aria-hidden="true">
                          arrow_forward
                        </span>
                      </Link>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </>
  );
}
