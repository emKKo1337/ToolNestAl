import type { Metadata } from "next";
import { generateToolMetadata } from "@/lib/metadata";
import { getToolBySlug } from "@/lib/tools";
import ToolPageContent from "@/components/tools/ToolPageContent";

const tool = getToolBySlug("ai-resume-builder")!;
export const metadata: Metadata = generateToolMetadata(tool);
export default function AiResumeBuilderPage() { return <ToolPageContent tool={tool} />; }

