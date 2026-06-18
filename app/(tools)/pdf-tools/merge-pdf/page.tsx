import type { Metadata } from "next";
import { getToolBySlug } from "@/lib/tools";
import ToolPageContent from "@/components/tools/ToolPageContent";
import MergePdfTool from "@/components/tools/implementations/MergePdfTool";

const tool = getToolBySlug("merge-pdf")!;
export const metadata: Metadata = { title: `${tool.name} | ToolNest AI`, description: tool.shortDescription, keywords: tool.keywords };
export default function MergePdfPage() { return <ToolPageContent tool={tool} toolComponent={<MergePdfTool />} />; }
