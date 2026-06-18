import type { Metadata } from "next";
import { getToolBySlug } from "@/lib/tools";
import ToolPageContent from "@/components/tools/ToolPageContent";
import JsonFormatterTool from "@/components/tools/implementations/JsonFormatterTool";

const tool = getToolBySlug("json-formatter")!;
export const metadata: Metadata = { title: `${tool.name} | ToolNest AI`, description: tool.shortDescription, keywords: tool.keywords };
export default function JsonFormatterPage() { return <ToolPageContent tool={tool} toolComponent={<JsonFormatterTool />} />; }
