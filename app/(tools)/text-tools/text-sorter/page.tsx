import type { Metadata } from "next";
import { getToolBySlug } from "@/lib/tools";
import ToolPageContent from "@/components/tools/ToolPageContent";
import TextSorterTool from "@/components/tools/implementations/TextSorterTool";

const SITE_URL = "https://www.toolnestai.net";
const OG_IMAGE  = `${SITE_URL}/og-image.png`;

const tool = getToolBySlug("text-sorter")!;

export const metadata: Metadata = {
  title: "Text Sorter – Sort Text Lines Alphabetically or by Length | ToolNest AI",
  description:
    "Sort text alphabetically, reverse, randomly or by line length using this free online Text Sorter.",
  keywords: tool.keywords,
  alternates: { canonical: `${SITE_URL}/text-tools/text-sorter` },
  openGraph: {
    type: "website",
    url: `${SITE_URL}/text-tools/text-sorter`,
    siteName: "ToolNest AI",
    locale: "en_US",
    title: "Text Sorter – Sort Text Lines Alphabetically or by Length | ToolNest AI",
    description:
      "Sort text alphabetically, reverse, randomly or by line length using this free online Text Sorter.",
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: "Text Sorter | ToolNest AI" }],
  },
  twitter: {
    card: "summary_large_image",
    site: "@toolnestai",
    creator: "@toolnestai",
    title: "Text Sorter – Sort Text Lines Alphabetically or by Length | ToolNest AI",
    description:
      "Sort text alphabetically, reverse, randomly or by line length using this free online Text Sorter.",
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: "Text Sorter | ToolNest AI" }],
  },
};

export default function TextSorterPage() {
  return <ToolPageContent tool={tool} toolComponent={<TextSorterTool />} />;
}
