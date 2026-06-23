import type { Metadata } from "next";
import { getToolBySlug } from "@/lib/tools";
import ToolPageContent from "@/components/tools/ToolPageContent";
import AiParaphraserTool from "@/components/tools/implementations/AiParaphraserTool";

const SITE_URL = "https://www.toolnestai.net";
const OG_IMAGE = `${SITE_URL}/og-image.png`;
const TWITTER_HANDLE = "@toolnestai";

const tool = getToolBySlug("ai-paraphraser")!;
const url = `${SITE_URL}/ai-tools/ai-paraphraser`;

export const metadata: Metadata = {
  title: "AI Paraphraser – Rewrite Text Online Free | ToolNest AI",
  description:
    "Rewrite sentences and paragraphs while preserving their original meaning. Choose from Standard, Fluent, Creative, Academic, Shorten, or Expand modes.",
  keywords: tool.keywords,
  alternates: { canonical: url },
  openGraph: {
    type: "website",
    url,
    siteName: "ToolNest AI",
    locale: "en_US",
    title: "AI Paraphraser – Rewrite Text Online Free | ToolNest AI",
    description:
      "Rewrite sentences and paragraphs while preserving their original meaning. Choose from Standard, Fluent, Creative, Academic, Shorten, or Expand modes.",
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: "AI Paraphraser | ToolNest AI" }],
  },
  twitter: {
    card: "summary_large_image",
    site: TWITTER_HANDLE,
    creator: TWITTER_HANDLE,
    title: "AI Paraphraser – Rewrite Text Online Free | ToolNest AI",
    description:
      "Rewrite sentences and paragraphs while preserving their original meaning. Choose from Standard, Fluent, Creative, Academic, Shorten, or Expand modes.",
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: "AI Paraphraser | ToolNest AI" }],
  },
};

export default function AiParaphraserPage() {
  return <ToolPageContent tool={tool} toolComponent={<AiParaphraserTool />} />;
}
