import type { Metadata } from "next";
import { generateToolMetadata } from "@/lib/metadata";
import { getToolBySlug } from "@/lib/tools";
import ToolPageContent from "@/components/tools/ToolPageContent";
import RemoveBackgroundTool from "@/components/tools/implementations/RemoveBackgroundTool";

const tool = getToolBySlug("remove-background")!;
export const metadata: Metadata = generateToolMetadata(tool);
export default function RemoveBackgroundPage() { return <ToolPageContent tool={tool} toolComponent={<RemoveBackgroundTool />} />; }

