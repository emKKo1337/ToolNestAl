import type { Metadata } from "next";
import { getToolBySlug } from "@/lib/tools";
import ToolPageContent from "@/components/tools/ToolPageContent";
import OrganizePdfTool from "@/components/tools/implementations/OrganizePdfTool";

const SITE_URL = "https://www.toolnestai.net";
const OG_IMAGE  = `${SITE_URL}/og-image.png`;

const tool = getToolBySlug("organize-pdf")!;

export const metadata: Metadata = {
  title: "Organize PDF – Rearrange, Rotate & Delete PDF Pages | ToolNest AI",
  description:
    "Organize PDF pages online. Reorder, rotate, duplicate and delete pages in one free PDF editor.",
  keywords: tool.keywords,
  alternates: { canonical: `${SITE_URL}/pdf-tools/organize-pdf` },
  openGraph: {
    type: "website",
    url: `${SITE_URL}/pdf-tools/organize-pdf`,
    siteName: "ToolNest AI",
    locale: "en_US",
    title: "Organize PDF – Rearrange, Rotate & Delete PDF Pages | ToolNest AI",
    description:
      "Organize PDF pages online. Reorder, rotate, duplicate and delete pages in one free PDF editor.",
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: "Organize PDF | ToolNest AI" }],
  },
  twitter: {
    card: "summary_large_image",
    site: "@toolnestai",
    creator: "@toolnestai",
    title: "Organize PDF – Rearrange, Rotate & Delete PDF Pages | ToolNest AI",
    description:
      "Organize PDF pages online. Reorder, rotate, duplicate and delete pages in one free PDF editor.",
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: "Organize PDF | ToolNest AI" }],
  },
};

export default function OrganizePdfPage() {
  return <ToolPageContent tool={tool} toolComponent={<OrganizePdfTool />} />;
}
