import type { Metadata } from "next";
import { generateToolMetadata } from "@/lib/metadata";
import { getToolBySlug } from "@/lib/tools";
import ToolPageContent from "@/components/tools/ToolPageContent";

const tool = getToolBySlug("ai-email-writer")!;
export const metadata: Metadata = generateToolMetadata(tool);
export default function AiEmailWriterPage() { return <ToolPageContent tool={tool} />; }

