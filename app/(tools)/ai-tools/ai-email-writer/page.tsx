import type { Metadata } from "next";
import { getToolBySlug } from "@/lib/tools";
import ToolPageContent from "@/components/tools/ToolPageContent";
import AiEmailWriterTool from "@/components/tools/implementations/AiEmailWriterTool";

const SITE_URL = "https://www.toolnestai.net";
const OG_IMAGE = `${SITE_URL}/og-image.png`;
const TWITTER_HANDLE = "@toolnestai";

const tool = getToolBySlug("ai-email-writer")!;
const url = `${SITE_URL}/ai-tools/ai-email-writer`;

export const metadata: Metadata = {
  title: "AI Email Writer – Write Professional Emails Instantly | ToolNest AI",
  description:
    "Generate professional emails using AI in seconds. Choose a template, set the tone and length, and get a polished email — subject, body, and closing included.",
  keywords: tool.keywords,
  alternates: { canonical: url },
  openGraph: {
    type: "website",
    url,
    siteName: "ToolNest AI",
    locale: "en_US",
    title: "AI Email Writer – Write Professional Emails Instantly | ToolNest AI",
    description:
      "Generate professional emails using AI in seconds. Choose a template, set the tone and length, and get a polished email — subject, body, and closing included.",
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: "AI Email Writer | ToolNest AI" }],
  },
  twitter: {
    card: "summary_large_image",
    site: TWITTER_HANDLE,
    creator: TWITTER_HANDLE,
    title: "AI Email Writer – Write Professional Emails Instantly | ToolNest AI",
    description:
      "Generate professional emails using AI in seconds. Choose a template, set the tone and length, and get a polished email — subject, body, and closing included.",
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: "AI Email Writer | ToolNest AI" }],
  },
};

export default function AiEmailWriterPage() {
  return <ToolPageContent tool={tool} toolComponent={<AiEmailWriterTool />} />;
}
