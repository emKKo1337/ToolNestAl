import type { Metadata } from "next";
import { generateToolMetadata } from "@/lib/metadata";
import { getToolBySlug } from "@/lib/tools";
import ToolPageContent from "@/components/tools/ToolPageContent";
import ImageToPdfTool from "@/components/tools/implementations/ImageToPdfTool";

const tool = getToolBySlug("image-to-pdf")!;
export const metadata: Metadata = generateToolMetadata(tool);
export default function ImageToPdfPage() { return <ToolPageContent tool={tool} toolComponent={<ImageToPdfTool />} />; }

