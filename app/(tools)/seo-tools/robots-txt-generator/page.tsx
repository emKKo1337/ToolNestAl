import type { Metadata } from "next";
import { generateToolMetadata } from "@/lib/metadata";
import { getToolBySlug } from "@/lib/tools";
import ToolPageContent from "@/components/tools/ToolPageContent";
import RobotsTxtGeneratorTool from "@/components/tools/implementations/RobotsTxtGeneratorTool";

const tool = getToolBySlug("robots-txt-generator")!;
export const metadata: Metadata = generateToolMetadata(tool);
export default function RobotsTxtGeneratorPage() {
  return <ToolPageContent tool={tool} toolComponent={<RobotsTxtGeneratorTool />} />;
}
