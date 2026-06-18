import type { Metadata } from "next";
import { generateToolMetadata } from "@/lib/metadata";
import { getToolBySlug } from "@/lib/tools";
import ToolPageContent from "@/components/tools/ToolPageContent";
import JwtDecoderTool from "@/components/tools/implementations/JwtDecoderTool";

const tool = getToolBySlug("jwt-decoder")!;
export const metadata: Metadata = generateToolMetadata(tool);
export default function JwtDecoderPage() { return <ToolPageContent tool={tool} toolComponent={<JwtDecoderTool />} />; }

