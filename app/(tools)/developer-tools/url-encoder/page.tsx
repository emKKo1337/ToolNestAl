import type { Metadata } from "next";
import { getToolBySlug } from "@/lib/tools";
import ToolPageContent from "@/components/tools/ToolPageContent";
import UrlEncoderTool from "@/components/tools/implementations/UrlEncoderTool";

const tool = getToolBySlug("url-encoder")!;
export const metadata: Metadata = { title: `${tool.name} | ToolNest AI`, description: tool.shortDescription, keywords: tool.keywords };
export default function UrlEncoderPage() { return <ToolPageContent tool={tool} toolComponent={<UrlEncoderTool />} />; }
