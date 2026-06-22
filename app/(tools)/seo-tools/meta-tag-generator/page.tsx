import type { Metadata } from "next";
import { generateToolMetadata } from "@/lib/metadata";
import { getToolBySlug } from "@/lib/tools";
import ToolPageContent from "@/components/tools/ToolPageContent";
import MetaTagGeneratorTool from "@/components/tools/implementations/MetaTagGeneratorTool";

const tool = getToolBySlug("meta-tag-generator")!;
export const metadata: Metadata = generateToolMetadata(tool);
export default function MetaTagGeneratorPage() {
  return <ToolPageContent tool={tool} toolComponent={<MetaTagGeneratorTool />} />;
}
