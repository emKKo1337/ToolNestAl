import type { Metadata } from "next";
import { getCategoryBySlug, getToolsByCategory } from "@/lib/tools";
import { generateCategoryMetadata } from "@/lib/metadata";
import CategoryPageContent from "@/components/tools/CategoryPageContent";

const category = getCategoryBySlug("calculators")!;
const tools = getToolsByCategory("calculators");

export const metadata: Metadata = generateCategoryMetadata(category, tools.length);

export default function CalculatorsPage() {
  return <CategoryPageContent category={category} tools={tools} />;
}
