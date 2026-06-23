import type { Metadata } from "next";
import { getToolBySlug } from "@/lib/tools";
import ToolPageContent from "@/components/tools/ToolPageContent";
import AiUsernameGeneratorTool from "@/components/tools/implementations/AiUsernameGeneratorTool";

const SITE_URL = "https://www.toolnestai.net";
const OG_IMAGE = `${SITE_URL}/og-image.png`;
const TWITTER_HANDLE = "@toolnestai";

const tool = getToolBySlug("ai-username-generator")!;
const url = `${SITE_URL}/ai-tools/ai-username-generator`;

export const metadata: Metadata = {
  title: "AI Username Generator – Free Username Generator | ToolNest AI",
  description:
    "Generate unique usernames for Instagram, TikTok, YouTube, Steam, Discord and more using AI. Free and instant.",
  keywords: tool.keywords,
  alternates: { canonical: url },
  openGraph: {
    type: "website",
    url,
    siteName: "ToolNest AI",
    locale: "en_US",
    title: "AI Username Generator – Free Username Generator | ToolNest AI",
    description:
      "Generate unique usernames for Instagram, TikTok, YouTube, Steam, Discord and more using AI. Free and instant.",
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: "AI Username Generator | ToolNest AI" }],
  },
  twitter: {
    card: "summary_large_image",
    site: TWITTER_HANDLE,
    creator: TWITTER_HANDLE,
    title: "AI Username Generator – Free Username Generator | ToolNest AI",
    description:
      "Generate unique usernames for Instagram, TikTok, YouTube, Steam, Discord and more using AI. Free and instant.",
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: "AI Username Generator | ToolNest AI" }],
  },
};

export default function AiUsernameGeneratorPage() {
  return <ToolPageContent tool={tool} toolComponent={<AiUsernameGeneratorTool />} />;
}
