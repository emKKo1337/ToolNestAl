import Link from "next/link";
import type { Tool } from "@/lib/tools";
import { getRelatedTools, getCategoryBySlug } from "@/lib/tools";
import { getPostBySlug } from "@/lib/blog";
import Breadcrumb from "@/components/ui/Breadcrumb";
import ToolHero from "@/components/ui/ToolHero";
import ToolPlaceholder from "@/components/ui/ToolPlaceholder";
import FAQSection from "@/components/ui/FAQSection";
import RelatedTools from "@/components/ui/RelatedTools";

const SITE_URL = "https://www.toolnestai.net";

interface ToolPageContentProps {
  tool: Tool;
  toolComponent?: React.ReactNode;
}

export default function ToolPageContent({ tool, toolComponent }: ToolPageContentProps) {
  const category    = getCategoryBySlug(tool.categorySlug);
  const relatedTools = getRelatedTools(tool.relatedSlugs);
  const toolUrl     = `${SITE_URL}/${tool.categorySlug}/${tool.slug}`;
  const relatedPosts = (tool.relatedPostSlugs ?? [])
    .map((slug) => getPostBySlug(slug))
    .filter((p): p is NonNullable<typeof p> => p !== null);

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: tool.name,
    description: tool.description,
    url: toolUrl,
    applicationCategory: "WebApplication",
    operatingSystem: "Web",
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    creator: { "@type": "Organization", name: "ToolNest AI", url: SITE_URL },
  };

  const breadcrumbData = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: category?.name ?? "Tools", item: `${SITE_URL}/${tool.categorySlug}` },
      { "@type": "ListItem", position: 3, name: tool.name, item: toolUrl },
    ],
  };

  const faqData = tool.faqs.length > 0 ? {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: tool.faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: { "@type": "Answer", text: faq.answer },
    })),
  } : null;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbData) }}
      />
      {faqData && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqData) }}
        />
      )}

      <div className="pt-28 pb-24 px-4 md:px-[48px] max-w-[1280px] mx-auto w-full">
        <Breadcrumb
          items={[
            { label: "Home", href: "/" },
            { label: category?.name ?? "Tools", href: `/${tool.categorySlug}` },
            { label: tool.name },
          ]}
        />
        <ToolHero
          slug={tool.slug}
          name={tool.name}
          shortDescription={tool.shortDescription}
          icon={tool.icon}
          iconColor={tool.iconColor}
          badge="Free"
        />

        {/* Tool interface */}
        {toolComponent ?? <ToolPlaceholder toolName={tool.name} />}

        {/* About section */}
        <section className="mb-12 mt-4" aria-labelledby="about-heading">
          <div className="divider mb-10" />
          <h2
            id="about-heading"
            className="text-[22px] font-bold leading-[30px] tracking-[-0.02em] text-[#e2e2e2] mb-3"
          >
            About {tool.name}
          </h2>
          <p className="text-[15px] leading-[26px] text-[#9b8da8] max-w-3xl">
            {tool.description}
          </p>
        </section>

        {tool.longContent && tool.longContent.length > 0 && (
          <section className="mb-12" aria-labelledby="guide-heading">
            <div className="divider mb-10" />
            <h2 id="guide-heading" className="sr-only">
              {tool.name} guide
            </h2>
            <div className="flex flex-col gap-10 max-w-3xl">
              {tool.longContent.map((sec, i) => (
                <div key={i}>
                  <h3 className="text-[18px] font-bold leading-[26px] tracking-[-0.01em] text-[#e2e2e2] mb-3">
                    {sec.heading}
                  </h3>
                  {sec.body.map((p, j) => (
                    <p key={j} className="text-[15px] leading-[26px] text-[#9b8da8] mb-3">
                      {p}
                    </p>
                  ))}
                  {sec.list && sec.list.length > 0 && (
                    <ul className="flex flex-col gap-1.5 pl-5 list-disc text-[15px] leading-[26px] text-[#9b8da8] mb-3">
                      {sec.list.map((item, k) => (
                        <li key={k}>{item}</li>
                      ))}
                    </ul>
                  )}
                  {sec.code && (
                    <pre className="glass-panel rounded-xl p-4 overflow-x-auto text-[13px] leading-[20px] text-[#cfc2d6] font-mono mt-2">
                      <code>{sec.code.snippet}</code>
                    </pre>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        <div className="divider mb-10" />
        <FAQSection faqs={tool.faqs} />

        {relatedPosts.length > 0 && (
          <section className="mb-12" aria-labelledby="related-reading-heading">
            <div className="divider mb-10" />
            <h2
              id="related-reading-heading"
              className="text-[22px] font-bold leading-[30px] tracking-[-0.02em] text-[#e2e2e2] mb-5"
            >
              Further reading
            </h2>
            <div className="flex flex-col gap-2">
              {relatedPosts.map((post) => (
                <Link
                  key={post.slug}
                  href={`/blog/${post.slug}`}
                  className="text-[15px] text-[#ddb7ff] hover:opacity-75 transition-opacity"
                >
                  {post.title} →
                </Link>
              ))}
            </div>
          </section>
        )}

        {relatedTools.length > 0 && (
          <>
            <div className="divider mb-10" />
            <RelatedTools tools={relatedTools} />
          </>
        )}
      </div>
    </>
  );
}
