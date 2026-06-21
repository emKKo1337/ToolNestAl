import type { Metadata } from "next";
import { generateToolMetadata } from "@/lib/metadata";
import { getToolBySlug } from "@/lib/tools";
import ToolPageContent from "@/components/tools/ToolPageContent";
import ImageRotatorTool from "@/components/tools/implementations/ImageRotatorTool";

const tool = getToolBySlug("image-rotator")!;
export const metadata: Metadata = generateToolMetadata(tool);
export default function ImageRotatorPage() { return <ToolPageContent tool={tool} toolComponent={<ImageRotatorTool />} />; }
