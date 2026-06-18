import type { Metadata } from "next";
import { getToolBySlug } from "@/lib/tools";
import ToolPageContent from "@/components/tools/ToolPageContent";
import UuidGeneratorTool from "@/components/tools/implementations/UuidGeneratorTool";

const tool = getToolBySlug("uuid-generator")!;
export const metadata: Metadata = { title: `${tool.name} | ToolNest AI`, description: tool.shortDescription, keywords: tool.keywords };
export default function UuidGeneratorPage() { return <ToolPageContent tool={tool} toolComponent={<UuidGeneratorTool />} />; }
