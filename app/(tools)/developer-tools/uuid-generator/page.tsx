import type { Metadata } from "next";
import { generateToolMetadata } from "@/lib/metadata";
import { getToolBySlug } from "@/lib/tools";
import ToolPageContent from "@/components/tools/ToolPageContent";
import UuidGeneratorTool from "@/components/tools/implementations/UuidGeneratorTool";

const tool = getToolBySlug("uuid-generator")!;
export const metadata: Metadata = generateToolMetadata(tool);
export default function UuidGeneratorPage() { return <ToolPageContent tool={tool} toolComponent={<UuidGeneratorTool />} />; }

