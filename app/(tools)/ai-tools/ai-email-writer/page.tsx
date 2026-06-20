import type { Metadata } from "next";
import { generateToolMetadata } from "@/lib/metadata";
import { getToolBySlug } from "@/lib/tools";
import ToolPageContent from "@/components/tools/ToolPageContent";
import AiEmailWriterTool from "@/components/tools/implementations/AiEmailWriterTool";

const tool = getToolBySlug("ai-email-writer")!;

export const metadata: Metadata = generateToolMetadata(tool);

export default function AiEmailWriterPage() {
  return <ToolPageContent tool={tool} toolComponent={<AiEmailWriterTool />} />;
}

