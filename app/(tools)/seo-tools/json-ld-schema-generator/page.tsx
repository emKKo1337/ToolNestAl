import type { Metadata } from "next";
import { generateToolMetadata } from "@/lib/metadata";
import { getToolBySlug } from "@/lib/tools";
import ToolPageContent from "@/components/tools/ToolPageContent";
import JsonLdSchemaGeneratorTool from "@/components/tools/implementations/JsonLdSchemaGeneratorTool";

const tool = getToolBySlug("json-ld-schema-generator")!;
export const metadata: Metadata = generateToolMetadata(tool);
export default function JsonLdSchemaGeneratorPage() {
  return <ToolPageContent tool={tool} toolComponent={<JsonLdSchemaGeneratorTool />} />;
}
