import type { Metadata } from "next";
import { getCategoryBySlug, getToolsByCategory } from "@/lib/tools";
import { generateCategoryMetadata } from "@/lib/metadata";
import CategoryPageContent from "@/components/tools/CategoryPageContent";

const category = getCategoryBySlug("image-tools")!;
const tools = getToolsByCategory("image-tools");

export const metadata: Metadata = generateCategoryMetadata(category, tools.length);

export default function ImageToolsPage() {
  return <CategoryPageContent category={category} tools={tools} />;
}
