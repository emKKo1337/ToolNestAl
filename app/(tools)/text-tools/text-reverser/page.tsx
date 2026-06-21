import type { Metadata } from "next";
import { getToolBySlug } from "@/lib/tools";
import ToolPageContent from "@/components/tools/ToolPageContent";
import TextReverserTool from "@/components/tools/implementations/TextReverserTool";

const SITE_URL = "https://www.toolnestai.net";
const OG_IMAGE  = `${SITE_URL}/og-image.png`;

const tool = getToolBySlug("text-reverser")!;

export const metadata: Metadata = {
  title: "Text Reverser – Reverse Text, Words & Lines Online | ToolNest AI",
  description:
    "Reverse text instantly by characters, words or lines using this free online Text Reverser.",
  keywords: tool.keywords,
  alternates: { canonical: `${SITE_URL}/text-tools/text-reverser` },
  openGraph: {
    type: "website",
    url: `${SITE_URL}/text-tools/text-reverser`,
    siteName: "ToolNest AI",
    locale: "en_US",
    title: "Text Reverser – Reverse Text, Words & Lines Online | ToolNest AI",
    description:
      "Reverse text instantly by characters, words or lines using this free online Text Reverser.",
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: "Text Reverser | ToolNest AI" }],
  },
  twitter: {
    card: "summary_large_image",
    site: "@toolnestai",
    creator: "@toolnestai",
    title: "Text Reverser – Reverse Text, Words & Lines Online | ToolNest AI",
    description:
      "Reverse text instantly by characters, words or lines using this free online Text Reverser.",
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: "Text Reverser | ToolNest AI" }],
  },
};

export default function TextReverserPage() {
  return <ToolPageContent tool={tool} toolComponent={<TextReverserTool />} />;
}
