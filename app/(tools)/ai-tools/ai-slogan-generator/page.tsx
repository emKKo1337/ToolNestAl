import type { Metadata } from "next";
import { getToolBySlug } from "@/lib/tools";
import ToolPageContent from "@/components/tools/ToolPageContent";
import AiSloganGeneratorTool from "@/components/tools/implementations/AiSloganGeneratorTool";

const SITE_URL = "https://www.toolnestai.net";
const OG_IMAGE = `${SITE_URL}/og-image.png`;
const TWITTER_HANDLE = "@toolnestai";

const tool = getToolBySlug("ai-slogan-generator")!;
const url = `${SITE_URL}/ai-tools/ai-slogan-generator`;

export const metadata: Metadata = {
  title: "AI Slogan Generator – Free AI Tagline & Slogan Creator | ToolNest AI",
  description:
    "Generate memorable slogans and taglines for your business, startup or brand using AI. Free, fast and creative.",
  keywords: tool.keywords,
  alternates: { canonical: url },
  openGraph: {
    type: "website",
    url,
    siteName: "ToolNest AI",
    locale: "en_US",
    title: "AI Slogan Generator – Free AI Tagline & Slogan Creator | ToolNest AI",
    description:
      "Generate memorable slogans and taglines for your business, startup or brand using AI. Free, fast and creative.",
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: "AI Slogan Generator | ToolNest AI" }],
  },
  twitter: {
    card: "summary_large_image",
    site: TWITTER_HANDLE,
    creator: TWITTER_HANDLE,
    title: "AI Slogan Generator – Free AI Tagline & Slogan Creator | ToolNest AI",
    description:
      "Generate memorable slogans and taglines for your business, startup or brand using AI. Free, fast and creative.",
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: "AI Slogan Generator | ToolNest AI" }],
  },
};

export default function AiSloganGeneratorPage() {
  return <ToolPageContent tool={tool} toolComponent={<AiSloganGeneratorTool />} />;
}
