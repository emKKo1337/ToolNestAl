import type { Metadata } from "next";
import { getCategoryBySlug, getToolsByCategory } from "@/lib/tools";
import CategoryPageContent from "@/components/tools/CategoryPageContent";

const category = getCategoryBySlug("developer-tools")!;
const tools = getToolsByCategory("developer-tools");

export const metadata: Metadata = { title: "Developer Tools | ToolNest AI", description: category.description, keywords: ["developer tools", "JSON formatter", "Base64 encoder", "UUID generator"] };
export default function DeveloperToolsPage() { return <CategoryPageContent category={category} tools={tools} />; }
