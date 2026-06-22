import type { Metadata } from "next";
import { generateToolMetadata } from "@/lib/metadata";
import { getToolBySlug } from "@/lib/tools";
import ToolPageContent from "@/components/tools/ToolPageContent";
import SitemapValidatorTool from "@/components/tools/implementations/SitemapValidatorTool";

const tool = getToolBySlug("sitemap-validator")!;
export const metadata: Metadata = generateToolMetadata(tool);
export default function SitemapValidatorPage() {
  return <ToolPageContent tool={tool} toolComponent={<SitemapValidatorTool />} />;
}
