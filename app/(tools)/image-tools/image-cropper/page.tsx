import type { Metadata } from "next";
import { generateToolMetadata } from "@/lib/metadata";
import { getToolBySlug } from "@/lib/tools";
import ToolPageContent from "@/components/tools/ToolPageContent";
import ImageCropperTool from "@/components/tools/implementations/ImageCropperTool";

const tool = getToolBySlug("image-cropper")!;
export const metadata: Metadata = generateToolMetadata(tool);
export default function ImageCropperPage() { return <ToolPageContent tool={tool} toolComponent={<ImageCropperTool />} />; }
