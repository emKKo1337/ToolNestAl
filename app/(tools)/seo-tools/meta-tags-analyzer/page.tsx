import type { Metadata } from "next";
import { generateToolMetadata } from "@/lib/metadata";
import { getToolBySlug } from "@/lib/tools";
import ToolPageContent from "@/components/tools/ToolPageContent";
import MetaTagsAnalyzerTool from "@/components/tools/implementations/MetaTagsAnalyzerTool";

const tool = getToolBySlug("meta-tags-analyzer")!;
export const metadata: Metadata = generateToolMetadata(tool);
export default function MetaTagsAnalyzerPage() {
  return <ToolPageContent tool={tool} toolComponent={<MetaTagsAnalyzerTool />} />;
}
