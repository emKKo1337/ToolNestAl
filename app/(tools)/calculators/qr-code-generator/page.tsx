import type { Metadata } from "next";
import { generateToolMetadata } from "@/lib/metadata";
import { getToolBySlug } from "@/lib/tools";
import ToolPageContent from "@/components/tools/ToolPageContent";
import QrCodeGeneratorTool from "@/components/tools/implementations/QrCodeGeneratorTool";

const tool = getToolBySlug("qr-code-generator")!;

export const metadata: Metadata = generateToolMetadata(tool);

export default function QrCodeGeneratorPage() {
  return <ToolPageContent tool={tool} toolComponent={<QrCodeGeneratorTool />} />;
}

