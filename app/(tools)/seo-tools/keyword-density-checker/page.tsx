import type { Metadata } from "next";
import { generateToolMetadata } from "@/lib/metadata";
import { getToolBySlug } from "@/lib/tools";
import ToolPageContent from "@/components/tools/ToolPageContent";
import KeywordDensityCheckerTool from "@/components/tools/implementations/KeywordDensityCheckerTool";

const tool = getToolBySlug("keyword-density-checker")!;
export const metadata: Metadata = generateToolMetadata(tool);
export default function KeywordDensityCheckerPage() {
  return <ToolPageContent tool={tool} toolComponent={<KeywordDensityCheckerTool />} />;
}
