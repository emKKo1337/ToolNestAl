import type { Metadata } from "next";
import { generateToolMetadata } from "@/lib/metadata";
import { getToolBySlug } from "@/lib/tools";
import ToolPageContent from "@/components/tools/ToolPageContent";
import ImageColorPickerTool from "@/components/tools/implementations/ImageColorPickerTool";

const tool = getToolBySlug("image-color-picker")!;
export const metadata: Metadata = generateToolMetadata(tool);
export default function ImageColorPickerPage() {
  return <ToolPageContent tool={tool} toolComponent={<ImageColorPickerTool />} />;
}
