import type { Metadata } from "next";
import { generateToolMetadata } from "@/lib/metadata";
import { getToolBySlug } from "@/lib/tools";
import ToolPageContent from "@/components/tools/ToolPageContent";
import SchemaExtractorTool from "@/components/tools/implementations/SchemaExtractorTool";

const tool = getToolBySlug("schema-extractor")!;
export const metadata: Metadata = generateToolMetadata(tool);
export default function SchemaExtractorPage() {
  return <ToolPageContent tool={tool} toolComponent={<SchemaExtractorTool />} />;
}
