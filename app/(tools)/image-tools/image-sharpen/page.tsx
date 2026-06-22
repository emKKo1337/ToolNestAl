import type { Metadata } from "next";
import { generateToolMetadata } from "@/lib/metadata";
import { getToolBySlug } from "@/lib/tools";
import ToolPageContent from "@/components/tools/ToolPageContent";
import ImageSharpenTool from "@/components/tools/implementations/ImageSharpenTool";

const tool = getToolBySlug("image-sharpen")!;
export const metadata: Metadata = generateToolMetadata(tool);
export default function ImageSharpenPage() {
  return <ToolPageContent tool={tool} toolComponent={<ImageSharpenTool />} />;
}
