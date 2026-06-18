import type { Metadata } from "next";
import { getToolBySlug } from "@/lib/tools";
import ToolPageContent from "@/components/tools/ToolPageContent";
import HtmlMinifierTool from "@/components/tools/implementations/HtmlMinifierTool";

const tool = getToolBySlug("html-minifier")!;
export const metadata: Metadata = { title: `${tool.name} | ToolNest AI`, description: tool.shortDescription, keywords: tool.keywords };
export default function HtmlMinifierPage() { return <ToolPageContent tool={tool} toolComponent={<HtmlMinifierTool />} />; }
