import type { Metadata } from "next";
import { generateToolMetadata } from "@/lib/metadata";
import { getToolBySlug } from "@/lib/tools";
import ToolPageContent from "@/components/tools/ToolPageContent";
import MetaTagsExtractorTool from "@/components/tools/implementations/MetaTagsExtractorTool";

const tool = getToolBySlug("meta-tags-extractor")!;
export const metadata: Metadata = generateToolMetadata(tool);
export default function MetaTagsExtractorPage() {
  return <ToolPageContent tool={tool} toolComponent={<MetaTagsExtractorTool />} />;
}
