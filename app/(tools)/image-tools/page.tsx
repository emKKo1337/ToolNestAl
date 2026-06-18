import type { Metadata } from "next";
import { getCategoryBySlug, getToolsByCategory } from "@/lib/tools";
import CategoryPageContent from "@/components/tools/CategoryPageContent";

const category = getCategoryBySlug("image-tools")!;
const tools = getToolsByCategory("image-tools");

export const metadata: Metadata = {
  title: ` | ToolNest AI`,
  description: category.description,
  alternates: { canonical: `https://toolnest.ai/image-tools` },
  openGraph: { type: `website`, url: `https://toolnest.ai/image-tools`, title: ` | ToolNest AI`, description: category.description },
  twitter: { card: `summary_large_image`, title: ` | ToolNest AI`, description: category.description },
};
export default function ImageToolsPage() { return <CategoryPageContent category={category} tools={tools} />; }

