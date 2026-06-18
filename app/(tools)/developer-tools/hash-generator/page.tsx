import type { Metadata } from "next";
import { getToolBySlug } from "@/lib/tools";
import ToolPageContent from "@/components/tools/ToolPageContent";
import HashGeneratorTool from "@/components/tools/implementations/HashGeneratorTool";

const tool = getToolBySlug("hash-generator")!;
export const metadata: Metadata = { title: `${tool.name} | ToolNest AI`, description: tool.shortDescription, keywords: tool.keywords };
export default function HashGeneratorPage() { return <ToolPageContent tool={tool} toolComponent={<HashGeneratorTool />} />; }
