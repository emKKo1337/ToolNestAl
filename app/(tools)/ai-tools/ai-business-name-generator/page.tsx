import type { Metadata } from "next";
import { getToolBySlug } from "@/lib/tools";
import ToolPageContent from "@/components/tools/ToolPageContent";
import AiBusinessNameGeneratorTool from "@/components/tools/implementations/AiBusinessNameGeneratorTool";

const SITE_URL = "https://www.toolnestai.net";
const OG_IMAGE = `${SITE_URL}/og-image.png`;
const TWITTER_HANDLE = "@toolnestai";

const tool = getToolBySlug("ai-business-name-generator")!;
const url = `${SITE_URL}/ai-tools/ai-business-name-generator`;

export const metadata: Metadata = {
  title: "AI Business Name Generator – Free Business Name Creator | ToolNest AI",
  description:
    "Generate unique business names with AI. Find creative, memorable and brandable company names in seconds.",
  keywords: tool.keywords,
  alternates: { canonical: url },
  openGraph: {
    type: "website",
    url,
    siteName: "ToolNest AI",
    locale: "en_US",
    title: "AI Business Name Generator – Free Business Name Creator | ToolNest AI",
    description:
      "Generate unique business names with AI. Find creative, memorable and brandable company names in seconds.",
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: "AI Business Name Generator | ToolNest AI" }],
  },
  twitter: {
    card: "summary_large_image",
    site: TWITTER_HANDLE,
    creator: TWITTER_HANDLE,
    title: "AI Business Name Generator – Free Business Name Creator | ToolNest AI",
    description:
      "Generate unique business names with AI. Find creative, memorable and brandable company names in seconds.",
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: "AI Business Name Generator | ToolNest AI" }],
  },
};

export default function AiBusinessNameGeneratorPage() {
  return <ToolPageContent tool={tool} toolComponent={<AiBusinessNameGeneratorTool />} />;
}
