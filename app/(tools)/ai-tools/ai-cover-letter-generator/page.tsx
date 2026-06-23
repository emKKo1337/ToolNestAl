import type { Metadata } from "next";
import { getToolBySlug } from "@/lib/tools";
import ToolPageContent from "@/components/tools/ToolPageContent";
import AiCoverLetterTool from "@/components/tools/implementations/AiCoverLetterTool";

const SITE_URL = "https://www.toolnestai.net";
const OG_IMAGE = `${SITE_URL}/og-image.png`;
const TWITTER_HANDLE = "@toolnestai";

const tool = getToolBySlug("ai-cover-letter-generator")!;
const url = `${SITE_URL}/ai-tools/ai-cover-letter-generator`;

export const metadata: Metadata = {
  title: "AI Cover Letter Generator – Free AI Cover Letter Creator | ToolNest AI",
  description:
    "Create professional cover letters tailored to any job application using AI. Free, fast and ATS-friendly.",
  keywords: tool.keywords,
  alternates: { canonical: url },
  openGraph: {
    type: "website",
    url,
    siteName: "ToolNest AI",
    locale: "en_US",
    title: "AI Cover Letter Generator – Free AI Cover Letter Creator | ToolNest AI",
    description:
      "Create professional cover letters tailored to any job application using AI. Free, fast and ATS-friendly.",
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: "AI Cover Letter Generator | ToolNest AI" }],
  },
  twitter: {
    card: "summary_large_image",
    site: TWITTER_HANDLE,
    creator: TWITTER_HANDLE,
    title: "AI Cover Letter Generator – Free AI Cover Letter Creator | ToolNest AI",
    description:
      "Create professional cover letters tailored to any job application using AI. Free, fast and ATS-friendly.",
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: "AI Cover Letter Generator | ToolNest AI" }],
  },
};

export default function AiCoverLetterPage() {
  return <ToolPageContent tool={tool} toolComponent={<AiCoverLetterTool />} />;
}
