import type { Metadata } from "next";
import { getCategoryBySlug, getToolsByCategory } from "@/lib/tools";
import CategoryPageContent from "@/components/tools/CategoryPageContent";

const category = getCategoryBySlug("calculators")!;
const tools = getToolsByCategory("calculators");

export const metadata: Metadata = { title: "Calculators | ToolNest AI", description: category.description, keywords: ["calculators", "password generator", "QR code generator", "BMI calculator"] };
export default function CalculatorsPage() { return <CategoryPageContent category={category} tools={tools} />; }
