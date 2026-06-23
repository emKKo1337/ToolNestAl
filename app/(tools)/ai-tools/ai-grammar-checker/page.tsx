import type { Metadata } from "next";
import { getToolBySlug } from "@/lib/tools";
import ToolPageContent from "@/components/tools/ToolPageContent";
import AiGrammarCheckerTool from "@/components/tools/implementations/AiGrammarCheckerTool";

const SITE_URL = "https://www.toolnestai.net";
const OG_IMAGE = `${SITE_URL}/og-image.png`;
const TWITTER_HANDLE = "@toolnestai";

const tool = getToolBySlug("ai-grammar-checker")!;
const url = `${SITE_URL}/ai-tools/ai-grammar-checker`;

export const metadata: Metadata = {
  title: "AI Grammar Checker – Free AI Grammar & Spell Checker | ToolNest AI",
  description:
    "Fix grammar, spelling and punctuation mistakes instantly with our free AI Grammar Checker. Improve your writing in seconds.",
  keywords: tool.keywords,
  alternates: { canonical: url },
  openGraph: {
    type: "website",
    url,
    siteName: "ToolNest AI",
    locale: "en_US",
    title: "AI Grammar Checker – Free AI Grammar & Spell Checker | ToolNest AI",
    description:
      "Fix grammar, spelling and punctuation mistakes instantly with our free AI Grammar Checker. Improve your writing in seconds.",
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: "AI Grammar Checker | ToolNest AI" }],
  },
  twitter: {
    card: "summary_large_image",
    site: TWITTER_HANDLE,
    creator: TWITTER_HANDLE,
    title: "AI Grammar Checker – Free AI Grammar & Spell Checker | ToolNest AI",
    description:
      "Fix grammar, spelling and punctuation mistakes instantly with our free AI Grammar Checker. Improve your writing in seconds.",
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: "AI Grammar Checker | ToolNest AI" }],
  },
};

export default function AiGrammarCheckerPage() {
  return <ToolPageContent tool={tool} toolComponent={<AiGrammarCheckerTool />} />;
}
