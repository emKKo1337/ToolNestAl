import type { Metadata } from "next";
import { generateToolMetadata } from "@/lib/metadata";
import { getToolBySlug } from "@/lib/tools";
import ToolPageContent from "@/components/tools/ToolPageContent";
import HashGeneratorTool from "@/components/tools/implementations/HashGeneratorTool";

const tool = getToolBySlug("hash-generator")!;
export const metadata: Metadata = generateToolMetadata(tool);
export default function HashGeneratorPage() { return <ToolPageContent tool={tool} toolComponent={<HashGeneratorTool />} />; }

