import type { Metadata } from "next";
import { getCategoryBySlug, getToolsByCategory } from "@/lib/tools";
import { generateCategoryMetadata } from "@/lib/metadata";
import CategoryPageContent from "@/components/tools/CategoryPageContent";

const category = getCategoryBySlug("pdf-tools")!;
const tools = getToolsByCategory("pdf-tools");

export const metadata: Metadata = generateCategoryMetadata(category, tools.length);

export default function PDFToolsPage() {
  return <CategoryPageContent category={category} tools={tools} />;
}
