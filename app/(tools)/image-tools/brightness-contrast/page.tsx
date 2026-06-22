import type { Metadata } from "next";
import { generateToolMetadata } from "@/lib/metadata";
import { getToolBySlug } from "@/lib/tools";
import ToolPageContent from "@/components/tools/ToolPageContent";
import BrightnessContrastTool from "@/components/tools/implementations/BrightnessContrastTool";

const tool = getToolBySlug("brightness-contrast")!;
export const metadata: Metadata = generateToolMetadata(tool);
export default function BrightnessContrastPage() {
  return <ToolPageContent tool={tool} toolComponent={<BrightnessContrastTool />} />;
}
