import type { Metadata } from "next";
import FavoritesPageContent from "@/components/tools/FavoritesPageContent";

export const metadata: Metadata = {
  title: "My Favorites",
  description: "Your saved favorite tools on ToolNest AI.",
  alternates: { canonical: "https://toolnest.ai/favorites" },
};

export default function FavoritesPage() {
  return <FavoritesPageContent />;
}
