import type { Metadata } from "next";
import { getToolBySlug } from "@/lib/tools";
import ToolPageContent from "@/components/tools/ToolPageContent";
import OcrPdfTool from "@/components/tools/implementations/OcrPdfTool";

const SITE_URL = "https://www.toolnestai.net";
const OG_IMAGE  = `${SITE_URL}/og-image.png`;

const tool = getToolBySlug("ocr-pdf")!;

export const metadata: Metadata = {
  title: "OCR PDF – Convert Scanned PDF to Editable Text | ToolNest AI",
  description:
    "Extract editable text from scanned PDF documents online using OCR technology. Fast, secure and free.",
  keywords: tool.keywords,
  alternates: { canonical: `${SITE_URL}/pdf-tools/ocr-pdf` },
  openGraph: {
    type: "website",
    url: `${SITE_URL}/pdf-tools/ocr-pdf`,
    siteName: "ToolNest AI",
    locale: "en_US",
    title: "OCR PDF – Convert Scanned PDF to Editable Text | ToolNest AI",
    description:
      "Extract editable text from scanned PDF documents online using OCR technology. Fast, secure and free.",
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: "OCR PDF | ToolNest AI" }],
  },
  twitter: {
    card: "summary_large_image",
    site: "@toolnestai",
    creator: "@toolnestai",
    title: "OCR PDF – Convert Scanned PDF to Editable Text | ToolNest AI",
    description:
      "Extract editable text from scanned PDF documents online using OCR technology. Fast, secure and free.",
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: "OCR PDF | ToolNest AI" }],
  },
};

export default function OcrPdfPage() {
  return <ToolPageContent tool={tool} toolComponent={<OcrPdfTool />} />;
}
