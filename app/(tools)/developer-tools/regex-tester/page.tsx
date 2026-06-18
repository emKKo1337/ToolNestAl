import type { Metadata } from "next";
import { getToolBySlug } from "@/lib/tools";
import ToolPageContent from "@/components/tools/ToolPageContent";
import RegexTesterTool from "@/components/tools/implementations/RegexTesterTool";

const tool = getToolBySlug("regex-tester")!;
export const metadata: Metadata = { title: `${tool.name} | ToolNest AI`, description: tool.shortDescription, keywords: tool.keywords };
export default function RegexTesterPage() { return <ToolPageContent tool={tool} toolComponent={<RegexTesterTool />} />; }
