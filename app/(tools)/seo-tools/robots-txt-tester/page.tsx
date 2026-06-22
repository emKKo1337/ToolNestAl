import type { Metadata } from "next";
import { generateToolMetadata } from "@/lib/metadata";
import { getToolBySlug } from "@/lib/tools";
import ToolPageContent from "@/components/tools/ToolPageContent";
import RobotsTxtTesterTool from "@/components/tools/implementations/RobotsTxtTesterTool";

const tool = getToolBySlug("robots-txt-tester")!;
export const metadata: Metadata = generateToolMetadata(tool);
export default function RobotsTxtTesterPage() {
  return <ToolPageContent tool={tool} toolComponent={<RobotsTxtTesterTool />} />;
}
