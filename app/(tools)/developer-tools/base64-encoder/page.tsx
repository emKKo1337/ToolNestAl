import type { Metadata } from "next";
import { generateToolMetadata } from "@/lib/metadata";
import { getToolBySlug } from "@/lib/tools";
import ToolPageContent from "@/components/tools/ToolPageContent";
import Base64Tool from "@/components/tools/implementations/Base64Tool";

const tool = getToolBySlug("base64-encoder")!;
export const metadata: Metadata = generateToolMetadata(tool);
export default function Base64EncoderPage() { return <ToolPageContent tool={tool} toolComponent={<Base64Tool />} />; }

