import type { Metadata } from "next";
import { getToolBySlug } from "@/lib/tools";
import ToolPageContent from "@/components/tools/ToolPageContent";
import QrCodeGeneratorTool from "@/components/tools/implementations/QrCodeGeneratorTool";

const tool = getToolBySlug("qr-code-generator")!;

export const metadata: Metadata = {
  title: `${tool.name} | ToolNest AI`,
  description: tool.shortDescription,
  keywords: tool.keywords,
};

export default function QrCodeGeneratorPage() {
  return <ToolPageContent tool={tool} toolComponent={<QrCodeGeneratorTool />} />;
}
