import type { Metadata } from "next";
import { getToolBySlug } from "@/lib/tools";
import ToolPageContent from "@/components/tools/ToolPageContent";
import LoremIpsumGeneratorTool from "@/components/tools/implementations/LoremIpsumGeneratorTool";

const SITE_URL = "https://www.toolnestai.net";
const OG_IMAGE  = `${SITE_URL}/og-image.png`;

const tool = getToolBySlug("lorem-ipsum-generator")!;

export const metadata: Metadata = {
  title: "Lorem Ipsum Generator – Free Placeholder Text Generator | ToolNest AI",
  description:
    "Generate Lorem Ipsum placeholder text instantly. Create words, sentences or paragraphs for web design, UI mockups and documents.",
  keywords: tool.keywords,
  alternates: { canonical: `${SITE_URL}/text-tools/lorem-ipsum-generator` },
  openGraph: {
    type: "website",
    url: `${SITE_URL}/text-tools/lorem-ipsum-generator`,
    siteName: "ToolNest AI",
    locale: "en_US",
    title: "Lorem Ipsum Generator – Free Placeholder Text Generator | ToolNest AI",
    description:
      "Generate Lorem Ipsum placeholder text instantly. Create words, sentences or paragraphs for web design, UI mockups and documents.",
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: "Lorem Ipsum Generator | ToolNest AI" }],
  },
  twitter: {
    card: "summary_large_image",
    site: "@toolnestai",
    creator: "@toolnestai",
    title: "Lorem Ipsum Generator – Free Placeholder Text Generator | ToolNest AI",
    description:
      "Generate Lorem Ipsum placeholder text instantly. Create words, sentences or paragraphs for web design, UI mockups and documents.",
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: "Lorem Ipsum Generator | ToolNest AI" }],
  },
};

export default function LoremIpsumGeneratorPage() {
  return <ToolPageContent tool={tool} toolComponent={<LoremIpsumGeneratorTool />} />;
}
