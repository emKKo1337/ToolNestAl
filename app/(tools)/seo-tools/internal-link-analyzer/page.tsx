import type { Metadata } from "next";
import { generateToolMetadata } from "@/lib/metadata";
import { getToolBySlug } from "@/lib/tools";
import ToolPageContent from "@/components/tools/ToolPageContent";
import InternalLinkAnalyzerTool from "@/components/tools/implementations/InternalLinkAnalyzerTool";

const tool = getToolBySlug("internal-link-analyzer")!;
export const metadata: Metadata = generateToolMetadata(tool);
export default function InternalLinkAnalyzerPage() {
  return <ToolPageContent tool={tool} toolComponent={<InternalLinkAnalyzerTool />} />;
}
