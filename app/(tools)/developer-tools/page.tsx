import type { Metadata } from "next";
import { getCategoryBySlug, getToolsByCategory } from "@/lib/tools";
import { generateCategoryMetadata } from "@/lib/metadata";
import CategoryPageContent from "@/components/tools/CategoryPageContent";

const category = getCategoryBySlug("developer-tools")!;
const tools = getToolsByCategory("developer-tools");

export const metadata: Metadata = generateCategoryMetadata(category, tools.length);

export default function DeveloperToolsPage() {
  return <CategoryPageContent category={category} tools={tools} />;
}
