import type { Metadata } from "next";
import { getToolBySlug } from "@/lib/tools";
import ToolPageContent from "@/components/tools/ToolPageContent";
import AiHumanizerTool from "@/components/tools/implementations/AiHumanizerTool";

const SITE_URL = "https://www.toolnestai.net";
const OG_IMAGE = `${SITE_URL}/og-image.png`;
const TWITTER_HANDLE = "@toolnestai";

const tool = getToolBySlug("ai-humanizer")!;
const url = `${SITE_URL}/ai-tools/ai-humanizer`;

export const metadata: Metadata = {
  title: "AI Humanizer – Free AI Text Humanizer | ToolNest AI",
  description:
    "Convert AI-generated text into natural, human-like writing for free. Improve readability and create authentic content instantly.",
  keywords: tool.keywords,
  alternates: { canonical: url },
  openGraph: {
    type: "website",
    url,
    siteName: "ToolNest AI",
    locale: "en_US",
    title: "AI Humanizer – Free AI Text Humanizer | ToolNest AI",
    description:
      "Convert AI-generated text into natural, human-like writing for free. Improve readability and create authentic content instantly.",
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: "AI Humanizer | ToolNest AI" }],
  },
  twitter: {
    card: "summary_large_image",
    site: TWITTER_HANDLE,
    creator: TWITTER_HANDLE,
    title: "AI Humanizer – Free AI Text Humanizer | ToolNest AI",
    description:
      "Convert AI-generated text into natural, human-like writing for free. Improve readability and create authentic content instantly.",
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: "AI Humanizer | ToolNest AI" }],
  },
};

export default function AiHumanizerPage() {
  return <ToolPageContent tool={tool} toolComponent={<AiHumanizerTool />} />;
}
