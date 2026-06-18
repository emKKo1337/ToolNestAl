import type { Metadata } from "next";
import { getToolBySlug } from "@/lib/tools";
import ToolPageContent from "@/components/tools/ToolPageContent";
import ImageToPdfTool from "@/components/tools/implementations/ImageToPdfTool";

const tool = getToolBySlug("image-to-pdf")!;
export const metadata: Metadata = { title: `${tool.name} | ToolNest AI`, description: tool.shortDescription, keywords: tool.keywords };
export default function ImageToPdfPage() { return <ToolPageContent tool={tool} toolComponent={<ImageToPdfTool />} />; }
