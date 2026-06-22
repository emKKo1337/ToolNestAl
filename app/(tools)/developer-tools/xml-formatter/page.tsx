import type { Metadata } from "next";
import { generateToolMetadata } from "@/lib/metadata";
import { getToolBySlug } from "@/lib/tools";
import ToolPageContent from "@/components/tools/ToolPageContent";
import XmlFormatterTool from "@/components/tools/implementations/XmlFormatterTool";

const tool = getToolBySlug("xml-formatter")!;
export const metadata: Metadata = generateToolMetadata(tool);
export default function XmlFormatterPage() {
  return <ToolPageContent tool={tool} toolComponent={<XmlFormatterTool />} />;
}
