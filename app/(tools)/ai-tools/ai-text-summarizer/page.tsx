import type { Metadata } from "next";
import { getToolBySlug } from "@/lib/tools";
import ToolPageContent from "@/components/tools/ToolPageContent";
import AiTextSummarizerTool from "@/components/tools/implementations/AiTextSummarizerTool";

const SITE_URL = "https://www.toolnestai.net";
const OG_IMAGE = `${SITE_URL}/og-image.png`;
const TWITTER_HANDLE = "@toolnestai";

const tool = getToolBySlug("ai-text-summarizer")!;
const url = `${SITE_URL}/ai-tools/ai-text-summarizer`;

export const metadata: Metadata = {
  title: "AI Text Summarizer – Summarize Articles & Documents Instantly | ToolNest AI",
  description:
    "Summarize long articles, documents and text into concise summaries using AI in seconds. Choose paragraph, bullet points, executive summary, or key takeaways.",
  keywords: tool.keywords,
  alternates: { canonical: url },
  openGraph: {
    type: "website",
    url,
    siteName: "ToolNest AI",
    locale: "en_US",
    title: "AI Text Summarizer – Summarize Articles & Documents Instantly | ToolNest AI",
    description:
      "Summarize long articles, documents and text into concise summaries using AI in seconds. Choose paragraph, bullet points, executive summary, or key takeaways.",
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: "AI Text Summarizer | ToolNest AI" }],
  },
  twitter: {
    card: "summary_large_image",
    site: TWITTER_HANDLE,
    creator: TWITTER_HANDLE,
    title: "AI Text Summarizer – Summarize Articles & Documents Instantly | ToolNest AI",
    description:
      "Summarize long articles, documents and text into concise summaries using AI in seconds. Choose paragraph, bullet points, executive summary, or key takeaways.",
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: "AI Text Summarizer | ToolNest AI" }],
  },
};

export default function AiTextSummarizerPage() {
  return <ToolPageContent tool={tool} toolComponent={<AiTextSummarizerTool />} />;
}
