import type { Metadata } from "next";
import { generateToolMetadata } from "@/lib/metadata";
import { getToolBySlug } from "@/lib/tools";
import ToolPageContent from "@/components/tools/ToolPageContent";
import OgImagePreviewTool from "@/components/tools/implementations/OgImagePreviewTool";

const tool = getToolBySlug("og-image-preview")!;
export const metadata: Metadata = generateToolMetadata(tool);
export default function OgImagePreviewPage() {
  return <ToolPageContent tool={tool} toolComponent={<OgImagePreviewTool />} />;
}
