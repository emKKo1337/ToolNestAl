import type { Metadata } from "next";
import { getCategoryBySlug, getToolsByCategory } from "@/lib/tools";
import { generateCategoryMetadata } from "@/lib/metadata";
import CategoryPageContent from "@/components/tools/CategoryPageContent";

const category = getCategoryBySlug("text-tools")!;
const tools = getToolsByCategory("text-tools");

export const metadata: Metadata = generateCategoryMetadata(category, tools.length);

export default function TextToolsPage() {
  return <CategoryPageContent category={category} tools={tools} />;
}
