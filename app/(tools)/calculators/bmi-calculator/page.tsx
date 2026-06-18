import type { Metadata } from "next";
import { generateToolMetadata } from "@/lib/metadata";
import { getToolBySlug } from "@/lib/tools";
import ToolPageContent from "@/components/tools/ToolPageContent";
import BmiCalculatorTool from "@/components/tools/implementations/BmiCalculatorTool";

const tool = getToolBySlug("bmi-calculator")!;

export const metadata: Metadata = generateToolMetadata(tool);

export default function BmiCalculatorPage() {
  return <ToolPageContent tool={tool} toolComponent={<BmiCalculatorTool />} />;
}

