import type { Metadata } from "next";
import { getToolBySlug } from "@/lib/tools";
import ToolPageContent from "@/components/tools/ToolPageContent";
import WebpConverterTool from "@/components/tools/implementations/WebpConverterTool";

const tool = getToolBySlug("webp-converter")!;
export const metadata: Metadata = { title: `${tool.name} | ToolNest AI`, description: tool.shortDescription, keywords: tool.keywords };
export default function WebpConverterPage() { return <ToolPageContent tool={tool} toolComponent={<WebpConverterTool />} />; }
