import type { Metadata } from "next";
import { generateToolMetadata } from "@/lib/metadata";
import { getToolBySlug } from "@/lib/tools";
import ToolPageContent from "@/components/tools/ToolPageContent";
import RedirectCheckerTool from "@/components/tools/implementations/RedirectCheckerTool";

const tool = getToolBySlug("redirect-checker")!;
export const metadata: Metadata = generateToolMetadata(tool);
export default function RedirectCheckerPage() {
  return <ToolPageContent tool={tool} toolComponent={<RedirectCheckerTool />} />;
}
