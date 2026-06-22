import type { Metadata } from "next";
import { generateToolMetadata } from "@/lib/metadata";
import { getToolBySlug } from "@/lib/tools";
import ToolPageContent from "@/components/tools/ToolPageContent";
import HttpHeaderCheckerTool from "@/components/tools/implementations/HttpHeaderCheckerTool";

const tool = getToolBySlug("http-header-checker")!;
export const metadata: Metadata = generateToolMetadata(tool);
export default function HttpHeaderCheckerPage() {
  return <ToolPageContent tool={tool} toolComponent={<HttpHeaderCheckerTool />} />;
}
