import type { Metadata } from "next";
import { getToolBySlug } from "@/lib/tools";
import ToolPageContent from "@/components/tools/ToolPageContent";
import JpgPngConverterTool from "@/components/tools/implementations/JpgPngConverterTool";

const tool = getToolBySlug("jpg-to-png")!;
export const metadata: Metadata = { title: `${tool.name} | ToolNest AI`, description: tool.shortDescription, keywords: tool.keywords };
export default function JpgToPngPage() { return <ToolPageContent tool={tool} toolComponent={<JpgPngConverterTool />} />; }
