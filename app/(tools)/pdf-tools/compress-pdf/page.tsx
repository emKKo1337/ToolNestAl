import type { Metadata } from "next";
import { getToolBySlug } from "@/lib/tools";
import ToolPageContent from "@/components/tools/ToolPageContent";
import CompressPdfTool from "@/components/tools/implementations/CompressPdfTool";

const tool = getToolBySlug("compress-pdf")!;
export const metadata: Metadata = { title: `${tool.name} | ToolNest AI`, description: tool.shortDescription, keywords: tool.keywords };
export default function CompressPdfPage() { return <ToolPageContent tool={tool} toolComponent={<CompressPdfTool />} />; }
