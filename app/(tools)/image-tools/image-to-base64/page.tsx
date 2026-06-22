import type { Metadata } from "next";
import { generateToolMetadata } from "@/lib/metadata";
import { getToolBySlug } from "@/lib/tools";
import ToolPageContent from "@/components/tools/ToolPageContent";
import ImageToBase64Tool from "@/components/tools/implementations/ImageToBase64Tool";

const tool = getToolBySlug("image-to-base64")!;
export const metadata: Metadata = generateToolMetadata(tool);
export default function ImageToBase64Page() {
  return <ToolPageContent tool={tool} toolComponent={<ImageToBase64Tool />} />;
}
