import type { Metadata } from "next";
import { getCategoryBySlug, getToolsByCategory } from "@/lib/tools";
import CategoryPageContent from "@/components/tools/CategoryPageContent";

const category = getCategoryBySlug("calculators")!;
const tools = getToolsByCategory("calculators");

export const metadata: Metadata = {
  title: ` | ToolNest AI`,
  description: category.description,
  alternates: { canonical: `https://toolnest.ai/calculators` },
  openGraph: { type: `website`, url: `https://toolnest.ai/calculators`, title: ` | ToolNest AI`, description: category.description },
  twitter: { card: `summary_large_image`, title: ` | ToolNest AI`, description: category.description },
};
export default function CalculatorsPage() { return <CategoryPageContent category={category} tools={tools} />; }

