import type { Metadata } from "next";
import { getToolBySlug } from "@/lib/tools";
import ToolPageContent from "@/components/tools/ToolPageContent";
import AiTranslatorTool from "@/components/tools/implementations/AiTranslatorTool";

const SITE_URL = "https://www.toolnestai.net";
const OG_IMAGE = `${SITE_URL}/og-image.png`;
const TWITTER_HANDLE = "@toolnestai";

const tool = getToolBySlug("ai-translator")!;
const url = `${SITE_URL}/ai-tools/ai-translator`;

export const metadata: Metadata = {
  title: "AI Translator – Translate Text Instantly with AI | ToolNest AI",
  description:
    "Translate text accurately between multiple languages using AI. Fast, natural and professional translations with six style options including formal, casual, and academic.",
  keywords: tool.keywords,
  alternates: { canonical: url },
  openGraph: {
    type: "website",
    url,
    siteName: "ToolNest AI",
    locale: "en_US",
    title: "AI Translator – Translate Text Instantly with AI | ToolNest AI",
    description:
      "Translate text accurately between multiple languages using AI. Fast, natural and professional translations with six style options including formal, casual, and academic.",
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: "AI Translator | ToolNest AI" }],
  },
  twitter: {
    card: "summary_large_image",
    site: TWITTER_HANDLE,
    creator: TWITTER_HANDLE,
    title: "AI Translator – Translate Text Instantly with AI | ToolNest AI",
    description:
      "Translate text accurately between multiple languages using AI. Fast, natural and professional translations with six style options including formal, casual, and academic.",
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: "AI Translator | ToolNest AI" }],
  },
};

export default function AiTranslatorPage() {
  return <ToolPageContent tool={tool} toolComponent={<AiTranslatorTool />} />;
}
