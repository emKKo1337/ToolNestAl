import type { Metadata } from "next";
import { generateToolMetadata } from "@/lib/metadata";
import { getToolBySlug } from "@/lib/tools";
import ToolPageContent from "@/components/tools/ToolPageContent";
import PdfToImagesTool from "@/components/tools/implementations/PdfToImagesTool";

const tool = getToolBySlug("pdf-to-images")!;
export const metadata: Metadata = generateToolMetadata(tool);
export default function PdfToImagesPage() { return <ToolPageContent tool={tool} toolComponent={<PdfToImagesTool />} />; }

