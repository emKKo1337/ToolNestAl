import type { Metadata } from "next";
import { getToolBySlug } from "@/lib/tools";
import ToolPageContent from "@/components/tools/ToolPageContent";
import AiProductDescriptionTool from "@/components/tools/implementations/AiProductDescriptionTool";

const SITE_URL = "https://www.toolnestai.net";
const OG_IMAGE = `${SITE_URL}/og-image.png`;
const TWITTER_HANDLE = "@toolnestai";

const tool = getToolBySlug("ai-product-description-generator")!;
const url = `${SITE_URL}/ai-tools/ai-product-description-generator`;

export const metadata: Metadata = {
  title: "AI Product Description Generator — Write Descriptions Free | ToolNest AI",
  description:
    "Create high-converting, SEO-friendly product descriptions for Shopify, Amazon, Etsy and WooCommerce using AI.",
  keywords: tool.keywords,
  alternates: { canonical: url },
  openGraph: {
    type: "website",
    url,
    siteName: "ToolNest AI",
    locale: "en_US",
    title:
      "AI Product Description Generator — Write Descriptions Free | ToolNest AI",
    description:
      "Create high-converting, SEO-friendly product descriptions for Shopify, Amazon, Etsy and WooCommerce using AI.",
    images: [
      {
        url: OG_IMAGE,
        width: 1200,
        height: 630,
        alt: "AI Product Description Generator | ToolNest AI",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: TWITTER_HANDLE,
    creator: TWITTER_HANDLE,
    title:
      "AI Product Description Generator — Write Descriptions Free | ToolNest AI",
    description:
      "Create high-converting, SEO-friendly product descriptions for Shopify, Amazon, Etsy and WooCommerce using AI.",
    images: [
      {
        url: OG_IMAGE,
        width: 1200,
        height: 630,
        alt: "AI Product Description Generator | ToolNest AI",
      },
    ],
  },
};

export default function AiProductDescriptionPage() {
  return (
    <ToolPageContent tool={tool} toolComponent={<AiProductDescriptionTool />} />
  );
}
