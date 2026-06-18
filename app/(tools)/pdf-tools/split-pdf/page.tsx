import type { Metadata } from "next";
import { getToolBySlug } from "@/lib/tools";
import ToolPageContent from "@/components/tools/ToolPageContent";
import SplitPdfTool from "@/components/tools/implementations/SplitPdfTool";

const tool = getToolBySlug("split-pdf")!;
export const metadata: Metadata = { title: `${tool.name} | ToolNest AI`, description: tool.shortDescription, keywords: tool.keywords };
export default function SplitPdfPage() { return <ToolPageContent tool={tool} toolComponent={<SplitPdfTool />} />; }
