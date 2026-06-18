import type { Metadata } from "next";
import { getToolBySlug } from "@/lib/tools";
import ToolPageContent from "@/components/tools/ToolPageContent";
import AgeCalculatorTool from "@/components/tools/implementations/AgeCalculatorTool";

const tool = getToolBySlug("age-calculator")!;

export const metadata: Metadata = {
  title: `${tool.name} | ToolNest AI`,
  description: tool.shortDescription,
  keywords: tool.keywords,
};

export default function AgeCalculatorPage() {
  return <ToolPageContent tool={tool} toolComponent={<AgeCalculatorTool />} />;
}
