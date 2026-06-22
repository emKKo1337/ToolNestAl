import type { Metadata } from "next";
import { generateToolMetadata } from "@/lib/metadata";
import { getToolBySlug } from "@/lib/tools";
import ToolPageContent from "@/components/tools/ToolPageContent";
import ImageFiltersTool from "@/components/tools/implementations/ImageFiltersTool";

const tool = getToolBySlug("image-filters")!;
export const metadata: Metadata = generateToolMetadata(tool);
export default function ImageFiltersPage() {
  return <ToolPageContent tool={tool} toolComponent={<ImageFiltersTool />} />;
}
