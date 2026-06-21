import type { Metadata } from "next";
import { getToolBySlug } from "@/lib/tools";
import ToolPageContent from "@/components/tools/ToolPageContent";
import DeletePdfPagesTool from "@/components/tools/implementations/DeletePdfPagesTool";

const SITE_URL = "https://www.toolnestai.net";
const OG_IMAGE  = `${SITE_URL}/og-image.png`;

const tool = getToolBySlug("delete-pdf-pages")!;

export const metadata: Metadata = {
  title: "Delete PDF Pages – Remove Pages from PDF Online | ToolNest AI",
  description:
    "Delete one or multiple pages from your PDF online for free while keeping the remaining pages intact.",
  keywords: tool.keywords,
  alternates: { canonical: `${SITE_URL}/pdf-tools/delete-pdf-pages` },
  openGraph: {
    type: "website",
    url: `${SITE_URL}/pdf-tools/delete-pdf-pages`,
    siteName: "ToolNest AI",
    locale: "en_US",
    title: "Delete PDF Pages – Remove Pages from PDF Online | ToolNest AI",
    description:
      "Delete one or multiple pages from your PDF online for free while keeping the remaining pages intact.",
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: "Delete PDF Pages | ToolNest AI" }],
  },
  twitter: {
    card: "summary_large_image",
    site: "@toolnestai",
    creator: "@toolnestai",
    title: "Delete PDF Pages – Remove Pages from PDF Online | ToolNest AI",
    description:
      "Delete one or multiple pages from your PDF online for free while keeping the remaining pages intact.",
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: "Delete PDF Pages | ToolNest AI" }],
  },
};

export default function DeletePdfPagesPage() {
  return <ToolPageContent tool={tool} toolComponent={<DeletePdfPagesTool />} />;
}
