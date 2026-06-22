import type { Metadata } from "next";
import { generateToolMetadata } from "@/lib/metadata";
import { getToolBySlug } from "@/lib/tools";
import ToolPageContent from "@/components/tools/ToolPageContent";
import SchemaValidatorTool from "@/components/tools/implementations/SchemaValidatorTool";

const tool = getToolBySlug("schema-validator")!;
export const metadata: Metadata = generateToolMetadata(tool);
export default function SchemaValidatorPage() {
  return <ToolPageContent tool={tool} toolComponent={<SchemaValidatorTool />} />;
}
