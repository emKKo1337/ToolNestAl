import type { Metadata } from "next";
import { generateToolMetadata } from "@/lib/metadata";
import { getToolBySlug } from "@/lib/tools";
import ToolPageContent from "@/components/tools/ToolPageContent";
import ImageConverterTool from "@/components/tools/implementations/ImageConverterTool";

const tool = getToolBySlug("image-converter")!;
export const metadata: Metadata = generateToolMetadata(tool);
export default function ImageConverterPage() { return <ToolPageContent tool={tool} toolComponent={<ImageConverterTool />} />; }
