import type { Metadata } from "next";
import { getToolBySlug } from "@/lib/tools";
import ToolPageContent from "@/components/tools/ToolPageContent";
import TextStatisticsTool from "@/components/tools/implementations/TextStatisticsTool";

const SITE_URL = "https://www.toolnestai.net";
const OG_IMAGE  = `${SITE_URL}/og-image.png`;

const tool = getToolBySlug("text-statistics")!;

export const metadata: Metadata = {
  title: "Text Statistics – Analyze Text Instantly | ToolNest AI",
  description:
    "Analyze text with detailed statistics including readability, keyword density, reading time and writing metrics.",
  keywords: tool.keywords,
  alternates: { canonical: `${SITE_URL}/text-tools/text-statistics` },
  openGraph: {
    type: "website",
    url: `${SITE_URL}/text-tools/text-statistics`,
    siteName: "ToolNest AI",
    locale: "en_US",
    title: "Text Statistics – Analyze Text Instantly | ToolNest AI",
    description:
      "Analyze text with detailed statistics including readability, keyword density, reading time and writing metrics.",
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: "Text Statistics | ToolNest AI" }],
  },
  twitter: {
    card: "summary_large_image",
    site: "@toolnestai",
    creator: "@toolnestai",
    title: "Text Statistics – Analyze Text Instantly | ToolNest AI",
    description:
      "Analyze text with detailed statistics including readability, keyword density, reading time and writing metrics.",
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: "Text Statistics | ToolNest AI" }],
  },
};

export default function TextStatisticsPage() {
  return <ToolPageContent tool={tool} toolComponent={<TextStatisticsTool />} />;
}
