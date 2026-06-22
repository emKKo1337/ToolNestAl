import type { Metadata } from "next";
import { generateToolMetadata } from "@/lib/metadata";
import { getToolBySlug } from "@/lib/tools";
import ToolPageContent from "@/components/tools/ToolPageContent";
import HreflangGeneratorTool from "@/components/tools/implementations/HreflangGeneratorTool";

const tool = getToolBySlug("hreflang-generator")!;
export const metadata: Metadata = generateToolMetadata(tool);
export default function HreflangGeneratorPage() {
  return <ToolPageContent tool={tool} toolComponent={<HreflangGeneratorTool />} />;
}
