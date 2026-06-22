import type { Metadata } from "next";
import { generateToolMetadata } from "@/lib/metadata";
import { getToolBySlug } from "@/lib/tools";
import ToolPageContent from "@/components/tools/ToolPageContent";
import SqlFormatterTool from "@/components/tools/implementations/SqlFormatterTool";

const tool = getToolBySlug("sql-formatter")!;
export const metadata: Metadata = generateToolMetadata(tool);
export default function SqlFormatterPage() {
  return <ToolPageContent tool={tool} toolComponent={<SqlFormatterTool />} />;
}
