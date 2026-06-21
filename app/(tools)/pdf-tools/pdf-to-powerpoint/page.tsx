import type { Metadata } from "next";
import { getToolBySlug } from "@/lib/tools";
import ToolPageContent from "@/components/tools/ToolPageContent";
import PdfToPowerPointTool from "@/components/tools/implementations/PdfToPowerPointTool";

const SITE_URL = "https://www.toolnestai.net";
const OG_IMAGE  = `${SITE_URL}/og-image.png`;

const tool = getToolBySlug("pdf-to-powerpoint")!;

export const metadata: Metadata = {
  title: "PDF to PowerPoint – Convert PDF to PPTX Online | ToolNest AI",
  description:
    "Convert PDF documents into editable PowerPoint presentations online for free.",
  keywords: tool.keywords,
  alternates: { canonical: `${SITE_URL}/pdf-tools/pdf-to-powerpoint` },
  openGraph: {
    type: "website",
    url: `${SITE_URL}/pdf-tools/pdf-to-powerpoint`,
    siteName: "ToolNest AI",
    locale: "en_US",
    title: "PDF to PowerPoint – Convert PDF to PPTX Online | ToolNest AI",
    description:
      "Convert PDF documents into editable PowerPoint presentations online for free.",
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: "PDF to PowerPoint | ToolNest AI" }],
  },
  twitter: {
    card: "summary_large_image",
    site: "@toolnestai",
    creator: "@toolnestai",
    title: "PDF to PowerPoint – Convert PDF to PPTX Online | ToolNest AI",
    description:
      "Convert PDF documents into editable PowerPoint presentations online for free.",
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: "PDF to PowerPoint | ToolNest AI" }],
  },
};

export default function PdfToPowerPointPage() {
  return <ToolPageContent tool={tool} toolComponent={<PdfToPowerPointTool />} />;
}
