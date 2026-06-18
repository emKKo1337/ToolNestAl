import type { Metadata } from "next";
import { generateToolMetadata } from "@/lib/metadata";
import { getToolBySlug } from "@/lib/tools";
import ToolPageContent from "@/components/tools/ToolPageContent";
import PasswordGeneratorTool from "@/components/tools/implementations/PasswordGeneratorTool";

const tool = getToolBySlug("password-generator")!;

export const metadata: Metadata = generateToolMetadata(tool);

export default function PasswordGeneratorPage() {
  return <ToolPageContent tool={tool} toolComponent={<PasswordGeneratorTool />} />;
}

