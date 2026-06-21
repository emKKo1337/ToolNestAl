import type { Metadata } from "next";
import { generateToolMetadata } from "@/lib/metadata";
import { getToolBySlug } from "@/lib/tools";
import ToolPageContent from "@/components/tools/ToolPageContent";
import WordToPdfTool from "@/components/tools/implementations/WordToPdfTool";

const tool = getToolBySlug("word-to-pdf")!;
export const metadata: Metadata = generateToolMetadata(tool);
export default function WordToPdfPage() {
  return <ToolPageContent tool={tool} toolComponent={<WordToPdfTool />} />;
}
