import type { Metadata } from "next";
import { generateToolMetadata } from "@/lib/metadata";
import { getToolBySlug } from "@/lib/tools";
import ToolPageContent from "@/components/tools/ToolPageContent";
import ImageBlurTool from "@/components/tools/implementations/ImageBlurTool";

const tool = getToolBySlug("image-blur")!;
export const metadata: Metadata = generateToolMetadata(tool);
export default function ImageBlurPage() {
  return <ToolPageContent tool={tool} toolComponent={<ImageBlurTool />} />;
}
