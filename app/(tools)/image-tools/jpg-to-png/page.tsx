import type { Metadata } from "next";
import { generateToolMetadata } from "@/lib/metadata";
import { getToolBySlug } from "@/lib/tools";
import ToolPageContent from "@/components/tools/ToolPageContent";
import JpgPngConverterTool from "@/components/tools/implementations/JpgPngConverterTool";

const tool = getToolBySlug("jpg-to-png")!;
export const metadata: Metadata = generateToolMetadata(tool);
export default function JpgToPngPage() { return <ToolPageContent tool={tool} toolComponent={<JpgPngConverterTool />} />; }

