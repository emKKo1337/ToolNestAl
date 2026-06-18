import type { Metadata } from "next";
import { generateToolMetadata } from "@/lib/metadata";
import { getToolBySlug } from "@/lib/tools";
import ToolPageContent from "@/components/tools/ToolPageContent";
import AgeCalculatorTool from "@/components/tools/implementations/AgeCalculatorTool";

const tool = getToolBySlug("age-calculator")!;

export const metadata: Metadata = generateToolMetadata(tool);

export default function AgeCalculatorPage() {
  return <ToolPageContent tool={tool} toolComponent={<AgeCalculatorTool />} />;
}

