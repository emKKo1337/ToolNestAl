import type { Metadata } from "next";
import { generateToolMetadata } from "@/lib/metadata";
import { getToolBySlug } from "@/lib/tools";
import ToolPageContent from "@/components/tools/ToolPageContent";
import HtmlMinifierTool from "@/components/tools/implementations/HtmlMinifierTool";

const tool = getToolBySlug("html-minifier")!;
export const metadata: Metadata = generateToolMetadata(tool);
export default function HtmlMinifierPage() { return <ToolPageContent tool={tool} toolComponent={<HtmlMinifierTool />} />; }

