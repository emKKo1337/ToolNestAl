import type { Metadata } from "next";
import { getCategoryBySlug, getToolsByCategory } from "@/lib/tools";
import CategoryPageContent from "@/components/tools/CategoryPageContent";

const category = getCategoryBySlug("pdf-tools")!;
const tools = getToolsByCategory("pdf-tools");

export const metadata: Metadata = { title: "PDF Tools | ToolNest AI", description: category.description, keywords: ["PDF tools", "PDF converter", "merge PDF", "compress PDF"] };
export default function PDFToolsPage() { return <CategoryPageContent category={category} tools={tools} />; }
