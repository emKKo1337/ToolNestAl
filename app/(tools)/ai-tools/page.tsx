import type { Metadata } from "next";
import { getCategoryBySlug, getToolsByCategory } from "@/lib/tools";
import CategoryPageContent from "@/components/tools/CategoryPageContent";

const category = getCategoryBySlug("ai-tools")!;
const tools = getToolsByCategory("ai-tools");

export const metadata: Metadata = { title: "AI Tools | ToolNest AI", description: category.description, keywords: ["AI tools", "free AI tools", "AI writing", "AI productivity"] };
export default function AIToolsPage() { return <CategoryPageContent category={category} tools={tools} />; }
