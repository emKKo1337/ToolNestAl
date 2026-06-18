import type { Metadata } from "next";
import { generateToolMetadata } from "@/lib/metadata";
import { getToolBySlug } from "@/lib/tools";
import ToolPageContent from "@/components/tools/ToolPageContent";
import MergePdfTool from "@/components/tools/implementations/MergePdfTool";

const tool = getToolBySlug("merge-pdf")!;
export const metadata: Metadata = generateToolMetadata(tool);
export default function MergePdfPage() { return <ToolPageContent tool={tool} toolComponent={<MergePdfTool />} />; }

