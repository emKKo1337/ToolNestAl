import type { Metadata } from "next";
import { generateToolMetadata } from "@/lib/metadata";
import { getToolBySlug } from "@/lib/tools";
import ToolPageContent from "@/components/tools/ToolPageContent";
import CanonicalUrlGeneratorTool from "@/components/tools/implementations/CanonicalUrlGeneratorTool";

const tool = getToolBySlug("canonical-url-generator")!;
export const metadata: Metadata = generateToolMetadata(tool);
export default function CanonicalUrlGeneratorPage() {
  return <ToolPageContent tool={tool} toolComponent={<CanonicalUrlGeneratorTool />} />;
}
