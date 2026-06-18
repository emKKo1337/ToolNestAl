import type { Metadata } from "next";
import { getToolBySlug } from "@/lib/tools";
import ToolPageContent from "@/components/tools/ToolPageContent";
import JwtDecoderTool from "@/components/tools/implementations/JwtDecoderTool";

const tool = getToolBySlug("jwt-decoder")!;
export const metadata: Metadata = { title: `${tool.name} | ToolNest AI`, description: tool.shortDescription, keywords: tool.keywords };
export default function JwtDecoderPage() { return <ToolPageContent tool={tool} toolComponent={<JwtDecoderTool />} />; }
