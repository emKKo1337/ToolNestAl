import type { Metadata } from "next";
import { generateToolMetadata } from "@/lib/metadata";
import { getToolBySlug } from "@/lib/tools";
import ToolPageContent from "@/components/tools/ToolPageContent";
import TwitterCardGeneratorTool from "@/components/tools/implementations/TwitterCardGeneratorTool";

const tool = getToolBySlug("twitter-card-generator")!;
export const metadata: Metadata = generateToolMetadata(tool);
export default function TwitterCardGeneratorPage() {
  return <ToolPageContent tool={tool} toolComponent={<TwitterCardGeneratorTool />} />;
}
