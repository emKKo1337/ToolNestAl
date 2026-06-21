import type { Metadata } from "next";
import { generateToolMetadata } from "@/lib/metadata";
import { getToolBySlug } from "@/lib/tools";
import ToolPageContent from "@/components/tools/ToolPageContent";
import ImageWatermarkTool from "@/components/tools/implementations/ImageWatermarkTool";

const tool = getToolBySlug("image-watermark")!;
export const metadata: Metadata = generateToolMetadata(tool);
export default function ImageWatermarkPage() {
  return <ToolPageContent tool={tool} toolComponent={<ImageWatermarkTool />} />;
}
