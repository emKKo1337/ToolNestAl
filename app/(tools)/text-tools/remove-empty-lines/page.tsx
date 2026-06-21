import type { Metadata } from "next";
import { getToolBySlug } from "@/lib/tools";
import ToolPageContent from "@/components/tools/ToolPageContent";
import RemoveEmptyLinesTool from "@/components/tools/implementations/RemoveEmptyLinesTool";

const SITE_URL = "https://www.toolnestai.net";
const OG_IMAGE  = `${SITE_URL}/og-image.png`;

const tool = getToolBySlug("remove-empty-lines")!;

export const metadata: Metadata = {
  title: "Remove Empty Lines – Free Online Text Cleaner | ToolNest AI",
  description:
    "Remove empty and blank lines from text instantly using this free online tool. Fast, private and processed entirely in your browser.",
  keywords: tool.keywords,
  alternates: { canonical: `${SITE_URL}/text-tools/remove-empty-lines` },
  openGraph: {
    type: "website",
    url: `${SITE_URL}/text-tools/remove-empty-lines`,
    siteName: "ToolNest AI",
    locale: "en_US",
    title: "Remove Empty Lines – Free Online Text Cleaner | ToolNest AI",
    description:
      "Remove empty and blank lines from text instantly using this free online tool. Fast, private and processed entirely in your browser.",
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: "Remove Empty Lines | ToolNest AI" }],
  },
  twitter: {
    card: "summary_large_image",
    site: "@toolnestai",
    creator: "@toolnestai",
    title: "Remove Empty Lines – Free Online Text Cleaner | ToolNest AI",
    description:
      "Remove empty and blank lines from text instantly using this free online tool. Fast, private and processed entirely in your browser.",
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: "Remove Empty Lines | ToolNest AI" }],
  },
};

export default function RemoveEmptyLinesPage() {
  return <ToolPageContent tool={tool} toolComponent={<RemoveEmptyLinesTool />} />;
}
