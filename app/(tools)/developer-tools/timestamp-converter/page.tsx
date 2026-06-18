import type { Metadata } from "next";
import { generateToolMetadata } from "@/lib/metadata";
import { getToolBySlug } from "@/lib/tools";
import ToolPageContent from "@/components/tools/ToolPageContent";
import TimestampConverterTool from "@/components/tools/implementations/TimestampConverterTool";

const tool = getToolBySlug("timestamp-converter")!;
export const metadata: Metadata = generateToolMetadata(tool);
export default function TimestampConverterPage() { return <ToolPageContent tool={tool} toolComponent={<TimestampConverterTool />} />; }

