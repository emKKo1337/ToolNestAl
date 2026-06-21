import type { Metadata } from "next";
import { getToolBySlug } from "@/lib/tools";
import ToolPageContent from "@/components/tools/ToolPageContent";
import ReorderPdfPagesTool from "@/components/tools/implementations/ReorderPdfPagesTool";

const SITE_URL = "https://www.toolnestai.net";
const OG_IMAGE  = `${SITE_URL}/og-image.png`;

const tool = getToolBySlug("reorder-pdf-pages")!;

export const metadata: Metadata = {
  title: "Reorder PDF Pages – Rearrange PDF Pages Online | ToolNest AI",
  description:
    "Reorder PDF pages online by dragging and dropping pages into any order. Free, secure and easy to use.",
  keywords: tool.keywords,
  alternates: { canonical: `${SITE_URL}/pdf-tools/reorder-pdf-pages` },
  openGraph: {
    type: "website",
    url: `${SITE_URL}/pdf-tools/reorder-pdf-pages`,
    siteName: "ToolNest AI",
    locale: "en_US",
    title: "Reorder PDF Pages – Rearrange PDF Pages Online | ToolNest AI",
    description:
      "Reorder PDF pages online by dragging and dropping pages into any order. Free, secure and easy to use.",
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: "Reorder PDF Pages | ToolNest AI" }],
  },
  twitter: {
    card: "summary_large_image",
    site: "@toolnestai",
    creator: "@toolnestai",
    title: "Reorder PDF Pages – Rearrange PDF Pages Online | ToolNest AI",
    description:
      "Reorder PDF pages online by dragging and dropping pages into any order. Free, secure and easy to use.",
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: "Reorder PDF Pages | ToolNest AI" }],
  },
};

export default function ReorderPdfPagesPage() {
  return <ToolPageContent tool={tool} toolComponent={<ReorderPdfPagesTool />} />;
}
