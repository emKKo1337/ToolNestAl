import type { Metadata } from "next";
import { generateToolMetadata } from "@/lib/metadata";
import { getToolBySlug } from "@/lib/tools";
import ToolPageContent from "@/components/tools/ToolPageContent";
import SitemapGeneratorTool from "@/components/tools/implementations/SitemapGeneratorTool";

const tool = getToolBySlug("sitemap-generator")!;
export const metadata: Metadata = generateToolMetadata(tool);
export default function SitemapGeneratorPage() {
  return <ToolPageContent tool={tool} toolComponent={<SitemapGeneratorTool />} />;
}
