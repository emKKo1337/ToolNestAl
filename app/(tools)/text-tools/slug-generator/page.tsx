import type { Metadata } from "next";
import { getToolBySlug } from "@/lib/tools";
import ToolPageContent from "@/components/tools/ToolPageContent";
import SlugGeneratorTool from "@/components/tools/implementations/SlugGeneratorTool";

const SITE_URL = "https://www.toolnestai.net";
const OG_IMAGE  = `${SITE_URL}/og-image.png`;

const tool = getToolBySlug("slug-generator")!;

export const metadata: Metadata = {
  title: "Slug Generator – Create SEO-Friendly URL Slugs | ToolNest AI",
  description:
    "Generate clean, SEO-friendly URL slugs from any text instantly with this free online Slug Generator.",
  keywords: tool.keywords,
  alternates: { canonical: `${SITE_URL}/text-tools/slug-generator` },
  openGraph: {
    type: "website",
    url: `${SITE_URL}/text-tools/slug-generator`,
    siteName: "ToolNest AI",
    locale: "en_US",
    title: "Slug Generator – Create SEO-Friendly URL Slugs | ToolNest AI",
    description:
      "Generate clean, SEO-friendly URL slugs from any text instantly with this free online Slug Generator.",
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: "Slug Generator | ToolNest AI" }],
  },
  twitter: {
    card: "summary_large_image",
    site: "@toolnestai",
    creator: "@toolnestai",
    title: "Slug Generator – Create SEO-Friendly URL Slugs | ToolNest AI",
    description:
      "Generate clean, SEO-friendly URL slugs from any text instantly with this free online Slug Generator.",
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: "Slug Generator | ToolNest AI" }],
  },
};

export default function SlugGeneratorPage() {
  return <ToolPageContent tool={tool} toolComponent={<SlugGeneratorTool />} />;
}
