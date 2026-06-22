import type { Metadata } from "next";
import { getCategoryBySlug, getToolsByCategory } from "@/lib/tools";
import { generateCategoryMetadata } from "@/lib/metadata";
import CategoryPageContent from "@/components/tools/CategoryPageContent";

const category = getCategoryBySlug("seo-tools")!;
const tools = getToolsByCategory("seo-tools");

export const metadata: Metadata = generateCategoryMetadata(category, tools.length);

export default function SeoToolsPage() {
  return <CategoryPageContent category={category} tools={tools} />;
}
