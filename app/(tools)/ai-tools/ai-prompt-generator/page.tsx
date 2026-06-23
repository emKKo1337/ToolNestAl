import type { Metadata } from "next";
import { getToolBySlug } from "@/lib/tools";
import ToolPageContent from "@/components/tools/ToolPageContent";
import AiPromptGeneratorTool from "@/components/tools/implementations/AiPromptGeneratorTool";

const SITE_URL = "https://www.toolnestai.net";
const OG_IMAGE = `${SITE_URL}/og-image.png`;
const TWITTER_HANDLE = "@toolnestai";

const tool = getToolBySlug("ai-prompt-generator")!;
const url = `${SITE_URL}/ai-tools/ai-prompt-generator`;

export const metadata: Metadata = {
  title: "AI Prompt Generator – Free Prompt Creator for ChatGPT & Claude | ToolNest AI",
  description:
    "Create high-quality prompts for ChatGPT, Claude, Gemini and other AI models instantly with our free AI Prompt Generator.",
  keywords: tool.keywords,
  alternates: { canonical: url },
  openGraph: {
    type: "website",
    url,
    siteName: "ToolNest AI",
    locale: "en_US",
    title: "AI Prompt Generator – Free Prompt Creator for ChatGPT & Claude | ToolNest AI",
    description:
      "Create high-quality prompts for ChatGPT, Claude, Gemini and other AI models instantly with our free AI Prompt Generator.",
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: "AI Prompt Generator | ToolNest AI" }],
  },
  twitter: {
    card: "summary_large_image",
    site: TWITTER_HANDLE,
    creator: TWITTER_HANDLE,
    title: "AI Prompt Generator – Free Prompt Creator for ChatGPT & Claude | ToolNest AI",
    description:
      "Create high-quality prompts for ChatGPT, Claude, Gemini and other AI models instantly with our free AI Prompt Generator.",
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: "AI Prompt Generator | ToolNest AI" }],
  },
};

export default function AiPromptGeneratorPage() {
  return <ToolPageContent tool={tool} toolComponent={<AiPromptGeneratorTool />} />;
}
