import type { Metadata } from "next";
import { generateToolMetadata } from "@/lib/metadata";
import { getToolBySlug } from "@/lib/tools";
import ToolPageContent from "@/components/tools/ToolPageContent";
import XmlValidatorTool from "@/components/tools/implementations/XmlValidatorTool";

const tool = getToolBySlug("xml-validator")!;
export const metadata: Metadata = generateToolMetadata(tool);
export default function XmlValidatorPage() {
  return <ToolPageContent tool={tool} toolComponent={<XmlValidatorTool />} />;
}
