import type { Metadata } from "next";
import { generateToolMetadata } from "@/lib/metadata";
import { getToolBySlug } from "@/lib/tools";
import ToolPageContent from "@/components/tools/ToolPageContent";
import PngToJpgTool from "@/components/tools/implementations/PngToJpgTool";

const tool = getToolBySlug("png-to-jpg")!;
export const metadata: Metadata = generateToolMetadata(tool);
export default function PngToJpgPage() { return <ToolPageContent tool={tool} toolComponent={<PngToJpgTool />} />; }
