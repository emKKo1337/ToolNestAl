import type { Metadata } from "next";
import { getToolBySlug } from "@/lib/tools";
import ToolPageContent from "@/components/tools/ToolPageContent";
import FindAndReplaceTool from "@/components/tools/implementations/FindAndReplaceTool";

const SITE_URL = "https://www.toolnestai.net";
const OG_IMAGE  = `${SITE_URL}/og-image.png`;

const tool = getToolBySlug("find-and-replace")!;

export const metadata: Metadata = {
  title: "Find and Replace Text – Free Online Find & Replace Tool | ToolNest AI",
  description:
    "Find and replace words, phrases or characters instantly using this free online Find & Replace tool.",
  keywords: tool.keywords,
  alternates: { canonical: `${SITE_URL}/text-tools/find-and-replace` },
  openGraph: {
    type: "website",
    url: `${SITE_URL}/text-tools/find-and-replace`,
    siteName: "ToolNest AI",
    locale: "en_US",
    title: "Find and Replace Text – Free Online Find & Replace Tool | ToolNest AI",
    description:
      "Find and replace words, phrases or characters instantly using this free online Find & Replace tool.",
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: "Find & Replace | ToolNest AI" }],
  },
  twitter: {
    card: "summary_large_image",
    site: "@toolnestai",
    creator: "@toolnestai",
    title: "Find and Replace Text – Free Online Find & Replace Tool | ToolNest AI",
    description:
      "Find and replace words, phrases or characters instantly using this free online Find & Replace tool.",
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: "Find & Replace | ToolNest AI" }],
  },
};

export default function FindAndReplacePage() {
  return <ToolPageContent tool={tool} toolComponent={<FindAndReplaceTool />} />;
}
