import type { Metadata } from "next";
import { generateToolMetadata } from "@/lib/metadata";
import { getToolBySlug } from "@/lib/tools";
import ToolPageContent from "@/components/tools/ToolPageContent";
import JsonYamlConverterTool from "@/components/tools/implementations/JsonYamlConverterTool";

const tool = getToolBySlug("json-yaml-converter")!;
export const metadata: Metadata = generateToolMetadata(tool);
export default function JsonYamlConverterPage() {
  return <ToolPageContent tool={tool} toolComponent={<JsonYamlConverterTool />} />;
}
