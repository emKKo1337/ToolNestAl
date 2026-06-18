import type { Metadata } from "next";
import { generateToolMetadata } from "@/lib/metadata";
import { getToolBySlug } from "@/lib/tools";
import ToolPageContent from "@/components/tools/ToolPageContent";
import JsonFormatterTool from "@/components/tools/implementations/JsonFormatterTool";

const tool = getToolBySlug("json-formatter")!;
export const metadata: Metadata = generateToolMetadata(tool);
export default function JsonFormatterPage() { return <ToolPageContent tool={tool} toolComponent={<JsonFormatterTool />} />; }

