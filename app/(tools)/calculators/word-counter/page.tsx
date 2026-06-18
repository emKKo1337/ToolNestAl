import type { Metadata } from "next";
import { generateToolMetadata } from "@/lib/metadata";
import { getToolBySlug } from "@/lib/tools";
import ToolPageContent from "@/components/tools/ToolPageContent";
import WordCounterTool from "@/components/tools/implementations/WordCounterTool";

const tool = getToolBySlug("word-counter")!;

export const metadata: Metadata = generateToolMetadata(tool);

export default function WordCounterPage() {
  return <ToolPageContent tool={tool} toolComponent={<WordCounterTool />} />;
}

