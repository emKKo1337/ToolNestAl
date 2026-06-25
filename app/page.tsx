import type { Metadata } from "next";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import MeshBackground from "@/components/sections/MeshBackground";
import Hero from "@/components/sections/Hero";
import CategoryGrid from "@/components/sections/CategoryGrid";
import LatestArticles from "@/components/sections/LatestArticles";
import ScrollToHash from "@/components/sections/ScrollToHash";
import { tools } from "@/lib/tools";

const SITE_URL = "https://www.toolnestai.net";
const OG_IMAGE = `${SITE_URL}/og-image.png`;

export const metadata: Metadata = {
  title: { absolute: "ToolNest AI — Free AI, PDF & Online Tools" },
  description:
    "Discover 80+ free online tools — AI writing assistants, PDF utilities, image editors, developer tools, and more. No sign-up, no limits.",
  alternates: { canonical: SITE_URL },
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: "ToolNest AI",
    locale: "en_US",
    title: "ToolNest AI — Free AI, PDF & Online Tools",
    description:
      "Discover 80+ free online tools — AI writing assistants, PDF utilities, image editors, developer tools, and more. No sign-up, no limits.",
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: "ToolNest AI — Free Online Tools" }],
  },
  twitter: {
    card: "summary_large_image",
    site: "@toolnestai",
    creator: "@toolnestai",
    title: "ToolNest AI — Free AI, PDF & Online Tools",
    description:
      "Discover 80+ free online tools — AI writing assistants, PDF utilities, image editors, developer tools, and more.",
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: "ToolNest AI — Free Online Tools" }],
  },
};

const AI_TOOLS_SLUGS = [
  "ai-chat", "ai-text-summarizer", "ai-grammar-checker", "ai-humanizer",
  "ai-paraphraser", "ai-email-writer", "ai-translator", "ai-resume-builder",
  "ai-prompt-generator", "ai-cover-letter-generator",
];

export default function Home() {
  const featuredTools = tools.filter((t) => AI_TOOLS_SLUGS.includes(t.slug));

  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Free AI & Online Tools",
    description: "Top free online tools — AI writing assistants, PDF utilities, image editors, and developer tools.",
    url: SITE_URL,
    numberOfItems: featuredTools.length,
    itemListElement: featuredTools.map((tool, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: tool.name,
      description: tool.shortDescription,
      url: `${SITE_URL}/${tool.categorySlug}/${tool.slug}`,
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }}
      />
      <MeshBackground />
      <Header />
      <ScrollToHash />
      <main id="main-content" className="flex-grow pt-32 pb-24 px-4 md:px-[48px] w-full max-w-[1280px] mx-auto flex flex-col gap-32">
        <Hero toolCount={tools.length} />
        <CategoryGrid />
        <LatestArticles />
      </main>
      <Footer />
    </>
  );
}
