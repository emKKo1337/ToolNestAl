import type { Metadata } from "next";
import { getToolBySlug } from "@/lib/tools";
import ToolPageContent from "@/components/tools/ToolPageContent";
import BmiCalculatorTool from "@/components/tools/implementations/BmiCalculatorTool";

const tool = getToolBySlug("bmi-calculator")!;

export const metadata: Metadata = {
  title: `${tool.name} | ToolNest AI`,
  description: tool.shortDescription,
  keywords: tool.keywords,
};

export default function BmiCalculatorPage() {
  return <ToolPageContent tool={tool} toolComponent={<BmiCalculatorTool />} />;
}
