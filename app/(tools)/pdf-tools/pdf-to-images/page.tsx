import type { Metadata } from "next";
import { getToolBySlug } from "@/lib/tools";
import ToolPageContent from "@/components/tools/ToolPageContent";
import PdfToImagesTool from "@/components/tools/implementations/PdfToImagesTool";

const tool = getToolBySlug("pdf-to-images")!;
export const metadata: Metadata = { title: `${tool.name} | ToolNest AI`, description: tool.shortDescription, keywords: tool.keywords };
export default function PdfToImagesPage() { return <ToolPageContent tool={tool} toolComponent={<PdfToImagesTool />} />; }
