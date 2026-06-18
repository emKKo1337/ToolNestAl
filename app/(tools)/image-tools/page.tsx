import type { Metadata } from "next";
import { getCategoryBySlug, getToolsByCategory } from "@/lib/tools";
import CategoryPageContent from "@/components/tools/CategoryPageContent";

const category = getCategoryBySlug("image-tools")!;
const tools = getToolsByCategory("image-tools");

export const metadata: Metadata = { title: "Image Tools | ToolNest AI", description: category.description, keywords: ["image tools", "remove background", "image resizer", "image compressor"] };
export default function ImageToolsPage() { return <CategoryPageContent category={category} tools={tools} />; }
