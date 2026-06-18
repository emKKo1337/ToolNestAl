import type { Metadata } from "next";
import { generateToolMetadata } from "@/lib/metadata";
import { getToolBySlug } from "@/lib/tools";
import ToolPageContent from "@/components/tools/ToolPageContent";
import UrlEncoderTool from "@/components/tools/implementations/UrlEncoderTool";

const tool = getToolBySlug("url-encoder")!;
export const metadata: Metadata = generateToolMetadata(tool);
export default function UrlEncoderPage() { return <ToolPageContent tool={tool} toolComponent={<UrlEncoderTool />} />; }

