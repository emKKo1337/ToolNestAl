import type { Metadata } from "next";
import { generateToolMetadata } from "@/lib/metadata";
import { getToolBySlug } from "@/lib/tools";
import ToolPageContent from "@/components/tools/ToolPageContent";
import HeadingCheckerTool from "@/components/tools/implementations/HeadingCheckerTool";

const tool = getToolBySlug("heading-checker")!;
export const metadata: Metadata = generateToolMetadata(tool);
export default function HeadingCheckerPage() {
  return <ToolPageContent tool={tool} toolComponent={<HeadingCheckerTool />} />;
}
