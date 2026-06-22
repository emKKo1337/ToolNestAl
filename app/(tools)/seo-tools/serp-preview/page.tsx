import type { Metadata } from "next";
import { generateToolMetadata } from "@/lib/metadata";
import { getToolBySlug } from "@/lib/tools";
import ToolPageContent from "@/components/tools/ToolPageContent";
import SerpPreviewTool from "@/components/tools/implementations/SerpPreviewTool";

const tool = getToolBySlug("serp-preview")!;
export const metadata: Metadata = generateToolMetadata(tool);
export default function SerpPreviewPage() {
  return <ToolPageContent tool={tool} toolComponent={<SerpPreviewTool />} />;
}
