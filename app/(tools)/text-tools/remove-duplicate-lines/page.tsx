import type { Metadata } from "next";
import { getToolBySlug } from "@/lib/tools";
import ToolPageContent from "@/components/tools/ToolPageContent";
import RemoveDuplicateLinesTool from "@/components/tools/implementations/RemoveDuplicateLinesTool";

const SITE_URL = "https://www.toolnestai.net";
const OG_IMAGE  = `${SITE_URL}/og-image.png`;

const tool = getToolBySlug("remove-duplicate-lines")!;

export const metadata: Metadata = {
  title: "Remove Duplicate Lines – Free Online Text Cleaner | ToolNest AI",
  description:
    "Remove duplicate lines from text instantly. Clean text while preserving order with this free online tool.",
  keywords: tool.keywords,
  alternates: { canonical: `${SITE_URL}/text-tools/remove-duplicate-lines` },
  openGraph: {
    type: "website",
    url: `${SITE_URL}/text-tools/remove-duplicate-lines`,
    siteName: "ToolNest AI",
    locale: "en_US",
    title: "Remove Duplicate Lines – Free Online Text Cleaner | ToolNest AI",
    description:
      "Remove duplicate lines from text instantly. Clean text while preserving order with this free online tool.",
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: "Remove Duplicate Lines | ToolNest AI" }],
  },
  twitter: {
    card: "summary_large_image",
    site: "@toolnestai",
    creator: "@toolnestai",
    title: "Remove Duplicate Lines – Free Online Text Cleaner | ToolNest AI",
    description:
      "Remove duplicate lines from text instantly. Clean text while preserving order with this free online tool.",
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: "Remove Duplicate Lines | ToolNest AI" }],
  },
};

export default function RemoveDuplicateLinesPage() {
  return <ToolPageContent tool={tool} toolComponent={<RemoveDuplicateLinesTool />} />;
}
