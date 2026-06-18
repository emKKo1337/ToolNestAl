import type { Metadata } from "next";
import { getToolBySlug } from "@/lib/tools";
import ToolPageContent from "@/components/tools/ToolPageContent";

const tool = getToolBySlug("ai-text-summarizer")!;
export const metadata: Metadata = { title: `${tool.name} | ToolNest AI`, description: tool.shortDescription, keywords: tool.keywords };
export default function AiTextSummarizerPage() { return <ToolPageContent tool={tool} />; }
