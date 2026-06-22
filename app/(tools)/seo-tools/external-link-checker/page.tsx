import type { Metadata } from "next";
import { generateToolMetadata } from "@/lib/metadata";
import { getToolBySlug } from "@/lib/tools";
import ToolPageContent from "@/components/tools/ToolPageContent";
import ExternalLinkCheckerTool from "@/components/tools/implementations/ExternalLinkCheckerTool";

const tool = getToolBySlug("external-link-checker")!;
export const metadata: Metadata = generateToolMetadata(tool);
export default function ExternalLinkCheckerPage() {
  return <ToolPageContent tool={tool} toolComponent={<ExternalLinkCheckerTool />} />;
}
