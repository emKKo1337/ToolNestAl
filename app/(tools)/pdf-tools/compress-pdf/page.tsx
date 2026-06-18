import type { Metadata } from "next";
import { generateToolMetadata } from "@/lib/metadata";
import { getToolBySlug } from "@/lib/tools";
import ToolPageContent from "@/components/tools/ToolPageContent";
import CompressPdfTool from "@/components/tools/implementations/CompressPdfTool";

const tool = getToolBySlug("compress-pdf")!;
export const metadata: Metadata = generateToolMetadata(tool);
export default function CompressPdfPage() { return <ToolPageContent tool={tool} toolComponent={<CompressPdfTool />} />; }

