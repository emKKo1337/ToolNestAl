import type { Metadata } from "next";
import { generateToolMetadata } from "@/lib/metadata";
import { getToolBySlug } from "@/lib/tools";
import ToolPageContent from "@/components/tools/ToolPageContent";
import RegexTesterTool from "@/components/tools/implementations/RegexTesterTool";

const tool = getToolBySlug("regex-tester")!;
export const metadata: Metadata = generateToolMetadata(tool);
export default function RegexTesterPage() { return <ToolPageContent tool={tool} toolComponent={<RegexTesterTool />} />; }

