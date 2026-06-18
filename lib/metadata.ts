import type { Metadata } from "next";
import type { Tool } from "@/lib/tools";

const SITE_URL = "https://toolnest.ai";
const SITE_NAME = "ToolNest AI";

export function generateToolMetadata(tool: Tool): Metadata {
  const url = `${SITE_URL}/${tool.categorySlug}/${tool.slug}`;
  const title = `${tool.name} — Free Online Tool`;
  const ogImage = `${SITE_URL}/og-image.png`;

  return {
    title,
    description: tool.shortDescription,
    keywords: tool.keywords,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      url,
      siteName: SITE_NAME,
      title: `${title} | ${SITE_NAME}`,
      description: tool.description,
      images: [{ url: ogImage, width: 1200, height: 630, alt: tool.name }],
    },
    twitter: {
      card: "summary_large_image",
      site: "@toolnestai",
      title: `${title} | ${SITE_NAME}`,
      description: tool.shortDescription,
      images: [ogImage],
    },
  };
}
