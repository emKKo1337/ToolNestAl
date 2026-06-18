import type { Metadata } from "next";
import { getCategoryBySlug, getToolsByCategory } from "@/lib/tools";
import CategoryPageContent from "@/components/tools/CategoryPageContent";

const category = getCategoryBySlug("pdf-tools")!;
const tools = getToolsByCategory("pdf-tools");

export const metadata: Metadata = {
  title: ` | ToolNest AI`,
  description: category.description,
  alternates: { canonical: `https://toolnest.ai/pdf-tools` },
  openGraph: { type: `website`, url: `https://toolnest.ai/pdf-tools`, title: ` | ToolNest AI`, description: category.description },
  twitter: { card: `summary_large_image`, title: ` | ToolNest AI`, description: category.description },
};
export default function PDFToolsPage() { return <CategoryPageContent category={category} tools={tools} />; }

