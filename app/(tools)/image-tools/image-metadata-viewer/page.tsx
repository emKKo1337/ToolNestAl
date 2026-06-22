import type { Metadata } from "next";
import { generateToolMetadata } from "@/lib/metadata";
import { getToolBySlug } from "@/lib/tools";
import ToolPageContent from "@/components/tools/ToolPageContent";
import ImageMetadataViewerTool from "@/components/tools/implementations/ImageMetadataViewerTool";

const tool = getToolBySlug("image-metadata-viewer")!;
export const metadata: Metadata = generateToolMetadata(tool);
export default function ImageMetadataViewerPage() {
  return <ToolPageContent tool={tool} toolComponent={<ImageMetadataViewerTool />} />;
}
