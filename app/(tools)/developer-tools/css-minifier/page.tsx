import type { Metadata } from "next";
import { generateToolMetadata } from "@/lib/metadata";
import { getToolBySlug } from "@/lib/tools";
import ToolPageContent from "@/components/tools/ToolPageContent";
import CssMinifierTool from "@/components/tools/implementations/CssMinifierTool";

const tool = getToolBySlug("css-minifier")!;
export const metadata: Metadata = generateToolMetadata(tool);
export default function CssMinifierPage() { return <ToolPageContent tool={tool} toolComponent={<CssMinifierTool />} />; }

