import type { Metadata } from "next";
import { getToolBySlug } from "@/lib/tools";
import ToolPageContent from "@/components/tools/ToolPageContent";

const tool = getToolBySlug("ai-chat")!;
export const metadata: Metadata = { title: `${tool.name} | ToolNest AI`, description: tool.shortDescription, keywords: tool.keywords };
export default function AiChatPage() { return <ToolPageContent tool={tool} />; }
