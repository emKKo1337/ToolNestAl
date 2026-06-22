import type { Metadata } from "next";
import { generateToolMetadata } from "@/lib/metadata";
import { getToolBySlug } from "@/lib/tools";
import ToolPageContent from "@/components/tools/ToolPageContent";
import RemoveImageMetadataTool from "@/components/tools/implementations/RemoveImageMetadataTool";

const tool = getToolBySlug("remove-image-metadata")!;
export const metadata: Metadata = generateToolMetadata(tool);
export default function RemoveImageMetadataPage() {
  return <ToolPageContent tool={tool} toolComponent={<RemoveImageMetadataTool />} />;
}
