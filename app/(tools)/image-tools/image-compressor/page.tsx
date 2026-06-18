import type { Metadata } from "next";
import { generateToolMetadata } from "@/lib/metadata";
import { getToolBySlug } from "@/lib/tools";
import ToolPageContent from "@/components/tools/ToolPageContent";
import ImageCompressorTool from "@/components/tools/implementations/ImageCompressorTool";

const tool = getToolBySlug("image-compressor")!;
export const metadata: Metadata = generateToolMetadata(tool);
export default function ImageCompressorPage() { return <ToolPageContent tool={tool} toolComponent={<ImageCompressorTool />} />; }

