import type { Metadata } from "next";
import { getToolBySlug } from "@/lib/tools";
import ToolPageContent from "@/components/tools/ToolPageContent";
import RemoveBackgroundTool from "@/components/tools/implementations/RemoveBackgroundTool";

const tool = getToolBySlug("remove-background")!;
export const metadata: Metadata = { title: `${tool.name} | ToolNest AI`, description: tool.shortDescription, keywords: tool.keywords };
export default function RemoveBackgroundPage() { return <ToolPageContent tool={tool} toolComponent={<RemoveBackgroundTool />} />; }
