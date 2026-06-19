import type { Metadata } from "next";
import FavoritesPageContent from "@/components/tools/FavoritesPageContent";

export const metadata: Metadata = {
  title: "My Favorites — Saved Tools",
  description: "Your saved favorite tools on ToolNest AI. Quick access to the free online tools you use most.",
  alternates: { canonical: "https://toolnest.ai/favorites" },
  robots: { index: false, follow: false },
};

export default function FavoritesPage() {
  return <FavoritesPageContent />;
}
