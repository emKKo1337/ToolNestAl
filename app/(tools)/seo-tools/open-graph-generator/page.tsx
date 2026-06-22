import type { Metadata } from "next";
import { generateToolMetadata } from "@/lib/metadata";
import { getToolBySlug } from "@/lib/tools";
import ToolPageContent from "@/components/tools/ToolPageContent";
import OpenGraphGeneratorTool from "@/components/tools/implementations/OpenGraphGeneratorTool";

const tool = getToolBySlug("open-graph-generator")!;
export const metadata: Metadata = generateToolMetadata(tool);
export default function OpenGraphGeneratorPage() {
  return <ToolPageContent tool={tool} toolComponent={<OpenGraphGeneratorTool />} />;
}
