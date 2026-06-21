import type { Metadata } from "next";
import { generateToolMetadata } from "@/lib/metadata";
import { getToolBySlug } from "@/lib/tools";
import ToolPageContent from "@/components/tools/ToolPageContent";
import PdfToWordTool from "@/components/tools/implementations/PdfToWordTool";

const tool = getToolBySlug("pdf-to-word")!;
export const metadata: Metadata = generateToolMetadata(tool);
export default function PdfToWordPage() {
  return <ToolPageContent tool={tool} toolComponent={<PdfToWordTool />} />;
}
