import type { Metadata } from "next";
import { getToolBySlug } from "@/lib/tools";
import ToolPageContent from "@/components/tools/ToolPageContent";
import PdfMetadataEditorTool from "@/components/tools/implementations/PdfMetadataEditorTool";

const SITE_URL = "https://www.toolnestai.net";
const OG_IMAGE  = `${SITE_URL}/og-image.png`;

const tool = getToolBySlug("pdf-metadata-editor")!;

export const metadata: Metadata = {
  title: "PDF Metadata Editor – View & Edit PDF Metadata Online | ToolNest AI",
  description:
    "Edit, remove and update PDF metadata including title, author, keywords and subject online for free.",
  keywords: tool.keywords,
  alternates: { canonical: `${SITE_URL}/pdf-tools/pdf-metadata-editor` },
  openGraph: {
    type: "website",
    url: `${SITE_URL}/pdf-tools/pdf-metadata-editor`,
    siteName: "ToolNest AI",
    locale: "en_US",
    title: "PDF Metadata Editor – View & Edit PDF Metadata Online | ToolNest AI",
    description:
      "Edit, remove and update PDF metadata including title, author, keywords and subject online for free.",
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: "PDF Metadata Editor | ToolNest AI" }],
  },
  twitter: {
    card: "summary_large_image",
    site: "@toolnestai",
    creator: "@toolnestai",
    title: "PDF Metadata Editor – View & Edit PDF Metadata Online | ToolNest AI",
    description:
      "Edit, remove and update PDF metadata including title, author, keywords and subject online for free.",
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: "PDF Metadata Editor | ToolNest AI" }],
  },
};

export default function PdfMetadataEditorPage() {
  return <ToolPageContent tool={tool} toolComponent={<PdfMetadataEditorTool />} />;
}
