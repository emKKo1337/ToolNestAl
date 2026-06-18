import type { Metadata } from "next";
import { getCategoryBySlug, getToolsByCategory } from "@/lib/tools";
import CategoryPageContent from "@/components/tools/CategoryPageContent";

const category = getCategoryBySlug("ai-tools")!;
const tools = getToolsByCategory("ai-tools");

export const metadata: Metadata = {
  title: ` | ToolNest AI`,
  description: category.description,
  alternates: { canonical: `https://toolnest.ai/ai-tools` },
  openGraph: { type: `website`, url: `https://toolnest.ai/ai-tools`, title: ` | ToolNest AI`, description: category.description },
  twitter: { card: `summary_large_image`, title: ` | ToolNest AI`, description: category.description },
};
export default function AIToolsPage() { return <CategoryPageContent category={category} tools={tools} />; }

