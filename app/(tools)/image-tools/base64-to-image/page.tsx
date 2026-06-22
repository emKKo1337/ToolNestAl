import type { Metadata } from "next";
import { generateToolMetadata } from "@/lib/metadata";
import { getToolBySlug } from "@/lib/tools";
import ToolPageContent from "@/components/tools/ToolPageContent";
import Base64ToImageTool from "@/components/tools/implementations/Base64ToImageTool";

const tool = getToolBySlug("base64-to-image")!;
export const metadata: Metadata = generateToolMetadata(tool);
export default function Base64ToImagePage() {
  return <ToolPageContent tool={tool} toolComponent={<Base64ToImageTool />} />;
}
