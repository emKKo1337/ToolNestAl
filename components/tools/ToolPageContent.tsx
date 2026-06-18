import type { Tool } from "@/lib/tools";
import { getRelatedTools, getCategoryBySlug } from "@/lib/tools";
import Breadcrumb from "@/components/ui/Breadcrumb";
import ToolHero from "@/components/ui/ToolHero";
import ToolPlaceholder from "@/components/ui/ToolPlaceholder";
import FAQSection from "@/components/ui/FAQSection";
import RelatedTools from "@/components/ui/RelatedTools";

interface ToolPageContentProps {
  tool: Tool;
  toolComponent?: React.ReactNode;
}

export default function ToolPageContent({ tool, toolComponent }: ToolPageContentProps) {
  const category = getCategoryBySlug(tool.categorySlug);
  const relatedTools = getRelatedTools(tool.relatedSlugs);
  return (
    <div className="pt-32 pb-24 px-4 md:px-[48px] max-w-[1280px] mx-auto w-full">
      <Breadcrumb items={[{ label: "Home", href: "/" }, { label: category?.name ?? "Tools", href: `/${tool.categorySlug}` }, { label: tool.name }]} />
      <ToolHero name={tool.name} shortDescription={tool.shortDescription} icon={tool.icon} iconColor={tool.iconColor} badge="Free" />
      {toolComponent ?? <ToolPlaceholder toolName={tool.name} />}
      <section className="mb-16" aria-labelledby="about-heading">
        <h2 id="about-heading" className="text-[28px] font-bold leading-[36px] tracking-[-0.02em] text-[#e2e2e2] mb-4">About {tool.name}</h2>
        <p className="text-[17px] leading-[28px] text-[#cfc2d6] max-w-3xl">{tool.description}</p>
      </section>
      <FAQSection faqs={tool.faqs} />
      <RelatedTools tools={relatedTools} />
    </div>
  );
}
