import type { Metadata } from "next";
import { generateToolMetadata } from "@/lib/metadata";
import { getToolBySlug } from "@/lib/tools";
import ToolPageContent from "@/components/tools/ToolPageContent";
import ImageResizerTool from "@/components/tools/implementations/ImageResizerTool";

const tool = getToolBySlug("image-resizer")!;
export const metadata: Metadata = generateToolMetadata(tool);
export default function ImageResizerPage() { return <ToolPageContent tool={tool} toolComponent={<ImageResizerTool />} />; }

