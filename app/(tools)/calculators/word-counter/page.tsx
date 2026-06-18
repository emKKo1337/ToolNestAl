import type { Metadata } from "next";
import { getToolBySlug } from "@/lib/tools";
import ToolPageContent from "@/components/tools/ToolPageContent";
import WordCounterTool from "@/components/tools/implementations/WordCounterTool";

const tool = getToolBySlug("word-counter")!;

export const metadata: Metadata = {
  title: `${tool.name} | ToolNest AI`,
  description: tool.shortDescription,
  keywords: tool.keywords,
};

export default function WordCounterPage() {
  return <ToolPageContent tool={tool} toolComponent={<WordCounterTool />} />;
}
