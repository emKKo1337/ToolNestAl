import type { Metadata } from "next";
import { getToolBySlug } from "@/lib/tools";
import ToolPageContent from "@/components/tools/ToolPageContent";
import TimestampConverterTool from "@/components/tools/implementations/TimestampConverterTool";

const tool = getToolBySlug("timestamp-converter")!;
export const metadata: Metadata = { title: `${tool.name} | ToolNest AI`, description: tool.shortDescription, keywords: tool.keywords };
export default function TimestampConverterPage() { return <ToolPageContent tool={tool} toolComponent={<TimestampConverterTool />} />; }
