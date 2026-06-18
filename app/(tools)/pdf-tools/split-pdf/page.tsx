import type { Metadata } from "next";
import { generateToolMetadata } from "@/lib/metadata";
import { getToolBySlug } from "@/lib/tools";
import ToolPageContent from "@/components/tools/ToolPageContent";
import SplitPdfTool from "@/components/tools/implementations/SplitPdfTool";

const tool = getToolBySlug("split-pdf")!;
export const metadata: Metadata = generateToolMetadata(tool);
export default function SplitPdfPage() { return <ToolPageContent tool={tool} toolComponent={<SplitPdfTool />} />; }

