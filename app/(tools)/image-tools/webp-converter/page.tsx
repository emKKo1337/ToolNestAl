import type { Metadata } from "next";
import { generateToolMetadata } from "@/lib/metadata";
import { getToolBySlug } from "@/lib/tools";
import ToolPageContent from "@/components/tools/ToolPageContent";
import WebpConverterTool from "@/components/tools/implementations/WebpConverterTool";

const tool = getToolBySlug("webp-converter")!;
export const metadata: Metadata = generateToolMetadata(tool);
export default function WebpConverterPage() { return <ToolPageContent tool={tool} toolComponent={<WebpConverterTool />} />; }

