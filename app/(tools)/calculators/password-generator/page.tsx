import type { Metadata } from "next";
import { getToolBySlug } from "@/lib/tools";
import ToolPageContent from "@/components/tools/ToolPageContent";
import PasswordGeneratorTool from "@/components/tools/implementations/PasswordGeneratorTool";

const tool = getToolBySlug("password-generator")!;

export const metadata: Metadata = {
  title: `${tool.name} | ToolNest AI`,
  description: tool.shortDescription,
  keywords: tool.keywords,
};

export default function PasswordGeneratorPage() {
  return <ToolPageContent tool={tool} toolComponent={<PasswordGeneratorTool />} />;
}
