import type { Metadata } from "next";
import { generateToolMetadata } from "@/lib/metadata";
import { getToolBySlug } from "@/lib/tools";
import ToolPageContent from "@/components/tools/ToolPageContent";
import BrokenLinkCheckerTool from "@/components/tools/implementations/BrokenLinkCheckerTool";

const tool = getToolBySlug("broken-link-checker")!;
export const metadata: Metadata = generateToolMetadata(tool);
export default function BrokenLinkCheckerPage() {
  return <ToolPageContent tool={tool} toolComponent={<BrokenLinkCheckerTool />} />;
}
