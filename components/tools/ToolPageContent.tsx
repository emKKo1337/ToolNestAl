import type { Tool } from "@/lib/tools";
import { getRelatedTools, getCategoryBySlug } from "@/lib/tools";
import Breadcrumb from "@/components/ui/Breadcrumb";
import ToolHero from "@/components/ui/ToolHero";
import ToolPlaceholder from "@/components/ui/ToolPlaceholder";
import FAQSection from "@/components/ui/FAQSection";
import RelatedTools from "@/components/ui/RelatedTools";

const SITE_URL = "https://toolnest.ai";

interface ToolPageContentProps {
  tool: Tool;
  toolComponent?: React.ReactNode;
}

export default function ToolPageContent({ tool, toolComponent }: ToolPageContentProps) {
  const category    = getCategoryBySlug(tool.categorySlug);
  const relatedTools = getRelatedTools(tool.relatedSlugs);
  const toolUrl     = `${SITE_URL}/${tool.categorySlug}/${tool.slug}`;

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

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

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

        <div className="divider mb-10" />
        <FAQSection faqs={tool.faqs} />

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
