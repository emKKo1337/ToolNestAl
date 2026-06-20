import type { Metadata } from "next";
import { generateToolMetadata } from "@/lib/metadata";
import { getToolBySlug } from "@/lib/tools";
import ToolPageContent from "@/components/tools/ToolPageContent";
import CharacterCounterTool from "@/components/tools/implementations/CharacterCounterTool";

const tool = getToolBySlug("character-counter")!;

export const metadata: Metadata = generateToolMetadata(tool);

export default function CharacterCounterPage() {
  return <ToolPageContent tool={tool} toolComponent={<CharacterCounterTool />} />;
}
